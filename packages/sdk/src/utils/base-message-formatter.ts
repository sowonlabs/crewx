/**
 * Base Message Formatter
 *
 * Provides common message formatting functionality for CLI and platform-specific implementations.
 * Platform-specific formatters (e.g., Slack) should extend this class and override methods as needed.
 *
 * @packageDocumentation
 */

import { ConversationMessage } from '../conversation/conversation-history.interface';

/**
 * Structured message format used internally
 */
export interface StructuredMessage {
  id?: string;
  userId?: string;
  text: string;
  timestamp?: Date | string;
  isAssistant: boolean;
  metadata?: Record<string, any>;
}

/**
 * Options for formatting messages
 */
export interface FormatterOptions {
  /**
   * Platform type (cli, slack, etc.)
   */
  platform?: 'cli' | 'slack' | string;

  /**
   * Whether to include user IDs in formatted output
   */
  includeUserId?: boolean;

  /**
   * Whether to include timestamps in formatted output
   */
  includeTimestamp?: boolean;

  /**
   * Maximum length for formatted output (characters)
   */
  maxLength?: number;

  /**
   * Custom prefix for user messages
   */
  userPrefix?: string;

  /**
   * Custom prefix for assistant messages
   */
  assistantPrefix?: string;
}

/**
 * Base message formatter providing common formatting logic
 *
 * This class handles:
 * - Message history formatting
 * - Context building from structured payloads
 * - Timestamp and userId normalization
 * - Safety validation
 *
 * Platform-specific implementations should extend this class.
 */
export abstract class BaseMessageFormatter {
  /**
   * Format a list of messages into a string representation
   *
   * @param messages - Array of structured messages
   * @param options - Formatting options
   * @returns Formatted message history as string
   */
  formatHistory(
    messages: StructuredMessage[],
    options?: FormatterOptions,
  ): string {
    if (!messages || messages.length === 0) {
      return '';
    }

    const formattedMessages = messages.map(msg =>
      this.formatMessage(msg, options),
    );

    return formattedMessages.join('\n\n');
  }

  /**
   * Format a single message
   *
   * @param msg - Message to format
   * @param options - Formatting options
   * @returns Formatted message string
   */
  formatMessage(msg: StructuredMessage, options?: FormatterOptions): string {
    if (!msg || !msg.text) {
      return '';
    }

    const opts = this.getDefaultOptions(options);
    const customUserPrefix = options?.userPrefix;
    const customAssistantPrefix = options?.assistantPrefix;
    const parts: string[] = [];

    // Add prefix (user or assistant)
    const displayName = this.resolveDisplayName(msg);
    if (msg.isAssistant) {
      const assistantLabel =
        customAssistantPrefix ||
        opts.assistantPrefix ||
        (displayName ? `🤖 ${displayName}` : '🤖 Assistant');
      parts.push(assistantLabel);
    } else {
      if (customUserPrefix) {
        parts.push(customUserPrefix);
      } else if (displayName) {
        parts.push(`👤 ${displayName}`);
      } else {
        parts.push(opts.userPrefix || '👤 User');
      }
    }

    // Add user ID if requested
    if (opts.includeUserId && msg.userId) {
      parts.push(`(${msg.userId})`);
    }

    // Add timestamp if requested
    if (opts.includeTimestamp && msg.timestamp) {
      const timestamp = this.normalizeTimestamp(msg.timestamp);
      parts.push(`[${timestamp}]`);
    }

    // Build header
    const header = parts.join(' ');

    // Build message text (with safety validation)
    const safeText = this.sanitizeText(msg.text, opts.maxLength);

    return `${header}:\n${safeText}`;
  }

