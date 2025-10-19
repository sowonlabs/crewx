# SowonAI CrewX CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/crewx.svg)](https://www.npmjs.com/package/crewx)

Bring Your Own AI (BYOA) team in Slack/IDE with your existing subscriptions. Transform Claude, Gemini, Codex, and Copilot into a collaborative development team.

## Overview

SowonAI CrewX CLI is the full-featured command-line interface for SowonAI CrewX, providing:

- **CLI Mode**: Direct terminal usage with `crewx query` and `crewx execute`
- **Slack Mode**: Team collaboration with AI agents in Slack channels
- **MCP Server Mode**: IDE integration (VS Code, Claude Desktop, Cursor)
- **Remote Agents**: Distributed AI teams across projects
- **Plugin System**: Transform any CLI tool into an AI agent

## Installation

```bash
npm install -g crewx
```

## Quick Start

```bash
# Initialize
crewx init

# Check system
crewx doctor

# Try it out
crewx query "@claude analyze my code"
crewx execute "@claude create a login component"
```

## Commands

### query

Read-only analysis and information retrieval:

```bash
crewx query "@claude explain this function"
crewx query "@gemini search for latest news"
crewx query "@claude @gemini compare approaches"
```

**Options:**
- `-t, --thread <id>`: Continue conversation in thread
- `-m, --model <model>`: Override agent's default model
- `--timeout <ms>`: Set timeout in milliseconds
- `--log`: Enable debug logging

### execute

Create or modify files and run operations:

```bash
crewx execute "@claude implement user authentication"
crewx execute "@gemini optimize performance"
```

**Options:**
- `-t, --thread <id>`: Continue conversation in thread
- `-m, --model <model>`: Override agent's default model
- `--timeout <ms>`: Set timeout in milliseconds
- `--log`: Enable debug logging

### chat

Interactive conversation mode:

```bash
crewx chat
crewx chat --thread "my-session"
```

**Options:**
- `-t, --thread <id>`: Thread ID for conversation
- `--agent <id>`: Default agent to use
- `--log`: Enable debug logging

### agent

Manage agents:

```bash
# List all agents
crewx agent list

# Get agent details
crewx agent info <agent-id>
```

### init

Initialize CrewX configuration:

```bash
crewx init
crewx init --template development
```

Creates `crewx.yaml` with default agents.

### doctor

Check system configuration:

```bash
crewx doctor
```

Verifies:
- AI CLI tools installation
- Configuration file
- Agent availability
- API keys setup

### mcp

Start MCP server for IDE integration:

```bash
crewx mcp
crewx mcp --log
```

### slack

Start Slack bot:

```bash
# Read-only mode
crewx slack

# Allow file modifications
crewx slack --mode execute

# With debug logging
crewx slack --log
```

See [Slack Setup Guide](../../SLACK_INSTALL.md) for configuration.

### templates

Manage knowledge templates:

```bash
crewx templates list
crewx templates info <template-name>
```

## Configuration

### crewx.yaml

Create `crewx.yaml` in your project root:

```yaml
agents:
  - id: "frontend_dev"
    name: "React Expert"
    provider: "cli/claude"
    working_directory: "./src"
    inline:
      type: "agent"
      system_prompt: |
        You are a senior React developer.
        Provide detailed examples and best practices.

  - id: "backend_api"
    name: "API Specialist"
    provider: "cli/gemini"
    inline:
      type: "agent"
      system_prompt: |
        You are an expert in REST API design.
```

### Provider Configuration

Built-in providers:

```yaml
# Claude Code
provider: "cli/claude"

# Gemini CLI
provider: "cli/gemini"

# GitHub Copilot CLI
provider: "cli/copilot"

# Codex CLI
provider: "cli/codex"
```

Plugin providers:

```yaml
providers:
  - id: "ollama"
    type: "plugin"
    cli_command: "ollama"
    default_model: "llama3"
    query_args: ["run", "{model}"]
    prompt_in_args: false

agents:
  - id: "local_llama"
    provider: "plugin/ollama"
```

### Remote Agents

Connect to other CrewX instances:

```yaml
providers:
  - id: "backend_server"
    type: "remote"
    location: "http://api.example.com:3000"
    external_agent_id: "backend_team"

agents:
  - id: "remote_backend"
    provider: "remote/backend_server"
```

## Usage Examples

### Basic Queries

```bash
# Single agent
crewx query "@claude what is this code doing?"

# Multiple agents
crewx query "@claude @gemini compare these approaches"

# With model override
crewx query "@claude:opus analyze in detail"
```

### Execution

```bash
# Create files
crewx execute "@claude create a React component"

# Modify code
crewx execute "@gemini optimize this function"

# Multiple tasks
crewx execute "@claude create tests" "@gemini write docs"
```

### Pipeline Workflows

```bash
# Design then implement
crewx query "@architect design API" | \
crewx execute "@backend implement it"

# Multi-stage processing
cat requirements.txt | \
crewx query "@analyst prioritize" | \
crewx execute "@dev implement top 3"
```

### Thread-based Conversations

```bash
# Start conversation
crewx query "@claude design login" --thread "auth-feature"

# Continue conversation
crewx execute "@claude add password reset" --thread "auth-feature"

# Review conversation
crewx chat --thread "auth-feature"
```

### Parallel Execution

```bash
# Multiple agents simultaneously
crewx execute \
  "@frontend create UI" \
  "@backend create API" \
  "@devops setup CI"
```

## Environment Variables

