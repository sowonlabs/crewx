# MCP Integration Guide

CrewX can be used as an MCP (Model Context Protocol) server for IDE integration and AI CLI tools.

## MCP Server Mode

Start the MCP server:

```bash
crewx mcp
```

This enables CrewX to be used by MCP-compatible clients like VS Code, Claude Desktop, and Cursor.

## MCP Integration Status

CrewX works as an MCP server with various AI tools:

| AI Tool | MCP Support | Status | Notes |
|---------|-------------|--------|-------|
| **Claude CLI** | ✅ Full Support | Working | User-level registration via `claude mcp add` |
| **Gemini CLI** | ✅ Full Support | Working | Requires `prompts/list` handler (implemented) |
| **Copilot CLI** | ❌ Limited | Not Working | MCP unstable in CLI mode, works in VS Code only |

## IDE Integration

### VS Code MCP Extension

Create `.vscode/mcp.json` in your project:

**Windows (recommended):**
```json
{
  "servers": {
    "crewx": {
      "command": "cmd.exe",
      "args": ["/c", "crewx", "mcp"],
      "env": {
        "CREWX_CONFIG": "${workspaceFolder}/crewx.yaml"
      }
    }
  }
}
```

**macOS/Linux:**
```json
{
  "servers": {
    "crewx": {
      "command": "npx",
      "args": ["-y", "crewx", "mcp"],
      "env": {
        "CREWX_CONFIG": "${workspaceFolder}/crewx.yaml"
      }
    }
  }
}
```

> **Note:** While `agents.yaml` is still supported, `crewx.yaml` is the preferred configuration filename.

> **Windows Note:** Use `cmd.exe` due to PowerShell execution policy restrictions.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crewx": {
      "command": "npx",
      "args": ["-y", "crewx", "mcp"],
      "env": {
        "CREWX_CONFIG": "/path/to/your/crewx.yaml"
      }
    }
  }
}
```

**Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### Cursor IDE

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "crewx": {
      "command": "npx",
      "args": ["-y", "crewx", "mcp"],
      "env": {
        "CREWX_CONFIG": "${workspaceFolder}/crewx.yaml"
      }
    }
  }
}
```

**Note:** Restart Cursor and enable the MCP server in Settings > Cursor Settings > MCP Servers.

### Other MCP Clients

- **Cline**: Supports MCP through VS Code MCP extension
- **Continue**: Supports MCP through VS Code MCP extension
- **Windsurf**: MCP support may vary - check their documentation

## Available MCP Tools

When using CrewX as an MCP server, these tools are available:

### Agent Management
1. **`crewx_listAgents`** - List all available specialist agents
2. **`crewx_queryAgent`** - Query an agent (read-only analysis)
3. **`crewx_executeAgent`** - Execute tasks through an agent (file operations)
4. **`crewx_queryAgentParallel`** - Query multiple agents in parallel
5. **`crewx_executeAgentParallel`** - Execute multiple tasks in parallel

### Task Monitoring
6. **`crewx_getTaskLogs`** - Retrieve task execution logs by task ID

### System Diagnostics
7. **`crewx_checkAIProviders`** - Check AI CLI tool availability


## Configuration

### Environment Variables

Set `CREWX_CONFIG` to specify your configuration file location:

```bash
# In MCP client configuration
"env": {
  "CREWX_CONFIG": "/path/to/crewx.yaml"
}
```

> **Note:** Both `crewx.yaml` (preferred) and `agents.yaml` (legacy) are supported.

### Agent Configuration

Create `crewx.yaml` (see [Agent Configuration Guide](agent-configuration.md)):

```yaml
agents:
  - id: "my_agent"
    name: "My Custom Agent"
    provider: "claude"
    working_directory: "./src"
    inline:
      type: "agent"
      system_prompt: |
        You are a helpful coding assistant.
```

## Setup Checklist

1. **Create `crewx.yaml`** in your project (or use legacy `agents.yaml`)
2. **Configure MCP client** (VS Code, Claude Desktop, etc.)
3. **Restart MCP client** to load the server
4. **Verify connection** by listing agents
5. **Test with a simple query**

## Troubleshooting

### Server Won't Start
- Ensure `crewx.yaml` (or `agents.yaml`) exists at the specified path
- Check that CrewX is installed (`npm install -g crewx`)
- Verify MCP client configuration syntax

### Tools Not Appearing
- Restart your MCP client after configuration changes
- Check MCP client logs for connection errors
- Verify `CREWX_CONFIG` environment variable is set correctly

### Agent Execution Fails
- Run `crewx doctor` to check AI CLI availability
- Verify agent configuration in `crewx.yaml`
- Check task logs with `crewx_getTaskLogs`

See [Troubleshooting Guide](troubleshooting.md) for more solutions.
