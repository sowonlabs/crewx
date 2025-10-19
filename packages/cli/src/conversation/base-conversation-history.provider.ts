import { Logger } from '@nestjs/common';
import {
  ConversationThread,
  FetchHistoryOptions,
  IConversationHistoryProvider,
} from '@sowonai/crewx-sdk';
import { IntelligentCompressionService } from '../services/intelligent-compression.service';

/**
 * Base implementation with common conversation history logic
 * Enhanced with intelligent compression capabilities
 */
export abstract class BaseConversationHistoryProvider
  implements IConversationHistoryProvider
{
  protected readonly logger: Logger;
  protected compressionService?: IntelligentCompressionService;

  constructor(
    loggerContext: string,
    compressionService?: IntelligentCompressionService
  ) {
    this.logger = new Logger(loggerContext);
    this.compressionService = compressionService;
  }

  abstract fetchHistory(
    threadId: string,
    options?: FetchHistoryOptions,
  ): Promise<ConversationThread>;

  abstract hasHistory(threadId: string): Promise<boolean>;

  /**
   * Format conversation history for AI context with intelligent compression
   * All formatting is now handled through templates for consistency.
   * This method coordinates template processing or falls back to compression.
   */
  async formatForAI(
    thread: ConversationThread,
    options?: FetchHistoryOptions,
  ): Promise<string> {
    const maxLength = options?.maxContextLength || 4000;
    const limit = options?.limit || 20;
    const excludeCurrent = options?.excludeCurrent ?? true;

    let messages = [...thread.messages];

    // Exclude the most recent message if requested
    if (excludeCurrent && messages.length > 0) {
      messages = messages.slice(0, -1);
    }

    // Return empty if no messages to format
    if (messages.length === 0) {
      return '';
    }

    // Use intelligent compression if available and conversation is long
    if (this.compressionService && messages.length > limit) {
      this.logger.debug(`Using intelligent compression for ${messages.length} messages`);
      
      const threadForCompression: ConversationThread = {
        ...thread,
        messages: messages
      };

      return await this.compressionService.compressConversationHistory(
        threadForCompression,
        {
          maxTokens: Math.floor(maxLength / 4), // Estimate tokens from characters
          maxMessages: limit,
          preserveRecentCount: Math.min(5, Math.floor(limit / 4)),
          preserveImportant: true
        }
      );
    }

    // For normal-sized conversations, template processing is handled upstream
    // in CrewXTool via processDocumentTemplate with formatConversation helper.
    // This method should not add any additional formatting.
    // Return empty string to indicate template should handle formatting.
    return '';
  }

  /**
   * Sanitize message text to remove sensitive information
   */
  protected sanitizeMessage(text: string): string {
    return text
      .replace(/password[:\s]*\S+/gi, 'password: ***')
      .replace(/token[:\s]*\S+/gi, 'token: ***')
      .replace(/api[_-]?key[:\s]*\S+/gi, 'api_key: ***')
      .replace(/secret[:\s]*\S+/gi, 'secret: ***');
  }
}
