import { Injectable, Logger } from '@nestjs/common';
import {
  createDefaultParallelRunner,
  getTimeoutConfig,
  ParallelRunner,
  ParallelRunnerTimeoutError,
  type ParallelRunnerOptions,
  type Task,
  type TaskCallbacks,
  type TaskResult,
} from '@sowonai/crewx-sdk';

import { AIService, type AIResponse } from '../ai.service';
import { TaskManagementService } from './task-management.service';
import { ConfigService } from './config.service';

// Result interface for individual agent executions
interface AgentExecutionResult {
  agentId: string;
  success: boolean;
  result?: AIResponse;
  error?: string;
  duration: number;
  taskId?: string;
}

// Request interface for parallel processing
interface ParallelProcessingRequest {
  agentId: string;
  query?: string;
  task?: string;
  context?: string;
  projectPath?: string;
  messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
  platform?: 'slack' | 'cli';
}

// Configuration for parallel processing
interface ParallelProcessingConfig {
  maxConcurrency?: number;
  timeout?: number;
  failFast?: boolean;
}

type ProviderName = 'claude' | 'gemini' | 'copilot' | 'codex';

type AgentExecutionMode = 'query' | 'execute';

interface ParallelTaskMetadata extends Record<string, unknown> {
  request: ParallelProcessingRequest;
  provider: ProviderName;
  agentOptions: string[];
  mode: AgentExecutionMode;
  index: number;
  taskId?: string;
}

@Injectable()
export class ParallelProcessingService {
  private readonly logger = new Logger(ParallelProcessingService.name);
  private readonly timeoutConfig = getTimeoutConfig();
  private readonly parallelRunner: ParallelRunner = createDefaultParallelRunner();

  constructor(
    private readonly aiService: AIService,
    private readonly taskManagementService: TaskManagementService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Execute multiple agent queries/tasks in parallel.
   */
  async executeParallel(
    requests: ParallelProcessingRequest[],
    config: ParallelProcessingConfig = {}
  ): Promise<{
    results: AgentExecutionResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalDuration: number;
      averageDuration: number;
    };
  }> {
    if (requests.length === 0) {
      return {
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          totalDuration: 0,
          averageDuration: 0,
        },
      };
    }

    this.logger.log(`Starting parallel execution of ${requests.length} requests`);
    this.logger.log(
      `Configuration: maxConcurrency=${config.maxConcurrency ?? 5}, ` +
      `timeout=${config.timeout ?? this.timeoutConfig.parallel}ms, ` +
      `failFast=${config.failFast ?? false}`,
    );

    const tasks = requests.map((request, index) => this.createTask(request, index));
    const runnerOptions = this.createRunnerOptions(config);

    const taskResults = await this.parallelRunner.run(tasks, runnerOptions);
    const orderedResults = this.buildAgentResults(taskResults);
    const summary = this.buildSummary(orderedResults);

    this.logger.log(
      `Parallel execution completed: ${summary.successful}/${summary.total} successful, ` +
      `total time: ${summary.totalDuration.toFixed(2)}ms`,
    );

