import { ParallelRunner } from './parallel-runner';
import type {
  ParallelRunnerMetrics,
  Task,
  TaskCallbacks,
  TaskResult,
} from './types';
import {
  AgentRuntime,
  type AgentQueryRequest,
  type AgentExecuteRequest,
  type AgentResult,
} from '../agent';

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 500;

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
}

export interface ParallelConfig {
  concurrency?: number;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  onProgress?: (completed: number, total: number) => void;
  onComplete?: (result: HelperResult<AgentResult>) => void;
}

export interface HelperResult<T = AgentResult> {
  total: number;
  completed: number;
  successCount: number;
  failureCount: number;
  results: T[];
  errors: Array<{ index: number; error: Error }>;
  metrics: ParallelRunnerMetrics;
}

type OperationMode = 'query' | 'execute';

interface TaskMetadata<T extends AgentQueryRequest | AgentExecuteRequest> {
  index: number;
  mode: OperationMode;
  request: T;
}

const normalizeConcurrency = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_CONCURRENCY;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : DEFAULT_CONCURRENCY;
};

const normalizeTimeout = (value: number | undefined): number | undefined => {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return value;
};

const normalizeRetryPolicy = (policy?: RetryPolicy): RetryPolicy => {
  if (!policy) {
    return { maxRetries: 0, retryDelay: DEFAULT_RETRY_DELAY_MS };
  }

  const maxRetries = Number.isInteger(policy.maxRetries) && policy.maxRetries >= 0
    ? policy.maxRetries
    : 0;
  const retryDelay = typeof policy.retryDelay === 'number' && policy.retryDelay >= 0
    ? policy.retryDelay
    : DEFAULT_RETRY_DELAY_MS;

  return { maxRetries, retryDelay };
};

const createAbortError = (signal: AbortSignal): Error => {
  const reason = signal.reason;
  if (reason instanceof Error) {
    return reason;
  }
  if (typeof reason === 'string') {
    return new Error(reason);
  }
  return new Error('Parallel operation aborted');
};

const waitForDelay = (delayMs: number, signal: AbortSignal): Promise<void> => {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError(signal));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
};

const executeWithRetry = async (
  execute: () => Promise<AgentResult>,
  retryPolicy: RetryPolicy,
  signal: AbortSignal,
): Promise<AgentResult> => {
  let lastFailureResult: AgentResult | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt += 1) {
    if (signal.aborted) {
      throw createAbortError(signal);
    }

    try {
      const result = await execute();
      lastFailureResult = result;

      if (result.success || attempt === retryPolicy.maxRetries) {
        return result;
      }
    } catch (error) {
      lastError = error;

      if (signal.aborted) {
        throw createAbortError(signal);
      }

      if (attempt === retryPolicy.maxRetries) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        throw normalizedError;
      }
    }

    if (attempt < retryPolicy.maxRetries) {
      await waitForDelay(retryPolicy.retryDelay, signal);
    }
  }

  if (lastFailureResult) {
    return lastFailureResult;
  }

  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  throw new Error('Parallel helper encountered an unexpected state');
};

const recordProgress = (
  callbacks: ParallelConfig,
  state: { completed: number; success: number; failure: number; total: number },
  wasSuccessful: boolean,
) => {
  state.completed += 1;
  if (wasSuccessful) {
    state.success += 1;
  } else {
    state.failure += 1;
  }

  try {
    callbacks.onProgress?.(state.completed, state.total);
  } catch (error) {
    // Avoid surfacing progress callback errors to callers.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Parallel helper onProgress callback threw an error:', error);
    }
  }
};

const mapResults = <T extends AgentQueryRequest | AgentExecuteRequest>(
  taskResults: TaskResult<AgentResult>[],
) => {
  return taskResults.map((taskResult) => ({
    metadata: taskResult.metadata as unknown as TaskMetadata<T>,
    taskResult,
  }));
};

const buildAgentResults = <T extends AgentQueryRequest | AgentExecuteRequest>(
  decoratedResults: ReturnType<typeof mapResults<T>>,
) => {
  const ordered = decoratedResults.slice().sort((a, b) => a.metadata.index - b.metadata.index);

  return ordered.map(({ metadata, taskResult }) => {
    if (taskResult.value) {
      const baseResult = taskResult.value;
      return {
        ...baseResult,
        agentId: baseResult.agentId ?? metadata.request.agentId,
        metadata: {
          ...baseResult.metadata,
          requestIndex: metadata.index,
          mode: metadata.mode,
        },
      } satisfies AgentResult;
    }

    const error = taskResult.error ?? new Error('Unknown error');
    return {
      agentId: metadata.request.agentId,
      content: error.message,
      success: false,
      metadata: {
        error: error.message,
        aborted: taskResult.aborted ?? false,
        requestIndex: metadata.index,
        mode: metadata.mode,
      },
    } satisfies AgentResult;
  });
};

