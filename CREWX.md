# CrewX Project Structure

> Bring Your Own AI(BYOA) team in Slack/IDE(MCP) with your existing subscriptions

---

## 📦 Packages

### [@sowonai/crewx-cli](packages/cli/CREWX.md)
Main CLI application (NestJS-based)
- CLI commands (query, execute, chat, agent, doctor, init, mcp)
- Slack Bot integration
- MCP server (VS Code, Claude Desktop, etc.)
- AI orchestration & multi-provider support
- Plugin system

### [@sowonai/crewx-sdk](packages/sdk/CREWX.md)
Shared SDK & type definitions
- Configuration management (Timeout, Conversation)
- Conversation system (History Provider, Message Formatting)
- Knowledge base (Document Manager)
- Agent utilities (MentionParser, Agent Factory)
- Type system (AIProvider, AgentConfig, etc.)

---

## 🗂️ Directory Structure

```
crewx/
├── packages/
│   ├── cli/                # @sowonai/crewx-cli
│   ├── sdk/                # @sowonai/crewx-sdk
│   └── crewx/              # npm distribution package (wrapper)
├── docs/                   # Documentation
├── templates/              # Project templates
├── scripts/                # Build & automation
├── wbs/                    # Work breakdown schedules
└── worktree/               # Git worktrees (parallel development)
```

---

## 🧪 Development

```bash
# Build
npm run build              # All packages
npm run build:cli          # CLI only
npm run build:sdk          # SDK only

# Test
npm test                   # All packages
npm run test:cli           # CLI only
npm run test:sdk           # SDK only
npm run test:coverage      # Coverage report

# Run
npm run dev:cli            # CLI dev mode
```

---

## 📚 Learn More

- 🔗 [packages/cli/CREWX.md](packages/cli/CREWX.md) - CLI package
- 🔗 [packages/sdk/CREWX.md](packages/sdk/CREWX.md) - SDK package

---

**Last Updated**: 2025-10-18
