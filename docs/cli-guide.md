# CLI Guide

Complete reference for CrewX's command-line interface.

## Core Commands

### `crewx` (default)
Shows help and available commands.

```bash
crewx
```

### `crewx init`
Initialize project with `crewx.yaml` configuration.

```bash
crewx init                          # Initialize with default configuration
crewx init --config custom.yaml    # Use custom config filename
crewx init --force                 # Overwrite existing configuration
```

**Features:**
- Creates `crewx.yaml` with default agents (Claude, Gemini, Copilot)
- Sets up `.crewx/logs` directory
- Prevents accidental overwrites (use `--force` to override)

> **Note:** For backward compatibility, `agents.yaml` is still supported, but `crewx.yaml` is preferred.

### `crewx doctor`
System health check and diagnostics.

```bash
crewx doctor                        # Full system diagnosis
crewx doctor --config path/to/config.yaml  # Use custom config
```

**Checks:**
- Configuration file (`crewx.yaml` or `agents.yaml`) validity
- AI CLI tool availability (Claude, Gemini, Copilot)
- Real test queries to verify responses
- Session limits and performance
- Provides troubleshooting recommendations

### `crewx query`
Read-only analysis and queries.

```bash
# Basic queries
crewx query "@claude analyze this function"
crewx query "@gemini explain the algorithm"

# Multiple agents in parallel
crewx query "@claude @gemini @copilot review security"

# With model selection
crewx query "@claude:opus detailed code review"
crewx query "@gemini:gemini-2.5-pro optimize algorithm"
crewx query "@copilot:gpt-5 suggest best practices"

# With conversation history
crewx query "@claude explain auth" --thread "auth-session"

# Pipeline input
echo "user auth code" | crewx query "@claude explain this"
```

**Available Models:**
- **Claude**: `opus`, `sonnet`, `haiku`, `claude-sonnet-4-5`, `claude-sonnet-4-5-20250929`
- **Gemini**: `gemini-2.5-pro` (default), `gemini-2.5-flash`
- **Copilot**: `gpt-5`, `claude-sonnet-4`, `claude-sonnet-4.5`
- **Codex**: `gpt-5-codex`, `gpt-5`

> **Codex reasoning effort:**  
> When invoking `cli/codex`, you can override reasoning depth on the fly with `-c model_reasoning_effort="..."`.
> - `gpt-5-codex`: supports `low`, `medium`, `high`
> - `gpt-5`: supports `minimal`, `low`, `medium`, `high`

Example:

```bash
codex exec --experimental-json \
  -c model="gpt-5-codex" \
  -c model_reasoning_effort="medium" \
  "Respond with OK."
```

Unsupported combinations return a 400 error (e.g., `gpt-5-codex` + `minimal`).

### `crewx execute`
Execute tasks with file creation/modification.

```bash
# Basic execution
crewx execute "@claude create a React component"

# Multiple agents in parallel
crewx execute "@claude @gemini implement different sorting algorithms"

# With model selection
crewx execute "@claude:opus implement complex auth system"
crewx execute "@gemini:gemini-2.5-pro optimize critical code"

# With conversation history
crewx execute "@claude implement login" --thread "auth-feature"

# Pipeline workflows
crewx query "@architect design API" | \
crewx execute "@backend implement the design"
```

## Pipeline Workflows

Chain commands for complex multi-step workflows:

```bash
# Multi-step development
crewx query "@architect design user auth system" | \
crewx execute "@backend implement API endpoints" | \
crewx execute "@frontend create UI components"

# Code review and improvement
crewx query "@claude analyze code quality" | \
crewx execute "@gemini implement improvements"

# Design, implement, test
crewx query "@architect design feature" | \
crewx execute "@developer build it" | \
crewx query "@tester verify implementation"
```

## Conversation History with `--thread`

Maintain context across multiple queries and executions:

```bash
# Start a thread
crewx query "@claude design a login system" --thread "auth-feature"

# Continue in same thread (Claude remembers previous context)
crewx query "@claude add 2FA support" --thread "auth-feature"

# Execute with thread context
crewx execute "@claude implement the design" --thread "auth-feature"
```

**Features:**
- **Persistent context** - Stored in `.crewx/conversations/`
- **Cross-session** - Available after restart
- **Thread isolation** - Different threads maintain separate contexts
- **Works with all commands** - `query`, `execute`, `chat`

