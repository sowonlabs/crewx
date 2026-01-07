export declare const ProviderNamespace: {
    readonly CLI: "cli";
    readonly PLUGIN: "plugin";
    readonly API: "api";
    readonly REMOTE: "remote";
};
export type ProviderNamespaceType = typeof ProviderNamespace[keyof typeof ProviderNamespace];
export declare const BuiltInProviders: {
    readonly CLAUDE: "cli/claude";
    readonly GEMINI: "cli/gemini";
    readonly COPILOT: "cli/copilot";
    readonly CODEX: "cli/codex";
};
export interface AIQueryOptions {
    timeout?: number;
    workingDirectory?: string;
    additionalArgs?: string[];
    taskId?: string;
    model?: string;
    securityKey?: string;
    agentId?: string;
    messages?: Array<{
        text: string;
        isAssistant: boolean;
        metadata?: Record<string, any>;
    }>;
    pipedContext?: string;
    /** Phase 3b: Trace ID for call chain tracking */
    traceId?: string;
    /** Phase 4: Callback invoked when the CLI process starts */
    onProcessStart?: (pid: number) => void;
}
export interface AIResponse {
    content: string;
    provider: string;
    command: string;
    success: boolean;
    error?: string;
    taskId?: string;
    model?: string;
    toolCall?: {
        toolName: string;
        toolInput: any;
        toolResult: any;
    };
    /** Phase 4: Process ID of the spawned CLI process */
    pid?: number;
    /** Exit code reported by the CLI process (null if unavailable). */
    exitCode?: number | null;
    /** Total duration from spawn to completion in milliseconds. */
    durationMs?: number;
    /** Time from spawn to first stdout/stderr output in milliseconds. */
    timeToFirstOutputMs?: number;
    /** Length of the prompt in characters. */
    promptLength?: number;
}
export interface AIProvider {
    readonly name: string;
    isAvailable(): Promise<boolean>;
    query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
    execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
    getToolPath(): Promise<string | null>;
}
export declare class ProviderNotAvailableError extends Error {
    constructor(providerName: string);
}
