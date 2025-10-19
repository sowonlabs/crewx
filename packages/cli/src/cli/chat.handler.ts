import { Logger } from '@nestjs/common';
import { Command } from 'commander';
import { CrewXTool } from '../crewx.tool';
import {
  CliConversationHistoryProvider,
  ConversationProviderFactory,
} from '../conversation';
import { CliOptions } from '../cli-options';
import * as readline from 'readline';
import * as os from 'os';
import { TerminalMessageFormatter } from '../utils/terminal-message-formatter';

/**
 * Main CLI chat handler function
 */
export async function handleChat(app: any, args: CliOptions) {
  const logger = new Logger('ChatHandler');

  try {
    const crewXTool = app.get(CrewXTool);
    const providerFactory = app.get(ConversationProviderFactory);
    const chatHandler = new ChatHandler(crewXTool, providerFactory);

    // Parse options from args
    const options: any = {};

    // Extract options from process.argv
    const argv = process.argv;
    let message = '';
    
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--thread' || argv[i] === '-t') {
        options.thread = argv[i + 1];
      } else if (argv[i] === '--new' || argv[i] === '-n') {
        options.new = true;
      } else if (argv[i] === '--list' || argv[i] === '-l') {
        options.list = true;
      } else if (argv[i] === '--delete' || argv[i] === '-d') {
        options.delete = argv[i + 1];
      } else if (argv[i] === '--cleanup') {
        options.cleanup = argv[i + 1] || '30';
      } else if (argv[i] === '--message' || argv[i] === '-m') {
        message = argv[i + 1] || '';
      }
    }

    // If message is provided, handle single message mode
    if (message) {
      options.message = message;
    }

    await chatHandler.handleChatCommand(options);
  } catch (error: any) {
    logger.error(`Chat command failed: ${error.message}`);
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Interactive chat command handler
 * Maintains conversation history for contextual interactions
 */
export class ChatHandler {
  private readonly logger = new Logger(ChatHandler.name);
  private conversationProvider: CliConversationHistoryProvider;
  private currentThreadId?: string;

  constructor(
    private readonly crewXTool: CrewXTool,
    private readonly providerFactory: ConversationProviderFactory,
  ) {
    this.conversationProvider = this.providerFactory.getProvider(
      'cli',
    ) as CliConversationHistoryProvider;
  }

  /**
   * Handle chat command
   */
  async handleChatCommand(options: any): Promise<void> {
    try {
      // Initialize provider
      await this.conversationProvider.initialize();

      // Handle list threads
      if (options.list) {
        await this.listThreads();
        return;
      }

      // Handle delete thread
      if (options.delete) {
        await this.deleteThread(options.delete);
        return;
      }

      // Handle cleanup
      if (options.cleanup) {
        await this.cleanupThreads(parseInt(options.cleanup, 10));
        return;
      }

      // Determine thread ID
      if (options.thread) {
        const threadId = options.thread as string;
        const exists = await this.conversationProvider.hasHistory(threadId);
        if (!exists) {
          console.log(`⚠️  Thread '${threadId}' not found. Creating new thread.`);
          this.currentThreadId = await this.conversationProvider.createThread(threadId);
        } else {
          this.currentThreadId = threadId;
          console.log(`📖 Continuing conversation: ${this.currentThreadId}`);
        }
      } else {
        // Create new thread
        this.currentThreadId = await this.conversationProvider.createThread();
        console.log(`✨ New conversation started: ${this.currentThreadId}`);
      }

      // Handle single message mode or start interactive chat
      if (options.message) {
        await this.handleSingleMessage(options.message);
      } else {
        await this.startInteractiveChat();
      }
    } catch (error: any) {
      this.logger.error(`Chat error: ${error.message}`);
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Handle single message without interactive mode
   */
  private async handleSingleMessage(message: string): Promise<void> {
    try {
      if (!this.currentThreadId) {
        console.error('❌ No active conversation thread');
        return;
      }

      // Parse @mentions from message
      const mentionRegex = /@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g;
      const matches = [...message.matchAll(mentionRegex)];
      
      // Extract query text (remove @mentions)
      const query = message.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g, '').trim();
      
      if (!query) {
        console.error('❌ No message content after @mentions');
        return;
      }

      // Determine which agents to use
      const parsedQueries: Array<{ agentId: string; query: string; model?: string }> = [];
      
      if (matches.length > 0) {
        // Use mentioned agents
        for (const match of matches) {
          const agentId = match[1];
          const model = match[2];
          if (agentId) {
            parsedQueries.push({ agentId, query, model });
          }
        }
      } else {
        // No mentions - use default agent
        parsedQueries.push({ agentId: 'mcp_test_agent', query });
      }

      // Add user message to history
      await this.conversationProvider.addMessage(
        this.currentThreadId,
        os.userInfo().username,
        message,
        false,
      );

      // Fetch conversation history
      const thread = await this.conversationProvider.fetchHistory(
        this.currentThreadId,
        {
          limit: 20,
          maxContextLength: 4000,
        },
      );

      // Get conversation messages for template context
      const conversationMessages = thread.messages.map((msg: any) => ({
        text: msg.text,
        isAssistant: msg.isAssistant,
        metadata: msg.metadata,
      }));

      // Format history for AI (fallback context)
      const historyContext = await this.conversationProvider.formatForAI(thread, {
        excludeCurrent: true,
      });

      // Build context
      const context = historyContext
        ? `CLI chat session\nThread: ${this.currentThreadId}\nUser: ${os.userInfo().username}\n\n${historyContext}\n\nCurrent question: ${query}`
        : `CLI chat session\nThread: ${this.currentThreadId}\nUser: ${os.userInfo().username}\n\nCurrent question: ${query}`;

      console.log('🤖 CrewX: ');

      // Execute query (single or parallel)
      if (parsedQueries.length === 1) {
        // Single agent query
        const firstQuery = parsedQueries[0];
        if (!firstQuery) {
          console.error('❌ No valid queries found');
          return;
        }
        const { agentId, model } = firstQuery;
        const result = await this.crewXTool.queryAgent({
          agentId,
          query,
          context,
          model,
          messages: conversationMessages, // Pass messages for template context
          platform: 'cli' // Indicate this is from CLI
        });

        // Extract response
        const responseText =
          result.content && result.content[0]
            ? result.content[0].text
            : 'No response';

        if (result.success) {
          console.log(responseText);

          // Add assistant response to history
          await this.conversationProvider.addMessage(
            this.currentThreadId,
            'assistant',
            responseText,
            true,
            agentId,
          );
        } else {
          console.error(`❌ Error: ${result.error || 'Query failed'}`);
        }
      } else {
        // Multiple agents - parallel execution
        console.log(`🚀 Querying ${parsedQueries.length} agents in parallel...\n`);
        
        const queries = parsedQueries.map(pq => ({
          agentId: pq.agentId,
          query: pq.query,
          context,
          model: pq.model,
          messages: conversationMessages, // Pass messages for template context
          platform: 'cli' as const // Indicate this is from CLI
        }));

        const result = await this.crewXTool.queryAgentParallel({ queries });

        // Display results
        if (result.results && Array.isArray(result.results)) {
          let hasAnySuccess = false;
          
          for (const agentResult of result.results) {
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`Agent: @${agentResult.agentId} ${agentResult.success ? '✅' : '❌'}`);
            console.log('─'.repeat(60));
            
            if (agentResult.success) {
              hasAnySuccess = true;
              console.log(agentResult.response || 'No response');
              
              // Add to history
              await this.conversationProvider.addMessage(
                this.currentThreadId,
                'assistant',
                agentResult.response || 'No response',
                true,
                agentResult.agentId,
              );
            } else {
              console.error(`Error: ${agentResult.error || 'Unknown error'}`);
            }
          }
          
          if (!hasAnySuccess) {
            console.error('\n❌ All agents failed');
          }
        }
      }

      console.log(`\n💾 Conversation saved to thread: ${this.currentThreadId}`);
    } catch (error: any) {
      this.logger.error(`Error processing single message: ${error.message}`);
      console.error(`❌ Error: ${error.message}`);
    }
  }

  /**
   * Start interactive chat session
   */
  private async startInteractiveChat(): Promise<void> {
    return new Promise<void>((resolve) => {
      console.log('\n💬 Interactive Chat Mode');
      console.log('Type your message and press Enter. Type "exit" or "quit" to end.');
      console.log('💡 Tip: Use @agent_name to query specific agents (e.g., @claude What is TypeScript?)\n');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '🧑 You: ',
      });

      rl.prompt();

      rl.on('line', async (input: string) => {
        const message = input.trim();

        // Check for exit commands
        if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
          console.log(`\n👋 Conversation saved as: ${this.currentThreadId}`);
          rl.close();
          resolve();
          process.exit(0);
        }

        if (!message) {
          rl.prompt();
          return;
        }

        try {
          if (!this.currentThreadId) {
            console.error('❌ No active conversation thread\n');
            rl.prompt();
            return;
          }

          // Parse @mentions from message
          const mentionRegex = /@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g;
          const matches = [...message.matchAll(mentionRegex)];
          
          // Extract query text (remove @mentions)
          const query = message.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g, '').trim();
          
          if (!query) {
            console.error('❌ No message content after @mentions\n');
            rl.prompt();
            return;
          }

          // Determine which agents to use
          const parsedQueries: Array<{ agentId: string; query: string; model?: string }> = [];
          
          if (matches.length > 0) {
            // Use mentioned agents
            for (const match of matches) {
              const agentId = match[1];
              const model = match[2];
              if (agentId) {
                parsedQueries.push({ agentId, query, model });
              }
            }
          } else {
            // No mentions - use default agent
            parsedQueries.push({ agentId: 'mcp_test_agent', query });
          }

          // Add user message to history
          await this.conversationProvider.addMessage(
            this.currentThreadId,
            os.userInfo().username,
            message,
            false,
          );

          // Fetch conversation history
          const thread = await this.conversationProvider.fetchHistory(
            this.currentThreadId,
            {
              limit: 20,
              maxContextLength: 4000,
            },
          );

          // Get conversation messages for template context
          const conversationMessages = thread.messages.map((msg: any) => ({
            text: msg.text,
            isAssistant: msg.isAssistant,
            metadata: msg.metadata,
          }));

          // Format history for AI (fallback context)
          const historyContext = this.conversationProvider.formatForAI(thread, {
            excludeCurrent: true,
          });

          // Build context
          const context = historyContext
            ? `CLI chat session\nThread: ${this.currentThreadId}\nUser: ${os.userInfo().username}\n\n${historyContext}\n\nCurrent question: ${query}`
            : `CLI chat session\nThread: ${this.currentThreadId}\nUser: ${os.userInfo().username}\n\nCurrent question: ${query}`;

          console.log('🤖 CrewX: ');

          // Execute query (single or parallel)
          if (parsedQueries.length === 1) {
            // Single agent query
            const firstQuery = parsedQueries[0];
            if (!firstQuery) {
              console.error('❌ No valid queries found\n');
              rl.prompt();
              return;
            }
            const { agentId, model } = firstQuery;
            const result = await this.crewXTool.queryAgent({
              agentId,
              query,
              context,
              model,
              messages: conversationMessages, // Pass messages for template context
              platform: 'cli' // Indicate this is from CLI
            });

            // Extract response
            const responseText =
              result.content && result.content[0]
                ? result.content[0].text
                : 'No response';

            if (result.success) {
              console.log(responseText);
              console.log();

              // Add assistant response to history
              await this.conversationProvider.addMessage(
                this.currentThreadId,
                'assistant',
                responseText,
                true,
                agentId,
              );
            } else {
              console.error(`❌ Error: ${result.error || 'Query failed'}\n`);
            }
          } else {
            // Multiple agents - parallel execution
            console.log(`🚀 Querying ${parsedQueries.length} agents in parallel...\n`);
            
            const queries = parsedQueries.map(pq => ({
              agentId: pq.agentId,
              query: pq.query,
              context,
              model: pq.model,
              messages: conversationMessages, // Pass messages for template context
              platform: 'cli' as const // Indicate this is from CLI
            }));

            const result = await this.crewXTool.queryAgentParallel({ queries });

            // Display results
            if (result.results && Array.isArray(result.results)) {
              let hasAnySuccess = false;
              
              for (const agentResult of result.results) {
                console.log(`\n${'═'.repeat(50)}`);
                console.log(`Agent: @${agentResult.agentId} ${agentResult.success ? '✅' : '❌'}`);
                console.log('─'.repeat(50));
                
                if (agentResult.success) {
                  hasAnySuccess = true;
                  console.log(agentResult.response || 'No response');
                  
                  // Add to history
                  await this.conversationProvider.addMessage(
                    this.currentThreadId,
                    'assistant',
                    agentResult.response || 'No response',
                    true,
                    agentResult.agentId,
                  );
                } else {
                  console.error(`Error: ${agentResult.error || 'Unknown error'}`);
                }
              }
              
              console.log();
              
              if (!hasAnySuccess) {
                console.error('❌ All agents failed\n');
              }
            }
          }
        } catch (error: any) {
          this.logger.error(`Error processing message: ${error.message}`);
          console.error(`❌ Error: ${error.message}\n`);
        }

        rl.prompt();
      });

      rl.on('close', () => {
        console.log(`\n👋 Conversation saved as: ${this.currentThreadId}`);
        resolve();
        process.exit(0);
      });
    });
  }

  /**
   * List all conversation threads
   */
  private async listThreads(): Promise<void> {
    const threads = await this.conversationProvider.listThreads();

    if (threads.length === 0) {
      console.log('No conversation threads found.');
      return;
    }

    console.log('\n📚 Conversation Threads:\n');

    for (const threadId of threads) {
      const thread = await this.conversationProvider.fetchHistory(threadId);
      const messageCount = thread.messages.length;
      const lastMessage = thread.messages[messageCount - 1];
      const preview = lastMessage
        ? lastMessage.text.substring(0, 50) + '...'
        : 'Empty';

      console.log(`  ${threadId}`);
      console.log(`    Messages: ${messageCount}`);
      console.log(`    Last: ${preview}`);
      console.log();
    }
  }

  /**
   * Show conversation history
   */
  private async showHistory(threadId: string): Promise<void> {
    const thread = await this.conversationProvider.fetchHistory(threadId);

    if (thread.messages.length === 0) {
      console.log(`Thread '${threadId}' not found or empty.`);
      return;
    }

    const formatter = new TerminalMessageFormatter({
      colorize: process.stdout.isTTY,
      indent: 4,
    });

    const structuredMessages = formatter.convertToStructuredArray(thread.messages);
    const history = formatter.formatHistory(structuredMessages);

    console.log(`\n📖 Conversation History: ${threadId}\n`);
    console.log(history);
    console.log();
  }

  /**
   * Delete a thread
   */
  private async deleteThread(threadId: string): Promise<void> {
    const exists = await this.conversationProvider.hasHistory(threadId);

    if (!exists) {
      console.log(`Thread '${threadId}' not found.`);
      return;
    }

    await this.conversationProvider.deleteThread(threadId);
    console.log(`✅ Thread '${threadId}' deleted.`);
  }

  /**
   * Cleanup old threads
   */
  private async cleanupThreads(days: number): Promise<void> {
    console.log(`🧹 Cleaning up threads older than ${days} days...`);
    const count = await this.conversationProvider.cleanupOldThreads(days);
    console.log(`✅ Deleted ${count} old threads.`);
  }
}
