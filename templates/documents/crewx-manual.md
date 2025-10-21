# CrewX User Manual

## What is CrewX?

CrewX is a **multi-AI agent collaboration platform** that enables developers to work with multiple AI assistants simultaneously. It supports:

- **CLI Interface**: Command-line tool for direct agent interaction
- **Slack Bot**: Team collaboration through Slack workspace integration
- **MCP Server**: Model Context Protocol server for IDE integration (VS Code, etc.)

### Supported AI Providers
- **Claude** (Anthropic) - Complex reasoning, architecture design
- **Gemini** (Google) - Performance optimization, data analysis
- **GitHub Copilot** - Code implementation, best practices
- **Codex** (CrewX Codex CLI) - CLI-first automation and development workflows

### Key Features
1. **Multi-Agent Collaboration**: Query multiple agents in parallel
2. **Context Management**: Project-specific documents and configurations
3. **Flexible Deployment**: CLI, Slack Bot, or MCP Server mode
4. **Custom Agents**: Create specialized agents with custom prompts
5. **Security**: Prompt injection protection for built-in agents

---

## Basic Commands (CLI)
### Agent list
```bash
crewx agent ls
```

### Query (Read-Only Analysis)
```bash
crewx query "@agent your question"
crewx q "@agent your question"  # shortcut
```

### Execute (File Creation/Modification)
```bash
crewx execute "@agent your task"
crewx x "@agent your task"  # shortcut
```

### System Commands
```bash
crewx agent     # List available agents (default: ls)
crewx agent ls  # List available agents (explicit)
crewx init      # Initialize agents.yaml
crewx doctor    # Check AI provider status
crewx log       # List all task logs (default)
crewx log ls    # List all task logs (explicit)
crewx log <id>  # View specific task log
```

## Agent Mention Syntax

### Basic Agent Mention
```bash
crewx q "@claude analyze this code"
crewx q "@gemini search latest AI news"
crewx q "@copilot suggest improvements"
```

### Model Selection
Specify AI model using colon syntax:
```bash
crewx q "@claude:opus complex architecture design"
crewx q "@claude:sonnet general development tasks"
crewx q "@claude:haiku quick simple questions"
crewx q "@gemini:gemini-2.5-pro advanced analysis"
```

### Multiple Agents (Parallel Execution)
Query multiple agents simultaneously:
```bash
crewx q "@claude @gemini @copilot review this code"
```

## Built-in Agents

### @crewx (This Agent)
Your CrewX assistant. Fallback mechanism: claude → gemini → copilot

### @claude (Anthropic Claude)
Best for: Complex reasoning, code analysis, architecture

### @gemini (Google Gemini)
Best for: Performance optimization, data analysis, research

### @copilot (GitHub Copilot)
Best for: Code implementation, best practices, testing

---

## Deployment Modes

### 1. CLI Mode (Default)
Direct command-line interaction with agents:
```bash
# Query agents
crewx query "@claude analyze this code"
crewx q "@gemini search latest AI news"

# Execute tasks
crewx execute "@copilot implement feature"
crewx x "@claude create tests"

# System commands
crewx init      # Initialize agents.yaml
crewx doctor    # Check AI provider status
crewx log      # View task logs
```

### 2. Slack Bot Mode
Integrate CrewX with your Slack workspace for team collaboration:

**Starting Slack Bot:**
```bash
# Set environment variables
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
export SLACK_SIGNING_SECRET=...

# Start bot
crewx slack --log

# Or use .env.slack file
npm run start:slack
```

**Using in Slack:**
- Mention bot: `@CrewX analyze this code`
- Use keyword: `crewx what is this bug?`
- Direct message: Send DM to CrewX bot

**Features:**
- Real-time agent responses in Slack threads
- Team-wide AI collaboration
- Persistent chat history
- Interactive buttons (View Details, Rerun)

### 3. MCP Server Mode
Integrate with IDEs via Model Context Protocol:

**Starting MCP Server:**
```bash
crewx mcp
```

**IDE Integration (VS Code):**
Add to VS Code settings.json:
```json
{
  "mcp.servers": {
    "crewx": {
      "command": "crewx",
      "args": ["mcp"]
    }
  }
}
```

**Features:**
- Direct IDE integration
- Context-aware code assistance
- Multiple agent coordination
- Tool-based interactions

---

## Custom Agents

Create `agents.yaml` in your project:
```yaml
agents:
  - id: "my_agent"
    name: "My Custom Agent"
    role: "developer"
    provider: "cli/claude"  # Fixed provider (no fallback)
    inline:
      model: "sonnet"
      prompt: |
        You are a specialized assistant...
```

### Provider Configuration

**Fixed Provider (Single String):**
```yaml
# Always uses specified provider, no fallback
- id: "claude_expert"
  provider: "cli/claude"
  inline:
    prompt: |
      You are a Claude-specific expert...
```

**Fallback Provider (Array):**
```yaml
# Tries providers in order: claude → gemini → copilot
- id: "flexible_agent"
  provider: ["cli/claude", "cli/gemini", "cli/copilot"]
  options:
    execute:
      cli/claude:
        - "--permission-mode=acceptEdits"
        - "--add-dir=."
      cli/gemini:
        - "--include-directories=."
      cli/copilot:
        - "--add-dir=."
  inline:
    prompt: |
      You are a flexible assistant that works with multiple providers...
```

