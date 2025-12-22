#!/usr/bin/env node
/**
 * Memory Skill - 외부 에이전트용 Facade
 * v0.4.0 - Simplified (AI handles category inference)
 *
 * Usage:
 *   node memory.js save <agent_id> "<content>" [category]  # 저장 (카테고리 생략시 general)
 *   node memory.js list <agent_id>                          # 전체 조회
 *   node memory.js find <agent_id> "<keyword>"              # 키워드 검색
 *   node memory.js recent <agent_id>                        # 최근 30일
 *   node memory.js ask <agent_id> "<자연어 질문>"           # 자연어 쿼리 (memory_agent 사용)
 *   node memory.js archive <agent_id> "<period>"            # 아카이브 조회
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SKILL_DIR = __dirname;
const SQL_JS = path.join(SKILL_DIR, 'sql.js');
const USAGE_LOG = path.join(SKILL_DIR, 'usage.log');

const args = process.argv.slice(2);
const cmd = args[0];
const agentId = args[1];
const content = args[2];
const extra = args[3]; // optional category or period

// Log facade calls
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
    const dataDir = path.dirname(USAGE_LOG);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const timestamp = getLocalTimestamp();
    const logLine = `${timestamp} | [memory.js] ${cmd} ${agentId || ''} ${extra || ''}\n`;
    fs.appendFileSync(USAGE_LOG, logLine);
  } catch (e) {
    // Silently fail
  }
}

// Log at start
if (cmd && cmd !== '--help') {
  logUsage(cmd, agentId, content || extra);
}

// 30일 전 날짜 계산 (1개월)
function getMonthAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// 내부 로직(sql.js) 실행
function runCommand(args) {
  try {
    const result = execSync(`node "${SQL_JS}" ${args}`, {
      encoding: 'utf-8',
      cwd: SKILL_DIR
    });
    console.log(result);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// crewx 명령 실행 (자연어 쿼리용)
function runCrewx(query) {
  try {
    const crewxYaml = path.join(SKILL_DIR, 'crewx.yaml');
    const result = execSync(`npx -y crewx q -c "${crewxYaml}" "@memory_agent ${query}"`, {
      encoding: 'utf-8',
      cwd: SKILL_DIR,
      timeout: 60000
    });
    console.log(result);
  } catch (error) {
    console.error('자연어 쿼리 실패:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`Memory Skill v0.4.0 - 외부 에이전트용 Facade

Usage:
  node memory.js save <agent_id> "<content>" [category]  # 저장 (카테고리 선택적)
  node memory.js list <agent_id>                          # 전체 조회
  node memory.js find <agent_id> "<keyword>"              # 키워드 검색
  node memory.js recent <agent_id>                        # 최근 30일
  node memory.js archive <agent_id> [period]              # 아카이브 조회
  node memory.js ask <agent_id> "<질문>"                  # 자연어 쿼리

Categories: preference, project, decision, task, schedule, context, general

Examples:
  node memory.js save jarvis "투자자 미팅 12월 15일 오후 3시" schedule
  node memory.js save cso "MVP 방향 확정" decision
  node memory.js list cto
  node memory.js find cso "전략"
  node memory.js recent jarvis
  node memory.js archive cso 2024-06
  node memory.js ask cso "지난달 결정사항 뭐야?"
`);
}

switch (cmd) {
  case 'save':
  case '저장':
    if (!agentId || !content) {
      console.error('Usage: node memory.js save <agent_id> "<content>" [category]');
      process.exit(1);
    }
    // category는 선택적, 기본값은 general (AI가 나중에 재분류 가능)
    const category = extra || 'general';
    runCommand(`remember "${agentId}" "${category}" "${content}"`);
    break;

  case 'list':
  case '목록':
  case '전체':
    if (!agentId) {
      console.error('Usage: node memory.js list <agent_id>');
      process.exit(1);
    }
    runCommand(`recall "${agentId}" all`);
    break;

  case 'find':
  case '검색':
  case '찾기':
    if (!agentId || !content) {
      console.error('Usage: node memory.js find <agent_id> "<keyword>"');
      process.exit(1);
    }
    runCommand(`query "${agentId}" "SELECT * FROM memories WHERE content LIKE '%${content}%'"`);
    break;

  case 'recent':
  case '최근':
    if (!agentId) {
      console.error('Usage: node memory.js recent <agent_id>');
      process.exit(1);
    }
    const monthAgo = getMonthAgo();
    runCommand(`query "${agentId}" "SELECT * FROM memories WHERE date >= '${monthAgo}'"`);
    break;

  case 'archive':
  case '아카이브':
    if (!agentId) {
      console.error('Usage: node memory.js archive <agent_id> [period]');
      process.exit(1);
    }
    const period = content || 'all';
    runCommand(`query-archive "${agentId}" "${period}"`);
    break;

  case 'ask':
  case '질문':
    if (!agentId || !content) {
      console.error('Usage: node memory.js ask <agent_id> "<자연어 질문>"');
      process.exit(1);
    }
    runCrewx(`${content} for ${agentId}`);
    break;

  default:
    showHelp();
    break;
}
