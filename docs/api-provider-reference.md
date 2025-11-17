# CrewX API Provider Reference

> **Version**: 0.1.x
> **Status**: Production Ready
> **Last Updated**: 2025-11-12

This document provides a comprehensive reference for the CrewX API Provider system, which enables HTTP-based AI agent creation using multiple provider backends.

---

## Table of Contents

1. [Overview](#overview)
2. [MastraAPIProvider](#mastraapiprovider)
3. [APIProviderConfig](#apiproviderconfig)
4. [Tool Calling System](#tool-calling-system)
5. [MCP Integration](#mcp-integration)
6. [Provider Types](#provider-types)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Overview

### Architecture

CrewX API Provider wraps the Mastra framework to provide AI agent capabilities via HTTP APIs. It supports 7 different provider types:

- **api/openai** - OpenAI API
- **api/anthropic** - Anthropic (Claude) API
- **api/google** - Google AI API
- **api/bedrock** - AWS Bedrock
- **api/litellm** - LiteLLM Gateway
- **api/ollama** - Ollama (local)
- **api/sowonai** - SowonAI

### Key Features

- ✅ **7 Provider Types** - Support for major AI platforms
- ✅ **Tool Calling** - Built-in tool execution via Mastra Agent
- ✅ **MCP Integration** - Model Context Protocol support
- ✅ **Vercel AI SDK** - Based on proven framework
- ✅ **Function Injection** - SowonFlow-style tool injection pattern
- ✅ **Context Passing** - Rich execution context for tools

### Integration Points

```
┌─────────────┐
│   CrewX     │
│   CLI/SDK   │
└──────┬──────┘
       │
       ▼
┌────────────────────┐
│ MastraAPIProvider  │  ← Main API Provider Class
├────────────────────┤
│ - query()          │
│ - execute()        │
│ - setTools()       │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│  Mastra Agent      │  ← Wraps Vercel AI SDK
├────────────────────┤
│ - Tool execution   │
│ - Model calling    │
│ - Response format  │
└────────────────────┘
```

---

## MastraAPIProvider

### Class Definition

```typescript
class MastraAPIProvider implements AIProvider {
  readonly name: string;

  constructor(config: APIProviderConfig);

  // Core Methods
  async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  async execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  setTools(tools: FrameworkToolDefinition[], context: ToolExecutionContext): void;

  // Utility Methods
  async isAvailable(): Promise<boolean>;
  async getToolPath(): Promise<string | null>;
}
```

### Constructor

**Signature:**
```typescript
constructor(config: APIProviderConfig)
```

**Parameters:**
- `config` (APIProviderConfig): Provider configuration

**Description:**
Creates a new MastraAPIProvider instance. Initializes the underlying Vercel AI SDK model based on the provider type.

**Example:**
```typescript
import { MastraAPIProvider } from '@crewx/sdk';

const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  url: 'https://api.openai.com/v1',
  temperature: 0.7,
  maxTokens: 2000,
});
```

**Internal Behavior:**
1. Validates configuration
2. Creates appropriate Vercel AI SDK model instance
3. Handles environment variable injection
4. Restores original environment state

---

### query()

**Signature:**
```typescript
async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>
```

**Parameters:**
- `prompt` (string): User query or prompt
- `options` (AIQueryOptions, optional): Query options

**Returns:**
`Promise<AIResponse>` - AI response with content, provider info, and metadata

**Description:**
Executes a read-only query against the AI model. For API providers, this is functionally identical to `execute()` (no mode distinction).

**AIQueryOptions Interface:**
```typescript
interface AIQueryOptions {
  taskId?: string;          // Optional task identifier
  timeout?: number;         // Timeout in milliseconds
  maxSteps?: number;        // Max tool calling steps (default: 10)
  conversationId?: string;  // Conversation tracking
}
```

**AIResponse Interface:**
```typescript
interface AIResponse {
  content: string;          // AI response text
  provider: string;         // Provider identifier
  command: string;          // Command executed
  success: boolean;         // Success status
  error?: string;           // Error message (if failed)
  taskId: string;           // Task identifier
  toolCall?: {              // Tool call info (if used)
    toolName: string;
    toolInput: any;
    toolResult: any;
  };
}
```

**Example:**
```typescript
const response = await provider.query('What is the weather in Seoul?', {
  taskId: 'query_001',
  maxSteps: 5,
});

console.log(response.content);  // "The current weather in Seoul is..."
console.log(response.toolCall); // { toolName: "weather", ... }
```

**Error Handling:**
```typescript
try {
  const response = await provider.query('Complex query');

  if (!response.success) {
    console.error('Query failed:', response.error);
  }
} catch (error) {
  console.error('Exception:', error.message);
}
```

---

### execute()

**Signature:**
```typescript
async execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse>
```

**Parameters:**
- `prompt` (string): User task or command
- `options` (AIQueryOptions, optional): Execute options

**Returns:**
`Promise<AIResponse>` - AI response

**Description:**
Execute mode for API providers. **Note**: For API providers, this is identical to `query()`. The mode distinction only applies to CLI providers (spawn-based).

**Example:**
```typescript
const response = await provider.execute('Create a summary report', {
  taskId: 'exec_001',
});

console.log(response.content);
```

**Why No Mode Distinction?**

CLI Providers:
- `query`: Spawn with read-only flags (`--permission-mode=view`)
- `execute`: Spawn with write flags (`--permission-mode=acceptEdits`)

API Providers:
- `query` and `execute` both call Mastra Agent
- Mode distinction handled at CLI/SDK layer, not provider layer

---

### setTools()

**Signature:**
```typescript
setTools(tools: FrameworkToolDefinition[], context: ToolExecutionContext): void
```

**Parameters:**
- `tools` (FrameworkToolDefinition[]): Array of tool definitions
- `context` (ToolExecutionContext): Execution context to inject

**Description:**
Sets tools for the agent and injects execution context. Tools are converted to Mastra format using MastraToolAdapter before being passed to the agent.

**Example:**
```typescript
import { z } from 'zod';

const weatherTool = {
  name: 'weather',
  description: 'Get current weather',
  parameters: z.object({
    city: z.string(),
  }),
  execute: async ({ city }, context) => {
    console.log(`Agent ${context.agent.id} requesting weather`);
    const response = await fetch(`https://api.weather.com?city=${city}`);
    return response.json();
  },
};

provider.setTools([weatherTool], {
  agent: {
    id: 'my_agent',
    provider: 'api/openai',
    model: 'gpt-4',
  },
  env: process.env,
  vars: { apiVersion: 'v1' },
  mode: 'query',
});
```

**Tool Execution Flow:**
```
User Query: "What's the weather in Seoul?"
    ↓
Agent analyzes query
    ↓
Agent calls weather tool
    ↓
MastraToolAdapter wraps tool with context
    ↓
Tool executes with full context
    ↓
Result returned to agent
    ↓
Agent generates final response
```

---

### isAvailable()

**Signature:**
```typescript
async isAvailable(): Promise<boolean>
```

**Returns:**
`Promise<boolean>` - true if provider is available

**Description:**
Checks if the provider is available by verifying API key configuration. Does not make actual HTTP calls (for performance).

**Example:**
```typescript
const available = await provider.isAvailable();

if (!available) {
  console.error('Provider not available - check API key');
}
```

**Provider-Specific Checks:**
- **api/openai**: `OPENAI_API_KEY` or `config.apiKey`
- **api/anthropic**: `ANTHROPIC_API_KEY` or `config.apiKey`
- **api/google**: `GOOGLE_API_KEY` or `config.apiKey`
- **api/bedrock**: `AWS_ACCESS_KEY_ID` (uses AWS credentials)
- **api/litellm**: `LITELLM_API_KEY` or `config.apiKey`
- **api/ollama**: Always returns true (no key needed)
- **api/sowonai**: `SOWONAI_API_KEY` or `config.apiKey`

---

### getToolPath()

**Signature:**
```typescript
async getToolPath(): Promise<string | null>
```

**Returns:**
`Promise<string | null>` - Always returns null for API providers

**Description:**
Returns the path to local tool executable. API providers are HTTP-based and have no local tools, so this always returns null.

**Example:**
```typescript
const toolPath = await provider.getToolPath();
console.log(toolPath); // null
```

---

## APIProviderConfig

### Type Definition

```typescript
type APIProviderType =
  | 'api/openai'
  | 'api/anthropic'
  | 'api/google'
  | 'api/bedrock'
  | 'api/litellm'
  | 'api/ollama'
  | 'api/sowonai';

interface APIProviderConfig {
  provider: APIProviderType;
  url?: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  mcp?: string[];
}
```

### Field Reference

#### provider

**Type:** `APIProviderType` (required)

**Description:**
The provider type identifier. Determines which AI service to use.

**Possible Values:**
- `api/openai` - OpenAI API
- `api/anthropic` - Anthropic (Claude) API
- `api/google` - Google AI API
- `api/bedrock` - AWS Bedrock
- `api/litellm` - LiteLLM Gateway
- `api/ollama` - Ollama (local)
- `api/sowonai` - SowonAI

**Example:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',
  // ...
};
```

---

#### url

**Type:** `string` (optional)

**Description:**
API base URL. If not provided, uses provider-specific defaults.

**Default Values:**
- `api/openai`: `https://api.openai.com/v1`
- `api/anthropic`: `https://api.anthropic.com`
- `api/google`: `https://generativelanguage.googleapis.com/v1`
- `api/bedrock`: `https://bedrock-runtime.us-east-1.amazonaws.com`
- `api/litellm`: `http://localhost:4000`
- `api/ollama`: `http://localhost:11434/v1`
- `api/sowonai`: `https://api.sowon.ai/v1`

**Example:**
```typescript
// Custom LiteLLM gateway
const config: APIProviderConfig = {
  provider: 'api/litellm',
  url: 'https://gateway.mycompany.com',
  model: 'claude-3-5-sonnet-20241022',
};

// Local Ollama with custom port
const config2: APIProviderConfig = {
  provider: 'api/ollama',
  url: 'http://localhost:8080/v1',
  model: 'llama3.2',
};
```

---

#### apiKey

**Type:** `string` (optional)

**Description:**
API key for authentication. If not provided, uses environment variables.

**Environment Variable Mapping:**
- `api/openai` → `OPENAI_API_KEY`
- `api/anthropic` → `ANTHROPIC_API_KEY`
- `api/google` → `GOOGLE_API_KEY`
- `api/bedrock` → Uses AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- `api/litellm` → `LITELLM_API_KEY`
- `api/ollama` → Not required
- `api/sowonai` → `SOWONAI_API_KEY`

**Example:**
```typescript
// Explicit API key (not recommended for production)
const config: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4',
  apiKey: 'sk-...',  // ⚠️ Avoid hardcoding
};

// Use environment variable (recommended)
const config2: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4',
  // apiKey not specified - uses process.env.OPENAI_API_KEY
};
```

**Security Best Practice:**
```typescript
// ✅ Good: Use environment variables
process.env.OPENAI_API_KEY = 'sk-...';
const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
});

// ❌ Bad: Hardcode API keys
const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
  apiKey: 'sk-hardcoded-key',  // Never do this!
});
```

---

#### model

**Type:** `string` (required)

**Description:**
Exact model identifier understood by the API. Model names vary by provider.

**Provider-Specific Models:**

**OpenAI:**
- `gpt-4o` - Latest GPT-4 Omni
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo

**Anthropic:**
- `claude-3-5-sonnet-20241022` - Claude 3.5 Sonnet (latest)
- `claude-3-opus-20240229` - Claude 3 Opus
- `claude-3-sonnet-20240229` - Claude 3 Sonnet
- `claude-3-haiku-20240307` - Claude 3 Haiku

**Google:**
- `gemini-2.0-flash-exp` - Gemini 2.0 Flash (experimental)
- `gemini-1.5-pro` - Gemini 1.5 Pro
- `gemini-1.5-flash` - Gemini 1.5 Flash

**Bedrock:**
- `anthropic.claude-3-5-sonnet-20241022-v2:0` - Claude 3.5 Sonnet on Bedrock
- `anthropic.claude-3-opus-20240229-v1:0` - Claude 3 Opus on Bedrock

**LiteLLM (any model routed through gateway):**
- `claude-3-5-sonnet-20241022` - Via Anthropic
- `gpt-4` - Via OpenAI
- `gemini-pro` - Via Google

**Ollama (local models):**
- `llama3.2` - Llama 3.2
- `mistral` - Mistral
- `codellama` - Code Llama

**SowonAI:**
- `sowon-v1` - SowonAI model

**Example:**
```typescript
// OpenAI
const config1: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4o',
};

// Anthropic
const config2: APIProviderConfig = {
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',
};

// LiteLLM routing to Anthropic
const config3: APIProviderConfig = {
  provider: 'api/litellm',
  url: 'http://localhost:4000',
  model: 'claude-3-5-sonnet-20241022',  // LiteLLM routes to Anthropic
};
```

---

#### temperature

**Type:** `number` (optional)

**Description:**
Sampling temperature (0.0 - 2.0). Controls randomness in responses.

**Default:** Provider-specific (usually 0.7 or 1.0)

**Range:**
- `0.0` - Deterministic, focused responses
- `0.7` - Balanced (recommended)
- `1.0` - Creative, varied responses
- `2.0` - Highly random (rarely used)

**Example:**
```typescript
// Deterministic responses (coding, factual tasks)
const config1: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4',
  temperature: 0.0,
};

// Creative responses (writing, brainstorming)
const config2: APIProviderConfig = {
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 1.2,
};
```

---

#### maxTokens

**Type:** `number` (optional)

**Description:**
Maximum number of tokens in the completion. Limits response length.

**Default:** Provider-specific (varies by model)

**Example:**
```typescript
// Short responses
const config1: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4',
  maxTokens: 500,  // ~375 words
};

// Long-form responses
const config2: APIProviderConfig = {
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000,  // ~3000 words
};
```

**Token Estimation:**
- 1 token ≈ 0.75 words (English)
- 1 token ≈ 0.5 characters (English)

---

#### tools

**Type:** `string[]` (optional)

**Description:**
Array of tool names to activate for this agent. Tools must be registered in the ToolRegistry (via function injection).

**Example:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4',
  tools: ['weather', 'company_search', 'github'],  // Tool names
};
```

**YAML Example:**
```yaml
agents:
  - id: research_agent
    provider: api/openai
    model: gpt-4
    tools: [company_search, weather, github]  # Simple array
```

**Important Notes:**
1. Tools are **not defined in YAML** (only activated)
2. Tools must be registered via function injection
3. Tool names can reference MCP tools using `server:tool` format

---

#### mcp

**Type:** `string[]` (optional)

**Description:**
Array of MCP server names to activate for this agent. MCP servers must be defined in `mcp_servers` section.

**Example:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/openai',
  model: 'gpt-4',
  mcp: ['github', 'slack'],  // MCP server names
};
```

**YAML Example:**
```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

agents:
  - id: research_agent
    provider: api/openai
    model: gpt-4
    mcp: [github]  # Activates github MCP server
```

---

## Tool Calling System

### Overview

CrewX uses the **function injection pattern** inspired by SowonFlow. Tools are defined in TypeScript code and injected via the framework API, not in YAML.

### Architecture

```
┌─────────────────────────────────────────┐
│          CrewX Framework                │
│  tools: [tool1, tool2] (injected)       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         ToolRegistry                    │
│  - Manages injected tools               │
│  - Manages MCP tools                    │
│  - Apply include/exclude filters        │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      MastraToolAdapter                  │
│  - Convert CrewX tools → Mastra tools   │
│  - Inject ToolExecutionContext          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Mastra Agent                    │
│  - Execute tool calls                   │
│  - Multi-step reasoning                 │
└─────────────────────────────────────────┘
```

### FrameworkToolDefinition

```typescript
interface FrameworkToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;  // Zod schema for validation
  execute: (args: any, context: ToolExecutionContext) => Promise<any>;
}
```

### Tool Definition Example

```typescript
import { z } from 'zod';

const weatherTool: FrameworkToolDefinition = {
  name: 'weather',
  description: 'Get current weather for a city',

  // Zod schema for input validation
  parameters: z.object({
    city: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
  }),

  // Execute function with context
  execute: async ({ city, units }, context) => {
    // Access agent info
    console.log(`Agent ${context.agent.id} requesting weather`);

    // Access environment variables
    const apiKey = context.env.WEATHER_API_KEY;

    // Access custom variables
    const apiVersion = context.vars?.apiVersion || 'v1';

    // Make API call
    const response = await fetch(
      `https://api.weather.com/${apiVersion}/current?city=${city}&units=${units}`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );

    return response.json();
  },
};
```

### Tool Execution Context

The `ToolExecutionContext` provides rich context to tool functions, matching the template rendering system exactly.

```typescript
interface ToolExecutionContext {
  // Agent information
  agent: {
    id: string;              // Agent ID
    provider: string;        // Provider type
    model: string;           // Model name
    temperature?: number;
    maxTokens?: number;
  };

  // Agent metadata
  agentMetadata?: Record<string, any>;

  // Environment variables ({{env.VAR}})
  env: Record<string, string>;

  // User-defined context ({{context.key}})
  context?: Record<string, any>;

  // Custom variables ({{vars.key}})
  vars?: Record<string, any>;

  // Execution mode ({{mode}})
  mode?: 'query' | 'execute';

  // Conversation messages ({{messages.length}})
  messages?: any[];

  // Platform ({{platform}})
  platform?: string;

  // Tools info ({{tools.count}})
  tools?: {
    available: string[];
    count: number;
    json?: string;
  };

  // Document access ({{documents.name.content}})
  documents?: Record<string, {
    content?: string;
    toc?: string;
    summary?: string;
  }>;

  // Request metadata
  request?: {
    timestamp: Date;
    conversationId?: string;
    threadId?: string;
  };

  // CrewX instance for inter-agent communication
  crewx?: CrewXInstance;
}
```

### Context Usage Examples

**Accessing Agent Info:**
```typescript
execute: async (args, context) => {
  console.log(`Agent: ${context.agent.id}`);
  console.log(`Model: ${context.agent.model}`);
  console.log(`Provider: ${context.agent.provider}`);
}
```

**Accessing Environment Variables:**
```typescript
execute: async (args, context) => {
  const apiKey = context.env.API_KEY;
  const debug = context.env.DEBUG === 'true';
}
```

**Accessing Custom Variables:**
```typescript
execute: async (args, context) => {
  const companyName = context.vars?.companyName;
  const apiVersion = context.vars?.apiVersion || 'v1';
}
```

**Checking Execution Mode:**
```typescript
execute: async (args, context) => {
  if (context.mode === 'execute') {
    // Perform write operations
  } else {
    // Read-only operations
  }
}
```

**Inter-Agent Communication:**
```typescript
execute: async (args, context) => {
  // Call another agent
  const result = await context.crewx?.runAgent('translator', {
    input: 'Translate: Hello World',
  });

  return result.content;
}
```

### Tool Registration

**Function Injection Pattern:**

```typescript
import { CrewX, MastraAPIProvider } from '@crewx/sdk';
import { weatherTool, companySearchTool } from './tools';

// Create CrewX instance with injected tools
const crewx = new CrewX({
  configPath: 'crewx.yaml',

  // Inject tools (function injection!)
  tools: [
    weatherTool,
    companySearchTool,
    // ... more tools
  ],
});

// Tools are now available to all agents
const response = await crewx.runAgent('research_agent', {
  input: 'What is the weather in Seoul?',
});
```

**YAML Activation:**

```yaml
agents:
  - id: research_agent
    provider: api/openai
    model: gpt-4
    tools: [weather, company_search]  # Activate injected tools
```

### Multi-Step Tool Calling

Mastra Agent supports multi-step tool calling with automatic reasoning:

```typescript
const response = await provider.query(
  'Find weather in Seoul and translate to Korean',
  {
    maxSteps: 10,  // Allow up to 10 tool calls
  }
);
```

**Execution Flow:**
```
Step 1: Agent analyzes query
Step 2: Agent calls weather tool (city: "Seoul")
Step 3: Weather tool returns data
Step 4: Agent calls translator tool (text: weather data)
Step 5: Translator returns Korean text
Step 6: Agent generates final response
```

---

## MCP Integration

### Overview

Model Context Protocol (MCP) enables agents to access external tools via standardized servers. CrewX integrates MCP seamlessly with the Mastra framework.

### MCPServerConfig

```typescript
interface MCPServerConfig {
  command: string;          // Executable command
  args: string[];           // Command arguments
  env?: Record<string, string>;  // Environment variables
}
```

### MCP Server Configuration

**YAML Example:**

```yaml
mcp_servers:
  # GitHub MCP Server
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

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
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
```

### Agent MCP Activation

**YAML Example:**

```yaml
agents:
  - id: research_agent
    provider: api/openai
    model: gpt-4
    mcp: [github, slack]  # Activate MCP servers
    tools: [weather]      # Mix with injected tools
```

### MCP Tool Naming Convention

MCP tools are automatically prefixed with server name:

```
github:search_repositories
github:create_issue
slack:send_message
slack:list_channels
filesystem:read_file
filesystem:write_file
```

### Using MCP Tools in YAML

```yaml
agents:
  - id: github_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    mcp: [github]
    tools:
      - github:search_repositories  # MCP tool
      - github:create_issue         # MCP tool
      - company_search              # Injected tool
```

### MCP + Injected Tools

MCP tools and injected tools work together seamlessly:

```typescript
const crewx = new CrewX({
  configPath: 'crewx.yaml',

  // Injected tools
  tools: [weatherTool, companySearchTool],

  // MCP servers automatically loaded from YAML
});
```

**Agent sees both:**
- `weather` (injected)
- `company_search` (injected)
- `github:search_repositories` (MCP)
- `github:create_issue` (MCP)

### MCP Server Lifecycle

```
1. CrewX initialization
   ↓
2. Connect to MCP servers (stdio transport)
   ↓
3. List available tools from each server
   ↓
4. Register tools in ToolRegistry
   ↓
5. Agent activates tools via mcp field
   ↓
6. Tools available for agent calls
```

### MCP Error Handling

```typescript
try {
  const response = await provider.query(
    'Create GitHub issue: Bug in authentication',
    { maxSteps: 5 }
  );
} catch (error) {
  if (error.message.includes('MCP server')) {
    console.error('MCP server error:', error);
    // Handle MCP connection issues
  }
}
```

---

## Provider Types

### api/openai

**Description:** OpenAI API provider

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/openai',
  url: 'https://api.openai.com/v1',  // Optional, default
  apiKey: process.env.OPENAI_API_KEY,  // Or from env
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2000,
};
```

**Environment Variables:**
- `OPENAI_API_KEY` - API key (required)
- `OPENAI_BASE_URL` - Custom base URL (optional)

**Supported Models:**
- `gpt-4o` - GPT-4 Omni (latest)
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo

**Example:**
```typescript
import { MastraAPIProvider } from '@crewx/sdk';

const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4o',
  temperature: 0.7,
});

const response = await provider.query('Explain quantum computing');
```

---

### api/anthropic

**Description:** Anthropic (Claude) API provider

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/anthropic',
  url: 'https://api.anthropic.com',  // Optional, default
  apiKey: process.env.ANTHROPIC_API_KEY,  // Or from env
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 4000,
};
```

**Environment Variables:**
- `ANTHROPIC_API_KEY` - API key (required)
- `ANTHROPIC_BASE_URL` - Custom base URL (optional)

**Supported Models:**
- `claude-3-5-sonnet-20241022` - Claude 3.5 Sonnet (latest)
- `claude-3-opus-20240229` - Claude 3 Opus
- `claude-3-sonnet-20240229` - Claude 3 Sonnet
- `claude-3-haiku-20240307` - Claude 3 Haiku

**Example:**
```typescript
const provider = new MastraAPIProvider({
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
});

