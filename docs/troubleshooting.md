# Troubleshooting Guide

Common issues and solutions for CrewX.

## Installation Issues

### Command Not Found

**Problem:** `crewx: command not found`

**Solution:**
```bash
# Install globally
npm install -g crewx

# Verify installation
crewx --version

# Check PATH
echo $PATH | grep npm
```

### Permission Errors (macOS/Linux)

**Problem:** Permission denied during installation

**Solution:**
```bash
# Use sudo (not recommended)
sudo npm install -g crewx

# Better: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then install
npm install -g crewx
```

## Windows-Specific Issues

### PowerShell Execution Policy

**Problem:** `'crewx' is not recognized as an internal or external command`

**Cause:** PowerShell execution policy restrictions prevent `npx` scripts.

**Solution 1 (Recommended): Use cmd.exe**

Update MCP configuration:
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

**Solution 2: Change execution policy (requires admin)**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Solution 3: Direct node execution**
```bash
# Install globally
npm install -g crewx

# Find installation path
npm root -g

# Update MCP config
{
  "servers": {
    "crewx": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\AppData\\Roaming\\npm\\node_modules\\crewx\\dist\\main.js", "mcp"]
    }
  }
}
```

## Configuration Issues

### Configuration File Not Found

**Problem:** `Error: crewx.yaml not found` (or `agents.yaml not found`)

**Solution:**
```bash
# Create crewx.yaml (preferred)
crewx init

# Verify file exists
ls crewx.yaml

# Check MCP config points to correct path
cat .vscode/mcp.json  # or Claude Desktop config
```

> **Note:** Both `crewx.yaml` (preferred) and `agents.yaml` (legacy) are supported.

### Invalid YAML Syntax

**Problem:** `Error: Invalid YAML syntax`

**Solution:**
```bash
# Run doctor to validate
crewx doctor

# Common YAML errors:
# - Incorrect indentation (use spaces, not tabs)
# - Missing quotes around special characters
# - Missing colons or dashes
```

**Valid YAML:**
```yaml
agents:
  - id: "my_agent"         # ✓ Correct indentation
    name: "My Agent"       # ✓ Quotes around strings
    provider: "cli/claude" # ✓ Proper namespace format
```

**Invalid YAML:**
```yaml
agents:
- id: my_agent         # ✗ No quotes (may break with special chars)
  name: My Agent       # ✗ No quotes
   provider: claude    # ✗ Wrong indentation, old format
```

## MCP Integration Issues

### MCP Server Won't Start

**Problem:** MCP server fails to start in VS Code/Claude Desktop

**Checklist:**
1. Verify `crewx.yaml` (or `agents.yaml`) exists at specified path
2. Check CrewX is installed: `crewx --version`
3. Validate MCP config syntax (valid JSON)
4. Check environment variable `CREWX_CONFIG` is set
5. Restart MCP client after config changes

**Debugging:**
```bash
# Test MCP server manually
crewx mcp

# Check for error messages
# Verify config file path is correct
cat $CREWX_CONFIG
```

### MCP Tools Not Appearing

**Problem:** CrewX tools don't show up in MCP client

**Solution:**
1. Restart MCP client (VS Code, Claude Desktop, etc.)
2. Check MCP client logs for connection errors
3. Verify `CREWX_CONFIG` environment variable
4. Test server manually: `crewx mcp`

**VS Code specific:**
```bash
# Check VS Code MCP logs
# View > Output > Select "MCP" from dropdown
```

## AI Provider Issues

### Provider Not Available

**Problem:** `Error: AI provider not available`

**Solution:**
```bash
# Check provider status
crewx doctor

# Verify CLI tools are installed
claude --version
gemini --version
gh copilot --version

# Install missing tools
npm install -g @anthropic/claude-code
npm install -g @google/generative-ai-cli
gh extension install github/gh-copilot
```

### Provider Authentication Failed

**Problem:** Authentication errors with AI providers

**Claude Code:**
```bash
# Re-authenticate
claude login

# Verify session
claude session
```

**Gemini CLI:**
```bash
# Set API key
export GOOGLE_API_KEY="your-api-key"

# Or configure
gemini config set apiKey YOUR_API_KEY
```

**Copilot CLI:**
```bash
# Re-authenticate
gh auth login

# Verify
gh auth status
```

### Session Limit Reached

**Problem:** `Error: Session limit reached`

