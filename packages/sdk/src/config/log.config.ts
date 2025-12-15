/**
 * Log output configuration shared between CLI and SDK consumers.
 * Controls truncation limits for various log outputs.
 */
export interface LogConfig {
  promptMaxLength: number;
  toolResultMaxLength: number;
  conversationMaxLength: number;
}

const DEFAULT_LOG_CONFIG: LogConfig = {
  promptMaxLength: 100000,
  toolResultMaxLength: 20000,
  conversationMaxLength: 40000,
};

export function getLogConfig(env: NodeJS.ProcessEnv = process.env): LogConfig {
  return {
    promptMaxLength: parseInt(env.CREWX_LOG_PROMPT_MAX_LENGTH ?? '') || DEFAULT_LOG_CONFIG.promptMaxLength,
    toolResultMaxLength: parseInt(env.CREWX_LOG_TOOL_RESULT_MAX_LENGTH ?? '') || DEFAULT_LOG_CONFIG.toolResultMaxLength,
    conversationMaxLength: parseInt(env.CREWX_LOG_CONVERSATION_MAX_LENGTH ?? '') || DEFAULT_LOG_CONFIG.conversationMaxLength,
  };
}

export function getDefaultLogConfig(): LogConfig {
  return { ...DEFAULT_LOG_CONFIG };
}