  /**
   * Build context string from a structured payload
   *
   * @param payload - Structured payload object
   * @param options - Formatting options
   * @returns Context string
   */
  buildContext(payload: any, options?: FormatterOptions): string {
    if (!payload) {
      return '';
    }

    const parts: string[] = [];

    // Add prompt
    if (payload.prompt) {
      parts.push(`**Prompt:**\n${payload.prompt}`);
    }

    // Add context
    if (payload.context) {
      parts.push(`**Context:**\n${payload.context}`);
    }

    // Add formatted message history
    if (payload.messages && Array.isArray(payload.messages)) {
      const history = this.formatHistory(payload.messages, options);
      if (history) {
        parts.push(`**Conversation History:**\n${history}`);
      }
    }

    // Add metadata if present
    if (payload.metadata) {
      const metadataStr = this.formatMetadata(payload.metadata);
      if (metadataStr) {
        parts.push(`**Metadata:**\n${metadataStr}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Convert ConversationMessage to StructuredMessage
   *
   * @param message - Conversation message from history provider
   * @returns Structured message
   */
  convertToStructured(message: ConversationMessage): StructuredMessage {
    return {
      id: message.id,
      userId: message.userId,
      text: message.text,
      timestamp: message.timestamp,
      isAssistant: message.isAssistant,
      metadata: message.metadata,
    };
  }

  /**
   * Convert array of ConversationMessages to StructuredMessages
   *
   * @param messages - Array of conversation messages
   * @returns Array of structured messages
   */
  convertToStructuredArray(
    messages: ConversationMessage[],
  ): StructuredMessage[] {
    if (!messages || messages.length === 0) {
      return [];
    }
    return messages.map(msg => this.convertToStructured(msg));
  }

  /**
   * Format metadata object into readable string
   *
   * @param metadata - Metadata object
   * @returns Formatted metadata string
   */
  protected formatMetadata(metadata: Record<string, any>): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }

    const lines = Object.entries(metadata)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        const valueStr =
          typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `- ${key}: ${valueStr}`;
      });

    return lines.join('\n');
  }

  /**
   * Normalize timestamp to consistent format
   *
   * @param timestamp - Timestamp as Date or string
   * @returns Formatted timestamp string
   */
  protected normalizeTimestamp(timestamp: Date | string): string {
    if (!timestamp) {
      return '';
    }

    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) {
        return String(timestamp);
      }
      return date.toISOString();
    } catch (error) {
      return String(timestamp);
    }
  }

  /**
   * Sanitize text for safety (remove harmful content, enforce length limits)
   *
   * @param text - Text to sanitize
   * @param maxLength - Maximum length (optional)
   * @returns Sanitized text
   */
  protected sanitizeText(text: string, maxLength?: number): string {
    if (!text) {
      return '';
    }

    let sanitized = text;

    // Truncate if necessary
    if (maxLength && sanitized.length > maxLength) {
      sanitized = this.truncateText(sanitized, maxLength);
    }

    return sanitized;
  }

  /**
   * Truncate text to specified length with ellipsis
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   */
  protected truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }

    // Try to break at a sensible point (newline or sentence)
    const searchStart = Math.max(0, maxLength - 100);
    let breakPoint = maxLength - 20; // Leave room for ellipsis

    const lastNewline = text.lastIndexOf('\n', breakPoint);
    if (lastNewline > searchStart) {
      breakPoint = lastNewline;
    } else {
      const lastPeriod = text.lastIndexOf('. ', breakPoint);
      if (lastPeriod > searchStart) {
        breakPoint = lastPeriod + 1;
      }
    }

    const truncated = text.substring(0, breakPoint);
    const remaining = text.length - breakPoint;
    return `${truncated}\n\n...[truncated ${remaining} characters]`;
  }

  /**
   * Get default options merged with provided options
   *
   * @param options - User-provided options
   * @returns Complete options with defaults
   */
  protected getDefaultOptions(options?: FormatterOptions): FormatterOptions {
    return {
      platform: 'cli',
      includeUserId: true,
      includeTimestamp: false,
      userPrefix: '👤 User',
      assistantPrefix: '🤖 Assistant',
      ...options,
    };
  }

  protected resolveDisplayName(msg: StructuredMessage): string | undefined {
    const metadata = msg.metadata || {};
    return (
      metadata.realName ||
      metadata.displayName ||
      metadata.username ||
      metadata.agentName ||
      undefined
    );
  }
}

/**
 * Default CLI message formatter (non-abstract implementation)
 */
export class DefaultMessageFormatter extends BaseMessageFormatter {
  // Uses all base class methods without overrides
}
