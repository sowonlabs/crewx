# WBS-19 Phase 2: SowonFlow YAML Spec Analysis

**Date:** 2025-11-11
**Author:** SowonFlow Developer Agent
**Status:** ✅ Complete

---

## Executive Summary

This document provides a comprehensive analysis of the **SowonFlow LangGraph Production** YAML specification and implementation patterns. SowonFlow uses LangChain/LangGraph as its core agent framework with MCP integration, providing valuable insights for CrewX API Provider implementation.

**Key Technologies:**
- **Framework:** LangChain/LangGraph (`@langchain/langgraph` v0.3.11)
- **Agent Pattern:** `createReactAgent` from LangGraph prebuilt
- **MCP Integration:** `@langchain/mcp-adapters` v0.6.0
- **Model Gateway:** LiteLLM v0.12.0 (OpenAI-compatible)
- **Tools:** LangChain `StructuredTool` interface

**Location:** `/Users/doha/git/sowonai/packages/sowonflow`

---

## 1. MCP Servers Configuration Analysis

### 1.1 YAML Schema Structure

SowonFlow's YAML schema does **not** have a top-level `mcp_servers` section. Instead, MCP servers are:
1. **Defined externally** in code (via `WorkflowOptions.mcpServers`)
2. **Referenced by agents** via the `mcp` array field

**Agent-Level MCP Configuration:**
```yaml
agents:
  - id: "research_agent"
    inline:
      type: agent
      model: "openai/gpt-4o"
      system_prompt: "You are a research assistant"
      mcp: ["filesystem", "github"]  # ← References to MCP servers
```

**YAML Schema Definition** (`docs/workflow-schema.yaml:130-134`):
```yaml
mcp:
  type: array
  description: List of MCP (Model Context Protocol) servers to use
  items:
    type: string
```

### 1.2 MCP Server Spawning Mechanism

**Location:** `src/workflow/InlineAgentFactory.ts:350-424`

**MCP Client Creation Pattern:**
```typescript
// Static cache for MCP clients (singleton pattern)
private static mcpClients: Record<string, MultiServerMCPClient> = {};

private static async loadMcpTools(
  mcpServerNames: string[],
  mcpServers: Record<string, any>
): Promise<ToolInterface[]> {
  const mcpTools: ToolInterface[] = [];

  for (const serverName of mcpServerNames) {
    // Reuse existing client if available
    if (!this.mcpClients[serverName]) {
      const serverConfig = mcpServers[serverName];

      // Create MCP client with LangChain adapter
      const clientConfig = {
        throwOnLoadError: true,
        prefixToolNameWithServerName: true,
        additionalToolNamePrefix: "mcp",
        suppressStderr: true, // Suppress MCP server STDERR output
        mcpServers: {
          [serverName]: {
            ...serverConfig  // { command, args, env }
          }
        }
      };

      this.mcpClients[serverName] = new MultiServerMCPClient(clientConfig);
    }

    // Get tools from MCP server
    const tools = await this.mcpClients[serverName].getTools();
    mcpTools.push(...tools);
  }

  return mcpTools;
}
```

**MCP Server Configuration Structure:**
```typescript
// Passed via WorkflowOptions.mcpServers
const mcpServers = {
  filesystem: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/doha"],
    env: { /* optional env vars */ }
  },
  github: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
  }
};
```

**Tool Loading with Validation** (`InlineAgentFactory.ts:383-414`):
```typescript
const tools = await this.mcpClients[serverName].getTools();

// Validate tools structure
const validTools = tools.filter(tool => {
  if (!tool || typeof tool !== 'object') return false;

  // Check required properties: name, description, schema
  if (!tool.name || !tool.description || !tool.schema) {
    this.logger.debug(`Tool missing required properties`, tool);
    return false;
  }

  return true;
});

mcpTools.push(...validTools);
```

**Cleanup Pattern** (`InlineAgentFactory.ts:429-442`):
```typescript
static async cleanup(): Promise<void> {
  for (const [serverName, client] of Object.entries(this.mcpClients)) {
    try {
      await client.close();
      this.logger.debug(`MCP client "${serverName}" closed`);
    } catch (error) {
      this.logger.error(`Error closing MCP client "${serverName}":`, error);
    }
  }
  this.mcpClients = {};
}
```

### 1.3 Key Insights for CrewX

**✅ Patterns to Adopt:**
1. **Singleton MCP Client Cache** - Reuse clients across agents to avoid spawning duplicate processes
2. **Server Name Prefixing** - Prefix tool names with server name to avoid collisions
3. **STDERR Suppression** - MCP servers can be noisy; suppress their STDERR output
4. **Tool Validation** - Validate tool structure before passing to agents
5. **Graceful Cleanup** - Properly close MCP connections on shutdown

**⚠️ Differences from Expected Pattern:**
- SowonFlow does **not** define MCP servers in YAML (unlike the WBS-19 design)
- MCP servers are configured **programmatically** via `WorkflowOptions.mcpServers`
- Agents reference servers by name via `mcp: ["server1", "server2"]`

**💡 Recommendation for CrewX:**
```yaml
# Option 1: SowonFlow Pattern (agent-level reference)
agents:
  - id: agent1
    inline:
      mcp: ["filesystem", "github"]  # Reference to external config

# Option 2: CrewX Enhanced Pattern (inline definition)
mcp_servers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    env: {}

agents:
  - id: agent1
    inline:
      mcp: ["filesystem"]  # Reference to mcp_servers section
```

**Best Approach:** Support both patterns for maximum flexibility.

---

## 2. Tools Section Analysis

### 2.1 Tool Definition Pattern

SowonFlow uses **LangChain StructuredTool** interface with Zod schema validation.

