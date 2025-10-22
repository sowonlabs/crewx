# SowonAI CrewX SDK

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://badge.fury.io/js/%40sowonai%2Fcrewx-sdk.svg)](https://www.npmjs.com/package/@sowonai/crewx-sdk)

Core SDK for building custom AI agent integrations and tools on top of SowonAI CrewX.

## Overview

The CrewX SDK provides the foundational interfaces, types, and utilities for building AI agent systems. It's designed to be framework-agnostic and extensible, allowing you to:

- Build custom AI provider integrations
- Implement conversation history management
- Create knowledge base utilities
- Develop agent orchestration systems
- Integrate with existing applications

## Installation

```bash
npm install @sowonai/crewx-sdk
```

For peer dependencies (if using NestJS):

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick Start

### Basic Usage with createCrewxAgent (NEW)

The SDK provides a high-level `createCrewxAgent` factory function for simplified agent creation:

```typescript
import { createCrewxAgent } from '@sowonai/crewx-sdk';

// Create an agent with configuration
const { agent, onEvent } = await createCrewxAgent({
  provider: {
    namespace: 'cli',
    id: 'codex',
    apiKey: process.env.CODEX_TOKEN,
  },
  enableCallStack: true,
  defaultAgentId: 'my-agent',
});

// Subscribe to agent events
onEvent('callStackUpdated', (stack) => {
  console.log('Call stack:', stack.map(f => `${f.depth}: ${f.agentId}`));
});

onEvent('agentStarted', ({ agentId, mode }) => {
  console.log(`Agent ${agentId} started in ${mode} mode`);
});

// Execute a query (read-only)
const queryResult = await agent.query({
  prompt: 'What is the current status?',
  context: 'Project: CrewX',
  messages: [
    {
      id: 'msg-1',
      text: 'Previous message',
      timestamp: new Date().toISOString(),
      isAssistant: false,
    },
  ],
});

console.log(queryResult.content);

// Execute an action (write mode)
const executeResult = await agent.execute({
  prompt: 'Create a summary document',
  context: 'Project root: /path/to/project',
});

console.log(executeResult.content);
```

### Using Utilities

```typescript
import {
  MentionParser,
  loadAvailableAgents,
  type AgentConfig,
  type AIProvider
} from '@sowonai/crewx-sdk';

// Parse agent mentions from user input
const parser = new MentionParser();
const parsed = parser.parse('@claude analyze this code');

console.log(parsed.mentions); // ['claude']
console.log(parsed.cleanedPrompt); // 'analyze this code'
```

### Working with Conversation History

```typescript
import {
  type ConversationMessage,
  type ConversationThread,
  type IConversationHistoryProvider,
  getConversationConfig
} from '@sowonai/crewx-sdk';

// Implement custom conversation storage
class MyConversationProvider implements IConversationHistoryProvider {
  async fetchHistory(options) {
    // Fetch from your database
    return {
      messages: [],
      metadata: { platform: 'my-platform' }
    };
  }

  async saveMessage(message, threadId) {
    // Save to your database
  }

  // ... other methods
}
```

### Using Document Manager

```typescript
import { DocumentManager } from '@sowonai/crewx-sdk';

const docManager = new DocumentManager();

// Load markdown documents
await docManager.loadDocument('./docs/api.md', 'markdown');

// Get document content
const content = docManager.getDocument('./docs/api.md');
console.log(content);
```

## API Reference

### Core Interfaces

#### AIProvider

The fundamental interface for all AI providers:

```typescript
interface AIProvider {
  respond(
    prompt: string,
    options?: AIQueryOptions
  ): Promise<AIResponse>;
}

interface AIQueryOptions {
  messages?: ConversationMessage[];
  pipedContext?: string;
  model?: string;
  // ... other options
}

interface AIResponse {
  content: string;
  metadata?: Record<string, unknown>;
}
```

#### IConversationHistoryProvider

Interface for conversation storage implementations:

```typescript
interface IConversationHistoryProvider {
  fetchHistory(options: FetchHistoryOptions): Promise<ConversationThread>;
  saveMessage(message: ConversationMessage, threadId: string): Promise<void>;
  createThread(threadId: string, metadata?: Record<string, unknown>): Promise<void>;
  listThreads(): Promise<Array<{ id: string; updatedAt: Date }>>;
}
```

### Configuration

#### TimeoutConfig

Manage timeout settings for AI operations:

```typescript
import { getTimeoutConfig, getDefaultTimeoutConfig } from '@sowonai/crewx-sdk';

// Get timeout configuration
const timeout = getTimeoutConfig();

// Use default timeouts
const defaults = getDefaultTimeoutConfig();
console.log(defaults.default); // 120000ms
console.log(defaults.query); // 60000ms
console.log(defaults.execute); // 300000ms
```

#### ConversationConfig

Configure conversation behavior:

```typescript
import { getConversationConfig, DEFAULT_CONVERSATION_CONFIG } from '@sowonai/crewx-sdk';

const config = getConversationConfig();
// Or use defaults
console.log(DEFAULT_CONVERSATION_CONFIG);
```

### Utilities

#### MentionParser

Parse agent mentions from text:

```typescript
import { MentionParser, type ParsedMentions } from '@sowonai/crewx-sdk';

const parser = new MentionParser();

// Parse single mention
const result = parser.parse('@claude help me');
// result.mentions: ['claude']
// result.cleanedPrompt: 'help me'

// Parse multiple mentions
const multi = parser.parse('@claude @gemini compare approaches');
// multi.mentions: ['claude', 'gemini']

// Override model
const withModel = parser.parse('@claude:opus analyze');
// Model override detected
```

#### Error Utilities

Handle errors consistently:

```typescript
import { getErrorMessage, getErrorStack, isError } from '@sowonai/crewx-sdk';

try {
  // ... operation
} catch (err) {
  if (isError(err)) {
    console.error(getErrorMessage(err));
    console.error(getErrorStack(err));
  }
}
```

### Agent Factory API

#### createCrewxAgent

Create and configure an agent with event support:

```typescript
import {
  createCrewxAgent,
  type CrewxAgentConfig,
  type CrewxAgent,
  type AgentQueryRequest,
  type AgentExecuteRequest,
  type CallStackFrame
} from '@sowonai/crewx-sdk';

// Configuration interface
interface CrewxAgentConfig {
  provider?: {
    namespace: string;
    id: string;
    apiKey?: string;
    model?: string;
  };
  knowledgeBase?: {
    path?: string;
    sources?: string[];
  };
  enableCallStack?: boolean;
  defaultAgentId?: string;
}

// Create agent
const { agent, onEvent, eventBus } = await createCrewxAgent({
  provider: { namespace: 'cli', id: 'codex' },
  enableCallStack: true,
});

// Agent interface
agent.query(request: AgentQueryRequest): Promise<AgentResult>
agent.execute(request: AgentExecuteRequest): Promise<AgentResult>
agent.getCallStack(): CallStackFrame[]
```

#### Event System

The event system supports lifecycle and call stack tracking:

```typescript
// Subscribe to events
const unsubscribe = onEvent('eventName', (payload) => {
  console.log('Event:', payload);
});

// Supported events:
// - 'callStackUpdated': CallStackFrame[]
// - 'agentStarted': { agentId: string, mode: 'query' | 'execute' }
// - 'agentCompleted': { agentId: string, success: boolean }
// - 'toolCallStarted': { toolName: string, args: any }
// - 'toolCallCompleted': { toolName: string, result: any }

// Unsubscribe when done
unsubscribe();

// Direct event bus access for advanced usage
eventBus.emit('customEvent', { data: 'value' });
eventBus.listenerCount('eventName');
eventBus.clear(); // Remove all listeners
```

### Types

#### Agent Types