const collectErrors = <T extends AgentQueryRequest | AgentExecuteRequest>(
  decoratedResults: ReturnType<typeof mapResults<T>>,
) => {
  return decoratedResults
    .filter(({ taskResult }) => !taskResult.success)
    .map(({ metadata, taskResult }) => {
      if (taskResult.error instanceof Error) {
        return { index: metadata.index, error: taskResult.error };
      }

      if (taskResult.value && !taskResult.value.success) {
        const errorMessage = taskResult.value.metadata?.error
          ?? taskResult.value.content
          ?? 'Agent returned unsuccessful result';
        return { index: metadata.index, error: new Error(errorMessage) };
      }

      return { index: metadata.index, error: new Error('Unknown failure') };
    });
};

const createCallbacks = (
  progressState: { completed: number; success: number; failure: number; total: number },
  config: ParallelConfig,
): TaskCallbacks<AgentResult> => ({
  onTaskComplete: async (result) => {
    recordProgress(config, progressState, result.success);
  },
  onError: async () => {
    recordProgress(config, progressState, false);
  },
});

const runAgentOperations = async <T extends AgentQueryRequest | AgentExecuteRequest>(
  requests: T[],
  mode: OperationMode,
  config: ParallelConfig = {},
): Promise<AgentResult[]> => {
  if (!Array.isArray(requests)) {
    throw new TypeError('Parallel helpers expect an array of requests');
  }

  if (requests.length === 0) {
    const emptyMetrics: ParallelRunnerMetrics = {
      totalTasks: 0,
      startedTasks: 0,
      completedTasks: 0,
      successCount: 0,
      failureCount: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
      throughput: 0,
    };

    const summary: HelperResult<AgentResult> = {
      total: 0,
      completed: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      errors: [],
      metrics: emptyMetrics,
    };

    config.onComplete?.(summary);
    return [];
  }

  const concurrency = normalizeConcurrency(config.concurrency);
  const timeout = normalizeTimeout(config.timeout);
  const retryPolicy = normalizeRetryPolicy(config.retryPolicy);

  const runner = new ParallelRunner();
  const runtime = new AgentRuntime();

  const runSingleOperation = (request: T) => (mode === 'query'
    ? runtime.query(request as AgentQueryRequest)
    : runtime.execute(request as AgentExecuteRequest)
  );

  const tasks: Task<AgentResult>[] = requests.map((request, index) => ({
    id: `${mode}:${request.agentId ?? 'anonymous'}:${index}`,
    metadata: { index, mode, request } as unknown as Record<string, unknown>,
    run: (context) => executeWithRetry(
      () => runSingleOperation(request),
      retryPolicy,
      context.signal,
    ),
  }));

  const progressState = {
    completed: 0,
    success: 0,
    failure: 0,
    total: requests.length,
  };

  const runnerOptions = {
    maxConcurrency: concurrency,
    timeoutMs: timeout,
    evaluateTaskSuccess: (value: AgentResult) => value.success,
    callbacks: createCallbacks(progressState, config),
  };

  const taskResults = await runner.run(tasks, runnerOptions);
  const decoratedResults = mapResults<T>(taskResults);
  const agentResults = buildAgentResults<T>(decoratedResults);
  const errors = collectErrors<T>(decoratedResults);
  const metrics = runner.getMetrics();

  const summary: HelperResult<AgentResult> = {
    total: requests.length,
    completed: requests.length,
    successCount: agentResults.filter((item) => item.success).length,
    failureCount: agentResults.filter((item) => !item.success).length,
    results: agentResults,
    errors,
    metrics,
  };

  config.onComplete?.(summary);

  return agentResults;
};

export const runQueriesParallel = (
  queries: AgentQueryRequest[],
  config?: ParallelConfig,
): Promise<AgentResult[]> => runAgentOperations(queries, 'query', config);

export const runExecutesParallel = (
  requests: AgentExecuteRequest[],
  config?: ParallelConfig,
): Promise<AgentResult[]> => runAgentOperations(requests, 'execute', config);
