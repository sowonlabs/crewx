/**
 * Unit tests for query command — default agent fallback (R1 regression fix)
 *
 * Verifies that:
 *   crewx q "hi"         → dispatches to @crewx (default agent)
 *   crewx q "@claude hi" → dispatches to @claude (explicit agent)
 *   crewx q              → shows usage error and exits 1 (no message)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleQuery } from './query';
import { createCliCrewx } from '../bootstrap/crewx-cli';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@crewx/sdk', () => ({
  setAuditVerbose: vi.fn(),
}));

vi.mock('../bootstrap/crewx-cli', () => ({
  createCliCrewx: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function successResult(data = 'pong') {
  return { ok: true, data, meta: { provider: 'cli/claude', durationMs: 100 } };
}

// ── Spy setup ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exitSpy: any;
let errorSpy: ReturnType<typeof vi.spyOn>;
let queryFn: ReturnType<typeof vi.fn>;
let closeFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Throw on process.exit so code stops after it — prevents continuation after mocked exit
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code}`);
  }) as any);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  queryFn = vi.fn().mockResolvedValue(successResult());
  closeFn = vi.fn().mockResolvedValue(undefined);

  vi.mocked(createCliCrewx).mockResolvedValue({
    query: queryFn,
    close: closeFn,
  } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleQuery — default agent fallback', () => {
  it('crewx q "hi" dispatches to @crewx default agent', async () => {
    await handleQuery(['hi']);

    expect(queryFn).toHaveBeenCalledWith('@crewx', 'hi', expect.any(Object));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('crewx q "hello world" sends full string as message to @crewx', async () => {
    await handleQuery(['hello world']);

    expect(queryFn).toHaveBeenCalledWith('@crewx', 'hello world', expect.any(Object));
  });

  it('crewx q "@claude hi" dispatches to @claude (explicit agent)', async () => {
    await handleQuery(['@claude hi']);

    expect(queryFn).toHaveBeenCalledWith('@claude', 'hi', expect.any(Object));
  });

  it('crewx q with no message shows usage and exits 1', async () => {
    await expect(handleQuery([])).rejects.toThrow('process.exit:1');

    const errorOutput = errorSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(errorOutput).toMatch(/\[@agent\]/);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('crewx q "@onlyagent" (agent only, no message) shows usage and exits 1', async () => {
    await expect(handleQuery(['@onlyagent'])).rejects.toThrow('process.exit:1');

    expect(queryFn).not.toHaveBeenCalled();
  });

  it('prints response to stdout', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    queryFn.mockResolvedValue(successResult('the answer'));

    await handleQuery(['what is 1+1?']);

    expect(logSpy).toHaveBeenCalledWith('the answer');
  });
});

describe('handleQuery — --thread flag forwarded', () => {
  it('passes thread to crewx.query', async () => {
    await handleQuery(['--thread', 'my-thread', 'hello']);

    expect(queryFn).toHaveBeenCalledWith(
      '@crewx',
      'hello',
      expect.objectContaining({ threadId: 'my-thread' }),
    );
  });
});