**Solution:**
```bash
# Wait for session reset (usually 5 minutes)
# Or use a different provider

# Use provider fallback
crewx query "@flexible_agent your question"
# Where flexible_agent has: provider: ["cli/claude", "cli/gemini", "cli/copilot"]
```

## Execution Issues

### Agent Execution Fails

**Problem:** Agent tasks fail or timeout

**Diagnostics:**
```bash
# Run doctor
crewx doctor

# Check task logs
crewx logs <task-id>

# Verify agent configuration
cat crewx.yaml
```

**Common causes:**
1. Working directory doesn't exist
2. Incorrect provider options
3. Timeout too short for complex tasks
4. Provider session limit
5. **Cross-platform path issues** (hardcoded OS-specific paths)

**Solutions:**
```yaml
# Fix working directory
working_directory: "./src"  # Ensure path exists

# Adjust timeout
CODECREW_TIMEOUT_CLAUDE_EXECUTE=120000 crewx execute "@claude task"

# Use provider fallback
provider: ["cli/claude", "cli/gemini", "cli/copilot"]
```

### Cross-Platform Path Issues

**Problem:** Agent fails with `ENOENT` error on different operating systems

**Cause:** Hardcoded absolute paths in `crewx.yaml` that only work on specific OS

**Example error:**
```
ERROR: Process error: spawn C:\WINDOWS\system32\cmd.exe ENOENT
```

**Bad configuration (OS-specific):**
```yaml
agents:
  - id: "my_agent"
    working_directory: "/Users/username/project"  # ✗ macOS only
    # or
    working_directory: "C:\\Users\\username\\project"  # ✗ Windows only
```

**Good configuration (cross-platform):**
```yaml
agents:
  - id: "my_agent"
    # Option 1: Use relative path (recommended)
    working_directory: "."

    # Option 2: Omit working_directory (uses current directory)
    # working_directory not specified = current directory

    # Option 3: Use environment variable
    working_directory: "${PROJECT_ROOT}/src"
```

**Quick fix:**
1. Edit `crewx.yaml`
2. Change absolute paths to relative paths (`.`, `./src`, etc.)
3. Or remove `working_directory` entirely to use current directory
4. Test: `crewx query "@agent hello"`

**Debugging:**
```bash
# Check agent configuration
cat crewx.yaml | grep -A 3 "working_directory"

# Test agent
crewx query "@agent test query"

# Check logs for path errors
cat .crewx/logs/*.log | grep -i "enoent\|working"
```

### Timeout Errors

**Problem:** Tasks timeout before completion

**Solution:**
```bash
# Increase timeout via environment variables
export CODECREW_TIMEOUT_CLAUDE_QUERY=1800000  # 30 min
export CODECREW_TIMEOUT_GEMINI_EXECUTE=2400000  # 40 min

# Or inline
CODECREW_TIMEOUT_CLAUDE_QUERY=1800000 crewx query "@claude complex task"
```

**Available timeout variables:**
```bash
CODECREW_TIMEOUT_CLAUDE_QUERY=600000
CODECREW_TIMEOUT_CLAUDE_EXECUTE=45000
CODECREW_TIMEOUT_GEMINI_QUERY=600000
CODECREW_TIMEOUT_GEMINI_EXECUTE=1200000
CODECREW_TIMEOUT_COPILOT_QUERY=600000
CODECREW_TIMEOUT_COPILOT_EXECUTE=1200000
CODECREW_TIMEOUT_PARALLEL=300000
```

### Pipeline Failures

**Problem:** Piped commands fail or lose context

**Solution:**
```bash
# Ensure each stage completes successfully
crewx query "@claude design" && \
crewx execute "@gemini implement"

# Check pipeline output
crewx query "@claude design" | tee design.txt | \
crewx execute "@gemini implement"

# Use thread for context instead
crewx query "@claude design" --thread "project"
crewx execute "@gemini implement" --thread "project"
```

## Thread/Conversation Issues

### Thread Not Found

**Problem:** `Error: Thread not found`

**Solution:**
```bash
# Check existing threads
ls .crewx/conversations/

# Create new thread
crewx query "@claude start" --thread "new-thread"

# Thread names are case-sensitive
crewx query "@claude continue" --thread "auth-feature"  # Correct
crewx query "@claude continue" --thread "Auth-Feature"  # Different thread
```

### Context Not Preserved

**Problem:** Agent doesn't remember previous conversation