**Base Tool Structure:**
```typescript
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export class Calculator extends StructuredTool {
  name = "calculator";
  description = "Performs mathematical calculations. Supports arithmetic, parentheses, exponents.";

  schema = z.object({
    input: z.string().describe("Mathematical expression to evaluate")
  });

  async _call(input: { input: string }): Promise<string> {
    // Tool implementation
    const result = this.evaluateExpression(input.input);
    return `Result: ${result}`;
  }
}
```

### 2.2 Built-in Tools

**Location:** `src/tools/`

| Tool Name | Type | Description |
|-----------|------|-------------|
| **DocumentSectionTool** | Document Access | Extracts sections from markdown documents using selectors |
| **Calculator** | Math | Evaluates mathematical expressions |
| **CurrentTimeTool** | Utility | Returns current time/date |
| **WorkflowTemplateSelectorTool** | Supervisor | Selects optimal workflow template for tasks |
| **DynamicWorkflowExecutorTool** | Supervisor | Executes dynamic workflows based on templates |

### 2.3 Tool Assignment to Agents

**YAML Configuration:**
```yaml
agents:
  - id: calculator_agent
    inline:
      type: agent
      model: "openai/gpt-4o"
      system_prompt: "You are a math specialist"
      tools: ["calculator"]  # ← References to built-in tools
```

**Implementation** (`InlineAgentFactory.ts:131-154`):
```typescript
private static getToolsForAgent(
  spec: AgentSpec,
  availableTools: ToolInterface[],
  workflow?: any
): any[] {
  const toolsList: any[] = [];

  // Always include DocumentSectionTool
  toolsList.push(createDocumentSectionTool(workflow));

  if (!spec.tools || spec.tools.length === 0) {
    return toolsList;  // Only DocumentSectionTool
  }

  // Map tool names to actual tool instances
  spec.tools.forEach(toolName => {
    const tool = availableTools.find(t => t.name === toolName);
    if (tool) {
      toolsList.push(tool);
    } else {
      this.logger.warn(`Tool "${toolName}" not found`);
    }
  });

  return toolsList;
}
```

### 2.4 MCP Tools Integration

**MCP tools are automatically added** to agents that specify `mcp` servers:

```typescript
// InlineAgentFactory.ts:74-83
if (spec.mcp && Array.isArray(spec.mcp) && spec.mcp.length > 0) {
  try {
    const mcpTools = await this.loadMcpTools(spec.mcp, mcpServers);
    tools = [...tools, ...mcpTools];

    this.logger.debug(`Added ${mcpTools.length} MCP tools to agent "${id}"`);
  } catch (error) {
    this.logger.error(`Error loading MCP tools for agent "${id}":`, error);
  }
}
```

**Final Tool Composition:**
```
Agent Tools = [
  DocumentSectionTool (always),
  ...builtInTools (from spec.tools),
  ...mcpTools (from spec.mcp servers),
  ...supervisorTools (if type === 'supervisor')
]
```

### 2.5 Supervisor Dynamic Tools

**Supervisor agents** get special workflow orchestration tools:

```typescript
// InlineAgentFactory.ts:46-71
if (spec.type === 'supervisor' && spec.agents && spec.agents.length > 0) {
  const supervisorMode = spec.supervisor_mode || 'auto';
  const dynamicWorkflowTools = this.createDynamicWorkflowTools(
    spec.agents,
    config,
    supervisorAgentsInfo,
    supervisorMode
  );
  tools = [...tools, ...dynamicWorkflowTools];
}

// Creates: WorkflowTemplateSelectorTool + DynamicWorkflowExecutorTool
```

**Supervisor Tools:**
1. **workflow_template_selector** - Analyzes tasks and selects template (sequential/parallel)
2. **dynamic_workflow_executor** - Creates and executes dynamic workflows

### 2.6 Key Insights for CrewX

**✅ Tool Patterns to Adopt:**

1. **StructuredTool Interface** - Use Zod schemas for type safety and validation
2. **Tool Composition Layers:**
   - Core tools (always available)
   - Agent-specific tools (from config)
   - MCP tools (from servers)
   - Role-specific tools (supervisor, router, etc.)
3. **Tool Name Mapping** - Map string names to tool instances
4. **Graceful Degradation** - Log warnings for missing tools, don't fail
5. **Context Injection** - Pass workflow/document context to tools that need it

**💡 CrewX Tool Definition Recommendation:**
```yaml
# tools section (global tool definitions)
tools:
  calculator:
    type: builtin
    description: "Math calculations"

  custom_api:
    type: http
    method: POST
    url: https://api.example.com/endpoint
    headers:
      Authorization: "Bearer {{env.API_KEY}}"
    body:
      query: "{{input}}"

agents:
  - id: agent1
    inline:
      tools: ["calculator", "custom_api"]  # Reference tools by name
      mcp: ["filesystem"]  # MCP tools auto-loaded
```

---

## 3. Agent/Workflow Configuration Patterns

### 3.1 Agent Types

SowonFlow defines **4 agent types** in the schema (`workflow-schema.yaml:96-102`):

```yaml
type:
  type: string
  enum:
    - agent      # Standard tool-calling agent
    - supervisor # Orchestrates other agents with dynamic workflows
    - router     # Routes tasks to specialized agents (not implemented)
    - monitor    # Observes and logs workflows (not implemented)
```

**Currently Implemented:**
- ✅ **agent** - Standard LangGraph `createReactAgent`
- ✅ **supervisor** - Agent with dynamic workflow orchestration tools

### 3.2 Agent Configuration Structure

