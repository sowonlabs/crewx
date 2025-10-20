/**
 * Agent runtime that wraps agent execution with event tracking.
 * Provides query/execute methods that emit lifecycle events.
 */

import { EventBus, CallStackFrame } from './event-bus';
import type { ConversationMessage } from '../../conversation/conversation-history.interface';
import type { LoggerLike } from '../providers/base-ai.types';
import { ConsoleLogger } from '../providers/base-ai.provider';
import { MentionParser } from '../../utils/mention-parser';

export interface AgentQueryRequest {
  agentId?: string;
  prompt: string;
  context?: string;
  messages?: ConversationMessage[];
  model?: string;  // Runtime model override
}

export interface AgentExecuteRequest {
  agentId?: string;
  prompt: string;
  context?: string;
  messages?: ConversationMessage[];
  model?: string;  // Runtime model override
}

export interface AgentResult {
  content: string;
  success: boolean;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface AgentRuntimeOptions {
  eventBus?: EventBus;
  enableCallStack?: boolean;
  defaultAgentId?: string;
  logger?: LoggerLike;  // Custom logger (defaults to ConsoleLogger)
  validAgents?: string[];  // List of valid agent IDs for mention parsing
}

/**
 * AgentRuntime provides a high-level interface for executing agent queries
 * with built-in event tracking and call stack management.
 */
export class AgentRuntime {
  private eventBus: EventBus;
  private enableCallStack: boolean;
  private callStack: CallStackFrame[] = [];
  private defaultAgentId: string;
  private logger: LoggerLike;
  private mentionParser: MentionParser;

  constructor(options: AgentRuntimeOptions = {}) {
    this.eventBus = options.eventBus ?? new EventBus();
    this.enableCallStack = options.enableCallStack ?? false;
    this.defaultAgentId = options.defaultAgentId ?? 'default';
    this.logger = options.logger ?? new ConsoleLogger('AgentRuntime');
    this.mentionParser = new MentionParser(options.validAgents ?? [this.defaultAgentId]);
  }

