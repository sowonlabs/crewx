# Agent Configuration Guide

Complete guide for configuring custom specialist agents in CrewX.

## Quick Start

Create a `crewx.yaml` file in your project:

```yaml
agents:
  - id: "frontend_dev"
    name: "React Expert"
    working_directory: "./src"
    inline:
      type: "agent"
      provider: "cli/claude"  # Built-in CLI provider
      prompt: |
        You are a senior React developer.
        Provide detailed examples and best practices.
```

> **Note:** While `agents.yaml` is still supported for backward compatibility, `crewx.yaml` is the preferred filename. If both files exist, `crewx.yaml` takes priority.

## Agent Configuration Structure

```yaml
agents:
  - id: "agent_id"                       # Required: Unique identifier
    name: "Human Readable Name"          # Optional: Display name
    working_directory: "/path/to/dir"    # Optional: Working directory
    options:                             # Optional: CLI options
      query:                             # Options for query mode
        - "--add-dir=."
      execute:                           # Options for execute mode
        - "--add-dir=."
        - "--allowedTools=Edit,Bash"
    inline:                              # Required: Agent definition
      type: "agent"                      # Required: Type
      provider: "cli/claude"             # Required: AI provider (namespace/id format)
      model: "opus"                      # Optional: Specific model
      prompt: |                          # Required: Instructions
        Your agent's system prompt
```

## Provider Configuration

### Provider Namespace Format

CrewX uses a namespace-based provider naming system:

**Format:** `{namespace}/{id}`

**Available Namespaces:**
- `cli/*` - Built-in CLI providers (claude, gemini, copilot)
- `plugin/*` - User-defined plugin providers
- `api/*` - API-based providers (future: openai, anthropic, ollama, litellm)

### Single Provider (Fixed)

Use a single string to fix the provider:

```yaml
agents:
  - id: "claude_only"
    provider: "cli/claude"  # Always uses Claude CLI, no fallback

  - id: "custom_agent"
    provider: "plugin/my-tool"  # Uses custom plugin provider
```

### Multiple Providers (Fallback)

Use an array for automatic fallback:

```yaml
agents:
  - id: "flexible_agent"
    provider: ["cli/claude", "cli/gemini", "cli/copilot"]  # Tries in order
```

**Behavior:**
- Tries providers in order until one is available
- If model is specified, uses first provider without fallback

## Mode-Specific Options

### Query Mode vs Execute Mode

**Query Mode** (read-only):
```yaml
options:
  query:
    - "--add-dir=."
    - "--verbose"
    # No file modification tools
```

**Execute Mode** (file operations):
```yaml
options:
  execute:
    - "--add-dir=."
    - "--allowedTools=Edit,Bash"
    # Can create/modify files
```

## Model Selection

Specify AI models in configuration or at runtime:

### In Configuration
```yaml
agents:
  - id: "opus_agent"
    provider: "cli/claude"
    inline:
      model: "opus"  # Fixed model
      prompt: "You are an expert."
```

### At Runtime
```bash
# Override model with @agent:model syntax
crewx query "@claude:haiku quick analysis"
crewx execute "@gemini:gemini-2.5-flash rapid prototyping"
```

**Available Models:**

**Claude:**
- `opus` - Most capable, detailed
- `sonnet` - Balanced performance
- `haiku` - Fast, concise
- `claude-sonnet-4-5`
- `claude-sonnet-4-5-20250929`

**Gemini:**
- `gemini-2.5-pro` - High quality (default)
- `gemini-2.5-flash` - Fast responses

**Copilot:**
- `gpt-5`
- `claude-sonnet-4`
- `claude-sonnet-4.5`

## Working Directory

Set the working directory for each agent:

```yaml
agents:
  - id: "frontend_dev"
    working_directory: "./src/frontend"

  - id: "backend_dev"
    working_directory: "./src/backend"

  - id: "full_stack"
    working_directory: "."  # Project root
```

## Complete Example

