export interface ConversationConfig {
    maxMessages: number;
    maxContextLength: number;
    cacheTTL: number;
    maxCacheSize: number;
    enabled: boolean;
}
export declare const DEFAULT_CONVERSATION_CONFIG: ConversationConfig;
export declare function getConversationConfig(env?: NodeJS.ProcessEnv): ConversationConfig;
