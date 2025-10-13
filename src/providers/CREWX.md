# AI Provider System

> Namespace-based AI provider implementations and YAML-based plugin system

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to providers:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 🏗️ Provider Namespace Architecture

Provider names follow the format: **`{namespace}/{id}`**

### Namespaces

| Namespace | Format | Purpose | Examples |
|-----------|--------|---------|----------|
| **cli/** | `cli/{id}` | Built-in CLI-based providers | `cli/claude`, `cli/gemini`, `cli/copilot`, `cli/codex` |
| **plugin/** | `plugin/{id}` | User-defined external tools via YAML | `plugin/mock`, `plugin/custom-ai` |
| **api/** | `api/{id}` | Direct API integrations (future) | `api/openai`, `api/anthropic`, `api/ollama` |

### Benefits

- **Clear Type Identification**: Instantly know provider type from name
- **Conflict Prevention**: Avoid naming collisions (e.g., `cli/claude` vs `api/claude`)
- **Extensibility**: Easy to add new provider types without breaking changes
- **Organization**: Providers grouped by implementation approach

### Usage in Configuration

```yaml
# crewx.yaml example
providers:
  # Plugin provider definition
  - id: mock
    type: plugin
    cli_command: test-tools/mock-cli
    default_model: "sonnet"
    query_args: ["--model", "{model}", "--message"]
    prompt_in_args: true

agents:
  - id: claude
    provider: cli/claude      # Built-in CLI provider
    capabilities: [query, implementation]

  - id: custom_agent
    provider: plugin/mock     # Plugin provider (from config above)
    capabilities: [query]
```

### Model Placeholder Substitution

Providers support `{model}` placeholder in command arguments:

- **Configuration**: `query_args: ["--model", "{model}", "--message"]`
- **Runtime**: `{model}` → actual model name (e.g., `sonnet`, `gemini-2.5-pro`)
- **Priority**: `options.model` > `default_model` from config

**Example**:
```bash
# User runs: crewx query "@custom:opus Hello"
# Command becomes: test-tools/mock-cli --model opus --message "Hello"

# User runs: crewx query "@custom Hello"
# Command becomes: test-tools/mock-cli --model sonnet --message "Hello"
#                  (uses default_model from config)
```

---

## 📋 Files Overview

### **ai-provider.interface.ts**
Provider contract and namespace constants for all AI providers.
Defines ProviderNamespace (cli/plugin/api), BuiltInProviders constants, AIProvider interface, AIQueryOptions, and AIResponse types.
Ensures consistent behavior across different provider implementations with namespace format.

### **base-ai.provider.ts**
Abstract base class with model placeholder substitution support.
Handles CLI process spawning, output streaming, error handling, logging, and `{model}` placeholder replacement.
Implements getDefaultModel() and substituteModelPlaceholders() for runtime model injection.

### **claude.provider.ts**
Built-in CLI provider: `cli/claude` (Claude Code integration).
Implements Claude-specific arguments, output parsing, and error handling.
Supports stream-json output format for structured responses.

### **gemini.provider.ts**
Built-in CLI provider: `cli/gemini` (Gemini CLI integration).
Implements Google Gemini-specific CLI arguments and response handling.
Provides real-time web access and multi-modal capabilities.

### **copilot.provider.ts**
Built-in CLI provider: `cli/copilot` (GitHub Copilot CLI integration).
Implements Copilot-specific command routing and response parsing.
Specialized for code-focused tasks and explanations.

### **codex.provider.ts**
Built-in CLI provider: `cli/codex` (Codex CLI integration).
Implements Codex-specific arguments with experimental JSON output format.
Handles authentication errors and rate limiting for Codex API.

### **dynamic-provider.factory.ts**
Plugin provider factory: `plugin/*` (YAML-based plugin system).
Creates plugin provider instances from YAML configuration at runtime with namespace format.
Validates CLI commands, sanitizes arguments, prevents injection attacks, and supports model substitution.

---

**Last Updated**: 2025-10-12