**YAML Example:**
```yaml
agents:
  - id: "research_agent"
    inline:
      type: agent
      model: "openai/gpt-4o"
      intelligence_level: high  # high|specialized|medium|basic
      system_prompt: "You are a research assistant..."
      temperature: 0.7
      max_tokens: 4000
      top_p: 1.0
      frequency_penalty: 0.0
      presence_penalty: 0.0
      timeout: 30000  # milliseconds
      max_retries: 3
      tools: ["web_search", "calculator"]
      mcp: ["filesystem", "github"]
      memory:
        types: ["short_term", "long_term"]
        capacity: 100
      think_first: true
      error_handling:
        retry: 3
        timeout: 60
```

### 3.3 Agent Creation Flow

**Entry Point:** `InlineAgentFactory.createAgent()` (`InlineAgentFactory.ts:31-123`)

```typescript
static async createAgent(
  id: string,
  spec: AgentSpec,
  availableTools: ToolInterface[] = [],
  mcpServers: Record<string, any> = {},
  workflow?: any,
  config?: Config
): Promise<any> {
  // 1. Create model instance
  const model = this.createModel(spec.model, spec, config);

  // 2. Gather tools (built-in + MCP + supervisor)
  let tools: any[] = this.getToolsForAgent(spec, availableTools, workflow);

  if (spec.type === 'supervisor' && spec.agents?.length > 0) {
    const supervisorTools = this.createDynamicWorkflowTools(...);
    tools = [...tools, ...supervisorTools];
  }

  if (spec.mcp?.length > 0) {
    const mcpTools = await this.loadMcpTools(spec.mcp, mcpServers);
    tools = [...tools, ...mcpTools];
  }

  // 3. Process system prompt (template rendering)
  let systemPrompt = spec.system_prompt || '';
  if (systemPrompt.includes('{{') && workflow?.documentManager) {
    systemPrompt = await templateProcessor.processAsync(systemPrompt, {});
  }

  // 4. Enhance supervisor prompts
  if (spec.type === 'supervisor' && !systemPrompt.includes('supervisor')) {
    systemPrompt += this.getDefaultSupervisorInstructions(...);
  }

  // 5. Create LangGraph agent
  const agent = new SowonAgent({
    llm: model,
    tools: tools,
    prompt: systemPrompt
  });

  return agent;
}
```

### 3.4 Model Creation Pattern

**Model Gateway Strategy** (`InlineAgentFactory.ts:298-342`):

```typescript
private static createModel(modelName: string, spec: AgentSpec, config?: Config): any {
  const finalConfig = config || getConfig();

  const {
    temperature = 0.7,
    max_tokens = 4000,
    top_p = 1.0,
    frequency_penalty = 0.0,
    presence_penalty = 0.0,
    timeout = 30000,
    max_retries = 3
  } = spec;

  // Prefer LiteLLM if configured
  if (finalConfig.baseUrl || finalConfig.apiKey) {
    return new ChatLiteLLM({
      model: modelName,
      baseUrl: finalConfig.getFullUrl(),
      apiKey: finalConfig.apiKey,
      temperature,
      maxTokens: max_tokens,
      topP: top_p,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
      timeout,
      maxRetries: max_retries,
    });
  }

  // Fallback to OpenRouter
  return new ChatOpenRouter({
    model: modelName,
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature,
    maxTokens: max_tokens,
    // ... other params
  });
}
```

**Model Name Format:**
- `openai/gpt-4o` - LiteLLM provider/model format
- `anthropic/claude-3-5-sonnet` - LiteLLM format
- `openrouter:anthropic/claude-3-5-sonnet` - Custom prefix for OpenRouter

### 3.5 Supervisor Agent Pattern

**Supervisor Configuration:**
```yaml
agents:
  - id: supervisor
    inline:
      type: supervisor
      model: "openai/gpt-4o"
      supervisor_mode: auto  # auto|sequential|parallel|branch
      system_prompt: "You coordinate specialized agents..."
      agents:  # Agents under supervision
        - legal_expert
        - technical_expert
        - business_analyst
```

**Supervisor Tools Auto-Injection:**
1. **workflow_template_selector** - Selects sequential/parallel/branch template
2. **dynamic_workflow_executor** - Executes selected template with agent mapping

**Supervisor System Prompt Enhancement** (`InlineAgentFactory.ts:196-289`):
```typescript
private static getDefaultSupervisorInstructions(
  agents: string[],
  supervisorMode: string
): string {
  return `
## Supervisor Agent Instructions

Available agents:
${agents.map(id => `- ${id}: Specialized agent`).join('\n')}

## Mode: ${supervisorMode}

### workflow_template_selector
Analyzes tasks and selects optimal workflow template.

Usage:
{
  "task_description": "Detailed task description",
  "agents_available": ["agent1", "agent2"],
  "complexity": "low|medium|high"
}

### dynamic_workflow_executor
Executes workflows based on template and agent mapping.

Usage:
{
  "template_name": "sequential|parallel_review",
  "agents_mapping": { "role1": "actual_agent1" },
  "task_input": "Task for agents",
  "timeout_seconds": 300
}

## Workflow Process
1. Analyze Request
2. Select Template (use workflow_template_selector)
3. Map Agents to Roles
4. Execute Workflow (use dynamic_workflow_executor)
5. Return Results
`;
}
```

### 3.6 Workflow Execution Pattern

**Workflow Structure:**
```yaml
nodes:
  start:
    type: start

  research_task:
    type: agent_task
    agent: research_agent
    input:
      template: "Research: {{user_query}}"
    output:
      to_state: research_result
    next: analysis_task

  analysis_task:
    type: agent_task
    agent: analysis_agent
    input:
      template: "Analyze: {{research_result}}"
    next: end

  end:
    type: end
```