const response = await provider.query('Write a technical blog post');
```

---

### api/google

**Description:** Google AI API provider

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/google',
  url: 'https://generativelanguage.googleapis.com/v1',  // Optional
  apiKey: process.env.GOOGLE_API_KEY,  // Or from env
  model: 'gemini-1.5-pro',
  temperature: 0.7,
};
```

**Environment Variables:**
- `GOOGLE_API_KEY` - API key (required)
- `GOOGLE_GENERATIVE_AI_API_KEY` - Alternative env var

**Supported Models:**
- `gemini-2.0-flash-exp` - Gemini 2.0 Flash (experimental)
- `gemini-1.5-pro` - Gemini 1.5 Pro
- `gemini-1.5-flash` - Gemini 1.5 Flash

**Example:**
```typescript
const provider = new MastraAPIProvider({
  provider: 'api/google',
  model: 'gemini-1.5-pro',
  temperature: 0.7,
});

const response = await provider.query('Analyze this dataset');
```

---

### api/bedrock

**Description:** AWS Bedrock provider (Anthropic models on AWS)

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/bedrock',
  url: 'https://bedrock-runtime.us-east-1.amazonaws.com',  // Optional
  // Uses AWS credentials, not apiKey
  model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  temperature: 0.7,
};
```

**Environment Variables:**
- `AWS_ACCESS_KEY_ID` - AWS access key (required)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (required)
- `AWS_REGION` - AWS region (optional, default: us-east-1)

**Supported Models:**
- `anthropic.claude-3-5-sonnet-20241022-v2:0` - Claude 3.5 Sonnet
- `anthropic.claude-3-opus-20240229-v1:0` - Claude 3 Opus
- `anthropic.claude-3-sonnet-20240229-v1:0` - Claude 3 Sonnet

**Example:**
```typescript
const provider = new MastraAPIProvider({
  provider: 'api/bedrock',
  model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  temperature: 0.7,
});

