import { App, LogLevel } from '@slack/bolt';
import { Logger } from '@nestjs/common';
import { CrewXTool } from '../crewx.tool';
import { SlackMessageFormatter } from './formatters/message.formatter';
import { SlackConversationHistoryProvider } from '../conversation/slack-conversation-history.provider';
import { ConfigService } from '../services/config.service';
import { AIProviderService } from '../ai-provider.service';

export class SlackBot {
  private readonly logger = new Logger(SlackBot.name);
  private app: App;
  private formatter: SlackMessageFormatter;
  private conversationHistory: SlackConversationHistoryProvider;
  private defaultAgent: string;
  private botUserId: string | null = null;
  private readonly mode: 'query' | 'execute';

  constructor(
    private readonly crewXTool: CrewXTool,
    private readonly configService: ConfigService,
    private readonly aiProviderService: AIProviderService,
    defaultAgent: string = 'claude',
    mode: 'query' | 'execute' = 'query'
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
    this.formatter = new SlackMessageFormatter();
    this.conversationHistory = new SlackConversationHistoryProvider();

    if (this.configService.shouldLogSlackConversations()) {
      this.logger.log('📝 Slack conversation logging enabled (local storage).');
      this.conversationHistory.enableLocalLogging().catch(error => {
        this.logger.warn(`Failed to enable Slack conversation logging: ${error.message}`);
      });
    }

    this.logger.log(`🤖 Slack bot initialized with default agent: ${this.defaultAgent}`);
    this.logger.log(`⚙️  Slack bot mode: ${this.mode}`);
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
      this.logger.log(`🤖 Bot User ID: ${this.botUserId}`);
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
   */
  private async shouldRespondToMessage(message: any, client: any): Promise<boolean> {
    const botUserId = await this.getBotUserId(client);
    const text = message.text || '';

    // 🔍 DEBUG: Log incoming message details
    this.logger.log(`
🔍 === shouldRespondToMessage DEBUG ===
📝 Message text: "${text.substring(0, 100)}"
👤 User: ${message.user}
📍 Channel: ${message.channel}
🧵 Thread TS: ${message.thread_ts || 'none'}
⏰ Message TS: ${message.ts}
🤖 Bot User ID: ${botUserId}
🎯 Default Agent: ${this.defaultAgent}
    `);

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

    // 4. Check if this is a threaded message where bot was the last speaker
    if (message.thread_ts) {
      this.logger.log(`🧵 Thread detected, fetching history...`);
      try {
        const threadHistory = await client.conversations.replies({
          channel: message.channel,
          ts: message.thread_ts,
          limit: 100,
          include_all_metadata: true, // 🔑 CRITICAL: Required to get event_payload in metadata!
        });

        this.logger.log(`📚 Thread history (${threadHistory.messages.length} messages):`);
        threadHistory.messages.forEach((msg: any, idx: number) => {
          // Full metadata dump for debugging
          const metadataStr = msg.metadata ? JSON.stringify(msg.metadata, null, 2) : 'none';
          this.logger.log(`  [${idx}] ${msg.ts} | User: ${msg.user} | Text: "${(msg.text || '').substring(0, 50)}"`);
          if (msg.metadata) {
            this.logger.log(`       Metadata: ${metadataStr}`);
          }
        });

        // Find the last bot message (crewx_response) in the thread
        // Support both event types for compatibility with different bot implementations
        const lastBotMessage = [...threadHistory.messages]
          .reverse()
          .find((msg: any) =>
            msg.metadata?.event_type === 'crewx_response'
          );

        if (lastBotMessage) {
          // Check if the last bot message was from this agent
          let lastAgentId = lastBotMessage.metadata?.event_payload?.agent_id;

          // FALLBACK: Parse agent ID from message text if metadata is missing
          // Message format: "✅ Completed! (@agent_name)" or "❌ Error (@agent_name)"
          if (!lastAgentId && lastBotMessage.text) {
            const agentMatch = lastBotMessage.text.match(/@([a-zA-Z0-9_]+)\)/);
            if (agentMatch) {
              lastAgentId = agentMatch[1];
              this.logger.log(`🔧 Fallback: Extracted agent ID from message text: ${lastAgentId}`);
            }
          }

          const isLastSpeaker = lastAgentId === this.defaultAgent;

          this.logger.log(`
🔍 Last bot message found:
  TS: ${lastBotMessage.ts}
  Agent ID: ${lastAgentId} (from ${lastBotMessage.metadata?.event_payload?.agent_id ? 'metadata' : 'text parsing'})
  Is Last Speaker: ${isLastSpeaker} (current: ${this.defaultAgent})
          `);

          if (isLastSpeaker) {
            this.logger.log(`✅ DECISION: Bot is last speaker → RESPOND`);
            return true;
          } else {
            this.logger.log(`⏭️  DECISION: Another bot is last speaker (${lastAgentId}) → SKIP`);
            return false;
          }
        }

        this.logger.log(`⚠️  No bot messages with metadata found in thread`);

        // If no bot messages found, check if bot has participated at all
        const botParticipated = threadHistory.messages.some(
          (msg: any) => msg.user === botUserId
        );

        this.logger.log(`🔍 Bot participation check (by user ID): ${botParticipated}`);

        if (botParticipated) {
          this.logger.log(`✅ DECISION: Bot participated (fallback) → RESPOND`);
          return true;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to check thread participation: ${error.message}`);
        return false;
      }
    }

    // 5. No mention present - respond with default agent
    this.logger.log(`✅ DECISION: No mention, no thread → Default agent RESPOND`);
    return true;
  }

  private registerHandlers() {
    // Log all messages for debugging
    this.app.event('message', async ({ event, logger }) => {
      this.logger.debug(`📨 Received message event: ${JSON.stringify(event).substring(0, 200)}`);
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
      // Ignore bot messages and threaded replies to avoid loops
      if ((message as any).subtype || (message as any).bot_id) {
        return;
      }

      const text = (message as any).text || '';
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

      const threadTs = message.thread_ts || message.ts;
      const threadId = `${message.channel}:${threadTs}`;

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
        let conversationMessages: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }> = [];

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
                metadata: msg.metadata // Include Slack metadata (user info, etc.)
              }));

              const historyContext = await this.conversationHistory.formatForAI(thread, {
                excludeCurrent: true,
              });

              if (historyContext) {
                contextText = historyContext; // Use only clean history, no metadata
                this.logger.log(`📚 Including ${thread.messages.length} previous messages in context`);
              }
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
      this.logger.error(`Error handling command:`, error);
      await say({
        text: `❌ Internal error: ${error.message}`,
        thread_ts: (message as any).thread_ts || (message as any).ts,
        metadata: {
          event_type: 'crewx_response',
          event_payload: {
            agent_id: this.defaultAgent,
            provider: this.defaultAgent,
            task_id: 'internal_error',
          },
        },
      });
    }
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
        this.logger.log(`🤖 Coordinator Agent: slack-coordinator`);
        this.logger.log(`👂 Listening for: app mentions, DMs, and "crewx" keywords`);
        this.logger.log(`💡 Test with: @crewx analyze this code`);
        return; // 성공 시 종료
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
