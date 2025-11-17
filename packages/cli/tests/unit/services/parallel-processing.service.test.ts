import { describe, expect, it, vi } from 'vitest';

import { ParallelProcessingService } from '../../../src/services/parallel-processing.service';
import type { AIResponse } from '../../../src/ai.service';
import type { ParallelRunner, ParallelRunnerMetrics, Task, TaskResult } from '@sowonai/crewx-sdk';

const createAbortContext = () => ({ signal: new AbortController().signal });

describe('ParallelProcessingService', () => {
  const createMocks = () => {
    const aiService = {
      queryAI: vi.fn<[], Promise<AIResponse>>().mockResolvedValue({
        content: 'ok',
        provider: 'claude',
        command: 'claude -p',
        success: true,
      } as AIResponse),
      executeAI: vi.fn(),
    };

    const taskManagementService = {
      createTask: vi.fn().mockReturnValue('task-123'),
      addTaskLog: vi.fn(),
      completeTask: vi.fn(),
    };

    const configService = {
      getAgentConfig: vi.fn().mockReturnValue({
        inline: { provider: 'cli/claude' },
        options: {},
      }),
    };

    return { aiService, taskManagementService, configService };
  };

  const buildService = () => {
    const mocks = createMocks();
    const service = new ParallelProcessingService(
      mocks.aiService as any,
      mocks.taskManagementService as any,
      mocks.configService as any,
    );
    return { service, mocks };
  };

  it('executes parallel requests through the SDK runner and returns aggregated results', async () => {
    const { service, mocks } = buildService();

    const runMock = vi.fn(async (tasks: Task<AIResponse>[], options: any) => {
      const results: TaskResult<AIResponse>[] = [];
      for (const task of tasks) {
        await options.callbacks?.onTaskStart?.(task);
        const value = await task.run(createAbortContext());
        const success = options.evaluateTaskSuccess?.(value, task) ?? true;
        const result: TaskResult<AIResponse> = {
          taskId: task.id,
          success,
          value,
          durationMs: 5,
          startedAt: 0,
          finishedAt: 5,
          metadata: task.metadata,
        };
        await options.callbacks?.onTaskComplete?.(result);
        results.push(result);
      }
      return results;
    });

    const metrics: ParallelRunnerMetrics = {
      totalTasks: 1,
      startedTasks: 1,
      completedTasks: 1,
      successCount: 1,
      failureCount: 0,
      totalDurationMs: 5,
      averageDurationMs: 5,
      throughput: 200,
    };

    const getMetricsMock = vi.fn(() => metrics);

    (service as any).parallelRunner = {
      run: runMock,
      getMetrics: getMetricsMock,
    } as unknown as ParallelRunner;

    const response = await service.executeParallel([
      {
        agentId: 'agent-A',
        query: 'hello',
      },
    ]);

    expect(runMock).toHaveBeenCalledOnce();
    expect(mocks.aiService.queryAI).toHaveBeenCalledWith(
      'hello',
      'cli/claude',
      expect.objectContaining({ additionalArgs: [], agentId: 'agent-A' }),
    );
    expect(mocks.taskManagementService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-A', provider: 'cli/claude' }),
    );
    expect(mocks.taskManagementService.completeTask).toHaveBeenCalledWith(
      'task-123',
      expect.objectContaining({ success: true }),
      true,
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({
      agentId: 'agent-A',
      success: true,
      taskId: 'task-123',
    });
    expect(response.summary).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      totalDuration: 5,
      averageDuration: 5,
    });
  });

  it('propagates runner errors and records task failures', async () => {
    const { service, mocks } = buildService();

    const runMock = vi.fn(async (tasks: Task<AIResponse>[], options: any) => {
      const [task] = tasks;
      await options.callbacks?.onTaskStart?.(task);
      const error = new Error('boom');
      await options.callbacks?.onError?.(task, error, 7);
      const result: TaskResult<AIResponse> = {
        taskId: task.id,
        success: false,
        error,
        durationMs: 7,
        startedAt: 0,
        finishedAt: 7,
        metadata: task.metadata,
      };
      return [result];
    });

    const metrics: ParallelRunnerMetrics = {
      totalTasks: 1,
      startedTasks: 1,
      completedTasks: 1,
      successCount: 0,
      failureCount: 1,
      totalDurationMs: 7,
      averageDurationMs: 7,
      throughput: 142.857,
    };

    const getMetricsMock = vi.fn(() => metrics);

    (service as any).parallelRunner = {
      run: runMock,
      getMetrics: getMetricsMock,
    } as unknown as ParallelRunner;

    const response = await service.executeParallel([
      {
        agentId: 'agent-B',
        query: 'failing task',
      },
    ]);

    expect(runMock).toHaveBeenCalledOnce();
    expect(mocks.taskManagementService.completeTask).toHaveBeenCalledWith(
      'task-123',
      { error: 'boom' },
      false,
    );

    expect(response.results[0]).toMatchObject({
      agentId: 'agent-B',
      success: false,
      error: 'boom',
      duration: 7,
    });
    expect(response.summary.failed).toBe(1);
  });
});
