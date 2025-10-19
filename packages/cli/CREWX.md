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
| `crewx.tool.ts` | MCP server implementation | 1,399 |
| `services/tool-call.service.ts` | Tool execution engine | 970 |
| `ai.service.ts` | AI orchestration | 715 |
| `providers/base-ai.provider.ts` | Provider base class | 716 |
| `cli/chat.handler.ts` | Interactive chat mode | 575 |
| `slack/slack-bot.ts` | Slack bot | 566 |

---

## Learn More

- 🔗 [../../CREWX.md](../../CREWX.md) - Project root
- 🔗 [../sdk/CREWX.md](../sdk/CREWX.md) - SDK package

---

**Last Updated:** 2025-10-18