const response = await provider.query('Enterprise analysis');
```

---

### api/litellm

**Description:** LiteLLM Gateway provider (unified interface for all LLMs)

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/litellm',
  url: 'http://localhost:4000',  // LiteLLM gateway URL
  apiKey: process.env.LITELLM_API_KEY || 'dummy',  // Optional
  model: 'claude-3-5-sonnet-20241022',  // Routed by LiteLLM
  temperature: 0.7,
};
```

**Environment Variables:**
- `LITELLM_API_KEY` - Master key (optional)
- `OPENAI_BASE_URL` - Gateway URL (alternative)

**Supported Models:**
Any model supported by LiteLLM gateway (100+ models)

**Example:**
```typescript
// LiteLLM routes to Anthropic
const provider = new MastraAPIProvider({
  provider: 'api/litellm',
  url: 'http://localhost:4000',
  model: 'claude-3-5-sonnet-20241022',
});

const response = await provider.query('Multi-model query');
```

**LiteLLM Config Example:**
```yaml
# litellm_config.yaml
model_list:
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: ${ANTHROPIC_API_KEY}

  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: ${OPENAI_API_KEY}
```

---

### api/ollama

**Description:** Ollama local AI provider

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/ollama',
  url: 'http://localhost:11434/v1',  // Optional, default
  // No API key needed
  model: 'llama3.2',
  temperature: 0.7,
};
```

**Environment Variables:**
None required (local server)

**Supported Models:**
Any model pulled in Ollama:
- `llama3.2` - Llama 3.2
- `mistral` - Mistral
- `codellama` - Code Llama
- `qwen2.5` - Qwen 2.5

**Example:**
```typescript
const provider = new MastraAPIProvider({
  provider: 'api/ollama',
  model: 'llama3.2',
  temperature: 0.7,
});

