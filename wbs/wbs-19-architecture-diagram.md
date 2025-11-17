# WBS-19: API Provider Architecture Design

> **Status**: 🟡 In Progress
> **Phase**: 1 - Architecture Design
> **Date**: 2025-11-11
> **Author**: @crewx_claude_dev

---

## Table of Contents

1. [Overview](#overview)
2. [Provider Hierarchy Design](#provider-hierarchy-design)
3. [Relationship with BaseAIProvider](#relationship-with-baseaiprovider)
4. [Tool Calling Flow](#tool-calling-flow)
5. [MCP Integration Points](#mcp-integration-points)
6. [Architecture Diagram](#architecture-diagram)
7. [Design Decisions](#design-decisions)

---

## Overview

### Goals

The API Provider implementation adds HTTP-based AI providers to CrewX, enabling:
1. **LiteLLM Gateway Support**: Connect to any LLM via OpenAI-compatible API
2. **Tool Calling**: Integrate Vercel AI SDK's tool calling system
3. **MCP Integration**: Connect Model Context Protocol servers for extended tools
4. **Server Environment**: Enable AI agents in server/cloud environments (vs CLI-only)

### Key Technologies

- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`)
- **Zod**: Schema validation for tools
- **MCP SDK**: `@modelcontextprotocol/sdk` for MCP integration
- **SowonFlow Patterns**: YAML spec inspiration from SowonFlow project

---

## Provider Hierarchy Design

### 1. Class Structure

```
AIProvider (interface)
├── BaseAIProvider (abstract class - CLI-based)
│   ├── ClaudeProvider (cli/claude)
│   ├── GeminiProvider (cli/gemini)
│   ├── CopilotProvider (cli/copilot)
│   └── CodexProvider (cli/codex)
│
└── BaseAPIProvider (abstract class - HTTP-based) ← NEW
    └── VercelAIProvider (concrete class) ← NEW
```

### 2. BaseAPIProvider (Abstract Class)

**Purpose**: Foundation for HTTP-based AI providers using Vercel AI SDK

**Core Responsibilities**:
- Implement `AIProvider` interface (`query`, `execute`, `isAvailable`, `getToolPath`)
- Manage Vercel AI SDK `generateText` / `streamText` calls
- Handle tool initialization and conversion (Local + MCP + HTTP)
- Provider HTTP client configuration (base URL, headers, auth)
- Error handling and retry logic

**Key Methods**:
```typescript
abstract class BaseAPIProvider implements AIProvider {
  // Required AIProvider interface
  abstract readonly name: string;
  abstract isAvailable(): Promise<boolean>;
  abstract query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  abstract execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  abstract getToolPath(): Promise<string | null>;

  // API Provider specific
  protected abstract initializeModel(): LanguageModel;
  protected abstract initializeTools(): Promise<CoreTool[]>;
  protected convertToolsToVercel(tools: ToolDefinition[]): CoreTool[];
  protected executeToolCall(toolName: string, input: any): Promise<any>;
}
```

### 3. VercelAIProvider (Concrete Class)

**Purpose**: Concrete implementation using Vercel AI SDK's OpenAI-compatible provider

**Configuration**:
```typescript
interface VercelAIProviderConfig {
  name: string;              // e.g., "api/litellm"
  model: string;             // e.g., "gpt-4o-mini"
  baseUrl: string;           // e.g., "https://api.openai.com/v1"
  apiKey: string;            // API authentication
  headers?: Record<string, string>;  // Custom headers
  timeout?: number;          // Request timeout (ms)
  maxTokens?: number;        // Max response tokens
  temperature?: number;      // 0.0 - 2.0
  tools?: ToolDefinition[];  // Local tools
  mcpServers?: MCPServerConfig[];  // MCP servers
}
```

**Example Instantiation**:
```typescript
const provider = new VercelAIProvider({
  name: "api/litellm",
  model: "gpt-4o-mini",
  baseUrl: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
  tools: [readFileTool, writeFileTool, bashTool],
  mcpServers: [filesystemMCP, githubMCP]
});
```

---

## Relationship with BaseAIProvider

### Design Decision: Parallel Hierarchies

**Why NOT Inherit from BaseAIProvider?**

1. **Different Execution Model**:
   - `BaseAIProvider`: Spawns CLI processes (`child_process.spawn`)
   - `BaseAPIProvider`: Makes HTTP requests (`fetch` / Vercel SDK)

2. **Incompatible Methods**:
   - `BaseAIProvider` has CLI-specific methods: `getCliCommand()`, `getDefaultArgs()`, `getExecuteArgs()`
   - These are meaningless for HTTP providers

3. **Tool Handling Difference**:
   - `BaseAIProvider`: Tools executed via CLI tool system (external)
   - `BaseAPIProvider`: Tools executed in-process via Vercel SDK

4. **Code Clarity**:
   - Parallel hierarchies avoid "N/A methods" and forced abstractions
   - Each provider type has methods relevant to its execution model

### Shared Interface: `AIProvider`

Both hierarchies implement the **same interface**:

```typescript
export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  getToolPath(): Promise<string | null>;
}
```

**Benefits**:
- ✅ Type compatibility: CLI and API providers are interchangeable
- ✅ Factory pattern: `DynamicProviderFactory` can create either type
- ✅ Agent runtime: `AgentRuntime` works with any `AIProvider`
- ✅ Clean separation: No forced inheritance of irrelevant methods

### Namespace Convention

**CLI Providers**: `cli/{id}` (e.g., `cli/claude`, `cli/gemini`)
**API Providers**: `api/{id}` (e.g., `api/litellm`, `api/openai`)
**Plugin Providers**: `plugin/{id}` (e.g., `plugin/crush`)
**Remote Providers**: `remote/{id}` (e.g., `remote/agent1`)

---

## Tool Calling Flow

### 1. Tool Types

| Type | Description | Execution | Example |
|------|-------------|-----------|---------|
| **Local Tools** | In-process functions | JavaScript/TypeScript | `read_file`, `write_file`, `bash_command` |
| **MCP Tools** | From MCP servers | MCP protocol | `filesystem:read`, `github:create_pr` |
| **HTTP Tools** | Custom HTTP endpoints | HTTP POST | `custom_api:search` |

### 2. Tool Calling Pipeline

```
User Query
  ↓
AgentRuntime.query()
  ↓
BaseAPIProvider.query()
  ↓
generateText({
  model: languageModel,
  prompt: userPrompt,
  tools: [
    ...localTools,      // read_file, write_file, bash_command
    ...mcpTools,        // From MCP servers
    ...httpTools        // Custom HTTP tools
  ],
  maxSteps: 10           // Tool calling loop limit
})
  ↓
Tool Execution Loop (Vercel SDK handles automatically)
  ├─ AI decides to use tool
  ├─ Vercel SDK calls tool.execute(input)
  │   ↓
  │   BaseAPIProvider.executeToolCall(toolName, input)
  │     ├─ Local: Call in-process function
  │     ├─ MCP: Forward to MCP client
  │     └─ HTTP: POST to custom endpoint
  ├─ Tool returns result
  └─ AI continues with tool result
  ↓
Final Response
```

### 3. Local Tools Implementation

**Built-in Tools**:

```typescript
// packages/sdk/src/core/tools/local-tool-handler.ts
export class LocalToolHandler {
  // File operations
  async readFile(path: string): Promise<string> { ... }
  async writeFile(path: string, content: string): Promise<void> { ... }

  // Command execution
  async bashCommand(command: string): Promise<string> { ... }

  // Convert to Vercel tools
  toVercelTools(): CoreTool[] {
    return [
      tool({
        name: 'read_file',
        description: 'Read file contents from filesystem',
        parameters: z.object({
          path: z.string().describe('File path to read'),
        }),
        execute: async ({ path }) => this.readFile(path),
      }),
      // ... other tools
    ];
  }
}
```

### 4. Tool Schema Conversion

**JSON Schema → Zod Schema**:

```typescript
// Convert tool definition to Vercel CoreTool
function convertToolToVercel(toolDef: ToolDefinition): CoreTool {
  // Convert JSON Schema parameters to Zod schema
  const zodSchema = jsonSchemaToZod(toolDef.parameters);

  return tool({
    name: toolDef.name,
    description: toolDef.description,
    parameters: zodSchema,
    execute: async (input) => {
      // Dispatch to appropriate handler
      if (toolDef.type === 'local') {
        return localToolHandler.execute(toolDef.name, input);
      } else if (toolDef.type === 'mcp') {
        return mcpClient.executeTool(toolDef.server, toolDef.name, input);
      } else if (toolDef.type === 'http') {
        return httpToolHandler.execute(toolDef.url, input);
      }
    },
  });
}
```

---

## MCP Integration Points

### 1. MCP Architecture

```
BaseAPIProvider
  ↓
initializeTools()
  ├─ Local Tools (LocalToolHandler)
  │   └─ read_file, write_file, bash_command
  │
  ├─ MCP Tools (MCPClient)
  │   ├─ Connect to MCP servers
  │   ├─ List available tools
  │   └─ Convert MCP tools → Vercel tools
  │
  └─ HTTP Tools (HTTPToolHandler)
      └─ Custom API endpoints
```

### 2. MCPClient Class

**Purpose**: Manage MCP server connections and tool discovery

```typescript
// packages/sdk/src/core/mcp/mcp-client.ts
export class MCPClient {
  private connections: Map<string, Client>;

  // Connect to MCP server
  async connect(config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    const client = new Client({
      name: `crewx-client-${config.name}`,
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    await client.connect(transport);
    this.connections.set(config.name, client);
  }

  // Get all tools from a server
  async getTools(serverName: string): Promise<MCPTool[]> {
    const client = this.connections.get(serverName);
    if (!client) throw new Error(`MCP server ${serverName} not connected`);

    const { tools } = await client.listTools();
    return tools;
  }

  // Execute MCP tool
  async executeTool(serverName: string, toolName: string, input: any): Promise<any> {
    const client = this.connections.get(serverName);
    if (!client) throw new Error(`MCP server ${serverName} not connected`);

    const result = await client.callTool({ name: toolName, arguments: input });
    return result.content;
  }

  // Convert MCP tools to Vercel tools
  toVercelTools(serverName: string, mcpTools: MCPTool[]): CoreTool[] {
    return mcpTools.map(mcpTool =>
      tool({
        name: `${serverName}:${mcpTool.name}`,
        description: mcpTool.description,
        parameters: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (input) =>
          this.executeTool(serverName, mcpTool.name, input),
      })
    );
  }
}
```

### 3. MCP Server Lifecycle

```
Agent Initialization
  ↓
BaseAPIProvider constructor
  ↓
initializeTools() called
  ↓
For each MCP server in config:
  ├─ MCPClient.connect(serverConfig)
  │   └─ Spawn MCP server process
  │   └─ Establish stdio transport
  │
  ├─ MCPClient.getTools(serverName)
  │   └─ List available tools from server
  │
  └─ MCPClient.toVercelTools(serverName, tools)
      └─ Convert to Vercel CoreTool format
  ↓
All tools ready for generateText()
```

### 4. Error Handling

**MCP Server Failures**:
- **Connection Timeout**: Retry 3 times with exponential backoff
- **Server Crash**: Log error, continue with remaining tools
- **Tool Execution Error**: Return error to AI, let it retry or adapt

```typescript
async initializeTools(): Promise<CoreTool[]> {
  const allTools: CoreTool[] = [];

  // 1. Local tools (always available)
  allTools.push(...this.localToolHandler.toVercelTools());

  // 2. MCP tools (best effort)
  for (const serverConfig of this.config.mcpServers || []) {
    try {
      await this.mcpClient.connect(serverConfig);
      const mcpTools = await this.mcpClient.getTools(serverConfig.name);
      allTools.push(...this.mcpClient.toVercelTools(serverConfig.name, mcpTools));
      this.logger.log(`✅ Connected to MCP server: ${serverConfig.name} (${mcpTools.length} tools)`);
    } catch (error) {
      this.logger.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
      // Continue with other servers
    }
  }

  // 3. HTTP tools
  allTools.push(...this.httpToolHandler.toVercelTools(this.config.tools || []));

  return allTools;
}
```

---

## Architecture Diagram

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CrewX Agent System                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        ┌───────────────────────┐   ┌────────────────────────┐
        │   CLI Agent Runtime   │   │   API Agent Runtime    │
        │                       │   │                        │
        │  Uses: BaseAIProvider │   │  Uses: BaseAPIProvider │
        └───────────┬───────────┘   └───────────┬────────────┘
                    │                           │
         ┌──────────┴──────────┐     ┌──────────┴──────────┐
         │                     │     │                     │
         ▼                     ▼     ▼                     ▼
    ┌────────┐         ┌────────┐ ┌─────────────┐   ┌──────────┐
    │ Claude │         │ Gemini │ │ VercelAI    │   │ Custom   │
    │Provider│         │Provider│ │Provider     │   │API       │
    └────────┘         └────────┘ └─────────────┘   │Provider  │
         │                  │           │            └──────────┘
         │ spawn CLI        │           │ HTTP API        │
         ▼                  ▼           ▼                 ▼
    ┌────────┐         ┌────────┐ ┌──────────────────────────┐
    │ claude │         │ gemini │ │   Vercel AI SDK          │
    │  CLI   │         │  CLI   │ │   + LiteLLM Gateway      │
    └────────┘         └────────┘ └──────────────────────────┘
```

### BaseAPIProvider Internal Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BaseAPIProvider                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     Configuration                            │ │
│  │  - model, baseUrl, apiKey, headers                          │ │
│  │  - temperature, maxTokens, timeout                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  Tool Initialization                         │ │
│  │                                                              │ │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐│ │
│  │  │ Local Tools    │  │   MCP Tools     │  │  HTTP Tools  ││ │
│  │  │                │  │                 │  │              ││ │
│  │  │ - read_file    │  │ MCPClient       │  │ HTTPHandler  ││ │
│  │  │ - write_file   │  │  ├─ Connect     │  │  ├─ POST     ││ │
│  │  │ - bash_command │  │  ├─ List Tools  │  │  ├─ Auth     ││ │
│  │  │                │  │  └─ Execute     │  │  └─ Parse    ││ │
│  │  └────────────────┘  └─────────────────┘  └──────────────┘│ │
│  │         │                    │                    │        │ │
│  │         └────────────────────┴────────────────────┘        │ │
│  │                              │                             │ │
│  │                    Convert to CoreTool[]                   │ │
│  └──────────────────────────────┬───────────────────────────  ┘ │
│                                 │                               │
│  ┌──────────────────────────────┴───────────────────────────┐ │
│  │              Vercel AI SDK Integration                   │ │
│  │                                                           │ │
│  │   generateText({                                         │ │
│  │     model: LanguageModel,                                │ │
│  │     prompt: string,                                      │ │
│  │     tools: CoreTool[],  ← All tools merged               │ │
│  │     maxSteps: 10                                         │ │
│  │   })                                                     │ │
│  │                                                           │ │
│  │   Tool Execution Loop (automatic):                       │ │
│  │     1. AI decides to use tool                            │ │
│  │     2. Tool.execute(input) called                        │ │
│  │     3. Result returned to AI                             │ │
│  │     4. AI continues or uses another tool                 │ │
│  │     5. Repeat until final answer                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                 │                               │
│                                 ▼                               │
│                         ┌───────────────┐                       │
│                         │  AIResponse   │                       │
│                         │  - content    │                       │
│                         │  - success    │                       │
│                         │  - toolCall   │                       │
│                         └───────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Tool Calling Sequence Diagram

```
User → AgentRuntime → BaseAPIProvider → Vercel SDK → Tools
  │                                         │
  │ query("Create file.txt")                │
  │────────────────────────────────────────>│
  │                                         │
  │                        generateText()   │
  │                        ────────────────>│
  │                                         │
  │                                    Tool Loop:
  │                                         │
  │                                  1. AI: "I'll use write_file"
  │                                         │
  │                                  2. execute(write_file, {...})
  │                        <────────────────│
  │                                         │
  │           executeToolCall()             │
  │       <─────────────────────────────────│
  │                                         │
  │  LocalToolHandler.writeFile()           │
  │  ────────────────────>                  │
  │          OK                             │
  │  <────────────────────                  │
  │                                         │
  │           Tool Result                   │
  │       ─────────────────────────────────>│
  │                                         │
  │                                  3. AI: "File created successfully"
  │                                         │
  │                        Final Response   │
  │                        <────────────────│
  │                                         │
  │ AIResponse{ content: "File created" }   │
  │<────────────────────────────────────────│
```

---

## Design Decisions

### 1. Why Vercel AI SDK?

**Alternatives Considered**:
- LangChain.js
- LlamaIndex.ts
- Raw OpenAI SDK

**Decision**: Vercel AI SDK

**Rationale**:
- ✅ **Simple API**: `generateText()` handles tool calling loop automatically
- ✅ **OpenAI Compatible**: Works with any OpenAI-compatible API (LiteLLM, vLLM, etc.)
- ✅ **Type Safety**: Full TypeScript support with Zod integration
- ✅ **Streaming**: Built-in streaming support via `streamText()`
- ✅ **Production Ready**: Battle-tested in Vercel products
- ✅ **Lightweight**: Smaller than LangChain, faster startup

### 2. Why Parallel Hierarchies (Not Inheritance)?

**Alternatives Considered**:
- Option A: `BaseAPIProvider extends BaseAIProvider`
- Option B: Single `UnifiedProvider` for both CLI and API
- **Option C (Chosen)**: Parallel hierarchies, shared `AIProvider` interface

**Rationale**:
- ✅ **Clean Separation**: No "N/A" methods or forced abstractions
- ✅ **Clear Intent**: CLI vs API execution models are fundamentally different
- ✅ **Maintainability**: Changes to CLI providers don't affect API providers
- ✅ **Type Safety**: Interface ensures compatibility, not inheritance

### 3. Why Local + MCP + HTTP Tools?

**Rationale**:
- **Local Tools**: Fast, no external dependencies, always available
- **MCP Tools**: Extensibility, ecosystem compatibility, standard protocol
- **HTTP Tools**: Custom integrations, existing APIs, flexibility

**Best of All Worlds**:
- Simple tasks → Local tools (fast, reliable)
- Standard integrations → MCP tools (filesystem, GitHub, Slack)
- Custom needs → HTTP tools (internal APIs, third-party services)

### 4. Why JSON Schema → Zod Conversion?

**Rationale**:
- CrewX YAML uses JSON Schema for tool parameters (standard, human-readable)
- Vercel SDK requires Zod schemas (runtime validation, type inference)
- Conversion layer bridges the two worlds seamlessly

### 5. Why maxSteps Limit?

**Rationale**:
- **Safety**: Prevents infinite tool calling loops
- **Cost Control**: Limits token usage for runaway agents
- **UX**: Users get response within reasonable time

**Default**: `maxSteps: 10` (configurable per agent)

---

## Next Steps

### Phase 2: YAML Specification (WBS-19 Phase 2)

1. ✅ Analyze SowonFlow YAML spec (completed)
2. Define `agents[].inline` schema extensions for API providers
3. Define `mcp_servers` section
4. Define `tools` section
5. Generate JSON Schema for validation

### Phase 3: TypeScript Type System (WBS-19 Phase 3)

1. Create `packages/sdk/src/types/api-provider.types.ts`
2. Define Zod schemas for validation
3. Ensure SowonFlow compatibility

### Phase 4: Implementation (WBS-20+)

1. Implement `BaseAPIProvider` class
2. Implement `VercelAIProvider` class
3. Implement `LocalToolHandler`
4. Implement `MCPClient`
5. Implement tool conversion logic

---

## References

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [SowonFlow Production Code](file:///Users/doha/git/sowonai/packages/sowonflow)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [WBS-18 Provider Integration](wbs-18-agent-provider-integration.md)
- [CrewX Provider Architecture](../packages/sdk/src/core/providers/)
