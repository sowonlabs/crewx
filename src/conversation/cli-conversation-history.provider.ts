import { Injectable } from '@nestjs/common';
import { BaseConversationHistoryProvider } from './base-conversation-history.provider';
import {
  ConversationMessage,
  ConversationThread,
  FetchHistoryOptions,
} from './conversation-history.interface';
import { ConversationStorageService } from './conversation-storage.service';

/**
 * CLI conversation history provider
 * Stores conversation history in local file system
 */
@Injectable()
export class CliConversationHistoryProvider extends BaseConversationHistoryProvider {
  private storage: ConversationStorageService;

  constructor() {
    super(CliConversationHistoryProvider.name);
    this.storage = new ConversationStorageService();
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /**
   * Fetch thread history from local storage
   */
  async fetchHistory(
    threadId: string,
    options?: FetchHistoryOptions,
  ): Promise<ConversationThread> {
    try {
      this.logger.log(`Fetching CLI thread history: ${threadId}`);

      const thread = await this.storage.loadThread(threadId);

      if (!thread) {
        return this.createEmptyThread(threadId);
      }

      // Apply limit
      if (options?.limit && thread.messages.length > options.limit) {
        thread.messages = thread.messages.slice(-options.limit);
      }

      this.logger.log(`Retrieved ${thread.messages.length} messages from CLI thread`);
      return thread;
    } catch (error: any) {
      this.logger.error(`Error fetching CLI thread history: ${error.message}`);
      return this.createEmptyThread(threadId);
    }
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(
    threadId: string,
    userId: string,
    text: string,
    isAssistant: boolean = false,
  ): Promise<ConversationMessage> {
    const message: ConversationMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId,
      text: this.sanitizeMessage(text),
      timestamp: new Date(),
      isAssistant,
    };

    try {
      await this.storage.addMessage(threadId, message, 'cli');
      this.logger.debug(`Message added to thread ${threadId}`);
      return message;
    } catch (error: any) {
      this.logger.error(`Failed to add message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if thread has history
   */
  async hasHistory(threadId: string): Promise<boolean> {
    return await this.storage.hasThread(threadId);
  }

  /**
   * Format history for AI context
   */
  formatForAI(
    thread: ConversationThread,
    options?: FetchHistoryOptions,
  ): Promise<string> {
    return super.formatForAI(thread, options);
  }

  /**
   * List all available threads
   */
  async listThreads(): Promise<string[]> {
    return await this.storage.listThreads();
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.storage.deleteThread(threadId);
    this.logger.log(`Thread deleted: ${threadId}`);
  }

  /**
   * Create a new conversation thread
   */
  async createThread(threadId?: string): Promise<string> {
    const id = threadId || `cli-${Date.now()}`;

    const thread: ConversationThread = {
      threadId: id,
      platform: 'cli',
      messages: [],
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };

    await this.storage.saveThread(thread);
    this.logger.log(`New thread created: ${id}`);

    return id;
  }

  /**
   * Create empty thread for error cases
   */
  private createEmptyThread(threadId: string): ConversationThread {
    return {
      threadId,
      platform: 'cli',
      messages: [],
    };
  }

  /**
   * Cleanup old threads
   */
  async cleanupOldThreads(daysToKeep: number = 30): Promise<number> {
    return await this.storage.cleanupOldThreads(daysToKeep);
  }
}
