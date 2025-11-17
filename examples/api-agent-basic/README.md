# Basic API Agent Example

This example demonstrates the simplest way to create an API-based agent using CrewX.

## Overview

This example shows:
- Basic API provider configuration
- Simple YAML setup
- Query and execute modes
- Multiple provider types

## Prerequisites

- Node.js 18+
- CrewX CLI installed (`npm install -g crewx`)
- API keys for your chosen provider

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

## Examples

### Example 1: OpenAI Agent

**File**: `crewx-openai.yaml`

```yaml
agents:
  - id: gpt_assistant
    name: GPT-4 Assistant
    provider: api/openai
    model: gpt-4o
    temperature: 0.7
    maxTokens: 2000
    inline:
      prompt: |
        You are a helpful AI assistant powered by GPT-4.
        Provide clear, concise, and accurate responses.
```

**Usage**:

```bash
# Query mode
crewx query "@gpt_assistant What is quantum computing?" -c crewx-openai.yaml

# Execute mode
crewx execute "@gpt_assistant Create a summary of recent AI developments" -c crewx-openai.yaml
```

### Example 2: Claude Agent

**File**: `crewx-claude.yaml`

```yaml
agents:
  - id: claude_assistant
    name: Claude Assistant
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.7
    maxTokens: 4000
    inline:
      prompt: |
        You are Claude, an AI assistant created by Anthropic.
        You excel at thoughtful analysis and clear communication.
```

**Usage**:

```bash
crewx query "@claude_assistant Explain machine learning" -c crewx-claude.yaml
```

### Example 3: Local Ollama Agent

**File**: `crewx-ollama.yaml`

```yaml
agents:
  - id: local_llama
    name: Local Llama
    provider: api/ollama
    url: http://localhost:11434/v1
    model: llama3.2
    temperature: 0.8
    inline:
      prompt: |
        You are a locally-running AI assistant.
        No external API calls are made.
```

**Setup Ollama**:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull llama3.2

# Start server (runs automatically)
ollama serve
```

**Usage**:

```bash
crewx query "@local_llama Tell me a joke" -c crewx-ollama.yaml
```

### Example 4: Multi-Agent Configuration

**File**: `crewx-multi.yaml`

```yaml
agents:
  # Coding specialist
  - id: coder
    name: Coding Expert
    provider: api/openai
    model: gpt-4o
    temperature: 0.0  # Deterministic for code
    inline:
      prompt: |
        You are a senior software engineer.
        Write clean, well-tested code.

  # Writing specialist
  - id: writer
    name: Writing Expert
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.8  # Creative
    inline:
      prompt: |
        You are a professional writer.
        Create engaging, clear content.

  # Analyst specialist
  - id: analyst
    name: Data Analyst
    provider: api/google
    model: gemini-1.5-pro
    temperature: 0.5
    inline:
      prompt: |
        You are a data analyst.
        Provide insights from data.
```

**Usage**:

```bash
# Use specific agent for specific task
crewx execute "@coder Write a Python function to sort a list"
crewx execute "@writer Write a blog post about AI"
crewx execute "@analyst Analyze this dataset: [data]"
```

## Running the Examples

### Run Specific Example

```bash
# OpenAI example
crewx query "@gpt_assistant Hello!" -c crewx-openai.yaml

# Claude example
crewx query "@claude_assistant Hello!" -c crewx-claude.yaml

# Ollama example
crewx query "@local_llama Hello!" -c crewx-ollama.yaml
```

### Run All Examples

```bash
npm test
```

## Configuration Options

### Provider Types

- `api/openai` - OpenAI (GPT-4, GPT-3.5)
- `api/anthropic` - Anthropic (Claude)
- `api/google` - Google AI (Gemini)
- `api/bedrock` - AWS Bedrock
- `api/litellm` - LiteLLM Gateway
- `api/ollama` - Ollama (local)
- `api/sowonai` - SowonAI

### Temperature Settings

- `0.0` - Deterministic (coding, facts)
- `0.3-0.5` - Focused (analysis)
- `0.7` - Balanced (default)
- `0.8-1.0` - Creative (writing)

### Token Limits

- `500-1000` - Short responses
- `2000` - Default
- `4000-8000` - Long-form content

## Troubleshooting

### API Key Issues

```bash
# Check environment variables
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Verify with doctor
crewx doctor
```

### Connection Issues

```bash
# Test API connectivity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Ollama
curl http://localhost:11434/api/tags
```

### Model Not Found

Ensure model name matches provider's supported models:

```yaml
# ✅ Correct
provider: api/openai
model: gpt-4o

# ❌ Wrong
provider: api/openai
model: gpt-5  # Doesn't exist
```

## Next Steps

- **Tool Calling**: See [../api-agent-tools/](../api-agent-tools/)
- **MCP Integration**: See [../api-agent-mcp/](../api-agent-mcp/)
- **Full Guide**: See [../../docs/api-provider-guide.md](../../docs/api-provider-guide.md)

## License

MIT
