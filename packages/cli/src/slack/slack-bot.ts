import { App, LogLevel } from '@slack/bolt';
import { Logger } from '@nestjs/common';
import { CrewXTool } from '../crewx.tool';
import { SlackMessageFormatter } from './formatters/message.formatter';
import { SlackConversationHistoryProvider } from '../conversation/slack-conversation-history.provider';
import { ConfigService } from '../services/config.service';
import { AIProviderService } from '../ai-provider.service';
import { SlackFileDownloadService } from './services/slack-file-download.service';

export class SlackBot {
  private readonly logger = new Logger(SlackBot.name);
  private app: App;
  private formatter: SlackMessageFormatter;
  private conversationHistory: SlackConversationHistoryProvider;
  private fileDownloadService: SlackFileDownloadService;
  private defaultAgent: string;
  private botUserId: string | null = null;
  private botId: string | null = null;
  private readonly mode: 'query' | 'execute';
  private readonly mentionOnly: boolean;
  private readonly threadGuards: Map<string, Promise<void>> = new Map();

  constructor(
    private readonly crewXTool: CrewXTool,
    private readonly configService: ConfigService,
    private readonly aiProviderService: AIProviderService,
    defaultAgent: string = 'claude',
    mode: 'query' | 'execute' = 'query',
    mentionOnly: boolean = false
  ) {
    if (mode !== 'query' && mode !== 'execute') {
      throw new Error(`Invalid Slack mode '${mode}'. Supported modes: query, execute.`);
    }

    // Validate agent exists (check both built-in providers and custom agents)
    const builtinProviders = this.aiProviderService.getAvailableProviders();
    const customAgents = this.configService.getAllAgentIds();
    const allAvailableAgents = [...builtinProviders, ...customAgents];
    
    if (!allAvailableAgents.includes(defaultAgent)) {
      const errorMsg = `❌ Agent '${defaultAgent}' not found. Available agents: ${allAvailableAgents.join(', ')}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.defaultAgent = defaultAgent;
    this.mode = mode;
    this.mentionOnly = mentionOnly;
    this.formatter = new SlackMessageFormatter();
    this.conversationHistory = new SlackConversationHistoryProvider();
    this.fileDownloadService = new SlackFileDownloadService(this.configService);

    if (this.configService.shouldLogSlackConversations()) {
      this.logger.log('📝 Slack conversation logging enabled (local storage).');
      this.conversationHistory.enableLocalLogging().catch(error => {
        this.logger.warn(`Failed to enable Slack conversation logging: ${error.message}`);
      });
    }

    this.logger.log(`🤖 Slack bot initialized with default agent: ${this.defaultAgent}`);
    this.logger.log(`⚙️  Slack bot mode: ${this.mode}`);
    this.logger.log(`🎯 Mention-only mode: ${this.mentionOnly ? 'enabled (requires @mention)' : 'disabled (auto-respond in threads)'}`);
    this.logger.log(`📋 Built-in providers: ${builtinProviders.join(', ')}`);
    this.logger.log(`📋 Custom agents: ${customAgents.join(', ')}`);

    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true, // Works behind firewalls
      appToken: process.env.SLACK_APP_TOKEN,
      logLevel: LogLevel.INFO,
    });

    this.registerHandlers();
  }

  /**
   * Get bot's user ID from Slack API
   */
  private async getBotUserId(client: any): Promise<string> {
    if (this.botUserId) {
      return this.botUserId;
    }

    try {
      const authResponse = await client.auth.test();
      this.botUserId = authResponse.user_id as string;
      this.botId = authResponse.bot_id as string;
      this.logger.log(`🤖 Bot User ID: ${this.botUserId}, Bot ID: ${this.botId}`);
      return this.botUserId;
    } catch (error: any) {
      this.logger.error(`Failed to get bot user ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if bot should respond to this message
   * - Must be explicitly mentioned OR
   * - Must be the last speaker in the thread (prevents multiple bots responding) OR
   * - No mention present and not in a thread (default agent responds)
   *
   * When mentionOnly mode is enabled:
   * - ONLY responds to explicit @mentions or DMs
   * - Does NOT auto-respond in threads (even if bot was last speaker)
   */
  private async shouldRespondToMessage(message: any, client: any): Promise<boolean> {
    const botUserId = await this.getBotUserId(client);
    const text = message.text || '';

    // 1. Check if bot is explicitly mentioned in this message
    if (text.includes(`<@${botUserId}>`)) {
      this.logger.log(`✅ DECISION: Bot mentioned in message → RESPOND`);
      return true;
    }

    // 2. Check if another bot is mentioned (skip if so)
    const otherBotMentioned = /<@[A-Z0-9]+>/.test(text) && !text.includes(`<@${botUserId}>`);
    if (otherBotMentioned) {
      this.logger.log(`⏭️  DECISION: Another bot mentioned → SKIP`);
      return false;
    }

    // 3. Check if this is a DM (always respond)
    if (message.channel_type === 'im') {
      this.logger.log(`✅ DECISION: Direct message → RESPOND`);
      return true;
    }

    // 4. If mention-only mode is enabled, require explicit mention in threads
    if (this.mentionOnly && message.thread_ts) {
      this.logger.log(`⏭️  DECISION: Mention-only mode enabled, no mention in thread → SKIP`);
      return false;
    }

    // 5. Check if this is a threaded message where bot was the last speaker
    if (message.thread_ts) {
      this.logger.log(`🧵 Thread detected, fetching history...`);
      try {
        const threadHistory = await client.conversations.replies({
          channel: message.channel,
          ts: message.thread_ts,
          limit: 100,
          include_all_metadata: true, // 🔑 CRITICAL: Required to get event_payload in metadata!
        });

        // Find the LAST MESSAGE in the thread (user or bot)
        // Exclude the current incoming message by checking timestamp
        const lastMessage = [...threadHistory.messages]
          .filter((msg: any) => msg.ts !== message.ts) // Exclude current message
          .reverse()[0]; // Get the last message (most recent before current)

        if (!lastMessage) {
          // No previous messages in thread, bot should respond (first message in thread)
          this.logger.log(`✅ DECISION: No previous messages in thread → RESPOND`);
          return true;
        }

        // Check if last message was from a bot
        const lastMessageIsBot = !!lastMessage.bot_id || lastMessage.metadata?.event_type === 'crewx_response';

        if (!lastMessageIsBot) {
          // Last message was from a user → bot should respond
          this.logger.log(`✅ DECISION: Last message from user → RESPOND`);
          return true;
        }

        // Last message was from a bot → check if it was THIS bot's agent
        let lastAgentId = lastMessage.metadata?.event_payload?.agent_id;

        // FALLBACK 1: Parse agent ID from message text if metadata is missing
        // Message format: "✅ Completed! (@agent_name)" or "❌ Error (@agent_name)"
        if (!lastAgentId && lastMessage.text) {
          const agentMatch = lastMessage.text.match(/@([a-zA-Z0-9_]+)\)/);
          if (agentMatch) {
            lastAgentId = agentMatch[1];
            this.logger.log(`🔧 Fallback 1: Extracted agent ID from message text: ${lastAgentId}`);
          }
        }

        // FALLBACK 2: Check bot_id if metadata is still missing
        // If the last bot message has bot_id === this.botId, it's from this bot
        if (!lastAgentId && lastMessage.bot_id === this.botId) {
          lastAgentId = this.defaultAgent;
          this.logger.log(`🔧 Fallback 2: bot_id matches this bot (${this.botId}) → treating as ${this.defaultAgent}`);
          this.logger.warn(`⚠️  Metadata missing for bot message! bot_id=${lastMessage.bot_id}, assuming agent=${this.defaultAgent}`);
        }

        // If still no agent ID identified, log warning
        if (!lastAgentId) {
          this.logger.warn(`⚠️  Could not identify last speaker! No metadata, no text match, bot_id=${lastMessage.bot_id}`);
        }

        const isLastSpeaker = lastAgentId === this.defaultAgent;

        if (isLastSpeaker) {
          this.logger.log(`✅ DECISION: This bot was last speaker → RESPOND`);
          return true;
        } else {
          this.logger.log(`⏭️  DECISION: Another bot was last speaker (${lastAgentId}) → SKIP`);
          return false;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to check thread participation: ${error.message}`);
        return false;
      }
    }

    // 6. No mention present - skip in channel to avoid unsolicited replies
    this.logger.log(`⏭️  DECISION: No mention, no thread → SKIP (channel requires explicit mention)`);
    return false;
  }

  private registerHandlers() {
    // Log all messages for debugging
    this.app.event('message', async ({ event, logger }) => {
      this.logger.debug(`📨 Received message event: ${JSON.stringify(event).substring(0, 200)}`);
    });

    // Handle file uploads (file_shared event)
    this.app.event('file_shared', async ({ event, client }) => {
      await this.handleFileShared(event, client);
    });

    // Handle app mentions (when bot is @mentioned)
    this.app.event('app_mention', async ({ event, say, client }) => {
      // Check if THIS bot was mentioned (not another bot)
      const botUserId = await this.getBotUserId(client);
      const text = event.text || '';

      if (!text.includes(`<@${botUserId}>`)) {
        this.logger.debug(`⏭️  Skipping app_mention (different bot mentioned)`);
        return;
      }

      this.logger.log(`📢 Bot mentioned by user ${event.user}`);
      await this.handleCommand({ message: event, say, client });
    });

    // Also handle direct messages to the bot
    this.app.message(async ({ message, say, client }) => {
      const msg = message as any;

      // Log message details for debugging
      this.logger.debug(`📬 Message handler: subtype=${msg.subtype}, bot_id=${msg.bot_id}, has_files=${!!msg.files}, files_count=${msg.files?.length || 0}`);

      // Handle files BEFORE checking subtype (file_share messages have subtype)
      if ('files' in message && msg.files && msg.files.length > 0) {
        this.logger.log(`📎 Message with ${msg.files.length} file(s) detected`);
        await this.handleMessageWithFiles(message, client);
      }

      // Ignore bot messages and threaded replies to avoid loops
      if (msg.subtype || msg.bot_id) {
        this.logger.debug(`⏭️  Skipping message (subtype: ${msg.subtype}, bot_id: ${msg.bot_id})`);
        return;
      }

      const text = msg.text || '';
      this.logger.debug(`💬 Message received: "${text.substring(0, 50)}..."`);

      // Get bot user ID
      const botUserId = await this.getBotUserId(client);

      // Skip if this is an app_mention event (already handled by app_mention handler)
      // App mentions include <@BOTID> in the text
      if (text.includes(`<@${botUserId}>`)) {
        this.logger.debug(`⏭️  Skipping app_mention (handled by app_mention handler)`);
        return;
      }

      // Check if bot should respond to this message
      const shouldRespond = await this.shouldRespondToMessage(message, client);
      if (!shouldRespond) {
        this.logger.debug(`⏭️  Ignoring message (bot not mentioned and not participated in thread)`);
        return;
      }

      this.logger.log(`🎯 Processing message from ${(message as any).user}`);
      await this.handleCommand({ message, say, client });
    });

    // Handle button actions
    this.app.action('view_details', async ({ ack, body, client }) => {
      await this.handleViewDetails({ ack, body, client });
    });

    this.app.action('rerun', async ({ ack, body, client }) => {
      await this.handleRerun({ ack, body, client });
    });
  }

  private async handleCommand({ message, say, client }: any) {
    try {
      const messageText = (message as any).text || '';

      // Remove only bot mention from text (Slack format: <@U123456>)
      // Keep "crewx" in the actual message content - it might be part of the question
      let userRequest = messageText
        .replace(/<@[A-Z0-9]+>/gi, '') // Remove Slack user mentions
        .trim();

      this.logger.log(`📝 Parsed request: "${userRequest.substring(0, 100)}..."`);

      if (!userRequest) {
        await say({
          text: '❌ Please provide a request. Example: `@crewx analyze this code`',
          thread_ts: message.thread_ts || message.ts,
          metadata: {
            event_type: 'crewx_response',
            event_payload: {
              agent_id: this.defaultAgent,
              provider: this.defaultAgent,
              task_id: 'validation_error',
            },
          },
        });
        return;
      }

      const threadTs = message.thread_ts || message.ts;
      const threadId = `${message.channel}:${threadTs}`;

      // Per-thread guard: Prevent concurrent responses in the same thread
      const existingGuard = this.threadGuards.get(threadId);
      if (existingGuard) {
        this.logger.warn(`⚠️  Thread ${threadId} is already being processed, skipping duplicate request`);
        try {
          await client.reactions.add({
            channel: message.channel,
            timestamp: message.ts,
            name: 'hourglass_flowing_sand', // ⏳ emoji - processing in progress
          });
        } catch (reactionError) {
          this.logger.warn(`Could not add hourglass reaction: ${reactionError}`);
        }
        return;
      }

      this.logger.log(`🚀 Processing Slack request from user ${message.user}`);

      // Add "processing" reaction to original message (eyes = watching/processing)
      try {
        await client.reactions.add({
          channel: message.channel,
          timestamp: message.ts,
          name: 'eyes', // 👀 emoji
        });
      } catch (reactionError) {
        this.logger.warn(`Could not add reaction: ${reactionError}`);
      }

      // Create guard promise for this thread
      const guardPromise = (async () => {
        try {
          // Initialize conversation history provider with Slack client
          this.conversationHistory.initialize(client);

          // Build context with thread history (clean, no internal metadata)
          let contextText = '';

        // Invalidate cache to ensure fresh data on next fetch from Slack API
        try {
          this.conversationHistory.invalidateCache(threadId);
          this.logger.debug(`🗑️  Invalidated cache after user message`);
        } catch (cacheError: any) {
          this.logger.warn(`Failed to invalidate cache: ${cacheError.message}`);
          // Continue even if cache invalidation fails
        }

        // Fetch conversation thread messages for template processing
        let conversationMessages: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any>; files?: any[] }> = [];

        // If this is a reply in a thread, fetch conversation history
        if (message.thread_ts) {
          try {
            const thread = await this.conversationHistory.fetchHistory(threadId, {
              limit: 100, // Increased from 20 to support longer conversations
              maxContextLength: 4000,
              excludeCurrent: true,
            });

            if (thread.messages.length > 0) {
              // Convert to simple format for template processing, including metadata
              conversationMessages = thread.messages.map(msg => ({
                text: msg.text,
                isAssistant: msg.isAssistant,
                metadata: msg.metadata, // Include Slack metadata (user info, etc.)
                files: msg.files,
              }));

              const historyContext = await this.conversationHistory.formatForAI(thread, {
                excludeCurrent: true,
              });

              if (historyContext) {
                contextText = historyContext; // Use only clean history, no metadata
                this.logger.log(`📚 Including ${thread.messages.length} previous messages in context`);
              }

              // Download files from historical messages (mid-conversation scenario)
              await this.downloadHistoricalFiles(thread.messages, threadTs, message.channel, client);
            }
          } catch (error: any) {
            this.logger.warn(`Failed to fetch thread history: ${error.message}`);
            // Continue without history if fetch fails
          }
        }

        // Use configured default agent with executeAgent for full capabilities
        // (executeAgent supports file modifications, queryAgent is read-only)
        const basePayload = {
          agentId: this.defaultAgent,
          context: contextText || undefined,
          messages: conversationMessages.length > 0 ? conversationMessages : undefined,
          platform: 'slack' as const,
          metadata: {
            channel_id: message.channel,
            thread_ts: threadTs,
          },
        };

        const result = this.mode === 'execute'
          ? await this.crewXTool.executeAgent({
              ...basePayload,
              task: userRequest,
            })
          : await this.crewXTool.queryAgent({
              ...basePayload,
              query: userRequest,
            });

        this.logger.log(`📦 Received result from CrewX MCP`);

        // Extract actual AI response from MCP result
        // Use 'implementation' field which contains only the AI's actual response (no metadata)
        // Fallback order: implementation > content[0].text (for compatibility)
        const responseText = (result as any).implementation || 
          (result.content && result.content[0] ? result.content[0].text : 'No response');

        const blocks = this.formatter.formatExecutionResult({
          agent: (result as any).agent || this.defaultAgent,
          provider: (result as any).provider || this.defaultAgent,
          taskId: (result as any).taskId || 'unknown',
          response: responseText,
          success: (result as any).success === true,
          error: (result as any).error,
        });

        // Check success status for message text
        const isSuccess = (result as any).success === true;
        const successLabel = this.mode === 'execute' ? 'Completed!' : 'Responded!';
        const messageText = isSuccess
          ? `✅ ${successLabel} (@${(result as any).agent || this.defaultAgent})`
          : `❌ Error (@${(result as any).agent || this.defaultAgent})`;

        // Ensure agent_id is always set (crucial for conversation ownership)
        const agentId = (result as any).agent || this.defaultAgent;
        this.logger.log(`📝 Setting metadata - agent_id: ${agentId}, defaultAgent: ${this.defaultAgent}`);

        // Send result as thread reply
        const sentMessage = await say({
          text: messageText,
          blocks: blocks,
          thread_ts: message.thread_ts || message.ts,
          metadata: {
            event_type: 'crewx_response',
            event_payload: {
              agent_id: agentId,
              provider: (result as any).provider || this.defaultAgent,
              task_id: (result as any).taskId || 'unknown',
            },
          },
        });

        // Invalidate cache after assistant response to ensure fresh data on next fetch
        try {
          this.conversationHistory.invalidateCache(threadId);
          this.logger.debug(`🗑️  Invalidated cache after assistant response`);
        } catch (cacheError: any) {
          this.logger.warn(`Failed to invalidate cache: ${cacheError.message}`);
          // Continue even if cache invalidation fails
        }

        // Remove "processing" reaction and add "completed" reaction
        try {
          await client.reactions.remove({
            channel: message.channel,
            timestamp: message.ts,
            name: 'eyes',
          });
          await client.reactions.add({
            channel: message.channel,
            timestamp: message.ts,
            name: 'white_check_mark', // ✅ emoji
          });
          } catch (reactionError) {
            this.logger.warn(`Could not update reaction: ${reactionError}`);
          }
        } catch (error: any) {
          this.logger.error(`Error executing request:`, error);

          // Send error message as thread reply
          await say({
            text: `❌ Error: ${error.message}`,
            thread_ts: message.thread_ts || message.ts,
            metadata: {
              event_type: 'crewx_response',
              event_payload: {
                agent_id: this.defaultAgent,
                provider: this.defaultAgent,
                task_id: 'execution_error',
              },
            },
          });

          // Remove "processing" reaction and add "error" reaction
          try {
            await client.reactions.remove({
              channel: message.channel,
              timestamp: message.ts,
              name: 'eyes',
          });
            await client.reactions.add({
              channel: message.channel,
              timestamp: message.ts,
              name: 'x', // ❌ emoji
            });
          } catch (reactionError) {
            this.logger.warn(`Could not update reaction: ${reactionError}`);
          }
        } finally {
          if (this.conversationHistory.isLocalLoggingEnabled()) {
            try {
              await this.conversationHistory.fetchHistory(threadId, {
                limit: 100,
                maxContextLength: 4000,
              });
            } catch (logError: any) {
              this.logger.warn(`Failed to refresh Slack conversation log: ${logError.message}`);
            }
          }
        }
      } catch (error: any) {
        this.logger.error(`Error in guard promise:`, error);
      }
      })();

      // Store guard promise and ensure cleanup
      this.threadGuards.set(threadId, guardPromise);

      try {
        await guardPromise;
      } finally {
        // Always remove guard after completion (success or error)
        this.threadGuards.delete(threadId);
        this.logger.debug(`🧹 Cleaned up guard for thread ${threadId}`);
      }
    } catch (error: any) {
      this.logger.error(`Error in handleCommand wrapper:`, error);
    }
  }

  /**
   * Handle file_shared event
   * Downloads file when user uploads in a channel/thread
   */
  private async handleFileShared(event: any, client: any) {
    try {
      const fileId = event.file_id;
      const channelId = event.channel_id;
      const userId = event.user_id;

      this.logger.log(`📎 File shared event: ${fileId} in ${channelId}`);
      this.logger.warn(`⚠️  file_shared event doesn't provide reliable thread context. Skipping. File will be handled via message event.`);

      // Note: file_shared event doesn't include message context (thread_ts, ts)
      // We rely on the subsequent message event which includes both file info and thread context
      return;
    } catch (error: any) {
      this.logger.error(`Failed to handle file_shared: ${error.message}`);
    }
  }

  /**
   * Handle message with files attached
   * Downloads all files attached to a message
   */
  private async handleMessageWithFiles(message: any, client: any) {
    const threadTs = message.thread_ts || message.ts;
    const channelId = message.channel;
    const userId = message.user;
    const threadId = `${channelId}:${threadTs}`;

    this.logger.log(`📁 Processing ${message.files.length} file(s) for thread ${threadId}`);

    for (const file of message.files) {
      try {
        this.logger.debug(`⬇️  Downloading: ${file.name} (${file.id})`);
        const metadata = await this.fileDownloadService.downloadFile(
          client,
          file.id,
          file.name,
          threadId,  // ← Changed: now uses "channelId:threadTs" format
          channelId,
          userId
        );

        this.logger.log(`✅ File downloaded from message: ${metadata.fileName} (${this.formatFileSize(metadata.fileSize)})`);
      } catch (error: any) {
        this.logger.error(`Failed to download file ${file.name}: ${error.message}`);
      }
    }
  }

  /**
   * Download files from historical messages (mid-conversation scenario)
   * Ensures all files in conversation history are downloaded
   */
  private async downloadHistoricalFiles(
    messages: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>,
    threadTs: string,
    channelId: string,
    client: any
  ) {
    let downloadedCount = 0;

    for (const msg of messages) {
      if (msg.metadata?.slack?.files) {
        for (const file of msg.metadata.slack.files) {
          try {
            // Use ensureFileDownloaded to skip if already exists
            await this.fileDownloadService.ensureFileDownloaded(
              client,
              file.id,
              file.name,
              threadTs,
              channelId,
              msg.metadata.slack.user || 'unknown'
            );
            downloadedCount++;
          } catch (error: any) {
            this.logger.warn(`Failed to download historical file ${file.name}: ${error.message}`);
          }
        }
      }
    }

    if (downloadedCount > 0) {
      this.logger.log(`📎 Downloaded ${downloadedCount} historical file(s)`);
    }
  }

  /**
   * Format file size for human-readable display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  private async handleViewDetails({ ack, body, client }: any) {
    await ack();

    const taskId = body.actions[0].value;

    try {
      // Get task logs using CrewXTool
      const logsResult = await this.crewXTool.getTaskLogs({ taskId });

      const logText = logsResult.content && logsResult.content[0] ? logsResult.content[0].text : 'No logs available';

      await client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.message.thread_ts || body.message.ts,
        text: `📋 Task Logs for ${taskId}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Task Logs: ${taskId}*`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `\`\`\`${logText.substring(0, 2000)}\`\`\``,
            },
          },
        ],
      });
    } catch (error: any) {
      this.logger.error(`Error fetching task logs:`, error);
      await client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.message.thread_ts || body.message.ts,
        text: `❌ Error fetching logs: ${error.message}`,
      });
    }
  }

  private async handleRerun({ ack, body, client }: any) {
    await ack();

    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.thread_ts || body.message.ts,
      text: '🔄 To rerun, please send a new @crewx message with your request.',
    });
  }

  async start() {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 3000; // 3초

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.app.start();
        this.logger.log('⚡️ CrewX Slack Bot is running!');
        this.logger.log(`📱 Socket Mode: Enabled`);
        this.logger.log(`👂 Listening for: app mentions`);
        this.logger.log(`💡 Test with: @crewx analyze this code`);
        return;
      } catch (error: any) {
        this.logger.error(`Failed to start Slack Bot (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

        if (attempt >= MAX_RETRIES) {
          this.logger.error('Max retries reached. Exiting...');
          throw error;
        }

        this.logger.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  async stop() {
    await this.app.stop();
    this.logger.log('Slack Bot stopped');
  }
}
