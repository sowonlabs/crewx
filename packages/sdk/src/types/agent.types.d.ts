export interface RemoteAgentToolsConfig {
    query?: string;
    execute?: string;
}
export interface RemoteAgentConfigInput {
    type: 'mcp-http';
    url: string;
    apiKey?: string;
    api_key?: string;
    agentId?: string;
    agent_id?: string;
    timeoutMs?: number;
    timeout_ms?: number;
    tools?: RemoteAgentToolsConfig;
}
export interface RemoteAgentInfo {
    type: 'mcp-http';
    url: string;
    apiKey?: string;
    agentId?: string;
    timeoutMs?: number;
    tools?: RemoteAgentToolsConfig;
}
export interface AgentConfig {
    id: string;
    working_directory: string;
    inline: {
        type: 'agent';
        provider: 'claude' | 'gemini' | 'copilot';
        system_prompt: string;
        model?: string;
        documents?: Record<string, string>;
    };
    options?: {
        query?: string[];
        execute?: string[];
    };
    tools?: string[];
    capabilities?: {
        autonomous_work?: boolean;
        file_operations?: boolean;
        tool_access?: string[];
    };
    remote?: RemoteAgentConfigInput;
}
export declare enum SecurityLevel {
    SAFE = "safe",
    MODERATE = "moderate",
    DANGEROUS = "dangerous",
    CRITICAL = "critical"
}
export declare enum ExecutionMode {
    QUERY = "query",
    EXECUTE = "execute"
}
export interface AgentsConfig {
    documents?: Record<string, string>;
    agents: AgentConfig[];
}
export interface AgentQueryOptions {
    workingDirectory?: string;
    context?: string;
    timeout?: number;
    readOnlyMode?: boolean;
    executionMode?: ExecutionMode;
    securityLevel?: SecurityLevel;
    additionalArgs?: string[];
    model?: string;
}
export interface AgentResponse {
    content: string;
    agent: string;
    provider: string;
    command: string;
    success: boolean;
    error?: string;
    actions?: AgentAction[];
    readOnly?: boolean;
    taskId?: string;
}
export interface AgentAction {
    type: 'file_read' | 'file_write' | 'tool_call' | 'analysis';
    target: string;
    result: string;
    timestamp: Date;
}
export interface AgentInfo {
    id: string;
    name?: string;
    role?: string;
    team?: string;
    provider: 'claude' | 'gemini' | 'copilot' | 'remote' | `remote/${string}` | ('claude' | 'gemini' | 'copilot')[];
    workingDirectory: string;
    capabilities: string[];
    description: string;
    specialties?: string[];
    systemPrompt?: string;
    options?: string[] | {
        query?: string[] | {
            claude?: string[];
            gemini?: string[];
            copilot?: string[];
        };
        execute?: string[] | {
            claude?: string[];
            gemini?: string[];
            copilot?: string[];
        };
    };
    inline?: {
        type: 'agent';
        provider: 'claude' | 'gemini' | 'copilot';
        system_prompt: string;
        model?: string;
    };
    remote?: RemoteAgentInfo;
}
