import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AgentInfo, RemoteAgentInfo } from '../agent.types';
import { getErrorMessage } from '../utils/error-utils';

@Injectable()
export class RemoteAgentService {
  private readonly logger = new Logger(RemoteAgentService.name);

  private getFetch(): any {
    const fetchFn = (globalThis as any).fetch;
    if (typeof fetchFn !== 'function') {
      throw new Error('Fetch API is not available in this runtime environment');
    }
    return fetchFn.bind(globalThis);
  }

  private async callRemoteTool(
    config: RemoteAgentInfo,
    toolName: string,
    args: Record<string, any>,
  ): Promise<any> {
    const fetchFn = this.getFetch();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = config.timeoutMs ?? 600_000; // default 10 minutes
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const body = {
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    try {
      const response = await fetchFn(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Remote MCP server responded with ${response.status} ${response.statusText}${
            errorText ? `: ${errorText}` : ''
          }`,
        );
      }

      const payload = await response.json();
      if (payload?.error) {
        const message = payload.error?.message || JSON.stringify(payload.error);
        throw new Error(`Remote MCP error: ${message}`);
      }

      return payload?.result;
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        throw new Error(`Remote MCP request timed out after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private ensureRemote(agent: AgentInfo): RemoteAgentInfo {
    if (!agent.remote || agent.remote.type !== 'mcp-http') {
      throw new Error(`Agent ${agent.id} is not configured as a remote MCP agent`);
    }
    return agent.remote;
  }

  async queryRemoteAgent(
    agent: AgentInfo,
    params: {
      query: string;
      context?: string;
      model?: string;
      platform?: string;
      messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
    },
  ): Promise<any> {
    const remote = this.ensureRemote(agent);
    const toolName = remote.tools?.query ?? 'query_agent';
    const remoteAgentId = remote.agentId ?? agent.id;

    const args: Record<string, any> = {
      agentId: remoteAgentId,
      query: params.query,
    };

    if (params.context) {
      args.context = params.context;
    }

    if (params.model) {
      args.model = params.model;
    }

    this.logger.debug(
      `Calling remote MCP query tool ${toolName} for agent ${agent.id} at ${remote.url}`,
    );

    try {
      return await this.callRemoteTool(remote, toolName, args);
    } catch (error) {
      this.logger.error(
        `Remote query for agent ${agent.id} failed: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async executeRemoteAgent(
    agent: AgentInfo,
    params: {
      task: string;
      context?: string;
      model?: string;
      platform?: string;
      messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
    },
  ): Promise<any> {
    const remote = this.ensureRemote(agent);
    const toolName = remote.tools?.execute ?? 'execute_agent';
    const remoteAgentId = remote.agentId ?? agent.id;

    const args: Record<string, any> = {
      agentId: remoteAgentId,
      task: params.task,
    };

    if (params.context) {
      args.context = params.context;
    }

    if (params.model) {
      args.model = params.model;
    }

    this.logger.debug(
      `Calling remote MCP execute tool ${toolName} for agent ${agent.id} at ${remote.url}`,
    );

    try {
      return await this.callRemoteTool(remote, toolName, args);
    } catch (error) {
      this.logger.error(
        `Remote execute for agent ${agent.id} failed: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
