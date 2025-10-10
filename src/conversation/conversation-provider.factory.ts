import { Injectable, Logger } from '@nestjs/common';
import { IConversationHistoryProvider } from './conversation-history.interface';
import { SlackConversationHistoryProvider } from './slack-conversation-history.provider';
import { CliConversationHistoryProvider } from './cli-conversation-history.provider';

export type Platform = 'slack' | 'cli';

/**
 * Factory for creating conversation history providers based on platform
 */
@Injectable()
export class ConversationProviderFactory {
  private readonly logger = new Logger(ConversationProviderFactory.name);
  private providers: Map<Platform, IConversationHistoryProvider> = new Map();

  /**
   * Get or create a provider for the specified platform
   */
  getProvider(platform: Platform): IConversationHistoryProvider {
    let provider = this.providers.get(platform);

    if (!provider) {
      provider = this.createProvider(platform);
      this.providers.set(platform, provider);
      this.logger.log(`Created ${platform} conversation history provider`);
    }

    return provider;
  }

  /**
   * Create a new provider instance
   */
  private createProvider(platform: Platform): IConversationHistoryProvider {
    switch (platform) {
      case 'slack':
        return new SlackConversationHistoryProvider();
      case 'cli':
        return new CliConversationHistoryProvider();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Check if provider exists for platform
   */
  hasProvider(platform: Platform): boolean {
    return this.providers.has(platform);
  }

  /**
   * Clear all providers
   */
  clearProviders(): void {
    this.providers.clear();
    this.logger.log('All conversation providers cleared');
  }
}
