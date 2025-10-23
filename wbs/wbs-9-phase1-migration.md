# WBS-9 Phase 1: Message Formatter Abstraction - Migration Guide

## Overview

WBS-9 Phase 1 introduces a new message formatting abstraction layer to the CrewX SDK, enabling consistent message formatting across CLI and platform-specific implementations (like Slack).

## What's New

### SDK Package

#### 1. BaseMessageFormatter Class
Location: `packages/sdk/src/utils/base-message-formatter.ts`

A new abstract base class that provides common message formatting functionality:

```typescript
import { BaseMessageFormatter, StructuredMessage, FormatterOptions } from '@sowonai/crewx-sdk';

// Create a custom formatter
class MyFormatter extends BaseMessageFormatter {
  // Override methods as needed
  override formatMessage(msg: StructuredMessage, options?: FormatterOptions): string {
    // Custom formatting logic
    return super.formatMessage(msg, options);
  }
}
```

#### 2. Key Interfaces

**StructuredMessage**:
```typescript
interface StructuredMessage {
  id?: string;
  userId?: string;
  text: string;
  timestamp?: Date | string;
  isAssistant: boolean;
  metadata?: Record<string, any>;
}
```

**FormatterOptions**:
```typescript
interface FormatterOptions {
  platform?: 'cli' | 'slack' | string;
  includeUserId?: boolean;
  includeTimestamp?: boolean;
  maxLength?: number;
  userPrefix?: string;
  assistantPrefix?: string;
}
```

#### 3. Core Methods

- `formatHistory(messages, options)` - Format array of messages into string
- `formatMessage(msg, options)` - Format single message
- `buildContext(payload, options)` - Build context from structured payload
- `convertToStructured(message)` - Convert ConversationMessage to StructuredMessage
- `convertToStructuredArray(messages)` - Batch conversion

### CLI Package

#### Refactored Slack Formatter

The Slack message formatter now extends `BaseMessageFormatter`:

```typescript
import { BaseMessageFormatter } from '@sowonai/crewx-sdk';

export class SlackMessageFormatter extends BaseMessageFormatter {
  // Inherits all base methods
  // Overrides formatMessage for Slack-specific formatting
  override formatMessage(msg, options) {
    // Slack-specific emoji, mrkdwn conversion, etc.
  }
}
```

## Migration Steps

### For SDK Consumers

If you're using the SDK to build custom message formatters:

**Before (No abstraction):**
```typescript
// Had to implement everything from scratch
function formatMessages(messages: any[]): string {
  return messages.map(msg => {
    const prefix = msg.isAssistant ? 'Bot' : 'User';
    return `${prefix}: ${msg.text}`;
  }).join('\n');
}
```

**After (Use BaseMessageFormatter):**
```typescript
import { BaseMessageFormatter, DefaultMessageFormatter } from '@sowonai/crewx-sdk';

// Option 1: Use default formatter
const formatter = new DefaultMessageFormatter();
const formatted = formatter.formatHistory(messages);

// Option 2: Extend for custom behavior
class MyFormatter extends BaseMessageFormatter {
  override formatMessage(msg, options) {
    // Add custom logic
    return super.formatMessage(msg, options);
  }
}
```

### For CLI Developers

If you're extending the Slack formatter:

**Before:**
```typescript
import { SlackMessageFormatter } from '@sowonai/crewx-cli';

const formatter = new SlackMessageFormatter();
// Limited to Slack block formatting only
```

**After:**
```typescript
import { SlackMessageFormatter } from '@sowonai/crewx-cli';

const formatter = new SlackMessageFormatter();

// Now also has access to base methods:
formatter.formatHistory(messages, { platform: 'slack' });
formatter.buildContext(payload);
formatter.convertToStructuredArray(convMessages);
```

## Benefits

1. **Consistency**: Same formatting logic across platforms
2. **Reusability**: Common methods in one place
3. **Extensibility**: Easy to create platform-specific formatters
4. **Type Safety**: Full TypeScript support with strict typing
5. **Testing**: Comprehensive test coverage for all scenarios

## API Reference

### BaseMessageFormatter

#### formatHistory(messages, options?)
Formats an array of messages into a string representation.

**Parameters:**
- `messages: StructuredMessage[]` - Array of messages to format
- `options?: FormatterOptions` - Optional formatting options

**Returns:** `string` - Formatted message history

**Example:**
```typescript
const messages = [
  { text: 'Hello', isAssistant: false, userId: 'user1' },
  { text: 'Hi there!', isAssistant: true, userId: 'bot' }
];

const formatted = formatter.formatHistory(messages, {
  includeUserId: true,
  includeTimestamp: false
});
```

#### formatMessage(msg, options?)
Formats a single message.

**Parameters:**
- `msg: StructuredMessage` - Message to format
- `options?: FormatterOptions` - Optional formatting options

**Returns:** `string` - Formatted message

#### buildContext(payload, options?)
Builds a context string from a structured payload.

**Parameters:**
- `payload: any` - Structured payload object (with prompt, context, messages, metadata)
- `options?: FormatterOptions` - Optional formatting options

**Returns:** `string` - Built context string

**Example:**
```typescript
const payload = {
  prompt: 'Analyze code',
  context: 'Working dir: /project',
  messages: [...],
  metadata: { platform: 'cli' }
};

const context = formatter.buildContext(payload);
```

#### convertToStructured(message)
Converts a ConversationMessage to StructuredMessage.

**Parameters:**
- `message: ConversationMessage` - Conversation message from history provider