    return {
      results: orderedResults,
      summary,
    };
  }

  /**
   * Execute query requests in parallel (read-only operations)
   */
  async queryAgentsParallel(
    queries: Array<{
      agentId: string;
      query: string;
      context?: string;
      projectPath?: string;
      messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
      platform?: 'slack' | 'cli';
    }>,
    config?: ParallelProcessingConfig
  ) {
    const requests = queries.map((q) => ({
      agentId: q.agentId,
      query: q.query,
      context: q.context,
      projectPath: q.projectPath,
      messages: q.messages,
      platform: q.platform,
    }));

    return this.executeParallel(requests, config);
  }

  /**
   * Execute task requests in parallel (execution operations)
   */
  async executeAgentsParallel(
    tasks: Array<{
      agentId: string;
      task: string;
      context?: string;
      projectPath?: string;
    }>,
    config?: ParallelProcessingConfig
  ) {
    const requests = tasks.map((t) => ({
      agentId: t.agentId,
      task: t.task,
      context: t.context,
      projectPath: t.projectPath,
    }));

    return this.executeParallel(requests, config);
  }

  /**
   * Get performance metrics for the last execution
   */
  getPerformanceMetrics(results: AgentExecutionResult[]) {
    if (results.length === 0) {
      return {
        totalAgents: 0,
        successRate: 0,
        averageExecutionTime: 0,
        fastestExecution: 0,
        slowestExecution: 0,
        successfulAgents: [] as string[],
        failedAgents: [] as Array<{ agentId: string; error?: string }>,
      };
    }

    const successful = results.filter((r) => r.success);
    const durations = results.map((r) => r.duration);

    return {
      totalAgents: results.length,
      successRate: (successful.length / results.length) * 100,
      averageExecutionTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      fastestExecution: Math.min(...durations),
      slowestExecution: Math.max(...durations),
      successfulAgents: successful.map((r) => r.agentId),
      failedAgents: results
        .filter((r) => !r.success)
        .map((r) => ({ agentId: r.agentId, error: r.error })),
    };
  }

  private createTask(request: ParallelProcessingRequest, index: number): Task<AIResponse> {
    const mode: AgentExecutionMode = request.query ? 'query' : 'execute';
    const provider = this.getProviderForAgent(request.agentId);
    const agentOptions = this.getOptionsForAgent(request.agentId, mode);

    const metadata: ParallelTaskMetadata = {
      request,
      provider,
      agentOptions,
      mode,
      index,
    };

    return {
      id: `${request.agentId}:${mode}:${index}`,
      metadata,
      run: (context) => this.runAgentTask(metadata, context),
    };
  }

  private async runAgentTask(
    metadata: ParallelTaskMetadata,
    context: Parameters<Task<AIResponse>['run']>[0],
  ): Promise<AIResponse> {
    const { request, provider, agentOptions, mode } = metadata;
    const prompt = mode === 'query' ? request.query : request.task;

    if (!prompt) {
      throw new Error('Either query or task must be provided');
    }

    const formattedPrompt = request.context
      ? `Context: ${request.context}\n\n${mode === 'query' ? 'Query' : 'Task'}: ${prompt}`
      : prompt;

    const abortPromise = new Promise<never>((_, reject) => {
      if (context.signal.aborted) {
        const reason = context.signal.reason instanceof Error
          ? context.signal.reason
          : new ParallelRunnerTimeoutError(metadata.request.agentId, 0);
        reject(reason);
        return;
      }

      context.signal.addEventListener(
        'abort',
        () => {
          const reason = context.signal.reason instanceof Error
            ? context.signal.reason
            : new ParallelRunnerTimeoutError(metadata.request.agentId, 0);
          reject(reason);
        },
        { once: true },
      );
    });

    const executionPromise = mode === 'query'
      ? this.aiService.queryAI(formattedPrompt, provider, {
          workingDirectory: request.projectPath,
          additionalArgs: agentOptions,
          agentId: request.agentId,
        })
      : this.aiService.executeAI(formattedPrompt, provider, {
          workingDirectory: request.projectPath,
          additionalArgs: agentOptions,
          agentId: request.agentId,
        });

    try {
      return await Promise.race([executionPromise, abortPromise]);
    } finally {
      executionPromise.catch(() => undefined);
    }
  }

  private createRunnerOptions(config: ParallelProcessingConfig): ParallelRunnerOptions<AIResponse> {
    return {
      maxConcurrency: config.maxConcurrency ?? 5,
      timeoutMs: config.timeout ?? this.timeoutConfig.parallel,
      failFast: config.failFast ?? false,
      evaluateTaskSuccess: (value) => value.success,
      callbacks: this.createTaskCallbacks(),
    };
  }

  private createTaskCallbacks(): TaskCallbacks<AIResponse> {
    return {
      onTaskStart: async (task) => {
        const metadata = this.getMetadata(task.metadata);
        const modeLabel = metadata.mode;
        const prompt = modeLabel === 'query' ? metadata.request.query ?? '' : metadata.request.task ?? '';
        const taskId = this.taskManagementService.createTask({
          type: modeLabel,
          provider: metadata.provider,
          prompt,
          agentId: metadata.request.agentId,
        });
        metadata.taskId = taskId;

        this.logger.log(
          `Starting execution for agent: ${metadata.request.agentId} ` +
          `(provider: ${metadata.provider}, mode: ${modeLabel}, options: ${metadata.agentOptions.join(' ')}, taskId: ${taskId})`,
        );

        this.taskManagementService.addTaskLog(taskId, {
          level: 'info',
          message: `Starting ${modeLabel} operation with options: ${metadata.agentOptions.join(' ')}`,
        });
      },
      onTaskComplete: async (result) => {
        const metadata = this.getMetadata(result.metadata);
        const taskId = metadata.taskId;
        if (!taskId) {
          return;
        }

        const aiResult = result.value;
        if (aiResult) {
          this.taskManagementService.completeTask(taskId, aiResult, aiResult.success);
          this.taskManagementService.addTaskLog(taskId, {
            level: aiResult.success ? 'info' : 'error',
            message: aiResult.success
              ? `Completed successfully in ${result.durationMs.toFixed(2)}ms`
              : `Failed after ${result.durationMs.toFixed(2)}ms: ${aiResult.error || 'Unknown error'}`,
          });
        }

        this.logger.log(
          `Agent ${metadata.request.agentId} ${result.success ? 'completed successfully' : 'failed'} ` +
          `in ${result.durationMs.toFixed(2)}ms (taskId: ${taskId})`,
        );
      },
      onError: async (task, error, durationMs) => {
        const metadata = this.getMetadata(task.metadata);
        const taskId = metadata.taskId;
        const message = error.message || 'Unknown error';

        if (taskId) {
          this.taskManagementService.completeTask(taskId, { error: message }, false);
          this.taskManagementService.addTaskLog(taskId, {
            level: 'error',
            message: `Failed after ${durationMs.toFixed(2)}ms: ${message}`,
          });
        }

        this.logger.error(
          `Agent ${metadata.request.agentId} failed after ${durationMs.toFixed(2)}ms: ${message} ` +
          `(taskId: ${taskId ?? 'N/A'})`,
        );
      },
    };
  }

  private buildAgentResults(taskResults: TaskResult<AIResponse>[]): AgentExecutionResult[] {
    const decorated = taskResults.map((result) => {
      const metadata = this.getMetadata(result.metadata);

      const agentResult: AgentExecutionResult = result.value
        ? {
            agentId: metadata.request.agentId,
            success: result.value.success,
            result: result.value,
            error: result.value.error,
            duration: result.durationMs,
            taskId: metadata.taskId,
          }
        : {
            agentId: metadata.request.agentId,
            success: false,
            error: result.error?.message ?? 'Unknown error',
            duration: result.durationMs,
            taskId: metadata.taskId,
          };

      return { index: metadata.index, data: agentResult };
    });

    decorated.sort((a, b) => a.index - b.index);
    return decorated.map((item) => item.data);
  }

  private buildSummary(results: AgentExecutionResult[]) {
    const metrics = this.parallelRunner.getMetrics();
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;
    const averageDuration = results.length
      ? results.reduce((sum, item) => sum + item.duration, 0) / results.length
      : 0;

    return {
      total: results.length,
      successful,
      failed,
      totalDuration: metrics.totalDurationMs,
      averageDuration,
    };
  }

  private getMetadata(metadata?: Record<string, unknown>): ParallelTaskMetadata {
    if (!metadata) {
      throw new Error('ParallelRunner task metadata is missing');
    }

    return metadata as ParallelTaskMetadata;
  }

  /**
   * Get the actual AI provider for a given agent ID
   */
  private getProviderForAgent(agentId: string): ProviderName {
    if (agentId === 'claude' || agentId === 'gemini' || agentId === 'copilot' || agentId === 'codex') {
      return agentId;
    }

    const agentConfig = this.configService.getAgentConfig(agentId);
    const resolved = this.resolveProviderFromConfig(agentConfig);
    if (resolved) {
      return resolved;
    }

    this.logger.warn(`No provider found for agent ${agentId}, defaulting to claude`);
    return 'claude';
  }

  /**
   * Get mode-specific options for a given agent ID and execution mode
   */
  private getOptionsForAgent(agentId: string, mode: AgentExecutionMode): string[] {
    const agentConfig = this.configService.getAgentConfig(agentId);
    if (agentConfig && agentConfig.options) {
      if (typeof agentConfig.options === 'object' && agentConfig.options[mode]) {
        const modeOptions = agentConfig.options[mode];
        return Array.isArray(modeOptions) ? modeOptions : [];
      }
    }
    return [];
  }

  private resolveProviderFromConfig(agentConfig: any): ProviderName | null {
    if (!agentConfig) {
      return null;
    }

    const providerValue = Array.isArray(agentConfig.provider)
      ? agentConfig.provider[0]
      : agentConfig.provider;
    const normalized = this.normalizeProviderName(providerValue);
    if (normalized) {
      return normalized;
    }

    if (agentConfig.inline?.provider) {
      return this.normalizeProviderName(agentConfig.inline.provider);
    }

    return null;
  }

  private normalizeProviderName(provider?: string): ProviderName | null {
    if (!provider || typeof provider !== 'string') {
      return null;
    }

    const trimmed = provider.trim();
    if (!trimmed) {
      return null;
    }

    const candidate = trimmed.includes('/') ? trimmed.split('/')[1] : trimmed;
    if (candidate === 'claude' || candidate === 'gemini' || candidate === 'copilot' || candidate === 'codex') {
      return candidate;
    }

    return null;
  }
}