**Example workflow:**
```bash
# Design phase
crewx query "@architect design REST API" --thread "api-project"

# Implementation (remembers design)
crewx execute "@backend implement endpoints" --thread "api-project"

# Testing (remembers design + implementation)
crewx query "@tester review implementation" --thread "api-project"
```

## Slack Bot Integration

Run CrewX as a Slack bot:

```bash
crewx slack                        # Query-only mode with Claude (default)
crewx slack --mode execute         # Allow execute tasks from Slack
crewx slack --agent gemini         # Use Gemini
crewx slack --agent copilot        # Use GitHub Copilot
crewx slack --agent custom_agent   # Use custom agent
```

**Features:**
- Natural conversation with chosen AI agent
- Thread history maintenance
- @mentions and DMs
- Clean responses
- Reaction indicators (👀 processing, ✅ completed, ❌ error)

**Mode selection:**
- `--mode query` *(default)*: Read-only responses, safe for general Q&A
- `--mode execute`: Agents can modify files, run commands, and apply changes

**Setup:**
1. Create Slack App and configure bot tokens
2. Set environment variables in `.env.slack`:
   ```bash
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_APP_TOKEN=xapp-...
   SLACK_SIGNING_SECRET=...
   SLACK_MAX_RESPONSE_LENGTH=400000  # Optional
   ```
3. Start: `npm run start:slack`
4. *(Optional)* Persist Slack conversations locally for evaluation by enabling logging:
   ```yaml
   # crewx.yaml
   settings:
     slack:
       log_conversations: true
   ```
   Or set an environment variable: `CREWX_SLACK_LOG_CONVERSATIONS=true`.  
   When enabled, Slack threads are mirrored to `.crewx/conversations/` just like CLI sessions, which is useful for agent performance reviews.

See [SLACK_INSTALL.md](../SLACK_INSTALL.md) for full setup guide.

## MCP Server Mode

Run CrewX as an MCP (Model Context Protocol) server for remote access:

```bash
# Basic MCP server (stdio only)
crewx mcp

# MCP server with HTTP support
crewx mcp server --http

# Full configuration
crewx mcp server \
  --http \
  --host 0.0.0.0 \
  --port 3000 \
  --key "sk-secret-key" \
  --log
```

**Options:**
- `--http` - Enable HTTP transport (in addition to stdio)
- `--host` - Server hostname (default: localhost)
- `--port` - Server port (default: 3000)
- `--key` - API key for bearer authentication
- `--log` - Enable request logging

**Use cases:**
- IDE integration (VS Code, Cursor, Claude Desktop)
- Remote agent access (see [Remote Agents Guide](./remote-agents.md))
- Team collaboration via HTTP

**Exposed MCP tools:**
- `crewx_queryAgent` - Read-only agent queries
- `crewx_executeAgent` - Agent execution with file operations

See [MCP Integration Guide](./mcp-integration.md) for IDE setup and [Remote Agents Guide](./remote-agents.md) for remote access configuration.

## Advanced Features

### Task Tracking
Every operation is logged with unique task IDs:

```bash
# Operations automatically create logs
crewx execute "@claude create component"
# Output includes: Task ID: abc123

# View task logs
crewx logs abc123
```

### Performance Metrics
- Execution time tracking
- Success/failure rates
- Parallel vs sequential comparison

### Error Recovery
- Detailed error messages
- Resolution suggestions
- Session limit handling

### Configuration Validation
Validates agent configurations before execution:
- Provider availability
- Required options
- Working directory existence

## Environment Variables

Customize behavior via `.env` or environment variables:

### Timeout Configuration

**All timeouts are unified to 30 minutes (1800000ms) by default** for consistent behavior across all operations.

```bash
# All Providers (unified to 30 minutes)
CODECREW_TIMEOUT_CLAUDE_QUERY=1800000       # 30 min (default)
CODECREW_TIMEOUT_CLAUDE_EXECUTE=1800000     # 30 min (default)
CODECREW_TIMEOUT_GEMINI_QUERY=1800000       # 30 min (default)
CODECREW_TIMEOUT_GEMINI_EXECUTE=1800000     # 30 min (default)
CODECREW_TIMEOUT_COPILOT_QUERY=1800000      # 30 min (default)
CODECREW_TIMEOUT_COPILOT_EXECUTE=1800000    # 30 min (default)

# System
CODECREW_TIMEOUT_PARALLEL=1800000           # 30 min (default)
CODECREW_TIMEOUT_STDIN_INITIAL=30000        # 30 sec
CODECREW_TIMEOUT_STDIN_CHUNK=1800000        # 30 min (default)
CODECREW_TIMEOUT_STDIN_COMPLETE=100         # 100ms
```

