/**
 * Remote Agent Manager Types
 *
 * Pure TypeScript types for remote agent communication
 * with MCP (Model Context Protocol) servers.
 */

/**
 * Remote agent configuration
 */
export interface RemoteAgentConfig {
  /** Remote agent type (currently only mcp-http supported) */
  type: 'mcp-http';
  /** Base URL for the remote MCP server */
  url: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Optional custom headers */
  headers?: Record<string, string>;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
  /** Remote agent ID (may differ from local agent ID) */
  agentId?: string;
  /** Tool name mappings (optional) */
  tools?: {
    query?: string;
    execute?: string;
  };
}

/**
 * Transport abstraction for making HTTP requests
 * This allows for easy testing and different implementations
 */
export interface RemoteTransport {
  /**
   * Send an HTTP request
   * @param url The full URL to send the request to
   * @param options Request options
   */
  request<T = any>(url: string, options: RemoteTransportRequestOptions): Promise<T>;
}

/**
 * Request options for RemoteTransport
 */
export interface RemoteTransportRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
}

/**
 * Remote agent request parameters (query mode)
 */
export interface RemoteAgentQueryRequest {
  /** The agent ID to query */
  agentId: string;
  /** The query text */
  query: string;
  /** Optional context */
  context?: string;
  /** Optional model override */
  model?: string;
  /** Optional platform identifier */
  platform?: string;
  /** Optional conversation messages */
  messages?: Array<{
    text: string;
    isAssistant: boolean;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Remote agent request parameters (execute mode)
 */
export interface RemoteAgentExecuteRequest {
  /** The agent ID to execute */
  agentId: string;
  /** The task to execute */
  task: string;
  /** Optional context */
  context?: string;
  /** Optional model override */
  model?: string;
  /** Optional platform identifier */
  platform?: string;
  /** Optional conversation messages */
  messages?: Array<{
    text: string;
    isAssistant: boolean;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Remote agent response
 */
export interface RemoteAgentResponse {
  /** Response content */
  content: Array<{
    type: string;
    text: string;
  }>;
  /** Success flag */
  success?: boolean;
  /** Error message if failed */
  error?: string;
  /** Response metadata */
  [key: string]: any;
}

/**
 * MCP JSON-RPC 2.0 Request
 */
export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, any>;
}

/**
 * MCP JSON-RPC 2.0 Response
 */
export interface McpJsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Tool name mapping for remote agents
 * Allows customization of tool names per remote server
 */
export interface ToolNameMapping {
  /** Tool name for query operations */
  query: string;
  /** Tool name for execute operations */
  execute: string;
}

/**
 * Remote agent descriptor containing configuration and metadata
 */
export interface RemoteAgentDescriptor {
  /** Local agent ID */
  localAgentId: string;
  /** Remote agent ID (may differ) */
  remoteAgentId: string;
  /** Remote agent configuration */
  config: RemoteAgentConfig;
}
