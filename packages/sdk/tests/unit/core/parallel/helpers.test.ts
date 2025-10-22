import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  runQueriesParallel,
  runExecutesParallel,
  type HelperResult,
} from '../../../../src/core/parallel';
import { AgentRuntime, type AgentResult } from '../../../../src/core/agent';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createAgentResult = (overrides: Partial<AgentResult> = {}): AgentResult => ({
  content: overrides.content ?? 'ok',
  success: overrides.success ?? true,
  agentId: overrides.agentId,
  metadata: {
    ...(overrides.metadata ?? {}),
  },
});

describe('Parallel helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes query requests and preserves input order', async () => {
    const spy = vi.spyOn(AgentRuntime.prototype, 'query').mockImplementationOnce(async (request) => {
      await delay(15);
      return createAgentResult({ content: `A:${request.prompt}`, agentId: request.agentId });
    }).mockImplementationOnce(async (request) => {
      await delay(5);
      return createAgentResult({ content: `B:${request.prompt}`, agentId: request.agentId });
    }).mockImplementation(async (request) => {
      return createAgentResult({ content: `C:${request.prompt}`, agentId: request.agentId });
    });

    const queries = [
      { agentId: 'alpha', prompt: 'first' },
      { agentId: 'beta', prompt: 'second' },
      { agentId: 'gamma', prompt: 'third' },
    ];

    const results = await runQueriesParallel(queries, { concurrency: 2 });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(results.map((item) => item.agentId)).toEqual(['alpha', 'beta', 'gamma']);
    expect(results.map((item) => item.content)).toEqual(['A:first', 'B:second', 'C:third']);
  });

  it('executes write requests using the execute path', async () => {
    const executeSpy = vi.spyOn(AgentRuntime.prototype, 'execute').mockImplementation(async (request) => {
      await delay(2);
      return createAgentResult({ content: `EXEC:${request.prompt}`, agentId: request.agentId });
    });
    const querySpy = vi.spyOn(AgentRuntime.prototype, 'query');

    const tasks = [
      { agentId: 'writer', prompt: 'plan release' },
      { agentId: 'writer', prompt: 'draft doc' },
    ];

    const results = await runExecutesParallel(tasks, { concurrency: 1 });

    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(querySpy).not.toHaveBeenCalled();
    expect(results.every((item) => item.content.startsWith('EXEC:'))).toBe(true);
  });

  it('enforces concurrency limit for query operations', async () => {
    let active = 0;
    let peak = 0;

    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(20);
      active -= 1;
      return createAgentResult();
    });

    const queries = Array.from({ length: 6 }, (_, index) => ({ agentId: `agent-${index}`, prompt: `${index}` }));

    await runQueriesParallel(queries, { concurrency: 2 });

    expect(peak).toBeLessThanOrEqual(2);
  });

  it('returns empty array for empty input and does not invoke runtime', async () => {
    const spy = vi.spyOn(AgentRuntime.prototype, 'query');
    const onComplete = vi.fn();

    const results = await runQueriesParallel([], { onComplete });

    expect(results).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({
      total: 0,
      completed: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      errors: [],
      metrics: expect.objectContaining({ totalTasks: 0 }),
    } satisfies HelperResult<AgentResult>);
  });

  it('marks tasks as failed when exceeding timeout', async () => {
    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => {
      await delay(50);
      return createAgentResult();
    });

    const [result] = await runQueriesParallel(
      [{ agentId: 'slow', prompt: 'timeout test' }],
      { timeout: 10 },
    );

    expect(result.success).toBe(false);
    expect(result.metadata?.error).toMatch(/timed out/);
    expect(result.content).toMatch(/timed out/);
  });

  it('retries failed query operations according to retry policy', async () => {
    const attempts: number[] = [];

    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => {
      attempts.push(Date.now());
      if (attempts.length < 3) {
        throw new Error('temporary failure');
      }
      return createAgentResult({ content: 'success on third attempt' });
    });

    const [result] = await runQueriesParallel(
      [{ agentId: 'retry', prompt: 'retry me' }],
      { retryPolicy: { maxRetries: 3, retryDelay: 1 } },
    );

    expect(attempts.length).toBe(3);
    expect(result.success).toBe(true);
    expect(result.content).toBe('success on third attempt');
  });

  it('stops retrying after max attempts and reports failure', async () => {
    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => {
      throw new Error('permanent failure');
    });

    const [result] = await runQueriesParallel(
      [{ agentId: 'retry-fail', prompt: 'still fail' }],
      { retryPolicy: { maxRetries: 1, retryDelay: 1 } },
    );

    expect(result.success).toBe(false);
    expect(result.content).toBe('permanent failure');
  });

  it('invokes progress callback for each completed query', async () => {
    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => createAgentResult());
    const onProgress = vi.fn();

    await runQueriesParallel(
      [
        { agentId: 'p1', prompt: 'one' },
        { agentId: 'p2', prompt: 'two' },
      ],
      { onProgress },
    );

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('provides helper summary via onComplete', async () => {
    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async (request) =>
      createAgentResult({ agentId: request.agentId }),
    );

    const onComplete = vi.fn();

    await runQueriesParallel(
      [
        { agentId: 'summary-1', prompt: 'a' },
        { agentId: 'summary-2', prompt: 'b' },
      ],
      { onComplete },
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
    const summary = onComplete.mock.calls[0][0] as HelperResult<AgentResult>;
    expect(summary.total).toBe(2);
    expect(summary.successCount).toBe(2);
    expect(summary.failureCount).toBe(0);
    expect(summary.metrics.totalTasks).toBe(2);
  });

  it('annotates results with operation metadata', async () => {
    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async (request) =>
      createAgentResult({ agentId: request.agentId }),
    );

    const [result] = await runQueriesParallel([
      { agentId: 'meta', prompt: 'check meta', context: 'ctx' },
    ]);

    expect(result.metadata?.mode).toBe('query');
    expect(result.metadata?.requestIndex).toBe(0);
  });

  it('handles partial failures for execute operations', async () => {
    vi.spyOn(AgentRuntime.prototype, 'execute')
      .mockImplementationOnce(async () => createAgentResult({ content: 'ok', success: true }))
      .mockImplementationOnce(async () => {
        throw new Error('boom');
      });

    const results = await runExecutesParallel([
      { agentId: 'writer', prompt: 'task 1' },
      { agentId: 'writer', prompt: 'task 2' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].content).toBe('boom');
  });

  it('enforces concurrency limit for execute operations', async () => {
    let active = 0;
    let peak = 0;

    vi.spyOn(AgentRuntime.prototype, 'execute').mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(15);
      active -= 1;
      return createAgentResult();
    });

    const tasks = Array.from({ length: 5 }, (_, index) => ({ agentId: `exec-${index}`, prompt: `${index}` }));

    await runExecutesParallel(tasks, { concurrency: 2 });

    expect(peak).toBeLessThanOrEqual(2);
  });

  it('propagates metadata returned by runtime execute', async () => {
    vi.spyOn(AgentRuntime.prototype, 'execute').mockImplementation(async () =>
      createAgentResult({ metadata: { origin: 'runtime' }, success: true }),
    );

    const [result] = await runExecutesParallel([
      { agentId: 'writer', prompt: 'metadata' },
    ]);

    expect(result.metadata?.origin).toBe('runtime');
    expect(result.metadata?.mode).toBe('execute');
  });

  it('retries execute operations when runtime reports failure', async () => {
    let attempt = 0;

    vi.spyOn(AgentRuntime.prototype, 'execute').mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) {
        return createAgentResult({ success: false, content: 'not yet' });
      }
      return createAgentResult({ success: true, content: 'now ok' });
    });

    const [result] = await runExecutesParallel(
      [{ agentId: 'writer', prompt: 'fix me' }],
      { retryPolicy: { maxRetries: 2, retryDelay: 1 } },
    );

    expect(attempt).toBe(2);
    expect(result.success).toBe(true);
    expect(result.content).toBe('now ok');
  });

  it('defaults concurrency to safe value when invalid', async () => {
    let active = 0;
    let peak = 0;

    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(10);
      active -= 1;
      return createAgentResult();
    });

    const queries = Array.from({ length: 5 }, (_, index) => ({ agentId: `agent-${index}`, prompt: `${index}` }));

    await runQueriesParallel(queries, { concurrency: 0 });

    expect(peak).toBeLessThanOrEqual(3);
  });

  it('reflects timeout errors for execute operations in helper summary', async () => {
    vi.spyOn(AgentRuntime.prototype, 'execute').mockImplementation(async () => {
      await delay(30);
      return createAgentResult();
    });

    const onComplete = vi.fn();

    const results = await runExecutesParallel(
      [{ agentId: 'slow-exec', prompt: 'long task' }],
      { timeout: 10, onComplete },
    );

    expect(results[0].success).toBe(false);
    expect(results[0].content).toMatch(/timed out/);
    const summary = onComplete.mock.calls[0][0] as HelperResult<AgentResult>;
    expect(summary.failureCount).toBe(1);
    expect(summary.errors[0].error).toBeInstanceOf(Error);
    expect(summary.metrics.totalTasks).toBe(1);
  });

  it('does not treat progress callback errors as fatal', async () => {
    vi.spyOn(AgentRuntime.prototype, 'query').mockImplementation(async () => createAgentResult());
    const onProgress = vi.fn(() => {
      throw new Error('progress failure');
    });

    const results = await runQueriesParallel(
      [
        { agentId: 'safe-1', prompt: 'x' },
        { agentId: 'safe-2', prompt: 'y' },
      ],
      { onProgress },
    );

    expect(results).toHaveLength(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });
});
