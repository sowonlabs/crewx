import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AIProvider,
  AIQueryOptions,
  AIResponse,
  ProviderNotAvailableError,
  ClaudeProvider as SdkClaudeProvider,
  GeminiProvider as SdkGeminiProvider,
  CopilotProvider as SdkCopilotProvider,
  CodexProvider as SdkCodexProvider,
  BaseAIProvider,
  BuiltInProviders,
  type PluginProviderConfig,
  type RemoteProviderConfig,
  MastraAPIProvider,
  type APIProviderConfig,
  type APIToolExecutionContext,
  type FrameworkToolDefinition,
  readFileTool,
} from '@sowonai/crewx-sdk';
import { DynamicProviderFactory } from './providers/dynamic-provider.factory';
import { ConfigService } from './services/config.service';
import { ToolCallService } from './services/tool-call.service';
import { createLoggerAdapter } from './providers/logger.adapter';
import { CREWX_VERSION } from './version';

@Injectable()
export class AIProviderService implements OnModuleInit {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly providers = new Map<string, AIProvider>();
  private availableProviders: string[] = [];
  private readonly builtInProviderNames = new Set<string>([
    BuiltInProviders.CLAUDE,
    BuiltInProviders.GEMINI,
    BuiltInProviders.COPILOT,
    BuiltInProviders.CODEX,
  ]);

  constructor(
    private readonly toolCallService: ToolCallService,
    private readonly dynamicProviderFactory: DynamicProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    for (const provider of this.createBuiltInProviders()) {
      this.registerProvider(provider);
    }

    await this.loadPluginProviders();
    await this.loadAPIProviders(); // WBS-24 Phase 2: Load API providers
  }

  private createBuiltInProviders(): BaseAIProvider[] {
    return [
      new SdkClaudeProvider({
        logger: createLoggerAdapter('ClaudeProvider'),
        toolCallHandler: this.toolCallService,
        crewxVersion: CREWX_VERSION,
      }),
      new SdkGeminiProvider({
        logger: createLoggerAdapter('GeminiProvider'),
        toolCallHandler: this.toolCallService,
        crewxVersion: CREWX_VERSION,
      }),
      new SdkCopilotProvider({
        logger: createLoggerAdapter('CopilotProvider'),
        toolCallHandler: this.toolCallService,
        crewxVersion: CREWX_VERSION,
      }),
      new SdkCodexProvider({
        logger: createLoggerAdapter('CodexProvider'),
        toolCallHandler: this.toolCallService,
        crewxVersion: CREWX_VERSION,
      }),
    ];
  }

