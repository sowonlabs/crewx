#!/usr/bin/env node
/**
 * CrewX LSP Skill - tsserver CLI Wrapper
 *
 * tsserver와 JSON 프로토콜로 통신하여 LSP 기능을 CLI에서 사용할 수 있게 해줍니다.
 *
 * Usage:
 *   node lsp.js find <symbol>                     # 심볼 이름으로 검색 (NEW!)
 *   node lsp.js info <file> <symbol>              # 심볼 타입 정보 (NEW!)
 *   node lsp.js definition <file> <line> <column>
 *   node lsp.js references <file> <line> <column>
 *   node lsp.js symbols <file>
 *   node lsp.js diagnostics <file>
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TSServerClient {
  constructor() {
    this.seq = 0;
    this.pendingRequests = new Map();
    this.tsserver = null;
    this.responseBuffer = '';
  }

  async start() {
    return new Promise((resolve, reject) => {
      // tsserver 경로 찾기
      const tsserverPath = this.findTsserver();
      if (!tsserverPath) {
        reject(new Error('tsserver not found. Run: npm install typescript'));
        return;
      }

      this.tsserver = spawn('node', [tsserverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.tsserver.stdout.on('data', (data) => {
        this.handleResponse(data.toString());
      });

      this.tsserver.stderr.on('data', (data) => {
        // tsserver stderr는 보통 무시해도 됨 (로그용)
      });

      this.tsserver.on('error', reject);

      // tsserver 시작 대기
      setTimeout(resolve, 500);
    });
  }

  findTsserver() {
    // 1. 로컬 node_modules
    const localPath = path.join(process.cwd(), 'node_modules', 'typescript', 'lib', 'tsserver.js');
    if (fs.existsSync(localPath)) return localPath;

    // 2. 글로벌 typescript
    try {
      const tsPath = require.resolve('typescript');
      const globalPath = path.join(path.dirname(tsPath), 'tsserver.js');
      if (fs.existsSync(globalPath)) return globalPath;
    } catch (e) {}

    // 3. npx로 실행
    return null;
  }

  async sendRequest(command, args) {
    return new Promise((resolve, reject) => {
      const seq = ++this.seq;
      const request = {
        seq,
        type: 'request',
        command,
        arguments: args
      };

      this.pendingRequests.set(seq, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.tsserver.stdin.write(message);

      // 타임아웃 설정
      setTimeout(() => {
        if (this.pendingRequests.has(seq)) {
          this.pendingRequests.delete(seq);
          reject(new Error(`Request timeout: ${command}`));
        }
      }, 10000);
    });
  }

  handleResponse(data) {
    this.responseBuffer += data;

    // Content-Length 기반 파싱
    const lines = this.responseBuffer.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Content-Length 헤더 건너뛰기
      if (line.startsWith('Content-Length:')) continue;

      try {
        const json = JSON.parse(line);

        if (json.type === 'response' && json.request_seq) {
          const pending = this.pendingRequests.get(json.request_seq);
          if (pending) {
            this.pendingRequests.delete(json.request_seq);
            if (json.success) {
              pending.resolve(json.body);
            } else {
              pending.reject(new Error(json.message || 'Request failed'));
            }
          }
        }
        // event 타입은 무시 (configFileDiag 등)
      } catch (e) {
        // JSON 파싱 실패 - 불완전한 메시지, 다음 청크 대기
      }
    }

    // 처리된 부분 제거 (마지막 불완전한 라인 유지)
    const lastNewline = this.responseBuffer.lastIndexOf('\n');
    if (lastNewline !== -1) {
      this.responseBuffer = this.responseBuffer.substring(lastNewline + 1);
    }
  }

  async openFile(file) {
    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    await this.sendRequest('open', {
      file: absolutePath,
      fileContent: fs.readFileSync(absolutePath, 'utf-8')
    });
    return absolutePath;
  }

  // 파일 내에서 심볼 위치 찾기
  findSymbolPosition(fileContent, symbolName) {
    const lines = fileContent.split('\n');
    const results = [];

    // 심볼을 찾을 패턴들 (우선순위 순)
    const patterns = [
      // class/interface/type/enum 정의
      new RegExp(`^\\s*(?:export\\s+)?(?:abstract\\s+)?(?:class|interface|type|enum)\\s+(${symbolName})\\b`),
      // function 정의
      new RegExp(`^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+(${symbolName})\\s*[(<]`),
      // const/let/var 정의
      new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+(${symbolName})\\s*[=:]`),
      // 메서드 정의 (클래스 내)
      new RegExp(`^\\s*(?:private|protected|public|static|async|readonly|\\s)*\\s*(${symbolName})\\s*[(<]`),
      // property 정의
      new RegExp(`^\\s*(?:private|protected|public|static|readonly|\\s)*\\s*(${symbolName})\\s*[?:]`),
      // import에서 가져온 심볼
      new RegExp(`import\\s+.*\\b(${symbolName})\\b.*from`),
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          // 심볼의 시작 위치 찾기
          const symbolIndex = line.indexOf(symbolName, match.index);
          if (symbolIndex !== -1) {
            results.push({
              line: lineNum + 1,  // 1-based
              column: symbolIndex + 1,  // 1-based
              text: line.trim(),
              matchType: getMatchType(pattern.source)
            });
          }
        }
      }
    }

    return results;
  }

  async getDefinition(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('definition', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset)
    });
  }

  async getReferences(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('references', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset)
    });
  }

  async getQuickInfo(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('quickinfo', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset)
    });
  }

  async getCompletions(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('completionInfo', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset),
      includeExternalModuleExports: true,
      includeInsertTextCompletions: true
    });
  }

  async getNavTree(file) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('navtree', {
      file: absolutePath
    });
  }

  async getDiagnostics(file) {
    const absolutePath = await this.openFile(file);

    // semanticDiagnosticsSync 사용
    const semantic = await this.sendRequest('semanticDiagnosticsSync', {
      file: absolutePath,
      includeLinePosition: true
    });

    const syntactic = await this.sendRequest('syntacticDiagnosticsSync', {
      file: absolutePath,
      includeLinePosition: true
    });

    return {
      semantic: semantic || [],
      syntactic: syntactic || []
    };
  }

  async getTypeDefinition(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('typeDefinition', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset)
    });
  }

  async getImplementation(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('implementation', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset)
    });
  }

  async getRename(file, line, offset) {
    const absolutePath = await this.openFile(file);
    return await this.sendRequest('rename', {
      file: absolutePath,
      line: parseInt(line),
      offset: parseInt(offset),
      findInComments: false,
      findInStrings: false
    });
  }

  // navto - 프로젝트 전체에서 심볼 검색
  async findSymbolInProject(searchValue, maxResultCount = 20) {
    // tsserver는 최소 하나의 파일이 열려있어야 navto 동작함
    // tsconfig.json이나 package.json 기반으로 프로젝트 로드
    const projectFiles = [
      'tsconfig.json',
      'packages/sdk/tsconfig.json',
      'packages/cli/tsconfig.json'
    ];

    for (const pf of projectFiles) {
      const fullPath = path.join(process.cwd(), pf);
      if (fs.existsSync(fullPath)) {
        // 프로젝트의 아무 ts 파일이나 열어서 프로젝트 로드
        const tsFiles = this.findFirstTsFile(path.dirname(fullPath));
        if (tsFiles) {
          await this.openFile(tsFiles);
          break;
        }
      }
    }

    return await this.sendRequest('navto', {
      searchValue,
      maxResultCount
    });
  }

  // 디렉토리에서 첫 번째 ts 파일 찾기
  findFirstTsFile(dir, depth = 0) {
    if (depth > 3) return null;  // 너무 깊이 들어가지 않음

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // 먼저 현재 디렉토리의 ts 파일 찾기
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          return path.join(dir, entry.name);
        }
      }

      // src 폴더 우선 탐색
      for (const entry of entries) {
        if (entry.isDirectory() && (entry.name === 'src' || entry.name === 'lib')) {
          const found = this.findFirstTsFile(path.join(dir, entry.name), depth + 1);
          if (found) return found;
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  close() {
    if (this.tsserver) {
      this.sendRequest('exit', {}).catch(() => {});
      this.tsserver.kill();
    }
  }
}

// 매치 타입 식별
function getMatchType(patternSource) {
  if (patternSource.includes('class|interface|type|enum')) return 'declaration';
  if (patternSource.includes('function')) return 'function';
  if (patternSource.includes('const|let|var')) return 'variable';
  if (patternSource.includes('import')) return 'import';
  return 'member';
}

// 출력 포매터
function formatDefinition(result, context = {}) {
  if (!result || result.length === 0) {
    const hint = context.symbolName
      ? `Hint: Symbol '${context.symbolName}' not found at line ${context.line}, column ${context.column}. Try 'symbols' command to list available symbols.`
      : 'No definition found at this position.';
    return { found: false, message: 'Definition not found', hint };
  }

  return {
    found: true,
    definitions: result.map(def => ({
      file: def.file,
      line: def.start.line,
      column: def.start.offset,
      end: { line: def.end.line, column: def.end.offset },
      contextStart: def.contextStart,
      contextEnd: def.contextEnd
    }))
  };
}

function formatReferences(result, context = {}) {
  if (!result || !result.refs || result.refs.length === 0) {
    const hint = context.symbolName
      ? `Hint: No references found for position. Make sure you're on a valid symbol.`
      : 'No references found.';
    return { found: false, message: 'No references found', hint };
  }

  return {
    found: true,
    symbolName: result.symbolName,
    symbolDisplayString: result.symbolDisplayString,
    references: result.refs.map(ref => ({
      file: ref.file,
      line: ref.start.line,
      column: ref.start.offset,
      lineText: ref.lineText,
      isDefinition: ref.isDefinition,
      isWriteAccess: ref.isWriteAccess
    }))
  };
}

function formatQuickInfo(result, context = {}) {
  if (!result) {
    const hint = context.line && context.column
      ? `Hint: No symbol at line ${context.line}, column ${context.column}. Check if position is on a valid identifier.`
      : 'No info available.';
    return { found: false, message: 'No info available', hint };
  }

  return {
    found: true,
    kind: result.kind,
    kindModifiers: result.kindModifiers,
    displayString: result.displayString,
    documentation: result.documentation,
    tags: result.tags
  };
}

function formatCompletions(result) {
  if (!result || !result.entries || result.entries.length === 0) {
    return { found: false, message: 'No completions available' };
  }

  return {
    found: true,
    isGlobalCompletion: result.isGlobalCompletion,
    isMemberCompletion: result.isMemberCompletion,
    completions: result.entries.slice(0, 50).map(entry => ({
      name: entry.name,
      kind: entry.kind,
      sortText: entry.sortText,
      insertText: entry.insertText,
      source: entry.source
    }))
  };
}

function formatNavTree(result, indent = 0) {
  if (!result) return [];

  const symbols = [];

  if (result.text && result.kind !== 'script') {
    symbols.push({
      name: result.text,
      kind: result.kind,
      line: result.spans?.[0]?.start?.line,
      column: result.spans?.[0]?.start?.offset,
      indent
    });
  }

  if (result.childItems) {
    for (const child of result.childItems) {
      symbols.push(...formatNavTree(child, indent + 1));
    }
  }

  return symbols;
}

function formatDiagnostics(result) {
  const all = [...(result.semantic || []), ...(result.syntactic || [])];

  if (all.length === 0) {
    return { found: false, message: 'No diagnostics' };
  }

  return {
    found: true,
    count: all.length,
    diagnostics: all.map(d => ({
      message: d.text || d.message,
      code: d.code,
      category: d.category,
      line: d.startLocation?.line || d.start?.line,
      column: d.startLocation?.offset || d.start?.offset
    }))
  };
}

function formatNavToResult(result) {
  if (!result || result.length === 0) {
    return { found: false, message: 'No symbols found' };
  }

  return {
    found: true,
    count: result.length,
    symbols: result.map(item => ({
      name: item.name,
      kind: item.kind,
      file: item.file,
      line: item.start?.line,
      column: item.start?.offset,
      containerName: item.containerName,
      containerKind: item.containerKind
    }))
  };
}

// 파일에서 심볼 찾고 타입 정보 가져오기
async function findAndGetInfo(client, file, symbolName) {
  const absolutePath = await client.openFile(file);
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');

  // 파일 내에서 심볼 위치 찾기
  const positions = client.findSymbolPosition(fileContent, symbolName);

  if (positions.length === 0) {
    // navtree에서 찾기 시도
    const navTree = await client.getNavTree(file);
    const symbols = formatNavTree(navTree);
    const matchingSymbols = symbols.filter(s =>
      s.name === symbolName || s.name.includes(symbolName)
    );

    if (matchingSymbols.length > 0) {
      return {
        found: true,
        source: 'navtree',
        matches: matchingSymbols.map(s => ({
          name: s.name,
          kind: s.kind,
          line: s.line,
          column: s.column
        }))
      };
    }

    return {
      found: false,
      message: `Symbol '${symbolName}' not found in ${file}`,
      hint: 'Try: node lsp.js symbols <file> to see available symbols'
    };
  }

  // 첫 번째 매치에서 quickinfo 가져오기
  const firstMatch = positions[0];
  const quickInfo = await client.getQuickInfo(file, firstMatch.line, firstMatch.column);

  return {
    found: true,
    symbol: symbolName,
    location: {
      file: absolutePath,
      line: firstMatch.line,
      column: firstMatch.column
    },
    matchType: firstMatch.matchType,
    lineText: firstMatch.text,
    typeInfo: quickInfo ? {
      kind: quickInfo.kind,
      displayString: quickInfo.displayString,
      documentation: quickInfo.documentation
    } : null,
    otherMatches: positions.length > 1 ? positions.slice(1).map(p => ({
      line: p.line,
      column: p.column,
      matchType: p.matchType
    })) : []
  };
}

// 메인 실행
async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.log(`
CrewX LSP Skill - tsserver CLI Wrapper

Usage:
  node lsp.js <command> [arguments]

Commands (심볼 이름으로 검색 - 추천!):
  find          <symbol>              Search symbol across project
  info          <file> <symbol>       Get type info by symbol name

Commands (line/column 기반):
  definition    <file> <line> <col>   Go to definition
  references    <file> <line> <col>   Find all references
  quickinfo     <file> <line> <col>   Get type info (hover)
  typeDefinition <file> <line> <col>  Go to type definition
  implementation <file> <line> <col>  Go to implementation
  completions   <file> <line> <col>   Get completions at position
  rename        <file> <line> <col>   Get rename locations

Commands (파일 단위):
  symbols       <file>                List all symbols in file
  diagnostics   <file>                Get errors/warnings

Examples:
  # 심볼 이름으로 검색 (추천!)
  node lsp.js find BaseAIProvider
  node lsp.js info src/providers/claude.ts ClaudeProvider

  # line/column 기반
  node lsp.js definition src/app.ts 10 5
  node lsp.js symbols src/app.ts
`);
    process.exit(0);
  }

  const client = new TSServerClient();

  try {
    await client.start();

    let result;

    switch (command) {
      // 새로운 명령어: 심볼 이름으로 프로젝트 전체 검색
      case 'find':
      case 'search':
        if (args.length < 1) throw new Error('Usage: find <symbol>');
        result = formatNavToResult(await client.findSymbolInProject(args[0], 30));
        break;

      // 새로운 명령어: 파일 내 심볼 이름으로 타입 정보 조회
      case 'info':
        if (args.length < 2) throw new Error('Usage: info <file> <symbol>');
        result = await findAndGetInfo(client, args[0], args[1]);
        break;

      case 'definition':
      case 'def':
        if (args.length < 3) throw new Error('Usage: definition <file> <line> <column>');
        result = formatDefinition(
          await client.getDefinition(args[0], args[1], args[2]),
          { line: args[1], column: args[2] }
        );
        break;

      case 'references':
      case 'refs':
        if (args.length < 3) throw new Error('Usage: references <file> <line> <column>');
        result = formatReferences(
          await client.getReferences(args[0], args[1], args[2]),
          { line: args[1], column: args[2] }
        );
        break;

      case 'quickinfo':
      case 'hover':
        if (args.length < 3) throw new Error('Usage: quickinfo <file> <line> <column>');
        result = formatQuickInfo(
          await client.getQuickInfo(args[0], args[1], args[2]),
          { line: args[1], column: args[2] }
        );
        break;

      case 'typeDefinition':
      case 'typedef':
        if (args.length < 3) throw new Error('Usage: typeDefinition <file> <line> <column>');
        result = formatDefinition(
          await client.getTypeDefinition(args[0], args[1], args[2]),
          { line: args[1], column: args[2] }
        );
        break;

      case 'implementation':
      case 'impl':
        if (args.length < 3) throw new Error('Usage: implementation <file> <line> <column>');
        result = formatDefinition(
          await client.getImplementation(args[0], args[1], args[2]),
          { line: args[1], column: args[2] }
        );
        break;

      case 'completions':
      case 'complete':
        if (args.length < 3) throw new Error('Usage: completions <file> <line> <column>');
        result = formatCompletions(await client.getCompletions(args[0], args[1], args[2]));
        break;

      case 'symbols':
      case 'outline':
        if (args.length < 1) throw new Error('Usage: symbols <file>');
        const navTree = await client.getNavTree(args[0]);
        const symbols = formatNavTree(navTree);
        result = {
          found: true,
          count: symbols.length,
          symbols,
          hint: 'Use: node lsp.js info <file> <symbolName> for type details'
        };
        break;

      case 'diagnostics':
      case 'errors':
        if (args.length < 1) throw new Error('Usage: diagnostics <file>');
        result = formatDiagnostics(await client.getDiagnostics(args[0]));
        break;

      case 'rename':
        if (args.length < 3) throw new Error('Usage: rename <file> <line> <column>');
        result = await client.getRename(args[0], args[1], args[2]);
        break;

      default:
        throw new Error(`Unknown command: ${command}. Run without arguments to see help.`);
    }

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(JSON.stringify({
      error: error.message,
      hint: 'Run "node lsp.js" without arguments to see usage help'
    }, null, 2));
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