const response = await provider.query('Local inference query');
```

**Ollama Setup:**
```bash
# Pull model
ollama pull llama3.2

# Start server (default port 11434)
ollama serve
```

---

### api/sowonai

**Description:** SowonAI provider (custom AI service)

**Configuration:**
```typescript
const config: APIProviderConfig = {
  provider: 'api/sowonai',
  url: 'https://api.sowon.ai/v1',  // Optional, default
  apiKey: process.env.SOWONAI_API_KEY,  // Required
  model: 'sowon-v1',
  temperature: 0.7,
};
```

**Environment Variables:**
- `SOWONAI_API_KEY` - API key (required)

**Supported Models:**
- `sowon-v1` - SowonAI model

**Example:**
```typescript
const provider = new MastraAPIProvider({
  provider: 'api/sowonai',
  model: 'sowon-v1',
  temperature: 0.7,
});

const response = await provider.query('SowonAI query');
```

---

## Error Handling

### Error Types

CrewX API providers can encounter several types of errors:

1. **Configuration Errors** - Invalid provider config
2. **Authentication Errors** - Missing or invalid API keys
3. **Network Errors** - Connection failures
4. **API Errors** - Rate limits, invalid requests
5. **Tool Execution Errors** - Tool call failures

### Error Response Format

When an error occurs, the AIResponse includes error information:

```typescript
interface AIResponse {
  content: string;        // Empty on error
  provider: string;
  command: string;
  success: false;         // Error indicator
  error: string;          // Error message
  taskId: string;
}
```

### Try-Catch Pattern

```typescript
try {
  const response = await provider.query('Complex query', {
    maxSteps: 10,
    timeout: 30000,  // 30 seconds
  });

  if (!response.success) {
    console.error('Query failed:', response.error);
    // Handle gracefully
  } else {
    console.log('Success:', response.content);
  }
} catch (error) {
  console.error('Exception:', error.message);
  // Handle exception
}
```

### Configuration Validation

```typescript
import { z } from 'zod';

