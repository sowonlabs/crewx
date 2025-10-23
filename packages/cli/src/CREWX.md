# Source Code Structure

> Core implementation of CrewX multi-agent AI system

[← Back to Project Root](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making significant changes to the source code structure:
> 1. Update the directory structure section below
> 2. Update relevant subdirectory CREWX.md files (cli/, providers/, services/, etc.)
> 3. Keep Key Components table in sync with actual LOC changes
> 4. Update Architecture Layers if responsibilities change

---

## 🗂️ Directory Structure

```
src/
├── cli/                          # Command handlers (chat, query, execute, init, doctor, templates, help, mcp)
│   └── *.handler.ts              # Each handler owns its CLI subcommand orchestration
│
├── services/                     # Business services & integrations
│   ├── tool-call.service.ts      # Tool execution pipeline (layout-driven prompts + tool wiring)
│   ├── agent-loader.service.ts   # Agent resolution + layout/template selection
│   ├── config.service.ts         # crewx.yaml loading + dynamic provider config exposure
│   ├── config-validator.service.ts # JSON Schema/YAML validation (WBS-16)
│   ├── context-enhancement.service.ts # TemplateContext assembly & enrichment
│   ├── template.service.ts       # Remote/local template fetcher with version gating
│   ├── parallel-processing.service.ts # Concurrent agent execution coordinator
│   ├── intelligent-compression.service.ts # Conversation compression & summarization
│   ├── document-loader.service.ts # Repository content loaders
│   ├── remote-agent.service.ts   # Remote MCP agent lifecycle
│   ├── task-management.service.ts # Todo tracking & reporting
│   ├── result-formatter.service.ts # Output formatting for CLI/Slack surfaces
│   ├── help.service.ts           # Help content provider
│   └── mcp-client.service.ts     # Model Context Protocol client utilities
│
├── conversation/                 # Conversation history providers (CLI, Slack)
├── slack/                        # Slack bot + message formatters
├── providers/                    # Provider factory + logger adapter (built-ins come from SDK)
├── utils/                        # Shared helpers (template-processor, config-utils, stdin-utils, simple-security, terminal-message-formatter)
├── config/                       # Static configuration (timeout.config.ts)
├── guards/                       # CLI guard middleware
├── ai-provider.service.ts        # Provider registry using SDK providers & dynamic factory
├── ai.service.ts                 # Thin facade over AIProviderService + layout pipeline entry
├── crewx.tool.ts                 # MCP tool server (1,838 LOC) ⚠️
├── mcp.controller.ts             # MCP HTTP interface
├── project.service.ts            # Workspace context + repo metadata
├── app.module.ts                 # NestJS module assembly
├── main.ts                       # Application entrypoint
├── cli-options.ts                # CLI option definitions
├── health.controller.ts          # Readiness health checks
├── stderr.logger.ts              # STDERR logger wiring
└── version.ts                    # Published CLI version constant
```

---

## 🏗️ Architecture Layers (Detailed)

### 1. **Entry Points**
- **`main.ts`** - Application bootstrap, CLI argument parsing
- **`app.module.ts`** - NestJS dependency injection container

### 2. **Interface Layer**
Handles external interactions:

- **CLI** (`cli/`) - Command-line interface
  - Query mode (read-only)
  - Execute mode (file modifications)
  - Chat mode (interactive)
  - Init/Doctor utilities

- **MCP** (`mcp.controller.ts`, `crewx.tool.ts`) - Model Context Protocol server
  - IDE integration (VS Code, Claude Desktop, Cursor)
  - Tool definitions for AI assistants

- **Slack** (`slack/`) - Slack bot integration
  - Thread-based conversations with **CrewX branding alignment**
  - Multi-agent collaboration
  - Cross-platform conversation continuity with remote agents

### 3. **Core Services**
The heart of the application:

- **AI Services** (`ai.service.ts`, `ai-provider.service.ts`)
  - Bridges CLI flows into SDK providers (Claude/Gemini/Copilot/Codex) with shared tool-call adapter
  - Manages provider availability checks, health, and capability negotiation
  - Routes execution/query modes while preserving TemplateContext metadata

- **Provider System** (`providers/`)
  - Dynamic provider factory for `plugin/*` and `remote/*` YAML definitions with strict env-var validation (WBS-16)
  - Logger adapters feed SDK provider telemetry back into Nest logger
  - Built-in providers now live in the SDK; CLI wires tool-call + version enforcement (`version.ts`)

- **Tool System** (`services/tool-call.service.ts`)
  - Layout-driven prompt construction and secure `<user_query>` wrapping (WBS-13~15)
  - Tool invocation pipeline with streaming + cancellation support
  - Post-execution formatting and telemetry hooks for TemplateContext append metrics

- **Conversation System** (`conversation/`)
  - Thread persistence for CLI/Slack with agent metadata carry-over
  - Context hydration for layout rendering and compression fallbacks

### 4. **Support Services**
Enable core functionality:

- **Configuration & Schema** (`services/config*.ts`)
  - crewx.yaml / crewx.layout.yaml loading
  - JSON Schema validation (WBS-16) and dynamic provider surfacing
  - Legacy feature flags (`CREWX_APPEND_LEGACY`) to control fallback behavior

- **Task & Result Management** (`services/task-management.service.ts`, `services/result-formatter.service.ts`)
  - Todo tracking and status rollups
  - Output formatting per surface (CLI, Slack, MCP)

- **Parallel Execution** (`services/parallel-processing.service.ts`, `services/intelligent-compression.service.ts`)
  - Concurrent agent scheduling
  - Conversation summarisation + history window control

- **Template Infrastructure** (`services/template.service.ts`, `services/context-enhancement.service.ts`)
  - Local/CDN template resolution with version gating and caching
  - TemplateContext enrichment (agent metadata, security vars, layout props)

### 5. **Utilities**
Cross-cutting helpers:

- **Template Utilities** (`utils/template-processor.ts`, `utils/terminal-message-formatter.ts`)
- **Configuration Helpers** (`utils/config-utils.ts`, `utils/stdin-utils.ts`)
- **Security** (`utils/simple-security.ts`)
- **MCP Tooling** (`utils/mcp-installer.ts`)

---

## 🧱 Template & Layout Pipeline (WBS-13 ~ WBS-15)

- **Two-stage rendering**: CLI defers agent prompt assembly to the SDK `LayoutLoader`/`LayoutRenderer`, then applies CLI-specific substitutions (document highlights, command previews).
- **TemplateContext standardisation**: `ContextEnhancementService` populates `TemplateContext` + `agentMetadata` before layout rendering, eliminating hard-coded prompt fragments.
- **Secure `<user_query>` handling**: Layout props now carry both escaped and raw user input; security wrappers live in `templates/agents/secure-wrapper.yaml`.
- **Fallback order**: Layout → `inline.system_prompt` → legacy `systemPrompt`/`description`, with feature flag `CREWX_APPEND_LEGACY` controlling append behaviour.
- **Metrics & telemetry**: Append usage recorded for safety dashboards (see `wbs/wbs-14-phase-1-append-metrics.md`).

---

## 🔑 Key Components

| Component | File | LOC | Description |
|-----------|------|-----|-------------|
| **MCP Tool** | `crewx.tool.ts` | 1,838 | MCP tool implementation (⚠️ large) |
| **Tool Executor** | `services/tool-call.service.ts` | 1,187 | Layout-aware tool execution pipeline (⚠️ large) |
| **Agent Loader** | `services/agent-loader.service.ts` | 671 | Agent resolution, layout selection, capability gates |
| **Slack Bot** | `slack/slack-bot.ts` | 599 | Slack orchestrator with TemplateContext bridge |
| **Chat Handler** | `cli/chat.handler.ts` | 586 | Interactive chat entrypoint |
| **Config Validator** | `services/config-validator.service.ts` | 580 | JSON Schema validation + config diagnostics |
| **Init Handler** | `cli/init.handler.ts` | 491 | Project bootstrap + layout/template scaffolding |

---

## 🎯 Module Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                       Entry Points                          │
│  main.ts → app.module.ts → CLI/MCP/Slack Handlers          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core AI Services                         │
│  ai.service.ts ←→ ai-provider.service.ts ←→ SDK Providers   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├──────────────┬──────────────┬─────────────┬─────────────┐
                  ▼              ▼              ▼             ▼             ▼
         ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Tool/      │  │ Config & │  │ Conv.    │  │ Template │  │ Remote   │
         │ Layout     │  │ Schema   │  │ System   │  │ Service  │  │ Agents   │
         │ Pipeline   │  │          │  │          │  │          │  │ / MCP    │
         └────────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 📦 Dependency Injection

NestJS providers registered in `app.module.ts`:

### Core Services
- `AIService` - Main AI orchestration
- `AIProviderService` - Provider management
- `ProjectService` - Project context

### Providers (Namespace-based)
- Built-in CLI providers (Claude, Gemini, Copilot, Codex) are constructed inside `AIProviderService` using SDK classes with CLI-specific logger/tool handlers.
- `DynamicProviderFactory` - plugin/* & remote/* (YAML-based plugin and remote agent loader)

### Services
- `ToolCallService` - Tool execution
- `ConfigService` - Configuration
- `ConfigValidatorService` - Validation
- `AgentLoaderService` - Agent management
- `ParallelProcessingService` - Concurrency
- `TaskManagementService` - Todo tracking
- `TemplateService` - Templates
- `DocumentLoaderService` - Document loading
- `ContextEnhancementService` - Context enhancement
- `IntelligentCompressionService` - History compression
- `ResultFormatterService` - Output formatting
- `HelpService` - Help content
- `McpClientService` - MCP client for remote agent connections
- `RemoteAgentService` - Remote agent management and discovery
- `AuthService` - Authentication for remote MCP endpoints (Bearer tokens)

### CLI Handlers
- `InitHandler` - Init command
- `DoctorHandler` - Doctor command
- `McpHandler` - MCP server and remote agent management

---

## 🚨 Areas of Concern

### Large Files (Refactoring Candidates)

1. **`crewx.tool.ts` (1,838 LOC)**
   - Owns MCP server, provider negotiation, streaming, telemetry
   - Potential split: transport adapters vs. request pipeline vs. formatting

2. **`tool-call.service.ts` (1,187 LOC)**
   - Handles layout rendering, tool orchestration, error surfaces
   - Consider extracting layout pipeline + validation helpers into dedicated modules

---

## 📚 Drill Down

For more details on specific modules:

- 🔗 [src/cli/CREWX.md](cli/CREWX.md) - CLI command handlers
- 🔗 [src/providers/CREWX.md](providers/CREWX.md) - AI provider implementations
- 🔗 [src/services/CREWX.md](services/CREWX.md) - Business logic services
- 🔗 [src/conversation/CREWX.md](conversation/CREWX.md) - Conversation history system
- 🔗 [src/slack/CREWX.md](slack/CREWX.md) - Slack bot integration
- 🔗 [src/utils/CREWX.md](utils/CREWX.md) - Utility functions

---

**Last Updated**: 2025-10-20