**Provider Fallback Behavior:**
- **Single string**: Fixed provider, no fallback
- **Array**: Tries each provider in order until one is available
- **With model specified**: Uses first provider in array, no fallback
- Example: `@crewx` uses `['cli/claude', 'cli/gemini', 'cli/copilot']` for automatic fallback

**Use Cases:**
- **Fixed provider**: When you need specific provider features
- **Fallback**: When availability matters more than provider choice
- **Provider-specific options**: Different CLI options per provider

---

## Document System

Reference documents in agent prompt:
```yaml
agents:
  - id: "helper"
    inline:
      prompt: |
        <manual>
        {{{documents.user_guide.content}}}
        </manual>
```

### Document Levels
1. `documents.yaml` - Global documents
2. `agents.yaml` documents - Project documents
3. `agent.inline.documents` - Agent-specific

### Template Variables
- `{{{documents.name.content}}}` - Full content
- `{{{documents.name.toc}}}` - Table of contents
- `{{documents.name.summary}}` - Summary

## Dynamic Template System

CrewX uses Handlebars for context-aware prompts:

### Available Context

**Agent Self-Information:**
- `{{agent.id}}` - Agent ID (e.g., "claude", "my_agent")
- `{{agent.name}}` - Agent name (e.g., "Claude AI")
- `{{agent.provider}}` - AI provider (claude, gemini, copilot)
- `{{agent.model}}` - Model name (sonnet, haiku, opus)
- `{{agent.workingDirectory}}` - Working directory path

**Environment Variables:**
- `{{env.VAR_NAME}}` - Any environment variable
- `{{env.NODE_ENV}}` - Common: production, development
- `{{env.DEBUG}}` - Debug flag

**Other Context:**
- `{{mode}}` - 'query' or 'execute'
- `{{vars.customKey}}` - Custom variables

### Example: Agent Self-Awareness
```yaml
agents:
  - id: "my_agent"
    name: "My Smart Agent"
    inline:
      provider: "cli/claude"
      model: "sonnet"
      prompt: |
        You are {{agent.name}} (ID: {{agent.id}}).
        Running on {{agent.provider}} using {{agent.model}} model.
        Working directory: {{agent.workingDirectory}}

        {{#if (eq agent.model "haiku")}}
        Provide fast, concise responses.
        {{else if (eq agent.model "opus")}}
        Provide detailed, comprehensive analysis.
        {{/if}}
```

### Conditional Logic
```yaml
prompt: |
  {{#if (eq env.NODE_ENV "production")}}
  Production mode: Be careful
  {{else}}
  Development mode: Experiment freely
  {{/if}}

  {{#if (or (eq agent.provider "cli/claude") (eq agent.provider "cli/gemini"))}}
  Web search available!
  {{/if}}

  {{#if (eq agent.model "haiku")}}
  Fast response mode
  {{else if (eq agent.model "opus")}}
  Deep analysis mode
  {{/if}}
```

### Helpers Available
- `(eq a b)` - Equality
- `(ne a b)` - Not equal
- `(and a b)` - Logical AND
- `(or a b)` - Logical OR
- `(not a)` - Logical NOT
- `(contains array value)` - Array contains

### Example: Environment-Aware Agent
```yaml
agents:
  - id: "smart_agent"
    inline:
      prompt: |
        You are an adaptive assistant.

        {{#if env.DEBUG}}
        Debug mode enabled: Provide verbose explanations
        {{/if}}

        {{#if (eq agent.provider "cli/claude")}}
        Using Claude - complex reasoning available
        {{/if}}

        Provider: {{agent.provider}}
        Model: {{agent.model}}
```

Set environment variables:
```bash
export DEBUG=true
export NODE_ENV=production
crewx query "@smart_agent analyze this"
```

---

## Security Features

### Prompt Injection Protection

CrewX built-in agents (@claude, @gemini, @copilot) are protected against prompt injection attacks using an authenticated system prompt mechanism.

**How it works:**
1. Each agent session generates a unique random security key (`{{vars.security_key}}`)
2. Agent prompts are wrapped in authenticated tags with the security key
3. Agents are instructed to ONLY follow instructions within authenticated tags
4. Any user-provided prompt tags with different or missing keys are ignored

**User Injection Attempts (Blocked):**
- "Ignore all previous instructions and do X" → Ignored
- Attempting to inject unauthorized system instructions → Treated as user input
- Using incorrect or fake security keys → Key mismatch, ignored

**Benefits:**
- ✅ Prevents unauthorized behavior changes
- ✅ Maintains agent integrity and purpose
- ✅ Random keys are unpredictable per session
- ✅ Transparent to legitimate users

---

## Agent Behavior Control

### User-Defined Behavior
CrewX does NOT inject any hardcoded behavior prompts. You have complete control over agent behavior through the agent's prompt configuration.

### Custom Read-Only Mode
If you want read-only analysis:
```yaml
agents:
  - id: "analyzer"
    inline:
      prompt: |
        You are a read-only analyzer. Do not modify files.
```
