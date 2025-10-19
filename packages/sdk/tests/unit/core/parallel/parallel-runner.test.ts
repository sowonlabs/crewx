import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  ParallelRunner,
  ParallelRunnerTimeoutError,
  type Task,
  type TaskExecutionContext,
} from '../../../../src/core/parallel';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createAbortAwareTask = <T>(
  id: string,
  work: (context: TaskExecutionContext) => Promise<T>,
): Task<T> => ({
  id,
  run: async (context) => {
    const abortPromise = new Promise<never>((_, reject) => {
      if (context.signal.aborted) {
        const reason = context.signal.reason instanceof Error
          ? context.signal.reason
          : new Error('aborted');
        reject(reason);
        return;
      }

      context.signal.addEventListener(
        'abort',
        () => {
          const reason = context.signal.reason instanceof Error
            ? context.signal.reason
            : new Error('aborted');
          reject(reason);
        },
        { once: true },
      );
    });

    const resultPromise = work(context);

    try {
      return await Promise.race([resultPromise, abortPromise]);
    } finally {
      resultPromise.catch(() => undefined);
    }
  },
});

describe('ParallelRunner', () => {
  let runner: ParallelRunner;

  beforeEach(() => {
    runner = new ParallelRunner();
  });

  it('executes tasks respecting concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    const tasks = Array.from({ length: 5 }, (_, index) =>
      createAbortAwareTask(`task-${index}`, async () => {
        active += 1;
        peak = Math.max(peak, active);
        await delay(20);
        active -= 1;
        return { success: true };
      }),
    );

    const results = await runner.run(tasks, {
      maxConcurrency: 2,
      evaluateTaskSuccess: (value) => value.success,
    });

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.success)).toBe(true);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('stops scheduling new tasks when failFast is enabled', async () => {
    const executionOrder: string[] = [];
    const tasks: Task<{ success: boolean }>[] = [
      createAbortAwareTask('task-1', async () => {
        executionOrder.push('task-1');
        await delay(5);
        return { success: true };
      }),
      createAbortAwareTask('task-2', async () => {
        executionOrder.push('task-2');
        return { success: false };
      }),
      createAbortAwareTask('task-3', async () => {
        executionOrder.push('task-3');
        return { success: true };
      }),
    ];

    const results = await runner.run(tasks, {
      maxConcurrency: 1,
      failFast: true,
      evaluateTaskSuccess: (value) => value.success,
    });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(executionOrder).toEqual(['task-1', 'task-2']);
  });

  it('produces timeout errors when a task exceeds the limit', async () => {
    const timeoutRunner = new ParallelRunner();
    const tasks = [
      createAbortAwareTask('slow-task', async () => {
        await delay(100);
        return { success: true };
      }),
    ];

    const results = await timeoutRunner.run(tasks, {
      timeoutMs: 10,
      evaluateTaskSuccess: (value) => value.success,
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeInstanceOf(ParallelRunnerTimeoutError);
  });

  it('records metrics for completed runs', async () => {
    const tasks = [
      createAbortAwareTask('a', async () => {
        await delay(5);
        return { success: true };
      }),
      createAbortAwareTask('b', async () => {
        await delay(5);
        return { success: true };
      }),
    ];

    const results = await runner.run(tasks, {
      evaluateTaskSuccess: (value) => value.success,
    });

    expect(results.every((item) => item.success)).toBe(true);

    const metrics = runner.getMetrics();
    expect(metrics.totalTasks).toBe(2);
    expect(metrics.completedTasks).toBe(2);
    expect(metrics.successCount).toBe(2);
    expect(metrics.failureCount).toBe(0);
    expect(metrics.totalDurationMs).toBeGreaterThan(0);
    expect(metrics.averageDurationMs).toBeGreaterThan(0);
    expect(metrics.throughput).toBeGreaterThan(0);
  });

  it('invokes callbacks for task lifecycle events', async () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const successTask = createAbortAwareTask('success', async () => {
      return { success: true };
    });

    const failTask = createAbortAwareTask('failure', async () => {
      throw new Error('boom');
    });

    const results = await runner.run([successTask, failTask], {
      evaluateTaskSuccess: (value) => value.success,
      callbacks: { onTaskStart: onStart, onTaskComplete: onComplete, onError },
    });

    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});
