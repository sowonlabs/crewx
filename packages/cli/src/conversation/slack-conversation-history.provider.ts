import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { BaseConversationHistoryProvider } from './base-conversation-history.provider';
import {
  ConversationMessage,
  ConversationThread,
  FetchHistoryOptions,
  MessageFileAttachment,
} from '@sowonai/crewx-sdk';
import { ConversationStorageService } from '@sowonai/crewx-sdk/internal';

@Injectable()
export class SlackConversationHistoryProvider extends BaseConversationHistoryProvider {
  private client?: WebClient;
  private cache: Map<
    string,
    { thread: ConversationThread; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL = 0; // Cache disabled
  private botInfo?: { userId: string; username: string }; // Bot 정보 캐시
  private storage?: ConversationStorageService;
  private storageInitPromise?: Promise<void>;
  private loggingEnabled = false;

  constructor() {
    super(SlackConversationHistoryProvider.name);
  }

  /**
   * Initialize with Slack client
   */
  initialize(client: WebClient) {
    this.client = client;
  }

  /**
   * Enable local conversation logging (writes Slack history to .crewx/conversations)
   */
  async enableLocalLogging(): Promise<void> {
    if (this.loggingEnabled && this.storageInitPromise) {
      return this.storageInitPromise;
    }

    this.storage = new ConversationStorageService();
    this.loggingEnabled = true;
    this.storageInitPromise = this.storage.initialize().catch((error: Error) => {
      this.logger.warn(`Failed to initialize Slack conversation logging: ${error.message}`);
      this.loggingEnabled = false;
    });

    return this.storageInitPromise;
  }

  isLocalLoggingEnabled(): boolean {
    return this.loggingEnabled;
  }

  /**
   * Get bot info (cached)
   */
  private async getBotInfo(): Promise<{ userId: string; username: string } | undefined> {
    if (this.botInfo) {
      return this.botInfo;
    }

    if (!this.client) {
      return undefined;
    }

    try {
      const authResult = await this.client.auth.test();
      if (authResult.ok && authResult.user_id && authResult.user) {
        this.botInfo = {
          userId: authResult.user_id,
          username: authResult.user as string,
        };
        this.logger.debug(`✅ Fetched bot info: ${this.botInfo.username} (${this.botInfo.userId})`);
        return this.botInfo;
      }
    } catch (error: any) {
      this.logger.error(`Failed to fetch bot info: ${error.message}`);
    }

    return undefined;
  }

  /**
   * Fetch thread history from Slack API (single source of truth)
   * Uses memory cache for performance optimization only
   */
  async fetchHistory(
    threadId: string,
    options?: FetchHistoryOptions,
  ): Promise<ConversationThread> {
    // Parse threadId format: "channel:thread_ts"
    const [channel, threadTs] = threadId.split(':');

    if (!channel || !threadTs) {
      throw new Error(
        `Invalid thread ID format. Expected "channel:thread_ts", got: ${threadId}`,
      );
    }

    // 1. Check memory cache for performance
    const cached = this.getCachedThread(threadId);
    if (cached) {
      this.logger.debug(`Using cached thread history for ${threadId}`);
      await this.persistThread(cached);
      return cached;
    }

    // 2. Fetch from Slack API (single source of truth)
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      this.logger.log(
        `📡 Fetching from Slack API: channel=${channel}, ts=${threadTs}`,
      );

      // Fetch bot info first
      const botInfo = await this.getBotInfo();

      const result = await this.client.conversations.replies({
        channel,
        ts: threadTs,
        limit: options?.limit || 100,
        include_all_metadata: true, // Required to get full metadata with event_payload
      });

      if (!result.ok || !result.messages) {
        this.logger.warn('Failed to fetch thread history');
        return this.createEmptyThread(threadId);
      }

      // Capture has_more flag from Slack API response
      const hasMore = result.has_more || false;

      // Fetch user info for all unique user IDs in the thread
      const userIds = [...new Set(result.messages.filter((msg: any) => msg.user && !msg.bot_id).map((msg: any) => msg.user))];
      const userInfoMap = new Map<string, any>();
      
      for (const userId of userIds) {
        try {
          const userInfo = await this.client.users.info({ user: userId });
          if (userInfo.ok && userInfo.user) {
            userInfoMap.set(userId, userInfo.user);
            this.logger.debug(`✅ Fetched user info for ${userId}: ${userInfo.user.profile?.display_name || userInfo.user.name}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch user info for ${userId}: ${error}`);
        }
      }

      const messages: ConversationMessage[] = result.messages.map(
        (msg: any) => {
          // Get user info from cache
          const userInfo = msg.user ? userInfoMap.get(msg.user) : undefined;
          
          // Debug: Log message structure to understand what data is available
          if (!msg.bot_id && msg.user) {
            this.logger.debug(`User message data: user=${msg.user}, has userInfo=${!!userInfo}, display_name=${userInfo?.profile?.display_name || 'N/A'}`);
          }

          // agentId fallback 전략
          const agentId =
            msg.metadata?.event_payload?.agent_id || // 1순위: metadata
            msg.bot_profile?.name || // 2순위: bot profile
            msg.username || // 3순위: username
            (msg.bot_id ? 'unknown_bot' : undefined); // 4순위: bot_id

          // Extract file attachments if present
          const files: MessageFileAttachment[] | undefined = msg.files?.map((file: any) => ({
            id: file.id,
            name: file.name,
            mimetype: file.mimetype,
            size: file.size,
            localPath: `.crewx/slack-files/${msg.thread_ts || threadTs}/${file.name}`,
            url: file.url_private,
          }));

          return {
            id: msg.ts,
            userId: msg.bot_id ? 'assistant' : msg.user,
            text: this.sanitizeMessage(this.extractMessageContent(msg)),
            timestamp: new Date(parseFloat(msg.ts) * 1000),
            isAssistant: !!msg.bot_id,
            files,
            metadata: {
              ts: msg.ts,
              thread_ts: msg.thread_ts,
              agent_id: agentId,
              provider: msg.metadata?.event_payload?.provider || agentId,
              // Slack-specific user metadata
              slack: {
                user_id: msg.user,
                username: userInfo?.name || msg.username,
                user_profile: userInfo?.profile ? {
                  real_name: userInfo.profile.real_name,
                  display_name: userInfo.profile.display_name,
                  display_name_normalized: userInfo.profile.display_name_normalized,
                  image_72: userInfo.profile.image_72,
                  team: userInfo.profile.team
                } : (msg.user_profile ? {
                  real_name: msg.user_profile.real_name,
                  display_name: msg.user_profile.display_name,
                  display_name_normalized: msg.user_profile.display_name_normalized,
                  image_72: msg.user_profile.image_72,
                  team: msg.user_profile.team
                } : undefined),
                bot_id: msg.bot_id,
                bot_profile: msg.bot_profile ? {
                  name: msg.bot_profile.name,
                  app_id: msg.bot_profile.app_id
                } : undefined,
                // Add bot info for mentions
                bot_user_id: botInfo?.userId,
                bot_username: botInfo?.username,
              }
            },
          };
        },
      );

      const thread: ConversationThread = {
        threadId,
        platform: 'slack',
        messages,
        hasMore, // Include hasMore flag
        metadata: {
          channel,
          threadTs,
        },
      };

      // Cache the result for performance
      this.cacheThread(threadId, thread);

      await this.persistThread(thread);

      this.logger.log(`Retrieved ${messages.length} messages from thread (Slack API)`);
      return thread;
    } catch (error: any) {
      this.logger.error(`Error fetching thread history: ${error.message}`);

      // Check for permission errors
      if (error.data?.error === 'missing_scope') {
        this.logger.error(
          'Missing required Slack scope for reading thread history',
        );
      }

      return this.createEmptyThread(threadId);
    }
  }

  /**
   * Check if thread has history
   */
  async hasHistory(threadId: string): Promise<boolean> {
    try {
      const thread = await this.fetchHistory(threadId, { limit: 1 });
      return thread.messages.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Format history with Slack-specific context
   * Note: Template already includes platform-specific labels and message count
   */
  async formatForAI(
    thread: ConversationThread,
    options?: FetchHistoryOptions,
  ): Promise<string> {
    // Template handles all formatting including "Previous conversation (N messages):" and "(Slack thread)"
    return await super.formatForAI(thread, options);
  }

  /**
   * Extract message content from Slack message
   * Bot messages store actual content in blocks[], not in text field
   */
  private extractMessageContent(msg: any): string {
    if (msg.bot_id && msg.blocks && Array.isArray(msg.blocks)) {
      // Extract text from section blocks, excluding header blocks and footer
      const sections = msg.blocks
        .filter((b: any) => {
          // Include only section blocks with text
          if (b.type !== 'section' || !b.text?.text) {
            return false;
          }

          // Exclude footer blocks (context blocks with crewx branding)
          // Footer pattern: "$ crewx | github.com/sowonlabs/crewx"
          if (b.type === 'context' && b.elements) {
            const text = b.elements[0]?.text || '';
            if (text.includes('$ crewx') || text.includes('github.com/sowonlabs/crewx')) {
              return false;
            }
          }

          return true;
        })
        .map((b: any) => b.text.text);

      if (sections.length > 0) {
        return this.cleanSlackText(sections.join('\n\n'));
      }
    }

    // Fallback: use text field for non-bot messages or if blocks are empty
    return this.cleanSlackText(msg.text || '');
  }

  /**
   * Clean Slack-specific formatting from text
   */
  private cleanSlackText(text: string): string {
    return (
      text
        // Remove user mentions but keep the mention context
        .replace(/<@([A-Z0-9]+)>/g, '@user')
        // Remove channel mentions
        .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2')
        // Remove links but keep text
        .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
        .replace(/<(https?:\/\/[^>]+)>/g, '$1')
        // Clean up extra whitespace
        .trim()
    );
  }

  /**
   * Get cached thread if still valid
   */
  private getCachedThread(threadId: string): ConversationThread | null {
    const cached = this.cache.get(threadId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.thread;
    }
    return null;
  }

  /**
   * Cache thread data
   */
  private cacheThread(threadId: string, thread: ConversationThread) {
    this.cache.set(threadId, {
      thread,
      timestamp: Date.now(),
    });

    // Clean old cache entries (simple LRU approach)
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Create empty thread for error cases
   */
  private createEmptyThread(threadId: string): ConversationThread {
    return {
      threadId,
      platform: 'slack',
      messages: [],
    };
  }

  /**
   * Clear cache (invalidate all cached threads)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific thread
   * Call this when new messages arrive to ensure fresh data on next fetch
   */
  invalidateCache(threadId: string): void {
    this.cache.delete(threadId);
    this.logger.debug(`🗑️  Cache invalidated for thread: ${threadId}`);
  }

  private async persistThread(thread: ConversationThread): Promise<void> {
    if (!this.loggingEnabled || !this.storage) {
      return;
    }

    try {
      const threadCopy: ConversationThread = {
        ...thread,
        messages: thread.messages.map(message => ({
          ...message,
          timestamp:
            message.timestamp instanceof Date
              ? message.timestamp
              : new Date(message.timestamp),
        })),
      };
      await this.storage.saveThread(threadCopy);
    } catch (error: any) {
      this.logger.warn(`Failed to persist Slack conversation log: ${error.message}`);
    }
  }
}
