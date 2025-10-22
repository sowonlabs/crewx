import { Injectable, Logger } from '@nestjs/common';

export interface McpClientRequestOptions {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

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

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);

  private resolveEndpoint(baseUrl: string, path: string): string {
    const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmed}${path}`;
  }

  private buildHeaders(options: McpClientRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    return headers;
  }

  async sendRequest<T = any>(
    method: string,
    params: Record<string, any> = {},
    options: McpClientRequestOptions,
  ): Promise<T> {
    const url = this.resolveEndpoint(options.baseUrl, '/mcp');
    const requestBody = {
      jsonrpc: '2.0' as const,
      id: `${method}-${Date.now()}`,
      method,
      params,
    };

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(options),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
      }

      const payload = (await response.json()) as McpJsonRpcResponse<T>;

      if (payload.error) {
        throw new Error(payload.error.message || 'MCP server returned an error');
      }

      return payload.result as T;
    } catch (error: any) {
      this.logger.error(
        `MCP request failed (method: ${method}, url: ${url}): ${error.message || error}`,
      );
      throw error;
    }
  }

  async listTools(options: McpClientRequestOptions): Promise<any> {
    return this.sendRequest('tools/list', {}, options);
  }

  async callTool(
    toolName: string,
    args: Record<string, any>,
    options: McpClientRequestOptions,
  ): Promise<any> {
    return this.sendRequest('tools/call', { name: toolName, arguments: args }, options);
  }

  async queryAgent(
    payload: Record<string, any>,
    options: McpClientRequestOptions,
  ): Promise<any> {
    return this.callTool('crewx_queryAgent', payload, options);
  }

  async executeAgent(
    payload: Record<string, any>,
    options: McpClientRequestOptions,
  ): Promise<any> {
    return this.callTool('crewx_executeAgent', payload, options);
  }
}