**Node Types:**
- `start` - Entry point
- `agent_task` - Execute agent
- `branch` - Conditional branching (llm, condition, js_condition)
- `parallel` - Parallel execution
- `join` - Merge parallel results
- `human` - Human-in-the-loop
- `error_handler` - Error handling
- `end` - Exit point
- `custom` - Custom node type

### 3.7 Key Insights for CrewX

**✅ Agent Configuration Patterns to Adopt:**

1. **Inline Agent Definition** - Define agents directly in workflow YAML
2. **Agent Type Hierarchy** - Standard, supervisor, router, monitor
3. **Model Parameters in Agent Spec** - temperature, max_tokens, etc. at agent level
4. **Supervisor Auto-Enhancement** - Inject orchestration tools and instructions
5. **Template System** - Handlebars for dynamic prompt rendering
6. **Multi-Stage Tool Composition** - Built-in → MCP → Role-specific
7. **Config Cascade** - Global config → Agent config → Call params

**⚠️ Differences from CrewX Current Design:**
- SowonFlow uses **inline agent definitions** (no separate agent registry)
- Supervisor pattern uses **dynamic workflows**, not static handoffs
- Tools are **referenced by name**, not inline definitions
- MCP servers configured **outside YAML**, referenced by agents

**💡 Recommended CrewX Enhancement:**
```yaml
# CrewX should support both patterns

# Pattern 1: SowonFlow-style inline agents
agents:
  - id: agent1
    inline:
      type: agent
      model: openai/gpt-4o
      system_prompt: "..."
      tools: ["tool1"]
      mcp: ["server1"]

# Pattern 2: CrewX-style agent registry reference
agents:
  - id: agent2
    ref: registered_agent_name  # Reference to global agent registry
    overrides:
      model: openai/gpt-4o-mini  # Override specific params
```

---

## 4. LangGraph Integration Patterns

### 4.1 Core Agent: SowonAgent Wrapper

**Location:** `src/agents/SowonAgent.ts`

**SowonAgent wraps LangGraph's `createReactAgent`:**

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';

export class SowonAgent {
  private agent: any;
  private model: any;
  private tools: any[];
  private prompt?: string;

  constructor({ llm, tools = [], prompt = "..." }) {
    this.model = llm;
    this.tools = tools;
    this.prompt = prompt;

    // Create LangGraph ReAct agent
    this.agent = createReactAgent({
      llm: this.model,
      tools,
      prompt
    });
  }

  async invoke(input: { messages: any[]; outputSchema?: any }) {
    // Support structured output
    if (input.outputSchema && this.model.withStructuredOutput) {
      const structuredLLM = this.model.withStructuredOutput(input.outputSchema);
      return await structuredLLM.invoke(input.messages);
    }

    // Standard agent invocation
    return await this.agent.invoke({ messages: input.messages });
  }

  async ask(input: string, options: { outputSchema?: any } = {}): Promise<AIMessage> {
    const messages = [new HumanMessage(input)];
    const result = await this.invoke({ messages, outputSchema: options.outputSchema });

    // Extract AIMessage from result
    if (result.messages?.length > 0) {
      return result.messages.find(m => m.type === 'ai') || new AIMessage(result.content);
    }

    return new AIMessage(result.content || result.output || "No response");
  }
}
```

### 4.2 createReactAgent Pattern

**LangGraph's ReAct Agent:**
- **ReAct** = Reasoning + Acting in an interleaved manner
- Agent **thinks** → **uses tools** → **observes results** → **repeats** until done
- Built-in **tool calling loop** (no manual orchestration needed)

**Key Features:**
1. **Automatic Tool Calling** - Agent decides when to use tools
2. **Multi-Step Reasoning** - Continues until task is complete
3. **Message History** - Maintains conversation context
4. **Structured Output** - Can enforce response schemas

### 4.3 Tool Calling Loop

**LangGraph handles the tool calling loop internally:**

```
User Input → Agent
    ↓
Agent Decides: Use Tool OR Respond
    ↓
If Tool:
    → Execute Tool
    → Return Tool Result to Agent
    → Agent Continues Reasoning
    → (Loop until done)
If Respond:
    → Return Final Response
```

**No explicit loop management needed!** LangGraph's `createReactAgent` handles:
- Tool selection
- Tool execution
- Result parsing
- Multi-step planning
- Final response generation

### 4.4 Message Format

**LangChain Message Types:**
```typescript
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

// Input to agent
const messages = [
  new HumanMessage("What's 25 * 37?")
];

// Agent processes and may generate:
// 1. AIMessage with tool call
// 2. ToolMessage with tool result
// 3. AIMessage with final response

const result = await agent.invoke({ messages });
```

**Result Structure:**
```typescript
{
  messages: [
    HumanMessage { content: "What's 25 * 37?" },
    AIMessage {
      content: "",
      tool_calls: [{ name: "calculator", args: { input: "25 * 37" } }]
    },
    ToolMessage {
      content: "Result: 925",
      tool_call_id: "..."
    },
    AIMessage {
      content: "The answer is 925."
    }
  ]
}
```

### 4.5 Workflow Execution with LangGraph

**SowonFlow does NOT use LangGraph for workflow orchestration** (despite using LangGraph for agents):

```typescript
// Workflow.ts - Custom workflow runner
async ask(query: string): Promise<any> {
  const startNode = findStartNode(this.spec);
  let currentNode = startNode;

  while (currentNode.type !== 'end') {
    if (currentNode.type === 'agent_task') {
      const agent = this.agentMap[currentNode.agent];
      const result = await agent.ask(query);  // ← LangGraph agent

      // Store result in workflow state
      this.currentState[currentNode.output.to_state] = result;
    }

    currentNode = this.getNode(currentNode.next);
  }

  return this.currentState;
}
```

**Why not use LangGraph StateGraph for workflows?**
- SowonFlow predates LangGraph StateGraph maturity
- Custom workflow runner provides more control
- Easier to implement custom node types (human-in-the-loop, etc.)

### 4.6 MCP Integration with LangGraph

**LangChain MCP Adapters:**
```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
  mcpServers: {
    filesystem: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
});

