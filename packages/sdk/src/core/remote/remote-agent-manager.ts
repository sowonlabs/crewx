/**
 * Remote Agent Manager
 *
 * Core SDK logic for managing remote agents via MCP (Model Context Protocol).
 * Pure TypeScript implementation without NestJS dependencies.
 *
 * This manager handles:
 * - Remote agent configuration loading
 * - MCP HTTP communication
 * - Response normalization
 * - Tool name mapping
 * - URL processing
 */

import {
  RemoteAgentConfig,
  RemoteTransport,
  RemoteAgentQueryRequest,
  RemoteAgentExecuteRequest,
  RemoteAgentResponse,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  ToolNameMapping,
} from './types';
import { FetchRemoteTransport } from './remote-transport';

/**
 * Options for creating a RemoteAgentManager
 */
export interface RemoteAgentManagerOptions {
  /** Optional custom transport (defaults to FetchRemoteTransport) */
  transport?: RemoteTransport;
  /** Optional logger function */
  logger?: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void;
}

/**
 * Remote Agent Manager
 *
 * Manages communication with remote MCP agents.
 * Can be used standalone or integrated into CLI/server applications.
 */
export class RemoteAgentManager {
  private transport: RemoteTransport;
  private logger: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void;
  private configs = new Map<string, RemoteAgentConfig>();

  constructor(options: RemoteAgentManagerOptions = {}) {
    this.transport = options.transport || new FetchRemoteTransport();
    this.logger = options.logger || (() => {});
  }

  /**
   * Load configuration for a remote agent
   * @param agentId Local agent identifier
   * @param config Remote agent configuration
   */
  loadConfig(agentId: string, config: RemoteAgentConfig): void {
    this.validateConfig(config);
    this.configs.set(agentId, config);
    this.logger(`Loaded remote agent config for: ${agentId}`, 'debug');
  }

  /**
   * Load multiple remote agent configurations
   * @param configs Map of agent IDs to configurations
   */
  loadConfigs(configs: Map<string, RemoteAgentConfig> | Record<string, RemoteAgentConfig>): void {
    const configMap = configs instanceof Map ? configs : new Map(Object.entries(configs));

    for (const [agentId, config] of configMap) {
      this.loadConfig(agentId, config);
    }
  }

  /**
   * Get configuration for a remote agent
   * @param agentId Local agent identifier
   */
  getConfig(agentId: string): RemoteAgentConfig | undefined {
    return this.configs.get(agentId);
  }

  /**
   * Check if an agent is configured as remote
   * @param agentId Local agent identifier
   */
  isRemoteAgent(agentId: string): boolean {
    return this.configs.has(agentId);
  }