const configSchema = z.object({
  provider: z.enum([
    'api/openai',
    'api/anthropic',
    'api/google',
    'api/bedrock',
    'api/litellm',
    'api/ollama',
    'api/sowonai',
  ]),
  model: z.string().min(1),
  url: z.string().url().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

try {
  const config = configSchema.parse(userConfig);
  const provider = new MastraAPIProvider(config);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Invalid config:', error.errors);
  }
}
```

### Authentication Check

```typescript
const available = await provider.isAvailable();

if (!available) {
  throw new Error(`Provider ${config.provider} not available - check API key`);
}
```

### Timeout Handling

```typescript
const response = await Promise.race([
  provider.query('Long query', { maxSteps: 20 }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 60000)
  ),
]);
```

### Tool Execution Errors

```typescript
const myTool: FrameworkToolDefinition = {
  name: 'risky_tool',
  description: 'Tool that might fail',
  parameters: z.object({ input: z.string() }),
  execute: async ({ input }, context) => {
    try {
      const result = await riskyOperation(input);
      return result;
    } catch (error) {
      // Return error as tool result
      return {
        error: true,
        message: error.message,
      };
    }
  },
};
```

### Network Retry Pattern

```typescript
async function queryWithRetry(
  provider: MastraAPIProvider,
  prompt: string,
  maxRetries = 3
): Promise<AIResponse> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await provider.query(prompt);
      if (response.success) return response;

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## Best Practices

