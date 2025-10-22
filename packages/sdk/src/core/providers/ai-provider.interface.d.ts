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
}
export interface AIResponse {
    content: string;
    provider: string;
    command: string;
    success: boolean;
    error?: string;
    taskId?: string;
    toolCall?: {
        toolName: string;
        toolInput: any;
        toolResult: any;
    };
}
export interface AIProvider {
    readonly name: string;
    isAvailable(): Promise<boolean>;
    query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
    getToolPath(): Promise<string | null>;
}
export declare class ProviderNotAvailableError extends Error {
    constructor(providerName: string);
}