  /**
   * Get all configured remote agent IDs
   */
  getRemoteAgentIds(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Query a remote agent
   * @param agentId Local agent identifier
   * @param request Query request parameters
   */
  async query(agentId: string, request: RemoteAgentQueryRequest): Promise<RemoteAgentResponse> {
    const config = this.getConfig(agentId);
    if (!config) {
      throw new Error(`Agent ${agentId} is not configured as a remote agent`);
    }

    const toolName = config.tools?.query ?? 'crewx_queryAgent';
    const remoteAgentId = config.agentId ?? agentId;

    const payload: Record<string, any> = {
      agentId: remoteAgentId,
      query: request.query,
    };

    if (request.context) {
      payload.context = request.context;
    }

    if (request.model) {
      payload.model = request.model;
    }

    if (request.platform) {
      payload.platform = request.platform;
    }

    if (request.messages && request.messages.length > 0) {
      payload.messages = request.messages;
    }

    try {
      const result = await this.callRemoteTool(config, toolName, payload);
      return this.normalizeResponse(result);
    } catch (error: any) {
      this.logger(`Remote query failed for agent ${agentId}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Execute a task on a remote agent
   * @param agentId Local agent identifier
   * @param request Execute request parameters
   */
  async execute(
    agentId: string,
    request: RemoteAgentExecuteRequest,
  ): Promise<RemoteAgentResponse> {
    const config = this.getConfig(agentId);
    if (!config) {
      throw new Error(`Agent ${agentId} is not configured as a remote agent`);
    }

    const toolName = config.tools?.execute ?? 'crewx_executeAgent';
    const remoteAgentId = config.agentId ?? agentId;

    const payload: Record<string, any> = {
      agentId: remoteAgentId,
      task: request.task,
    };

    if (request.context) {
      payload.context = request.context;
    }

    if (request.model) {
      payload.model = request.model;
    }

    if (request.platform) {
      payload.platform = request.platform;
    }

    if (request.messages && request.messages.length > 0) {
      payload.messages = request.messages;
    }

    try {
      const result = await this.callRemoteTool(config, toolName, payload);
      return this.normalizeResponse(result);
    } catch (error: any) {
      this.logger(`Remote execute failed for agent ${agentId}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Call a remote MCP tool
   * @param config Remote agent configuration
   * @param toolName Name of the MCP tool to call
   * @param args Tool arguments
   */
  private async callRemoteTool(
    config: RemoteAgentConfig,
    toolName: string,
    args: Record<string, any>,
  ): Promise<any> {
    const baseUrl = this.normalizeUrl(config.url);
    const url = `${baseUrl}/mcp`;

    const request: McpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: `${toolName}-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const headers: Record<string, string> = {
      ...(config.headers || {}),
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    this.logger(`Calling remote MCP tool ${toolName} on ${baseUrl}`, 'debug');

    const response = await this.transport.request<McpJsonRpcResponse>(url, {
      method: 'POST',
      headers,
      body: request,
      timeoutMs: config.timeoutMs,
    });

    if (response.error) {
      throw new Error(response.error.message || 'MCP server returned an error');
    }

    return response.result;
  }

  /**
   * Normalize remote agent response
   * Ensures consistent response format with content array
   * @param result Raw result from remote agent
   */
  normalizeResponse(result: any): RemoteAgentResponse {
    if (!result) {
      return {
        success: false,
        content: [
          {
            type: 'text',
            text: 'Remote agent returned no response.',
          },
        ],
      };
    }

    // If already has content array, return as-is
    if (Array.isArray(result.content) && result.content.length > 0) {
      return result as RemoteAgentResponse;
    }

    // Extract content from various possible fields
    const fallbackContent =
      result.response ?? result.implementation ?? result.message ?? result.output;

    const text =
      typeof fallbackContent === 'string'
        ? fallbackContent
        : JSON.stringify(fallbackContent ?? result, null, 2);

    return {
      ...result,
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  }

  /**
   * Normalize remote URL
   * - Removes trailing slashes
   * - Removes redundant /mcp suffix
   * @param url Raw URL string
   */
  normalizeUrl(url: string): string {
    if (!url) {
      return url;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return trimmed;
    }

    // Remove trailing slashes
    const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

    // Remove /mcp suffix if present (will be added in callRemoteTool)
    return withoutTrailingSlash.toLowerCase().endsWith('/mcp')
      ? withoutTrailingSlash.slice(0, -4)
      : withoutTrailingSlash;
  }

  /**
   * Map tool names for a remote agent
   * @param agentId Local agent identifier
   * @param mapping Tool name mapping
   */
  mapToolNames(agentId: string, mapping: Partial<ToolNameMapping>): void {
    const config = this.getConfig(agentId);
    if (!config) {
      throw new Error(`Agent ${agentId} is not configured as a remote agent`);
    }

    config.tools = {
      query: mapping.query ?? config.tools?.query ?? 'crewx_queryAgent',
      execute: mapping.execute ?? config.tools?.execute ?? 'crewx_executeAgent',
    };

    this.logger(`Updated tool name mapping for agent ${agentId}`, 'debug');
  }

  /**
   * Validate remote agent configuration
   * @param config Configuration to validate
   */
  private validateConfig(config: RemoteAgentConfig): void {
    if (!config.url) {
      throw new Error('Remote agent configuration requires a URL');
    }

    if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      throw new Error('Remote agent URL must start with http:// or https://');
    }

    if (config.type !== 'mcp-http') {
      throw new Error(`Unsupported remote agent type: ${config.type}`);
    }
  }

  /**
   * Clear all configurations
   * Useful for testing or resetting state
   */
  clearConfigs(): void {
    this.configs.clear();
    this.logger('Cleared all remote agent configurations', 'debug');
  }
}