// MCP tools become LangChain StructuredTools
const tools = await client.getTools();

// Pass directly to createReactAgent
const agent = createReactAgent({ llm: model, tools });
```

**Seamless Integration:**
- MCP tools automatically converted to LangChain `StructuredTool` format
- Tool schemas extracted from MCP server definitions
- Tool calling works identically to built-in tools

### 4.7 Key Insights for CrewX

**✅ LangGraph Patterns to Adopt:**

1. **createReactAgent for Individual Agents**
   - Simple, powerful agent abstraction
   - Built-in tool calling loop
   - Message history management
   - Structured output support

2. **Tool Interface Standardization**
   - Use LangChain `StructuredTool` interface
   - Zod schemas for type safety
   - Consistent tool calling across providers

3. **MCP Adapter Pattern**
   - Use `@langchain/mcp-adapters` for LangChain integration
   - MCP tools automatically compatible with LangGraph agents
   - No manual tool conversion needed

4. **Message-Based API**
   - HumanMessage, AIMessage, ToolMessage, SystemMessage
   - Maintains conversation context naturally
   - Easy to serialize/deserialize for persistence

**⚠️ Differences from Mastra/Vercel AI SDK:**
- **No `generateText` or `streamText`** - LangGraph uses message-based API
- **No manual tool loop** - createReactAgent handles it internally
- **Different tool format** - LangChain StructuredTool, not Vercel AI SDK tools
- **Message objects** - Not plain strings/objects

**💡 CrewX API Provider Abstraction:**

```typescript
// Proposed CrewX BaseAPIProvider interface

interface BaseAPIProvider {
  // Required methods
  createAgent(config: AgentConfig): Promise<Agent>;
  executeAgent(agent: Agent, input: string): Promise<AgentResponse>;
  getTools(): Tool[];

  // Optional methods
  streamAgent?(agent: Agent, input: string): AsyncIterator<AgentChunk>;
  withStructuredOutput?(schema: any): Promise<any>;

  // MCP integration
  loadMcpTools?(serverConfig: McpServerConfig): Promise<Tool[]>;
}

// LangGraph provider implementation
class LangGraphProvider implements BaseAPIProvider {
  async createAgent(config: AgentConfig): Promise<Agent> {
    const tools = [...config.tools, ...this.loadMcpTools(config.mcp)];
    return new SowonAgent({
      llm: this.createModel(config.model),
      tools,
      prompt: config.systemPrompt
    });
  }

  async executeAgent(agent: Agent, input: string): Promise<AgentResponse> {
    const result = await agent.ask(input);
    return {
      content: result.content,
      toolCalls: result.tool_calls,
      messages: result.messages
    };
  }
}
```

---

## 5. Comparison with CrewX Design

### 5.1 YAML Structure Comparison

| Feature | SowonFlow LangGraph | CrewX Design (WBS-19) | Recommendation |
|---------|---------------------|------------------------|----------------|
| **MCP Servers** | No YAML section, configured in code | Top-level `mcp_servers` section | ✅ Add `mcp_servers` in YAML |
| **Agent Definition** | Inline only | Inline + ref to registry | ✅ Support both patterns |
| **Tools** | Referenced by name | Inline + named definitions | ✅ Support both patterns |
| **Model Format** | `provider/model` | `provider/model` | ✅ Already aligned |
| **Supervisor Pattern** | Dynamic workflows | Static handoffs (TBD) | 🔄 Adopt dynamic workflows |
| **Workflow Orchestration** | Custom runner | LangGraph StateGraph? | 🤔 Evaluate trade-offs |

### 5.2 Tool Calling Patterns

| Aspect | SowonFlow LangGraph | Vercel AI SDK (Mastra) | CrewX Target |
|--------|---------------------|------------------------|--------------|
| **Agent API** | `createReactAgent` | `generateText` | Abstraction layer |
| **Tool Format** | LangChain StructuredTool | Vercel AI SDK tools | Provider-specific |
| **Tool Loop** | Automatic (LangGraph) | Manual or `maxSteps` | Provider-handled |
| **Message Format** | LangChain Messages | Plain objects | Normalized format |
| **MCP Integration** | `@langchain/mcp-adapters` | `@modelcontextprotocol/sdk` | Provider-specific |
| **Structured Output** | `withStructuredOutput` | `output` parameter | Abstraction layer |

### 5.3 Architecture Patterns

**SowonFlow LangGraph Architecture:**
```
Workflow YAML
    ↓
InlineAgentFactory
    ↓
SowonAgent (wraps createReactAgent)
    ↓
LiteLLM (model gateway)
    ↓
Tools: [Built-in, MCP, Supervisor]
```

**Recommended CrewX Architecture:**
```
Workflow YAML
    ↓
BaseAPIProvider (abstraction)
    ├→ LangGraphProvider → createReactAgent → LiteLLM
    ├→ MastraProvider → generateText → Vercel AI SDK
    └→ ClaudeProvider → Claude SDK
    ↓
Unified Tool Interface
    ├→ Built-in tools
    ├→ MCP tools (provider-specific adapters)
    └→ HTTP tools
