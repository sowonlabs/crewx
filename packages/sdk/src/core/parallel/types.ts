/**
 * Represents a unit of work that can be executed by the ParallelRunner.
 */
export interface Task<T> {
  /**
   * Unique identifier for the task. Used for logging/metrics.
   */
  id: string;
  /**
   * Optional metadata associated with the task. Consumers can store any
   * contextual data required by callbacks (e.g., agent information).
   */
  metadata?: Record<string, unknown>;
  /**
   * Function that performs the actual work and returns a promise with the
   * result. Implementations should respect the provided execution context
   * (e.g., abort signal) to support timeouts and cooperative cancellation.
   */
  run: (context: TaskExecutionContext) => Promise<T>;
}

/**
 * Context information passed to each task during execution.
 */
export interface TaskExecutionContext {
  /**
   * Abort signal triggered when the runner times out the task or stops
   * further processing. Implementations should short-circuit when aborted to
   * avoid doing unnecessary work.
   */
  signal: AbortSignal;
}

/**
 * Result produced by the ParallelRunner for each executed task.
 */
export interface TaskResult<T> {
  taskId: string;
  success: boolean;
  value?: T;
  error?: Error;
  /** Time spent executing the task in milliseconds. */
  durationMs: number;
  /** Timestamp (performance.now) when the task started. */
  startedAt: number;
  /** Timestamp (performance.now) when the task finished. */
  finishedAt: number;
  /** Metadata forwarded from the original task definition. */
  metadata?: Record<string, unknown>;
  /** Indicates whether the failure was caused by an abort/timeout event. */
  aborted?: boolean;
}

/**
 * Callback hooks that allow consumers to integrate logging and telemetry
 * without coupling the runner to specific frameworks.
 */
export interface TaskCallbacks<T> {
  onTaskStart?: (task: Task<T>) => void | Promise<void>;
  onTaskComplete?: (result: TaskResult<T>) => void | Promise<void>;
  onError?: (task: Task<T>, error: Error, durationMs: number) => void | Promise<void>;
}

/**
 * Execution options for the ParallelRunner.
 */
export interface ParallelRunnerOptions<T = unknown> {
  /** Maximum number of concurrent tasks. Defaults to 5. */
  maxConcurrency?: number;
  /** Timeout in milliseconds for each task. Undefined disables timeout. */
  timeoutMs?: number;
  /** When true, stop scheduling new tasks once a failure occurs. */
  failFast?: boolean;
  /** Optional callback hooks for instrumentation. */
  callbacks?: TaskCallbacks<T>;
  /**
   * Determines whether a resolved task result should be considered successful.
   * Defaults to treating every resolved value as success.
   */
  evaluateTaskSuccess?: (value: T, task: Task<T>) => boolean;
}

/**
 * Metrics summary produced after a run.
 */
export interface ParallelRunnerMetrics {
  totalTasks: number;
  startedTasks: number;
  completedTasks: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  averageDurationMs: number;
  throughput: number;
}
