#!/usr/bin/env node
/**
 * CrewX LSP Skill - tsserver CLI Wrapper
 *
 * Communicates with tsserver via JSON protocol to provide LSP features from CLI.
 *
 * Usage:
 *   node lsp.js find <symbol>                     # Search by symbol name (NEW!)
 *   node lsp.js info <file> <symbol>              # Get symbol type info (NEW!)
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
      // Find tsserver path
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
        // tsserver stderr can usually be ignored (used for logging)
      });

      this.tsserver.on('error', reject);

      // Wait for tsserver to start
      setTimeout(resolve, 500);
    });
  }

  findTsserver() {
    // 1. Local node_modules
    const localPath = path.join(process.cwd(), 'node_modules', 'typescript', 'lib', 'tsserver.js');
    if (fs.existsSync(localPath)) return localPath;

    // 2. Global typescript
    try {
      const tsPath = require.resolve('typescript');
      const globalPath = path.join(path.dirname(tsPath), 'tsserver.js');
      if (fs.existsSync(globalPath)) return globalPath;
    } catch (e) {}

    // 3. Run via npx
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

      // Set timeout
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

    // Content-Length based parsing
    const lines = this.responseBuffer.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip Content-Length header
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
        // Ignore event types (configFileDiag, etc.)
      } catch (e) {
        // JSON parsing failed - incomplete message, wait for next chunk
      }
    }

    // Remove processed parts (keep last incomplete line)
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

    // Patterns to find symbol (in priority order)
    const patterns = [
      // class/interface/type/enum definition
      new RegExp(`^\\s*(?:export\\s+)?(?:abstract\\s+)?(?:class|interface|type|enum)\\s+(${symbolName})\\b`),
      // function definition
      new RegExp(`^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+(${symbolName})\\s*[(<]`),
      // const/let/var definition
      new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+(${symbolName})\\s*[=:]`),
      // method definition (inside class)
      new RegExp(`^\\s*(?:private|protected|public|static|async|readonly|\\s)*\\s*(${symbolName})\\s*[(<]`),
      // property definition
      new RegExp(`^\\s*(?:private|protected|public|static|readonly|\\s)*\\s*(${symbolName})\\s*[?:]`),
      // symbol imported from import statement
      new RegExp(`import\\s+.*\\b(${symbolName})\\b.*from`),
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          // Find the starting position of the symbol
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

  // navto - Search symbol across entire project
  async findSymbolInProject(searchValue, maxResultCount = 20) {
    // tsserver requires at least one file to be open for navto to work
    // Load project based on tsconfig.json or package.json
    const projectFiles = [
      'tsconfig.json',
      'packages/sdk/tsconfig.json',
      'packages/cli/tsconfig.json'
    ];

    for (const pf of projectFiles) {
      const fullPath = path.join(process.cwd(), pf);
      if (fs.existsSync(fullPath)) {
        // Open any ts file in the project to load the project
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

  // Find the first ts file in a directory
  findFirstTsFile(dir, depth = 0) {
    if (depth > 3) return null;  // Don't go too deep

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // First, find ts files in current directory
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          return path.join(dir, entry.name);
        }
      }

      // Prioritize searching src folder
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

// Identify match type
function getMatchType(patternSource) {
  if (patternSource.includes('class|interface|type|enum')) return 'declaration';
  if (patternSource.includes('function')) return 'function';
  if (patternSource.includes('const|let|var')) return 'variable';
  if (patternSource.includes('import')) return 'import';
  return 'member';
}

// Output formatters
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

// Find symbol in file and get type information
async function findAndGetInfo(client, file, symbolName) {
  const absolutePath = await client.openFile(file);
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');

  // Find symbol position within the file
  const positions = client.findSymbolPosition(fileContent, symbolName);

  if (positions.length === 0) {
    // Try finding in navtree
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

  // Get quickinfo from first match
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

// Main execution
async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.log(`
CrewX LSP Skill - tsserver CLI Wrapper

Usage:
  node lsp.js <command> [arguments]

Commands (search by symbol name - recommended!):
  find          <symbol>              Search symbol across project
  info          <file> <symbol>       Get type info by symbol name

Commands (line/column based):
  definition    <file> <line> <col>   Go to definition
  references    <file> <line> <col>   Find all references
  quickinfo     <file> <line> <col>   Get type info (hover)
  typeDefinition <file> <line> <col>  Go to type definition
  implementation <file> <line> <col>  Go to implementation
  completions   <file> <line> <col>   Get completions at position
  rename        <file> <line> <col>   Get rename locations

Commands (file-level):
  symbols       <file>                List all symbols in file
  diagnostics   <file>                Get errors/warnings

Examples:
  # Search by symbol name (recommended!)
  node lsp.js find BaseAIProvider
  node lsp.js info src/providers/claude.ts ClaudeProvider

  # line/column based
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
      // New command: search symbol across entire project by name
      case 'find':
      case 'search':
        if (args.length < 1) throw new Error('Usage: find <symbol>');
        result = formatNavToResult(await client.findSymbolInProject(args[0], 30));
        break;

      // New command: get type info by symbol name in file
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
