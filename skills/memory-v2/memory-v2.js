#!/usr/bin/env node

/**
 * Memory V2 - 마크다운 + 프론트매터 기반 장기 기억 스킬
 *
 * Usage:
 *   node memory-v2.js save <agent_id> "<summary>" [category] [--topic=xxx] [--tags=a,b,c] [--body="상세 내용"]
 *   node memory-v2.js index <agent_id>
 *   node memory-v2.js topic <agent_id> <topic_name>
 *   node memory-v2.js recent <agent_id> [days=30]
 *   node memory-v2.js find <agent_id> "<keyword>"       # 키워드 검색 (grep, 빠름)
 *   node memory-v2.js search <agent_id> "<query>"       # 시맨틱 검색 (Gemini Flash)
 *   node memory-v2.js get <agent_id> <memory_id>
 *   node memory-v2.js update <agent_id> <memory_id> [--summary=xxx] [--body=xxx] [--topic=xxx] [--tags=xxx] [--category=xxx]
 *   node memory-v2.js delete <agent_id> <memory_id>
 *   node memory-v2.js merge <agent_id> <memory_id1> <memory_id2> [--summary="병합된 요약"]
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { nanoid } = require('nanoid');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, 'data');
const USAGE_LOG = path.join(__dirname, 'usage.log');
const CATEGORIES = ['decision', 'schedule', 'task', 'project', 'context', 'preference', 'general'];

// ============ Utilities ============

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getAgentDir(agentId) {
  return path.join(DATA_DIR, agentId);
}

function getEntriesDir(agentId) {
  return path.join(getAgentDir(agentId), 'entries');
}

function parseArgs(args) {
  const result = { positional: [], options: {} };
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result.options[key] = value || true;
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

function generateId() {
  return nanoid(6);
}

function generateFilename(date, _topic, summary) {
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
  return `${date}-${slug}.md`;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getLocalTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function logUsage(cmd, agentId, extra) {
  try {
    const timestamp = getLocalTimestamp();
    const logLine = `${timestamp} | [memory-v2] ${cmd} ${agentId || ''} ${extra || ''}\n`;
    fs.appendFileSync(USAGE_LOG, logLine);
  } catch (e) {
    // Silently fail
  }
}

// ============ Frontmatter Parsing (using gray-matter) ============

function parseFrontmatter(content) {
  const parsed = matter(content);
  return { data: parsed.data, content: parsed.content };
}

function stringifyFrontmatter(data) {
  return matter.stringify('', data).trim();
}

// ============ Index Management ============

function loadAllEntries(agentId) {
  const entriesDir = getEntriesDir(agentId);
  if (!fs.existsSync(entriesDir)) return [];

  const files = fs.readdirSync(entriesDir).filter(f => f.endsWith('.md'));
  const entries = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(entriesDir, file), 'utf-8');
    const { data, content } = parseFrontmatter(raw);

    // Check if body has real content (not just placeholder or title)
    const bodyText = content.replace(/^#[^\n]*\n*/m, '').trim();
    const hasBody = bodyText && bodyText !== '(상세 내용을 여기에 추가)';

    entries.push({ file, hasBody, ...data });
  }

  // Sort by date descending
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return entries;
}

