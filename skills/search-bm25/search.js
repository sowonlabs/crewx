#!/usr/bin/env node

/*
 * Search Skill - BM25 기반 문서 검색
 *
 * grep보다 똑똑한 검색: 복합 키워드, 점수 정렬, 의미 기반
 *
 * Usage:
 *   node search.js "<query>" [path] [options]
 *   node search.js "API authentication" ./docs
 *   node search.js "런처 아키텍처" .
 *   node search.js "error handling" ./src --limit=10
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const bm25 = require('wink-bm25-text-search');
const nlp = require('wink-nlp-utils');
const matter = require('gray-matter');

// Configuration
const SKILL_DIR = __dirname;
const USAGE_LOG = path.join(SKILL_DIR, 'usage.log');

// Logging
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logLine = `${timestamp} | ${message}\n`;
  fs.appendFileSync(USAGE_LOG, logLine);
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  query: null,
  path: '.',
  glob: '**/*.md',
  limit: 20,
  json: false
};

// Parse args
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--glob=')) {
    options.glob = arg.split('=')[1];
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1]);
  } else if (arg === '--json') {
    options.json = true;
  } else if (!options.query) {
    options.query = arg;
  } else if (options.path === '.') {
    options.path = arg;
  }
}

if (!options.query) {
  console.log(`
📖 Search Skill - BM25 기반 문서 검색

Usage:
  node search.js "<query>" [path] [options]

Options:
  --glob=<pattern>   파일 패턴 (default: **/*.md)
  --limit=<n>        결과 개수 제한 (default: 20)
  --json             JSON 출력

Examples:
  node search.js "API authentication" ./docs
  node search.js "런처 아키텍처" . --glob="**/*.md"
  node search.js "error handling" ./src --glob="**/*.{js,ts}" --limit=10
  node search.js "database connection" . --json
`);
  process.exit(0);
}

async function search() {
  // Log search
  log(`search "${options.query}" path=${options.path} glob=${options.glob} limit=${options.limit}`);

  const searchPath = path.resolve(options.path);

  // Find files
  const pattern = path.join(searchPath, options.glob);
  const files = await glob(pattern, { nodir: true });

  if (files.length === 0) {
    console.log(`파일을 찾을 수 없습니다: ${pattern}`);
    process.exit(1);
  }

  // Load documents
  const docs = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(searchPath, file);

      // Try to parse frontmatter for markdown files
      let title = '';
      let body = content;

      if (file.endsWith('.md')) {
        try {
          const parsed = matter(content);
          title = parsed.data.title || parsed.data.summary || '';
          body = parsed.content;
        } catch (e) {
          // Not frontmatter, use first line as title
          const lines = content.split('\n');
          title = lines[0].replace(/^#\s*/, '').substring(0, 100);
        }
      } else {
        // For code files, use filename as title
        title = path.basename(file);
      }

      docs.push({
        file: relativePath,
        fullPath: file,
        title,
        body: body.substring(0, 2000) // Limit for performance
      });
    } catch (e) {
      // Skip unreadable files
    }
  }

  if (docs.length === 0) {
    console.log('읽을 수 있는 파일이 없습니다.');
    process.exit(1);
  }

  // Check if query contains Korean
  const hasKorean = /[가-힣]/.test(options.query);
  let results = [];

  if (hasKorean) {
    // Korean: OR search with scoring
    const words = options.query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    results = docs.map(doc => {
      const searchText = `${doc.title} ${doc.body}`.toLowerCase();
      const matchCount = words.filter(word => searchText.includes(word)).length;
      return { ...doc, score: matchCount };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  } else {
    // English: BM25 search
    const engine = bm25();
    engine.defineConfig({ fldWeights: { title: 3, body: 1 } });
    engine.definePrepTasks([
      nlp.string.lowerCase,
      nlp.string.tokenize0,
      nlp.tokens.removeWords,
      nlp.tokens.stem
    ]);

    docs.forEach((doc, idx) => {
      engine.addDoc({
        title: doc.title,
        body: doc.body
      }, idx);
    });

    engine.consolidate();
    const searchResults = engine.search(options.query);
    results = searchResults.map(([idx, score]) => ({
      ...docs[idx],
      score: Math.round(score * 100) / 100
    }));
  }

  // Limit results
  results = results.slice(0, options.limit);

  if (results.length === 0) {
    console.log(`'${options.query}' 관련 결과를 찾을 수 없습니다.`);
    process.exit(0);
  }

  // Output
  if (options.json) {
    console.log(JSON.stringify(results.map(r => ({
      file: r.file,
      score: r.score,
      title: r.title.substring(0, 100)
    })), null, 2));
  } else {
    console.log(`\n🔍 검색: "${options.query}" (${results.length}건, ${files.length}개 파일 중)\n`);
    for (const r of results) {
      const title = r.title.substring(0, 60).replace(/\n/g, ' ');
      console.log(`[${r.score}점] ${r.file}`);
      if (title) console.log(`       ${title}`);
    }
  }
}

search().catch(console.error);