**Why 30 minutes?**
- Handles complex AI operations (code generation, analysis, refactoring)
- Supports long-running tasks without interruption
- Consistent across all providers and modes
- Can be overridden per-command with `--timeout` flag

**Usage:**
```bash
# Using .env file (customize if needed)
echo "CODECREW_TIMEOUT_CLAUDE_QUERY=3600000" >> .env  # 60 min
crewx query "@claude complex analysis"

# Inline override
CODECREW_TIMEOUT_CLAUDE_QUERY=900000 crewx query "@claude quick check"  # 15 min

# Per-command timeout flag (recommended)
crewx query "@claude analyze" --timeout 3600000  # 60 min
```

### Plugin Provider Environment Variables

Plugin providers can use environment variables for configuration:

```yaml
providers:
  - id: remote_ollama
    type: plugin
    cli_command: ollama
    env:
      OLLAMA_HOST: "${OLLAMA_REMOTE_HOST}"  # Reference env var
      OLLAMA_API_KEY: "${OLLAMA_API_KEY}"

  - id: custom_tool
    type: plugin
    cli_command: mytool
    env:
      API_ENDPOINT: "https://api.example.com"
      API_TOKEN: "${MY_API_TOKEN}"  # From environment
```

**Example .env:**
```bash
OLLAMA_REMOTE_HOST=http://192.168.1.100:11434
OLLAMA_API_KEY=sk-ollama-key-123
MY_API_TOKEN=custom-api-token-456
```

### Remote Agent Configuration

```bash
# Remote server connection
CREWX_REMOTE_URL=http://production.example.com:3000
CREWX_REMOTE_AGENT=backend_prod
CREWX_REMOTE_TOKEN=sk-prod-secret-key
```

Use in `crewx.yaml`:
```yaml
providers:
  - id: prod_server
    type: remote
    location: "${CREWX_REMOTE_URL}"
    external_agent_id: "${CREWX_REMOTE_AGENT}"
    auth:
      type: bearer
      token: "${CREWX_REMOTE_TOKEN}"
```

## Examples

### Basic Analysis
```bash
# Single agent query
crewx query "@claude explain this function"

# Multiple agents compare
crewx query "@claude @gemini @copilot which approach is better?"
```

### File Operations
```bash
# Create files
crewx execute "@claude create a login component"

# Modify files
crewx execute "@claude refactor authentication"

# Multiple tasks
crewx execute "@claude create tests" "@gemini write docs"
```

### Complex Workflows
```bash
# Design → Implement → Test
crewx query "@architect design user management" --thread "user-mgmt" && \
crewx execute "@backend implement it" --thread "user-mgmt" && \
crewx query "@tester create test plan" --thread "user-mgmt"

# Code review pipeline
git diff | crewx query "@claude review these changes" | \
crewx execute "@refactor improve code quality"
```

### Model Selection
```bash
# Use specific models for different tasks
crewx query "@claude:haiku quick analysis"           # Fast, concise
crewx query "@claude:opus comprehensive review"      # Detailed, thorough
crewx execute "@gemini:gemini-2.5-flash rapid prototyping"  # Fast execution
crewx execute "@gemini:gemini-2.5-pro production code"      # High quality
```

### Remote Agents
```bash
# Connect to remote CrewX instance
crewx query "@remote_backend check API status"

# Distribute work across projects
crewx execute "@frontend_team create UI" "@backend_team create API"

# Coordinate multi-project feature
crewx query "@coordinator design cross-service authentication"

# Access specialized resources
crewx execute "@ml_server train recommendation model"
```

See [Remote Agents Guide](./remote-agents.md) for setup and configuration.

## Tips

1. **Use `query` for analysis** - Safe, read-only, no file changes
2. **Use `execute` for implementation** - Can modify files, create new ones
3. **Leverage `--thread`** - Maintain context across commands
4. **Combine agents** - Use strengths of different AI models
5. **Pipeline complex tasks** - Chain commands for multi-step workflows
6. **Check with `doctor`** - Diagnose issues before running tasks
7. **Use specific models** - Choose right model for the task complexity
