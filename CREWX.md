# CrewX Project Structure

> Bring Your Own AI(BYOA) team in Slack/IDE(MCP) with your existing subscriptions

---

> **⚠️ Document Maintenance**
>
> When making significant changes to the project structure:
> 1. Update the directory structure section below
> 2. Update [src/CREWX.md](src/CREWX.md) if source code structure changes
> 3. Update [docs/INDEX.md](docs/INDEX.md) if documentation changes
> 4. Keep Key Components and Technologies sections current

---

## 🗂️ Directory Structure

```
crewx/
├── src/                          # Source code
│   ├── cli/                      # CLI command handlers
│   ├── providers/                # AI provider implementations
│   ├── services/                 # Business logic services
│   ├── conversation/             # Conversation history management
│   ├── slack/                    # Slack bot integration
│   ├── utils/                    # Utility functions
│   ├── config/                   # Configuration
│   ├── guards/                   # Security guards
│   └── knowledge/                # Knowledge management
│
├── tests/                        # Test files
│
├── docs/                         # Documentation
│   ├── guides/                   # How-to guides
│   ├── standards/                # Standards & conventions
│   ├── process/                  # Process documentation
│   └── rules/                    # Rules & policies
│
├── templates/                    # Template files
├── worktree/                     # Git worktrees (bugfix/release branches)
├── scripts/                      # Build & automation scripts
│
├── crewx.yaml                   # Main configuration
├── package.json                 # NPM package
└── README.md                    # User documentation
```

---

## 🏗️ Architecture Layers

1. **Entry Points** - Bootstrap & module setup
2. **Interface Layer** - CLI, MCP, Slack
3. **Core Services** - AI orchestration, providers (including new Codex provider), tools, conversation
4. **Support Services** - Config, tasks, parallel processing, templates, log formatting
5. **Utilities** - Helpers, security, configuration

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

## 📦 Key Technologies

- **Framework**: NestJS (Dependency Injection, Modularity)
- **AI Providers**:
  - Built-in CLI providers (cli/*): Claude Code, Gemini CLI, GitHub Copilot CLI, Codex CLI
  - Plugin providers (plugin/*): User-defined external AI tools via YAML config
  - Future API providers (api/*): Direct API integrations (planned)
- **Provider Namespace System**: `{namespace}/{id}` format for organized provider management
- **Protocols**: Model Context Protocol (MCP)
- **Integrations**: Slack Bolt SDK
- **Template Engine**: Handlebars
- **Configuration**: YAML (js-yaml, AJV validation)
- **CLI**: Yargs
- **Testing**: Vitest

---

## 📚 Drill Down

For detailed information about each module, see:

- 🔗 [src/CREWX.md](src/CREWX.md) - Source code structure and architecture

---

**Last Updated**: 2025-10-12