```

---

## 6. Recommended Patterns for CrewX Adoption

### 6.1 High Priority Adoptions ✅

1. **MCP Client Singleton Pattern**
   - Cache MCP clients to avoid duplicate processes
   - Implement graceful cleanup on shutdown
   - Suppress STDERR output from MCP servers

2. **Tool Composition Layers**
   - Core tools (always available, e.g., document_section)
   - Agent-specific tools (from config)
   - MCP tools (from servers)
   - Role-specific tools (supervisor, router)

3. **Agent Type Hierarchy**
   - `agent` - Standard tool-calling agent
   - `supervisor` - Orchestration with dynamic workflows
   - `router` - Task routing (future)
   - `monitor` - Observability (future)

4. **Supervisor Dynamic Workflows**
   - Auto-inject orchestration tools
   - Template selection (sequential/parallel/branch)
   - Dynamic workflow execution
   - Enhanced system prompts

5. **Config Cascade Pattern**
   ```
   Global Config → Agent Config → Runtime Params
   ```

### 6.2 Medium Priority Enhancements 🔄

1. **YAML MCP Server Definitions**
   ```yaml
   mcp_servers:
     filesystem:
       command: npx
       args: ["-y", "@modelcontextprotocol/server-filesystem"]
       env: {}
   ```

2. **Tool Name Resolution**
   - Support both inline and named tool definitions
   - Validate tool references at workflow load time
   - Provide helpful error messages for missing tools

3. **Template System**
   - Handlebars for agent prompts and node inputs
   - Document system integration
   - Environment variable substitution

4. **Structured Logging**
   - Winston-based logging with levels
   - Agent/workflow/tool execution traces
   - Performance metrics

### 6.3 Low Priority / Future Considerations 🤔

1. **LangGraph StateGraph for Workflows**
   - Evaluate if needed (custom runner works well)
   - Consider for complex workflows with loops
   - LangGraph provides better visualization

2. **Router and Monitor Agent Types**
   - Not implemented in SowonFlow yet
   - Design patterns for these roles
   - Tool requirements

3. **Memory System**
   - SowonFlow has schema but not implemented
   - ConversationBuffer, KeyValueStore, GraphStore types
   - Persistence strategies

---

## 7. Implementation Recommendations for WBS-19

### 7.1 Phase 1: Core Provider Abstraction

**Goal:** Create base interface for all API providers

```typescript
// src/providers/base/BaseAPIProvider.ts
export interface BaseAPIProvider {
  readonly name: string;
  readonly version: string;

  // Agent lifecycle
  createAgent(config: AgentConfig): Promise<Agent>;
  executeAgent(agent: Agent, input: AgentInput): Promise<AgentOutput>;

  // Tool management
  registerTool(tool: Tool): void;
  getTools(): Tool[];

  // MCP integration
  loadMcpServer(config: McpServerConfig): Promise<McpClient>;
  getMcpTools(client: McpClient): Promise<Tool[]>;

  // Cleanup
  cleanup(): Promise<void>;
}
```

### 7.2 Phase 2: LangGraph Provider Implementation

**Goal:** Implement LangGraphProvider based on SowonFlow patterns

```typescript
// src/providers/langgraph/LangGraphProvider.ts
export class LangGraphProvider implements BaseAPIProvider {
  private mcpClients: Map<string, MultiServerMCPClient> = new Map();

  async createAgent(config: AgentConfig): Promise<Agent> {
    // 1. Create model
    const model = this.createModel(config.model, config);

    // 2. Gather tools
    const tools = await this.gatherTools(config);

    // 3. Process system prompt
    let prompt = await this.processPrompt(config.systemPrompt);

    // 4. Enhance if supervisor
    if (config.type === 'supervisor') {
      prompt += this.getSupervisorInstructions(config);
      tools.push(...this.getSupervisorTools(config));
    }

    // 5. Create LangGraph agent
    return new SowonAgent({ llm: model, tools, prompt });
  }

  private async gatherTools(config: AgentConfig): Promise<Tool[]> {
    const tools: Tool[] = [];

    // Core tools
    tools.push(this.createDocumentSectionTool());

    // Built-in tools
    for (const toolName of config.tools || []) {
      const tool = this.builtInTools.get(toolName);
      if (tool) tools.push(tool);
    }

    // MCP tools
    for (const serverName of config.mcp || []) {
      const client = await this.getMcpClient(serverName);
      const mcpTools = await client.getTools();
      tools.push(...mcpTools);
    }

    return tools;
  }

  private async getMcpClient(serverName: string): Promise<MultiServerMCPClient> {
    if (this.mcpClients.has(serverName)) {
      return this.mcpClients.get(serverName)!;
    }

    const config = this.mcpServerConfigs.get(serverName);
    if (!config) throw new Error(`MCP server ${serverName} not configured`);

    const client = new MultiServerMCPClient({
      throwOnLoadError: true,
      prefixToolNameWithServerName: true,
      additionalToolNamePrefix: "mcp",
      suppressStderr: true,
      mcpServers: { [serverName]: config }
    });

    this.mcpClients.set(serverName, client);
    return client;
  }

