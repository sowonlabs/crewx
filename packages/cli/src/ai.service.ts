import { Injectable, Logger } from '@nestjs/common';
import {
  BuiltInProviders,
  type AIResponse,
  type AIQueryOptions,
} from '@sowonai/crewx-sdk';
import { AIProviderService } from './ai-provider.service';

export type { AIResponse, AIQueryOptions } from '@sowonai/crewx-sdk';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private readonly aiProviderService: AIProviderService) {}

  async queryAI(
    prompt: string,
    provider: string = 'claude',
    options: AIQueryOptions = {},
  ): Promise<AIResponse> {
    this.logger.debug(`Querying provider ${provider}`);
    return this.aiProviderService.queryAI(prompt, provider, options);
  }

  async executeAI(
    prompt: string,
    provider: string = 'claude',
    options: AIQueryOptions = {},
  ): Promise<AIResponse> {
    this.logger.debug(`Executing provider ${provider}`);
    return this.aiProviderService.executeAI(prompt, provider, options);
  }

  async executeGemini(
    prompt: string,
    options: AIQueryOptions = {},
  ): Promise<AIResponse> {
    return this.executeAI(prompt, 'gemini', options);
  }

  async checkAvailableProviders(): Promise<string[]> {
    return this.aiProviderService.checkAvailableProviders();
  }

  async validateCLIInstallation(): Promise<{ claude: boolean; gemini: boolean; copilot: boolean }> {
    await this.aiProviderService.initializeProviders();
    const installation = await this.aiProviderService.validateCLIInstallation();

    return {
      claude: installation[BuiltInProviders.CLAUDE] ?? false,
      gemini: installation[BuiltInProviders.GEMINI] ?? false,
      copilot: installation[BuiltInProviders.COPILOT] ?? false,
    };
  }
}
