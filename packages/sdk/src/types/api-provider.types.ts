import {
  ProviderModeOptionsSchema,
  ProviderOptionsSchema,
} from '../schemas/api-provider.schema';

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

/**
 * Execution modes supported by CrewX providers.
 * Mirrors CLI behaviour (`query` vs `execute`).
 */
export type ProviderExecutionMode = 'query' | 'execute';

/**
 * Mode-specific capabilities exposed through `options.<mode>` in YAML.
 * Empty arrays indicate no tools/MCP servers are available for that mode.
 */
export interface ProviderModeOptions {
  /** Tool names allowed when the provider runs in this mode */
  tools?: string[];
  /** MCP server references allowed when the provider runs in this mode */
  mcp?: string[];
}

/**
 * Unified provider options map (`options.query/execute`), with room for future modes.
 */
export interface ProviderOptions {
  query?: ProviderModeOptions;
  execute?: ProviderModeOptions;
  /** Allow custom modes without losing type-safety for built-in ones */
  [customMode: string]: ProviderModeOptions | undefined;
}

/**
 * Legacy SowonFlow-style permissions where `tools`/`mcp` lived on the root config.
 * These are maintained for backwards compatibility and converted into ProviderOptions.
 */
export interface LegacyProviderPermissionConfig {
  /** Legacy list of enabled tools (maps to options.execute.tools by default) */
  tools?: string[];
  /** Legacy list of allowed MCP servers */
  mcp?: string[];
  /** Alternate legacy alias kept for YAML snippets that used snake_case */
  mcp_servers?: string[];
}

export interface APIProviderConfig extends LegacyProviderPermissionConfig {
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
  /** Mode-based permissions (WBS-28 Phase 2). Takes precedence over legacy arrays. */
  options?: ProviderOptions;
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


/** Utility: ensure a candidate is an array of strings */
const isStringArray = (candidate: unknown): candidate is string[] =>
  Array.isArray(candidate) && candidate.every((entry) => typeof entry === 'string');

/**
 * Type guard for a single mode configuration (tools/mcp arrays).
 */
export function isProviderModeOptions(candidate: unknown): candidate is ProviderModeOptions {
  const result = ProviderModeOptionsSchema.safeParse(candidate);
  return result.success;
}

/**
 * Type guard for the unified provider options map.
 */
export function isProviderOptions(candidate: unknown): candidate is ProviderOptions {
  const result = ProviderOptionsSchema.safeParse(candidate);
  return result.success;
}

/**
 * Detects whether a config still uses legacy root-level tool or MCP arrays.
 */
export function isLegacyProviderPermissionConfig(
  candidate: unknown,
): candidate is LegacyProviderPermissionConfig {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const value = candidate as LegacyProviderPermissionConfig;
  const hasLegacyFields =
    value.tools !== undefined || value.mcp !== undefined || value.mcp_servers !== undefined;
  if (!hasLegacyFields) {
    return false;
  }

  if (value.tools !== undefined && !isStringArray(value.tools)) {
    return false;
  }
  if (value.mcp !== undefined && !isStringArray(value.mcp)) {
    return false;
  }
  if (value.mcp_servers !== undefined && !isStringArray(value.mcp_servers)) {
    return false;
  }

  return true;
}

/**
 * Convert legacy arrays into the new `options.<mode>` structure.
 * Defaults to populating the execute mode for backwards compatibility.
 */
export function convertLegacyPermissionsToProviderOptions(
  legacy: LegacyProviderPermissionConfig,
  mode: ProviderExecutionMode = 'execute',
): ProviderOptions {
  const normalized: ProviderModeOptions = {};

  if (legacy.tools && legacy.tools.length > 0) {
    normalized.tools = legacy.tools;
  }

  const legacyMcp = legacy.mcp ?? legacy.mcp_servers;
  if (legacyMcp && legacyMcp.length > 0) {
    normalized.mcp = legacyMcp;
  }

  if (!normalized.tools && !normalized.mcp) {
    return {};
  }

  return {
    [mode]: normalized,
  } as ProviderOptions;
}