  /**
   * Execute a query request with mention parsing support.
   * @example
   * // String with mention
   * await agent.query('@backend analyze this code');
   * await agent.query('@frontend:gpt-4 create UI component');
   *
   * // Structured object
   * await agent.query({
   *   agentId: 'backend',
   *   prompt: 'analyze this code',
   *   model: 'claude-3-opus'
   * });
   */
  async query(promptOrRequest: string | AgentQueryRequest): Promise<AgentResult>;
  async query(promptOrRequest: string | AgentQueryRequest): Promise<AgentResult> {
    // Parse input: string with mentions OR structured request object
    let request: AgentQueryRequest;

    if (typeof promptOrRequest === 'string') {
      // Parse mention string like "@backend analyze this code"
      const parsed = this.mentionParser.parse(promptOrRequest);

      if (parsed.errors.length > 0) {
        throw new Error(`Mention parsing errors: ${parsed.errors.join(', ')}`);
      }

      if (parsed.tasks.length === 0) {
        // No mentions found, use default agent with entire string as prompt
        request = {
          prompt: promptOrRequest,
          agentId: this.defaultAgentId,
        };
      } else {
        // Use first task from parsed mentions
        const task = parsed.tasks[0];
        if (!task) {
          throw new Error('No valid task found in mention string');
        }

        const targetAgent = task.agents[0];
        if (!targetAgent) {
          throw new Error('No valid agent found in mention string');
        }

        request = {
          agentId: targetAgent,
          prompt: task.task,
          model: task.models?.get(targetAgent),
        };
      }
    } else {
      // Use structured request object as-is
      request = promptOrRequest;
    }

    const agentId = request.agentId ?? this.defaultAgentId;

    try {
      this.logger.log(`Starting query for agent: ${agentId}`);

      // Emit start event
      await this.eventBus.emit('agentStarted', { agentId, mode: 'query' });

      // Track call stack if enabled
      if (this.enableCallStack) {
        const frame: CallStackFrame = {
          depth: this.callStack.length,
          agentId,
          provider: 'sdk', // Will be overridden by actual provider
          mode: 'query',
          enteredAt: new Date().toISOString(),
        };
        this.callStack.push(frame);
        await this.eventBus.emit('callStackUpdated', [...this.callStack]);
      }

      // Simulate execution (actual implementation would use AIProvider)
      // TODO: Pass request.model to provider.query(prompt, { model: request.model })
      const result: AgentResult = {
        content: `Query executed: ${request.prompt}`,
        success: true,
        agentId,
        metadata: {
          context: request.context,
          messageCount: request.messages?.length ?? 0,
          model: request.model,  // Include model in metadata
        },
      };

      // Emit completion event
      await this.eventBus.emit('agentCompleted', { agentId, success: true });

      this.logger.log(`Query completed successfully for agent: ${agentId}`);

      return result;
    } catch (error) {
      this.logger.error(`Query failed for agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.eventBus.emit('agentCompleted', { agentId, success: false });
      throw error;
    } finally {
      // Pop call stack frame
      if (this.enableCallStack && this.callStack.length > 0) {
        this.callStack.pop();
        await this.eventBus.emit('callStackUpdated', [...this.callStack]);
      }
    }
  }

  /**
   * Execute an execute request (write mode) with mention parsing support.
   * @example
   * // String with mention
   * await agent.execute('@backend create API endpoint');
   * await agent.execute('@devops:gpt-4 setup CI/CD pipeline');
   *
   * // Structured object
   * await agent.execute({
   *   agentId: 'backend',
   *   prompt: 'create API endpoint',
   *   model: 'claude-3-opus'
   * });
   */
  async execute(promptOrRequest: string | AgentExecuteRequest): Promise<AgentResult>;
  async execute(promptOrRequest: string | AgentExecuteRequest): Promise<AgentResult> {
    // Parse input: string with mentions OR structured request object
    let request: AgentExecuteRequest;

    if (typeof promptOrRequest === 'string') {
      // Parse mention string like "@backend create API endpoint"
      const parsed = this.mentionParser.parse(promptOrRequest);

      if (parsed.errors.length > 0) {
        throw new Error(`Mention parsing errors: ${parsed.errors.join(', ')}`);
      }

      if (parsed.tasks.length === 0) {
        // No mentions found, use default agent with entire string as prompt
        request = {
          prompt: promptOrRequest,
          agentId: this.defaultAgentId,
        };
      } else {
        // Use first task from parsed mentions
        const task = parsed.tasks[0];
        if (!task) {
          throw new Error('No valid task found in mention string');
        }

        const targetAgent = task.agents[0];
        if (!targetAgent) {
          throw new Error('No valid agent found in mention string');
        }

        request = {
          agentId: targetAgent,
          prompt: task.task,
          model: task.models?.get(targetAgent),
        };
      }
    } else {
      // Use structured request object as-is
      request = promptOrRequest;
    }

    const agentId = request.agentId ?? this.defaultAgentId;

    try {
      this.logger.log(`Starting execute for agent: ${agentId}`);

      // Emit start event
      await this.eventBus.emit('agentStarted', { agentId, mode: 'execute' });

      // Track call stack if enabled
      if (this.enableCallStack) {
        const frame: CallStackFrame = {
          depth: this.callStack.length,
          agentId,
          provider: 'sdk',
          mode: 'execute',
          enteredAt: new Date().toISOString(),
        };
        this.callStack.push(frame);
        await this.eventBus.emit('callStackUpdated', [...this.callStack]);
      }

      // Simulate execution
      // TODO: Pass request.model to provider.execute(prompt, { model: request.model })
      const result: AgentResult = {
        content: `Execute completed: ${request.prompt}`,
        success: true,
        agentId,
        metadata: {
          context: request.context,
          messageCount: request.messages?.length ?? 0,
          model: request.model,  // Include model in metadata
        },
      };

      await this.eventBus.emit('agentCompleted', { agentId, success: true });

      this.logger.log(`Execute completed successfully for agent: ${agentId}`);

      return result;
    } catch (error) {
      this.logger.error(`Execute failed for agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.eventBus.emit('agentCompleted', { agentId, success: false });
      throw error;
    } finally {
      if (this.enableCallStack && this.callStack.length > 0) {
        this.callStack.pop();
        await this.eventBus.emit('callStackUpdated', [...this.callStack]);
      }
    }
  }

  /**
   * Get the current call stack (if enabled).
   */
  getCallStack(): CallStackFrame[] {
    return [...this.callStack];
  }

  /**
   * Get the event bus instance for custom event handling.
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
}
