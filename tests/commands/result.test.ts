import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTask = vi.fn();
const mockGetAllTasks = vi.fn();

vi.mock('../../src/commands/task-db', () => ({
  getTask: mockGetTask,
  getAllTasks: mockGetAllTasks,
}));

describe('commands/result', () => {
  let handleResult: (args: string[]) => Promise<void>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetAllTasks.mockReturnValue([]);

    const mod = await import('../../src/commands/result');
    handleResult = mod.handleResult;
  });

  it('shows "No tasks found." when no task id and no tasks', async () => {
    await handleResult([]);
    expect(consoleLogSpy).toHaveBeenCalledWith('No tasks found.');
  });

  it('shows recent tasks when no task id', async () => {
    mockGetAllTasks.mockReturnValue([
      { id: 'tsk_abc', agent_id: 'claude', mode: 'query', status: 'success', started_at: new Date().toISOString(), prompt: 'hi' },
    ]);
    await handleResult([]);
    const output = consoleLogSpy.mock.calls.flat().join('\n');
    expect(output).toContain('tsk_abc');
  });

  it('prints task result for completed task', async () => {
    mockGetTask.mockReturnValue({
      id: 'tsk_abc',
      agent_id: 'claude',
      mode: 'query',
      status: 'success',
      result: 'Hello World!',
      started_at: new Date().toISOString(),
      prompt: 'hi',
    });
    await handleResult(['tsk_abc']);
    expect(consoleLogSpy).toHaveBeenCalledWith('Hello World!');
  });

  it('exits with 1 for task not found', async () => {
    mockGetTask.mockReturnValue(undefined);
    await expect(handleResult(['tsk_notexist'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('exits with 1 for running task', async () => {
    mockGetTask.mockReturnValue({
      id: 'tsk_abc', status: 'running', started_at: new Date().toISOString(), prompt: 'hi',
    });
    await expect(handleResult(['tsk_abc'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('still running'));
  });

  it('exits with 1 for failed task', async () => {
    mockGetTask.mockReturnValue({
      id: 'tsk_abc', status: 'failed', error: 'something failed', started_at: new Date().toISOString(), prompt: 'hi',
    });
    await expect(handleResult(['tsk_abc'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('failed'));
  });

  it('outputs JSON with --json flag', async () => {
    const task = {
      id: 'tsk_abc',
      agent_id: 'claude',
      mode: 'query',
      status: 'success',
      result: 'Hello!',
      started_at: new Date().toISOString(),
      prompt: 'hi',
    };
    mockGetTask.mockReturnValue(task);
    await handleResult(['tsk_abc', '--json']);
    const jsonStr = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(jsonStr);
    expect(parsed.id).toBe('tsk_abc');
  });
});
