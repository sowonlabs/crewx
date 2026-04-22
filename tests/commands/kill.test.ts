import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockKillTask = vi.fn();
const mockGetRunningTasks = vi.fn();

vi.mock('../../src/commands/task-db', () => ({
  killTask: mockKillTask,
  getRunningTasks: mockGetRunningTasks,
}));

describe('commands/kill', () => {
  let handleKill: (args: string[]) => Promise<void>;
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
    mockGetRunningTasks.mockReturnValue([]);
    mockKillTask.mockReturnValue({ ok: true, message: 'Killed task tsk_abc' });

    const mod = await import('../../src/commands/kill');
    handleKill = mod.handleKill;
  });

  it('shows error and exits when no task id and no --all', async () => {
    await expect(handleKill([])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('task ID'));
  });

  it('calls killTask with the provided task id', async () => {
    await handleKill(['tsk_abc123']);
    expect(mockKillTask).toHaveBeenCalledWith('tsk_abc123');
    expect(consoleLogSpy).toHaveBeenCalledWith('Killed task tsk_abc');
  });

  it('exits with 1 when killTask returns ok=false', async () => {
    mockKillTask.mockReturnValue({ ok: false, message: 'Task not found: tsk_xyz' });
    await expect(handleKill(['tsk_xyz'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('kills all running tasks when --all is present', async () => {
    mockGetRunningTasks.mockReturnValue([
      { id: 'tsk_aaa' },
      { id: 'tsk_bbb' },
    ]);
    await handleKill(['--all']);
    expect(mockKillTask).toHaveBeenCalledTimes(2);
    expect(mockKillTask).toHaveBeenCalledWith('tsk_aaa');
    expect(mockKillTask).toHaveBeenCalledWith('tsk_bbb');
  });

  it('shows "No running tasks" when --all but nothing running', async () => {
    await handleKill(['--all']);
    expect(consoleLogSpy).toHaveBeenCalledWith('No running tasks found.');
  });

  // Edge cases: ESRCH handling, process not found
  it('ESRCH: exits with 1 and shows message when killTask returns ESRCH-style message', async () => {
    mockKillTask.mockReturnValue({ ok: false, message: 'ESRCH: no such process (pid 9999)' });
    await expect(handleKill(['tsk_dead'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ESRCH'));
  });

  it('process not found: shows error message and exits with 1', async () => {
    mockKillTask.mockReturnValue({ ok: false, message: 'Task not found: tsk_missing' });
    await expect(handleKill(['tsk_missing'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found'));
  });
});
