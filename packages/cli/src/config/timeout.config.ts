/**
 * Timeout Configuration
 * Provides configurable timeout values for AI CLI operations
 */

export interface TimeoutConfig {
  /** Timeout for Claude query operations (ms) */
  claudeQuery: number;

  /** Timeout for Claude execute operations (ms) */
  claudeExecute: number;

  /** Timeout for Gemini query operations (ms) */
  geminiQuery: number;

  /** Timeout for Gemini execute operations (ms) */
  geminiExecute: number;

  /** Timeout for Copilot query operations (ms) */
  copilotQuery: number;

  /** Timeout for Copilot execute operations (ms) */
  copilotExecute: number;

  /** Timeout for parallel processing operations (ms) */
  parallel: number;

  /** Timeout for stdin read operations (ms) */
  stdinInitial: number;

  /** Timeout for stdin chunk completion detection (ms) */
  stdinChunk: number;

  /** Timeout when stdin output looks complete (ms) */
  stdinComplete: number;
}

/**
 * Default timeout values (in milliseconds)
 */
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  claudeQuery: 1800000,      // 30 minutes (unified timeout for all operations)
  claudeExecute: 1800000,    // 30 minutes (unified timeout for all operations)
  geminiQuery: 1800000,      // 30 minutes (unified timeout for all operations)
  geminiExecute: 1800000,    // 30 minutes (unified timeout for all operations)
  copilotQuery: 1800000,     // 30 minutes (unified timeout for all operations)
  copilotExecute: 1800000,   // 30 minutes (unified timeout for all operations)
  parallel: 1800000,         // 30 minutes (unified timeout for all operations)
  stdinInitial: 30000,       // 30 seconds (kept for initial connection)
  stdinChunk: 1800000,       // 30 minutes (fixed from 10 minutes - bug-00000028)
  stdinComplete: 100,        // 100 ms (kept for completion detection)
};

/**
 * Get timeout configuration from environment variables
 * Falls back to default values if not specified
 */
export function getTimeoutConfig(): TimeoutConfig {
  return {
    claudeQuery: parseInt(process.env.CREWCODE_TIMEOUT_CLAUDE_QUERY || '') || DEFAULT_TIMEOUTS.claudeQuery,
    claudeExecute: parseInt(process.env.CREWCODE_TIMEOUT_CLAUDE_EXECUTE || '') || DEFAULT_TIMEOUTS.claudeExecute,
    geminiQuery: parseInt(process.env.CREWCODE_TIMEOUT_GEMINI_QUERY || '') || DEFAULT_TIMEOUTS.geminiQuery,
    geminiExecute: parseInt(process.env.CREWCODE_TIMEOUT_GEMINI_EXECUTE || '') || DEFAULT_TIMEOUTS.geminiExecute,
    copilotQuery: parseInt(process.env.CREWCODE_TIMEOUT_COPILOT_QUERY || '') || DEFAULT_TIMEOUTS.copilotQuery,
    copilotExecute: parseInt(process.env.CREWCODE_TIMEOUT_COPILOT_EXECUTE || '') || DEFAULT_TIMEOUTS.copilotExecute,
    parallel: parseInt(process.env.CREWCODE_TIMEOUT_PARALLEL || '') || DEFAULT_TIMEOUTS.parallel,
    stdinInitial: parseInt(process.env.CREWCODE_TIMEOUT_STDIN_INITIAL || '') || DEFAULT_TIMEOUTS.stdinInitial,
    stdinChunk: parseInt(process.env.CREWCODE_TIMEOUT_STDIN_CHUNK || '') || DEFAULT_TIMEOUTS.stdinChunk,
    stdinComplete: parseInt(process.env.CREWCODE_TIMEOUT_STDIN_COMPLETE || '') || DEFAULT_TIMEOUTS.stdinComplete,
  };
}

/**
 * Get default timeout configuration
 */
export function getDefaultTimeoutConfig(): TimeoutConfig {
  return { ...DEFAULT_TIMEOUTS };
}