```typescript
import type {
  AgentConfig,
  AgentsConfig,
  AgentInfo,
  AgentQueryOptions,
  AgentResponse,
  RemoteAgentConfigInput,
  RemoteAgentInfo
} from '@sowonai/crewx-sdk';

import { ExecutionMode, SecurityLevel } from '@sowonai/crewx-sdk';
```

## Provider Development

### Creating a Custom Provider

```typescript
import { AIProvider, AIQueryOptions, AIResponse } from '@sowonai/crewx-sdk';

export class MyCustomProvider implements AIProvider {
  async respond(
    prompt: string,
    options?: AIQueryOptions
  ): Promise<AIResponse> {
    // Implement your AI provider logic
    const result = await this.callMyAI(prompt, options);

    return {
      content: result.text,
      metadata: {
        model: result.model,
        tokens: result.usage
      }
    };
  }

  private async callMyAI(prompt: string, options?: AIQueryOptions) {
    // Your implementation
    return {
      text: 'Response from my AI',
      model: 'my-model-v1',
      usage: { total: 100 }
    };
  }
}
```

### Implementing Conversation Storage

```typescript
import {
  IConversationHistoryProvider,
  ConversationMessage,
  ConversationThread,
  FetchHistoryOptions
} from '@sowonai/crewx-sdk';

export class DatabaseConversationProvider implements IConversationHistoryProvider {
  constructor(private db: MyDatabase) {}

  async fetchHistory(options: FetchHistoryOptions): Promise<ConversationThread> {
    const messages = await this.db.query(
      'SELECT * FROM messages WHERE thread_id = ?',
      [options.threadId]
    );

    return {
      messages: messages.map(this.toMessage),
      metadata: { platform: 'database' }
    };
  }

  async saveMessage(message: ConversationMessage, threadId: string): Promise<void> {
    await this.db.insert('messages', {
      thread_id: threadId,
      ...message
    });
  }

  async createThread(threadId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.db.insert('threads', { id: threadId, metadata });
  }

  async listThreads() {
    return await this.db.query('SELECT id, updated_at FROM threads');
  }

  private toMessage(row: any): ConversationMessage {
    return {
      id: row.id,
      userId: row.user_id,
      text: row.text,
      timestamp: row.created_at,
      isAssistant: row.is_assistant,
      metadata: row.metadata
    };
  }
}
```

## Shared SDK/CLI Integration

The SDK provides reusable components that were previously CLI-only. These abstractions enable custom platform integrations while maintaining consistency.

### Message Formatting (Phase 1)

The SDK provides a flexible message formatting system that supports multiple platforms (Slack, Terminal, API, etc.) and allows custom formatters.

#### Platform-Specific Formatters

**Terminal Formatter (Built-in)**

```typescript
import { BaseMessageFormatter, type StructuredMessage } from '@sowonai/crewx-sdk';

const formatter = new BaseMessageFormatter();

// Format messages for terminal display
const history = formatter.formatHistory(messages, {
  includeUserId: true,
  includeTimestamp: true,
  timestampFormat: 'iso', // 'iso' | 'relative' | 'unix'
});

console.log(history);
// Output:
// [2025-10-17T10:00:00Z] user123: Hello!
// [2025-10-17T10:00:05Z] assistant: How can I help?
```

**Slack Formatter (Built-in)**

For Slack bot integrations, use the Slack-specific formatter that handles threading, mentions, and rich formatting:

```typescript
import { SlackMessageFormatter } from '@sowonai/crewx-sdk';

const slackFormatter = new SlackMessageFormatter();

// Format for Slack with rich text support
const formatted = slackFormatter.formatForSlack(messages, {
  includeTimestamp: true,
  useThreading: true,
  preserveMentions: true,
});

// Format agent response with Slack-specific blocks
const response = slackFormatter.formatAgentResponse({
  content: 'Task completed successfully!',
  agentId: 'backend',
  metadata: { status: 'success' }
});

// Send to Slack
await slackClient.chat.postMessage({
  channel: channelId,
  blocks: response.blocks,
  thread_ts: threadId,
});
```

