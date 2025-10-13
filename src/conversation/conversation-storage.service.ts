import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ConversationThread, ConversationMessage } from './conversation-history.interface';

/**
 * Service for persisting conversation threads to local storage
 * Used by CLI chat command to maintain conversation history
 */
@Injectable()
export class ConversationStorageService {
  private readonly logger = new Logger(ConversationStorageService.name);
  private readonly storageDir: string;

  constructor() {
    // Store conversations in .crewx directory
    this.storageDir = path.join(
      process.cwd(),
      '.crewx',
      'conversations'
    );
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      this.logger.debug(`Storage directory initialized: ${this.storageDir}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize storage: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save a conversation thread to storage
   */
  async saveThread(thread: ConversationThread): Promise<void> {
    await this.initialize();

    const filePath = this.getThreadPath(thread.threadId, thread.platform);
    const data = JSON.stringify(thread, null, 2);

    try {
      await fs.writeFile(filePath, data, 'utf-8');
      this.logger.debug(`Thread saved: ${thread.threadId}`);
    } catch (error: any) {
      this.logger.error(`Failed to save thread: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load a conversation thread from storage
   */
  async loadThread(threadId: string): Promise<ConversationThread | null> {
    const candidatePaths = this.getCandidatePaths(threadId);

    for (const filePath of candidatePaths) {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const thread = JSON.parse(data) as ConversationThread;

        // Convert timestamp strings back to Date objects
        thread.messages = thread.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));

        return thread;
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.error(`Failed to load thread: ${error.message}`);
          throw error;
        }
        // Try next candidate if file not found
      }
    }

    return null;
  }

  /**
   * Add a message to an existing thread or create a new thread
   */
  async addMessage(
    threadId: string,
    message: ConversationMessage,
    platform: 'slack' | 'cli' = 'cli'
  ): Promise<ConversationThread> {
    let thread = await this.loadThread(threadId);

    if (!thread) {
      // Create new thread
      thread = {
        threadId,
        platform,
        messages: [],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      };
    }

    // Add message
    thread.messages.push(message);

    // Update metadata
    thread.metadata = {
      ...thread.metadata,
      updatedAt: new Date().toISOString(),
      messageCount: thread.messages.length,
    };

    await this.saveThread(thread);
    return thread;
  }

  /**
   * List all thread IDs
   */
  async listThreads(): Promise<string[]> {
    try {
      await this.initialize();
      const files = await fs.readdir(this.storageDir);
      const threadIds: string[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(this.storageDir, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const thread = JSON.parse(data) as ConversationThread;
          if (thread.threadId) {
            threadIds.push(thread.threadId);
          } else {
            threadIds.push(file.replace('.json', ''));
          }
        } catch (error: any) {
          this.logger.warn(`Failed to read thread file ${file}: ${error.message}`);
        }
      }

      return threadIds;
    } catch (error: any) {
      this.logger.error(`Failed to list threads: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    const candidatePaths = this.getCandidatePaths(threadId);

    for (const filePath of candidatePaths) {
      try {
        await fs.unlink(filePath);
        this.logger.debug(`Thread deleted: ${threadId}`);
        return;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          continue;
        }
        this.logger.error(`Failed to delete thread: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Check if a thread exists
   */
  async hasThread(threadId: string): Promise<boolean> {
    const candidatePaths = this.getCandidatePaths(threadId);
    for (const filePath of candidatePaths) {
      try {
        await fs.access(filePath);
        return true;
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.error(`Failed to check thread: ${error.message}`);
        }
      }
    }
    return false;
  }

  /**
   * Get file path for a thread
   */
  private getThreadPath(threadId: string, platform?: 'slack' | 'cli'): string {
    // Sanitize thread ID for filename
    const safeId = threadId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const resolvedPlatform =
      platform ?? (threadId.includes(':') ? 'slack' : undefined);
    const prefix = resolvedPlatform === 'slack' ? 'slack-' : '';
    return path.join(this.storageDir, `${prefix}${safeId}.json`);
  }

  /**
   * Build list of potential file paths (for backward compatibility)
   */
  private getCandidatePaths(threadId: string): string[] {
    const candidates = new Set<string>();
    candidates.add(this.getThreadPath(threadId));
    candidates.add(this.getThreadPath(threadId, 'slack'));
    candidates.add(this.getThreadPath(threadId, 'cli'));
    return Array.from(candidates);
  }

  /**
   * Clean up old threads (older than N days)
   */
  async cleanupOldThreads(daysToKeep: number = 30): Promise<number> {
    const threads = await this.listThreads();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    for (const threadId of threads) {
      const thread = await this.loadThread(threadId);
      if (!thread) continue;

      const lastMessage = thread.messages[thread.messages.length - 1];
      if (lastMessage && lastMessage.timestamp < cutoffDate) {
        await this.deleteThread(threadId);
        deletedCount++;
      }
    }

    this.logger.log(`Cleaned up ${deletedCount} old threads`);
    return deletedCount;
  }
}