### 1. Environment Variable Management

**✅ Good:**
```typescript
// Use environment variables
const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
  // apiKey from process.env.OPENAI_API_KEY
});
```

**❌ Bad:**
```typescript
// Hardcoded API keys
const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
  apiKey: 'sk-hardcoded-key',  // Never do this!
});
```

### 2. Model Selection

**✅ Good:**
```typescript
// Use latest stable models
const provider = new MastraAPIProvider({
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',  // Latest stable
});
```

**❌ Bad:**
```typescript
// Deprecated models
const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-3.5-turbo-0301',  // Outdated
});
```

### 3. Temperature Settings

**✅ Good:**
```typescript
// Deterministic for coding
const codingProvider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
  temperature: 0.0,  // Consistent output
});

// Creative for writing
const writingProvider = new MastraAPIProvider({
  provider: 'api/anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.8,  // Varied output
});
```

### 4. Tool Design

**✅ Good:**
```typescript
// Well-documented tool with validation
const weatherTool: FrameworkToolDefinition = {
  name: 'weather',
  description: 'Get current weather for a city. Returns temperature, humidity, and conditions.',
  parameters: z.object({
    city: z.string().min(1).describe('City name (e.g., "Seoul", "Tokyo")'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
  }),
  execute: async ({ city, units }, context) => {
    // Input validation
    if (!city.trim()) {
      throw new Error('City name is required');
    }

    // Use context
    const apiKey = context.env.WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    // API call with error handling
    try {
      const response = await fetch(`https://api.weather.com?city=${city}&units=${units}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Weather tool error: ${error.message}`);
      return { error: true, message: error.message };
    }
  },
};
```

### 5. Error Handling

**✅ Good:**
```typescript
// Comprehensive error handling
async function safeQuery(provider: MastraAPIProvider, prompt: string) {
  try {
    // Check availability
    const available = await provider.isAvailable();
    if (!available) {
      return { error: 'Provider not available' };
    }

    // Query with timeout
    const response = await Promise.race([
      provider.query(prompt, { maxSteps: 10 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 60000)
      ),
    ]);

    // Check success
    if (!response.success) {
      console.error('Query failed:', response.error);
      return { error: response.error };
    }

    return { success: true, content: response.content };
  } catch (error) {
    console.error('Exception:', error);
    return { error: error.message };
  }
}
```

### 6. Token Management

**✅ Good:**
```typescript
// Set appropriate maxTokens
const provider = new MastraAPIProvider({
  provider: 'api/openai',
  model: 'gpt-4',
  maxTokens: 1000,  // Limit response length
});

