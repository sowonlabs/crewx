# CrewX

> Bring Your Own AI(BYOA) team in Slack/IDE(MCP) with your existing subscriptions

Transform Claude, Gemini, and Copilot into a collaborative development team. No extra costs—just your existing AI subscriptions working together.

## Why CrewX?

### 💬 **Slack Team Collaboration** - Your AI Team in Slack
Bring AI agents directly into your team's workspace:
- **Team-wide AI access** - Everyone benefits from AI expertise in Slack channels
- **Thread-based context** - Maintains conversation history automatically
- **Multi-agent collaboration** - `@claude`, `@gemini`, `@copilot` work together in real-time
- **Natural integration** - Works like chatting with team members
- **Shared knowledge** - Team learns from AI interactions, not isolated sessions

### ✨ Other Benefits
- **No additional costs** - Use existing Claude Pro, Gemini, or GitHub Copilot subscriptions
- **Multi-agent collaboration** - Different AI models working on specialized tasks
- **Parallel execution** - Multiple agents working simultaneously
- **Flexible integration** - CLI, MCP server, or Slack bot

## Quick Start

```bash
# Install
npm install -g crewx

# Initialize
crewx init

# Check system
crewx doctor

# Try it out
crewx query "@claude analyze my code"
crewx execute "@claude create a login component"
```

## Three Ways to Use

### 💬 Slack Mode - Team Collaboration (Recommended)
```bash
# Start CrewX in your Slack workspace
crewx slack

# Your team can now:
# - @mention AI agents in channels
# - Maintain context in threads
# - Share AI insights with the whole team
```
👉 **[Complete Slack Setup Guide →](./SLACK_INSTALL.md)**

### 🖥️ CLI Mode - Direct terminal usage
```bash
crewx query "@claude review this code"
crewx execute "@gemini optimize performance"
crewx query "@claude @gemini @copilot compare approaches"
```

### 🔌 MCP Server Mode - IDE integration
```bash
crewx mcp  # VS Code, Claude Desktop, Cursor
```

## Supported AI Tools

- **Claude Code** - Advanced reasoning and analysis
- **Gemini CLI** - Real-time web access
- **GitHub Copilot CLI** - Specialized coding assistant

## Basic Usage

```bash
# Read-only analysis
crewx query "@claude explain this function"

# File creation/modification
crewx execute "@claude implement user authentication"

# Parallel tasks
crewx execute "@claude create tests" "@gemini write docs"

# Pipeline workflows
crewx query "@architect design API" | \
crewx execute "@backend implement it"

# Thread-based conversations
crewx query "@claude design login" --thread "auth-feature"
crewx execute "@claude implement it" --thread "auth-feature"
```

## Create Custom Agents

```bash
# Let @crewx create agents for you
crewx execute "@crewx Create a Python expert agent"
crewx execute "@crewx Create a React specialist with TypeScript"
crewx execute "@crewx Create a DevOps agent for Docker"

# Test your new agent
crewx query "@python_expert Review my code"
```

## Agent Configuration

Create `crewx.yaml` (or `agents.yaml` for backward compatibility):

```yaml
agents:
  - id: "frontend_dev"
    name: "React Expert"
    provider: "cli/claude"  # Built-in CLI provider
    working_directory: "./src"
    inline:
      type: "agent"
      system_prompt: |
        You are a senior React developer.
        Provide detailed examples and best practices.
```

> **Note:** `crewx.yaml` is the preferred configuration file name. The legacy `agents.yaml` is still supported for backward compatibility. If both files exist, `crewx.yaml` takes priority.

## Documentation

- [📖 CLI Guide](docs/cli-guide.md) - Complete CLI reference
- [🔌 MCP Integration](docs/mcp-integration.md) - IDE setup and MCP servers
- [⚙️ Agent Configuration](docs/agent-configuration.md) - Custom agents and advanced config
- [📚 Template System](docs/templates.md) - Knowledge management and dynamic prompts for agents
- [🔧 Tool System](docs/tools.md) - Tool integration and creation guide
- [🔧 Troubleshooting](docs/troubleshooting.md) - Common issues and solutions
- [💬 Slack Integration](SLACK_INSTALL.md) - Slack bot setup

## License

Apache-2.0 License - Copyright (c) 2025 SowonLabs

---

Built by [SowonLabs](https://github.com/sowonlabs)
