import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTasks: unknown[] = [];
vi.mock('../../src/commands/task-db', () => ({
  getRunningTasks: vi.fn(() => mockTasks),
}));

describe('commands/ps', () => {
  let handlePs: (args: string[]) => Promise<void>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockTasks.length = 0;
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mod = await import('../../src/commands/ps');
    handlePs = mod.handlePs;
  });

  it('shows "No running tasks." when no tasks', async () => {
    await handlePs([]);
    expect(consoleLogSpy).toHaveBeenCalledWith('No running tasks.');
  });

  it('renders table when tasks exist', async () => {
    mockTasks.push({
      id: 'tsk_abc123',
      agent_id: 'claude',
      mode: 'query',
      status: 'running',
      pid: 1234,
      started_at: new Date().toISOString(),
      prompt: 'hi',
    });
    await handlePs([]);
    const allCalls = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allCalls).toContain('tsk_abc123');
    expect(allCalls).toContain('claude');
  });

  it('outputs JSON when --json flag is present', async () => {
    mockTasks.push({
      id: 'tsk_abc123',
      agent_id: 'claude',
      mode: 'query',
      status: 'running',
      started_at: new Date().toISOString(),
      prompt: 'hi',
    });
    await handlePs(['--json']);
    const jsonCall = consoleLogSpy.mock.calls[0]?.[0] as string;
    expect(() => JSON.parse(jsonCall)).not.toThrow();
    const parsed = JSON.parse(jsonCall) as unknown[];
    expect(parsed).toHaveLength(1);
  });

  // Edge cases
  it('renders "—" for null pid in table output', async () => {
    mockTasks.push({
      id: 'tsk_nopid',
      agent_id: 'gemini',
      mode: 'execute',
      status: 'running',
      pid: null,
      started_at: new Date().toISOString(),
      prompt: 'task',
    });
    await handlePs([]);
    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allOutput).toContain('—');
  });

  it('shows task count footer when tasks are present', async () => {
    mockTasks.push({
      id: 'tsk_footer1',
      agent_id: 'claude',
      mode: 'query',
      status: 'running',
      pid: 5678,
      started_at: new Date().toISOString(),
      prompt: 'test',
    });
    await handlePs([]);
    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allOutput).toMatch(/1 running task/);
  });
});
