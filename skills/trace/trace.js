#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================

const USAGE_LOG = path.join(__dirname, 'usage.log');

// Find traces.db - check multiple locations
function findTracesDb() {
  const locations = [
    path.join(process.cwd(), '.crewx', 'traces.db'),
    path.join(__dirname, '..', '..', '.crewx', 'traces.db'),
    path.join(process.env.HOME, '.crewx', 'traces.db'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }
  return null;
}

const TRACES_DB = findTracesDb();

// ============================================================
// Utility Functions
// ============================================================

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

function logUsage(cmd, extra) {
  try {
    const timestamp = getLocalTimestamp();
    const logLine = `${timestamp} | [trace] ${cmd} ${extra || ''}\n`;
    fs.appendFileSync(USAGE_LOG, logLine);
  } catch (e) {
    // Ignore logging errors
  }
}

function sqliteQuery(query) {
  if (!TRACES_DB) {
    console.error('traces.db not found');
    process.exit(1);
  }

  try {
    const result = execSync(`sqlite3 -json "${TRACES_DB}" "${query.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    if (!result) return [];
    return JSON.parse(result);
  } catch (e) {
    // Try without -json for older sqlite3
    try {
      const result = execSync(`sqlite3 "${TRACES_DB}" "${query.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return result;
    } catch (e2) {
      return null;
    }
  }
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function truncate(str, maxLen = 60) {
  if (!str) return '-';
  const cleaned = str.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen - 3) + '...';
}

function formatCost(cost) {
  if (!cost || cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens) {
  if (!tokens || tokens === 0) return '0';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function getStatusEmoji(status) {
  switch (status) {
    case 'success': return '✅';
    case 'failed': return '❌';
    case 'running': return '🔄';
    case 'pending': return '⏳';
    default: return '❓';
  }
}

// ============================================================
// Query Functions
// ============================================================

function getRecentTasks(limit = 10) {
  const query = `
    SELECT id, agent_id, mode, status, started_at,
           substr(prompt, 1, 200) as prompt_preview,
           input_tokens, output_tokens, cost_usd, duration_ms
    FROM tasks
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return sqliteQuery(query);
}

function getAgentTasks(agentId, limit = 10) {
  const query = `
    SELECT id, agent_id, mode, status, started_at,
           substr(prompt, 1, 200) as prompt_preview,
           input_tokens, output_tokens, cost_usd, duration_ms
    FROM tasks
    WHERE agent_id = '${agentId}'
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return sqliteQuery(query);
}

function searchTasks(keyword, limit = 20) {
  const query = `
    SELECT id, agent_id, mode, status, started_at,
           substr(prompt, 1, 200) as prompt_preview,
           input_tokens, output_tokens, cost_usd
    FROM tasks
    WHERE prompt LIKE '%${keyword}%'
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return sqliteQuery(query);
}

function getIssueTasks(issueNumber) {
  const query = `
    SELECT id, agent_id, mode, status, started_at,
           substr(prompt, 1, 200) as prompt_preview,
           input_tokens, output_tokens, cost_usd, duration_ms
    FROM tasks
    WHERE prompt LIKE '%#${issueNumber}%'
       OR prompt LIKE '%issue ${issueNumber}%'
       OR prompt LIKE '%Issue ${issueNumber}%'
       OR prompt LIKE '%이슈 #${issueNumber}%'
    ORDER BY started_at DESC
  `;
  return sqliteQuery(query);
}

function getTodayTasks() {
  const today = new Date().toISOString().split('T')[0];
  const query = `
    SELECT id, agent_id, mode, status, started_at,
           substr(prompt, 1, 200) as prompt_preview,
           input_tokens, output_tokens, cost_usd, duration_ms
    FROM tasks
    WHERE date(started_at) = '${today}'
    ORDER BY started_at DESC
  `;
  return sqliteQuery(query);
}

function getTaskDetail(taskId) {
  const query = `
    SELECT * FROM tasks WHERE id = '${taskId}'
  `;
  const results = sqliteQuery(query);
  return results && results.length > 0 ? results[0] : null;
}

function getCostStats(period = 'all') {
  let dateFilter = '';
  if (period === 'today') {
    const today = new Date().toISOString().split('T')[0];
    dateFilter = `WHERE date(started_at) = '${today}'`;
  } else if (period === '7d') {
    dateFilter = `WHERE started_at >= datetime('now', '-7 days')`;
  } else if (period === '30d') {
    dateFilter = `WHERE started_at >= datetime('now', '-30 days')`;
  }

  const query = `
    SELECT
      COUNT(*) as total_tasks,
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(cost_usd) as total_cost,
      AVG(cost_usd) as avg_cost,
      MAX(cost_usd) as max_cost
    FROM tasks ${dateFilter}
  `;
  const results = sqliteQuery(query);
  return results && results.length > 0 ? results[0] : null;
}

function getCostByAgent(period = 'all') {
  let dateFilter = '';
  if (period === 'today') {
    const today = new Date().toISOString().split('T')[0];
    dateFilter = `WHERE date(started_at) = '${today}'`;
  } else if (period === '7d') {
    dateFilter = `WHERE started_at >= datetime('now', '-7 days')`;
  }

  const query = `
    SELECT
      agent_id,
      COUNT(*) as task_count,
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(cost_usd) as total_cost
    FROM tasks ${dateFilter}
    GROUP BY agent_id
    ORDER BY total_cost DESC
  `;
  return sqliteQuery(query);
}

function getAgentList() {
  const query = `
    SELECT DISTINCT agent_id, COUNT(*) as task_count
    FROM tasks
    GROUP BY agent_id
    ORDER BY task_count DESC
  `;
  return sqliteQuery(query);
}

// ============================================================
// Display Functions
// ============================================================

function displayTasks(tasks, title = '작업 이력') {
  if (!tasks || tasks.length === 0) {
    console.log(`\n## ${title}\n(없음)`);
    return;
  }

  console.log(`\n## ${title} (${tasks.length}건)\n`);
  console.log('| 시간 | 에이전트 | 모드 | 상태 | 프롬프트 |');
  console.log('|------|---------|------|------|----------|');

  for (const task of tasks) {
    const time = formatTime(task.started_at);
    const agent = task.agent_id || '-';
    const mode = task.mode || '-';
    const status = getStatusEmoji(task.status);
    const prompt = truncate(task.prompt_preview, 50);

    console.log(`| ${time} | ${agent} | ${mode} | ${status} | ${prompt} |`);
  }
}

function displayTasksWithCost(tasks, title = '작업 이력') {
  if (!tasks || tasks.length === 0) {
    console.log(`\n## ${title}\n(없음)`);
    return;
  }

  console.log(`\n## ${title} (${tasks.length}건)\n`);
  console.log('| 시간 | 에이전트 | 상태 | 토큰 | 비용 | 프롬프트 |');
  console.log('|------|---------|------|------|------|----------|');

  for (const task of tasks) {
    const time = formatTime(task.started_at);
    const agent = task.agent_id || '-';
    const status = getStatusEmoji(task.status);
    const tokens = `${formatTokens(task.input_tokens)}/${formatTokens(task.output_tokens)}`;
    const cost = formatCost(task.cost_usd);
    const prompt = truncate(task.prompt_preview, 40);

    console.log(`| ${time} | ${agent} | ${status} | ${tokens} | ${cost} | ${prompt} |`);
  }
}

function displayCostStats(stats, title = '비용 통계') {
  if (!stats) {
    console.log(`\n## ${title}\n(데이터 없음)`);
    return;
  }

  console.log(`\n## ${title}\n`);
  console.log(`- 총 작업 수: ${stats.total_tasks || 0}건`);
  console.log(`- 입력 토큰: ${formatTokens(stats.total_input)}`);
  console.log(`- 출력 토큰: ${formatTokens(stats.total_output)}`);
  console.log(`- 총 비용: ${formatCost(stats.total_cost)}`);
  console.log(`- 평균 비용: ${formatCost(stats.avg_cost)}`);
  console.log(`- 최대 비용: ${formatCost(stats.max_cost)}`);
}

function displayCostByAgent(data, title = '에이전트별 비용') {
  if (!data || data.length === 0) {
    console.log(`\n## ${title}\n(데이터 없음)`);
    return;
  }

  console.log(`\n## ${title}\n`);
  console.log('| 에이전트 | 작업 수 | 입력 | 출력 | 비용 |');
  console.log('|---------|--------|------|------|------|');

  for (const row of data) {
    console.log(`| ${row.agent_id} | ${row.task_count} | ${formatTokens(row.total_input)} | ${formatTokens(row.total_output)} | ${formatCost(row.total_cost)} |`);
  }
}

function displayTaskDetail(task) {
  if (!task) {
    console.log('\n작업을 찾을 수 없습니다.');
    return;
  }

  console.log('\n## 작업 상세\n');
  console.log(`- **ID**: ${task.id}`);
  console.log(`- **에이전트**: ${task.agent_id}`);
  console.log(`- **모드**: ${task.mode}`);
  console.log(`- **상태**: ${task.status} ${getStatusEmoji(task.status)}`);
  console.log(`- **시작**: ${task.started_at}`);
  console.log(`- **완료**: ${task.completed_at || '-'}`);
  console.log(`- **소요시간**: ${task.duration_ms ? `${(task.duration_ms / 1000).toFixed(1)}초` : '-'}`);
  console.log(`- **모델**: ${task.model || '-'}`);
  console.log(`- **토큰**: 입력 ${formatTokens(task.input_tokens)} / 출력 ${formatTokens(task.output_tokens)}`);
  console.log(`- **비용**: ${formatCost(task.cost_usd)}`);
  console.log(`- **Exit Code**: ${task.exit_code ?? '-'}`);

  if (task.trace_id) {
    console.log(`- **Trace ID**: ${task.trace_id}`);
  }
  if (task.parent_task_id) {
    console.log(`- **Parent Task**: ${task.parent_task_id}`);
  }

  console.log('\n### 프롬프트\n');
  console.log('```');
  console.log(task.prompt ? task.prompt.substring(0, 1000) : '(없음)');
  if (task.prompt && task.prompt.length > 1000) {
    console.log(`\n... (${task.prompt.length - 1000} chars truncated)`);
  }
  console.log('```');

  if (task.result) {
    console.log('\n### 결과\n');
    console.log('```');
    console.log(task.result.substring(0, 500));
    if (task.result.length > 500) {
      console.log(`\n... (${task.result.length - 500} chars truncated)`);
    }
    console.log('```');
  }

  if (task.error) {
    console.log('\n### 에러\n');
    console.log('```');
    console.log(task.error);
    console.log('```');
  }
}

function displayAgentList(agents) {
  if (!agents || agents.length === 0) {
    console.log('\n## 등록된 에이전트\n(없음)');
    return;
  }

  console.log('\n## 등록된 에이전트\n');
  for (const agent of agents) {
    console.log(`- ${agent.agent_id} (${agent.task_count}건)`);
  }
}

function showHelp() {
  console.log(`
# Trace Skill - traces.db 분석

Usage: node trace.js [command] [args] [options]

## Commands

  (none), recent [N]     최근 작업 이력 (기본 10개)
  today                  오늘 작업 이력
  agent <id> [--limit N] 특정 에이전트 작업
  issue <number>         특정 이슈 관련 작업
  search <keyword>       키워드 검색
  detail <task_id>       작업 상세 정보
  cost [period]          비용 통계 (all/today/7d/30d)
  cost agent             에이전트별 비용
  agents                 에이전트 목록

## Examples

  node trace.js                       # 최근 10개 작업
  node trace.js recent 20             # 최근 20개 작업
  node trace.js today                 # 오늘 작업
  node trace.js agent crewx_claude_dev
  node trace.js issue 89              # #89 관련 작업
  node trace.js search "PR #90"       # 키워드 검색
  node trace.js cost today            # 오늘 비용 통계
  node trace.js cost agent            # 에이전트별 비용
  node trace.js detail task_xxx       # 상세 정보

## DB Location

  ${TRACES_DB || '(not found)'}
`);
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

// Log usage
logUsage(command || 'recent', args.slice(1).join(' '));

// Check DB exists
if (!TRACES_DB && command !== 'help' && command !== '--help') {
  console.error('traces.db not found. Checked locations:');
  console.error('  - .crewx/traces.db (current directory)');
  console.error('  - skills/../.crewx/traces.db');
  console.error('  - ~/.crewx/traces.db');
  process.exit(1);
}

switch (command) {
  case undefined:
  case 'recent': {
    const limit = parseInt(args[1]) || 10;
    const tasks = getRecentTasks(limit);
    displayTasks(tasks, '최근 작업 이력');
    break;
  }

  case 'today': {
    const tasks = getTodayTasks();
    displayTasksWithCost(tasks, '오늘 작업 이력');

    // Show today's cost summary
    const stats = getCostStats('today');
    if (stats && stats.total_tasks > 0) {
      console.log(`\n---\n오늘 총 ${stats.total_tasks}건, ${formatCost(stats.total_cost)}`);
    }
    break;
  }

  case 'agent': {
    const agentId = args[1];
    if (!agentId) {
      console.error('Error: agent ID required. Example: node trace.js agent crewx_claude_dev');
      displayAgentList(getAgentList());
      process.exit(1);
    }
    const limitArg = args.indexOf('--limit');
    const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) || 10 : 10;
    const tasks = getAgentTasks(agentId, limit);
    displayTasksWithCost(tasks, `${agentId} 작업 이력`);
    break;
  }

  case 'issue': {
    const issueNumber = args[1];
    if (!issueNumber) {
      console.error('Error: issue number required. Example: node trace.js issue 89');
      process.exit(1);
    }
    const tasks = getIssueTasks(issueNumber);
    displayTasksWithCost(tasks, `#${issueNumber} 관련 작업`);
    break;
  }

  case 'search': {
    const keyword = args[1];
    if (!keyword) {
      console.error('Error: keyword required. Example: node trace.js search "PR #90"');
      process.exit(1);
    }
    const tasks = searchTasks(keyword);
    displayTasks(tasks, `"${keyword}" 검색 결과`);
    break;
  }

  case 'detail': {
    const taskId = args[1];
    if (!taskId) {
      console.error('Error: task_id required. Example: node trace.js detail task_xxx');
      process.exit(1);
    }
    const task = getTaskDetail(taskId);
    displayTaskDetail(task);
    break;
  }

  case 'cost': {
    const subCmd = args[1];
    if (subCmd === 'agent') {
      const period = args[2] || 'all';
      const data = getCostByAgent(period);
      displayCostByAgent(data, `에이전트별 비용 (${period})`);
    } else {
      const period = subCmd || 'all';
      const stats = getCostStats(period);
      displayCostStats(stats, `비용 통계 (${period})`);

      // Also show by agent
      const byAgent = getCostByAgent(period);
      displayCostByAgent(byAgent);
    }
    break;
  }

  case 'agents': {
    const agents = getAgentList();
    displayAgentList(agents);
    break;
  }

  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
