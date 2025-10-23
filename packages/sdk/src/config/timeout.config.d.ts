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
export declare function getTimeoutConfig(env?: NodeJS.ProcessEnv): TimeoutConfig;
export declare function getDefaultTimeoutConfig(): TimeoutConfig;
