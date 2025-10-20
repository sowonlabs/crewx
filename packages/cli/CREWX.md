# CrewX CLI Package

**📍 You are here:** `packages/cli/`
**⬆️ Parent:** [Project Root](../../CREWX.md)

---

## Overview

`@sowonai/crewx-cli` is the NestJS-based CLI and MCP surface for CrewX. It now
runs on the layout + TemplateContext pipeline delivered in WBS-13 ~ WBS-15 and
shares configuration schemas with the SDK (WBS-16).

**Core Features:**
- Layout-driven prompt orchestration with secure `<user_query>` wrappers (WBS-13~15)
- TemplateContext + AgentMetadata integration across CLI, Slack, and MCP (WBS-14)
- CLI commands (query, execute, chat, agent, doctor, init, templates, mcp)
- Dynamic provider loading (plugin/remote) validated via JSON Schema (WBS-16)
- Slack bot + MCP server surfaces with shared conversation history

**Tech Stack:**
- NestJS (Dependency Injection, Modular Architecture)
- TypeScript
- Vitest (Testing)

---

## Directory Structure

```
packages/cli/
├── src/
│   ├── cli/                # Command handlers (query/execute/chat/init/doctor/templates/mcp)
│   ├── services/           # Tool pipeline, config, TemplateContext, remote agents
│   ├── providers/          # Dynamic provider factory + logger adapter
│   ├── conversation/       # CLI/Slack conversation history providers
│   ├── slack/              # Slack bot + formatters
│   ├── utils/              # Template helpers, stdin/config/security utilities
│   ├── config/             # Static configuration (timeout)
│   ├── guards/             # CLI guard middleware
│   ├── ai.service.ts       # AI orchestration entrypoint
│   ├── ai-provider.service.ts # Provider registry bridging SDK + CLI
│   ├── crewx.tool.ts       # MCP tool server
│   ├── mcp.controller.ts   # MCP HTTP interface
│   ├── project.service.ts  # Workspace metadata
│   ├── app.module.ts       # NestJS module
│   ├── main.ts             # Application bootstrap
│   ├── cli-options.ts      # CLI option definitions
│   ├── health.controller.ts # Readiness endpoint
│   ├── stderr.logger.ts    # STDERR logger wiring
│   └── version.ts          # Published CLI version constant
├── tests/                  # Vitest suites
├── scripts/                # Build & release scripts
└── README.md               # User-facing documentation
```

---

## Key Components

| File | Description | LOC |
|------|-------------|-----|
| `src/crewx.tool.ts` | MCP server implementation with layout/TemplateContext bridge | 1,838 |
| `src/services/tool-call.service.ts` | Layout-aware tool execution pipeline | 1,187 |
| `src/services/agent-loader.service.ts` | Agent resolution, layout selection, capability gates | 671 |
| `src/slack/slack-bot.ts` | Slack orchestrator with TemplateContext bridge | 599 |
| `src/cli/chat.handler.ts` | Interactive chat entrypoint | 586 |
| `src/services/config-validator.service.ts` | JSON Schema validation + config diagnostics | 580 |
| `src/cli/init.handler.ts` | Project bootstrap + layout/template scaffolding | 491 |

---

## Layout & Template Pipeline (WBS-13 ~ WBS-15)

- CLI defers prompt assembly to SDK `LayoutLoader`/`LayoutRenderer`, then applies
  CLI substitutions (document highlights, command previews).
- `ContextEnhancementService` populates `TemplateContext`/`AgentMetadata` before
  rendering to remove hard-coded prompt fragments.
- Secure `<user_query>` handling uses layout props plus `templates/agents/secure-wrapper.yaml`.
- Fallback order: layout → `inline.system_prompt` → legacy `systemPrompt`/`description`.
- Feature flag `CREWX_APPEND_LEGACY` keeps legacy appends available during rollout.

## Configuration & Provider Schema (WBS-16)

- `ConfigService` merges `crewx.yaml` + `crewX.layout.yaml`, exposing dynamic
  provider definitions and skills schema data.
- `ConfigValidatorService` runs AJV-based JSON Schema validation with actionable
  diagnostics used by `crewx doctor`.
- `DynamicProviderFactory` registers `plugin/*` and `remote/*` providers with
  strict environment variable validation.

## Skill Runtime Bridge (WBS-17 Phase 1)

- CLI consumes SDK `SkillRuntime` metadata for future MCP integrations.
- `AgentLoaderService` stashes skill metadata in `TemplateContext` for downstream
  surfaces (CLI, Slack) even before execution wiring lands.

---

## Learn More

- 🔗 [../../CREWX.md](../../CREWX.md) - Project root
- 🔗 [src/CREWX.md](src/CREWX.md) - Source architecture
- 🔗 [../sdk/CREWX.md](../sdk/CREWX.md) - SDK package
- 🔗 [../../wbs/wbs-14-phase-1-append-metrics.md](../../wbs/wbs-14-phase-1-append-metrics.md) - Append safety metrics

---

**Last Updated:** 2025-10-20
