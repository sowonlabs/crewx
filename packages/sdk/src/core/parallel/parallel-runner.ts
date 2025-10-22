import { performance } from 'node:perf_hooks';

import type {
  ParallelRunnerMetrics,
  ParallelRunnerOptions,
  Task,
  TaskResult,
  TaskCallbacks,
  TaskExecutionContext,
} from './types';

/**
 * Error raised when a task exceeds the configured timeout.
 */
export class ParallelRunnerTimeoutError extends Error {
  constructor(public readonly taskId: string, public readonly timeoutMs: number) {
    super(`Task ${taskId} timed out after ${timeoutMs}ms`);
    this.name = 'ParallelRunnerTimeoutError';
  }
}

/**
 * Parallel runner responsible for executing tasks with bounded concurrency and
 * cooperative cancellation support. The implementation is framework-agnostic
 * so it can be reused by the CLI package and any future consumers of the SDK.
 */
export class ParallelRunner {
  private metrics: ParallelRunnerMetrics = {
    totalTasks: 0,
    startedTasks: 0,
    completedTasks: 0,
    successCount: 0,
    failureCount: 0,
    totalDurationMs: 0,
    averageDurationMs: 0,
    throughput: 0,
  };

  constructor(private readonly defaults: ParallelRunnerOptions = {}) {}

  async run<T>(tasks: Task<T>[], options: ParallelRunnerOptions<T> = {}): Promise<TaskResult<T>[]> {
    if (!Array.isArray(tasks)) {
      throw new TypeError('ParallelRunner.run expects an array of tasks');
    }

    if (tasks.length === 0) {
      this.metrics = {
        totalTasks: 0,
        startedTasks: 0,
        completedTasks: 0,
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
        averageDurationMs: 0,
        throughput: 0,
      };
      return [];
    }

    const merged = this.mergeOptions(options);
    const maxConcurrency = Math.max(1, merged.maxConcurrency ?? 5);
    const timeoutMs = merged.timeoutMs;
    const failFast = merged.failFast ?? false;
    const callbacks = merged.callbacks;
    const evaluateTaskSuccess = merged.evaluateTaskSuccess ?? (() => true);

    const results: TaskResult<T>[] = [];
    let successCount = 0;
    let failureCount = 0;
    let startedTasks = 0;
    let aborted = false;
    let cursor = 0;

    const startedAt = performance.now();

    const executeTask = async (task: Task<T>): Promise<void> => {
      if (callbacks?.onTaskStart) {
        await callbacks.onTaskStart(task);
      }

      startedTasks += 1;
      const controller = new AbortController();
      const context: TaskExecutionContext = { signal: controller.signal };

      let timeoutId: NodeJS.Timeout | undefined;
      let timeoutPromise: Promise<never> | undefined;

      if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            const timeoutError = new ParallelRunnerTimeoutError(task.id, timeoutMs);
            controller.abort(timeoutError);
            reject(timeoutError);
          }, timeoutMs);
        });
      }

      const startedAtTask = performance.now();
      const runPromise = task.run(context);
      const combinedPromise = timeoutPromise
        ? Promise.race([runPromise, timeoutPromise])
        : runPromise;

      try {
        const value = await combinedPromise;
        const finishedAtTask = performance.now();
        const durationMs = finishedAtTask - startedAtTask;
        const success = evaluateTaskSuccess(value, task);

        const result: TaskResult<T> = {
          taskId: task.id,
          success,
          value,
          durationMs,
          startedAt: startedAtTask,
          finishedAt: finishedAtTask,
          metadata: task.metadata,
          aborted: false,
        };

        results.push(result);
        success ? (successCount += 1) : (failureCount += 1);

        if (callbacks?.onTaskComplete) {
          await callbacks.onTaskComplete(result);
        }

        if (failFast && !success) {
          aborted = true;
        }
      } catch (rawError) {
        const finishedAtTask = performance.now();
        const durationMs = finishedAtTask - startedAtTask;
        const error = rawError instanceof Error ? rawError : new Error(String(rawError));

        const result: TaskResult<T> = {
          taskId: task.id,
          success: false,
          error,
          durationMs,
          startedAt: startedAtTask,
          finishedAt: finishedAtTask,
          metadata: task.metadata,
          aborted: controller.signal.aborted,
        };

        results.push(result);
        failureCount += 1;

        if (callbacks?.onError) {
          await callbacks.onError(task, error, durationMs);
        }

        if (failFast) {
          aborted = true;
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Prevent unhandled rejections if the timeout fired before the task finished.
        if (timeoutPromise) {
          runPromise.catch(() => undefined);
        }
      }
    };

    const worker = async (): Promise<void> => {
      while (true) {
        if (aborted) {
          break;
        }

        const currentIndex = cursor;
        if (currentIndex >= tasks.length) {
          break;
        }
        cursor += 1;

        const task = tasks[currentIndex];
        if (!task) {
          break;
        }

        await executeTask(task);

        if (aborted) {
          break;
        }
      }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(maxConcurrency, tasks.length);
    for (let i = 0; i < workerCount; i += 1) {
      workers.push(worker());
    }

    await Promise.all(workers);

    const finishedAt = performance.now();
    const totalDurationMs = finishedAt - startedAt;
    const averageDurationMs = results.length
      ? results.reduce((sum, item) => sum + item.durationMs, 0) / results.length
      : 0;
    const throughput = totalDurationMs > 0
      ? (results.length / (totalDurationMs / 1000))
      : results.length;

    this.metrics = {
      totalTasks: tasks.length,
      startedTasks,
      completedTasks: results.length,
      successCount,
      failureCount,
      totalDurationMs,
      averageDurationMs,
      throughput,
    };

    return results;
  }

  getMetrics(): ParallelRunnerMetrics {
    return this.metrics;
  }

  private mergeOptions<T>(options: ParallelRunnerOptions<T>): ParallelRunnerOptions<T> {
    return {
      maxConcurrency: options.maxConcurrency ?? this.defaults.maxConcurrency,
      timeoutMs: options.timeoutMs ?? this.defaults.timeoutMs,
      failFast: options.failFast ?? this.defaults.failFast,
      evaluateTaskSuccess: options.evaluateTaskSuccess ?? this.defaults.evaluateTaskSuccess,
      callbacks: this.mergeCallbacks(
        this.defaults.callbacks as TaskCallbacks<T> | undefined,
        options.callbacks,
      ),
    };
  }

  private mergeCallbacks<T>(
    base?: TaskCallbacks<T>,
    override?: TaskCallbacks<T>,
  ): TaskCallbacks<T> | undefined {
    if (!base && !override) {
      return undefined;
    }

    return {
      onTaskStart: async (task: Task<T>) => {
        if (base?.onTaskStart) {
          await base.onTaskStart(task);
        }
        if (override?.onTaskStart) {
          await override.onTaskStart(task);
        }
      },
      onTaskComplete: async (result: TaskResult<T>) => {
        if (base?.onTaskComplete) {
          await base.onTaskComplete(result);
        }
        if (override?.onTaskComplete) {
          await override.onTaskComplete(result);
        }
      },
      onError: async (task: Task<T>, error: Error, durationMs: number) => {
        if (base?.onError) {
          await base.onError(task, error, durationMs);
        }
        if (override?.onError) {
          await override.onError(task, error, durationMs);
        }
      },
    };
  }
}

/**
 * Convenience factory that creates a runner with default configuration.
 */
export const createDefaultParallelRunner = (): ParallelRunner => new ParallelRunner();
