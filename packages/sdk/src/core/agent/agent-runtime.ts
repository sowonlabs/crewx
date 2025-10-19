/**
 * Agent runtime that wraps agent execution with event tracking.
 * Provides query/execute methods that emit lifecycle events.
 */

import { EventBus, CallStackFrame } from './event-bus';
import type { ConversationMessage } from '../../conversation/conversation-history.interface';

export interface AgentQueryRequest {
  agentId?: string;
  prompt: string;
  context?: string;
  messages?: ConversationMessage[];
}

export interface AgentExecuteRequest {
  agentId?: string;
  prompt: string;
  context?: string;
  messages?: ConversationMessage[];
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

  constructor(options: AgentRuntimeOptions = {}) {
    this.eventBus = options.eventBus ?? new EventBus();
    this.enableCallStack = options.enableCallStack ?? false;
    this.defaultAgentId = options.defaultAgentId ?? 'default';
  }

  /**
   * Execute a query request.
   */
  async query(request: AgentQueryRequest): Promise<AgentResult> {
    const agentId = request.agentId ?? this.defaultAgentId;

    try {
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
      const result: AgentResult = {
        content: `Query executed: ${request.prompt}`,
        success: true,
        agentId,
        metadata: {
          context: request.context,
          messageCount: request.messages?.length ?? 0,
        },
      };

      // Emit completion event
      await this.eventBus.emit('agentCompleted', { agentId, success: true });

      return result;
    } catch (error) {
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
   * Execute an execute request (write mode).
   */
  async execute(request: AgentExecuteRequest): Promise<AgentResult> {
    const agentId = request.agentId ?? this.defaultAgentId;

    try {
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
      const result: AgentResult = {
        content: `Execute completed: ${request.prompt}`,
        success: true,
        agentId,
        metadata: {
          context: request.context,
          messageCount: request.messages?.length ?? 0,
        },
      };

      await this.eventBus.emit('agentCompleted', { agentId, success: true });

      return result;
    } catch (error) {
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