  /**
   * Load plugin providers from YAML configuration
   */
  private async loadPluginProviders(): Promise<void> {
    try {
      const dynamicConfigs = this.configService.getDynamicProviders();

      if (!dynamicConfigs || dynamicConfigs.length === 0) {
        this.logger.log('No dynamic providers defined in config');
        return;
      }

      for (const providerConfig of dynamicConfigs) {
        try {
          // Validate configuration
          if (!this.dynamicProviderFactory.validateConfig(providerConfig)) {
            this.logger.warn(`Invalid dynamic provider config: ${(providerConfig as any).id}`);
            this.logger.debug(`Config dump: ${JSON.stringify(providerConfig, null, 2)}`);
            continue;
          }

          // Create dynamic provider instance with security validation
          const provider = this.dynamicProviderFactory.createProvider(providerConfig);
          this.registerProvider(provider);
          this.logger.log(`✅ Registered ${providerConfig.type} provider: ${providerConfig.id}`);
        } catch (error: any) {
          this.logger.error(
            `Failed to load dynamic provider '${(providerConfig as any).id || 'unknown'}': ${error.message}`,
            error.stack
          );
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to load dynamic providers:', error);
    }
  }

  /**
   * Load API providers from YAML configuration (WBS-24 Phase 2)
   * Creates MastraAPIProvider instances for agents configured with API providers
   */
  private async loadAPIProviders(): Promise<void> {
    try {
      const apiProviderConfigs = this.configService.getAllAPIProviderConfigs();

      if (!apiProviderConfigs || apiProviderConfigs.size === 0) {
        this.logger.log('No API providers defined in config');
        return;
      }

      for (const [agentId, apiConfig] of apiProviderConfigs) {
        try {
          // Create MastraAPIProvider instance
          const provider = new MastraAPIProvider(apiConfig);

          // Load tools for this agent
          const agentConfig = this.configService.getAgentConfig(agentId);
          const toolsArray = apiConfig.tools || [];

          if (toolsArray.length > 0) {
            // Build tool list from built-in tools
            const tools: FrameworkToolDefinition[] = [];
            for (const toolName of toolsArray) {
              if (toolName === 'read_file') {
                tools.push(readFileTool);
                this.logger.log(`✅ Loaded tool: ${toolName} for agent ${agentId}`);
              } else {
                this.logger.warn(`⚠️  Unknown tool: ${toolName} for agent ${agentId}`);
              }
            }

            // Create ToolExecutionContext (matches API provider types)
            const context: APIToolExecutionContext = {
              agent: {
                id: agentId,
                provider: apiConfig.provider,
                model: apiConfig.model,
                temperature: apiConfig.temperature,
                maxTokens: apiConfig.maxTokens,
              },
              env: this.configService.getEnvironmentVariables() as Record<string, string>,
              mode: 'query',
              platform: 'cli',
            };

            // Set tools on provider
            provider.setTools(tools, context);
            this.logger.log(`✅ Configured ${tools.length} tool(s) for agent ${agentId}`);
          }

          // Create wrapper with agent ID as name
          const wrappedProvider: AIProvider = {
            name: agentId, // Use agent ID as provider name
            isAvailable: provider.isAvailable.bind(provider),
            query: provider.query.bind(provider),
            execute: provider.execute.bind(provider),
            getToolPath: provider.getToolPath?.bind(provider),
          };

          this.registerProvider(wrappedProvider);
          this.logger.log(`✅ Registered API provider for agent: ${agentId} (${apiConfig.provider}/${apiConfig.model})`);
        } catch (error: any) {
          this.logger.error(
            `Failed to load API provider for agent '${agentId}': ${error.message}`,
            error.stack
          );
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to load API providers:', error);
    }
  }

  /**
   * Reload plugin providers after config change
   * Public method to support --config option
   * WBS-24 Phase 2: Also reload API providers
   */
  async reloadPluginProviders(): Promise<void> {
    // Clear existing plugin providers and API providers (keep built-in CLI providers)
    for (const [name] of this.providers) {
      if (!this.builtInProviderNames.has(name)) {
        this.providers.delete(name);
      }
    }

    // Reload from config
    await this.loadPluginProviders();
    await this.loadAPIProviders(); // WBS-24 Phase 2
  }

  private registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered AI provider: ${provider.name}`);
  }

  async initializeProviders(): Promise<void> {
    this.logger.log('Initializing AI providers...');
    this.availableProviders = [];
    const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          this.availableProviders.push(name);
          this.logger.log(`✅ ${name} provider is available`);
        } else {
          this.logger.warn(`❌ ${name} provider is not available`);
        }
        return { name, isAvailable };
      } catch (error) {
        this.logger.error(`Error checking ${name} provider:`, error);
        return { name, isAvailable: false };
      }
    });

    await Promise.all(checks);
    this.logger.log(`Available providers: ${this.availableProviders.join(', ')}`);
  }

  async queryAI(
    prompt: string,
    providerName: string = BuiltInProviders.CLAUDE,
    options: AIQueryOptions = {}
  ): Promise<AIResponse> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new ProviderNotAvailableError(providerName);
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new ProviderNotAvailableError(providerName);
    }

    try {
      // Use queryWithTools if available (for tool call support)
      if (typeof (provider as any).queryWithTools === 'function') {
        this.logger.log(`Using queryWithTools for ${providerName} in query mode`);
        return await (provider as any).queryWithTools(prompt, options);
      }

      return await provider.query(prompt, options);
    } catch (error: any) {
      this.logger.error(`Error querying ${providerName}:`, error);
      return {
        content: '',
        provider: providerName,
        command: `${providerName} query`,
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  async executeAI(
    prompt: string,
    providerName: string,
    options: AIQueryOptions = {}
  ): Promise<AIResponse> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new ProviderNotAvailableError(providerName);
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new ProviderNotAvailableError(providerName);
    }

    try {
      // Use queryWithTools if available (for Claude and Copilot)
      if (typeof (provider as any).queryWithTools === 'function') {
        this.logger.log(`Using queryWithTools for ${providerName} in execute mode`);
        return await (provider as any).queryWithTools(prompt, options);
      }

      // Fallback to execute method
      return await (provider as any).execute(prompt, options);
    } catch (error: any) {
      this.logger.error(`Error executing ${providerName}:`, error);
      return {
        content: '',
        provider: providerName,
        command: `${providerName} execute`,
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  getAvailableProviders(): string[] {
    // Return all registered provider names (not just initialized ones)
    // This allows validation before actual initialization
    return Array.from(this.providers.keys());
  }

  async checkAvailableProviders(): Promise<string[]> {
    await this.initializeProviders();
    return this.getAvailableProviders();
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  async validateCLIInstallation(): Promise<{ [key: string]: boolean }> {
    const installation: { [key: string]: boolean } = {};

    for (const [name, provider] of this.providers) {
      installation[name] = await provider.isAvailable();
    }

    return installation;
  }

  /**
   * Get plugin provider configurations
   */
  getPluginProviders(): PluginProviderConfig[] {
    return this.configService.getPluginProviders();
  }

  getRemoteProviders(): RemoteProviderConfig[] {
    return this.configService.getRemoteProviders();
  }
}
