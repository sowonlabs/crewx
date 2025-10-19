export interface ConversationMessage {
  id: string;
  userId: string;
  text: string;
  timestamp: Date;
  isAssistant: boolean;
  metadata?: Record<string, any>;
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
