# CrewX API Provider User Guide

> **Version**: 0.1.x
> **Last Updated**: 2025-11-13
> **For**: Developers and system administrators

This comprehensive guide walks you through using CrewX API Providers, from basic setup to advanced configurations with tool calling and MCP integration.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Supported Providers](#supported-providers)
3. [LiteLLM Gateway Setup](#litellm-gateway-setup)
4. [YAML Configuration Examples](#yaml-configuration-examples)
5. [Tool Calling Usage](#tool-calling-usage)
6. [MCP Server Integration](#mcp-server-integration)
7. [CLI vs API Provider Comparison](#cli-vs-api-provider-comparison)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Provider Options](#provider-options)
10. [Advanced Topics](#advanced-topics)

---

## Quick Start

### Prerequisites

- Node.js 18+ installed
- CrewX CLI installed (`npm install -g crewx`)
- API keys for your chosen provider

### 5-Minute Setup

**Step 1: Install CrewX**

```bash
npm install -g crewx
```

**Step 2: Initialize Project**

```bash
mkdir my-crewx-project
cd my-crewx-project
crewx init
```

**Step 3: Configure Environment Variables**

Create `.env` file:

```bash
# For OpenAI
OPENAI_API_KEY=sk-...

# For Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# For Google AI
GOOGLE_API_KEY=...
```

**Step 4: Create crewx.yaml**

```yaml
agents:
  - id: my_first_agent
    name: My First Agent
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.7
    inline:
      prompt: |
        You are a helpful AI assistant.
```

**Step 5: Test Your Agent**

```bash
# Query mode (read-only)
crewx query "@my_first_agent What is the weather like today?"

# Execute mode (can perform actions)
crewx execute "@my_first_agent Create a summary report"
```

**Expected Output:**

```
Agent: my_first_agent
Provider: api/openai
Model: gpt-5.1-chat-latest

I'd be happy to help you check the weather! However, I don't have
access to real-time weather data. You would need to provide me with
a location and I can use weather tools to fetch that information.
```

### Your First API Agent

Let's create a more practical agent with tool calling:

```yaml
# crewx.yaml
agents:
  - id: research_assistant
    name: Research Assistant
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.7
    tools: [web_search, company_info]
    inline:
      prompt: |
        You are a research assistant specialized in finding accurate
        information about companies and topics.

        When asked about a company or topic:
        1. Use web_search to find recent information
        2. Use company_info for detailed company data
        3. Synthesize the information clearly
```

**Test it:**

```bash
crewx execute "@research_assistant Tell me about OpenAI"
```

---

## Supported Providers

CrewX API Provider supports 7 different AI providers with unified configuration. Each provider has its own characteristics and use cases.

### 1. OpenAI (`api/openai`)

**Models:**
- `gpt-5.1-chat-latest` - Latest GPT-4 Omni model (recommended)
- `gpt-4-turbo` - GPT-4 Turbo with 128K context
- `gpt-4` - Original GPT-4
- `gpt-3.5-turbo` - Fast and cost-effective

**Features:**
- Function calling / tool use
- JSON mode
- Vision capabilities (gpt-5.1-chat-latest, gpt-4-turbo)
- 128K context window (gpt-4-turbo)

**Environment Variable:** `OPENAI_API_KEY`

**Example:**
```yaml
agents:
  - id: "gpt_assistant"
    name: "GPT-4 Assistant"
    inline:
      provider: "api/openai"
      model: "gpt-5.1-chat-latest"
      temperature: 0.7
      maxTokens: 4000
      prompt: |
        You are a helpful AI assistant powered by GPT-4.
```

**Use Cases:**
- General-purpose tasks
- Code generation and review
- Creative writing
- Complex reasoning

---

### 2. Anthropic (`api/anthropic`)

**Models:**
- `claude-sonnet-4-5-20250929` - Latest Sonnet (recommended)
- `claude-3-opus-20240229` - Most capable, slower
- `claude-3-haiku-20240307` - Fast and cost-effective

**Features:**
- 200K context window (all models)
- Extended thinking (Claude 3.5)
- Tool use / function calling
- Strong reasoning and analysis

**Environment Variable:** `ANTHROPIC_API_KEY`

**Example:**
```yaml
agents:
  - id: "claude_assistant"
    name: "Claude Assistant"
    inline:
      provider: "api/anthropic"
      model: "claude-sonnet-4-5-20250929"
      temperature: 0.7
      maxTokens: 4000
      prompt: |
        You are a thoughtful AI assistant powered by Claude.
```

**Use Cases:**
- Long-context analysis (200K tokens)
- Code review and refactoring
- Research and summarization
- Complex reasoning tasks

---

### 3. Google (`api/google`)

**Models:**
- `gemini-2.5-pro` - Latest experimental (fastest)
- `gemini-1.5-pro` - Most capable (1M context)
- `gemini-1.5-flash` - Fast and efficient

**Features:**
- 1M+ context window (Gemini 1.5 Pro)
- Multimodal (text, image, video, audio)
- Function calling
- Real-time information (with Google Search integration)

**Environment Variable:** `GOOGLE_API_KEY`

**Example:**
```yaml
agents:
  - id: "gemini_assistant"
    name: "Gemini Assistant"
    inline:
      provider: "api/google"
      model: "gemini-2.5-pro"
      temperature: 0.9
      maxTokens: 8000
      prompt: |
        You are an AI assistant powered by Google Gemini.
```

**Use Cases:**
- Massive context analysis (1M+ tokens)
- Multimodal tasks (image/video/audio)
- Fast responses with Gemini Flash
- Research with real-time data

---

### 4. AWS Bedrock (`api/bedrock`)

**Models:**
- `anthropic.claude-sonnet-4-5-20250929-v2:0` - Claude 3.5 Sonnet on Bedrock
- `anthropic.claude-3-opus-20240229-v1:0` - Claude 3 Opus on Bedrock
- `anthropic.claude-3-haiku-20240307-v1:0` - Claude 3 Haiku on Bedrock

**Features:**
- AWS infrastructure integration
- Enterprise security and compliance
- VPC deployment
- AWS CloudWatch logging

**Environment Variables:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**Example:**
```yaml
agents:
  - id: "bedrock_assistant"
    name: "AWS Bedrock Claude"
    inline:
      provider: "api/bedrock"
      url: "https://bedrock-runtime.us-east-1.amazonaws.com"
      model: "anthropic.claude-sonnet-4-5-20250929-v2:0"
      temperature: 0.7
      prompt: |
        You are an enterprise AI assistant running on AWS Bedrock.
```

**Use Cases:**
- Enterprise deployments
- AWS-native applications
- Compliance-sensitive workloads
- VPC-isolated environments

---

### 5. LiteLLM Gateway (`api/litellm`)

**Models:** Any model supported by LiteLLM (100+ models)
- Routes to OpenAI, Anthropic, Google, etc.
- Unified interface for all providers
- Cost-based routing and load balancing

**Features:**
- Multi-provider routing
- Cost optimization
- Load balancing and failover
- Usage tracking and monitoring
- Rate limiting

**Environment Variable:** `LITELLM_API_KEY` (if auth enabled)

**Example:**
```yaml
agents:
  - id: "litellm_assistant"
    name: "LiteLLM Gateway"
    inline:
      provider: "api/litellm"
      url: "http://localhost:4000"
      model: "claude-sonnet-4-5-20250929"  # Routed by LiteLLM
      temperature: 0.7
      prompt: |
        You are an AI assistant using LiteLLM gateway.
```

**Use Cases:**
- Multi-model applications
- Cost optimization across providers
- Load balancing multiple API keys
- A/B testing different models
- Monitoring and logging

---

### 6. Ollama (`api/ollama`)

**Models:** Any model available on Ollama
- `llama3.2` - Latest Llama 3.2
- `mistral` - Mistral models
- `codellama` - Code-specialized Llama
- `deepseek-coder` - DeepSeek Coder models
- And 100+ more on ollama.ai/library

**Features:**
- Fully local LLM server
- No internet required (after model download)
- Privacy-focused (data never leaves your machine)
- GPU acceleration support
- Free to use

**Environment Variable:** None (local server)

**Example:**
```yaml
agents:
  - id: "ollama_assistant"
    name: "Local Ollama"
    inline:
      provider: "api/ollama"
      url: "http://localhost:11434/v1"
      model: "llama3.2"
      temperature: 0.8
      prompt: |
        You are a local AI assistant running on Ollama.
```

**Use Cases:**
- Local development without API costs
- Privacy-sensitive applications
- Offline environments
- Custom fine-tuned models
- Experimentation without rate limits

**Setup:**
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Download a model
ollama pull llama3.2

# Verify it's running
curl http://localhost:11434/api/tags
```

---

### 7. SowonAI (`api/sowonai`)

**Models:** Models available on Sowon.ai
- Check Sowon.ai documentation for available models

**Features:**
- Sowon.ai platform integration
- Specialized models and capabilities

**Environment Variable:** `SOWONAI_API_KEY`

**Example:**
```yaml
agents:
  - id: "sowonai_assistant"
    name: "SowonAI Assistant"
    inline:
      provider: "api/sowonai"
      url: "https://api.sowon.ai/v1"
      model: "your-model-name"
      temperature: 0.7
      prompt: |
        You are an AI assistant powered by SowonAI.
```

**Use Cases:**
- SowonAI platform users
- Specialized models from Sowon.ai

---

### OpenRouter Support

CrewX also supports **OpenRouter** through the `api/openai` provider by setting a custom URL:

**Example:**
```yaml
agents:
  - id: "openrouter_agent"
    name: "OpenRouter Agent"
    inline:
      provider: "api/openai"
      url: "https://openrouter.ai/api/v1"
      apiKey: "{{env.OPENROUTER_API_KEY}}"
      model: "anthropic/claude-sonnet-4-5-20250929"
      temperature: 0.7
      prompt: |
        You are an AI assistant using OpenRouter.
```

**Benefits:**
- Access to 100+ models through one API
- Competitive pricing
- Automatic failover
- Usage analytics

---

## LiteLLM Gateway Setup

LiteLLM is a unified gateway that provides a single API for 100+ AI models. It's perfect for:

- **Multi-model switching**: Change models without code changes
- **Cost optimization**: Route to cheapest provider
- **Load balancing**: Distribute requests across providers
- **Monitoring**: Track usage and costs

### Installation

**Option 1: Docker (Recommended)**

```bash
docker pull ghcr.io/berriai/litellm:latest

# Run with config
docker run -d \
  --name litellm \
  -p 4000:4000 \
  -v $(pwd)/litellm_config.yaml:/app/config.yaml \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  ghcr.io/berriai/litellm:latest \
  --config /app/config.yaml
```

**Option 2: Python**

```bash
pip install 'litellm[proxy]'

# Run proxy
litellm --config litellm_config.yaml
```

### LiteLLM Configuration

Create `litellm_config.yaml`:

```yaml
model_list:
  # OpenAI Models
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: ${OPENAI_API_KEY}

  - model_name: gpt-5.1-chat-latest
    litellm_params:
      model: openai/gpt-5.1-chat-latest
      api_key: ${OPENAI_API_KEY}

  # Anthropic Models
  - model_name: claude-sonnet-4-5-20250929
    litellm_params:
      model: anthropic/claude-sonnet-4-5-20250929
      api_key: ${ANTHROPIC_API_KEY}

  - model_name: claude-3-opus-20240229
    litellm_params:
      model: anthropic/claude-3-opus-20240229
      api_key: ${ANTHROPIC_API_KEY}

  # Google Models
  - model_name: gemini-1.5-pro
    litellm_params:
      model: google/gemini-1.5-pro
      api_key: ${GOOGLE_API_KEY}

  # AWS Bedrock
  - model_name: bedrock-claude
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-4-5-20250929-v2:0
      aws_access_key_id: ${AWS_ACCESS_KEY_ID}
      aws_secret_access_key: ${AWS_SECRET_ACCESS_KEY}
      aws_region_name: us-east-1

# Router Settings
router_settings:
  routing_strategy: latency-based-routing  # or 'simple-shuffle', 'cost-based'
  model_group_alias:
    claude: [claude-sonnet-4-5-20250929, claude-3-opus-20240229]
    gpt: [gpt-4, gpt-5.1-chat-latest]

# General Settings
general_settings:
  master_key: sk-1234  # For authentication
  database_url: postgresql://...  # For logging (optional)
```

### CrewX + LiteLLM Integration

**crewx.yaml:**

```yaml
# Environment variables
vars:
  litellm_url: http://localhost:4000

agents:
  - id: claude_agent
    name: Claude via LiteLLM
    provider: api/litellm
    url: "{{vars.litellm_url}}"
    model: claude-sonnet-4-5-20250929  # Routed by LiteLLM
    temperature: 0.7
    inline:
      prompt: |
        You are an AI assistant powered by Claude via LiteLLM gateway.

  - id: gpt_agent
    name: GPT-4 via LiteLLM
    provider: api/litellm
    url: "{{vars.litellm_url}}"
    model: gpt-5.1-chat-latest  # Routed by LiteLLM
    temperature: 0.7
    inline:
      prompt: |
        You are an AI assistant powered by GPT-4 via LiteLLM gateway.
```

**Test LiteLLM agents:**

```bash
# Test Claude
crewx query "@claude_agent Explain quantum computing"

# Test GPT
crewx query "@gpt_agent Write a haiku about AI"
```

### Advanced LiteLLM Features

**1. Fallback Configuration**

```yaml
# litellm_config.yaml
model_list:
  - model_name: reliable-model
    litellm_params:
      model: anthropic/claude-sonnet-4-5-20250929
      api_key: ${ANTHROPIC_API_KEY}
    model_info:
      fallbacks: [gpt-4, gemini-1.5-pro]
```

**2. Load Balancing**

```yaml
# Multiple instances of same model
model_list:
  - model_name: claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5-20250929
      api_key: ${ANTHROPIC_API_KEY_1}

  - model_name: claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5-20250929
      api_key: ${ANTHROPIC_API_KEY_2}

router_settings:
  routing_strategy: simple-shuffle  # Round-robin between instances
```

**3. Cost-Based Routing**

```yaml
router_settings:
  routing_strategy: cost-based-routing
  model_group_alias:
    smart:
      - gpt-3.5-turbo    # Cheapest
      - gemini-1.5-flash  # Medium
      - claude-3-haiku    # Fallback
```

### Monitoring LiteLLM

**Check health:**

```bash
curl http://localhost:4000/health
```

**View logs:**

```bash
# Docker
docker logs litellm -f

# Python
tail -f litellm.log
```

**Dashboard (if enabled):**

Visit: http://localhost:4000/ui

---

## YAML Configuration Examples

### Basic Configurations

**Example 1: Simple OpenAI Agent**

```yaml
agents:
  - id: simple_gpt
    name: Simple GPT Agent
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.7
    maxTokens: 2000
    inline:
      prompt: |
        You are a helpful AI assistant.
```

**Example 2: Claude with Lower Temperature**

```yaml
agents:
  - id: precise_claude
    name: Precise Claude
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.0  # Deterministic
    maxTokens: 4000
    inline:
      prompt: |
        You are a precise code reviewer. Focus on:
        - Code correctness
        - Best practices
        - Security issues
```

**Example 3: Local Ollama Agent**

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
        You are a local AI assistant running on Ollama.
```

### Multi-Agent Configuration

```yaml
vars:
  company_name: MyCompany
  api_version: v2

agents:
  # Research Agent (Claude)
  - id: research_agent
    name: Research Specialist
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.7
    tools: [web_search, company_info]
    inline:
      prompt: |
        You are a research specialist for {{vars.company_name}}.
        Use web_search and company_info tools effectively.

  # Coding Agent (GPT-4)
  - id: coding_agent
    name: Code Expert
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.0  # Deterministic for code
    tools: [file_read, file_write, run_tests]
    inline:
      prompt: |
        You are a senior software engineer for {{vars.company_name}}.
        Write clean, tested, production-ready code.

  # Data Analyst (Gemini)
  - id: data_analyst
    name: Data Analyst
    provider: api/google
    model: gemini-1.5-pro
    temperature: 0.5
    tools: [query_database, generate_chart]
    inline:
      prompt: |
        You are a data analyst for {{vars.company_name}}.
        Analyze data and create visualizations.
```

### Environment-Based Configuration

```yaml
vars:
  # Different configs per environment
  api_url: "{{env.NODE_ENV == 'production' ? 'https://api.prod.com' : 'http://localhost:4000'}}"
  debug_mode: "{{env.DEBUG == 'true'}}"

agents:
  - id: adaptive_agent
    name: Adaptive Agent
    provider: api/litellm
    url: "{{vars.api_url}}"
    model: claude-sonnet-4-5-20250929
    temperature: "{{vars.debug_mode ? 0.0 : 0.7}}"
    inline:
      prompt: |
        You are an adaptive agent.
        Environment: {{env.NODE_ENV}}
        Debug Mode: {{vars.debug_mode}}
```

### Provider-Specific Configurations

**AWS Bedrock:**

```yaml
agents:
  - id: bedrock_agent
    name: AWS Bedrock Claude
    provider: api/bedrock
    url: https://bedrock-runtime.us-east-1.amazonaws.com
    model: anthropic.claude-sonnet-4-5-20250929-v2:0
    temperature: 0.7
    inline:
      prompt: |
        You are an enterprise AI assistant running on AWS Bedrock.
```

**Google Gemini:**

```yaml
agents:
  - id: gemini_agent
    name: Google Gemini
    provider: api/google
    model: gemini-2.5-pro
    temperature: 0.9  # Creative
    maxTokens: 8000
    inline:
      prompt: |
        You are Google's Gemini AI, specialized in analysis and creativity.
```

### Complex Multi-Tool Configuration

```yaml
vars:
  company_name: TechCorp
  github_org: techcorp
  slack_team: T123456

mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"
      GITHUB_OWNER: "{{vars.github_org}}"

  slack:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: "{{env.SLACK_BOT_TOKEN}}"
      SLACK_TEAM_ID: "{{vars.slack_team}}"

agents:
  - id: devops_agent
    name: DevOps Engineer
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.3
    mcp: [github, slack]
    tools: [deploy_service, check_logs, alert_team]
    inline:
      prompt: |
        You are a DevOps engineer for {{vars.company_name}}.

        Available tools:
        - GitHub (via MCP): manage repositories, create issues, review PRs
        - Slack (via MCP): send notifications, check channels
        - deploy_service: Deploy services to production
        - check_logs: Check application logs
        - alert_team: Alert team about issues

        Always notify team via Slack after critical operations.
```

### Conditional Tool Activation

```yaml
vars:
  production_mode: "{{env.NODE_ENV == 'production'}}"

agents:
  - id: smart_agent
    name: Environment-Aware Agent
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.7
    # Only enable dangerous tools in non-production
    tools: "{{vars.production_mode ? ['read_only_tool'] : ['read_only_tool', 'write_tool', 'delete_tool']}}"
    inline:
      prompt: |
        Production Mode: {{vars.production_mode}}

        {{#if vars.production_mode}}
        ⚠️ Running in PRODUCTION - read-only mode
        {{else}}
        Running in DEVELOPMENT - full access
        {{/if}}
```

---

## Tool Calling Usage

### Overview

CrewX uses **function injection** for tool calling, inspired by SowonFlow. Tools are defined in TypeScript code and injected via the framework API.

### Architecture

```
User Code (tools defined)
    ↓
CrewX Framework (tools injected)
    ↓
MastraAPIProvider (tools converted)
    ↓
Mastra Agent (tools executed)
```

### Step 1: Define Tools

Create `tools/weather.tool.ts`:

```typescript
import { z } from 'zod';
import { FrameworkToolDefinition } from '@crewx/sdk';

export const weatherTool: FrameworkToolDefinition = {
  name: 'weather',
  description: 'Get current weather for a city. Returns temperature, humidity, and conditions.',

  // Zod schema for input validation
  parameters: z.object({
    city: z.string().min(1).describe('City name (e.g., "Seoul", "Tokyo")'),
    units: z.enum(['celsius', 'fahrenheit'])
      .optional()
      .default('celsius')
      .describe('Temperature units'),
  }),

  // Execute function with context
  execute: async ({ city, units }, context) => {
    // Access environment variables
    const apiKey = context.env.WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    // Log with agent info
    console.log(`[${context.agent.id}] Weather request for ${city}`);

    // Make API call
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        city: data.name,
        temperature: data.main.temp,
        humidity: data.main.humidity,
        conditions: data.weather[0].description,
        units,
      };
    } catch (error) {
      console.error(`Weather tool error: ${error.message}`);
      return {
        error: true,
        message: `Failed to fetch weather: ${error.message}`
      };
    }
  },
};
```

### Step 2: Create More Tools

Create `tools/company.tool.ts`:

```typescript
import { z } from 'zod';
import { FrameworkToolDefinition } from '@crewx/sdk';

export const companySearchTool: FrameworkToolDefinition = {
  name: 'company_search',
  description: 'Search company database for information about companies.',

  parameters: z.object({
    query: z.string().describe('Company name or search query'),
    limit: z.number().int().positive().optional().default(5),
  }),

  execute: async ({ query, limit }, context) => {
    // Access custom variables from YAML
    const apiVersion = context.vars?.apiVersion || 'v1';
    const companyName = context.vars?.companyName;

    console.log(`[${context.agent.id}] Company search: "${query}"`);
    console.log(`Using API version: ${apiVersion}`);

    // Audit logging
    if (context.request) {
      await logToolUsage({
        agentId: context.agent.id,
        toolName: 'company_search',
        query,
        timestamp: context.request.timestamp,
      });
    }

    // Mock API call
    const companies = await searchCompanyAPI({
      query,
      limit,
      apiVersion,
    });

    return {
      results: companies,
      count: companies.length,
      query,
    };
  },
};
```

### Step 3: Inject Tools

Create `index.ts`:

```typescript
import { CrewX } from '@crewx/sdk';
import { weatherTool } from './tools/weather.tool';
import { companySearchTool } from './tools/company.tool';

// Initialize CrewX with tool injection
const crewx = new CrewX({
  configPath: 'crewx.yaml',

  // Function injection: tools defined in TypeScript
  tools: [
    weatherTool,
    companySearchTool,
    // Add more tools here
  ],
});

// Run agent
async function main() {
  const response = await crewx.runAgent('research_agent', {
    input: 'What is the weather in Seoul?',
  });

  console.log(response.content);
}

main();
```

### Step 4: Activate Tools in YAML

```yaml
# crewx.yaml
agents:
  - id: research_agent
    name: Research Agent
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.7
    tools: [weather, company_search]  # Activate injected tools
    inline:
      prompt: |
        You are a research agent with access to:
        - weather: Get weather information
        - company_search: Search company database
```

### Step 5: Test Tool Calling

```bash
# Query with tool calling
crewx execute "@research_agent What's the weather in Seoul?"

# Expected behavior:
# 1. Agent receives query
# 2. Agent calls weather tool with { city: "Seoul" }
# 3. Tool executes and returns weather data
# 4. Agent synthesizes response
```

**Expected Output:**

```
Agent: research_agent
Provider: api/openai
Model: gpt-5.1-chat-latest

The current weather in Seoul is 15°C (59°F) with clear skies.
Humidity is at 60%.

[Tool Calls]
- weather(city="Seoul", units="celsius")
  Result: { temperature: 15, conditions: "clear sky", humidity: 60 }
```

### Built-in File System Tools

CrewX provides several built-in tools for file system operations. These tools are available in `@crewx/sdk/tools`.

#### Find Tool - Search Files by Name

Search for files by filename pattern. Similar to Unix `find` command.

**Import:**
```typescript
import { findTool } from '@crewx/sdk/tools';
```

**Features:**
- Supports wildcards (`*` and `?`)
- Case-insensitive by default
- Returns absolute file paths
- Sorts by exact matches first, then by modification time

**Parameters:**
- `pattern`: Filename pattern (e.g., `"MastraAPIProvider.ts"`, `"*Provider*.ts"`)
- `dir_path`: Directory to search in (default: current directory)
- `case_sensitive`: Whether to match case-sensitively (default: false)
- `max_results`: Maximum results to return (default: 50)

**Example:**
```typescript
import { findTool } from '@crewx/sdk/tools';

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [findTool],
});
```

**YAML Configuration:**
```yaml
agents:
  - id: file_searcher
    name: File Search Agent
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    tools: [find]
    inline:
      prompt: |
        You can search for files by name using the find tool.
        Example: find(pattern="*Provider*.ts")
```

**Usage:**
```bash
crewx execute "@file_searcher Find all TypeScript files with Provider in the name"
```

#### Glob Tool - Pattern-Based File Search

Search for files using glob patterns (e.g., `**/*.ts`, `src/**/*.yaml`).

**Import:**
```typescript
import { globTool } from '@crewx/sdk/tools';
```

**Features:**
- Full glob pattern support (`*`, `?`, `**`)
- Respects .gitignore by default
- Returns files sorted by modification time (recent first)
- Supports recursive directory search

**Parameters:**
- `pattern`: Glob pattern (e.g., `"**/*.ts"`, `"examples/**/*.yaml"`)
- `dir_path`: Directory to search in (default: current directory)
- `case_sensitive`: Whether to match case-sensitively (default: false)
- `respect_git_ignore`: Whether to respect .gitignore (default: true)
- `max_results`: Maximum results to return (default: 100)

**Example:**
```typescript
import { globTool } from '@crewx/sdk/tools';

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [globTool],
});
```

**YAML Configuration:**
```yaml
agents:
  - id: code_analyzer
    name: Code Analysis Agent
    provider: api/openai
    model: gpt-5.1-chat-latest
    tools: [glob]
    inline:
      prompt: |
        You can search for files using glob patterns.
        Examples:
        - glob(pattern="**/*.ts") - All TypeScript files
        - glob(pattern="src/**/*.yaml") - YAML files in src
```

**Usage:**
```bash
crewx execute "@code_analyzer Find all TypeScript files in the packages directory"
```

#### Tree Tool - Display Directory Structure

Display directory structure similar to Unix `tree` command.

**Import:**
```typescript
import { treeTool } from '@crewx/sdk/tools';
```

**Features:**
- Shows nested directory structure
- Displays file sizes
- Configurable depth limit
- Sorts directories first, then alphabetically

**Parameters:**
- `path`: Directory path to inspect (default: current directory)
- `max_depth`: Maximum depth to traverse (default: 3)

**Example:**
```typescript
import { treeTool } from '@crewx/sdk/tools';

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [treeTool],
});
```

**YAML Configuration:**
```yaml
agents:
  - id: project_explorer
    name: Project Explorer Agent
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    tools: [tree]
    inline:
      prompt: |
        You can explore directory structure using the tree tool.
        Example: tree(path="src", max_depth=2)
```

**Usage:**
```bash
crewx execute "@project_explorer Show me the structure of the src directory"
```

#### Using Multiple Built-in Tools

Combine built-in tools for powerful file system operations:

```typescript
import { findTool, globTool, treeTool } from '@crewx/sdk/tools';

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [
    findTool,
    globTool,
    treeTool,
  ],
});
```

**YAML Configuration:**
```yaml
agents:
  - id: filesystem_agent
    name: File System Expert
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    tools: [find, glob, tree]
    inline:
      prompt: |
        You are a file system expert with access to:
        - find: Search files by name pattern
        - glob: Search files by glob pattern
        - tree: Display directory structure

        Use the appropriate tool based on the task:
        - Use find for simple filename searches
        - Use glob for complex path patterns
        - Use tree to understand project structure
```

### Advanced Tool Examples

**File Operations Tool:**

```typescript
import fs from 'fs/promises';
import { z } from 'zod';

export const fileReadTool: FrameworkToolDefinition = {
  name: 'file_read',
  description: 'Read contents of a file',

  parameters: z.object({
    path: z.string().describe('File path to read'),
  }),

  execute: async ({ path }, context) => {
    // Security: Check execution mode
    if (context.mode !== 'execute' && context.mode !== 'query') {
      throw new Error('Invalid execution mode');
    }

    // Security: Validate path
    if (path.includes('..')) {
      throw new Error('Invalid path: .. not allowed');
    }

    try {
      const content = await fs.readFile(path, 'utf-8');
      return {
        path,
        content,
        size: content.length,
      };
    } catch (error) {
      return {
        error: true,
        message: `Failed to read ${path}: ${error.message}`,
      };
    }
  },
};
```

**Database Query Tool:**

```typescript
import { z } from 'zod';

export const queryDatabaseTool: FrameworkToolDefinition = {
  name: 'query_database',
  description: 'Execute SQL query on database',

  parameters: z.object({
    query: z.string().describe('SQL query (SELECT only)'),
  }),

  execute: async ({ query }, context) => {
    // Security: Only allow SELECT queries
    if (!query.trim().toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries allowed');
    }

    // Access database connection from context
    const dbUrl = context.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    console.log(`[${context.agent.id}] Database query: ${query}`);

    // Execute query (pseudo-code)
    try {
      const results = await executeQuery(dbUrl, query);
      return {
        rows: results,
        count: results.length,
      };
    } catch (error) {
      return {
        error: true,
        message: `Query failed: ${error.message}`,
      };
    }
  },
};
```

**Inter-Agent Communication Tool:**

```typescript
import { z } from 'zod';

export const agentCallTool: FrameworkToolDefinition = {
  name: 'agent_call',
  description: 'Call another agent for specialized tasks',

  parameters: z.object({
    agentId: z.string().describe('Target agent ID'),
    input: z.string().describe('Input for the agent'),
  }),

  execute: async ({ agentId, input }, context) => {
    // Access CrewX instance from context
    if (!context.crewx) {
      throw new Error('CrewX instance not available');
    }

    console.log(`[${context.agent.id}] Calling agent: ${agentId}`);

    try {
      // Call another agent
      const result = await context.crewx.runAgent(agentId, {
        input,
        mode: context.mode,
      });

      return {
        agentId,
        success: result.success,
        content: result.content,
      };
    } catch (error) {
      return {
        error: true,
        message: `Agent call failed: ${error.message}`,
      };
    }
  },
};
```

### Multi-Step Tool Calling

Agents can call multiple tools in sequence:

```typescript
// Agent receives: "Get weather in Seoul and translate to Korean"
//
// Step 1: Agent calls weather tool
// Step 2: Agent calls translation tool
// Step 3: Agent synthesizes final response
```

**Control max steps:**

```typescript
const response = await crewx.runAgent('research_agent', {
  input: 'Complex multi-step task',
  maxSteps: 10,  // Limit to 10 tool calls
});
```

---

## MCP Server Integration

### What is MCP?

Model Context Protocol (MCP) is a standardized protocol for connecting AI models to external tools and data sources. CrewX integrates MCP seamlessly via Mastra.

### MCP Architecture

```
┌──────────────────┐
│  CrewX Agent     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP Client      │
└────────┬─────────┘
         │ (stdio)
         ▼
┌──────────────────┐
│  MCP Server      │  ← GitHub, Slack, Filesystem, etc.
└──────────────────┘
```

### Available MCP Servers

**Official MCP Servers:**

- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-slack` - Slack integration
- `@modelcontextprotocol/server-filesystem` - File system access
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-google-drive` - Google Drive
- `@modelcontextprotocol/server-puppeteer` - Browser automation

### Step 1: Configure MCP Servers

**crewx.yaml:**

```yaml
mcp_servers:
  # GitHub MCP Server
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"
      GITHUB_OWNER: "myorg"

  # Slack MCP Server
  slack:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: "{{env.SLACK_BOT_TOKEN}}"
      SLACK_TEAM_ID: "{{env.SLACK_TEAM_ID}}"

  # Filesystem MCP Server
  filesystem:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/workspace"  # Allowed directory
    env:
      ALLOWED_DIRS: "/workspace,/tmp"

  # PostgreSQL MCP Server
  postgres:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-postgres"]
    env:
      POSTGRES_URL: "{{env.DATABASE_URL}}"
```

### Step 2: Activate MCP in Agents

```yaml
agents:
  - id: github_agent
    name: GitHub Manager
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.7
    mcp: [github]  # Activate GitHub MCP server
    inline:
      prompt: |
        You are a GitHub manager. Use GitHub tools to:
        - Search repositories
        - Create issues
        - Review pull requests
        - Manage branches

  - id: slack_agent
    name: Slack Bot
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.7
    mcp: [slack]  # Activate Slack MCP server
    inline:
      prompt: |
        You are a Slack bot. Use Slack tools to:
        - Send messages to channels
        - List channels
        - Read messages
        - React to messages
```

### Step 3: Use MCP Tools

**GitHub Operations:**

```bash
crewx execute "@github_agent Search for repositories about machine learning"

# Agent uses: github:search_repositories
```

```bash
crewx execute "@github_agent Create issue: Bug in authentication module"

# Agent uses: github:create_issue
```

**Slack Operations:**

```bash
crewx execute "@slack_agent Send message to #engineering: Deploy completed"

# Agent uses: slack:send_message
```

### MCP Tool Naming Convention

MCP tools are prefixed with server name:

```
github:search_repositories
github:create_issue
github:get_pull_request
slack:send_message
slack:list_channels
filesystem:read_file
filesystem:write_file
postgres:query
```

### Combining MCP + Injected Tools

```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

agents:
  - id: devops_agent
    name: DevOps Agent
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.5
    mcp: [github]
    tools: [deploy_service, check_logs, alert_team]  # Custom tools
    inline:
      prompt: |
        You are a DevOps engineer. Available tools:

        GitHub (MCP):
        - github:search_repositories
        - github:create_issue

        Custom:
        - deploy_service: Deploy to production
        - check_logs: Check application logs
        - alert_team: Send alerts
```

**Usage:**

```typescript
const response = await crewx.runAgent('devops_agent', {
  input: 'Deploy the latest changes and create a GitHub issue if deployment fails',
});

// Agent workflow:
// 1. Calls deploy_service (custom tool)
// 2. If failure, calls github:create_issue (MCP tool)
// 3. Calls alert_team (custom tool)
```

### Advanced MCP Configuration

**Custom MCP Server:**

```yaml
mcp_servers:
  custom_api:
    command: node
    args: ["./mcp-servers/custom-api-server.js"]
    env:
      API_KEY: "{{env.CUSTOM_API_KEY}}"
      API_URL: "{{env.CUSTOM_API_URL}}"
```

**Multiple GitHub Organizations:**

```yaml
mcp_servers:
  github_org1:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN_ORG1}}"
      GITHUB_OWNER: "org1"

  github_org2:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN_ORG2}}"
      GITHUB_OWNER: "org2"

agents:
  - id: multi_org_agent
    name: Multi-Org GitHub Agent
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    mcp: [github_org1, github_org2]
    inline:
      prompt: |
        You manage GitHub across multiple organizations:
        - github_org1:* tools for org1
        - github_org2:* tools for org2
```

### MCP Troubleshooting

**Check MCP server status:**

```bash
# Test GitHub MCP server
npx -y @modelcontextprotocol/server-github

# Should output available tools
```

**Debug MCP connection:**

```typescript
// Enable debug logging
process.env.DEBUG = 'mcp:*';

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  debug: true,
});
```

**Common Issues:**

1. **MCP server not starting**
   - Check command and args are correct
   - Verify environment variables are set
   - Test server independently

2. **Tools not available**
   - Check mcp field in agent config
   - Verify server name matches mcp_servers key
   - Check server logs

3. **Authentication errors**
   - Verify tokens/keys in environment
   - Check token permissions
   - Test API access independently

---

## CLI vs API Provider Comparison

### Architectural Differences

**CLI Provider (Spawn-based):**

```
User → CLI → Spawn Process → Claude CLI/Gemini CLI → AI Model
```

**API Provider (HTTP-based):**

```
User → CLI → MastraAPIProvider → Vercel AI SDK → AI Model API
```

### Feature Comparison

| Feature | CLI Provider | API Provider |
|---------|-------------|--------------|
| **Deployment** | Local only | Local + Server |
| **Tool Calling** | Spawn-based tools | HTTP + Function injection |
| **Mode Distinction** | query vs execute (spawn flags) | No distinction (same HTTP call) |
| **Performance** | Slower (process spawn) | Faster (HTTP) |
| **Streaming** | Yes (stdio) | Yes (HTTP SSE) |
| **MCP Support** | Limited | Full support |
| **Multi-model** | Via provider array | Via LiteLLM gateway |
| **Cost** | Provider cost only | Provider cost + gateway (if used) |

### When to Use CLI Provider

✅ **Use CLI Provider when:**

- Local development with Claude CLI/Gemini CLI/Copilot CLI
- Need spawn-based tool execution
- File system operations required
- IDE integration (MCP mode)
- Permission-based security model needed

**Example:**

```yaml
agents:
  - id: local_claude
    name: Local Claude CLI
    provider: cli/claude
    inline:
      model: sonnet
      prompt: |
        You are a local coding assistant with file system access.
```

### When to Use API Provider

✅ **Use API Provider when:**

- Server/cloud deployment
- HTTP-based tool calling
- Multi-model routing via LiteLLM
- Need 7+ different providers
- Advanced tool calling (function injection)
- MCP server integration

**Example:**

```yaml
agents:
  - id: api_claude
    name: API Claude
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    tools: [web_search, company_info]
    mcp: [github, slack]
    inline:
      prompt: |
        You are an API-based agent with tool calling and MCP integration.
```

### Migration Path

**Phase 1: Start with CLI Provider (Local Dev)**

```yaml
agents:
  - id: dev_agent
    provider: cli/claude
    inline:
      model: sonnet
      prompt: |
        Development agent
```

**Phase 2: Add API Provider (Parallel Testing)**

```yaml
agents:
  - id: dev_agent
    provider: cli/claude  # Keep for local dev
    inline:
      model: sonnet
      prompt: |
        Development agent

  - id: prod_agent
    provider: api/anthropic  # Add for production
    model: claude-sonnet-4-5-20250929
    tools: [web_search]
    inline:
      prompt: |
        Production agent
```

**Phase 3: Full Migration (Production)**

```yaml
agents:
  - id: prod_agent
    provider: api/litellm  # Use LiteLLM gateway
    url: https://gateway.mycompany.com
    model: claude-sonnet-4-5-20250929
    tools: [web_search, company_info]
    mcp: [github, slack]
    inline:
      prompt: |
        Production agent with full features
```

### Hybrid Configuration

Use both CLI and API providers together:

```yaml
agents:
  # CLI Provider for local file operations
  - id: file_agent
    name: File Manager
    provider: cli/claude
    inline:
      model: sonnet
      prompt: |
        You manage local files. Use file system tools.

  # API Provider for HTTP-based operations
  - id: api_agent
    name: API Agent
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    tools: [web_search, company_info]
    mcp: [github, slack]
    inline:
      prompt: |
        You handle API calls and external integrations.
```

**Usage:**

```bash
# Use file_agent for local operations
crewx execute "@file_agent Read project files and summarize"

# Use api_agent for API operations
crewx execute "@api_agent Search GitHub for similar projects"
```

---

## Troubleshooting Guide

### Common Issues

#### 1. API Key Not Found

**Error:**

```
Error: Provider api/openai not available - check API key
```

**Solution:**

```bash
# Check environment variables
echo $OPENAI_API_KEY

# Set in .env file
echo "OPENAI_API_KEY=sk-..." >> .env

# Load .env
export $(cat .env | xargs)

# Verify with doctor
crewx doctor
```

#### 2. Model Not Found

**Error:**

```
Error: Model 'gpt-5' not found
```

**Solution:**

Check model name matches provider's supported models:

```yaml
# ❌ Wrong
provider: api/openai
model: gpt-5  # Doesn't exist

# ✅ Correct
provider: api/openai
model: gpt-5.1-chat-latest  # Valid model
```

#### 3. Tool Not Available

**Error:**

```
Agent called tool 'weather' but tool not found
```

**Solution:**

1. Check tool is injected:

```typescript
const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [weatherTool],  // Must inject tool
});
```

2. Check tool is activated in YAML:

```yaml
agents:
  - id: my_agent
    tools: [weather]  # Must activate
```

#### 4. MCP Server Connection Failed

**Error:**

```
Error: Failed to connect to MCP server 'github'
```

**Solution:**

1. Test MCP server independently:

```bash
npx -y @modelcontextprotocol/server-github
```

2. Check environment variables:

```bash
echo $GITHUB_TOKEN
```

3. Check server configuration:

```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"  # Check this
```

#### 5. LiteLLM Gateway Not Responding

**Error:**

```
Error: Connection refused to http://localhost:4000
```

**Solution:**

1. Check LiteLLM is running:

```bash
curl http://localhost:4000/health
```

2. Start LiteLLM:

```bash
# Docker
docker start litellm

# Python
litellm --config litellm_config.yaml
```

3. Check URL in config:

```yaml
agents:
  - id: my_agent
    provider: api/litellm
    url: http://localhost:4000  # Verify URL
```

#### 6. Rate Limit Exceeded

**Error:**

```
Error: Rate limit exceeded (429)
```

**Solution:**

1. Add retry logic:

```typescript
async function queryWithRetry(provider, prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await provider.query(prompt);
    } catch (error) {
      if (error.status === 429) {
        // Wait exponentially
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
}
```

2. Use LiteLLM for load balancing:

```yaml
# litellm_config.yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: ${KEY_1}

  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: ${KEY_2}  # Second key for load balancing
```

#### 7. Tool Execution Timeout

**Error:**

```
Error: Tool execution timed out after 30000ms
```

**Solution:**

1. Increase timeout in tool:

```typescript
const myTool: FrameworkToolDefinition = {
  name: 'slow_tool',
  // ...
  execute: async (args, context) => {
    // Add timeout handling
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 60000)
    );

    return Promise.race([
      actualOperation(args),
      timeoutPromise,
    ]);
  },
};
```

2. Set timeout in query options:

```typescript
const response = await provider.query(prompt, {
  timeout: 60000,  // 60 seconds
});
```

### Debugging Tips

**1. Enable Debug Logging:**

```bash
export DEBUG=crewx:*
crewx query "@my_agent test"
```

**2. Check Provider Status:**

```bash
crewx doctor
```

**Expected Output:**

```
CrewX System Check
==================

✅ API Providers:
  ✅ api/openai (OPENAI_API_KEY found)
  ✅ api/anthropic (ANTHROPIC_API_KEY found)
  ❌ api/google (GOOGLE_API_KEY not found)

✅ CLI Providers:
  ✅ cli/claude (claude CLI found)

✅ Configuration:
  ✅ crewx.yaml found
  ✅ 3 agents configured
  ✅ 2 MCP servers configured
```

**3. Test Tools Independently:**

```typescript
// test-tool.ts
import { weatherTool } from './tools/weather.tool';

async function testTool() {
  const result = await weatherTool.execute(
    { city: 'Seoul', units: 'celsius' },
    {
      agent: { id: 'test', provider: 'api/openai', model: 'gpt-4' },
      env: process.env,
      vars: {},
    }
  );

  console.log('Tool result:', result);
}

testTool();
```

**4. Validate YAML:**

```bash
# Check YAML syntax
crewx config validate

# View parsed config
crewx config show
```

**5. Test MCP Servers:**

```bash
# Test GitHub server
GITHUB_TOKEN=xxx npx -y @modelcontextprotocol/server-github

# Should list available tools
```

### Performance Optimization

**1. Reduce Token Usage:**

```yaml
agents:
  - id: efficient_agent
    provider: api/openai
    model: gpt-4
    maxTokens: 1000  # Limit response length
    temperature: 0.3  # More focused
```

**2. Use Cheaper Models for Simple Tasks:**

```yaml
# Expensive (complex reasoning)
- id: architect_agent
  provider: api/anthropic
  model: claude-3-opus-20240229  # Most expensive

# Balanced (general tasks)
- id: general_agent
  provider: api/anthropic
  model: claude-sonnet-4-5-20250929  # Recommended

# Cheap (simple tasks)
- id: simple_agent
  provider: api/anthropic
  model: claude-3-haiku-20240307  # Cheapest
```

**3. Cache Tool Results:**

```typescript
const cachedTool: FrameworkToolDefinition = {
  name: 'cached_search',
  // ...
  execute: async ({ query }, context) => {
    const cacheKey = `search:${query}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Execute and cache
    const result = await expensiveSearch(query);
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    return result;
  },
};
```

**4. Limit Tool Calling Steps:**

```typescript
const response = await provider.query(prompt, {
  maxSteps: 5,  // Prevent infinite loops
});
```

---

## Provider Options

### Overview

Provider Options is a powerful feature that allows fine-grained control over tool and MCP server access based on execution mode (query vs execute). This provides enhanced security and functionality control for API providers.

### Key Features

- **Mode-specific configuration**: Different tool sets for query vs execute modes
- **Enhanced security**: Restrict dangerous operations to execute mode only
- **Legacy compatibility**: Automatic conversion from root-level tools/mcp fields
- **Flexible configuration**: Support for both array and object formats

### Configuration Format

#### New Format (Recommended)

```yaml
agents:
  - name: secure_agent
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    options:
      query:                     # Read-only operations
        tools: [file_read, grep, glob]
        mcp: [filesystem]
      execute:                   # Write operations allowed
        tools: [file_read, file_write, run_shell]
        mcp: [filesystem, git, database]
```

#### Legacy Format (Auto-converted)

```yaml
agents:
  - name: simple_agent
    provider: api/anthropic
    tools: [file_read, file_write]       # Auto-converts to execute.tools
    mcp_servers: [filesystem]            # Auto-converts to execute.mcp
```

### Mode Distinction

#### Query Mode (Read-Only)
- **Purpose**: Analysis, research, code review
- **Tools**: Read-only operations (file_read, grep, web_search)
- **MCP**: Read-only servers (filesystem read, GitHub read)
- **Security**: Safest mode, minimal risk

#### Execute Mode (Read/Write)
- **Purpose**: File modification, deployment, automation
- **Tools**: All operations including write (file_write, run_shell)
- **MCP**: All servers including write operations
- **Security**: Requires explicit user confirmation

### Practical Examples

#### Development Agent with Security

```yaml
agents:
  - name: dev_assistant
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    options:
      query:
        tools: [file_read, grep, glob]           # Code analysis only
        mcp: [github]                           # Read GitHub data
      execute:
        tools: [file_read, file_write, git]      # Full development tools
        mcp: [github, filesystem]                # Write to GitHub and files
    inline:
      prompt: |
        You are a development assistant.
        In query mode: Analyze and review code
        In execute mode: Make changes and deploy
```

#### Research Agent (Query-Only)

```yaml
agents:
  - name: research_bot
    provider: api/openai
    model: gpt-5.1-chat-latest
    options:
      query:
        tools: [web_search, company_info]      # Research tools
        mcp: []                                 # No MCP needed
      execute:
        tools: []                               # No write tools
        mcp: []                                 # No MCP access
    inline:
      prompt: |
        You are a research specialist.
        Only perform analysis and research tasks.
```

#### DevOps Agent (Full Access)

```yaml
agents:
  - name: devops_engineer
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    options:
      query:
        tools: [check_logs, status_check]       # Monitoring tools
        mcp: [kubernetes]                        # Read cluster status
      execute:
        tools: [deploy_service, restart_service] # Deployment tools
        mcp: [kubernetes, docker]               # Full cluster control
    inline:
      prompt: |
        You are a DevOps engineer with infrastructure access.
```

### Migration from Legacy Format

#### Before (Legacy)

```yaml
agents:
  - name: my_agent
    provider: api/anthropic
    tools: [file_read, file_write, grep]
    mcp_servers: [filesystem, github]
```

#### After (Auto-converted)

```yaml
agents:
  - name: my_agent
    provider: api/anthropic
    options:
      execute:
        tools: [file_read, file_write, grep]
        mcp: [filesystem, github]
```

**Note**: Legacy format automatically converts to execute mode only, maintaining backward compatibility.

### Best Practices

#### 1. Security-First Configuration

```yaml
# ✅ Good: Restrictive query mode
options:
  query:
    tools: [file_read]          # Minimal read-only tools
    mcp: [github]               # Read-only MCP
  execute:
    tools: [file_read, file_write]  # Full access when needed
    mcp: [github, filesystem]       # Write access when needed

# ❌ Bad: Overly permissive
options:
  query:
    tools: [file_read, file_write, run_shell]  # Too permissive
    mcp: [github, filesystem, docker]          # Too permissive
```

#### 2. Explicit Mode Declaration

```yaml
# ✅ Good: Clear mode separation
agents:
  - name: analyzer
    options:
      query: { tools: [read_tools] }
      execute: { tools: [write_tools] }

# ❌ Bad: Ambiguous configuration
agents:
  - name: analyzer
    tools: [read_tools, write_tools]  # Unclear mode assignment
```

#### 3. Tool Organization

```yaml
# ✅ Good: Logical grouping
options:
  query:
    tools: [file_read, grep, search]          # Analysis tools
    mcp: [github_read, database_read]         # Read-only MCP
  execute:
    tools: [file_write, deploy, notify]       # Action tools
    mcp: [github_write, database_write]       # Write MCP
```

### Troubleshooting

#### Provider Options Not Working

1. **Check YAML syntax**:
   ```bash
   crewx config validate
   ```

2. **Verify tool names**:
   ```bash
   crewx doctor  # Shows available tools
   ```

3. **Test mode-specific behavior**:
   ```bash
   # Test query mode
   crewx query "@agent analyze this file"
   
   # Test execute mode
   crewx execute "@agent modify this file"
   ```

#### Legacy Conversion Issues

1. **Check conversion logs**:
   ```bash
   DEBUG=crewx:* crewx query "@agent test"
   ```

2. **Manual conversion**:
   ```yaml
   # Convert manually for clarity
   tools: [old_tools]      # ❌ Legacy
   mcp_servers: [old_mcp]  # ❌ Legacy
   
   options:
     execute:
       tools: [old_tools]  # ✅ New format
       mcp: [old_mcp]      # ✅ New format
   ```

### Integration with Existing Features

Provider Options work seamlessly with:
- **LiteLLM Gateway**: Mode-specific routing
- **MCP Servers**: Granular server access control
- **Tool Injection**: Dynamic tool availability
- **Environment Variables**: Context-aware configuration

---

## Advanced Topics

### Custom Provider URLs

Override default provider URLs:

```yaml
agents:
  # Custom OpenAI-compatible endpoint
  - id: custom_openai
    provider: api/openai
    url: https://my-proxy.com/v1
    model: gpt-4
    inline:
      prompt: |
        Custom OpenAI endpoint

  # Self-hosted LiteLLM
  - id: self_hosted_litellm
    provider: api/litellm
    url: https://litellm.mycompany.com
    model: claude-sonnet-4-5-20250929
```

### Dynamic Configuration

Load configuration at runtime:

```typescript
import { CrewX } from '@crewx/sdk';

// Load different configs per environment
const configPath = process.env.NODE_ENV === 'production'
  ? 'crewx.prod.yaml'
  : 'crewx.dev.yaml';

const crewx = new CrewX({
  configPath,
  tools: [...],
});
```

### Security Best Practices

**1. Environment Variable Management:**

```yaml
# ✅ Good: Use environment variables
agents:
  - id: secure_agent
    provider: api/anthropic
    # apiKey from ANTHROPIC_API_KEY env var

# ❌ Bad: Hardcode API keys
agents:
  - id: insecure_agent
    provider: api/anthropic
    apiKey: sk-hardcoded-key  # Never do this!
```

**2. Tool Input Validation:**

```typescript
const secureTool: FrameworkToolDefinition = {
  name: 'secure_file_read',
  parameters: z.object({
    path: z.string().refine(
      (path) => !path.includes('..'),
      { message: 'Path traversal not allowed' }
    ),
  }),
  execute: async ({ path }, context) => {
    // Additional security checks
    if (path.startsWith('/etc/') || path.startsWith('/root/')) {
      throw new Error('Access denied');
    }

    return fs.readFile(path, 'utf-8');
  },
};
```

**3. Rate Limiting:**

```typescript
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({ tokensPerInterval: 10, interval: 'minute' });

const rateLimitedTool: FrameworkToolDefinition = {
  name: 'rate_limited_api',
  // ...
  execute: async (args, context) => {
    // Check rate limit
    const allowed = await limiter.removeTokens(1);
    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }

    return apiCall(args);
  },
};
```

### Multi-Model Strategies

**Strategy 1: Routing by Task Type**

```yaml
agents:
  # Coding tasks → GPT-4
  - id: coder
    provider: api/openai
    model: gpt-5.1-chat-latest
    temperature: 0.0

  # Writing tasks → Claude
  - id: writer
    provider: api/anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.8

  # Analysis tasks → Gemini
  - id: analyst
    provider: api/google
    model: gemini-1.5-pro
    temperature: 0.5
```

**Strategy 2: Cost-Based Routing**

```yaml
# Route through LiteLLM with cost-based strategy
agents:
  - id: cost_optimizer
    provider: api/litellm
    url: http://localhost:4000
    model: smart-router  # LiteLLM router
```

**litellm_config.yaml:**

```yaml
router_settings:
  routing_strategy: cost-based-routing
  model_group_alias:
    smart-router:
      - claude-3-haiku-20240307     # Cheapest first
      - claude-3-sonnet-20240229     # Medium
      - claude-sonnet-4-5-20250929  # Fallback
```

### Monitoring and Logging

**Tool Usage Logging:**

```typescript
const monitoredTool: FrameworkToolDefinition = {
  name: 'monitored_tool',
  // ...
  execute: async (args, context) => {
    const startTime = Date.now();

    try {
      const result = await actualToolExecution(args);

      // Log success
      await logToolUsage({
        agentId: context.agent.id,
        toolName: 'monitored_tool',
        args,
        duration: Date.now() - startTime,
        success: true,
      });

      return result;
    } catch (error) {
      // Log failure
      await logToolUsage({
        agentId: context.agent.id,
        toolName: 'monitored_tool',
        args,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
      });

      throw error;
    }
  },
};
```

**Agent Call Logging:**

```typescript
const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [...],

  // Hook for logging
  onAgentCall: async (agentId, input) => {
    console.log(`[${new Date().toISOString()}] Agent call: ${agentId}`);
    await logToDatabase({ agentId, input, timestamp: new Date() });
  },

  onAgentResponse: async (agentId, response) => {
    console.log(`[${new Date().toISOString()}] Agent response: ${agentId}`);
    await logToDatabase({ agentId, response, timestamp: new Date() });
  },
});
```

---

## Conclusion

This guide covered the essentials of CrewX API Providers:

- ✅ Quick Start (5 minutes to first agent)
- ✅ LiteLLM Gateway (unified multi-model interface)
- ✅ YAML Configuration (flexible, powerful)
- ✅ Tool Calling (function injection pattern)
- ✅ MCP Integration (standardized external tools)
- ✅ CLI vs API Comparison (when to use each)
- ✅ Troubleshooting (common issues and solutions)
- ✅ Provider Options - Enhanced API provider configuration

### Next Steps

1. **Read API Reference**: [docs/api-provider-reference.md](./api-provider-reference.md)
2. **Try Examples**: [examples/](../examples/)
3. **Migration Guide**: [docs/migration-to-api-provider.md](./migration-to-api-provider.md)

### Support

- GitHub Issues: https://github.com/sowonai/crewx/issues
- Documentation: https://crewx.dev/docs
- Community: https://discord.gg/crewx

---

**End of API Provider User Guide**
