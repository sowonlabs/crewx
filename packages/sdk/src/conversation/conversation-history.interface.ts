/**
 * File attachment information in conversation messages.
 */
export interface MessageFileAttachment {
  /** File unique identifier */
  id: string;
  /** File name */
  name: string;
  /** MIME type (e.g., 'image/png', 'application/pdf') */
  mimetype: string;
  /** File size in bytes */
  size: number;
  /** Local path where file is downloaded (relative to project root) */
  localPath: string;
  /** Original URL (platform-specific, may be private) */
  url?: string;
}

/**
 * Base message structure for template rendering.
 *
 * Contains minimal fields required for displaying conversation history in templates.
 * Extended by ConversationMessage for full persistence/retrieval functionality.
 */
export interface BaseMessage {
  /** Message text content */
  text: string;
  /** Whether this message is from the assistant */
  isAssistant: boolean;
  /** Platform-specific metadata (e.g., Slack user info, agent_id) */
  metadata?: Record<string, any>;
}

/**
 * Full conversation message structure for storage and retrieval.
 *
 * Extends BaseMessage with persistence fields (id, userId, timestamp).
 * Used by conversation history providers for database operations.
 */
export interface ConversationMessage extends BaseMessage {
  /** Unique message identifier */
  id: string;
  /** User identifier who sent the message */
  userId: string;
  /** Message timestamp */
  timestamp: Date;
  /** File attachments in this message */
  files?: MessageFileAttachment[];
}

export interface ConversationThread {
  threadId: string;
  platform: 'slack' | 'cli';
  messages: ConversationMessage[];
  metadata?: Record<string, any>;
  hasMore?: boolean;
}

export interface FetchHistoryOptions {
  limit?: number;
  maxContextLength?: number;
  excludeCurrent?: boolean;
}

export interface IConversationHistoryProvider {
  fetchHistory(
    threadId: string,
    options?: FetchHistoryOptions,
  ): Promise<ConversationThread>;

  formatForAI(
    thread: ConversationThread,
    options?: FetchHistoryOptions,
  ): Promise<string>;

  hasHistory(threadId: string): Promise<boolean>;
}
