# CrewX SDK Package

**📍 You are here:** `packages/sdk/`
**⬆️ Parent:** [Project Root](../../CREWX.md)

---

## Overview

`@sowonai/crewx-sdk` is the core SDK for building AI agent systems.

**Core Features:**
- Configuration management (Timeout, Conversation)
- Conversation system (History Provider, Message Formatting)
- Knowledge base (Document Manager)
- Agent utilities (MentionParser, Agent Factory)
- Type system (AIProvider, AgentConfig, etc.)
- Remote agent management

**Highlights:**
- Framework-agnostic
- NestJS compatible
- Full TypeScript support
- Apache-2.0 License

---

## Directory Structure

```
packages/sdk/
├── src/                    # Source code
│   ├── config/             # Configuration utilities
│   ├── constants/          # Shared constants
│   ├── conversation/       # Conversation abstractions
│   ├── core/               # Core utilities
│   ├── knowledge/          # Knowledge management
│   ├── types/              # TypeScript types
│   ├── utils/              # Utilities
│   └── index.ts            # Public exports
├── tests/                  # Tests
└── README.md               # User documentation
```

---

## Key Exports

**Configuration:**
- `getTimeoutConfig()`, `getConversationConfig()`

**Conversation:**
- `IConversationHistoryProvider`
- `BaseMessageFormatter`, `SlackMessageFormatter`

**Knowledge:**
- `DocumentManager`

**Agent:**
- `createCrewxAgent()`
- `MentionParser`

**Types:**
- `AIProvider`, `AgentConfig`, `ExecutionMode`

---

## Usage Example

```typescript
import { createCrewxAgent } from '@sowonai/crewx-sdk';

const { agent } = await createCrewxAgent({
  provider: { namespace: 'cli', id: 'claude' },
});

const result = await agent.query({
  prompt: 'Analyze this code',
});
```

---

## Learn More

- 🔗 [../../CREWX.md](../../CREWX.md) - Project root
- 🔗 [../cli/CREWX.md](../cli/CREWX.md) - CLI package

---

**Last Updated:** 2025-10-18