function generateIndex(agentId) {
  const entries = loadAllEntries(agentId);
  const today = getToday();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Group by topic
  const byTopic = {};
  const byCategory = {};
  const recent = [];

  for (const entry of entries) {
    // Recent
    if (entry.date >= thirtyDaysAgo) {
      recent.push(entry);
    }

    // By topic
    const topic = entry.topic || 'general';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(entry);

    // By category
    const category = entry.category || 'general';
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(entry);
  }

  // Generate markdown
  let md = `# ${agentId} 메모리\n\n`;
  md += `> Last Updated: ${today}\n`;
  md += `> Total: ${entries.length} memories\n\n`;

  // Recent section
  md += `## 🔥 최근 30일\n\n`;
  if (recent.length === 0) {
    md += `(없음)\n\n`;
  } else {
    md += `| ID | 날짜 | 카테고리 | 요약 | 상세 |\n`;
    md += `|----|------|----------|------|------|\n`;
    for (const entry of recent.slice(0, 10)) {
      const detailIcon = entry.hasBody ? '📄' : '-';
      md += `| ${entry.id} | ${entry.date} | ${entry.category || '-'} | [${entry.summary}](entries/${entry.file}) | ${detailIcon} |\n`;
    }
    md += `\n`;
  }

  // Topics section
  md += `## 📂 토픽별\n\n`;
  for (const [topic, items] of Object.entries(byTopic).sort()) {
    md += `### ${topic} (${items.length}건)\n`;
    for (const entry of items.slice(0, 5)) {
      md += `- [${entry.summary}](entries/${entry.file})\n`;
    }
    if (items.length > 5) {
      md += `- ... 외 ${items.length - 5}건\n`;
    }
    md += `\n`;
  }

  // Categories section
  md += `## 🏷️ 카테고리별\n\n`;
  for (const [category, items] of Object.entries(byCategory).sort()) {
    md += `- **${category}**: ${items.length}건\n`;
  }

  // Statistics section
  const olderCount = entries.length - recent.length;
  const oldestDate = entries[entries.length - 1]?.date || '-';
  const newestDate = entries[0]?.date || '-';
  md += `\n## 📊 통계\n\n`;
  md += `- 전체: ${entries.length}건 (${oldestDate} ~ ${newestDate})\n`;
  md += `- 최근 30일: ${recent.length}건\n`;
  if (olderCount > 0) {
    md += `- 30일 이전: ${olderCount}건\n`;
  }

  return md;
}

// ============ Helper: Find entry by ID ============