**Solution:**
```bash
# Ensure using same thread name
crewx query "@claude design" --thread "myproject"
crewx query "@claude refine" --thread "myproject"  # Same name

# Check thread file exists
cat .crewx/conversations/myproject.json

# Thread is agent-specific
crewx query "@claude talk" --thread "chat"     # Claude's thread
crewx query "@gemini talk" --thread "chat"     # Different (Gemini's thread)
```

## Slack Integration Issues

### Slack Bot Not Responding

**Problem:** Bot doesn't respond to messages

**Checklist:**
1. Verify environment variables in `.env.slack`
2. Check bot token permissions (chat:write, app_mentions:read, etc.)
3. Ensure bot is invited to channel
4. Check socket mode is enabled

**Solution:**
```bash
# Verify .env.slack
cat .env.slack

# Required variables:
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APP_TOKEN=xapp-...
# SLACK_SIGNING_SECRET=...

# Restart bot
npm run start:slack
```

### Slack Execute Mode Not Working

**Problem:** Agent execution commands fail in Slack

**Cause:** Missing `--mode execute` flag when starting Slack bot

**Solution:**
```bash
# Start Slack bot with execute mode enabled
npm run start:slack -- --mode execute

# Or using node directly
node dist/main.js slack --mode execute
```

**Why this happens:**
- Without `--mode execute`, Slack bot only handles query operations
- Execute commands (`@agent do something`) require explicit execute mode
- This is a security feature to prevent unauthorized code execution

**Verification:**
```bash
# Check if bot is running in execute mode
# Bot startup message should show: "Slack bot started in execute mode"
```

### Slack Message Too Large

**Problem:** `invalid_blocks` error

**Solution:**
```bash
# Reduce max response length
echo "SLACK_MAX_RESPONSE_LENGTH=200000" >> .env.slack

# Restart bot
npm run start:slack
```

## Performance Issues

### Slow Responses

**Problem:** Queries take too long to respond

**Optimization:**
```bash
# Use faster models
crewx query "@claude:haiku quick question"
crewx query "@gemini:gemini-2.5-flash fast task"

# Reduce context size
# In crewx.yaml, limit --add-dir scope
options:
  query:
    - "--add-dir=./src/specific-module"  # Instead of "."

# Use parallel execution
crewx query "@claude task1" "@gemini task2"  # Parallel
```

### High Memory Usage

**Problem:** CrewX consuming too much memory

**Solution:**
```bash
# Use lazy loading for documents
# In documents.yaml:
documents:
  large-doc:
    path: "docs/large.md"
    lazy: true  # Only load when needed

# Limit conversation history
# Delete old threads
rm .crewx/conversations/old-thread.json

# Clear old logs
crewx clear-logs
```

## Debugging

### Enable Debug Logging

```bash
# Set debug environment variable
export DEBUG=crewx:*

# Run with verbose output
crewx query "@claude test" --verbose

# Check logs
cat .crewx/logs/*.log
```

### Check System Status

```bash
# Comprehensive health check
crewx doctor

# Check provider availability
crewx query "@claude hello"
crewx query "@gemini hello"
crewx query "@copilot hello"

# Verify configuration
cat agents.yaml
```

### Get Task Logs

```bash
# View specific task
crewx logs <task-id>

# View all recent tasks
crewx logs

# Find task ID from previous output
# Look for: "Task ID: abc123"
```

## Getting Help

If issues persist:

1. **Run diagnostics:**
   ```bash
   crewx doctor
   ```

2. **Check logs:**
   ```bash
   ls .crewx/logs/
   cat .crewx/logs/latest.log
   ```

3. **Verify configuration:**
   ```bash
   cat crewx.yaml  # or agents.yaml
   crewx init --force  # Reset to defaults
   ```

4. **Test providers individually:**
   ```bash
   claude "hello"
   gemini -p "hello"
   gh copilot suggest "hello"
   ```

5. **Report issue:**
   - GitHub: https://github.com/sowonlabs/crewx/issues
   - Include: Error message, `crewx doctor` output, logs

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `crewx.yaml not found` | Missing configuration | Run `crewx init` |
| `Provider not available` | CLI tool not installed | Install provider CLI |
| `Session limit reached` | Too many requests | Wait or use different provider |
| `Timeout exceeded` | Task too complex | Increase timeout via env vars |
| `Invalid YAML syntax` | Malformed config | Run `crewx doctor` |
| `Thread not found` | Wrong thread name | Check `.crewx/conversations/` |
| `Permission denied` | File/directory access | Check working directory permissions |
