# CrewX SDK Package

**📍 You are here:** `packages/sdk/`
**⬆️ Parent:** [Project Root](../../CREWX.md)

---

## Overview

`@sowonai/crewx-sdk` is the core SDK for building AI agent systems.

**Core Features:**
- Layout & template pipeline (LayoutLoader, LayoutRenderer, PropsValidator)
- TemplateContext & AgentMetadata exports for cross-surface prompts (WBS-14)
- Skill runtime + progressive disclosure loader (WBS-17 Phase 1)
- Configuration & schema management (Timeout, Conversation, provider/skills schema)
- Conversation system (History Provider, Message Formatting)
- Knowledge base (Document Manager)
- Agent utilities (MentionParser, Agent Factory)
- Remote agent management & provider interfaces

**Highlights:**
- Framework-agnostic
- NestJS compatible
- Full TypeScript support
- Apache-2.0 License

---

## Directory Structure

```
packages/sdk/
├── src/
│   ├── config/                 # Timeout & configuration helpers
│   ├── constants/              # Shared constants (re-exported via constants.ts)
│   ├── conversation/           # Conversation history providers & formatters
│   ├── core/                   # Core utilities (error helpers, filesystem abstractions)
│   ├── knowledge/              # Document management utilities
│   ├── schema/                 # crewx.yaml / skills schema + parser (WBS-16)
│   ├── services/               # Layout services (loader, renderer, props validator)
│   ├── skills/                 # Skill runtime, progressive loader, adapters (WBS-17)
│   ├── types/                  # TypeScript definitions (TemplateContext, AgentMetadata, providers)
│   ├── utils/                  # Shared utilities (MentionParser, timers, validation)
│   ├── internal/               # Internal helpers not exported publicly
│   ├── index.ts                # Public exports
│   └── index.d.ts              # Type declarations
├── tests/                      # Unit tests
└── README.md                   # User documentation
```

---

## Architecture Snapshot

- Mermaid diagram: [docs/diagrams/sdk-layered-architecture.mmd](docs/diagrams/sdk-layered-architecture.mmd)
- Provides an overview of public API, runtime, provider, remote execution, parallel, layout, and shared utility layers.

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
- CLI template processor, document loader, and future SDK helpers consume these
  types directly; downstream surfaces no longer re-export local copies.

**Layout System (WBS-12-13):**
- `LayoutLoader` - Load and validate layout templates
- `LayoutRenderer` - Render layouts with context data
- `PropsValidator` - Validate layout props against schemas

**Skill Runtime (WBS-17 Phase 1):**
- `ISkillRuntime` + `SkillRuntime` implementation (`skills/runtime/skill-runtime.service.ts`) for load → validate → prepare → execute → cleanup lifecycle
- `ProgressiveSkillLoader` - Metadata-first loader with cache + dependency resolution
- `SystemRuntimeValidator`, `MockRuntimeValidator` - Runtime requirement validation helpers
- `ClaudeSkillAdapter` - Maps Claude Code skills directory into CrewX skill bundle format

**Schema & Parser (WBS-16):**
- `parseCrewxConfig`, `parseCrewxConfigFromFile` - Progressive parser for crewx.yaml (skills/layouts/documents)
- `parseSkillManifest`, `parseSkillManifestFromFile` - Claude skills.md parser with validation
- `clearSkillCache` - Reset progressive disclosure caches (useful for tests)

**Types:**
- `AIProvider`, `AgentConfig`, `ExecutionMode`
- `TemplateContext`, `AgentMetadata` — see `packages/docs/context-integration-standard.md` for usage guidance
- `LayoutDefinition`, `RenderOptions` — see `packages/docs/layout-dsl-field-reference.md` for layout DSL guide
- `SkillRuntimeStage`, `SkillExecutionContext`, `SkillMetadata`, `SkillsConfig` — underpin WBS-16/17 flows

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

## Skill Runtime Overview (WBS-17 Phase 1)

- `SkillRuntime` combines progressive metadata loading with execution lifecycle orchestration.
- `ProgressiveSkillLoader` surfaces metadata first, loading full markdown content on-demand.
- `SystemRuntimeValidator` enforces runtime requirements (Python/Node/Docker/Memory) before execution.
- `ClaudeSkillAdapter` converts Claude Code `skills/` directories into CrewX-friendly bundles.
- Emits events (`skill:loaded`, `skill:executed`, `skill:error`) so host apps (CLI, MCP) can stream telemetry.

👉 Detailed design: [wbs/wbs-17-phase-1-skill-runtime-design.md](../../wbs/wbs-17-phase-1-skill-runtime-design.md)

## Schema & Config Integration (WBS-16)

- `parseCrewxConfig` & `parseCrewxConfigFromFile` read crewx.yaml with progressive disclosure and validation.
- `parseSkillManifest` & `parseSkillManifestFromFile` parse Claude `skills.md` documents into `SkillDefinition` objects.
- Strict vs lenient validation modes surface actionable diagnostics via `SkillValidationError`.
- Schema types (`SkillsConfig`, `CrewxProjectConfig`, `AgentDefinition`) align CLI/SDK configuration models.
- `clearSkillCache` resets caches for tests or hot reload scenarios.

📄 Reference docs: [wbs/wbs-16-phase-1-schema-design.md](../../wbs/wbs-16-phase-1-schema-design.md), [wbs/wbs-16-field-mapping.md](../../wbs/wbs-16-field-mapping.md)

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
- 🔗 [../../wbs/wbs-16-phase-1-schema-design.md](../../wbs/wbs-16-phase-1-schema-design.md) - Config & schema design notes
- 🔗 [../../wbs/wbs-17-phase-1-skill-runtime-design.md](../../wbs/wbs-17-phase-1-skill-runtime-design.md) - Skill runtime design

---

**Last Updated:** 2025-10-21