function findEntryById(agentId, memoryId) {
  const entriesDir = getEntriesDir(agentId);
  if (!fs.existsSync(entriesDir)) return null;

  const files = fs.readdirSync(entriesDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(entriesDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = parseFrontmatter(raw);

    if (data.id === memoryId) {
      return { file, filePath, data, content };
    }
  }
  return null;
}

// ============ Commands ============

function cmdSave(agentId, summary, category = 'general', options = {}) {
  ensureDir(getEntriesDir(agentId));

  const id = generateId();
  const date = getToday();
  const topic = options.topic || 'general';
  const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

  const frontmatter = stringifyFrontmatter({
    id,
    date,
    category,
    tags,
    topic,
    summary
  });

  const filename = generateFilename(date, topic, summary);
  const filepath = path.join(getEntriesDir(agentId), filename);

  // Use body if provided, otherwise placeholder
  const body = options.body || '(상세 내용을 여기에 추가)';
  const content = `${frontmatter}\n\n# ${summary}\n\n${body}\n`;

  fs.writeFileSync(filepath, content, 'utf-8');

  console.log(`✅ 저장 완료: data/${agentId}/entries/${filename}`);
  console.log(`   ID: ${id}`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Category: ${category}`);
}

function cmdIndex(agentId) {
  const content = generateIndex(agentId);
  console.log(content);
}

function cmdTopic(agentId, topicName) {
  const entries = loadAllEntries(agentId);
  const filtered = entries.filter(e => e.topic === topicName);

  if (filtered.length === 0) {
    console.log(`토픽 '${topicName}'에 해당하는 기억이 없습니다.`);
    return;
  }

  console.log(`## 📂 토픽: ${topicName} (${filtered.length}건)\n`);
  for (const entry of filtered) {
    console.log(`### [${entry.date}] ${entry.summary}`);
    console.log(`- 파일: data/${agentId}/entries/${entry.file}`);
    console.log(`- 카테고리: ${entry.category}`);
    console.log(`- 태그: ${(entry.tags || []).join(', ') || '-'}`);
    console.log('');
  }
}

function cmdRecent(agentId, days = 30) {
  const entries = loadAllEntries(agentId);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const filtered = entries.filter(e => e.date >= cutoff);

  if (filtered.length === 0) {
    console.log(`최근 ${days}일 내 기억이 없습니다.`);
    return;
  }

  console.log(`## 🔥 최근 ${days}일 (${filtered.length}건)\n`);
  for (const entry of filtered) {
    const detailIcon = entry.hasBody ? ' 📄' : '';
    console.log(`[${entry.id}] [${entry.date}] [${entry.category}] ${entry.summary}${detailIcon}`);
  }
}

function cmdFind(agentId, keyword) {
  const entriesDir = getEntriesDir(agentId);
  if (!fs.existsSync(entriesDir)) {
    console.log('기억이 없습니다.');
    return;
  }

  const files = fs.readdirSync(entriesDir).filter(f => f.endsWith('.md'));
  const results = [];
  const keywordLower = keyword.toLowerCase();

  for (const file of files) {
    const content = fs.readFileSync(path.join(entriesDir, file), 'utf-8');
    const { data } = parseFrontmatter(content);

    // Search in summary, tags, content
    const searchText = `${data.summary || ''} ${(data.tags || []).join(' ')} ${content}`.toLowerCase();
    if (searchText.includes(keywordLower)) {
      results.push({ file, ...data });
    }
  }

  if (results.length === 0) {
    console.log(`'${keyword}' 관련 기억을 찾을 수 없습니다.`);
    return;
  }

  console.log(`## 🔍 검색 결과: "${keyword}" (${results.length}건)\n`);
  for (const entry of results) {
    console.log(`[${entry.id}] [${entry.date}] [${entry.topic}] ${entry.summary}`);
  }
}

function cmdGet(agentId, memoryId) {
  const entriesDir = getEntriesDir(agentId);
  if (!fs.existsSync(entriesDir)) {
    console.log('기억이 없습니다.');
    return;
  }

  const files = fs.readdirSync(entriesDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(entriesDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = parseFrontmatter(raw);

    if (data.id === memoryId) {
      console.log(`## 📄 ${data.summary}\n`);
      console.log(`- ID: ${data.id}`);
      console.log(`- 날짜: ${data.date}`);
      console.log(`- 카테고리: ${data.category}`);
      console.log(`- 토픽: ${data.topic}`);
      console.log(`- 파일: data/${agentId}/entries/${file}`);
      console.log(`\n---\n`);
      console.log(content.trim());
      return;
    }
  }

  console.log(`ID '${memoryId}'를 찾을 수 없습니다.`);
}

function cmdUpdate(agentId, memoryId, options = {}) {
  const entry = findEntryById(agentId, memoryId);

  if (!entry) {
    console.log(`❌ ID '${memoryId}'를 찾을 수 없습니다.`);
    process.exit(1);
  }

  const { filePath, data, content } = entry;

  // 기존 body 추출 (# 제목 이후의 내용)
  const existingBody = content.replace(/^#[^\n]*\n*/m, '').trim();

  // 업데이트할 필드들
  const newData = {
    ...data,
    summary: options.summary || data.summary,
    topic: options.topic || data.topic,
    category: options.category || data.category,
    tags: options.tags ? options.tags.split(',').map(t => t.trim()) : data.tags,
    updated: getToday()  // 수정일 추가
  };

  const newBody = options.body || existingBody || '(상세 내용을 여기에 추가)';
  const newFrontmatter = stringifyFrontmatter(newData);
  const newContent = `${newFrontmatter}\n\n# ${newData.summary}\n\n${newBody}\n`;

  fs.writeFileSync(filePath, newContent, 'utf-8');

  console.log(`✅ 수정 완료: ${entry.file}`);
  console.log(`   ID: ${memoryId}`);
  if (options.summary) console.log(`   Summary: ${newData.summary}`);
  if (options.topic) console.log(`   Topic: ${newData.topic}`);
  if (options.category) console.log(`   Category: ${newData.category}`);
  if (options.tags) console.log(`   Tags: ${newData.tags.join(', ')}`);
  if (options.body) console.log(`   Body: (업데이트됨)`);
}

function cmdDelete(agentId, memoryId, options = {}) {
  const entry = findEntryById(agentId, memoryId);

  if (!entry) {
    console.log(`❌ ID '${memoryId}'를 찾을 수 없습니다.`);
    process.exit(1);
  }

  // --force 없으면 확인 메시지
  if (!options.force) {
    console.log(`⚠️  삭제 대상: [${entry.data.id}] ${entry.data.summary}`);
    console.log(`   파일: ${entry.file}`);
    console.log(`\n--force 옵션을 추가하면 삭제됩니다.`);
    console.log(`예: node memory-v2.js delete ${agentId} ${memoryId} --force`);
    return;
  }

  fs.unlinkSync(entry.filePath);
  console.log(`🗑️  삭제 완료: ${entry.file}`);
  console.log(`   ID: ${memoryId}`);
  console.log(`   Summary: ${entry.data.summary}`);
}

function cmdMerge(agentId, memoryId1, memoryId2, options = {}) {
  const entry1 = findEntryById(agentId, memoryId1);
  const entry2 = findEntryById(agentId, memoryId2);

  if (!entry1) {
    console.log(`❌ ID '${memoryId1}'를 찾을 수 없습니다.`);
    process.exit(1);
  }
  if (!entry2) {
    console.log(`❌ ID '${memoryId2}'를 찾을 수 없습니다.`);
    process.exit(1);
  }

  // 두 기억의 body 추출
  const body1 = entry1.content.replace(/^#[^\n]*\n*/m, '').trim();
  const body2 = entry2.content.replace(/^#[^\n]*\n*/m, '').trim();

  // 병합된 내용 생성
  const mergedSummary = options.summary || `${entry1.data.summary} + ${entry2.data.summary}`;
  const mergedBody = `## 병합된 기억 1 (${entry1.data.id}, ${entry1.data.date})
${entry1.data.summary}

${body1 !== '(상세 내용을 여기에 추가)' ? body1 : '(상세 없음)'}

---

## 병합된 기억 2 (${entry2.data.id}, ${entry2.data.date})
${entry2.data.summary}

${body2 !== '(상세 내용을 여기에 추가)' ? body2 : '(상세 없음)'}`;

  // 태그 병합 (중복 제거)
  const mergedTags = [...new Set([...(entry1.data.tags || []), ...(entry2.data.tags || [])])];

  // 더 최신 날짜 사용, 토픽은 첫 번째 것 사용
  const newerDate = entry1.data.date > entry2.data.date ? entry1.data.date : entry2.data.date;

  // 새 기억 생성
  const newId = generateId();
  const newData = {
    id: newId,
    date: newerDate,
    category: entry1.data.category,
    tags: mergedTags,
    topic: entry1.data.topic,
    summary: mergedSummary,
    merged_from: [memoryId1, memoryId2]
  };

  const filename = generateFilename(newerDate, newData.topic, mergedSummary);
  const filepath = path.join(getEntriesDir(agentId), filename);
  const newFrontmatter = stringifyFrontmatter(newData);
  const newContent = `${newFrontmatter}\n\n# ${mergedSummary}\n\n${mergedBody}\n`;

  fs.writeFileSync(filepath, newContent, 'utf-8');

  // 원본 삭제
  fs.unlinkSync(entry1.filePath);
  fs.unlinkSync(entry2.filePath);

  console.log(`🔀 병합 완료!`);
  console.log(`   새 ID: ${newId}`);
  console.log(`   새 파일: ${filename}`);
  console.log(`   병합된 기억: [${memoryId1}] + [${memoryId2}]`);
  console.log(`   Summary: ${mergedSummary}`);
}

function cmdSearch(agentId, query) {
  const entries = loadAllEntries(agentId);

  if (entries.length === 0) {
    console.log('기억이 없습니다.');
    return;
  }

  // 기억 목록을 프롬프트용 텍스트로 변환
  const memoryList = entries.map(e =>
    `[${e.id}] [${e.date}] [${e.topic}] ${e.summary}`
  ).join('\n');

  const task = `기억 목록:
${memoryList}

질문: "${query}"`;

  try {
    console.log(`🔍 "${query}" 검색 중... (@memory_searcher)\n`);

    // @memory_searcher 에이전트 호출 (skills/memory-v2/crewx.yaml에 정의)
    const result = execSync(
      `crewx q "@memory_searcher ${task.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { encoding: 'utf-8', timeout: 30000, cwd: __dirname }
    );

    // crewx 출력에서 Response 부분만 추출
    const responseMatch = result.match(/📄 Response:\s*─+\s*([\s\S]*?)(?=📁 Working Directory|$)/);
    if (responseMatch) {
      console.log(`## 🧠 시맨틱 검색 결과\n`);
      console.log(responseMatch[1].trim());
    } else {
      console.log(result.trim());
    }
  } catch (error) {
    console.log('검색 실패:', error.message);
    console.log('\n💡 Tip: find 명령으로 키워드 검색을 시도해보세요.');
  }
}

// ============ Main ============

function main() {
  const args = process.argv.slice(2);
  const { positional, options } = parseArgs(args);
  const [command, agentId, ...rest] = positional;

  if (!command) {
    console.log('Usage: node memory-v2.js <command> <agent_id> [args]');
    console.log('Commands: save, index, topic, recent, find, search, get, update, delete, merge');
    console.log('');
    console.log('  save <summary> [category]  - 새 기억 저장');
    console.log('  index                      - 전체 인덱스 보기');
    console.log('  recent [days]              - 최근 N일 기억');
    console.log('  find <keyword>             - 키워드 검색 (빠름)');
    console.log('  search <query>             - 시맨틱 검색 (AI)');
    console.log('  get <id>                   - 기억 상세 조회');
    console.log('  update <id> [--summary=...] [--body=...] - 기억 수정');
    console.log('  delete <id> [--force]      - 기억 삭제');
    console.log('  merge <id1> <id2>          - 두 기억 병합');
    process.exit(1);
  }

  if (!agentId) {
    console.log('Error: agent_id is required');
    process.exit(1);
  }

  // Log usage
  logUsage(command, agentId, rest.join(' '));

  switch (command) {
    case 'save':
      const summary = rest[0];
      const category = CATEGORIES.includes(rest[1]) ? rest[1] : 'general';
      if (!summary) {
        console.log('Error: summary is required');
        process.exit(1);
      }
      cmdSave(agentId, summary, category, options);
      break;

    case 'index':
      cmdIndex(agentId);
      break;

    case 'topic':
      if (!rest[0]) {
        console.log('Error: topic_name is required');
        process.exit(1);
      }
      cmdTopic(agentId, rest[0]);
      break;

    case 'recent':
      cmdRecent(agentId, parseInt(rest[0]) || 30);
      break;

    case 'find':
      if (!rest[0]) {
        console.log('Error: keyword is required');
        process.exit(1);
      }
      cmdFind(agentId, rest[0]);
      break;

    case 'get':
      if (!rest[0]) {
        console.log('Error: memory_id is required');
        process.exit(1);
      }
      cmdGet(agentId, rest[0]);
      break;

    case 'search':
      if (!rest[0]) {
        console.log('Error: query is required');
        process.exit(1);
      }
      cmdSearch(agentId, rest.join(' '));
      break;

    case 'update':
      if (!rest[0]) {
        console.log('Error: memory_id is required');
        process.exit(1);
      }
      cmdUpdate(agentId, rest[0], options);
      break;

    case 'delete':
      if (!rest[0]) {
        console.log('Error: memory_id is required');
        process.exit(1);
      }
      cmdDelete(agentId, rest[0], options);
      break;

    case 'merge':
      if (!rest[0] || !rest[1]) {
        console.log('Error: two memory_ids are required');
        console.log('Usage: node memory-v2.js merge <agent_id> <id1> <id2> [--summary="병합 요약"]');
        process.exit(1);
      }
      cmdMerge(agentId, rest[0], rest[1], options);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();