```yaml
agents:
  # Frontend specialist
  - id: "frontend_developer"
    name: "React Expert"
    provider: "cli/claude"
    working_directory: "./src/frontend"
    options:
      query:
        - "--add-dir=."
        - "--verbose"
      execute:
        - "--add-dir=."
        - "--allowedTools=Edit,Bash"
    inline:
      type: "agent"
      model: "sonnet"
      prompt: |
        You are a senior frontend developer specializing in React.

        **Expertise:**
        - React 18+ with TypeScript
        - State management (Redux, Zustand)
        - Component design patterns
        - Performance optimization

        **Guidelines:**
        - Always use TypeScript strict mode
        - Prefer functional components with hooks
        - Write comprehensive PropTypes/TypeScript types
        - Follow accessibility (a11y) best practices

  # Backend specialist with fallback
  - id: "backend_developer"
    name: "Backend Expert"
    provider: ["cli/gemini", "cli/claude", "cli/copilot"]
    working_directory: "./src/backend"
    options:
      execute:
        - "--add-dir=."
        - "--allowedTools=Edit,Bash"
    inline:
      type: "agent"
      prompt: |
        You are a backend engineering expert.

        **Expertise:**
        - RESTful API design
        - Database optimization
        - Authentication & authorization
        - Microservices architecture

        **Focus:**
        - Security best practices
        - Scalable architecture
        - Error handling and logging
        - API documentation

  # DevOps specialist
  - id: "devops_engineer"
    name: "DevOps Expert"
    provider: "cli/copilot"
    working_directory: "."
    options:
      query:
        - "--allow-tool=files"
      execute:
        - "--allow-tool=terminal"
        - "--allow-tool=files"
    inline:
      type: "agent"
      prompt: |
        You are a DevOps engineer expert in infrastructure and deployment.

        **Expertise:**
        - Docker and Kubernetes
        - CI/CD pipelines
        - Infrastructure as Code
        - Monitoring and logging

        **Focus:**
        - Deployment automation
        - Container orchestration
        - Security and compliance
        - Performance monitoring
```

## CLI Options Reference

### Common Options

**Claude Code:**
- `--add-dir=PATH` - Add directory to context
- `--allowedTools=TOOLS` - Allowed tools (e.g., Edit,Bash)
- `--permission-mode=MODE` - Permission mode (acceptEdits, etc.)
- `--verbose` - Verbose output

**Gemini CLI:**
- `--include-directories=PATH` - Include directories
- `--yolo` - Auto-execute without confirmation
- `--allowed-mcp-server-names=NAME` - Allow MCP server

**Copilot CLI:**
- `--allow-tool=TOOL` - Allow specific tools (files, terminal)
- `--add-dir=PATH` - Add directory

### Query Mode vs Execute Mode

**Query Mode** (read-only):
- Safe for analysis and reviews
- No file modifications
- Use minimal permissions

**Execute Mode** (file operations):
- Can create/modify/delete files
- Requires appropriate tool permissions
- Use with caution

## Creating Agents via CLI

Use the SowonAI CrewX assistant to create agents:

```bash
# Create a Python expert
crewx execute "@crewx Create a Python expert agent. ID 'python_expert', use claude sonnet. Specializes in code review, optimization, and debugging."

# Create a React specialist
crewx execute "@crewx Create a React specialist agent with TypeScript expertise"

# Create a DevOps agent
crewx execute "@crewx Create a DevOps agent for Docker and Kubernetes"

# Create a security analyst
crewx execute "@crewx Create a security analyst agent"
```

The SowonAI CrewX assistant understands your request and creates a complete agent configuration.

## Best Practices

### 1. Specialize Your Agents
Create focused agents for specific domains:
- Frontend, backend, DevOps
- Testing, security, documentation
- Language-specific (Python, TypeScript, Go)

### 2. Use Appropriate Models
- **Haiku/Flash**: Quick answers, simple tasks
- **Sonnet/Pro**: Balanced, most use cases
- **Opus**: Complex analysis, detailed work

### 3. Set Working Directories
Limit agent scope to relevant directories:
```yaml
working_directory: "./src/specific-module"
```

### 4. Configure Mode-Specific Options
Different options for query vs execute:
```yaml
options:
  query:    # Read-only analysis
    - "--add-dir=."
  execute:  # File modifications
    - "--add-dir=."
    - "--allowedTools=Edit"
```

### 5. Use Provider Fallback
Ensure availability with multiple providers:
```yaml
provider: ["cli/claude", "cli/gemini", "cli/copilot"]
```

### 6. Write Clear System Prompts
Include:
- Role and expertise
- Specific guidelines
- Expected output format
- Constraints and limitations

## Validation

Check your configuration:

```bash
crewx doctor
```

This validates:
- YAML syntax
- Required fields
- Provider availability
- Working directory existence
- Option compatibility

## Advanced Configuration

For advanced features like documents and templates, see:
- [Template System Guide](templates.md)
- [Layout System Guide](layouts.md)
