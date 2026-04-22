/**
 * Tests for SqliteTracingPlugin.
 *
 * Verifies that task:start, task:output, and task:end events are persisted
 * to the SQLite database. Tests pre-create the tasks table (the plugin
 * no longer manages schema — it writes to the pre-existing global db).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import BetterSqlite3 from 'better-sqlite3';
import { TypedEventEmitter } from '@crewx/sdk';
import type { TaskStartEvent, TaskEndEvent, TaskOutputEvent } from '@crewx/sdk';
import { SqliteTracingPlugin } from '../../src/plugins/sqlite-tracing';

class FakeCrewx extends TypedEventEmitter {
  emitStart(event: TaskStartEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:start', event);
  }
  emitOutput(event: TaskOutputEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:output', event);
  }
  emitEnd(event: TaskEndEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:end', event);
  }
}

/** Create full tasks table matching the production schema. */
function setupSchema(dbPath: string): void {
  const db = new BetterSqlite3(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                  TEXT PRIMARY KEY,
      agent_id            TEXT NOT NULL,
      prompt              TEXT NOT NULL,
      mode                TEXT NOT NULL DEFAULT 'query',
      status              TEXT NOT NULL DEFAULT 'running',
      pid                 INTEGER,
      result              TEXT,
      error               TEXT,
      started_at          TEXT NOT NULL,
      completed_at        TEXT,
      duration_ms         INTEGER,
      crewx_version       TEXT,
      platform            TEXT DEFAULT 'cli',
      model               TEXT,
      rendered_prompt     TEXT,
      command             TEXT,
      coding_agent_command TEXT,
      workspace_id        TEXT,
      workspace_name      TEXT,
      caller_agent_id     TEXT,
      parent_task_id      TEXT,
      trace_id            TEXT,
      metadata            TEXT,
      thread_id           TEXT,
      input_tokens        INTEGER DEFAULT 0,
      output_tokens       INTEGER DEFAULT 0,
      cached_input_tokens INTEGER DEFAULT 0,
      cost_usd            REAL DEFAULT 0,
      exit_code           INTEGER,
      logs                TEXT
    )
  `);
  db.close();
}

describe('SqliteTracingPlugin', () => {
  let tmpDir: string;
  let dbPath: string;
  let fake: FakeCrewx;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `sqlite-tracing-test-${Date.now()}`);
    mkdirSync(join(tmpDir, '.crewx'), { recursive: true });
    dbPath = join(tmpDir, '.crewx', 'crewx.db');
    setupSchema(dbPath);
    fake = new FakeCrewx();

    // Ensure chain env vars don't leak from the host environment into test assertions
    delete process.env['CREWX_CALLER_AGENT_ID'];
    delete process.env['CREWX_PARENT_TASK_ID'];
    delete process.env['CREWX_TRACE_ID'];
  });

  afterEach(() => {
    delete process.env['CREWX_CALLER_AGENT_ID'];
    delete process.env['CREWX_PARENT_TASK_ID'];
    delete process.env['CREWX_TRACE_ID'];
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function readTasks(path: string) {
    const db = new BetterSqlite3(path, { readonly: true });
    const rows = db.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[];
    db.close();
    return rows;
  }

  it('attach() opens crewx.db (does not create schema)', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);
    expect(existsSync(dbPath)).toBe(true);
    plugin.detach(fake as any);
  });

  it('task:start inserts a running row with core fields', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_abc00001',
      timestamp: new Date('2026-04-12T10:00:00Z'),
      agentRef: '@claude',
      message: 'hello world',
      mode: 'query',
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row['id']).toBe('tsk_abc00001');
    expect(row['agent_id']).toBe('claude');
    expect(row['prompt']).toBe('hello world');
    expect(row['mode']).toBe('query');
    expect(row['status']).toBe('running');
    expect(row['platform']).toBe('cli');
    expect(row['trace_id']).toBe('tsk_abc00001');
    // workspace is only populated when crewx.yaml exists in cwd (not the case in this temp dir)
    expect(typeof row['command']).toBe('string');
    expect(typeof row['crewx_version']).toBe('string');
  });

  it('task:start stores model, codingAgentCommand, renderedPrompt, metadata, threadId', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_rich0001',
      timestamp: new Date(),
      agentRef: '@core_dev',
      message: 'implement feature',
      mode: 'execute',
      pid: 9999,
      model: 'claude-sonnet-4-6',
      provider: 'cli/claude',
      codingAgentCommand: 'claude -p implement feature --output-format stream-json',
      renderedPrompt: '<crewx_system_prompt>...</crewx_system_prompt>',
      metadata: { provider: 'cli/claude' },
      threadId: 'sdk-test',
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    const row = rows[0]!;
    expect(row['model']).toBe('claude-sonnet-4-6');
    expect(row['coding_agent_command']).toBe('claude -p implement feature --output-format stream-json');
    expect(row['rendered_prompt']).toBe('<crewx_system_prompt>...</crewx_system_prompt>');
    expect(row['metadata']).toBe('{"provider":"cli/claude"}');
    expect(row['thread_id']).toBe('sdk-test');
    expect(row['pid']).toBe(9999);
  });

  it('task:end updates status to success with tokens + cost + exitCode', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const traceId = 'tsk_end00001';
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitEnd({
      traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 1234, result: 'done!',
      exitCode: 0,
      inputTokens: 1000,
      outputTokens: 50,
      cachedInputTokens: 800,
      costUsd: 0.00315,
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    const row = rows[0]!;
    expect(row['status']).toBe('success');
    expect(row['result']).toBe('done!');
    expect(row['duration_ms']).toBe(1234);
    expect(row['error']).toBeNull();
    expect(row['exit_code']).toBe(0);
    expect(row['input_tokens']).toBe(1000);
    expect(row['output_tokens']).toBe(50);
    expect(row['cached_input_tokens']).toBe(800);
    expect(row['cost_usd']).toBeCloseTo(0.00315);
  });

  it('task:end updates status to failed on error', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const traceId = 'tsk_fail0001';
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'oops', mode: 'execute' });
    fake.emitEnd({
      traceId, timestamp: new Date(), agentRef: '@claude', mode: 'execute', durationMs: 500,
      error: { code: 'QUERY_FAILED', message: 'provider down' },
      exitCode: 1,
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    const row = rows[0]!;
    expect(row['status']).toBe('failed');
    expect(row['result']).toBeNull();
    expect(row['exit_code']).toBe(1);
    const error = JSON.parse(row['error'] as string) as { code: string; message: string };
    expect(error.code).toBe('QUERY_FAILED');
  });

  it('task:end updates model when provided (runtime model resolution)', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const traceId = 'tsk_model001';
    // task:start has no model (agent has no inline.model)
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
    // task:end carries the runtime-resolved model from the provider's result event
    fake.emitEnd({
      traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 100,
      model: 'claude-opus-4-6',
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows[0]!['model']).toBe('claude-opus-4-6');
  });

  it('task:end preserves existing model when event.model is null', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const traceId = 'tsk_model002';
    fake.emitStart({
      traceId, timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query',
      model: 'claude-sonnet-4-6',
    });
    fake.emitEnd({ traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 100 });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    // COALESCE(null, model) → keeps the value set on task:start
    expect(rows[0]!['model']).toBe('claude-sonnet-4-6');
  });

  it('task:output lines are accumulated and stored in logs on task:end', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const traceId = 'tsk_logs0001';
    const ts = new Date();
    fake.emitStart({ traceId, timestamp: ts, agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitOutput({ traceId, timestamp: ts, agentRef: '@claude', output: 'line one', level: 'stdout' });
    fake.emitOutput({ traceId, timestamp: ts, agentRef: '@claude', output: 'line two', level: 'stdout' });
    fake.emitEnd({ traceId, timestamp: ts, agentRef: '@claude', mode: 'query', durationMs: 100 });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    const logs = rows[0]!['logs'] as string;
    const parsed = JSON.parse(logs) as Array<{ timestamp: string; level: string; message: string }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.message).toBe('line one');
    expect(parsed[1]!.message).toBe('line two');
    expect(parsed[0]!.level).toBe('stdout');
    expect(parsed[0]!.timestamp).toBeTruthy();
  });

  it('logs column is null when no task:output events emitted', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const traceId = 'tsk_nologs01';
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitEnd({ traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 50 });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows[0]!['logs']).toBeNull();
  });

  it('detach() removes listeners — no DB write after detach', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);
    plugin.detach(fake as any);

    fake.emitStart({
      traceId: 'tsk_after001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'post-detach',
      mode: 'query',
    });

    const rows = readTasks(dbPath);
    expect(rows).toHaveLength(0);
  });

  it('detach() closes the DB connection', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);
    expect(() => plugin.detach(fake as any)).not.toThrow();
  });

  it('name is "sqlite-tracing"', () => {
    expect(new SqliteTracingPlugin().name).toBe('sqlite-tracing');
  });

  it('strips @ prefix from agentRef in agent_id column', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_prefix01',
      timestamp: new Date(),
      agentRef: '@gemini',
      message: 'hi',
      mode: 'query',
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows[0]!['agent_id']).toBe('gemini');
  });

  it('task:start stores pid when provided', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_pid00001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'hi',
      mode: 'query',
      pid: 12345,
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows[0]!['pid']).toBe(12345);
  });

  it('task:start stores null pid when not provided', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_nopid001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'hi',
      mode: 'query',
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows[0]!['pid']).toBeNull();
  });

  describe('chain propagation — parent_task_id / caller_agent_id / trace_id', () => {
    beforeEach(() => {
      delete process.env['CREWX_CALLER_AGENT_ID'];
      delete process.env['CREWX_PARENT_TASK_ID'];
      delete process.env['CREWX_TRACE_ID'];
    });

    afterEach(() => {
      delete process.env['CREWX_CALLER_AGENT_ID'];
      delete process.env['CREWX_PARENT_TASK_ID'];
      delete process.env['CREWX_TRACE_ID'];
    });

    function readChainRow(path: string, id: string) {
      const db = new BetterSqlite3(path, { readonly: true });
      const row = db
        .prepare('SELECT id, caller_agent_id, parent_task_id, trace_id FROM tasks WHERE id = ?')
        .get(id) as { id: string; caller_agent_id: string | null; parent_task_id: string | null; trace_id: string | null } | undefined;
      db.close();
      return row;
    }

    it('U1: root request — NULL parent/caller, trace_id=event.traceId', async () => {
      const plugin = new SqliteTracingPlugin(tmpDir);
      plugin.attach(fake as any);
      fake.emitStart({ traceId: 'tsk_u1root1', timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
      plugin.detach(fake as any);

      const row = readChainRow(dbPath, 'tsk_u1root1');
      expect(row!.parent_task_id).toBeNull();
      expect(row!.caller_agent_id).toBeNull();
      expect(row!.trace_id).toBe('tsk_u1root1');
    });

    it('U2: child request — env values stored verbatim', async () => {
      process.env['CREWX_PARENT_TASK_ID']  = 'tsk_A';
      process.env['CREWX_CALLER_AGENT_ID'] = 'core_dev';
      process.env['CREWX_TRACE_ID']        = 'tsk_ROOT';

      const plugin = new SqliteTracingPlugin(tmpDir);
      plugin.attach(fake as any);
      fake.emitStart({ traceId: 'tsk_u2child', timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
      plugin.detach(fake as any);

      const row = readChainRow(dbPath, 'tsk_u2child');
      expect(row!.parent_task_id).toBe('tsk_A');
      expect(row!.caller_agent_id).toBe('core_dev');
      expect(row!.trace_id).toBe('tsk_ROOT');
    });

    it('U3: two task:start with different env — no caching regression', async () => {
      const plugin = new SqliteTracingPlugin(tmpDir);
      plugin.attach(fake as any);

      fake.emitStart({ traceId: 'tsk_u3first', timestamp: new Date(), agentRef: '@claude', message: 'first', mode: 'query' });

      process.env['CREWX_PARENT_TASK_ID']  = 'tsk_u3first';
      process.env['CREWX_CALLER_AGENT_ID'] = 'core_dev';
      process.env['CREWX_TRACE_ID']        = 'tsk_u3first';
      fake.emitStart({ traceId: 'tsk_u3second', timestamp: new Date(), agentRef: '@claude', message: 'second', mode: 'query' });

      plugin.detach(fake as any);

      const row1 = readChainRow(dbPath, 'tsk_u3first');
      const row2 = readChainRow(dbPath, 'tsk_u3second');

      expect(row1!.parent_task_id).toBeNull();
      expect(row1!.caller_agent_id).toBeNull();
      expect(row1!.trace_id).toBe('tsk_u3first');

      expect(row2!.parent_task_id).toBe('tsk_u3first');
      expect(row2!.caller_agent_id).toBe('core_dev');
      expect(row2!.trace_id).toBe('tsk_u3first');
    });

    it('U4: ALTER guard — no error when columns already exist', async () => {
      const plugin = new SqliteTracingPlugin(tmpDir);
      expect(() => plugin.attach(fake as any)).not.toThrow();
      fake.emitStart({ traceId: 'tsk_u4guard', timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
      plugin.detach(fake as any);
      expect(readChainRow(dbPath, 'tsk_u4guard')).toBeDefined();
    });

    it('U5: CREWX_TRACE_ID takes priority over event.traceId', async () => {
      process.env['CREWX_TRACE_ID'] = 'tsk_ROOT';

      const plugin = new SqliteTracingPlugin(tmpDir);
      plugin.attach(fake as any);
      fake.emitStart({ traceId: 'tsk_u5child', timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
      plugin.detach(fake as any);

      const row = readChainRow(dbPath, 'tsk_u5child');
      expect(row!.trace_id).toBe('tsk_ROOT');
    });
  });

  it('INSERT OR IGNORE prevents duplicate on repeated task:start for same traceId', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    const event: TaskStartEvent = {
      traceId: 'tsk_dup00001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'hi',
      mode: 'query',
    };
    fake.emitStart(event);
    fake.emitStart(event);

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    expect(rows).toHaveLength(1);
  });

  it('metadata defaults to provider when not in event', async () => {
    const plugin = new SqliteTracingPlugin(tmpDir);
    plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_meta0001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'hi',
      mode: 'query',
      provider: 'cli/claude',
    });

    plugin.detach(fake as any);

    const rows = readTasks(dbPath);
    const meta = JSON.parse(rows[0]!['metadata'] as string) as { provider: string };
    expect(meta.provider).toBe('cli/claude');
  });
});
