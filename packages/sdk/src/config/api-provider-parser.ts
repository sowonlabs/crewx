/**
 * API Provider Configuration Parser
 *
 * Parses YAML configuration for API providers and converts it to APIProviderConfig.
 * Supports environment variable substitution ({{env.VAR}} format) and validation.
 */

import { APIProviderConfig, APIProviderType, MCPServerConfig } from '../types/api-provider.types';

/**
 * Error thrown when API provider configuration parsing fails
 */
export class APIProviderParseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'APIProviderParseError';
  }
}

/**
 * Raw YAML agent configuration structure
 */
export interface RawAgentConfig {
  id?: string;
  name?: string;
  provider?: string;
  url?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  prompt?: string;
  tools?: string[] | { include?: string[]; exclude?: string[] };
  mcp?: string[] | { include?: string[]; exclude?: string[] };
  inline?: {
    provider?: string;
    url?: string;
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    prompt?: string;
  };
}

/**
 * Raw YAML configuration structure
 */
export interface RawYAMLConfig {
  vars?: Record<string, any>;
  mcp_servers?: Record<string, RawMCPServerConfig>;
  agents?: RawAgentConfig[];
}

/**
 * Raw MCP server configuration
 */
export interface RawMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Parse API provider configuration from raw YAML data
 *
 * @param rawConfig - Raw YAML agent configuration
 * @param globalEnv - Global environment variables
 * @returns Parsed and validated APIProviderConfig
 * @throws {APIProviderParseError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const rawConfig = {
 *   provider: 'api/openai',
 *   url: 'https://api.openai.com/v1',
 *   apiKey: '{{env.OPENAI_API_KEY}}',
 *   model: 'gpt-4o',
 *   temperature: 0.7,
 *   tools: ['company_search', 'weather']
 * };
 * const config = parseAPIProviderConfig(rawConfig, process.env);
 * ```
 */
export function parseAPIProviderConfig(
  rawConfig: RawAgentConfig,
  globalEnv: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): APIProviderConfig {
  // Determine provider string (from provider field or inline.provider)
  const providerStr = rawConfig.provider || rawConfig.inline?.provider;
  if (!providerStr) {
    throw new APIProviderParseError('Provider is required for API provider configuration');
  }

  // Validate provider type
  const validProviders: APIProviderType[] = [
    'api/openai',
    'api/anthropic',
    'api/google',
    'api/bedrock',
    'api/litellm',
    'api/ollama',
    'api/sowonai',
  ];

  if (!validProviders.includes(providerStr as APIProviderType)) {
    throw new APIProviderParseError(
      `Invalid API provider '${providerStr}'. Valid providers: ${validProviders.join(', ')}`,
    );
  }

  // Get model (required)
  const model = rawConfig.model || rawConfig.inline?.model;
  if (!model) {
    throw new APIProviderParseError(`Model is required for API provider '${providerStr}'`);
  }

  // Build config with environment variable substitution
  const config: APIProviderConfig = {
    provider: providerStr as APIProviderType,
    model: substituteEnvVars(model, globalEnv),
  };

  // Optional: url
  const url = rawConfig.url || rawConfig.inline?.url;
  if (url) {
    config.url = substituteEnvVars(url, globalEnv);
  }

  // Optional: apiKey
  const apiKey = rawConfig.apiKey || rawConfig.inline?.apiKey;
  if (apiKey) {
    config.apiKey = substituteEnvVars(apiKey, globalEnv);
  }

  // Optional: temperature
  const temperature = rawConfig.temperature ?? rawConfig.inline?.temperature;
  if (temperature !== undefined) {
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
      throw new APIProviderParseError(
        `Temperature must be a number between 0 and 2, got: ${temperature}`,
      );
    }
    config.temperature = temperature;
  }

  // Optional: maxTokens
  const maxTokens = rawConfig.maxTokens ?? rawConfig.inline?.maxTokens;
  if (maxTokens !== undefined) {
    if (typeof maxTokens !== 'number' || maxTokens < 1 || !Number.isInteger(maxTokens)) {
      throw new APIProviderParseError(
        `maxTokens must be a positive integer, got: ${maxTokens}`,
      );
    }
    config.maxTokens = maxTokens;
  }

  // Optional: tools (simple array only for API providers)
  if (rawConfig.tools) {
    if (Array.isArray(rawConfig.tools)) {
      config.tools = rawConfig.tools;
    } else {
      throw new APIProviderParseError(
        'API provider tools must be a simple array of strings (e.g., tools: [github, slack])',
      );
    }
  }

  // Optional: mcp (simple array only for API providers)
  if (rawConfig.mcp) {
    if (Array.isArray(rawConfig.mcp)) {
      config.mcp = rawConfig.mcp;
    } else {
      throw new APIProviderParseError(
        'API provider mcp must be a simple array of strings (e.g., mcp: [github, slack])',
      );
    }
  }

  return config;
}

/**
 * Parse MCP server configuration from raw YAML data
 *
 * @param rawMCPServers - Raw YAML MCP server configurations
 * @param globalEnv - Global environment variables
 * @returns Parsed MCP server configurations
 * @throws {APIProviderParseError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const rawMCPServers = {
 *   github: {
 *     command: 'npx',
 *     args: ['-y', '@modelcontextprotocol/server-github'],
 *     env: {
 *       GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}'
 *     }
 *   }
 * };
 * const mcpServers = parseMCPServers(rawMCPServers, process.env);
 * ```
 */
export function parseMCPServers(
  rawMCPServers: Record<string, RawMCPServerConfig>,
  globalEnv: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Record<string, MCPServerConfig> {
  const result: Record<string, MCPServerConfig> = {};

  for (const [name, rawConfig] of Object.entries(rawMCPServers)) {
    if (!rawConfig.command) {
      throw new APIProviderParseError(`MCP server '${name}' is missing 'command' field`);
    }

    if (!Array.isArray(rawConfig.args)) {
      throw new APIProviderParseError(`MCP server '${name}' 'args' must be an array`);
    }

    const mcpConfig: MCPServerConfig = {
      command: substituteEnvVars(rawConfig.command, globalEnv),
      args: rawConfig.args.map((arg) => substituteEnvVars(arg, globalEnv)),
    };

    // Optional: env
    if (rawConfig.env) {
      mcpConfig.env = {};
      for (const [key, value] of Object.entries(rawConfig.env)) {
        mcpConfig.env[key] = substituteEnvVars(value, globalEnv);
      }
    }

    result[name] = mcpConfig;
  }

  return result;
}

/**
 * Substitute environment variables in a string
 *
 * Supports {{env.VAR}} template format.
 *
 * @param str - String with environment variable templates
 * @param env - Environment variables
 * @returns String with substituted values
 *
 * @example
 * ```typescript
 * substituteEnvVars('{{env.OPENAI_API_KEY}}', { OPENAI_API_KEY: 'sk-...' })
 * // Returns: 'sk-...'
 *
 * substituteEnvVars('https://api.com?key={{env.API_KEY}}', { API_KEY: 'abc' })
 * // Returns: 'https://api.com?key=abc'
 * ```
 */
export function substituteEnvVars(
  str: string,
  env: Record<string, string | undefined>,
): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // Replace {{env.VAR}} with actual environment variable value
  return str.replace(/\{\{env\.([A-Z0-9_]+)\}\}/g, (match, varName) => {
    const value = env[varName];
    if (value === undefined) {
      throw new APIProviderParseError(
        `Environment variable '${varName}' is not defined (referenced as ${match})`,
      );
    }
    return value;
  });
}

/**
 * Parse complete YAML configuration including vars, mcp_servers, and agents
 *
 * @param rawConfig - Raw YAML configuration object
 * @param globalEnv - Global environment variables
 * @returns Parsed configuration components
 * @throws {APIProviderParseError} If configuration is invalid
 *
 * @example
 * ```typescript
 * const rawYAML = yaml.load(fs.readFileSync('crewx.yaml', 'utf8'));
 * const config = parseCrewXConfig(rawYAML, process.env);
 * ```
 */
export function parseCrewXConfig(
  rawConfig: RawYAMLConfig,
  globalEnv: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): {
  vars: Record<string, any>;
  mcpServers: Record<string, MCPServerConfig>;
  agents: APIProviderConfig[];
} {
  const result = {
    vars: rawConfig.vars || {},
    mcpServers: {} as Record<string, MCPServerConfig>,
    agents: [] as APIProviderConfig[],
  };

  // Parse MCP servers
  if (rawConfig.mcp_servers) {
    result.mcpServers = parseMCPServers(rawConfig.mcp_servers, globalEnv);
  }

  // Parse agents
  if (rawConfig.agents && Array.isArray(rawConfig.agents)) {
    for (const rawAgent of rawConfig.agents) {
      // Only parse API providers
      const providerStr = rawAgent.provider || rawAgent.inline?.provider;
      if (providerStr && providerStr.startsWith('api/')) {
        try {
          const agentConfig = parseAPIProviderConfig(rawAgent, globalEnv);
          result.agents.push(agentConfig);
        } catch (error) {
          throw new APIProviderParseError(
            `Failed to parse agent '${rawAgent.id || 'unknown'}': ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error : undefined,
          );
        }
      }
    }
  }

  return result;
}

/**
 * Validate APIProviderConfig object
 *
 * @param config - API provider configuration to validate
 * @returns True if valid
 * @throws {APIProviderParseError} If validation fails
 */
export function validateAPIProviderConfig(config: APIProviderConfig): boolean {
  if (!config || typeof config !== 'object') {
    throw new APIProviderParseError('Configuration must be a valid object');
  }

  // Validate provider
  const validProviders: APIProviderType[] = [
    'api/openai',
    'api/anthropic',
    'api/google',
    'api/bedrock',
    'api/litellm',
    'api/ollama',
    'api/sowonai',
  ];

  if (!validProviders.includes(config.provider)) {
    throw new APIProviderParseError(
      `Invalid provider '${config.provider}'. Valid providers: ${validProviders.join(', ')}`,
    );
  }

  // Validate model
  if (!config.model || typeof config.model !== 'string') {
    throw new APIProviderParseError('Model is required and must be a non-empty string');
  }

  // Validate temperature (if present)
  if (config.temperature !== undefined) {
    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
      throw new APIProviderParseError(
        `Temperature must be a number between 0 and 2, got: ${config.temperature}`,
      );
    }
  }

  // Validate maxTokens (if present)
  if (config.maxTokens !== undefined) {
    if (typeof config.maxTokens !== 'number' || config.maxTokens < 1 || !Number.isInteger(config.maxTokens)) {
      throw new APIProviderParseError(
        `maxTokens must be a positive integer, got: ${config.maxTokens}`,
      );
    }
  }

  // Validate tools (if present)
  if (config.tools !== undefined) {
    if (!Array.isArray(config.tools)) {
      throw new APIProviderParseError('tools must be an array of strings');
    }
    for (const tool of config.tools) {
      if (typeof tool !== 'string') {
        throw new APIProviderParseError('All tool names must be strings');
      }
    }
  }

  // Validate mcp (if present)
  if (config.mcp !== undefined) {
    if (!Array.isArray(config.mcp)) {
      throw new APIProviderParseError('mcp must be an array of strings');
    }
    for (const mcpServer of config.mcp) {
      if (typeof mcpServer !== 'string') {
        throw new APIProviderParseError('All MCP server names must be strings');
      }
    }
  }

  return true;
}
