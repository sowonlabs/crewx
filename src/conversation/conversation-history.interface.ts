/**
 * Message in a conversation thread
 */
export interface ConversationMessage {
  /** Unique message identifier */
  id: string;

  /** User ID or 'assistant' for bot messages */
  userId: string;

  /** Message content */
  text: string;

  /** Timestamp */
  timestamp: Date;

  /** Whether this is from the assistant */
  isAssistant: boolean;

  /** Optional metadata for platform-specific data */
  metadata?: Record<string, any>;
}

/**
 * A conversation thread
 */
export interface ConversationThread {
  /** Thread identifier */
  threadId: string;

  /** Platform (slack, cli, etc) */
  platform: 'slack' | 'cli';

  /** All messages in chronological order */
  messages: ConversationMessage[];

  /** Thread metadata */
  metadata?: Record<string, any>;

  /** Whether there are more messages not included (due to API limits) */
  hasMore?: boolean;
}

/**
 * Options for fetching conversation history
 */
export interface FetchHistoryOptions {
  /** Maximum number of messages to retrieve */
  limit?: number;

  /** Maximum context length in characters */
  maxContextLength?: number;

  /** Whether to exclude the current message */
  excludeCurrent?: boolean;
}

/**
 * Interface for conversation history providers
 */
export interface IConversationHistoryProvider {
  /**
   * Fetch conversation history for a thread
   */
  fetchHistory(
    threadId: string,
    options?: FetchHistoryOptions,
  ): Promise<ConversationThread>;

  /**
   * Format conversation history for AI context
   */
  formatForAI(thread: ConversationThread, options?: FetchHistoryOptions): Promise<string>;

  /**
   * Check if a thread exists
   */
  hasHistory(threadId: string): Promise<boolean>;
}
