/**
 * skill-tracer.js - 스킬 실행 추적 라이브러리 (PoC)
 *
 * 스킬에서 직접 node skill.js 실행해도 로깅됨
 * - usage.log: 텍스트 파일 로그 (경량)
 * - traces.db: SQLite DB 로그 (상세)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

/**
 * traces.db 경로 찾기
 */
function getTracesDbPath() {
  if (process.env.CREWX_TRACES_DB) {
    return process.env.CREWX_TRACES_DB;
  }

  const localDb = path.join(process.cwd(), '.crewx', 'traces.db');
  if (fs.existsSync(localDb)) {
    return localDb;
  }

  const homeDb = path.join(process.env.HOME || '~', '.crewx', 'traces.db');
  return homeDb;
}

/**
 * traces.db 연결 및 테이블 확인
 */
function getDb() {
  const dbPath = getTracesDbPath();
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      user_id TEXT,
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'execute',
      status TEXT NOT NULL DEFAULT 'running',
      result TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      metadata TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spans (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      parent_span_id TEXT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'internal',
      status TEXT NOT NULL DEFAULT 'ok',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      input TEXT,
      output TEXT,
      error TEXT,
      attributes TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_span_id) REFERENCES spans(id) ON DELETE SET NULL
    )
  `);

  return db;
}

/**
 * 로컬 타임스탬프 (usage.log용)
 */
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

/**
 * usage.log에 기록
 */
function logToUsageFile(logPath, skillName, command) {
  const timestamp = getLocalTimestamp();
  const line = `${timestamp} | [${skillName}] ${command}\n`;
  fs.appendFileSync(logPath, line);
}

/**
 * 스킬 실행 추적 시작
 *
 * @param {string} skillName - 스킬 이름 (예: 'memory-v2')
 * @param {string} command - 실행 명령어 (예: 'save agent1 test')
 * @param {object} [options] - 옵션
 * @param {string} [options.agentId] - 에이전트 ID
 * @param {string} [options.usageLog] - usage.log 파일 경로 (지정하면 파일 로그도 남김)
 * @param {boolean} [options.tracesDb=true] - traces.db 기록 여부
 * @returns {{ taskId: string, ok: (result?: string) => void, fail: (error: string) => void }}
 */
function trace(skillName, command, options = {}) {
  const {
    agentId,
    usageLog,
    tracesDb = true
  } = typeof options === 'string' ? { agentId: options } : options;

  // usage.log 기록 (항상, 중복 상관없이)
  if (usageLog) {
    logToUsageFile(usageLog, skillName, command);
  }

  // traces.db 기록 비활성화된 경우
  if (!tracesDb) {
    return {
      taskId: 'no-trace',
      ok: () => {},
      fail: () => {},
      _skipped: true
    };
  }

  const db = getDb();
  const now = new Date().toISOString();
  const resolvedAgentId = agentId || process.env.CREWX_AGENT_ID || 'direct';

  // crewx skill x로 실행된 경우 → spans 테이블에 child span으로 기록
  const parentTaskId = process.env.CREWX_TASK_ID;
  if (parentTaskId && parentTaskId.trim() !== '') {
    const spanId = randomUUID();
    const attributes = JSON.stringify({
      skill: skillName,
      agent_id: resolvedAgentId,
      tracer_version: '0.3.0'
    });

    // Ensure parent task record exists (stub for crewx-managed tasks)
    db.prepare(`
      INSERT OR IGNORE INTO tasks (id, agent_id, prompt, mode, status, started_at)
      VALUES (?, ?, ?, 'execute', 'running', ?)
    `).run(parentTaskId, resolvedAgentId, `[crewx-task] ${parentTaskId}`, now);

    db.prepare(`
      INSERT INTO spans (id, task_id, name, kind, status, started_at, input, attributes)
      VALUES (?, ?, ?, 'internal', 'ok', ?, ?, ?)
    `).run(spanId, parentTaskId, `[skill:${skillName}] ${command}`, now, command, attributes);

    return {
      taskId: parentTaskId,
      spanId,
      ok: (result) => {
        const completedAt = new Date().toISOString();
        db.prepare(`
          UPDATE spans
          SET status = 'ok',
              output = ?,
              completed_at = ?,
              duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
          WHERE id = ?
        `).run(result || null, completedAt, completedAt, spanId);
        db.close();
      },
      fail: (error) => {
        const completedAt = new Date().toISOString();
        db.prepare(`
          UPDATE spans
          SET status = 'error',
              error = ?,
              completed_at = ?,
              duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
          WHERE id = ?
        `).run(error, completedAt, completedAt, spanId);
        db.close();
      },
      _skipped: false
    };
  }

  // 직접 호출 (독립 실행) → 기존대로 tasks 테이블에 기록
  const taskId = randomUUID();
  const metadata = JSON.stringify({
    skill: skillName,
    direct_call: true,
    tracer_version: '0.3.0'
  });

  db.prepare(`
    INSERT INTO tasks (id, agent_id, prompt, mode, status, started_at, metadata)
    VALUES (?, ?, ?, 'execute', 'running', ?, ?)
  `).run(taskId, resolvedAgentId, `[skill:${skillName}] ${command}`, now, metadata);

  return {
    taskId,
    ok: (result) => {
      const completedAt = new Date().toISOString();
      db.prepare(`
        UPDATE tasks
        SET status = 'success',
            result = ?,
            completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
        WHERE id = ?
      `).run(result || null, completedAt, completedAt, taskId);
      db.close();
    },
    fail: (error) => {
      const completedAt = new Date().toISOString();
      db.prepare(`
        UPDATE tasks
        SET status = 'failed',
            error = ?,
            completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
        WHERE id = ?
      `).run(error, completedAt, completedAt, taskId);
      db.close();
    },
    _skipped: false
  };
}

/**
 * 스킬 실행 래퍼 (권장)
 * try/catch, trace 시작/종료 자동 처리
 *
 * @param {string} skillName - 스킬 이름
 * @param {() => Promise<any>} fn - 실행할 함수
 * @param {object} [options] - 옵션
 * @param {string} [options.usageLog] - usage.log 파일 경로
 * @param {boolean} [options.tracesDb=true] - traces.db 기록 여부
 * @returns {Promise<any>}
 *
 * @example
 * // 둘 다 기록
 * run('memory-v2', main, {
 *   usageLog: path.join(__dirname, 'usage.log'),
 *   tracesDb: true
 * });
 *
 * // usage.log만
 * run('memory-v2', main, {
 *   usageLog: path.join(__dirname, 'usage.log'),
 *   tracesDb: false
 * });
 *
 * // traces.db만 (기본)
 * run('memory-v2', main);
 */
async function run(skillName, fn, options = {}) {
  const command = process.argv.slice(2).join(' ');
  const t = trace(skillName, command, options);

  try {
    const result = await fn();
    const resultStr = result !== undefined ? JSON.stringify(result) : null;
    t.ok(resultStr);
    return result;
  } catch (e) {
    t.fail(e.message || String(e));
    throw e;
  }
}

module.exports = { trace, run, getTracesDbPath };
