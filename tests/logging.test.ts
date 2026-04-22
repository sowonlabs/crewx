/**
 * Tests for CLI file-based logging (logging.ts).
 * Verifies that log files are created in .crewx/logs/ on task:start/task:end.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TypedEventEmitter } from '@crewx/sdk';
import type { TaskStartEvent, TaskEndEvent } from '@crewx/sdk';

/** Minimal Crewx-like class for testing logging without full SDK init */
class FakeCrewx extends TypedEventEmitter {
  emitStart(event: TaskStartEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:start', event);
  }
  emitEnd(event: TaskEndEvent): void {
    // @ts-expect-error protected emit
    this.emit('task:end', event);
  }
}

describe('CLI logging — attachFileLogger', () => {
  let tmpDir: string;
  let logsDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `crewx-cli-logging-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    logsDir = join(tmpDir, '.crewx', 'logs');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function importLogger() {
    // Dynamic import to allow mocking if needed
    const { attachFileLogger } = await import('../src/logging');
    return attachFileLogger;
  }

  it('creates .crewx/logs/ directory if not exists', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    attachFileLogger(fake as any, tmpDir);

    fake.emitStart({
      traceId: 'tsk_abc12345',
      timestamp: new Date('2026-04-12T14:50:44Z'),
      agentRef: '@claude',
      message: 'hello',
      mode: 'query',
    });

    const { existsSync } = await import('fs');
    expect(existsSync(logsDir)).toBe(true);
  });

  it('creates a log file with correct name format on task:start', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    attachFileLogger(fake as any, tmpDir);

    const traceId = 'tsk_abc12345';
    fake.emitStart({
      traceId,
      timestamp: new Date('2026-04-12T14:50:44Z'),
      agentRef: '@claude',
      message: 'hello world',
      mode: 'query',
    });

    const files = readdirSync(logsDir);
    expect(files).toHaveLength(1);
    // Format: {YYYYMMDDTHHmmss}_{traceId}.log
    expect(files[0]).toMatch(/^\d{8}T\d{6}_tsk_abc12345\.log$/);
  });

  it('log file header contains agent ref and message', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    attachFileLogger(fake as any, tmpDir);

    fake.emitStart({
      traceId: 'tsk_hdr00001',
      timestamp: new Date('2026-04-12T10:00:00Z'),
      agentRef: '@claude',
      message: 'test message',
      mode: 'query',
    });

    const files = readdirSync(logsDir);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8');
    expect(content).toContain('tsk_hdr00001');
    expect(content).toContain('@claude');
    expect(content).toContain('test message');
    expect(content).toContain('query');
  });

  it('appends completion info on task:end success', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    attachFileLogger(fake as any, tmpDir);

    const traceId = 'tsk_end00001';
    const timestamp = new Date('2026-04-12T10:00:00Z');

    fake.emitStart({ traceId, timestamp, agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitEnd({ traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 1234, result: 'done' });

    const files = readdirSync(logsDir);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8');
    expect(content).toContain('1234ms');
    expect(content).toContain('completed successfully');
    expect(content).toContain('exit code: 0');
  });

  it('appends failure info on task:end with error', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    attachFileLogger(fake as any, tmpDir);

    const traceId = 'tsk_fail0001';
    const timestamp = new Date('2026-04-12T10:00:00Z');

    fake.emitStart({ traceId, timestamp, agentRef: '@claude', message: 'oops', mode: 'execute' });
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

  it('returns cleanup function that removes listeners', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    const cleanup = attachFileLogger(fake as any, tmpDir);
    cleanup();

    // After cleanup, start event should not create a log file
    fake.emitStart({
      traceId: 'tsk_clean001',
      timestamp: new Date(),
      agentRef: '@claude',
      message: 'hello',
      mode: 'query',
    });

    const { existsSync } = await import('fs');
    // logsDir may not exist since listener was removed before any event
    expect(existsSync(logsDir) ? readdirSync(logsDir).length : 0).toBe(0);
  });

  it('does not create duplicate files for the same traceId', async () => {
    const attachFileLogger = await importLogger();
    const fake = new FakeCrewx();
    attachFileLogger(fake as any, tmpDir);

    const traceId = 'tsk_dup00001';
    const timestamp = new Date();

    fake.emitStart({ traceId, timestamp, agentRef: '@claude', message: 'hi', mode: 'query' });
    fake.emitEnd({ traceId, timestamp: new Date(), agentRef: '@claude', mode: 'query', durationMs: 10 });

    const files = readdirSync(logsDir);
    expect(files).toHaveLength(1);
  });
});
