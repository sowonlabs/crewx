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

**Template System (WBS-14 Phase 3):**
- `TemplateContext` - Cross-platform template context interface
- `AgentMetadata` - Agent capabilities and specialties metadata

**Layout System (WBS-12-13):**
- `LayoutLoader` - Load and validate layout templates
- `LayoutRenderer` - Render layouts with context data
- `PropsValidator` - Validate layout props against schemas

**Types:**
- `AIProvider`, `AgentConfig`, `ExecutionMode`
- `TemplateContext`, `AgentMetadata` — see `packages/docs/context-integration-standard.md` for usage guidance
- `LayoutDefinition`, `RenderOptions` — see `packages/docs/layout-dsl-field-reference.md` for layout DSL guide

---

## Context Integration (WBS-14)

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

### Layout System Integration

The SDK also provides layout rendering capabilities:

```typescript
import { LayoutLoader, LayoutRenderer, PropsValidator } from '@sowonai/crewx-sdk';

// Load and render layouts with dynamic context
const loader = new LayoutLoader();
const layout = await loader.load('crewx/default', { theme: 'dark' });

const renderer = new LayoutRenderer();
const rendered = await renderer.render(layout, {
  agent,
  agentMetadata,
  tools,
  env: process.env
});
```

For detailed usage:
- **Context Integration**: See [Context Integration Standard](../docs/context-integration-standard.md)
- **Migration Guide**: See [Context Migration Guide](../docs/context-integration-migration.md)
- **Layout DSL**: See [Layout DSL Reference](../docs/layout-dsl-field-reference.md)
- **Template Variables**: See [Template Variables Guide](../../docs/template-variables.md)

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
- 🔗 [../../docs/template-variables.md](../../docs/template-variables.md) - Template context usage guide

---

**Last Updated:** 2025-10-20
