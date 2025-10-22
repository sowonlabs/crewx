/**
 * Structured payload types for CrewX agent communication
 *
 * These types define the standardized format for passing context, messages,
 * and metadata between agents and providers. This format supports:
 * - Prompt and context strings
 * - Conversation message history
 * - Agent information and call stack tracking
 * - Platform-specific metadata
 *
 * @see requirements-monorepo.md lines 131-187 for full specification
 */

import { CallStackFrame } from '../core/agent/event-bus';

/**
 * Structured message format for conversation history.
 * Compatible with .crewx/conversations/*.json storage format.
 */
export interface StructuredMessage {
  /** Unique message identifier */
  id: string;

  /** User ID (sender), e.g., "doha" or agent name */
  userId?: string;

  /** Message content */
  text: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Whether this message is from an AI assistant (true) or user (false) */
  isAssistant: boolean;

  /** Additional platform-specific metadata (e.g., Slack channel, agent_id) */
  metadata?: Record<string, any>;
}

/**
 * Agent information in structured payload
 */
export interface AgentInfo {
  /** Agent identifier (e.g., "crewx", "backend") */
  id: string;

  /** Provider name (e.g., "codex", "claude", "gemini") */
  provider: string;

  /** Request mode */
  mode: 'query' | 'execute';

  /** Model name (optional, e.g., "gpt-5-large", "claude-3-opus") */
  model?: string;
}

/**
 * Metadata for structured payload
 */
export interface StructuredPayloadMetadata {
  /** ISO 8601 timestamp when payload was generated */
  generatedAt: string;

  /** Number of messages in the conversation history */
  messageCount: number;

  /** Original context before processing (optional) */
  originalContext?: string;

  /** Platform identifier (e.g., "cli", "slack", "web") */
  platform: string;

  /** Thread identifier for conversation continuity (optional) */
  threadId?: string;

  /** Call stack for tracking nested agent calls (optional) */
  callStack?: CallStackFrame[];

  /** Formatted history string (deprecated, use MessageFormatter instead) */
  formattedHistory?: string;
}

/**
 * Structured payload format for agent communication.
 *
 * This is the standardized format used throughout CrewX for passing
 * prompts, context, and conversation history between components.
 *
 * @example
 * ```typescript
 * const payload: StructuredPayload = {
 *   version: '1.0',
 *   agent: {
 *     id: 'crewx',
 *     provider: 'codex',
 *     mode: 'query',
 *     model: 'gpt-5-large'
 *   },
 *   prompt: 'Summarize the conversation',
 *   context: 'Project context here',
 *   messages: [
 *     {
 *       id: '123',
 *       userId: 'user',
 *       text: 'Hello',
 *       timestamp: '2025-10-17T00:00:00.000Z',
 *       isAssistant: false
 *     }
 *   ],
 *   metadata: {
 *     generatedAt: '2025-10-17T00:00:00.000Z',
 *     messageCount: 1,
 *     platform: 'cli'
 *   }
 * };
 * ```
 */
export interface StructuredPayload {
  /** Payload format version (currently "1.0") */
  version: string;

  /** Agent handling this request */
  agent: AgentInfo;

  /** User's prompt/request */
  prompt: string;

  /** Additional context (from stdin pipe, templates, etc.) */
  context?: string;

  /** Conversation message history */
  messages: StructuredMessage[];

  /** Metadata about the payload and execution context */
  metadata: StructuredPayloadMetadata;
}

/**
 * Type guard to check if a value is a StructuredPayload
 */
export function isStructuredPayload(value: unknown): value is StructuredPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as any;

  return (
    typeof payload.version === 'string' &&
    typeof payload.prompt === 'string' &&
    Array.isArray(payload.messages) &&
    typeof payload.agent === 'object' &&
    typeof payload.metadata === 'object' &&
    typeof payload.agent.id === 'string' &&
    typeof payload.agent.provider === 'string' &&
    (payload.agent.mode === 'query' || payload.agent.mode === 'execute')
  );
}

/**
 * Parse a JSON string into a StructuredPayload
 * @param input - JSON string to parse
 * @returns Parsed payload or null if invalid
 */
export function parseStructuredPayload(input: string | null | undefined): StructuredPayload | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (isStructuredPayload(parsed)) {
      // Ensure messages is always an array
      if (!Array.isArray(parsed.messages)) {
        parsed.messages = [];
      }
      return parsed;
    }
  } catch (error) {
    // Invalid JSON - return null
  }

  return null;
}

/**
 * Create a new StructuredPayload with sensible defaults
 */
export function createStructuredPayload(params: {
  agentId: string;
  provider: string;
  mode: 'query' | 'execute';
  prompt: string;
  context?: string;
  messages?: StructuredMessage[];
  model?: string;
  platform?: string;
  threadId?: string;
  callStack?: CallStackFrame[];
}): StructuredPayload {
  const now = new Date().toISOString();
  const messages = params.messages || [];

  return {
    version: '1.0',
    agent: {
      id: params.agentId,
      provider: params.provider,
      mode: params.mode,
      model: params.model,
    },
    prompt: params.prompt,
    context: params.context,
    messages,
    metadata: {
      generatedAt: now,
      messageCount: messages.length,
      originalContext: params.context,
      platform: params.platform || 'cli',
      threadId: params.threadId,
      callStack: params.callStack,
    },
  };
}