**API/JSON Formatter**

For API responses or structured data:

```typescript
import {
  BaseMessageFormatter,
  type StructuredMessage,
  type ConversationMetadata
} from '@sowonai/crewx-sdk';

class APIFormatter extends BaseMessageFormatter {
  formatForAPI(messages: StructuredMessage[]): {
    messages: Array<{
      id: string;
      author: { id: string; isBot: boolean };
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>;
    meta: ConversationMetadata;
  } {
    return {
      messages: messages.map(msg => ({
        id: msg.id,
        author: {
          id: msg.userId || 'unknown',
          isBot: msg.isAssistant || false,
        },
        content: msg.text,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
      })),
      meta: {
        platform: 'api',
        totalMessages: messages.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

const apiFormatter = new APIFormatter();
const response = apiFormatter.formatForAPI(messages);

// Return as JSON API response
res.json(response);
```

#### Custom Formatter Extension

Create your own formatter for custom platforms:

```typescript
import {
  BaseMessageFormatter,
  StructuredMessage,
  FormatterOptions
} from '@sowonai/crewx-sdk';

class DiscordFormatter extends BaseMessageFormatter {
  formatMessage(msg: StructuredMessage, options: FormatterOptions): string {
    const timestamp = options.includeTimestamp
      ? `<t:${Math.floor(new Date(msg.timestamp).getTime() / 1000)}:R> `
      : '';

    const author = msg.isAssistant ? '🤖 **Bot**' : `👤 **${msg.userId}**`;

    return `${timestamp}${author}: ${msg.text}`;
  }

  formatForDiscordEmbed(
    message: string,
    options: { color?: number; title?: string }
  ) {
    return {
      embeds: [{
        title: options.title || 'Agent Response',
        description: message,
        color: options.color || 0x5865F2,
        timestamp: new Date().toISOString(),
      }],
    };
  }
}

const discordFormatter = new DiscordFormatter();
const embed = discordFormatter.formatForDiscordEmbed(
  'Analysis complete!',
  { title: 'Backend Agent', color: 0x00FF00 }
);

await discordChannel.send(embed);
```

#### Metadata Handling

The formatter system supports rich metadata for enhanced context:

```typescript
import {
  BaseMessageFormatter,
  type StructuredMessage,
  type ConversationMetadata
} from '@sowonai/crewx-sdk';

const messages: StructuredMessage[] = [
  {
    id: 'msg-1',
    userId: 'user123',
    text: 'What is the status?',
    timestamp: new Date().toISOString(),
    isAssistant: false,
    metadata: {
      platform: 'slack',
      channelId: 'C123456',
      threadTs: '1234567890.123456',
      userAgent: 'SlackBot/1.0',
    },
  },
  {
    id: 'msg-2',
    userId: 'backend-agent',
    text: 'All systems operational.',
    timestamp: new Date().toISOString(),
    isAssistant: true,
    metadata: {
      agentId: 'backend',
      model: 'claude-3-5-sonnet',
      processingTime: 1234,
      tokenUsage: { input: 50, output: 100 },
    },
  },
];

const formatter = new BaseMessageFormatter();

// Format with metadata extraction
const formatted = formatter.formatHistory(messages, {
  includeUserId: true,
  includeTimestamp: true,
  extractMetadata: true,
});

// Access metadata
messages.forEach(msg => {
  if (msg.metadata?.tokenUsage) {
    console.log(`Tokens used: ${msg.metadata.tokenUsage.input + msg.metadata.tokenUsage.output}`);
  }
});
```

#### Migration Guide for Existing Formatter Users

If you're migrating from the CLI's internal formatter to the SDK formatter:

**Before (CLI internal)**
```typescript
// This was CLI-only code
import { MessageFormatter } from '../cli/src/utils/message-formatter';

const formatter = new MessageFormatter();
const result = formatter.format(messages);
```