// Monitor token usage
const response = await provider.query('Short query');
console.log('Response length:', response.content.length);
```

### 7. Multi-Step Tool Calling

**✅ Good:**
```typescript
// Limit maxSteps to prevent infinite loops
const response = await provider.query(
  'Complex multi-step task',
  {
    maxSteps: 10,  // Reasonable limit
  }
);
```

**❌ Bad:**
```typescript
// Unlimited steps (dangerous)
const response = await provider.query(
  'Complex task',
  {
    maxSteps: 1000,  // Too high!
  }
);
```

### 8. Provider Selection

**Use Case Recommendations:**

| Use Case | Recommended Provider | Reason |
|----------|---------------------|--------|
| **Code Generation** | api/openai (gpt-4) | Strong coding capabilities |
| **Long-form Writing** | api/anthropic (claude-3-5-sonnet) | 200K context, excellent writing |
| **Data Analysis** | api/google (gemini-1.5-pro) | Strong analytical capabilities |
| **Local/Private** | api/ollama (llama3.2) | No external API calls |
| **Multi-model Gateway** | api/litellm | Unified interface, easy switching |
| **Enterprise AWS** | api/bedrock | AWS infrastructure, compliance |

### 9. Context Utilization

**✅ Good:**
```typescript
// Use context effectively
const companySearchTool: FrameworkToolDefinition = {
  name: 'company_search',
  description: 'Search company database',
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }, context) => {
    // Log with agent info
    console.log(`[${context.agent.id}] Company search: ${query}`);

    // Use custom variables
    const apiVersion = context.vars?.apiVersion || 'v1';
    const companyName = context.vars?.companyName;

    // Audit logging
    await logToolUsage({
      agentId: context.agent.id,
      toolName: 'company_search',
      query,
      timestamp: context.request?.timestamp,
    });

    // API call
    return searchAPI(query, { apiVersion, companyName });
  },
};
```

### 10. Testing

**✅ Good:**
```typescript
// Unit test tools
describe('weatherTool', () => {
  it('should fetch weather data', async () => {
    const mockContext: ToolExecutionContext = {
      agent: { id: 'test_agent', provider: 'api/openai', model: 'gpt-4' },
      env: { WEATHER_API_KEY: 'test_key' },
      vars: {},
    };

    const result = await weatherTool.execute(
      { city: 'Seoul', units: 'celsius' },
      mockContext
    );

    expect(result).toHaveProperty('temperature');
  });
});

// Integration test providers
describe('MastraAPIProvider', () => {
  it('should query successfully', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
    });

    const available = await provider.isAvailable();
    expect(available).toBe(true);

    const response = await provider.query('Hello');
    expect(response.success).toBe(true);
  });
});
```

---

## Appendix

### Related Documentation

- [WBS-19 Design Document](../wbs/wbs-19-design-document.md) - Design decisions and architecture
- [WBS-20 Mastra Integration](../wbs/wbs-20-mastra-integration.md) - Implementation guide
- [WBS-26 Documentation Plan](../wbs/wbs-26-documentation-examples.md) - Documentation roadmap

### External Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Mastra Framework](https://mastra.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [SowonFlow Project](https://github.com/sowonai/sowonflow)

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025-11-12 | Initial API Reference documentation |

---

**End of API Provider Reference**
