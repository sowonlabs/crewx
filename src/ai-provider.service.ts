import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIProvider, AIQueryOptions, AIResponse, ProviderNotAvailableError } from './providers/ai-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { CopilotProvider } from './providers/copilot.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { CodexProvider } from './providers/codex.provider';
import { DynamicProviderFactory } from './providers/dynamic-provider.factory';
import { RemoteProviderConfig } from './providers/dynamic-provider.factory';
import { ConfigService } from './services/config.service';

@Injectable()
export class AIProviderService implements OnModuleInit {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly providers = new Map<string, AIProvider>();
  private availableProviders: string[] = [];

  constructor(
    private readonly claudeProvider: ClaudeProvider,
    private readonly copilotProvider: CopilotProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly codexProvider: CodexProvider,
    private readonly dynamicProviderFactory: DynamicProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Register built-in providers
    this.registerProvider(this.claudeProvider);
    this.registerProvider(this.copilotProvider);
    this.registerProvider(this.geminiProvider);
    this.registerProvider(this.codexProvider);

    // Load and register plugin providers from YAML config
    await this.loadPluginProviders();
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
   * Reload plugin providers after config change
   * Public method to support --config option
   */
  async reloadPluginProviders(): Promise<void> {
    // Clear existing plugin providers (keep built-in CLI providers)
    const builtInProviders = ['cli/claude', 'cli/gemini', 'cli/copilot', 'cli/codex'];
    for (const [name] of this.providers) {
      if (!builtInProviders.includes(name)) {
        this.providers.delete(name);
      }
    }

    // Reload from config
    await this.loadPluginProviders();
  }

  private registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered AI provider: ${provider.name}`);
  }

  async initializeProviders(): Promise<void> {
    this.logger.log('Initializing AI providers...');
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
    providerName: string = 'claude',
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
  getPluginProviders(): any[] {
    return this.configService.getPluginProviders();
  }

  getRemoteProviders(): RemoteProviderConfig[] {
    return this.configService.getRemoteProviders();
  }
}
