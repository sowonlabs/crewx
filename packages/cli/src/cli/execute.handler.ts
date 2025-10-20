import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { CrewXTool } from '../crewx.tool';
import {
  readStdin,
  formatPipedContext,
  parseStructuredPayload,
  buildContextFromStructuredPayload,
} from '../utils/stdin-utils';
import { ConversationProviderFactory, CliConversationHistoryProvider } from '../conversation';
import * as os from 'os';

const logger = new Logger('ExecuteHandler');

type ConversationMessage = {
  text: string;
  isAssistant: boolean;
  metadata?: Record<string, any>;
};

function mergeMessages(
  pipedMessages: ConversationMessage[],
  existingMessages: ConversationMessage[],
): ConversationMessage[] {
  if (pipedMessages.length === 0) {
    return existingMessages;
  }

  const seen = new Set<string>();
  const result: ConversationMessage[] = [];

  const push = (msg: ConversationMessage) => {
    const key = JSON.stringify({
      text: msg.text,
      isAssistant: msg.isAssistant,
      metadata: msg.metadata || {},
    });
    if (!seen.has(key)) {
      seen.add(key);
      result.push(msg);
    }
  };

  pipedMessages.forEach(push);
  existingMessages.forEach(push);

  return result;
}

/**
 * Handle execute command: crewx execute "@agent task"
 * This will be implemented by the development team
 */