**Returns:** `StructuredMessage`

#### convertToStructuredArray(messages)
Batch converts ConversationMessages to StructuredMessages.

**Parameters:**
- `messages: ConversationMessage[]` - Array of conversation messages

**Returns:** `StructuredMessage[]`

### DefaultMessageFormatter

A concrete implementation of `BaseMessageFormatter` with no custom overrides.

**Usage:**
```typescript
import { DefaultMessageFormatter } from '@sowonai/crewx-sdk';

const formatter = new DefaultMessageFormatter();
const formatted = formatter.formatHistory(messages);
```

## Testing

### SDK Tests
Location: `packages/sdk/tests/unit/utils/base-message-formatter.test.ts`

Covers:
- Basic message array formatting
- Empty/null handling
- Option respect (userId, timestamp, prefixes)
- Edge cases (long messages, special characters, invalid timestamps)
- Slack scenarios (emoji, metadata, threads)
- CLI scenarios (timestamps, context building)
- Conversion methods

### CLI Tests
Location: `packages/cli/tests/unit/slack/message-formatter.test.ts`

Covers:
- Inheritance verification
- Slack-specific formatMessage override
- Execution result formatting
- Block formatting
- Emoji conversion
- Markdown conversion
- Edge cases (long lines, empty responses, env vars)

## Backward Compatibility

All existing CLI code continues to work without changes. The refactoring is internal and maintains the same public API for Slack formatting.

### Existing Code (Still Works)
```typescript
const formatter = new SlackMessageFormatter();
const blocks = formatter.formatExecutionResult(result);
// Works exactly as before
```

### New Capabilities (Now Available)
```typescript
const formatter = new SlackMessageFormatter();

// NEW: Use base methods for history formatting
const history = formatter.formatHistory(messages);

// NEW: Convert conversation messages
const structured = formatter.convertToStructuredArray(convMessages);

// Existing Slack-specific methods still work
const blocks = formatter.formatExecutionResult(result);
```

## Examples

### Example 1: Custom Formatter for Discord

```typescript
import { BaseMessageFormatter, StructuredMessage, FormatterOptions } from '@sowonai/crewx-sdk';

class DiscordMessageFormatter extends BaseMessageFormatter {
  override formatMessage(msg: StructuredMessage, options?: FormatterOptions): string {
    const opts = this.getDefaultOptions({
      platform: 'discord',
      userPrefix: '<:user:12345>',
      assistantPrefix: '<:bot:67890>',
      ...options,
    });

    // Discord-specific formatting
    const prefix = msg.isAssistant ? opts.assistantPrefix! : opts.userPrefix!;
    const text = this.sanitizeText(msg.text, opts.maxLength);

    return `${prefix} **${msg.userId}**: ${text}`;
  }
}

const formatter = new DiscordMessageFormatter();
```

### Example 2: Minimal CLI Formatter

```typescript
import { DefaultMessageFormatter } from '@sowonai/crewx-sdk';

const formatter = new DefaultMessageFormatter();

const messages = [
  { text: 'Query: Analyze logs', isAssistant: false, userId: 'dev' },
  { text: 'Found 3 errors...', isAssistant: true, userId: 'crewx' },
];

const formatted = formatter.formatHistory(messages, {
  includeTimestamp: true,
  includeUserId: true,
});

console.log(formatted);
// Output:
// 👤 User (dev) [2025-10-17T...]:
// Query: Analyze logs
//
// 🤖 Assistant (crewx) [2025-10-17T...]:
// Found 3 errors...
```

### Example 3: Context Building for AI Prompts

```typescript
import { DefaultMessageFormatter } from '@sowonai/crewx-sdk';

const formatter = new DefaultMessageFormatter();

const payload = {
  version: '1.0',
  agent: { id: 'backend', provider: 'claude', mode: 'query' },
  prompt: 'Review authentication code',
  context: 'Project: /app/backend',
  messages: [
    { text: 'Previous analysis', isAssistant: true },
  ],
  metadata: { platform: 'cli', threadId: 'thread-123' },
};

const context = formatter.buildContext(payload);
// Returns formatted context string ready for AI consumption
```

## Troubleshooting

### Issue: "Cannot find module '@sowonai/crewx-sdk'"

**Solution**: Make sure you've built the SDK package:
```bash
npm run build --workspace @sowonai/crewx-sdk
```

### Issue: Messages not formatting correctly

**Solution**: Check your StructuredMessage format:
```typescript
// Correct format
const message: StructuredMessage = {
  text: 'Message content',  // Required
  isAssistant: false,        // Required
  userId: 'user123',         // Optional
  timestamp: new Date(),     // Optional
  metadata: {}               // Optional
};
```

### Issue: Need platform-specific formatting

**Solution**: Override `formatMessage` in your custom formatter:
```typescript
class MyFormatter extends BaseMessageFormatter {
  override formatMessage(msg: StructuredMessage, options?: FormatterOptions): string {
    // Your platform-specific logic here
    const baseFormatted = super.formatMessage(msg, options);
    return this.applyMyPlatformFormatting(baseFormatted);
  }
}
```

## Next Steps

- **Phase 2**: AI Provider abstraction and built-in provider migration
- **Phase 3**: Remote Agent Manager extraction
- **Phase 4**: Parallel execution runner
- **Phase 5**: MCP utility consolidation

## Support

For issues or questions about WBS-9 Phase 1:
1. Check test files for usage examples
2. Review `requirements-monorepo.md` §MessageFormatter section
3. See SDK README for full API documentation
