import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  MockProvider,
  ProviderNotAvailableError,
  createCrewxAgent,
  type AIProvider,
  type CrewxAgentResult,
  type ProviderConfig,
  type ProviderResolutionResult,
} from '@sowonai/crewx-sdk';
import { AIProviderService } from '../ai-provider.service';
import { ConfigService } from './config.service';
import type { PluginProviderConfig, RemoteProviderConfig } from '@sowonai/crewx-sdk';

export type ProviderBridgeInput = string | ProviderConfig | AIProvider | undefined;

export interface ProviderBridgeAgentOptions {
  provider?: ProviderBridgeInput;
  defaultAgentId?: string;
  validAgents?: string[];
  enableCallStack?: boolean;
}

export interface ProviderBridgeAgentRuntime {
  runtime: CrewxAgentResult;
  resolution: ProviderResolutionResult;
}

const BUILTIN_FALLBACK_ORDER = [
  'cli/claude',
  'claude',
  'cli/gemini',
  'gemini',
  'cli/copilot',
  'copilot',
  'cli/codex',
  'codex',
];

@Injectable()
export class ProviderBridgeService {
  private readonly logger = new Logger(ProviderBridgeService.name);

  constructor(
    private readonly aiProviderService: AIProviderService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Resolve a provider specification or instance into the runtime form expected by the SDK.
   */
  async resolveProvider(input?: ProviderBridgeInput): Promise<ProviderResolutionResult> {
    if (this.isAIProvider(input)) {
      this.logger.debug(`Using direct AIProvider instance: ${input.name ?? 'anonymous'}`);
      return { provider: input };
    }

    if (this.isProviderConfig(input)) {
      const key = `${input.namespace}/${input.id}`;
      const provider = this.findProviderByString(key);

      if (!provider) {
        throw new ProviderNotAvailableError(key);
      }

      return {
        provider,
        defaultModel: this.getDefaultModel(provider.name, input),
      };
    }

    if (typeof input === 'string' && input.trim().length > 0) {
      const provider = this.findProviderByString(input);

      if (!provider) {
        throw new ProviderNotAvailableError(input);
      }

      return {
        provider,
        defaultModel: this.getDefaultModel(provider.name),
      };
    }

    const fallbackProvider = this.getDefaultProvider();
    this.logger.debug(`Resolved fallback provider: ${fallbackProvider.name}`);
    return {
      provider: fallbackProvider,
      defaultModel: this.getDefaultModel(fallbackProvider.name),
    };
  }

  /**
   * Convenience helper for retrieving the resolved provider instance.
   */
  async getProviderForSDK(input?: ProviderBridgeInput): Promise<AIProvider> {
    const { provider } = await this.resolveProvider(input);
    return provider;
  }

  /**
   * Return the list of providers registered with the CLI in SDK format (namespace/id).
   */
  listAvailableProviders(): string[] {
    const registered = this.aiProviderService.getAvailableProviders();

    if (!Array.isArray(registered) || registered.length === 0) {
      return [];
    }

    const normalized = new Set<string>();

    for (const name of registered) {
      normalized.add(this.normalizeOutputName(name));
    }

    return Array.from(normalized).sort();
  }

  /**
   * Check whether a provider is available for use.
   */
  async isProviderAvailable(input?: ProviderBridgeInput): Promise<boolean> {
    try {
      const provider = await this.getProviderForSDK(input);
      return await provider.isAvailable();
    } catch (error) {
      this.logger.debug(`Provider availability check failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Create a CrewX agent runtime using the resolved provider.
   */
  async createAgentRuntime(options: ProviderBridgeAgentOptions = {}): Promise<ProviderBridgeAgentRuntime> {
    const resolution = await this.resolveProvider(options.provider);

    const runtime = await createCrewxAgent({
      provider: resolution.provider,
      defaultAgentId: options.defaultAgentId,
      validAgents: options.validAgents,
      enableCallStack: options.enableCallStack ?? false,
    });

    return { runtime, resolution };
  }

  private isAIProvider(candidate: ProviderBridgeInput): candidate is AIProvider {
    return (
      typeof candidate === 'object' &&
      candidate !== null &&
      typeof (candidate as AIProvider).query === 'function' &&
      typeof (candidate as AIProvider).isAvailable === 'function'
    );
  }

  private isProviderConfig(candidate: ProviderBridgeInput): candidate is ProviderConfig {
    return (
      typeof candidate === 'object' &&
      candidate !== null &&
      'namespace' in candidate &&
      'id' in candidate
    );
  }

  private findProviderByString(providerId: string): AIProvider | undefined {
    const candidates = this.expandProviderCandidates(providerId);

    for (const candidate of candidates) {
      const provider = this.aiProviderService.getProvider(candidate);
      if (provider) {
        return provider;
      }
    }

    return undefined;
  }

  private expandProviderCandidates(providerId: string): string[] {
    const trimmed = providerId.trim();
    const lower = trimmed.toLowerCase();

    const candidates = new Set<string>();
    const addCandidate = (value?: string) => {
      if (value) {
        candidates.add(value);
        candidates.add(value.toLowerCase());
      }
    };

    addCandidate(trimmed);
    addCandidate(lower);

    if (trimmed.includes('/')) {
      const [namespace, id] = trimmed.split('/', 2);
      addCandidate(id);
      if (namespace && id) {
        addCandidate(`${namespace.toLowerCase()}/${id.toLowerCase()}`);
      }
    } else {
      addCandidate(`cli/${trimmed}`);
      addCandidate(`cli/${lower}`);
    }

    return Array.from(candidates).filter(Boolean);
  }

  private getDefaultProvider(): AIProvider {
    for (const candidate of BUILTIN_FALLBACK_ORDER) {
      const provider = this.findProviderByString(candidate);
      if (provider) {
        return provider;
      }
    }

    const registered = this.aiProviderService.getAvailableProviders();
    for (const name of registered) {
      const provider = this.findProviderByString(name);
      if (provider) {
        return provider;
      }
    }

    this.logger.warn('No CLI providers registered; falling back to MockProvider');
    return new MockProvider();
  }

  private normalizeOutputName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return trimmed;
    }

    const normalized = trimmed.toLowerCase();
    return normalized.includes('/') ? normalized : `cli/${normalized}`;
  }

  private getDefaultModel(providerName: string, providerConfig?: ProviderConfig): string | undefined {
    if (providerConfig?.model && typeof providerConfig.model === 'string') {
      return providerConfig.model;
    }

    return this.getDynamicDefaultModel(providerName);
  }

  private getDynamicDefaultModel(providerName: string): string | undefined {
    if (!this.configService || typeof this.configService.getDynamicProviders !== 'function') {
      return undefined;
    }

    const providers = this.configService.getDynamicProviders();
    if (!Array.isArray(providers) || providers.length === 0) {
      return undefined;
    }

    const normalized = this.normalizeOutputName(providerName);
    const [namespace, id] = normalized.split('/', 2);
    if (!namespace || !id) {
      return undefined;
    }

    for (const provider of providers) {
      if (this.matchesPluginProvider(provider, namespace, id)) {
        return provider.default_model;
      }

      if (this.matchesRemoteProvider(provider, namespace, id)) {
        return provider.default_model;
      }
    }

    return undefined;
  }

  private matchesPluginProvider(
    provider: PluginProviderConfig | RemoteProviderConfig,
    namespace: string,
    id: string,
  ): provider is PluginProviderConfig {
    return (
      provider.type === 'plugin' &&
      namespace === 'plugin' &&
      provider.id.toLowerCase() === id.toLowerCase()
    );
  }

  private matchesRemoteProvider(
    provider: PluginProviderConfig | RemoteProviderConfig,
    namespace: string,
    id: string,
  ): provider is RemoteProviderConfig {
    return (
      provider.type === 'remote' &&
      namespace === 'remote' &&
      provider.id.toLowerCase() === id.toLowerCase()
    );
  }
}