export async function handleExecute(app: any, args: CliOptions) {
  logger.log('Execute command received');

  if (!args.execute) {
    logger.error('No execute task provided');
    console.log('Usage: crewx execute "<task>"');
    console.log('Example (default agent): crewx execute "implement login"');
    console.log('Example (specific agents): crewx execute "@frontend @backend implement login"');
    console.log('Example (parallel): crewx execute "@claude task1" "@claude task2"');
    console.log('Example (with thread): crewx execute "@claude implement login" --thread "auth-feature"');
    process.exit(1);
  }

  try {
    // Initialize conversation provider if thread is specified
    let conversationProvider: CliConversationHistoryProvider | undefined;
    let conversationContext = '';
    let conversationMessagesFromThread: ConversationMessage[] = [];

    if (args.thread) {
      const conversationFactory = app.get(ConversationProviderFactory);
      conversationProvider = conversationFactory.getProvider('cli') as CliConversationHistoryProvider;
      await conversationProvider.initialize();

      const threadId = args.thread;
      const exists = await conversationProvider.hasHistory(threadId);

      if (!exists) {
        console.log(`📝 Creating new conversation thread: ${threadId}`);
        await conversationProvider.createThread(threadId);
      } else {
        console.log(`🔗 Continuing conversation thread: ${threadId}`);
      }

      // Get conversation history and format for context
      const history = await conversationProvider.fetchHistory(args.thread, {
        limit: 100,
        maxContextLength: 4000,
      });

      conversationMessagesFromThread = history.messages.map((msg: any) => ({
        text: msg.text,
        isAssistant: msg.isAssistant,
        metadata: msg.metadata,
      }));

      if (history.messages.length > 0) {
        const formattedHistory = await conversationProvider.formatForAI(history, {
          excludeCurrent: false,
        });

        if (formattedHistory && formattedHistory.trim()) {
          conversationContext = `Previous conversation context from thread "${args.thread}":\n${formattedHistory}\n\n`;
          logger.log(`Loaded conversation context for thread: ${args.thread}`);
        }
      }
    }

    // Get execute input - support both single string and array of separate tasks
    const executeInput = Array.isArray(args.execute) ? args.execute : [args.execute];

    // Check for piped input (stdin) and convert to context
    const pipedInput = await readStdin();
    const structuredPayload = parseStructuredPayload(pipedInput);
    const contextFromPipe = structuredPayload
      ? buildContextFromStructuredPayload(structuredPayload) ?? (pipedInput ? formatPipedContext(pipedInput) : undefined)
      : pipedInput
        ? formatPipedContext(pipedInput)
        : undefined;
    const pipedMessages: ConversationMessage[] = structuredPayload?.messages ?? [];

    if (pipedInput) {
      console.log('📥 Received piped input - using as context');
    }

    const combinedMessages = mergeMessages(pipedMessages, conversationMessagesFromThread);

    // Get CrewXTool from app context
    const crewXTool = app.get(CrewXTool);

    // Parse each execute argument separately
    interface ParsedTask {
      agentId: string;
      task: string;
      model?: string; // Optional model specification
    }

    const parsedTasks: ParsedTask[] = [];
    const mentionRegex = /@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g; // Add global flag

    for (const taskStr of executeInput) {
      // Find only @mentions at the start of the string (before any non-mention text)
      const leadingMentionsRegex = /^(?:@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?\s*)+/;
      const leadingMatch = taskStr.match(leadingMentionsRegex);

      if (!leadingMatch) {
        // No leading mentions found - use default crewx agent
        const task = taskStr.trim();
        if (task) {
          parsedTasks.push({ agentId: 'crewx', task, model: undefined });
        }
        continue;
      }

      // Extract the leading mentions portion
      const mentionsText = leadingMatch[0];

      // Extract the task text (everything after the leading mentions)
      const task = taskStr.slice(mentionsText.length).trim();

      if (!task) {
        continue; // Skip if no task text after removing mentions
      }

      // Find all individual @mentions within the leading mentions portion
      const matches = [...mentionsText.matchAll(mentionRegex)];

      // Create a separate task for each agent mention
      for (const match of matches) {
        const agentId = match[1];
        const model = match[2]; // Capture model if provided
        if (agentId) {
          parsedTasks.push({ agentId, task, model });
        }
      }
    }

    if (parsedTasks.length === 0) {
      console.log('❌ No valid tasks found');
      console.log('Usage: crewx execute "<task>"');
      console.log('Example (default agent): crewx execute "implement API"');
      console.log('Example (specific agent): crewx execute "@backend implement API"');
      console.log('Example (parallel): crewx execute "@claude task1" "@claude task2"');
      process.exit(1);
    }

    // Validate all agents exist before execution
    try {
      const agentsResult = await crewXTool.listAgents();
      const validAgentIds = new Set(agentsResult.availableAgents?.map((a: any) => a.id) || []);
      
      const invalidAgents = parsedTasks
        .filter(pt => !validAgentIds.has(pt.agentId))
        .map(pt => pt.agentId);

      if (invalidAgents.length > 0) {
        const uniqueInvalid = [...new Set(invalidAgents)];
        const errorMsg = `Error: Agent(s) not found: ${uniqueInvalid.map(a => `@${a}`).join(', ')}`;
        console.error(errorMsg);
        process.exit(1);
      }
    } catch (error) {
      const errorMsg = `Error: Failed to load agents - ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      process.exit(1);
    }

    console.log(`⚡ Processing ${parsedTasks.length} ${parsedTasks.length === 1 ? 'task' : 'tasks'}`);

    if (parsedTasks.length === 1) {
      // Single task execution
      const firstTask = parsedTasks[0];
      if (!firstTask) {
        console.log('❌ No valid tasks found');
        process.exit(1);
      }
      const { agentId, task, model } = firstTask;
      console.log(`📋 Task: ${task}`);
      console.log(`🤖 Agent: @${agentId}${model ? `:${model}` : ''}`);
      if (args.thread) {
        console.log(`🧵 Thread: ${args.thread}`);
      }
      console.log('');
      console.log(`⚡ Executing task with single agent: @${agentId}${model ? `:${model}` : ''}`);
      console.log('────────────────────────────────────────────────────────────');
      console.log('');

      // Combine conversation context with current task
      const enhancedTask = conversationContext 
        ? `${conversationContext}Current task: ${task}`
        : task;

      const combinedContextPieces = [contextFromPipe].filter(Boolean).join('\n\n');

      const result = await crewXTool.executeAgent({
        agentId: agentId,
        task: enhancedTask,
        projectPath: process.cwd(),
        context: combinedContextPieces || undefined,
        model: model,
        messages: combinedMessages,
        provider: args.provider // NEW: Pass provider option
      });

      // Extract response from MCP format: content[0].text or implementation
      const responseText = result.implementation ||
                          (result.content && result.content[0]?.text) ||
                          result.response ||
                          'No response content';

      // Save to conversation history if thread is specified
      if (conversationProvider && args.thread) {
        await conversationProvider.addMessage(
          args.thread,
          os.userInfo().username,
          task,
          false
        );

        if (result.success && responseText) {
          await conversationProvider.addMessage(
            args.thread,
            'assistant',
            responseText,
            true,
            agentId
          );
        }
      }

      // Format and display result
      const status = result.success ? '🟢 Status: Success' : '🔴 Status: Failed';
      console.log(`📊 Results from @${agentId}:`);
      console.log('════════════════════════════════════════════════════════════');
      console.log(status);
      console.log(`🤖 Provider: ${result.provider}`);
      console.log(`📝 Task ID: ${result.taskId}`);
      console.log('');
      console.log(`📄 Response:`);
      console.log('────────────────────────────────────────');
      console.log(result.success ? responseText : `❌ Error: ${result.error}`);
      console.log('');
      console.log(`📁 Working Directory: ${result.workingDirectory}`);
      console.log('');
      console.log(result.success ? '✅ Execution completed successfully' : '❌ Execution failed');

    } else {
      // Multiple tasks execution (parallel)
      console.log(`🚀 Executing ${parsedTasks.length} tasks in parallel:`);
      parsedTasks.forEach((pt, index) => {
        console.log(`   ${index + 1}. @${pt.agentId}: ${pt.task.substring(0, 50)}${pt.task.length > 50 ? '...' : ''}`);
      });
      if (args.thread) {
        console.log(`🧵 Thread: ${args.thread}`);
      }
      console.log('────────────────────────────────────────────────────────────');
      console.log('');

      const combinedContextPieces = [contextFromPipe].filter(Boolean).join('\n\n');

      const tasks = parsedTasks.map(pt => ({
        agentId: pt.agentId,
        task: conversationContext ? `${conversationContext}Current task: ${pt.task}` : pt.task,
        projectPath: process.cwd(),
        context: combinedContextPieces || undefined,
        model: pt.model,
        messages: combinedMessages,
        provider: args.provider // NEW: Pass provider option to all parallel tasks
      }));

      // Save user tasks to conversation history if thread is specified
      if (conversationProvider && args.thread) {
        const combinedUserTask = parsedTasks.map(pt => `@${pt.agentId}: ${pt.task}`).join('\n');
        await conversationProvider.addMessage(
          args.thread,
          os.userInfo().username,
          combinedUserTask,
          false
        );
      }

      const result = await crewXTool.executeAgentParallel({ tasks });

      // Save successful results to conversation history if thread is specified
      if (conversationProvider && args.thread && result.results) {
        for (const agentResult of result.results) {
          if (agentResult.success && agentResult.content) {
            const responseText = agentResult.implementation ||
                              (agentResult.content && agentResult.content[0]?.text) ||
                              agentResult.response ||
                              'No response content';
            const agentName = agentResult.agentId || agentResult.agent;

            await conversationProvider.addMessage(
              args.thread,
              'assistant',
              responseText,
              true,
              agentName
            );
          }
        }
      }
      
      // Format and display results
      console.log(`📊 Parallel Execution Results:`);
      console.log('════════════════════════════════════════════════════════════');
      console.log(`📈 Summary:`);
      console.log(`   • Total Tasks: ${result.summary.total}`);
      console.log(`   • Successful: ${result.summary.successful}`);
      console.log(`   • Failed: ${result.summary.failed}`);
      console.log(`   • Total Duration: ${result.summary.totalDuration}ms`);
      console.log(`   • Average Duration: ${result.summary.averageDuration}ms`);
      console.log('');
      console.log('');
      
      // Display individual results
      result.results.forEach((agentResult: any, index: number) => {
        const status = agentResult.success ? '🟢 Status: Success' : '🔴 Status: Failed';
        console.log(`${index + 1}. Agent: @${agentResult.agent} (${agentResult.provider}) - ${agentResult.duration}ms`);
        console.log(`   📋 Task ID: ${agentResult.taskId}`);
        console.log('──────────────────────────────────────────────────');
        console.log(status);
        console.log(`📄 Response:`);
        // Extract response from MCP format
        const responseText = agentResult.implementation || 
                            (agentResult.content && agentResult.content[0]?.text) || 
                            agentResult.response || 
                            'No response content';
        console.log(agentResult.success ? responseText : `❌ Error: ${agentResult.error}`);
        if (index < result.results.length - 1) {
          console.log('');
        }
      });
      
      console.log('');
      console.log(`⚡ Performance Insights:`);
      console.log(`   • Fastest Task: ${Math.min(...result.results.map((r: any) => r.duration))}ms`);
      console.log(`   • Slowest Task: ${Math.max(...result.results.map((r: any) => r.duration))}ms`);
      const timeSaved = result.summary.totalDuration - Math.max(...result.results.map((r: any) => r.duration));
      console.log(`   • Time Saved: ${timeSaved}ms (vs sequential)`);
      console.log('');
      
      // Check if all tasks failed
      const allFailed = result.results.every((r: any) => !r.success);
      const hasAnySuccess = result.results.some((r: any) => r.success);
      
      if (allFailed) {
        console.log('❌ All tasks failed');
        process.exit(1);
      } else if (hasAnySuccess) {
        console.log('✅ Execution completed successfully');
      } else {
        console.log('⚠️  Execution completed with mixed results');
      }
    }
    
  } catch (error) {
    logger.error(`Execute failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
