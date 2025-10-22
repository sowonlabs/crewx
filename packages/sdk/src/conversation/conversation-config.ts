export interface ConversationConfig {
  maxMessages: number;
  maxContextLength: number;
  cacheTTL: number;
  maxCacheSize: number;
  enabled: boolean;
}

export const DEFAULT_CONVERSATION_CONFIG: ConversationConfig = {
  maxMessages: 20,
  maxContextLength: 4000,
  cacheTTL: 30_000,
  maxCacheSize: 100,
  enabled: true,
};

export function getConversationConfig(env: NodeJS.ProcessEnv = process.env): ConversationConfig {
  return {
    maxMessages: parseInt(
      env.CONVERSATION_MAX_MESSAGES ?? String(DEFAULT_CONVERSATION_CONFIG.maxMessages),
      10,
    ),
    maxContextLength: parseInt(
      env.CONVERSATION_MAX_CONTEXT_LENGTH ??
        String(DEFAULT_CONVERSATION_CONFIG.maxContextLength),
      10,
    ),
    cacheTTL: parseInt(
      env.CONVERSATION_CACHE_TTL ?? String(DEFAULT_CONVERSATION_CONFIG.cacheTTL),
      10,
    ),
    maxCacheSize: parseInt(
      env.CONVERSATION_MAX_CACHE_SIZE ?? String(DEFAULT_CONVERSATION_CONFIG.maxCacheSize),
      10,
    ),
    enabled: env.CONVERSATION_HISTORY_ENABLED !== 'false',
  };
}
