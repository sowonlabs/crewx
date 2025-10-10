import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIProvider, AIQueryOptions, AIResponse, ProviderNotAvailableError } from './providers/ai-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { CopilotProvider } from './providers/copilot.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Injectable()
export class AIProviderService implements OnModuleInit {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly providers = new Map<string, AIProvider>();
  private availableProviders: string[] = [];

  constructor(
    private readonly claudeProvider: ClaudeProvider,
    private readonly copilotProvider: CopilotProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  onModuleInit() {
    this.registerProvider(this.claudeProvider);
    this.registerProvider(this.copilotProvider);
    this.registerProvider(this.geminiProvider);
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
    providerName: 'claude' | 'gemini' | 'copilot' = 'claude',
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
    providerName: 'claude' | 'gemini' | 'copilot',
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
}