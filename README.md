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

### 🔌 **Plugin Provider System** - Universal AI Integration
Transform any CLI tool or AI service into an agent:
- **Bring Your Own AI** - OpenAI, Anthropic, Ollama, LiteLLM, or any AI service
- **Bring Your Own Tools** - jq, curl, ffmpeg, or any CLI tool becomes an agent
- **Bring Your Own Framework** - Integrate LangChain, CrewAI, AutoGPT seamlessly
- **No coding required** - Simple YAML configuration
- **Mix and match** - Combine different AI services in one workflow

```yaml
# Example: Add any AI service as a plugin
providers:
  - id: ollama
    type: plugin
    cli_command: ollama
    default_model: "llama3"
    query_args: ["run", "{model}"]
    prompt_in_args: false

agents:
  - id: "local_llama"
    provider: "plugin/ollama"
```

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
- **Codex CLI** - Open inference with workspace-aware execution

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

# Codex CLI agent
crewx query "@codex draft a release checklist"
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

## Remote MCP Agents (Experimental)

CrewX can delegate tasks to another CrewX MCP server. Treat this capability as experimental while the protocol and tooling evolve.

```bash
# 1. Start the remote MCP server
npx -y crewx@dev mcp server --http --host localhost --port 9001 --key "sk-0001" --log

# 2. Add remote provider + agent in crewx.yaml
providers:
  - id: mcp_cso
    type: remote
    location: "http://localhost:9001"
    external_agent_id: "cso"
    auth:
      type: bearer
      token: "sk-0001"

agents:
  - id: "remote_cso"
    provider: "remote/mcp_cso"
    remote:
      type: "mcp-http"
      url: "http://localhost:9001"
      apiKey: "sk-0001"
      agentId: "cso"
      timeoutMs: 120000

# 3. Use the remote agent locally
CREWX_CONFIG=./crewx.yaml crewx query "@remote_cso check status"
```

- **Current limitations**
- Remote calls are stateless: `--thread` conversation history is not forwarded to the remote server.
- The remote server must expose CrewX MCP tools (`crewx_queryAgent`, `crewx_executeAgent`).
- Depending on network latency and remote execution time, configure a sufficiently large `timeoutMs`.

## Documentation

- [📖 CLI Guide](docs/cli-guide.md) - Complete CLI reference
- [🔌 MCP Integration](docs/mcp-integration.md) - IDE setup and MCP servers
- [⚙️ Agent Configuration](docs/agent-configuration.md) - Custom agents and advanced config
- [📚 Template System](docs/templates.md) - Knowledge management and dynamic prompts for agents
- [📝 Template Variables](docs/template-variables.md) - Dynamic variables in agent configurations
- [🔧 Tool System](docs/tools.md) - Tool integration and creation guide
- [🔧 Troubleshooting](docs/troubleshooting.md) - Common issues and solutions
- [💬 Slack Integration](SLACK_INSTALL.md) - Slack bot setup

## License

Apache-2.0 License - Copyright (c) 2025 SowonLabs

---

Built by [SowonLabs](https://github.com/sowonlabs)