**After (SDK)**
```typescript
// Now use SDK's BaseMessageFormatter
import { BaseMessageFormatter } from '@sowonai/crewx-sdk';

const formatter = new BaseMessageFormatter();
const result = formatter.formatHistory(messages, {
  includeUserId: true,
  includeTimestamp: true,
});
```

**Key Changes:**
1. Import from `@sowonai/crewx-sdk` instead of CLI internals
2. Use `formatHistory()` method instead of `format()`
3. Options are now explicitly passed as second parameter
4. Metadata handling is built-in with `extractMetadata` option

**Slack Migration**
```typescript
// Before (CLI)
import { SlackFormatter } from '../cli/src/slack/formatter';

// After (SDK)
import { SlackMessageFormatter } from '@sowonai/crewx-sdk';

const formatter = new SlackMessageFormatter();
// Same API, now available in SDK
```

#### CLI Developer Guide: Adding Slack Formatting

If you're building a CLI tool and want to add Slack formatting support:

**Step 1: Install SDK**
```bash
npm install @sowonai/crewx-sdk
```

**Step 2: Import Slack Formatter**
```typescript
import { SlackMessageFormatter } from '@sowonai/crewx-sdk';
import { WebClient } from '@slack/web-api';

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const formatter = new SlackMessageFormatter();
```

**Step 3: Format Messages for Slack**
```typescript
async function sendToSlack(
  channelId: string,
  content: string,
  threadTs?: string
) {
  // Format using SDK formatter
  const formatted = formatter.formatAgentResponse({
    content,
    agentId: 'my-cli-agent',
    metadata: {
      source: 'cli',
      timestamp: new Date().toISOString(),
    },
  });

  // Send to Slack
  await slackClient.chat.postMessage({
    channel: channelId,
    text: content, // Fallback text
    blocks: formatted.blocks,
    thread_ts: threadTs,
  });
}
```

**Step 4: Handle Conversation History**
```typescript
import {
  SlackMessageFormatter,
  type StructuredMessage
} from '@sowonai/crewx-sdk';

async function formatSlackThread(threadTs: string) {
  // Fetch Slack thread
  const thread = await slackClient.conversations.replies({
    channel: channelId,
    ts: threadTs,
  });

  // Convert to StructuredMessage format
  const messages: StructuredMessage[] = thread.messages.map(msg => ({
    id: msg.ts,
    userId: msg.user || 'bot',
    text: msg.text || '',
    timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
    isAssistant: !!msg.bot_id,
    metadata: {
      platform: 'slack',
      threadTs: msg.thread_ts,
    },
  }));

  // Format for display or processing
  const formatter = new SlackMessageFormatter();
  const formatted = formatter.formatHistory(messages, {
    includeTimestamp: true,
    useThreading: true,
  });

  return formatted;
}
```

**Step 5: Error Handling**
```typescript
try {
  await sendToSlack(channelId, 'Task completed!', threadTs);
} catch (error) {
  // Format error for Slack
  const errorMessage = formatter.formatAgentResponse({
    content: `❌ Error: ${error.message}`,
    agentId: 'cli-agent',
    metadata: { status: 'error' },
  });

  await slackClient.chat.postMessage({
    channel: channelId,
    blocks: errorMessage.blocks,
  });
}
```

### AI Providers (Phase 2)

Use built-in providers or create custom ones:

```typescript
import {
  BaseAIProvider,
  ClaudeProvider,
  GeminiProvider,
  CopilotProvider,
  CodexProvider,
  type LoggerLike,
  type BaseAIProviderOptions
} from '@sowonai/crewx-sdk';

// Use built-in provider
const claude = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  logger: console,
  enableToolUse: true,
  model: 'claude-3-5-sonnet-20241022',
});

// Custom provider
class MyProvider extends BaseAIProvider {
  constructor(options: BaseAIProviderOptions) {
    super(options);
  }

  async query(prompt: string, options: AIQueryOptions): Promise<AIResponse> {
    // Custom implementation
    return { content: 'Response', metadata: {} };
  }
}
```

