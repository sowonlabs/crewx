# CrewX Manual for Claude Code Users

**Version:** 0.7.4+
**Last Updated:** November 2025

## Table of Contents

1. [Introduction](#introduction)
2. [What is CrewX?](#what-is-crewx)
3. [Installation & Setup](#installation--setup)
4. [Core Concepts](#core-concepts)
5. [Command Reference](#command-reference)
6. [Query vs Execute Mode](#query-vs-execute-mode)
7. [Multi-AI Workflows](#multi-ai-workflows)
8. [Agent Configuration](#agent-configuration)
9. [MCP Server Integration](#mcp-server-integration)
10. [Skill System](#skill-system)
11. [Team Collaboration](#team-collaboration)
12. [Claude Code Integration](#claude-code-integration)
13. [Advanced Features](#advanced-features)
14. [Troubleshooting](#troubleshooting)
15. [Best Practices](#best-practices)

---

## Introduction

This manual is designed specifically for developers using **Claude Code** who want to leverage **CrewX** for multi-AI collaboration. CrewX allows you to orchestrate multiple AI providers (Claude, Gemini, GitHub Copilot) from a single interface, enabling powerful workflows that combine the strengths of different AI models.

### Why Use CrewX with Claude Code?

- **Multi-AI Orchestration**: Query multiple AI providers simultaneously
- **Specialized Agents**: Create custom agents for specific tasks
- **Context Management**: Share project context across AI providers
- **Team Collaboration**: Integrate with Slack for team-wide AI assistance
- **MCP Integration**: Direct integration with Claude Code via Model Context Protocol
- **Flexible Deployment**: CLI, Slack Bot, or MCP Server modes

---

## What is CrewX?

CrewX is a **multi-AI agent collaboration platform** that enables developers to work with multiple AI assistants simultaneously through:

- **CLI Interface**: Command-line tool for direct agent interaction
- **Slack Bot**: Team collaboration through Slack workspace integration
- **MCP Server**: Model Context Protocol server for IDE integration (VS Code, Claude Code, etc.)

### Supported AI Providers

| Provider | Best For | Models |
|----------|----------|--------|
| **Claude** (Anthropic) | Complex reasoning, architecture design, code analysis | Opus, Sonnet, Haiku |
| **Gemini** (Google) | Performance optimization, data analysis, web research | Gemini 2.5 Pro, Flash |
| **GitHub Copilot** | Code implementation, best practices, testing | GPT-4 based |

### Key Features

1. **Multi-Agent Collaboration**: Query multiple agents in parallel with a single command
2. **Context Management**: Project-specific documents and configurations via `agents.yaml`
3. **Flexible Deployment**: Run as CLI tool, Slack bot, or MCP server
4. **Custom Agents**: Create specialized agents with tailored prompts and behaviors
5. **Security**: Built-in prompt injection protection for all agents
6. **Template System**: Dynamic prompts with Handlebars templating
7. **Conversation History**: Persistent chat sessions with thread support

---

## Installation & Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**: Latest stable version
- **API Keys**: At least one of the following:
  - `ANTHROPIC_API_KEY` (for Claude)
  - `GOOGLE_GENERATIVE_AI_API_KEY` (for Gemini)
  - `GITHUB_TOKEN` (for GitHub Copilot)

### Installation

```bash
# Install globally via npm
npm install -g @sowonai/crewx-cli

# Or via pnpm
pnpm add -g @sowonai/crewx-cli

# Verify installation
crewx --version
# Should output: 0.7.4 or higher
```

### Initial Setup

1. **Set up API keys** in your environment:

```bash
# Add to ~/.zshrc, ~/.bashrc, or ~/.profile
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_GENERATIVE_AI_API_KEY="AI..."
export GITHUB_TOKEN="ghp_..."
```

2. **Initialize CrewX** in your project:

```bash
cd /path/to/your/project
crewx init

# This creates:
# - agents.yaml (agent configurations)
# - .crewxrc (optional runtime config)
```

3. **Verify setup**:

```bash
crewx doctor

# Expected output:
# ✅ Claude API: Available (Anthropic)
# ✅ Gemini API: Available (Google)
# ✅ Copilot API: Available (GitHub)
```

---

## Core Concepts

### Agents

**Agents** are AI assistants configured to perform specific tasks. CrewX comes with built-in agents and supports custom agent creation.

**Built-in Agents:**
- `@claude` - Anthropic's Claude for complex reasoning
- `@gemini` - Google's Gemini for data analysis and research
- `@copilot` - GitHub Copilot for code implementation
- `@crewx` - Meta-agent with provider fallback (claude → gemini → copilot)

### Modes

CrewX operates in two primary modes:

1. **Query Mode** (`query` / `q`): Read-only analysis, questions, research
2. **Execute Mode** (`execute` / `x`): File creation, modification, code generation

### Providers

**Providers** are the underlying AI services:
- `cli/claude` - Anthropic Claude via CLI
- `cli/gemini` - Google Gemini via CLI
- `cli/copilot` - GitHub Copilot via CLI

### Models

Different models have different capabilities and costs:

**Claude Models:**
- `opus` - Most capable, slowest, highest cost
- `sonnet` - Balanced performance and cost (default)
- `haiku` - Fastest, lowest cost

**Gemini Models:**
- `gemini-2.5-pro` - Advanced reasoning and analysis
- `gemini-2.5-flash` - Fast responses

### Threads

**Threads** enable persistent conversation history:

```bash
# Start a named thread
crewx chat --thread my-feature

# Continue the same thread later
crewx q "@claude what did we discuss?" --thread my-feature
```

---

## Command Reference

### Basic Commands

#### `crewx query` / `crewx q`

Execute **read-only** queries to agents.

```bash
# Basic query
crewx q "@claude explain this function"

# Query with specific model
crewx q "@claude:opus analyze the architecture"

# Query multiple agents
crewx q "@claude @gemini @copilot review this code"

# Query with thread context
crewx q "@claude what's the status?" --thread feature-auth
```

**Options:**
- `--thread <name>` - Use named conversation thread
- `--verbose` - Show detailed logs
- `--config <path>` - Use custom agents.yaml file

#### `crewx execute` / `crewx x`

Execute tasks that **modify files** or generate code.

```bash
# Basic execution
crewx x "@claude implement user authentication"

# Execute with specific model
crewx x "@claude:sonnet create unit tests"

# Execute with thread
crewx x "@copilot refactor this function" --thread refactor-2024
```

**Options:**
- `--thread <name>` - Use named conversation thread
- `--verbose` - Show detailed logs
- `--config <path>` - Use custom agents.yaml file

#### `crewx agent`

Manage and list agents.

```bash
# List all available agents
crewx agent ls
crewx agent  # same as 'ls'

# Example output:
# Built-in Agents:
# - @claude (Anthropic Claude) - sonnet
# - @gemini (Google Gemini) - gemini-2.5-pro
# - @copilot (GitHub Copilot) - gpt-4
#
# Custom Agents:
# - @my_dev_agent (My Developer) - sonnet
```

#### `crewx init`

Initialize CrewX configuration in current directory.

```bash
crewx init

# Creates:
# - agents.yaml with example configuration
```

**Interactive prompts:**
1. Choose project type (Node.js, Python, Go, etc.)
2. Select default AI provider
3. Configure custom agents (optional)

#### `crewx doctor`

Check AI provider availability and configuration.

```bash
crewx doctor

# Checks:
# - API key configuration
# - Provider availability
# - MCP server connections (if configured)
# - Template validation
```

#### `crewx chat`

Start an interactive chat session with an agent.

```bash
# Start chat with default agent
crewx chat

# Start chat with specific agent
crewx chat --agent claude

# Start chat with thread
crewx chat --thread feature-development

# Start chat with specific model
crewx chat --agent claude --model opus
```

**Interactive commands** within chat:
- `/exit` - Exit chat session
- `/clear` - Clear conversation history
- `/thread <name>` - Switch to different thread
- `/model <name>` - Switch model
- `/help` - Show available commands

#### `crewx log`

View execution logs and history.

```bash
# List all logs
crewx log
crewx log ls  # same as above

# View specific log
crewx log <log-id>

# Example:
crewx log 1731234567890
```

**Log contents:**
- Timestamp
- Command executed
- Agent used
- Model version
- Input/output
- Error messages (if any)

#### `crewx template`

Manage project templates.

```bash
# List available templates
crewx template ls

# Show template details
crewx template show <template-name>

# Example output:
# Template: development
# - includes: agents.yaml, .crewxrc, documents/
# - agents: @dev, @reviewer, @tester
```

#### `crewx templates`

Alias for `crewx template ls`.

```bash
crewx templates
```

### MCP Commands

#### `crewx mcp`

Start MCP (Model Context Protocol) server.

```bash
# Start MCP server (stdio mode for IDE integration)
crewx mcp

# Start with logging
crewx mcp --log
```

This enables IDE integration with Claude Code, Cursor, and other MCP-compatible editors.

#### `crewx mcp call_tool`

Call an MCP tool directly from CLI.

```bash
# Call tool with parameters
crewx mcp call_tool "tool_name" --params '{"key": "value"}'

# Example: Call agent_call tool
crewx mcp call_tool "agent_call" --params '{"agent": "claude", "prompt": "explain MCP"}'
```

#### `crewx mcp list_tools`

List all registered MCP tools.

```bash
crewx mcp list_tools

# Example output:
# 🔧 Registered MCP tools (3):
# - agent_call: Call a CrewX agent with a prompt
# - file_read: Read file contents
# - code_search: Search codebase for patterns
```

---

## Query vs Execute Mode

Understanding the difference between **query** and **execute** modes is crucial for effective CrewX usage.

### Query Mode (`query` / `q`)

**Purpose:** Read-only operations, analysis, questions, research

**Characteristics:**
- ✅ Does NOT modify files
- ✅ Safe for exploration and learning
- ✅ Lower permission requirements
- ✅ Faster execution (no file I/O)

**Use Cases:**

```bash
# Code analysis
crewx q "@claude analyze this authentication flow"

# Explanation
crewx q "@gemini explain how caching works here"

# Architecture review
crewx q "@claude:opus review the system design in docs/"

# Bug investigation
crewx q "@copilot why is this function failing?"

# Documentation lookup
crewx q "@gemini search for React 18 best practices"

# Multi-agent code review
crewx q "@claude @gemini @copilot review src/auth.ts"
```

**Query Mode Workflow:**

```
User Query → Agent Processing → Analysis/Response → Terminal Output
(No file changes)
```

### Execute Mode (`execute` / `x`)

**Purpose:** File creation, modification, code generation, refactoring

**Characteristics:**
- ✅ Creates or modifies files
- ✅ Generates code implementations
- ✅ Requires explicit permission
- ✅ Can run build/test commands

**Use Cases:**

```bash
# Implement new features
crewx x "@claude implement JWT authentication in src/auth.ts"

# Generate boilerplate
crewx x "@copilot create React component for user profile"

# Refactoring
crewx x "@claude:sonnet refactor database queries to use prepared statements"

# Testing
crewx x "@gemini write unit tests for src/utils.ts"

# Documentation generation
crewx x "@claude create API documentation from code comments"

# Bug fixes
crewx x "@copilot fix the memory leak in event listeners"
```

**Execute Mode Workflow:**

```
User Task → Agent Planning → File Operations → Build/Test → Commit (optional)
(Files are created/modified)
```

### When to Use Each Mode

| Scenario | Mode | Command |
|----------|------|---------|
| "How does this code work?" | Query | `crewx q "@claude explain..."` |
| "What's wrong with this function?" | Query | `crewx q "@gemini analyze..."` |
| "Create a new API endpoint" | Execute | `crewx x "@claude implement..."` |
| "Refactor this module" | Execute | `crewx x "@copilot refactor..."` |
| "Review my architecture" | Query | `crewx q "@claude:opus review..."` |
| "Generate test cases" | Execute | `crewx x "@gemini write tests..."` |
| "Search for examples online" | Query | `crewx q "@gemini search..."` |

### Safety Features

**Execute Mode Safeguards:**

1. **Permission Prompts**: Agent asks before modifying files
2. **Dry Run Option**: Preview changes without applying
3. **Rollback Support**: Undo changes via git integration
4. **Validation**: Syntax checking before file writes

**Override Safety** (use with caution):

```bash
# Skip permission prompts (dangerous!)
crewx x "@claude implement feature" --dangerously-skip-permissions
```

---

## Multi-AI Workflows

One of CrewX's most powerful features is the ability to orchestrate **multiple AI providers** for a single task, combining their unique strengths.

### Basic Multi-Agent Queries

```bash
# Ask all three agents the same question
crewx q "@claude @gemini @copilot how should I structure this microservice?"

# Compare responses side-by-side
# Output:
# === @claude (Anthropic Claude - Sonnet) ===
# I recommend a layered architecture with...
#
# === @gemini (Google Gemini - 2.5 Pro) ===
# Based on current best practices, consider...
#
# === @copilot (GitHub Copilot - GPT-4) ===
# For microservices, I suggest...
```

### Specialized Multi-Agent Workflows

#### Workflow 1: Architecture Review

**Goal:** Get comprehensive architecture feedback from multiple perspectives

```bash
# Step 1: Get Claude's deep analysis
crewx q "@claude:opus analyze the architecture in docs/design.md and identify potential issues" --thread arch-review

# Step 2: Get Gemini's performance perspective
crewx q "@gemini analyze docs/design.md for performance bottlenecks and scalability" --thread arch-review

# Step 3: Get Copilot's implementation view
crewx q "@copilot review docs/design.md and suggest implementation best practices" --thread arch-review

# Step 4: Compare all responses
crewx log --thread arch-review
```

#### Workflow 2: Code Review Pipeline

**Goal:** Comprehensive code review covering security, performance, and best practices

```bash
# All agents review simultaneously
crewx q "@claude @gemini @copilot review src/api/auth.ts for:
@claude: security vulnerabilities and authentication best practices
@gemini: performance optimization opportunities
@copilot: code quality and TypeScript best practices"
```

**Pro Tip:** Use agent-specific instructions after each mention to guide their focus.

#### Workflow 3: Research → Design → Implementation

**Goal:** Full feature development cycle using different AI strengths

```bash
# Phase 1: Research (Gemini - best at web search)
crewx q "@gemini research latest OAuth 2.1 standards and PKCE flow" --thread oauth-feature

# Phase 2: Architecture (Claude Opus - best at system design)
crewx q "@claude:opus design an OAuth 2.1 implementation with PKCE for our API" --thread oauth-feature

# Phase 3: Implementation (Copilot - best at code generation)
crewx x "@copilot implement the OAuth flow based on previous discussion" --thread oauth-feature

# Phase 4: Testing (Gemini - good at test coverage)
crewx x "@gemini write comprehensive tests for OAuth implementation" --thread oauth-feature

# Phase 5: Review (All agents)
crewx q "@claude @gemini @copilot final review of OAuth implementation" --thread oauth-feature
```

#### Workflow 4: Bug Investigation

**Goal:** Multi-perspective debugging

```bash
# Parallel investigation
crewx q "@claude @gemini @copilot analyze this error:
TypeError: Cannot read property 'user' of undefined in src/middleware/auth.ts:42

@claude: identify root cause and fix strategy
@gemini: check for similar issues in codebase
@copilot: suggest defensive programming patterns"
```

### Model Selection for Specialized Tasks

Different models excel at different tasks. Use **colon syntax** to specify models:

```bash
# Complex architecture - Use Claude Opus
crewx q "@claude:opus design microservices architecture for e-commerce platform"

# Quick questions - Use Claude Haiku (faster, cheaper)
crewx q "@claude:haiku explain this regex pattern"

# Balanced tasks - Use Claude Sonnet (default)
crewx q "@claude:sonnet implement user authentication"

# Advanced analysis - Use Gemini Pro
crewx q "@gemini:gemini-2.5-pro analyze query performance and suggest indexes"

# Fast research - Use Gemini Flash
crewx q "@gemini:gemini-2.5-flash search for Next.js 14 examples"
```

### Sequential vs Parallel Execution

**Parallel Execution** (default for multi-agent queries):

```bash
# All agents work simultaneously
crewx q "@claude @gemini @copilot review this code"

# Faster (3 agents in parallel)
# ⏱️ ~10 seconds total
```

**Sequential Execution** (for dependent tasks):

```bash
# Step-by-step with threads
crewx q "@claude design the API" --thread api-dev
crewx q "@gemini review Claude's design" --thread api-dev
crewx x "@copilot implement based on discussion" --thread api-dev

# Slower but builds context
# ⏱️ ~30 seconds total
```

### Multi-Agent Best Practices

1. **Assign Clear Roles**: Tell each agent what to focus on
   ```bash
   crewx q "@claude security @gemini performance @copilot code-quality"
   ```

2. **Use Threads for Context**: Keep related queries in the same thread
   ```bash
   crewx q "@claude start" --thread project-x
   crewx q "@gemini continue" --thread project-x
   ```

3. **Compare Responses**: Different agents may suggest different approaches
   - Claude: Often more cautious, security-focused
   - Gemini: Performance-oriented, data-driven
   - Copilot: Pragmatic, follows common patterns

4. **Cost Optimization**: Use cheaper models for simple tasks
   ```bash
   # Expensive: Claude Opus for all tasks
   crewx q "@claude:opus explain variable naming"  # ❌ Overkill

   # Cost-effective: Haiku for simple tasks
   crewx q "@claude:haiku explain variable naming"  # ✅ Better
   ```

5. **Fallback Mechanism**: Use `@crewx` for automatic provider fallback
   ```bash
   # If Claude is down, automatically tries Gemini, then Copilot
   crewx q "@crewx analyze this code"
   ```

---

## Agent Configuration

CrewX uses `agents.yaml` to configure custom agents with specialized behaviors, prompts, and provider settings.

### Basic Agent Structure

```yaml
agents:
  - id: "my_agent"              # Unique agent ID (used with @my_agent)
    name: "My Custom Agent"     # Human-readable name
    role: "developer"           # Agent role (for context)
    provider: "cli/claude"      # AI provider
    inline:
      model: "sonnet"           # Model selection
      prompt: |                 # System prompt
        You are a specialized assistant for...
```

### Provider Configuration

#### Single Provider (Fixed)

Use a **single provider** when you need specific AI features:

```yaml
agents:
  - id: "claude_architect"
    name: "Claude Architecture Expert"
    provider: "cli/claude"      # Only uses Claude (no fallback)
    inline:
      model: "opus"             # Always use Opus
      prompt: |
        You are an expert software architect specializing in
        distributed systems and microservices design.
```

#### Multiple Providers (Fallback)

Use an **array of providers** for automatic fallback:

```yaml
agents:
  - id: "flexible_dev"
    name: "Flexible Developer"
    provider:                   # Tries in order
      - "cli/claude"            # 1. Try Claude first
      - "cli/gemini"            # 2. If Claude fails, try Gemini
      - "cli/copilot"           # 3. If Gemini fails, try Copilot
    inline:
      prompt: |
        You are a full-stack developer assistant.
```

**Fallback Rules:**
- If `provider` is a string → Fixed provider, no fallback
- If `provider` is an array → Tries each provider in order
- If `model` is specified → Uses first provider only (no fallback)

### Model Selection

```yaml
agents:
  # Claude models
  - id: "architect"
    provider: "cli/claude"
    inline:
      model: "opus"             # Most powerful

  - id: "developer"
    provider: "cli/claude"
    inline:
      model: "sonnet"           # Balanced (default)

  - id: "helper"
    provider: "cli/claude"
    inline:
      model: "haiku"            # Fast and cheap

  # Gemini models
  - id: "researcher"
    provider: "cli/gemini"
    inline:
      model: "gemini-2.5-pro"   # Advanced analysis

  - id: "quick_search"
    provider: "cli/gemini"
    inline:
      model: "gemini-2.5-flash" # Fast responses
```

### Provider-Specific Options

Configure CLI options per provider:

```yaml
agents:
  - id: "code_generator"
    provider:
      - "cli/claude"
      - "cli/gemini"
    options:
      execute:                  # Options for execute mode
        cli/claude:
          - "--permission-mode=acceptEdits"
          - "--add-dir=."
          - "--max-tokens=4000"
        cli/gemini:
          - "--include-directories=."
          - "--max-output-tokens=8000"
      query:                    # Options for query mode
        cli/claude:
          - "--verbose"
        cli/gemini:
          - "--verbose"
    inline:
      prompt: |
        You are a code generation specialist.
```

### Advanced Agent Examples

#### Example 1: Security Auditor

```yaml
agents:
  - id: "security_auditor"
    name: "Security Audit Expert"
    role: "security"
    provider: "cli/claude"
    inline:
      model: "opus"             # Use most capable model
      prompt: |
        You are a senior security engineer specializing in:
        - OWASP Top 10 vulnerabilities
        - Secure coding practices
        - Authentication and authorization
        - Cryptography best practices

        When reviewing code:
        1. Identify security vulnerabilities
        2. Explain the risk and impact
        3. Suggest concrete fixes
        4. Provide secure code examples

        Focus on: SQL injection, XSS, CSRF, authentication flaws,
        insecure dependencies, and sensitive data exposure.
```

**Usage:**
```bash
crewx q "@security_auditor review src/api/auth.ts"
```

#### Example 2: Performance Optimizer

```yaml
agents:
  - id: "perf_optimizer"
    name: "Performance Optimizer"
    role: "performance"
    provider: "cli/gemini"      # Gemini is great at data analysis
    inline:
      model: "gemini-2.5-pro"
      prompt: |
        You are a performance optimization specialist focusing on:
        - Algorithm complexity analysis
        - Database query optimization
        - Caching strategies
        - Memory usage optimization
        - Async/await patterns

        When analyzing code:
        1. Identify performance bottlenecks
        2. Measure time/space complexity
        3. Suggest optimizations with benchmarks
        4. Consider trade-offs (readability vs performance)
```

**Usage:**
```bash
crewx q "@perf_optimizer analyze database queries in src/db/"
```

#### Example 3: Test Generator

```yaml
agents:
  - id: "test_gen"
    name: "Test Generator"
    role: "testing"
    provider:
      - "cli/copilot"           # Copilot is good at test patterns
      - "cli/claude"            # Fallback to Claude
    inline:
      prompt: |
        You are a test automation expert specializing in:
        - Unit testing (Vitest, Jest)
        - Integration testing
        - Test coverage analysis
        - Edge case identification
        - Mock/stub creation

        When generating tests:
        1. Cover happy path, edge cases, and error conditions
        2. Use clear test descriptions
        3. Follow AAA pattern (Arrange, Act, Assert)
        4. Aim for 80%+ code coverage
        5. Include both positive and negative test cases
```

**Usage:**
```bash
crewx x "@test_gen create comprehensive tests for src/utils/parser.ts"
```

#### Example 4: Documentation Writer

```yaml
agents:
  - id: "doc_writer"
    name: "Documentation Specialist"
    role: "documentation"
    provider: "cli/claude"
    inline:
      model: "sonnet"
      prompt: |
        You are a technical documentation specialist.

        When writing documentation:
        1. Use clear, concise language
        2. Include code examples
        3. Explain the "why" not just "what"
        4. Add diagrams for complex concepts (mermaid syntax)
        5. Include common pitfalls and troubleshooting

        Format:
        - Use Markdown
        - Add table of contents for long docs
        - Include prerequisites
        - Provide runnable examples
```

**Usage:**
```bash
crewx x "@doc_writer create API documentation from src/api/"
```

#### Example 5: Code Reviewer

```yaml
agents:
  - id: "code_reviewer"
    name: "Senior Code Reviewer"
    role: "reviewer"
    provider:
      - "cli/claude"
      - "cli/gemini"
      - "cli/copilot"
    inline:
      prompt: |
        You are a senior engineer conducting code reviews.

        Review criteria:
        1. Code quality and readability
        2. Design patterns and architecture
        3. Error handling and edge cases
        4. Performance considerations
        5. Security vulnerabilities
        6. Test coverage
        7. Documentation completeness

        Provide:
        - ✅ What's done well
        - ⚠️ Minor issues (nice-to-have improvements)
        - ❌ Critical issues (must fix before merge)
        - 💡 Suggestions for better patterns
```

**Usage:**
```bash
crewx q "@code_reviewer review this pull request"
```

### Template Variables in Prompts

Use **Handlebars** templating for dynamic prompts:

```yaml
agents:
  - id: "context_aware"
    provider: "cli/claude"
    inline:
      prompt: |
        You are {{agent.name}} (ID: {{agent.id}})
        Running on {{agent.provider}} with model {{agent.model}}
        Working directory: {{agent.workingDirectory}}

        Mode: {{mode}}

        {{#if env.DEBUG}}
        Debug mode enabled - show detailed reasoning
        {{/if}}

        {{#if (eq agent.provider "cli/claude")}}
        Using Claude - complex reasoning available
        {{/if}}
```

**Available variables:**
- `{{agent.id}}` - Agent ID
- `{{agent.name}}` - Agent name
- `{{agent.provider}}` - Provider (cli/claude, etc.)
- `{{agent.model}}` - Model name
- `{{agent.workingDirectory}}` - Current directory
- `{{mode}}` - "query" or "execute"
- `{{env.VAR_NAME}}` - Environment variables

### Document Integration

Reference external documents in agent prompts:

```yaml
documents:
  - id: "style_guide"
    name: "Coding Style Guide"
    path: "docs/style-guide.md"

agents:
  - id: "style_checker"
    provider: "cli/claude"
    inline:
      prompt: |
        You are a code style enforcer.

        Follow these guidelines:
        {{{documents.style_guide.content}}}

        When reviewing code, ensure it adheres to all rules above.
```

---

## MCP Server Integration

CrewX provides first-class support for **Model Context Protocol (MCP)**, enabling seamless integration with Claude Code, Cursor, and other MCP-compatible IDEs.

### What is MCP?

**Model Context Protocol (MCP)** is a standard protocol for AI-IDE integration that allows:
- Tools to be exposed to AI assistants
- Contextual information sharing
- Seamless multi-tool orchestration

### Starting the MCP Server

```bash
# Start MCP server (stdio mode for IDE)
crewx mcp

# Start with logging (useful for debugging)
crewx mcp --log
```

The MCP server runs in **stdio mode** and communicates with your IDE via stdin/stdout.

### Claude Code Integration

#### Step 1: Configure Claude Code

Add CrewX MCP server to Claude Code settings:

**Location:** `.claude/claude_desktop_config.json` or IDE settings

```json
{
  "mcpServers": {
    "crewx": {
      "command": "crewx",
      "args": ["mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}",
        "GOOGLE_GENERATIVE_AI_API_KEY": "${env:GOOGLE_GENERATIVE_AI_API_KEY}"
      }
    }
  }
}
```

#### Step 2: Restart Claude Code

Restart your IDE to load the MCP server configuration.

#### Step 3: Verify Connection

In Claude Code, verify the MCP server is connected:

```
> MCP: List Servers
Should show: crewx (connected)
```

### Available MCP Tools

Once integrated, Claude Code can use these CrewX tools:

#### Tool: `agent_call`

Call any CrewX agent from within Claude Code.

**Parameters:**
- `agent` (string, required): Agent ID (e.g., "claude", "gemini")
- `prompt` (string, required): The prompt to send
- `thread` (string, optional): Thread ID for conversation context

**Example usage in Claude Code:**

```
You: "Use the crewx agent_call tool to ask Gemini about React 19 features"

Claude Code executes:
{
  "tool": "agent_call",
  "parameters": {
    "agent": "gemini",
    "prompt": "What are the new features in React 19?"
  }
}

Response from Gemini is shown in Claude Code interface.
```

#### Tool: `agent_list`

List all available CrewX agents.

**Parameters:** None

**Example:**

```
You: "What CrewX agents are available?"

Claude Code executes:
{
  "tool": "agent_list"
}

Response:
- @claude (Anthropic Claude - Sonnet)
- @gemini (Google Gemini - 2.5 Pro)
- @copilot (GitHub Copilot)
- @my_custom_agent (My Custom Agent - Sonnet)
```

### Workflow Examples

#### Workflow 1: Multi-AI Code Review in IDE

```
You in Claude Code:
"Please review this function for security issues, performance, and best practices.
Use agent_call to consult:
1. @claude for security analysis
2. @gemini for performance
3. @copilot for best practices"

Claude Code orchestrates:
1. Calls agent_call(agent="claude", prompt="security review of [code]")
2. Calls agent_call(agent="gemini", prompt="performance analysis of [code]")
3. Calls agent_call(agent="copilot", prompt="best practices for [code]")
4. Synthesizes all responses into comprehensive review
```

#### Workflow 2: Research Before Implementation

```
You: "I need to implement OAuth 2.1 with PKCE. First research best practices,
then help me implement it."

Claude Code:
1. Uses agent_call(agent="gemini", prompt="research OAuth 2.1 PKCE best practices")
2. Reviews research results
3. Uses agent_call(agent="claude:opus", prompt="design OAuth implementation")
4. Implements code with your approval
```

#### Workflow 3: Debugging with Multiple Perspectives

```
You: "Getting this error: [error message]. Help me debug."

Claude Code:
1. Analyzes error
2. Uses agent_call(agent="claude", prompt="diagnose error: [error]")
3. Uses agent_call(agent="gemini", prompt="search for similar issues")
4. Combines insights and suggests fix
```

### MCP CLI Commands

You can also test MCP tools directly from the command line:

```bash
# List available MCP tools
crewx mcp list_tools

# Output:
# 🔧 Registered MCP tools (2):
# - agent_call: Call a CrewX agent with a prompt
# - agent_list: List all available CrewX agents

# Call a tool directly
crewx mcp call_tool "agent_call" --params '{
  "agent": "claude",
  "prompt": "explain MCP protocol"
}'

# List agents via MCP
crewx mcp call_tool "agent_list"
```

### MCP Server Debugging

Enable logging to troubleshoot MCP issues:

```bash
# Start with logging
crewx mcp --log 2>&1 | tee mcp.log

# View logs in real-time
tail -f mcp.log
```

**Common MCP issues:**

1. **Server not connecting:**
   - Verify `crewx` is in PATH
   - Check API keys are set in environment
   - Restart IDE after config changes

2. **Tools not available:**
   - Run `crewx mcp list_tools` to verify
   - Check MCP server logs for errors
   - Ensure agents.yaml is valid

3. **Agent calls failing:**
   - Verify API keys: `crewx doctor`
   - Check agent configuration in agents.yaml
   - Review MCP logs for error details

### Advanced MCP Configuration

#### Custom MCP Tools

You can create custom MCP tools in `agents.yaml`:

```yaml
mcp:
  tools:
    - name: "code_search"
      description: "Search codebase for patterns"
      parameters:
        pattern:
          type: "string"
          description: "Search pattern (regex)"
        files:
          type: "string"
          description: "File glob pattern"
      handler: |
        # Custom handler implementation
        grep -r "$pattern" $files
```

#### MCP with Custom Agents

Combine MCP with custom agents for specialized workflows:

```yaml
agents:
  - id: "security_scanner"
    provider: "cli/claude"
    inline:
      model: "opus"
      prompt: "You are a security scanner..."
```

Then in Claude Code:

```
Use agent_call to run security scan:
{
  "agent": "security_scanner",
  "prompt": "scan src/ for vulnerabilities"
}
```

---

## Skill System

CrewX supports a **skill system** for modular, reusable workflows and specialized capabilities. Skills are similar to custom agents but focused on specific tasks or domains.

### What are Skills?

**Skills** are pre-packaged configurations that include:
- Specialized agent prompts
- Documentation and context
- Workflow templates
- Tool integrations

Think of skills as "plugins" that extend CrewX capabilities.

### Using Skills

Skills are defined in the `.claude/skills/` directory:

```
project/
├── .claude/
│   └── skills/
│       ├── crewx/
│       │   ├── skill.yaml
│       │   └── crewx-manual.md
│       └── custom-skill/
│           ├── skill.yaml
│           └── context.md
```

### Creating a Custom Skill

#### Step 1: Create Skill Directory

```bash
mkdir -p .claude/skills/my-skill
```

#### Step 2: Create `skill.yaml`

```yaml
name: "My Custom Skill"
version: "1.0.0"
description: "Specialized skill for..."

agents:
  - id: "skill_expert"
    provider: "cli/claude"
    inline:
      model: "sonnet"
      prompt: |
        You are an expert in {{skill.name}}.

        Context:
        {{{documents.context.content}}}

documents:
  - id: "context"
    path: "./context.md"
```

#### Step 3: Create Context Document

**`.claude/skills/my-skill/context.md`:**

```markdown
# My Custom Skill Context

This skill provides expertise in...

## Capabilities
- Capability 1
- Capability 2

## Usage Examples
...
```

### Example: Python Testing Skill

**`.claude/skills/pytest-expert/skill.yaml`:**

```yaml
name: "Pytest Expert"
version: "1.0.0"
description: "Python testing with pytest and best practices"

agents:
  - id: "pytest_expert"
    provider: "cli/claude"
    inline:
      model: "sonnet"
      prompt: |
        You are a pytest testing expert.

        When creating tests:
        1. Use pytest fixtures for setup/teardown
        2. Parametrize tests for multiple inputs
        3. Use pytest-mock for mocking
        4. Follow AAA pattern (Arrange, Act, Assert)
        5. Include docstrings for complex tests

        Test structure:
        - test_*.py files
        - Clear test names: test_<function>_<scenario>
        - Use fixtures in conftest.py

        Reference:
        {{{documents.pytest_guide.content}}}

documents:
  - id: "pytest_guide"
    path: "./pytest-guide.md"
```

**Usage:**

```bash
# Activate skill (if skill system is configured)
crewx skill load pytest-expert

# Use skill agent
crewx x "@pytest_expert create tests for src/calculator.py"
```

### Built-in CrewX Skill

The CrewX manual you're reading is part of the built-in CrewX skill:

**`.claude/skills/crewx/skill.yaml`:**

```yaml
name: "CrewX Expert"
version: "0.7.4"
description: "Expert on CrewX usage, configuration, and workflows"

agents:
  - id: "crewx_expert"
    provider: "cli/claude"
    inline:
      model: "sonnet"
      prompt: |
        You are a CrewX expert assistant.

        Help users with:
        - CrewX installation and setup
        - Agent configuration
        - Multi-AI workflows
        - Troubleshooting

        Reference the full manual:
        {{{documents.manual.content}}}

documents:
  - id: "manual"
    path: "./crewx-manual.md"
```

### Skill Best Practices

1. **Keep skills focused**: One skill per domain/technology
2. **Include comprehensive docs**: Embed knowledge in documents
3. **Version your skills**: Track changes via version field
4. **Share skills**: Export skill directories for team use
5. **Test thoroughly**: Validate prompts before deploying

---

## Team Collaboration

CrewX enables **team-wide AI collaboration** through Slack integration and shared configurations.

### Slack Bot Integration

#### Setup

1. **Create Slack App** at https://api.slack.com/apps

2. **Set Required Scopes** (OAuth & Permissions):
   ```
   app_mentions:read
   channels:history
   channels:read
   chat:write
   files:read
   groups:history
   groups:read
   im:history
   im:read
   im:write
   mpim:history
   mpim:read
   users:read
   ```

3. **Enable Socket Mode** (Settings → Socket Mode):
   - Turn on Socket Mode
   - Generate App-Level Token with `connections:write` scope

4. **Set Environment Variables:**

   ```bash
   export SLACK_BOT_TOKEN="xoxb-..."
   export SLACK_APP_TOKEN="xapp-..."
   export SLACK_SIGNING_SECRET="..."
   ```

5. **Start Slack Bot:**

   ```bash
   crewx slack --log

   # Or with specific agent
   crewx slack --agent crewx_claude_dev --log
   ```

#### Using CrewX in Slack

**Method 1: Mention Bot**

```
@CrewX analyze this API endpoint design

@CrewX @claude @gemini @copilot review this architecture
```

**Method 2: Direct Message**

Send a DM to the CrewX bot:

```
explain how JWT tokens work
```

**Method 3: Thread Conversations**

CrewX maintains context within Slack threads:

```
Initial message:
@CrewX help me design a caching strategy

In thread:
(you) what about Redis vs Memcached?
@CrewX (responds with context from thread)

(you) implement Redis solution
@CrewX (generates code based on thread discussion)
```

#### Slack Features

1. **Interactive Buttons:**
   - **View Details**: See full agent response
   - **Rerun**: Execute the same query again
   - **Thread**: Continue conversation in thread

2. **Multi-Agent Responses:**
   Each agent's response appears as separate message:
   ```
   @CrewX @claude @gemini review this code

   → Claude: [response]
   → Gemini: [response]
   ```

3. **File Sharing:**
   Upload code files to Slack and ask CrewX to review:
   ```
   [Upload: auth.ts]
   @CrewX review this authentication code
   ```

4. **Team Collaboration:**
   Team members can see and build on each other's queries:
   ```
   Alice: @CrewX design authentication flow
   Bob: @CrewX (in thread) add OAuth support
   Charlie: @CrewX (in thread) add security audit
   ```

### Shared Agent Configurations

**Scenario:** Your team uses standardized agents for code review, testing, and documentation.

#### Step 1: Create Team `agents.yaml`

**`team/agents.yaml`:**

```yaml
agents:
  # Code reviewer used by all developers
  - id: "team_reviewer"
    name: "Team Code Reviewer"
    provider: "cli/claude"
    inline:
      model: "sonnet"
      prompt: |
        You are the team code reviewer for ACME Corp.

        Review standards:
        1. Follow company style guide in docs/style-guide.md
        2. Ensure test coverage > 80%
        3. Check for security vulnerabilities
        4. Validate error handling

        Code must pass all checks before approval.

  # Test generator with team standards
  - id: "team_tester"
    name: "Team Test Generator"
    provider: "cli/copilot"
    inline:
      prompt: |
        Generate tests following ACME Corp standards:
        - Use Vitest framework
        - Minimum 80% coverage
        - Include integration tests
        - Mock external dependencies

  # Documentation writer
  - id: "team_docs"
    name: "Team Documentation Writer"
    provider: "cli/claude"
    inline:
      model: "sonnet"
      prompt: |
        Write documentation for ACME Corp:
        - Use Markdown
        - Include code examples
        - Add mermaid diagrams for flows
        - Follow template in docs/template.md

documents:
  - id: "style_guide"
    path: "docs/style-guide.md"
  - id: "doc_template"
    path: "docs/template.md"
```

#### Step 2: Share Configuration

**Option A: Git Repository**

```bash
# Commit to team repo
git add team/agents.yaml
git commit -m "Add team CrewX agents"
git push
```

**Option B: Shared Network Drive**

```bash
# Copy to shared location
cp team/agents.yaml /shared/crewx/agents.yaml
```

#### Step 3: Team Members Use Shared Config

```bash
# Use shared configuration
crewx q "@team_reviewer review src/api.ts" --config /shared/crewx/agents.yaml

# Or set as default
export CREWX_CONFIG="/shared/crewx/agents.yaml"
crewx q "@team_reviewer review src/api.ts"
```

### Team Workflow Examples

#### Workflow: Pull Request Review

```bash
# Developer creates PR and requests review
git checkout feature/add-oauth
# Make changes...
git push

# In Slack:
@CrewX @team_reviewer review PR #123

# CrewX responds with:
# ✅ Code quality: Good
# ⚠️ Test coverage: 65% (below 80% requirement)
# ❌ Security: Found SQL injection vulnerability in line 45
# 💡 Suggestion: Use prepared statements

# Developer fixes issues
# Fix code...
git push

# Request re-review
@CrewX @team_reviewer re-review PR #123

# ✅ All checks passed
```

#### Workflow: Onboarding New Developers

**Slack channel:** `#crewx-help`

```
New Developer:
@CrewX how do I set up the development environment?

CrewX (using onboarding agent):
Welcome! Follow these steps:
1. Clone repo: git clone...
2. Install dependencies: npm install
3. Set up database: npm run db:setup
4. Run tests: npm test

Full guide: [link to docs]

New Developer:
@CrewX how do I create a new API endpoint?

CrewX:
Here's the standard pattern we use:
[Provides code template based on team standards]
```

### Collaboration Best Practices

1. **Use threads for context**: Keep related discussion in Slack threads
2. **Tag appropriate agents**: `@team_reviewer` for reviews, `@team_tester` for tests
3. **Document decisions**: Use CrewX to generate decision documents
4. **Share workflows**: Create team runbooks with CrewX commands
5. **Version control configs**: Keep `agents.yaml` in git for consistency

---

## Claude Code Integration

CrewX is optimized for seamless integration with **Claude Code**, providing enhanced workflows and capabilities.

### Installation in Claude Code Projects

When working in a Claude Code project:

```bash
# Navigate to your Claude Code project
cd /path/to/claude-code-project

# Install CrewX locally (optional, if not globally installed)
npm install -D @sowonai/crewx-cli

# Initialize CrewX configuration
npx crewx init

# Verify setup
npx crewx doctor
```

### Using CrewX from Claude Code

#### Method 1: MCP Integration (Recommended)

Configure CrewX as an MCP server (see [MCP Server Integration](#mcp-server-integration) section):

**`.claude/claude_desktop_config.json`:**

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

Now Claude Code can use CrewX tools directly:

```
You in Claude Code:
"Use the crewx agent_call tool to get Gemini's opinion on this React component"

Claude Code automatically calls:
agent_call(agent="gemini", prompt="review this React component: [code]")
```

#### Method 2: Terminal Integration

Execute CrewX commands directly in Claude Code's integrated terminal:

```bash
# In Claude Code terminal
crewx q "@claude explain this authentication flow"
crewx x "@copilot refactor this function"
crewx q "@claude @gemini @copilot review this PR"
```

#### Method 3: Skill-Based Integration

Create a CrewX skill for Claude Code to reference:

**`.claude/skills/crewx/skill.yaml`:**

```yaml
name: "CrewX Integration"
agents:
  - id: "crewx_helper"
    provider: "cli/claude"
    inline:
      prompt: |
        You help users leverage CrewX multi-AI capabilities.

        Available agents:
        - @claude: Complex reasoning
        - @gemini: Research and data analysis
        - @copilot: Code implementation

        Guide users to use the right agent for each task.
```

### Workflow Examples

#### Workflow 1: Architecture Design with Multiple AIs

```
You in Claude Code:
"I need to design a real-time notification system. Get input from multiple AIs."

Claude Code (via MCP):
1. Calls agent_call(agent="claude:opus", prompt="design notification system architecture")
2. Calls agent_call(agent="gemini", prompt="research real-time tech: WebSocket vs SSE vs Long Polling")
3. Calls agent_call(agent="copilot", prompt="suggest Node.js implementation patterns")
4. Synthesizes responses into comprehensive design
```

#### Workflow 2: Code Review Pipeline

```bash
# You're working on feature in Claude Code
# After implementation:

# Terminal:
crewx q "@claude @gemini @copilot review src/features/auth.ts \
  @claude: security review \
  @gemini: performance analysis \
  @copilot: best practices check"

# Get comprehensive feedback from all three perspectives
```

#### Workflow 3: Documentation Generation

```
You: "Generate API documentation for this service"

Claude Code:
1. Uses agent_call(agent="claude", prompt="analyze API endpoints in src/api/")
2. Generates documentation draft
3. Uses agent_call(agent="gemini", prompt="add usage examples and best practices")
4. Combines into final documentation
```

### Claude Code Best Practices

1. **Leverage MCP for seamless integration**: No manual CLI commands needed
2. **Use skills for context**: Provide CrewX knowledge via skills
3. **Combine agents strategically**: Claude for reasoning, Gemini for research, Copilot for code
4. **Maintain conversation threads**: Use `--thread` for multi-step tasks
5. **Review before accepting**: Always review AI-generated code

### Troubleshooting Claude Code Integration

**Issue: MCP server not connecting**

```bash
# Check if CrewX is in PATH
which crewx

# Verify MCP server runs
crewx mcp --log

# Check Claude Code MCP config
cat .claude/claude_desktop_config.json
```

**Issue: Agent calls failing**

```bash
# Test agents directly
crewx doctor

# Verify API keys
echo $ANTHROPIC_API_KEY
echo $GOOGLE_GENERATIVE_AI_API_KEY

# Test specific agent
crewx q "@claude test"
```

**Issue: Skills not loading**

```bash
# Verify skill structure
ls -la .claude/skills/crewx/

# Should contain:
# - skill.yaml
# - crewx-manual.md (or other docs)
```

---

## Advanced Features

### Conversation Threads

**Threads** enable persistent, context-aware conversations:

```bash
# Start a thread
crewx q "@claude design auth system" --thread auth-feature

# Continue in same thread (maintains context)
crewx q "@claude add OAuth support" --thread auth-feature

# Execute in thread
crewx x "@claude implement the design" --thread auth-feature

# Review thread history
crewx log --thread auth-feature
```

**Thread storage:** `~/.crewx/threads/<thread-name>.json`

### Template System

Use **Handlebars** for dynamic agent prompts:

```yaml
agents:
  - id: "env_aware"
    provider: "cli/claude"
    inline:
      prompt: |
        {{#if env.DEBUG}}
        Debug mode: Show detailed reasoning
        {{/if}}

        {{#if (eq mode "execute")}}
        You can create and modify files.
        {{else}}
        Read-only mode - no file modifications.
        {{/if}}

        Project: {{agent.workingDirectory}}
```

**Available helpers:**
- `{{#if condition}}...{{/if}}`
- `{{#unless condition}}...{{/unless}}`
- `{{#eq a b}}...{{/eq}}`
- `{{#contains array value}}...{{/contains}}`

### Document System

Reference external documents in agent context:

```yaml
documents:
  - id: "api_spec"
    name: "API Specification"
    path: "docs/api-spec.md"

  - id: "style_guide"
    name: "Style Guide"
    path: "docs/style.md"

agents:
  - id: "api_developer"
    provider: "cli/claude"
    inline:
      prompt: |
        You are an API developer.

        Follow this specification:
        {{{documents.api_spec.content}}}

        Code style:
        {{{documents.style_guide.content}}}
```

**Document variables:**
- `{{{documents.id.content}}}` - Full content
- `{{{documents.id.toc}}}` - Table of contents
- `{{documents.id.summary}}` - Summary

### Custom Providers (Advanced)

Create custom provider wrappers:

```yaml
providers:
  - id: "custom/openai"
    type: "openai"
    config:
      apiKey: "${env:OPENAI_API_KEY}"
      baseURL: "https://api.openai.com/v1"
      model: "gpt-4-turbo"

agents:
  - id: "openai_agent"
    provider: "custom/openai"
    inline:
      prompt: "You are an OpenAI-powered assistant"
```

### Logging and Debugging

Enable verbose logging:

```bash
# Verbose mode
crewx q "@claude analyze code" --verbose

# Debug environment variables
DEBUG=crewx:* crewx q "@claude test"

# Log to file
crewx q "@claude test" --verbose 2>&1 | tee crewx.log
```

**Log levels:**
- `info` - General information
- `debug` - Detailed debugging
- `error` - Errors only

### Rate Limiting and Cost Management

**Monitor usage:**

```bash
# Check API usage (if provider supports)
crewx usage --provider claude

# Estimate cost
crewx q "@claude:opus analyze 10000 line file" --dry-run --estimate-cost
```

**Optimize costs:**

1. Use cheaper models for simple tasks:
   ```bash
   # Expensive
   crewx q "@claude:opus what time is it"  # ❌

   # Cost-effective
   crewx q "@claude:haiku what time is it"  # ✅
   ```

2. Cache results with threads:
   ```bash
   # First query (costs tokens)
   crewx q "@claude analyze codebase" --thread analysis

   # Follow-up questions (cached context)
   crewx q "@claude what about security?" --thread analysis
   ```

3. Use targeted queries:
   ```bash
   # Inefficient
   crewx q "@claude review entire codebase"  # ❌

   # Efficient
   crewx q "@claude review src/auth.ts"  # ✅
   ```

---

## Troubleshooting

### Common Issues

#### Issue: "No API key found for provider"

**Error:**
```
❌ Error: No API key found for provider 'cli/claude'
```

**Solution:**

```bash
# Check API key is set
echo $ANTHROPIC_API_KEY

# If not set, add to shell profile
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc

# Verify
crewx doctor
```

#### Issue: "Agent not found"

**Error:**
```
❌ Error: Agent '@my_agent' not found
```

**Solution:**

```bash
# List available agents
crewx agent ls

# Check agents.yaml exists
ls agents.yaml

# Verify agent ID in agents.yaml
cat agents.yaml | grep "id:"

# Use correct agent ID with @ prefix
crewx q "@correct_agent_id your question"
```

#### Issue: MCP Server Not Connecting

**Error in Claude Code:**
```
MCP server 'crewx' failed to start
```

**Solution:**

```bash
# 1. Verify crewx is in PATH
which crewx

# 2. Test MCP server manually
crewx mcp --log

# 3. Check MCP config
cat .claude/claude_desktop_config.json

# 4. Verify API keys
crewx doctor

# 5. Restart Claude Code
```

#### Issue: "Rate limit exceeded"

**Error:**
```
❌ Error: Rate limit exceeded for provider 'cli/claude'
```

**Solution:**

```bash
# Wait before retrying
sleep 60

# Use different provider
crewx q "@gemini same question"

# Use cheaper model
crewx q "@claude:haiku same question"

# Check provider status
crewx doctor
```

#### Issue: "Invalid agents.yaml syntax"

**Error:**
```
❌ Error: Failed to parse agents.yaml: Invalid YAML syntax
```

**Solution:**

```bash
# Validate YAML syntax online: https://www.yamllint.com/
# Or use yq tool:
yq eval agents.yaml

# Common issues:
# - Incorrect indentation (use spaces, not tabs)
# - Missing quotes around strings with special characters
# - Unclosed brackets or braces

# Check your agents.yaml:
cat agents.yaml
```

#### Issue: Slow Response Times

**Symptoms:** Agent takes > 30 seconds to respond

**Solutions:**

1. **Use faster models:**
   ```bash
   # Slow
   crewx q "@claude:opus simple question"

   # Fast
   crewx q "@claude:haiku simple question"
   ```

2. **Reduce context size:**
   ```bash
   # Large context (slow)
   crewx q "@claude analyze entire codebase"

   # Targeted (fast)
   crewx q "@claude analyze src/auth.ts"
   ```

3. **Check network:**
   ```bash
   # Test connection
   curl -I https://api.anthropic.com
   ```

#### Issue: Thread Context Lost

**Symptom:** Agent doesn't remember previous conversation

**Solution:**

```bash
# Ensure you're using the same thread name
crewx q "@claude what did we discuss?" --thread my-thread

# List threads
ls ~/.crewx/threads/

# Verify thread exists
cat ~/.crewx/threads/my-thread.json

# Create new thread if needed
crewx q "@claude start new discussion" --thread new-thread
```

### Debugging Steps

**Step 1: Check System Health**

```bash
crewx doctor

# Should show:
# ✅ Claude API: Available
# ✅ Gemini API: Available
# ✅ Copilot API: Available
```

**Step 2: Verify Configuration**

```bash
# Check agents.yaml syntax
cat agents.yaml

# List agents
crewx agent ls

# Test specific agent
crewx q "@claude test" --verbose
```

**Step 3: Check Logs**

```bash
# Enable verbose logging
crewx q "@claude test" --verbose 2>&1 | tee debug.log

# Check log file
cat debug.log
```

**Step 4: Test API Connectivity**

```bash
# Claude API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'

# Gemini API
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_GENERATIVE_AI_API_KEY"
```

**Step 5: Reset Configuration**

```bash
# Backup current config
cp agents.yaml agents.yaml.bak

# Reinitialize
crewx init

# Test with default agents
crewx q "@claude test"

# Restore custom config if needed
cp agents.yaml.bak agents.yaml
```

### Getting Help

**Community Support:**

1. **GitHub Issues:** https://github.com/sowonlabs/crewx/issues
2. **Documentation:** https://github.com/sowonlabs/crewx
3. **Slack Community:** [Join here]

**Bug Reports:**

Include the following information:

```bash
# System info
crewx --version
node --version
echo $SHELL

# Configuration
cat agents.yaml

# Error logs
crewx q "@claude test" --verbose 2>&1
```

---

## Best Practices

### 1. Agent Selection

**Choose the right agent for the task:**

| Task | Recommended Agent | Reason |
|------|-------------------|--------|
| Architecture design | `@claude:opus` | Best at system design |
| Code implementation | `@copilot` | Practical, follows patterns |
| Performance analysis | `@gemini` | Data-driven insights |
| Security review | `@claude:opus` | Thorough analysis |
| Quick questions | `@claude:haiku` | Fast and cheap |
| Web research | `@gemini` | Better at current info |
| Test generation | `@copilot` | Knows test patterns |
| Documentation | `@claude:sonnet` | Clear explanations |

### 2. Cost Optimization

**Minimize API costs:**

```bash
# ❌ Expensive: Using Opus for everything
crewx q "@claude:opus format this code"

# ✅ Cost-effective: Use appropriate models
crewx q "@claude:haiku format this code"

# ❌ Wasteful: Analyzing same file multiple times
crewx q "@claude review file1.ts"
crewx q "@claude review file1.ts again"

# ✅ Efficient: Use threads for context
crewx q "@claude review file1.ts" --thread review
crewx q "@claude any security issues?" --thread review
```

### 3. Query Crafting

**Write effective prompts:**

```bash
# ❌ Vague
crewx q "@claude fix this"

# ✅ Specific
crewx q "@claude fix the null pointer exception in getUserById() on line 42"

# ❌ Too broad
crewx q "@claude review code"

# ✅ Focused
crewx q "@claude review src/auth.ts for security vulnerabilities"

# ❌ No context
crewx q "@claude improve performance"

# ✅ With context
crewx q "@claude improve database query performance in src/db/users.ts - currently taking 5s for 10k records"
```

### 4. Multi-Agent Workflows

**Orchestrate agents effectively:**

```bash
# ❌ Sequential (slow)
crewx q "@claude review code"
crewx q "@gemini review code"
crewx q "@copilot review code"

# ✅ Parallel (fast)
crewx q "@claude @gemini @copilot review code"

# ✅ Specialized roles
crewx q "@claude @gemini @copilot review src/api.ts \
  @claude: security analysis \
  @gemini: performance optimization \
  @copilot: best practices"
```

### 5. Thread Management

**Use threads for complex tasks:**

```bash
# ✅ Long-running feature development
crewx q "@claude design auth system" --thread auth-feature
crewx q "@claude add OAuth" --thread auth-feature
crewx x "@claude implement" --thread auth-feature
crewx x "@claude add tests" --thread auth-feature

# ✅ Debugging sessions
crewx q "@claude analyze error" --thread bug-investigation
crewx q "@claude check related code" --thread bug-investigation
crewx x "@claude apply fix" --thread bug-investigation
```

### 6. Configuration Management

**Organize agents effectively:**

```bash
# ✅ agents.yaml structure
agents:
  # General purpose
  - id: "dev"
    provider: ["cli/claude", "cli/gemini", "cli/copilot"]

  # Specialized agents
  - id: "security"
    provider: "cli/claude"
    inline:
      model: "opus"

  - id: "performance"
    provider: "cli/gemini"

  - id: "tests"
    provider: "cli/copilot"

# Use version control
git add agents.yaml
git commit -m "Update CrewX agent configuration"
```

### 7. Security

**Protect sensitive information:**

```bash
# ❌ API keys in code
provider: "cli/claude"
apiKey: "sk-ant-xxx"  # NEVER DO THIS

# ✅ Environment variables
provider: "cli/claude"
# API key from $ANTHROPIC_API_KEY

# ✅ .gitignore for sensitive configs
echo ".crewxrc" >> .gitignore
echo ".env*" >> .gitignore
```

### 8. Team Collaboration

**Share configurations:**

```bash
# ✅ Team-wide agents.yaml in git
git add agents.yaml documents/
git commit -m "Add team CrewX configuration"
git push

# ✅ Documentation
# Create docs/crewx-guide.md explaining:
# - Available agents
# - Usage examples
# - Team workflows
```

### 9. Testing

**Validate changes before deployment:**

```bash
# ✅ Test agent configurations
crewx q "@new_agent test" --verbose

# ✅ Dry run for execute mode
crewx x "@agent implement feature" --dry-run

# ✅ Use separate config for testing
crewx q "@agent test" --config ./test-agents.yaml
```

### 10. Performance

**Optimize for speed:**

```bash
# ✅ Use appropriate models
crewx q "@claude:haiku quick question"  # Fast
crewx q "@claude:opus complex design"   # Thorough

# ✅ Limit context size
crewx q "@claude review src/auth.ts"    # Focused
# Not: crewx q "@claude review src/"    # Too broad

# ✅ Parallel execution
crewx q "@claude @gemini @copilot review"  # 3x faster than sequential
```

---

## Conclusion

CrewX empowers developers to leverage multiple AI providers seamlessly, combining the strengths of Claude, Gemini, and GitHub Copilot in unified workflows.

### Key Takeaways

1. **Multi-AI Orchestration**: Use `@claude @gemini @copilot` for comprehensive insights
2. **Query vs Execute**: Choose the right mode for your task
3. **Custom Agents**: Create specialized agents for your domain
4. **MCP Integration**: Seamless Claude Code integration
5. **Team Collaboration**: Share configurations and workflows via Slack
6. **Cost Optimization**: Use appropriate models and threads

### Next Steps

1. **Install CrewX**: `npm install -g @sowonai/crewx-cli`
2. **Initialize project**: `crewx init`
3. **Configure agents**: Customize `agents.yaml`
4. **Set up MCP**: Integrate with Claude Code
5. **Explore workflows**: Try multi-agent code reviews

### Resources

- **GitHub**: https://github.com/sowonlabs/crewx
- **Documentation**: https://github.com/sowonlabs/crewx/docs
- **Issues**: https://github.com/sowonlabs/crewx/issues
- **Community**: [Slack/Discord link]

---

**Version:** 0.7.4
**Last Updated:** November 2025
**License:** MIT

*Happy multi-AI development with CrewX!*