  async cleanup(): Promise<void> {
    for (const [name, client] of this.mcpClients) {
      await client.close();
    }
    this.mcpClients.clear();
  }
}
```

### 7.3 Phase 3: YAML Parser Enhancements

**Goal:** Support SowonFlow-compatible YAML structure

```typescript
// src/workflow/parsers/AgentParser.ts
export class AgentParser {
  parseAgents(yamlAgents: any[]): AgentConfig[] {
    return yamlAgents.map(agentDef => {
      const config: AgentConfig = {
        id: agentDef.id,
        type: agentDef.inline?.type || 'agent',
        model: agentDef.inline?.model || 'openai/gpt-4o',
        systemPrompt: agentDef.inline?.system_prompt || '',
        tools: agentDef.inline?.tools || [],
        mcp: agentDef.inline?.mcp || [],
        supervisorMode: agentDef.inline?.supervisor_mode || 'auto',
        supervisorAgents: agentDef.inline?.agents || [],
        // Model parameters
        temperature: agentDef.inline?.temperature ?? 0.7,
        maxTokens: agentDef.inline?.max_tokens ?? 4000,
        // ... other params
      };

      return config;
    });
  }
}
```

### 7.4 Phase 4: Supervisor Pattern Implementation

**Goal:** Implement dynamic workflow orchestration

```typescript
// src/tools/supervisor/WorkflowTemplateSelectorTool.ts
export class WorkflowTemplateSelectorTool extends StructuredTool {
  name = "workflow_template_selector";
  description = "Analyzes tasks and selects optimal workflow template";

  schema = z.object({
    task_description: z.string(),
    agents_available: z.array(z.string()),
    complexity: z.enum(['low', 'medium', 'high'])
  });

  async _call(input: {
    task_description: string;
    agents_available: string[];
    complexity: string;
  }): Promise<string> {
    // Analyze task and select template
    const keywords = ['검토', '리뷰', '분석', '평가', '다양한 관점'];
    const isParallel = keywords.some(k => input.task_description.includes(k));

    const template = isParallel ? 'parallel_review' : 'sequential';

    return JSON.stringify({
      success: true,
      template,
      reason: `Task requires ${template} execution`,
      suggested_agent_roles: this.suggestRoles(input.agents_available, template)
    });
  }
}
```

---

## 8. Migration Path from Mastra

### 8.1 Mastra vs LangGraph Comparison

| Feature | Mastra (Current) | LangGraph (Target) | Migration Impact |
|---------|------------------|---------------------|------------------|
| **Agent Creation** | `new Agent({ ... })` | `createReactAgent({ ... })` | Medium - wrapper needed |
| **Tool Format** | Vercel AI SDK tools | LangChain StructuredTool | High - conversion required |
| **Tool Loop** | `generateText({ maxSteps })` | Automatic in ReAct | Low - simplified |
| **MCP Integration** | `@modelcontextprotocol/sdk` | `@langchain/mcp-adapters` | Medium - different API |
| **Message Format** | Plain objects | LangChain Messages | Medium - normalization layer |
| **Structured Output** | `output` parameter | `withStructuredOutput()` | Low - similar pattern |

### 8.2 Incremental Migration Strategy

**Step 1: Add Provider Abstraction Layer** (Week 1-2)
- Create `BaseAPIProvider` interface
- Implement `MastraProvider` (current implementation)
- No breaking changes to existing code

**Step 2: Implement LangGraphProvider** (Week 3-4)
- Follow SowonFlow patterns
- Parallel implementation with Mastra
- Test with subset of agents

**Step 3: Tool Format Converters** (Week 5)
- Vercel AI SDK ↔ LangChain StructuredTool
- MCP tool adapters for both providers
- Unified tool registration

**Step 4: YAML Parser Updates** (Week 6)
- Support SowonFlow YAML structure
- Backward compatibility with current format
- Migration tool for existing workflows

**Step 5: Gradual Rollout** (Week 7-8)
- Feature flag for provider selection
- A/B testing with both providers
- Performance comparison

**Step 6: Mastra Deprecation** (Week 9-10)
- Migrate all agents to LangGraph
- Remove Mastra dependencies
- Documentation updates

---

## 9. Appendix: Code Examples

### 9.1 Complete MCP Integration Example

```typescript
// Example: Adding filesystem MCP server to workflow

// 1. Define MCP server configuration
const mcpServers = {
  filesystem: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
    env: {}
  }
};

// 2. Create workflow with MCP servers
const workflow = new Workflow({
  mainWorkflow: 'workflow.yaml',
  mcpServers
});

// 3. YAML agent configuration
/*
agents:
  - id: file_manager
    inline:
      type: agent
      model: openai/gpt-4o
      system_prompt: "You manage files and directories"
      mcp: ["filesystem"]  # ← References filesystem server
*/

// 4. Agent automatically gets MCP tools
const agent = workflow.agentMap['file_manager'];
// Agent has tools: [document_section, mcp__filesystem__read_file, mcp__filesystem__write_file, ...]

// 5. Agent uses MCP tools naturally
const result = await agent.ask("List files in /workspace/src");
// Agent will call mcp__filesystem__list_directory tool automatically
```

### 9.2 Complete Supervisor Example

```typescript
// Example: Creating a supervisor agent for document review

// YAML configuration
/*
agents:
  - id: review_supervisor
    inline:
      type: supervisor
      model: openai/gpt-4o
      supervisor_mode: parallel  # Force parallel review mode
      system_prompt: "You coordinate document reviews by legal and technical experts"
      agents:
        - legal_expert
        - technical_expert

  - id: legal_expert
    inline:
      type: agent
      model: openai/gpt-4o
      system_prompt: "You review documents for legal compliance"
      tools: ["document_section"]

  - id: technical_expert
    inline:
      type: agent
      model: openai/gpt-4o
      system_prompt: "You review documents for technical accuracy"
      tools: ["document_section"]
*/

// Usage
const workflow = new Workflow({ mainWorkflow: 'supervisor-workflow.yaml' });
await workflow.initializationPromise;

const supervisor = workflow.agentMap['review_supervisor'];

// Supervisor automatically:
// 1. Receives workflow_template_selector tool
// 2. Receives dynamic_workflow_executor tool
// 3. Gets enhanced system prompt with delegation instructions

const result = await supervisor.ask("Please review contract.pdf");