### Remote Agent Management (Phase 3)

Manage remote agent communications:

```typescript
import {
  RemoteAgentManager,
  FetchRemoteTransport,
  MockRemoteTransport,
  type RemoteAgentConfig
} from '@sowonai/crewx-sdk';

// Production transport
const transport = new FetchRemoteTransport({
  timeout: 30000,
  headers: { 'Authorization': `Bearer ${token}` },
});

// Testing transport
const mockTransport = new MockRemoteTransport({
  'agent-1': { content: 'Mocked response', success: true },
});

const manager = new RemoteAgentManager({
  transport,
  enableLogging: true,
  logger: console,
});

// Load remote agent
await manager.loadAgent({
  id: 'backend',
  url: 'https://api.example.com/agent',
  apiKey: process.env.REMOTE_API_KEY,
  tools: ['search', 'analyze'],
});

// Query remote agent
const result = await manager.queryAgent('backend', 'Analyze codebase');
console.log(result.content);
```

## Advanced Usage

### Using Internal APIs

Some internal APIs are available for advanced use cases:

```typescript
import { /* internal exports */ } from '@sowonai/crewx-sdk/internal';

// Note: Internal APIs may change between minor versions
// Use at your own risk
```

### Integration with NestJS

The SDK works seamlessly with NestJS:

```typescript
import { Injectable } from '@nestjs/common';
import { DocumentManager } from '@sowonai/crewx-sdk';

@Injectable()
export class MyService {
  constructor(private readonly docManager: DocumentManager) {}

  async loadDocs() {
    await this.docManager.loadDocument('./docs/api.md', 'markdown');
  }
}
```

## Constants

```typescript
import {
  SERVER_NAME,
  PREFIX_TOOL_NAME,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES
} from '@sowonai/crewx-sdk';

console.log(SERVER_NAME); // 'crewx'
console.log(PREFIX_TOOL_NAME); // 'crewx_'
```

## Package Exports

The SDK provides the following export paths:

- `@sowonai/crewx-sdk` - Main public API
- `@sowonai/crewx-sdk/internal` - Internal utilities (use with caution)
- `@sowonai/crewx-sdk/package.json` - Package metadata

## TypeScript

The SDK is written in TypeScript and includes full type definitions. No additional `@types` packages are needed.

```typescript
import type { AIProvider, AgentConfig } from '@sowonai/crewx-sdk';

// Full type safety
const config: AgentConfig = {
  id: 'my-agent',
  provider: 'cli/claude',
  // ... TypeScript will guide you
};
```

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Building

```bash
# Build the package
npm run build

# Output: dist/
```

## Contributing

Contributions to the SDK require signing our [Contributor License Agreement (CLA)](../../docs/CLA.md).

Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `npm test` and `npm run build`
6. Submit a pull request

## License

Apache-2.0 License - See [LICENSE](./LICENSE) for details.

## Context Integration

The SDK provides `TemplateContext` and `AgentMetadata` exports for dynamic template processing:

```typescript
import { TemplateContext, AgentMetadata } from '@sowonai/crewx-sdk';

// Use TemplateContext for dynamic prompts
const context: TemplateContext = {
  env: process.env,
  agent: {
    id: 'claude',
    name: 'Claude Assistant',
    provider: 'cli/claude',
    model: 'claude-3-5-sonnet'
  },
  agentMetadata: {
    specialties: ['code-analysis', 'architecture'],
    capabilities: ['file-operations', 'web-search'],
    description: 'Advanced reasoning and analysis specialist'
  },
  mode: 'query',
  platform: 'cli'
};
```

For detailed usage, see [Template Variables Guide](../../docs/template-variables.md).

## Support

- [GitHub Issues](https://github.com/sowonlabs/crewx/issues)
- [Documentation](../../docs/)
- [Main README](../../README.md)

## Related Packages

- [`crewx`](../cli/README.md) - Full-featured CLI tool built on this SDK

---

Built by [SowonLabs](https://github.com/sowonlabs)
