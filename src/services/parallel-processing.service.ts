import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../ai.service';
import { TaskManagementService } from './task-management.service';
import { ConfigService } from './config.service';
import { getTimeoutConfig } from '../config/timeout.config';

// Result interface for individual agent executions
interface AgentExecutionResult {
  agentId: string;
  success: boolean;
  result?: any;
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

@Injectable()
export class ParallelProcessingService {
  private readonly logger = new Logger(ParallelProcessingService.name);
  private readonly timeoutConfig = getTimeoutConfig();

  constructor(
    private readonly aiService: AIService,
    private readonly taskManagementService: TaskManagementService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get the actual AI provider for a given agent ID
   */
  private getProviderForAgent(agentId: string): 'claude' | 'gemini' | 'copilot' | 'codex' {
    // Direct provider names
    if (agentId === 'claude' || agentId === 'gemini' || agentId === 'copilot' || agentId === 'codex') {
      return agentId as 'claude' | 'gemini' | 'copilot' | 'codex';
    }

    const agentConfig = this.configService.getAgentConfig(agentId);
    if (agentConfig && agentConfig.inline?.provider) {
      return agentConfig.inline.provider;
    }

    // Default to claude if no specific configuration found
    this.logger.warn(`No provider found for agent ${agentId}, defaulting to claude`);
    return 'claude';
  }

  /**
   * Get mode-specific options for a given agent ID and execution mode
   */
  private getOptionsForAgent(agentId: string, mode: 'query' | 'execute'): string[] {
    const agentConfig = this.configService.getAgentConfig(agentId);
    if (agentConfig && agentConfig.options) {
      if (typeof agentConfig.options === 'object' && agentConfig.options[mode]) {
        return agentConfig.options[mode] || [];
      }
    }
    return [];
  }

  /**
   * Execute multiple agent queries/tasks in parallel
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
    const startTime = performance.now();
    const { maxConcurrency = 5, timeout = this.timeoutConfig.parallel, failFast = false } = config;

    this.logger.log(`Starting parallel execution of ${requests.length} requests`);
    this.logger.log(`Configuration: maxConcurrency=${maxConcurrency}, timeout=${timeout}ms, failFast=${failFast}`);

    // Chunk requests based on max concurrency
    const chunks = this.chunkArray(requests, maxConcurrency);
    const allResults: AgentExecutionResult[] = [];
    let shouldStop = false;

    for (const chunk of chunks) {
      if (shouldStop) break;

      this.logger.log(`Executing chunk of ${chunk.length} requests`);
      
      const chunkPromises = chunk.map(async (request) => {
        return this.executeWithTimeout(request, timeout);
      });

      try {
        const chunkResults = await Promise.allSettled(chunkPromises);
        
        for (const [index, result] of chunkResults.entries()) {
          if (result.status === 'fulfilled') {
            allResults.push(result.value);
            
            // Check for fail-fast condition
            if (failFast && !result.value.success) {
              this.logger.warn(`Fail-fast triggered by failed execution: ${chunk[index]?.agentId}`);
              shouldStop = true;
              break;
            }
          } else {
            // Handle rejected promise
            const failedRequest = chunk[index];
            if (failedRequest) {
              allResults.push({
                agentId: failedRequest.agentId,
                success: false,
                error: result.reason?.message || 'Promise rejected',
                duration: 0
              });
              
              if (failFast) {
                this.logger.warn(`Fail-fast triggered by promise rejection: ${failedRequest.agentId}`);
                shouldStop = true;
                break;
              }
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Chunk execution failed: ${errorMessage}`);
        
        // Add error results for all requests in the chunk
        chunk.forEach(request => {
          allResults.push({
            agentId: request.agentId,
            success: false,
            error: errorMessage,
            duration: 0
          });
        });
        
        if (failFast) {
          shouldStop = true;
        }
      }
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    // Calculate summary statistics
    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.length - successful;
    const averageDuration = allResults.length > 0 
      ? allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length 
      : 0;

    const summary = {
      total: allResults.length,
      successful,
      failed,
      totalDuration,
      averageDuration
    };

    this.logger.log(`Parallel execution completed: ${successful}/${allResults.length} successful, total time: ${totalDuration.toFixed(2)}ms`);

    return {
      results: allResults,
      summary
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
    const requests = queries.map(q => ({
      agentId: q.agentId,
      query: q.query,
      context: q.context,
      projectPath: q.projectPath,
      messages: q.messages,
      platform: q.platform
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
    const requests = tasks.map(t => ({
      agentId: t.agentId,
      task: t.task,
      context: t.context,
      projectPath: t.projectPath
    }));

    return this.executeParallel(requests, config);
  }

  /**
   * Execute a single request with timeout
   */
  private async executeWithTimeout(
    request: ParallelProcessingRequest,
    timeout: number
  ): Promise<AgentExecutionResult> {
    const startTime = performance.now();

    // Get the actual AI provider for this agent
    const actualProvider = this.getProviderForAgent(request.agentId);

    // Create task using TaskManagementService
    const taskId = this.taskManagementService.createTask({
      type: request.query ? 'query' : 'execute',
      provider: actualProvider,
      prompt: request.query || request.task || '',
      agentId: request.agentId
    });

    try {
      // Get mode-specific options for this agent
      const mode = request.query ? 'query' : 'execute';
      const agentOptions = this.getOptionsForAgent(request.agentId, mode);
      
      this.logger.log(`Starting execution for agent: ${request.agentId} (provider: ${actualProvider}, mode: ${mode}, options: ${agentOptions.join(' ')}, taskId: ${taskId})`);

      // Log task start
      this.taskManagementService.addTaskLog(taskId, {
        level: 'info',
        message: `Starting ${mode} operation with options: ${agentOptions.join(' ')}`
      });

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
      });

      // Determine which AI service method to call
      let resultPromise: Promise<any>;
      
      if (request.query) {
        // Query operation (read-only)
        const finalQuery = request.context ? 
          `Context: ${request.context}\n\nQuery: ${request.query}` : 
          request.query;
          
        resultPromise = this.aiService.queryAI(
          finalQuery,
          actualProvider,
          {
            workingDirectory: request.projectPath,
            taskId, // Pass taskId to AIService
            additionalArgs: agentOptions, // Pass mode-specific options
            agentId: request.agentId,
          }
        );
      } else if (request.task) {
        // Execute operation  
        const finalTask = request.context ? 
          `Context: ${request.context}\n\nTask: ${request.task}` : 
          request.task;
          
        resultPromise = this.aiService.executeAI(
          finalTask,
          actualProvider,
          {
            workingDirectory: request.projectPath,
            taskId, // Pass taskId to AIService
            additionalArgs: agentOptions, // Pass mode-specific options
            agentId: request.agentId,
          }
        );
      } else {
        throw new Error('Either query or task must be provided');
      }

      // Race between execution and timeout
      const result = await Promise.race([resultPromise, timeoutPromise]);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Complete task with actual result success status
      this.taskManagementService.completeTask(taskId, result, result.success);
      this.taskManagementService.addTaskLog(taskId, {
        level: result.success ? 'info' : 'error',
        message: result.success 
          ? `Completed successfully in ${duration.toFixed(2)}ms`
          : `Failed after ${duration.toFixed(2)}ms: ${result.error || 'Unknown error'}`
      });

      this.logger.log(`Agent ${request.agentId} ${result.success ? 'completed successfully' : 'failed'} in ${duration.toFixed(2)}ms (taskId: ${taskId})`);

      return {
        agentId: request.agentId,
        success: result.success,
        result,
        duration,
        taskId // Return the taskId
      };

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark task as failed
      this.taskManagementService.completeTask(taskId, { error: errorMessage }, false);
      this.taskManagementService.addTaskLog(taskId, {
        level: 'error',
        message: `Failed after ${duration.toFixed(2)}ms: ${errorMessage}`
      });

      this.logger.error(`Agent ${request.agentId} failed after ${duration.toFixed(2)}ms: ${errorMessage} (taskId: ${taskId})`);

      return {
        agentId: request.agentId,
        success: false,
        error: errorMessage,
        duration,
        taskId // Return the taskId even for failed tasks
      };
    }
  }

  /**
   * Utility method to chunk an array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
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
        slowestExecution: 0
      };
    }

    const successful = results.filter(r => r.success);
    const durations = results.map(r => r.duration);

    return {
      totalAgents: results.length,
      successRate: (successful.length / results.length) * 100,
      averageExecutionTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      fastestExecution: Math.min(...durations),
      slowestExecution: Math.max(...durations),
      successfulAgents: successful.map(r => r.agentId),
      failedAgents: results.filter(r => !r.success).map(r => ({ agentId: r.agentId, error: r.error }))
    };
  }
}
