/**
 * Timeout configuration shared between CLI and SDK consumers.
 */
export interface TimeoutConfig {
  claudeQuery: number;
  claudeExecute: number;
  geminiQuery: number;
  geminiExecute: number;
  copilotQuery: number;
  copilotExecute: number;
  parallel: number;
  stdinInitial: number;
  stdinChunk: number;
  stdinComplete: number;
}

const DEFAULT_TIMEOUTS: TimeoutConfig = {
  claudeQuery: 1_800_000,
  claudeExecute: 1_800_000,
  geminiQuery: 1_800_000,
  geminiExecute: 1_800_000,
  copilotQuery: 1_800_000,
  copilotExecute: 1_800_000,
  parallel: 1_800_000,
  stdinInitial: 30_000,
  stdinChunk: 1_800_000,
  stdinComplete: 100,
};

export function getTimeoutConfig(env: NodeJS.ProcessEnv = process.env): TimeoutConfig {
  return {
    claudeQuery: parseInt(env.CREWCODE_TIMEOUT_CLAUDE_QUERY ?? '') || DEFAULT_TIMEOUTS.claudeQuery,
    claudeExecute: parseInt(env.CREWCODE_TIMEOUT_CLAUDE_EXECUTE ?? '') || DEFAULT_TIMEOUTS.claudeExecute,
    geminiQuery: parseInt(env.CREWCODE_TIMEOUT_GEMINI_QUERY ?? '') || DEFAULT_TIMEOUTS.geminiQuery,
    geminiExecute: parseInt(env.CREWCODE_TIMEOUT_GEMINI_EXECUTE ?? '') || DEFAULT_TIMEOUTS.geminiExecute,
    copilotQuery: parseInt(env.CREWCODE_TIMEOUT_COPILOT_QUERY ?? '') || DEFAULT_TIMEOUTS.copilotQuery,
    copilotExecute: parseInt(env.CREWCODE_TIMEOUT_COPILOT_EXECUTE ?? '') || DEFAULT_TIMEOUTS.copilotExecute,
    parallel: parseInt(env.CREWCODE_TIMEOUT_PARALLEL ?? '') || DEFAULT_TIMEOUTS.parallel,
    stdinInitial: parseInt(env.CREWCODE_TIMEOUT_STDIN_INITIAL ?? '') || DEFAULT_TIMEOUTS.stdinInitial,
    stdinChunk: parseInt(env.CREWCODE_TIMEOUT_STDIN_CHUNK ?? '') || DEFAULT_TIMEOUTS.stdinChunk,
    stdinComplete: parseInt(env.CREWCODE_TIMEOUT_STDIN_COMPLETE ?? '') || DEFAULT_TIMEOUTS.stdinComplete,
  };
}

export function getDefaultTimeoutConfig(): TimeoutConfig {
  return { ...DEFAULT_TIMEOUTS };
}
