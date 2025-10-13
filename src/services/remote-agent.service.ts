import { Injectable, Logger } from '@nestjs/common';
import { AgentLoaderService } from './agent-loader.service';
import { ConfigService } from './config.service';
import { AgentInfo, RemoteAgentInfo } from '../agent.types';
import { RemoteProviderConfig } from '../providers/dynamic-provider.factory';
import { McpClientRequestOptions, McpClientService } from './mcp-client.service';
import { getErrorMessage } from '../utils/error-utils';

export interface RemoteAgentDescriptor {
  agent: AgentInfo;
  remote: RemoteAgentInfo;
  providerConfig?: RemoteProviderConfig;
}

@Injectable()
export class RemoteAgentService {
  private readonly logger = new Logger(RemoteAgentService.name);

  constructor(
    private readonly agentLoaderService: AgentLoaderService,
    private readonly configService: ConfigService,
    private readonly mcpClientService: McpClientService,
  ) {}

  async getRemoteAgents(): Promise<RemoteAgentDescriptor[]> {
    const allAgents = await this.agentLoaderService.getAllAgents();
    const descriptors: RemoteAgentDescriptor[] = [];

    for (const agent of allAgents) {
      const remoteInfo = this.resolveRemoteInfo(agent);
      if (!remoteInfo) {
        continue;
      }

      const providerConfig = this.resolveRemoteProviderConfig(agent);
      descriptors.push({
        agent,
        remote: remoteInfo,
        providerConfig,
      });
    }

    return descriptors;
  }

  async getRemoteAgent(agentId: string): Promise<RemoteAgentDescriptor | undefined> {
    const agents = await this.getRemoteAgents();
    return agents.find((descriptor) => descriptor.agent.id === agentId);
  }

  async isRemoteAgent(agentId: string): Promise<boolean> {
    return Boolean(await this.getRemoteAgent(agentId));
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
    const toolName = remote.tools?.query ?? 'crewx_queryAgent';
    const remoteAgentId = remote.agentId ?? agent.id;

    const payload: Record<string, any> = {
      agentId: remoteAgentId,
      query: params.query,
    };

    if (params.context) {
      payload.context = params.context;
    }

    if (params.model) {
      payload.model = params.model;
    }

    if (params.platform) {
      payload.platform = params.platform;
    }

    if (params.messages && params.messages.length > 0) {
      payload.messages = params.messages;
    }

    try {
      const result = await this.callRemoteTool(remote, toolName, payload);
      return this.normalizeRemoteResponse(result);
    } catch (error) {
      this.logger.error(
        `Remote query failed for agent ${agent.id}: ${getErrorMessage(error)}`,
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
    const toolName = remote.tools?.execute ?? 'crewx_executeAgent';
    const remoteAgentId = remote.agentId ?? agent.id;

    const payload: Record<string, any> = {
      agentId: remoteAgentId,
      task: params.task,
    };

    if (params.context) {
      payload.context = params.context;
    }

    if (params.model) {
      payload.model = params.model;
    }

    if (params.platform) {
      payload.platform = params.platform;
    }

    if (params.messages && params.messages.length > 0) {
      payload.messages = params.messages;
    }

    try {
      const result = await this.callRemoteTool(remote, toolName, payload);
      return this.normalizeRemoteResponse(result);
    } catch (error) {
      this.logger.error(
        `Remote execute failed for agent ${agent.id}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private resolveRemoteInfo(agent: AgentInfo): RemoteAgentInfo | undefined {
    if (agent.remote?.type === 'mcp-http') {
      return agent.remote;
    }

    const providerConfig = this.resolveRemoteProviderConfig(agent);
    if (!providerConfig || !providerConfig.location.startsWith('http')) {
      return undefined;
    }

    const authHeader = providerConfig.auth?.token;
    return {
      type: 'mcp-http',
      url: this.normalizeRemoteUrl(providerConfig.location),
      apiKey: authHeader,
      agentId: providerConfig.external_agent_id,
      timeoutMs: providerConfig.timeout?.query ?? providerConfig.timeout?.execute,
      tools: {
        query: 'crewx_queryAgent',
        execute: 'crewx_executeAgent',
      },
    };
  }

  private resolveRemoteProviderConfig(agent: AgentInfo): RemoteProviderConfig | undefined {
    const providerName = this.normalizeProviderName(agent.provider);
    if (!providerName) {
      return undefined;
    }

    const providers = this.configService.getRemoteProviders();
    const identifier = providerName.includes('/')
      ? providerName.split('/')[1]
      : providerName;

    return providers.find((provider) => provider.id === identifier);
  }

  private normalizeProviderName(provider: AgentInfo['provider']): string | null {
    if (Array.isArray(provider)) {
      return provider.find((id) => typeof id === 'string' && id.startsWith('remote/')) || null;
    }

    if (typeof provider === 'string' && provider.startsWith('remote/')) {
      return provider;
    }

    return null;
  }

  private ensureRemote(agent: AgentInfo): RemoteAgentInfo {
    const remoteInfo = this.resolveRemoteInfo(agent);

    if (!remoteInfo) {
      throw new Error(`Agent ${agent.id} is not configured as a remote MCP agent`);
    }

    return remoteInfo;
  }

  private async callRemoteTool(remote: RemoteAgentInfo, toolName: string, args: Record<string, any>): Promise<any> {
    const options: McpClientRequestOptions = {
      baseUrl: this.normalizeRemoteUrl(remote.url),
      apiKey: remote.apiKey,
      timeoutMs: remote.timeoutMs,
    };

    this.logger.debug(`Calling remote MCP tool ${toolName} on ${options.baseUrl}`);
    return this.mcpClientService.callTool(toolName, args, options);
  }

  private normalizeRemoteResponse(result: any): any {
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

    if (Array.isArray(result.content) && result.content.length > 0) {
      return result;
    }

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

  private normalizeRemoteUrl(url: string): string {
    if (!url) {
      return url;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return trimmed;
    }

    const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
    return withoutTrailingSlash.toLowerCase().endsWith('/mcp')
      ? withoutTrailingSlash.slice(0, -4)
      : withoutTrailingSlash;
  }
}