// Supervisor will:
// 1. Use workflow_template_selector to choose 'parallel_review' template
// 2. Use dynamic_workflow_executor with:
//    - template_name: "parallel_review"
//    - agents_mapping: { reviewer1: "legal_expert", reviewer2: "technical_expert", synthesizer: "legal_expert" }
//    - task_input: "Review contract.pdf"
// 3. Return synthesized review from both experts
```

### 9.3 Complete Tool Creation Example

```typescript
// Example: Creating a custom LangChain StructuredTool

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export class WebSearchTool extends StructuredTool {
  name = "web_search";
  description = `
    Searches the web for information using a search engine.
    Returns top 5 results with titles, snippets, and URLs.
  `;

  schema = z.object({
    query: z.string().describe("Search query"),
    num_results: z.number().optional().describe("Number of results (default: 5)")
  });

  async _call(input: { query: string; num_results?: number }): Promise<string> {
    const numResults = input.num_results || 5;

    try {
      // Call search API
      const response = await fetch(`https://api.search.com/search?q=${encodeURIComponent(input.query)}&n=${numResults}`);
      const data = await response.json();

      // Format results
      const results = data.results.map((r: any, i: number) =>
        `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`
      ).join('\n\n');

      return `Search results for "${input.query}":\n\n${results}`;
    } catch (error) {
      return `Search error: ${error.message}`;
    }
  }
}

// Register tool
const workflow = new Workflow({ mainWorkflow: 'workflow.yaml' });
workflow.addTool(new WebSearchTool());

// Use in agent configuration
/*
agents:
  - id: researcher
    inline:
      tools: ["web_search", "document_section"]
*/
```

---

## 10. Conclusion

### 10.1 Key Takeaways

1. **SowonFlow uses LangGraph `createReactAgent`** for individual agents, providing automatic tool calling loops and multi-step reasoning
2. **MCP integration via `@langchain/mcp-adapters`** seamlessly converts MCP servers to LangChain tools
3. **Supervisor pattern uses dynamic workflows** with template selection and agent orchestration tools
4. **Tool composition is layered:** Core → Built-in → MCP → Role-specific
5. **No top-level `mcp_servers` in YAML** - configured programmatically, referenced by agents

### 10.2 Recommended Next Steps for CrewX

**Week 1-2: Design Phase**
- Finalize `BaseAPIProvider` interface design
- Review tool format conversion requirements
- Design YAML structure enhancements

**Week 3-4: Implementation Phase**
- Implement `LangGraphProvider` based on SowonFlow patterns
- Create MCP client management system
- Build tool composition pipeline

**Week 5-6: Integration Phase**
- YAML parser updates for new structure
- Supervisor pattern implementation
- Tool name resolution system

**Week 7-8: Testing & Migration**
- Parallel testing with Mastra and LangGraph providers
- Performance benchmarking
- Migration documentation

**Week 9-10: Production Rollout**
- Feature flag rollout
- Monitor production metrics
- Iterative improvements

### 10.3 Success Metrics

- ✅ **Provider abstraction** allows swapping LangGraph ↔ Mastra ↔ Claude SDK
- ✅ **MCP tools work identically** across all providers
- ✅ **YAML compatibility** with SowonFlow workflows
- ✅ **Supervisor pattern** enables complex multi-agent orchestration
- ✅ **Performance parity** or better than current Mastra implementation

---

## 11. References

### 11.1 SowonFlow Production Codebase

**Location:** `/Users/doha/git/sowonai/packages/sowonflow`

**Key Files Analyzed:**
- `docs/workflow-schema.yaml` - YAML specification
- `src/workflow/InlineAgentFactory.ts` - Agent creation and tool composition
- `src/agents/SowonAgent.ts` - LangGraph agent wrapper
- `src/tools/DocumentSectionTool.ts` - Example tool implementation
- `tests/mcp.test.ts` - MCP integration tests
- `tests/supervisor-dynamic-workflow.test.ts` - Supervisor pattern tests

### 11.2 Dependencies

**Core Framework:**
- `@langchain/core` v0.3.66
- `@langchain/langgraph` v0.3.11
- `@langchain/community` v0.3.49
- `@langchain/mcp-adapters` v0.6.0

**Supporting Libraries:**
- `litellm` v0.12.0 - Model gateway
- `zod` v3.22.4 - Schema validation
- `handlebars` v4.7.8 - Template engine

### 11.3 Key Differences: CrewX vs SowonFlow

**IMPORTANT**: CrewX uses different terminology and structure than SowonFlow:

| Aspect | SowonFlow | CrewX |
|--------|-----------|-------|
| **System Prompt Field** | `system_prompt` | `prompt` |
| **Agent Framework** | LangGraph | Vercel AI SDK |
| **Tool Interface** | LangChain StructuredTool | Vercel AI SDK tool() |
| **MCP Configuration** | Programmatic (outside YAML) | YAML-based (mcp_servers section) |
| **Provider Type** | `model: "openai/gpt-4o"` | `provider: "api/openai-compatible"` |

**Example CrewX YAML**:
```yaml
agents:
  - id: research_agent
    provider: api/openai-compatible
    gateway: http://localhost:4000
    model: claude-3-5-sonnet-20241022
    prompt: "You are a research assistant"  # ← NOT system_prompt!
    tools:
      - http_search
      - github
```

### 11.4 Related Documents

- **WBS-19 Phase 1:** API Provider Design Architecture
- **WBS-20:** Base API Provider Interface Implementation
- **WBS-21:** Tool Calling System Design
- **WBS-22:** MCP Integration Design
- **WBS-23:** YAML Parsing and Agent Factory

---

**End of Analysis** 🎯

**Status:** ✅ Analysis Complete
**Next Phase:** WBS-20 Implementation (Base API Provider)
