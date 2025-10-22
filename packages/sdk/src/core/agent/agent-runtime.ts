/**
 * Agent runtime that wraps agent execution with event tracking.
 * Provides query/execute methods that emit lifecycle events.
 */

import { EventBus, CallStackFrame } from './event-bus';
import type { ConversationMessage } from '../../conversation/conversation-history.interface';
import type { LoggerLike } from '../providers/base-ai.types';
import { ConsoleLogger } from '../providers/base-ai.provider';
import { MentionParser } from '../../utils/mention-parser';
import type { AIProvider, AIQueryOptions, AIResponse } from '../providers/ai-provider.interface';
import { MockProvider } from '../providers/mock.provider';

export interface AgentQueryRequest {
  agentId?: string;
  prompt: string;
  context?: string;
  messages?: ConversationMessage[];
  model?: string;  // Runtime model override
  options?: AIQueryOptions;
}

export interface AgentExecuteRequest {
  agentId?: string;
  prompt: string;
  context?: string;
  messages?: ConversationMessage[];
  model?: string;  // Runtime model override
  options?: AIQueryOptions;
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
  provider?: AIProvider;
  defaultModel?: string;
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
  private provider: AIProvider;
  private defaultModel?: string;

  constructor(options: AgentRuntimeOptions = {}) {
    this.eventBus = options.eventBus ?? new EventBus();
    this.enableCallStack = options.enableCallStack ?? false;
    this.defaultAgentId = options.defaultAgentId ?? 'default';
    this.logger = options.logger ?? new ConsoleLogger('AgentRuntime');
    this.mentionParser = new MentionParser(options.validAgents ?? [this.defaultAgentId]);
    this.provider = options.provider ?? new MockProvider();
    this.defaultModel = options.defaultModel;
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
          provider: this.provider.name,
          mode: 'query',
          enteredAt: new Date().toISOString(),
        };
        this.callStack.push(frame);
        await this.eventBus.emit('callStackUpdated', [...this.callStack]);
      }

      const providerOptions = this.createProviderOptions(request, agentId);
      const aiResponse = await this.provider.query(request.prompt, providerOptions);
      const result = this.convertAIResponse(aiResponse, agentId, request);

      await this.eventBus.emit('agentCompleted', { agentId, success: result.success });

      this.logger.log(
        `Query completed for agent: ${agentId} (provider: ${this.provider.name}, success: ${result.success})`,
      );

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
          provider: this.provider.name,
          mode: 'execute',
          enteredAt: new Date().toISOString(),
        };
        this.callStack.push(frame);
        await this.eventBus.emit('callStackUpdated', [...this.callStack]);
      }

      const providerOptions = this.createProviderOptions(request, agentId);
      const aiResponse = await this.provider.execute(request.prompt, providerOptions);
      const result = this.convertAIResponse(aiResponse, agentId, request);

      await this.eventBus.emit('agentCompleted', { agentId, success: result.success });

      this.logger.log(
        `Execute completed for agent: ${agentId} (provider: ${this.provider.name}, success: ${result.success})`,
      );

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

  private createProviderOptions(
    request: AgentQueryRequest | AgentExecuteRequest,
    agentId: string,
  ): AIQueryOptions {
    const model = request.model ?? this.defaultModel;

    const overrideOptions = request.options ?? {};
    const normalizedMessages = request.messages?.map((message) => ({
      text: message.text,
      isAssistant: message.isAssistant,
      metadata: {
        ...message.metadata,
        id: message.id,
        userId: message.userId,
        timestamp:
          message.timestamp instanceof Date
            ? message.timestamp.toISOString()
            : message.timestamp,
      },
    }));

    return {
      ...overrideOptions,
      agentId,
      model,
      pipedContext: overrideOptions.pipedContext ?? request.context,
      messages: normalizedMessages ?? overrideOptions.messages,
    } satisfies AIQueryOptions;
  }

  private convertAIResponse(
    aiResponse: AIResponse,
    agentId: string,
    request: AgentQueryRequest | AgentExecuteRequest,
  ): AgentResult {
    const model = request.model ?? this.defaultModel;

    return {
      content: aiResponse.content,
      success: aiResponse.success,
      agentId,
      metadata: {
        provider: aiResponse.provider,
        command: aiResponse.command,
        taskId: aiResponse.taskId,
        error: aiResponse.error,
        toolCall: aiResponse.toolCall,
        context: request.context,
        messageCount: request.messages?.length ?? 0,
        model,
      },
    };
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
