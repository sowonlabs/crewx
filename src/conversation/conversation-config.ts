/**
 * Configuration for conversation history management
 */
export interface ConversationConfig {
  /** Maximum number of messages to retrieve from history */
  maxMessages: number;

  /** Maximum context length in characters for AI */
  maxContextLength: number;

  /** Cache TTL in milliseconds */
  cacheTTL: number;

  /** Maximum cache size (number of threads) */
  maxCacheSize: number;

  /** Whether to enable conversation history */
  enabled: boolean;
}

/**
 * Default conversation configuration
 */
export const DEFAULT_CONVERSATION_CONFIG: ConversationConfig = {
  maxMessages: 20,
  maxContextLength: 4000,
  cacheTTL: 30000, // 30 seconds
  maxCacheSize: 100,
  enabled: true,
};

/**
 * Get conversation config from environment variables
 */
export function getConversationConfig(): ConversationConfig {
  return {
    maxMessages: parseInt(
      process.env.CONVERSATION_MAX_MESSAGES ||
        String(DEFAULT_CONVERSATION_CONFIG.maxMessages),
    ),
    maxContextLength: parseInt(
      process.env.CONVERSATION_MAX_CONTEXT_LENGTH ||
        String(DEFAULT_CONVERSATION_CONFIG.maxContextLength),
    ),
    cacheTTL: parseInt(
      process.env.CONVERSATION_CACHE_TTL ||
        String(DEFAULT_CONVERSATION_CONFIG.cacheTTL),
    ),
    maxCacheSize: parseInt(
      process.env.CONVERSATION_MAX_CACHE_SIZE ||
        String(DEFAULT_CONVERSATION_CONFIG.maxCacheSize),
    ),
    enabled: process.env.CONVERSATION_HISTORY_ENABLED !== 'false',
  };
}
