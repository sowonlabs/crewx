/**
 * Configuration accepted by API-based providers (LiteLLM/OpenAI-compatible gateways).
 */
export type APIProviderType =
  | 'api/openai'
  | 'api/anthropic'
  | 'api/google'
  | 'api/bedrock'
  | 'api/litellm'
  | 'api/ollama'
  | 'api/sowonai';

export interface APIProviderConfig {
  provider: APIProviderType;
  /** API base URL (e.g., https://api.openai.com/v1, http://localhost:4000) */
  url?: string;
  /** API key (optional, can use environment variables) */
  apiKey?: string;
  /** Exact model identifier understood by the API */
  model: string;
  /** Temperature (0.0-2.0, optional to keep defaults flexible) */
  temperature?: number;
  /** Optional upper bound for completion tokens */
  maxTokens?: number;
  /** Tool names to activate (simple array - SowonFlow style) */
  tools?: string[];
  /** MCP server names to activate (simple array - SowonFlow style) */
  mcp?: string[];
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Framework Tool Definition (Vercel AI SDK pattern)
 * Tools are defined in TypeScript code and injected via CrewXOptions.tools
 * NOT defined in YAML!
 */
export interface FrameworkToolDefinition {
  name: string;
  description: string;
  parameters: any; // z.ZodSchema (avoiding zod import here)
  execute: (args: any, context: ToolExecutionContext) => Promise<any>;
}

/**
 * Tool Execution Context
 * Passed to tool execute functions (matches CLI template rendering context exactly!)
 *
 * Template System Integration:
 * - {{env.VAR}} - Environment variables
 * - {{agent.id}} - Agent info
 * - {{context.key}} - User-defined context
 * - {{vars.customKey}} - Custom variables
 * - {{tools.count}} - Tool info
 * - {{messages.length}} - Conversation history
 * - {{documents.name.content}} - Document access
 * - {{mode}} - Execution mode (query | execute)
 * - {{platform}} - Platform (cli | slack | api)
 */
export interface ToolExecutionContext {
  /** Agent information ({{agent.id}}, {{agent.provider}}) */
  agent: {
    id: string;
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };

  /** Agent metadata ({{agentMetadata.description}}) */
  agentMetadata?: Record<string, any>;

  /** Environment variables ({{env.VAR}}) */
  env: Record<string, string>;

  /** User-defined context ({{context.key}}) */
  context?: Record<string, any>;

  /** Custom variables ({{vars.key}}) */
  vars?: Record<string, any>;

  /** Execution mode ({{mode}}) - query | execute */
  mode?: 'query' | 'execute';

  /** Conversation messages ({{messages.length}}) */
  messages?: any[];

  /** Platform ({{platform}}) - cli | slack | api */
  platform?: string;

  /** Tools info ({{tools.count}}, {{tools.json}}) */
  tools?: {
    available: string[];
    count: number;
    json?: string;
  };

  /** Document access ({{documents.name.content}}) */
  documents?: Record<
    string,
    {
      content?: string;
      toc?: string;
      summary?: string;
    }
  >;

  /** Request metadata */
  request?: {
    timestamp: Date;
    conversationId?: string;
    threadId?: string;
  };

  /** CrewX instance for inter-agent communication (agent_call built-in tool) */
  crewx?: CrewXInstance;
}

/**
 * CrewX Instance Interface
 * Main framework instance for managing agents and tools
 */
export interface CrewXInstance {
  /** Get agent by ID */
  getAgent(agentId: string): any; // Avoid circular dependency

  /** Run agent with input */
  runAgent(agentId: string, options: {
    input: string;
    context?: Record<string, any>;
  }): Promise<any>;
}
