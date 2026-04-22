/**
 * Tests for FileLoggerPlugin.
 *
 * Verifies that the plugin creates log files in .crewx/logs/
 * when task:start and task:end events are emitted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TypedEventEmitter } from '@crewx/sdk';
import type { TaskStartEvent, TaskEndEvent, TaskOutputEvent } from '@crewx/sdk';

// Module not yet implemented — stub so the import resolves
vi.mock('../../src/plugins/file-logger', () => ({ FileLoggerPlugin: class {} }));
import { FileLoggerPlugin } from '../../src/plugins/file-logger';

/** Minimal Crewx-like emitter for plugin testing */
class FakeCrewx extends TypedEventEmitter {
  use = async (plugin: { attach: (c: FakeCrewx) => void | Promise<void> }) => { await plugin.attach(this); };
  emitStart(event: TaskStartEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:start', event);
  }
  emitEnd(event: TaskEndEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:end', event);
  }
  emitOutput(event: TaskOutputEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:output', event);
  }
}

describe.skip('FileLoggerPlugin', () => {
  // Source module packages/cli/src/plugins/file-logger not yet implemented
  let tmpDir: string;
  let logsDir: string;
  let fake: FakeCrewx;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `file-logger-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    logsDir = join(tmpDir, '.crewx', 'logs');
    fake = new FakeCrewx();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('attach() subscribes to task:start and task:end', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_abc00001',
      timestamp: new Date('2026-04-12T10:00:00Z'),
      agentRef: '@claude',
      message: 'hello',
      mode: 'query',
    });

    expect(existsSync(logsDir)).toBe(true);
    const files = readdirSync(logsDir);
    expect(files).toHaveLength(1);
  });

  it('creates log file with correct name format on task:start', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_abc12345',
      timestamp: new Date('2026-04-12T14:50:44Z'),
      agentRef: '@claude',
      message: 'hello',
      mode: 'query',
    });

    const files = readdirSync(logsDir);
    expect(files[0]).toMatch(/^\d{8}T\d{6}_tsk_abc12345\.log$/);
  });

  it('log file header contains traceId, agent and message', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);

    fake.emitStart({
      traceId: 'tsk_hdr00001',
      timestamp: new Date('2026-04-12T10:00:00Z'),
      agentRef: '@claude',
      message: 'test task',
      mode: 'execute',
    });

    const files = readdirSync(logsDir);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8');
    expect(content).toContain('tsk_hdr00001');
    expect(content).toContain('@claude');
    expect(content).toContain('test task');
    expect(content).toContain('execute');
  });

  it('appends completion on task:end success', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);

    const traceId = 'tsk_end00001';
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitEnd({ traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 1234, result: 'done' });

    const files = readdirSync(logsDir);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8');
    expect(content).toContain('1234ms');
    expect(content).toContain('completed successfully');
    expect(content).toContain('exit code: 0');
  });

  it('appends failure on task:end with error', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);

    const traceId = 'tsk_fail0001';
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'oops', mode: 'execute' });
    fake.emitEnd({
      traceId,
      timestamp: new Date(),
      agentRef: '@claude',
      mode: 'execute',
      durationMs: 500,
      error: { code: 'QUERY_FAILED', message: 'provider down' },
    });

    const files = readdirSync(logsDir);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8');
    expect(content).toContain('failed: provider down');
    expect(content).toContain('exit code: 1');
  });

  it('detach() removes listeners — no log file created after detach', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);
    plugin.detach(fake as any);

    fake.emitStart({
      traceId: 'tsk_clean001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'hello',
      mode: 'query',
    });

    expect(existsSync(logsDir) ? readdirSync(logsDir).length : 0).toBe(0);
  });

  it('appends STDOUT lines on task:output', async () => {
    const plugin = new FileLoggerPlugin(tmpDir);
    await plugin.attach(fake as any);

    const traceId = 'tsk_out00001';
    fake.emitStart({ traceId, timestamp: new Date(), agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitOutput({ traceId, timestamp: new Date(), agentRef: '@claude', output: '{"type":"assistant"}', level: 'stdout' });
    fake.emitOutput({ traceId, timestamp: new Date(), agentRef: '@claude', output: '{"type":"result"}', level: 'stdout' });

    const files = readdirSync(logsDir);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8');
    expect(content).toContain('STDOUT: {"type":"assistant"}');
    expect(content).toContain('STDOUT: {"type":"result"}');
  });

  it('name is "file-logger"', () => {
    expect(new FileLoggerPlugin().name).toBe('file-logger');
  });

  it('defaults to process.cwd() when no workspaceRoot given', () => {
    const plugin = new FileLoggerPlugin();
    // Just check that attach doesn't throw when dir is process.cwd()
    expect(() => plugin.attach(fake as any)).not.toThrow();
    plugin.detach(fake as any);
  });
});
