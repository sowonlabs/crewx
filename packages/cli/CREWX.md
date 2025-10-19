# CrewX CLI Package

**📍 You are here:** `packages/cli/`
**⬆️ Parent:** [Project Root](../../CREWX.md)

---

## Overview

`@sowonai/crewx-cli` is the main CLI application for CrewX.

**Core Features:**
- CLI commands (query, execute, chat, agent, doctor, init, mcp)
- Slack Bot integration
- MCP server (VS Code, Claude Desktop, Cursor, etc.)
- Multi-provider AI orchestration
- Plugin system

**Tech Stack:**
- NestJS (Dependency Injection, Modular Architecture)
- TypeScript
- Vitest (Testing)

---

## Directory Structure

```
packages/cli/
├── src/                    # Source code
│   ├── cli/                # CLI command handlers
│   ├── providers/          # AI provider implementations
│   ├── services/           # Core services
│   ├── conversation/       # Conversation history
│   ├── slack/              # Slack integration
│   ├── utils/              # Utilities
│   ├── main.ts             # Entry point
│   └── ai.service.ts       # AI orchestration
├── tests/                  # Tests
├── scripts/                # Build scripts
└── README.md               # User documentation
```

---

## Key Components

| File | Description | LOC |
|------|-------------|-----|
| `crewx.tool.ts` | MCP server implementation with TemplateContext integration | 1,399 |
| `services/tool-call.service.ts` | Tool execution engine | 970 |
| `ai.service.ts` | AI orchestration | 715 |
| `providers/base-ai.provider.ts` | Provider base class | 716 |
| `cli/chat.handler.ts` | Interactive chat mode | 575 |
| `slack/slack-bot.ts` | Slack bot | 566 |

### TemplateContext Integration (WBS-14)

The CLI leverages SDK's `TemplateContext` for dynamic prompt generation with unified context structure:

**Key Features:**
- **Cross-platform context** - Unified context structure for CLI, Slack, and MCP
- **Agent metadata support** - `agentMetadata` field provides capabilities and specialties
- **Environment variables** - Automatic `env` variable injection in templates
- **Conversation history** - Message threading support across platforms
- **Tool context** - Dynamic tool listing and JSON schema generation
- **Layout rendering** - SDK LayoutLoader → LayoutRenderer pipeline integration

**Implementation Flow:**
1. **Context Building** (`crewx.tool.ts:37-65`):
   - Extract agent configuration (id, name, provider, model)
   - Load `agentMetadata` from agent configuration
   - Build tools context with schemas and counts
   - Include environment variables and custom variables

2. **Template Processing** (`processDocumentTemplate()`):
   - SDK `LayoutLoader` → `LayoutRenderer` pipeline
   - TemplateContext injection for dynamic variables
   - Security key validation for prompt injection protection
   - Handlebars rendering with context data

3. **Layout Integration**:
   - Dynamic layout loading from `templates/agents/` directory
   - Props validation using SDK `PropsValidator`
   - Fallback chain: layout → system_prompt → description

4. **Feature Flag Support**:
   - `CREWX_APPEND_LEGACY` environment variable
   - Backward compatibility for legacy templates
   - Gradual migration path for existing configurations

**Data Flow Diagram:**
```
AgentConfig → TemplateContext → LayoutLoader → LayoutRenderer → processDocumentTemplate → Final Prompt
                                     ↓                              ↑
                               PropsValidator                DocumentLoaderService
```

---

## Context Integration (WBS-14)

- **Context Integration Standard**: `packages/docs/context-integration-standard.md` - Complete architectural reference
- **Migration Guide**: `packages/docs/context-integration-migration.md` - Upgrade steps for custom agents
- **Layout DSL Reference**: `packages/docs/layout-dsl-field-reference.md` - Field matrix and helper catalogue
- **Template Variables**: `../../docs/template-variables.md` - Dynamic variables usage guide

## Learn More

- 🔗 [../../CREWX.md](../../CREWX.md) - Project root
- 🔗 [../sdk/CREWX.md](../sdk/CREWX.md) - SDK package
- 🔗 [../../docs/template-variables.md](../../docs/template-variables.md) - Template context usage guide

---

**Last Updated:** 2025-10-20 (WBS-14 Phase 5 Completed)
