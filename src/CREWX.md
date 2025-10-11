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
├── cli/                          # CLI Interface Layer
│   ├── chat.handler.ts           # Interactive chat mode
│   ├── query.handler.ts          # Read-only queries
│   ├── execute.handler.ts        # File modification tasks
│   ├── init.handler.ts           # Project initialization
│   ├── doctor.handler.ts         # System diagnostics
│   ├── templates.handler.ts      # Template management
│   ├── help.handler.ts           # Help system
│   └── cli.handler.ts            # CLI orchestration
│
├── providers/                    # AI Provider System
│   ├── ai-provider.interface.ts  # Provider contract
│   ├── base-ai.provider.ts       # Base implementation
│   ├── claude.provider.ts        # Claude Code integration
│   ├── gemini.provider.ts        # Gemini CLI integration
│   ├── copilot.provider.ts       # GitHub Copilot integration
│   └── dynamic-provider.factory.ts # Plugin system
│
├── services/                     # Business Logic Services
│   ├── tool-call.service.ts              # Tool execution engine
│   ├── config.service.ts                 # Configuration management
│   ├── config-validator.service.ts       # YAML validation
│   ├── agent-loader.service.ts           # Agent management
│   ├── parallel-processing.service.ts    # Concurrent execution
│   ├── task-management.service.ts        # Todo tracking
│   ├── template.service.ts               # Template rendering
│   ├── result-formatter.service.ts       # Output formatting
│   ├── context-enhancement.service.ts    # Context loading
│   ├── intelligent-compression.service.ts # History compression
│   ├── document-loader.service.ts        # Document loading
│   └── help.service.ts                   # Help content
│
├── conversation/                 # Conversation System
│   ├── conversation-history.interface.ts      # Interface
│   ├── conversation-config.ts                 # Configuration
│   ├── conversation-storage.service.ts        # Storage layer
│   ├── conversation-provider.factory.ts       # Provider factory
│   ├── base-conversation-history.provider.ts  # Base provider
│   ├── cli-conversation-history.provider.ts   # CLI implementation
│   ├── slack-conversation-history.provider.ts # Slack implementation
│   └── index.ts                               # Public exports
│
├── slack/                        # Slack Integration
│   ├── slack-bot.ts              # Slack Bot core
│   └── formatters/
│       └── message.formatter.ts  # Message formatting
│
├── utils/                        # Utility Functions
│   ├── mention-parser.ts         # @mention parsing
│   ├── template-processor.ts     # Template rendering
│   ├── error-utils.ts            # Error handling
│   ├── string-utils.ts           # String helpers
│   ├── config-utils.ts           # Config helpers
│   ├── stdin-utils.ts            # Stdin handling
│   ├── mcp-installer.ts          # MCP installation
│   ├── simple-security.ts        # Security utils
│   └── math-utils.ts             # Math helpers
│
├── config/                       # Configuration
│   └── timeout.config.ts         # Timeout settings
│
├── guards/                       # Security Guards
│   └── (security middleware)
│
├── knowledge/                    # Knowledge Management
│   └── DocumentManager.ts        # Document handling
│
├── crewx.tool.ts                 # MCP Tool (1,399 LOC) ⚠️
├── ai.service.ts                 # Core AI Service (715 LOC)
├── ai-provider.service.ts        # Provider Manager
├── project.service.ts            # Project Context
├── mcp.controller.ts             # MCP Controller
├── app.module.ts                 # NestJS Module
├── main.ts                       # Entry Point
├── constants.ts                  # Constants
├── cli-options.ts                # CLI Options
├── agent.types.ts                # Type Definitions
└── stderr.logger.ts              # Logger
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
  - Thread-based conversations
  - Multi-agent collaboration

### 3. **Core Services**
The heart of the application:

- **AI Services** (`ai.service.ts`, `ai-provider.service.ts`)
  - AI request orchestration
  - Provider selection & routing
  - Response handling

- **Provider System** (`providers/`)
  - Abstract provider interface
  - Built-in providers (Claude, Gemini, Copilot)
  - Plugin system for external providers

- **Tool System** (`services/tool-call.service.ts`)
  - Tool discovery & loading
  - Tool execution
  - Security validation

- **Conversation System** (`conversation/`)
  - Thread-based history
  - Multiple storage backends (CLI, Slack)
  - Context management

### 4. **Support Services**
Enable core functionality:

- **Configuration** (`services/config*.ts`)
  - YAML loading & parsing
  - Schema validation
  - Environment handling

- **Task Management** (`services/task-management.service.ts`)
  - Todo tracking
  - Progress reporting

- **Parallel Processing** (`services/parallel-processing.service.ts`)
  - Concurrent agent execution
  - Result aggregation

- **Template Engine** (`services/template.service.ts`)
  - Handlebars rendering
  - Variable interpolation

### 5. **Utilities**
Cross-cutting concerns:

- **Parsing** (`utils/mention-parser.ts`) - @mention extraction
- **Error Handling** (`utils/error-utils.ts`) - Standardized errors
- **Security** (`utils/simple-security.ts`) - Input validation
- **Helpers** - String, config, stdin utilities

---

## 🔑 Key Components

| Component | File | LOC | Description |
|-----------|------|-----|-------------|
| **MCP Tool** | `crewx.tool.ts` | 1,399 | MCP tool implementation (⚠️ large) |
| **Tool Executor** | `services/tool-call.service.ts` | 970 | Tool execution engine (⚠️ large) |
| **Base Provider** | `providers/base-ai.provider.ts` | 716 | AI provider base class |
| **AI Service** | `ai.service.ts` | 715 | Core AI orchestration |
| **Chat Handler** | `cli/chat.handler.ts` | 575 | Interactive chat mode |
| **Slack Bot** | `slack/slack-bot.ts` | 566 | Slack integration |
| **Config Validator** | `services/config-validator.service.ts` | 536 | YAML validation |
| **Claude Provider** | `providers/claude.provider.ts` | 494 | Claude Code integration |

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
│  ai.service.ts ←→ ai-provider.service.ts ←→ providers/*    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├──────────────┬──────────────┬─────────────┐
                  ▼              ▼              ▼             ▼
         ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
         │   Tool     │  │  Config  │  │  Conv.   │  │ Template │
         │   System   │  │  System  │  │  System  │  │  Engine  │
         └────────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 📦 Dependency Injection

NestJS providers registered in `app.module.ts`:

### Core Services
- `AIService` - Main AI orchestration
- `AIProviderService` - Provider management
- `ProjectService` - Project context

### Providers
- `ClaudeProvider` - Claude Code
- `CopilotProvider` - GitHub Copilot
- `GeminiProvider` - Gemini CLI
- `DynamicProviderFactory` - Plugin loader

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

### CLI Handlers
- `InitHandler` - Init command
- `DoctorHandler` - Doctor command

---

## 🚨 Areas of Concern

### Large Files (Refactoring Candidates)

1. **`crewx.tool.ts` (1,399 LOC)**
   - Too many responsibilities
   - Consider splitting:
     - `crewx-query.tool.ts` - Query operations
     - `crewx-execute.tool.ts` - Execute operations
     - `crewx-agent.tool.ts` - Agent management
     - `crewx-common.tool.ts` - Shared utilities

2. **`tool-call.service.ts` (970 LOC)**
   - Complex tool execution logic
   - Consider splitting:
     - `tool-executor.service.ts` - Execution
     - `tool-validator.service.ts` - Validation
     - `tool-loader.service.ts` - Discovery & loading

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

**Last Updated**: 2025-10-11