```bash
# Slack configuration
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# MCP server port
PORT=3000

# Debug logging
DEBUG=crewx:*
```

## Architecture

The CLI is built on top of [@sowonai/crewx-sdk](../sdk/README.md):

```
packages/cli/
├── src/
│   ├── cli/              # Command handlers
│   │   ├── query.handler.ts
│   │   ├── execute.handler.ts
│   │   ├── chat.handler.ts
│   │   └── ...
│   ├── providers/        # CLI-specific provider utilities
│   │   ├── dynamic-provider.factory.ts  # Security wrapper over SDK dynamic providers
│   │   └── logger.adapter.ts            # Nest logger adapter for SDK providers
│   ├── services/         # Business logic
│   │   ├── ai.service.ts
│   │   ├── ai-provider.service.ts
│   │   ├── remote-agent.service.ts  # Uses SDK RemoteAgentManager
│   │   └── ...
│   ├── slack/            # Slack integration
│   │   ├── slack-bot.ts
│   │   └── formatters/
│   │       └── message.formatter.ts  # Extends SDK BaseMessageFormatter
│   ├── conversation/     # Conversation management
│   ├── guards/           # Security
│   └── utils/            # Utilities
└── tests/                # Tests
```

### SDK Integration (WBS-9)

The CLI uses SDK components as a foundation, adding NestJS integration and platform-specific features:

#### Message Formatting
- **SDK**: `BaseMessageFormatter` provides core formatting logic
- **CLI**: `SlackMessageFormatter` extends SDK base with Slack-specific features (emoji, blocks, markdown)

#### AI Providers
- **SDK**: `BaseAIProvider`, `ClaudeProvider`, `GeminiProvider`, `CopilotProvider`, `CodexProvider`
- **CLI**: NestJS `@Injectable()` wrappers that:
  - Inject NestJS logger via `LoggerAdapter`
  - Integrate with `AIService` and `ConfigService`
  - Add platform-specific tool execution

#### Remote Agents
- **SDK**: `RemoteAgentManager` handles remote communication
- **CLI**: `RemoteAgentService` wraps SDK manager with:
  - NestJS dependency injection
  - Agent configuration loading
  - Tool name mapping
  - MCP protocol integration

#### Benefits
1. **Reusable Core**: SDK components work in any Node.js environment
2. **Clean Separation**: Platform logic (NestJS, Slack) stays in CLI
3. **Testability**: SDK tests verify core logic, CLI tests verify integration
4. **Extensibility**: Custom integrations can use SDK directly

For migration details, see [WBS-9 Integration Guide](../../docs/wbs-9-phase1-5-integration.md).

## Development

### Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run CLI locally
npm run start
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Debugging

```bash
# Debug mode
npm run debug

# With environment variables
dotenv -e .env.test -- npm run dev
```

## API Integration

The CLI can be used as a library:

```typescript
import { AIService, ConfigService } from 'crewx';

// Use in your Node.js application
const aiService = new AIService(/* ... */);
const result = await aiService.queryAI('prompt', 'cli/claude');
```

## Plugins

### Creating a Plugin Provider

Add to `crewx.yaml`:

```yaml
providers:
  - id: "my_tool"
    type: "plugin"
    cli_command: "my-cli"
    default_model: "default"
    query_args: ["query"]
    execute_args: ["execute"]
    prompt_in_args: true
    stdin: true

agents:
  - id: "my_agent"
    provider: "plugin/my_tool"
```

### Plugin Options

- `cli_command`: Command to execute
- `default_model`: Default model name
- `query_args`: Arguments for query mode
- `execute_args`: Arguments for execute mode
- `prompt_in_args`: Pass prompt as argument
- `stdin`: Pass prompt via stdin

## Slack Integration

Full Slack integration with:
- Thread-based conversations
- Agent mentions (@claude, @gemini, etc.)
- Team collaboration
- Read-only or execute mode

See [Slack Setup Guide](../../SLACK_INSTALL.md) for details.

## MCP Server

CrewX can run as an MCP server for IDE integration:

```bash
crewx mcp
```

Add to your IDE's MCP configuration:

```json
{
  "mcpServers": {
    "crewx": {
      "command": "crewx",
      "args": ["mcp"]
    }
  }
}
```

## Troubleshooting

### Common Issues

**Command not found**
```bash
npm install -g crewx
```

**Configuration file not found**
```bash
crewx init
```

**Provider not available**
```bash
crewx doctor
```

See [Troubleshooting Guide](../../docs/troubleshooting.md) for more.

## Performance

The CLI is optimized for:
- Parallel agent execution
- Efficient context management
- Minimal memory footprint
- Fast startup time

## Security

- Bearer token authentication for remote agents
- Sandbox mode for plugin providers
- Security levels (low, medium, high)
- Execution mode guards

## Documentation

- [CLI Guide](../../docs/cli-guide.md) - Complete reference
- [Agent Configuration](../../docs/agent-configuration.md) - Configuration details
- [Remote Agents](../../docs/remote-agents.md) - Distributed setup
- [Template System](../../docs/templates.md) - Knowledge management
- [MCP Integration](../../docs/mcp-integration.md) - IDE setup

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `npm test` and `npm run build`
6. Submit a pull request

See [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/sowonlabs/crewx/issues)
- [Documentation](../../docs/)
- [Main README](../../README.md)

## Related Packages

- [`@sowonai/crewx-sdk`](../sdk/README.md) - Core SDK for building custom integrations

---

Built by [SowonLabs](https://github.com/sowonlabs)
