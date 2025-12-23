#!/usr/bin/env node

/**
 * Memory V2 - 마크다운 + 프론트매터 기반 장기 기억 스킬
 *
 * Usage:
 *   node memory-v2.js save <agent_id> "<summary>" [category] [--topic=xxx] [--tags=a,b,c] [--body="상세 내용"]
 *   node memory-v2.js index <agent_id>
 *   node memory-v2.js topic <agent_id> <topic_name>
 *   node memory-v2.js recent <agent_id> [days=30]
 *   node memory-v2.js find <agent_id> "<keyword>"
 *   node memory-v2.js get <agent_id> <memory_id>
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { nanoid } = require('nanoid');

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

function generateFilename(date, topic, summary) {
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
    md += `| 날짜 | 카테고리 | 요약 | 상세 |\n`;
    md += `|------|----------|------|------|\n`;
    for (const entry of recent.slice(0, 10)) {
      const detailIcon = entry.hasBody ? '📄' : '-';
      md += `| ${entry.date} | ${entry.category || '-'} | [${entry.summary}](entries/${entry.file}) | ${detailIcon} |\n`;
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
    console.log(`[${entry.id}] [${entry.date}] [${entry.category}] ${entry.summary}`);
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

// ============ Main ============

function main() {
  const args = process.argv.slice(2);
  const { positional, options } = parseArgs(args);
  const [command, agentId, ...rest] = positional;

  if (!command) {
    console.log('Usage: node memory-v2.js <command> <agent_id> [args]');
    console.log('Commands: save, index, topic, recent, find, get');
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

    default:
      console.log(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();
