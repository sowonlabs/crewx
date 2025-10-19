import { Injectable, Logger } from '@nestjs/common';
import { AgentLoaderService } from './agent-loader.service';
import { ConfigService } from './config.service';
import {
  AgentInfo,
  RemoteAgentInfo,
  getErrorMessage,
  RemoteAgentManager,
  RemoteAgentConfig,
} from '@sowonai/crewx-sdk';
import { RemoteProviderConfig } from '@sowonai/crewx-sdk';
import { createSdkLoggerAdapter } from '../providers/logger.adapter';

export interface RemoteAgentDescriptor {
  agent: AgentInfo;
  remote: RemoteAgentInfo;
  providerConfig?: RemoteProviderConfig;
}

/**
 * CLI RemoteAgentService
 *
 * NestJS wrapper around SDK RemoteAgentManager.
 * Provides CLI-specific functionality like config loading from YAML
 * and integration with AgentLoaderService.
 */
@Injectable()
export class RemoteAgentService {
  private readonly logger = new Logger(RemoteAgentService.name);
  private readonly manager: RemoteAgentManager;

  constructor(
    private readonly agentLoaderService: AgentLoaderService,
    private readonly configService: ConfigService,
  ) {
    // Initialize SDK RemoteAgentManager with CLI logger adapter
    this.manager = new RemoteAgentManager({
      logger: createSdkLoggerAdapter(this.logger),
    });
  }

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

      // Load config into SDK manager
      const sdkConfig = this.convertToSdkConfig(remoteInfo);
      this.manager.loadConfig(agent.id, sdkConfig);
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
    const sdkConfig = this.convertToSdkConfig(remote);

    // Ensure config is loaded
    if (!this.manager.isRemoteAgent(agent.id)) {
      this.manager.loadConfig(agent.id, sdkConfig);
    }

    try {
      return await this.manager.query(agent.id, {
        agentId: remote.agentId ?? agent.id,
        query: params.query,
        context: params.context,
        model: params.model,
        platform: params.platform,
        messages: params.messages,
      });
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
    const sdkConfig = this.convertToSdkConfig(remote);

    // Ensure config is loaded
    if (!this.manager.isRemoteAgent(agent.id)) {
      this.manager.loadConfig(agent.id, sdkConfig);
    }

    try {
      return await this.manager.execute(agent.id, {
        agentId: remote.agentId ?? agent.id,
        task: params.task,
        context: params.context,
        model: params.model,
        platform: params.platform,
        messages: params.messages,
      });
    } catch (error) {
      this.logger.error(
        `Remote execute failed for agent ${agent.id}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Convert RemoteAgentInfo to SDK RemoteAgentConfig
   */
  private convertToSdkConfig(remote: RemoteAgentInfo): RemoteAgentConfig {
    return {
      type: remote.type,
      url: remote.url,
      apiKey: remote.apiKey,
      timeoutMs: remote.timeoutMs,
      agentId: remote.agentId,
      tools: remote.tools,
    };
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
      url: providerConfig.location,
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
}
