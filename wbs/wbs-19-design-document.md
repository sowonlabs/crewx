[← WBS 개요](../wbs.md)

# WBS-19 Design Document: API Provider 최종 설계 (v2)

> **상태**: 🟡 진행중 (Phase 4 - 의사결정 필요)
> **날짜**: 2025-11-11
> **목적**: SowonFlow 패턴 기반 CrewX API Provider 설계

---

## 목차

1. [개요](#개요)
2. [핵심 설계 철학](#핵심-설계-철학)
3. [SowonFlow 패턴 분석](#sowonflow-패턴-분석)
4. [CrewX 최종 설계](#crewx-최종-설계)
5. [의사결정 포인트](#의사결정-포인트)
6. [구현 가이드라인](#구현-가이드라인)

---

## 개요

### Phase 1-3 완료 상태

| Phase | 산출물 | 상태 |
|-------|--------|------|
| Phase 1 | [Architecture Diagram](wbs-19-architecture-diagram.md) | ✅ 완료 |
| Phase 2 | [SowonFlow Spec Analysis](wbs-19-sowonflow-spec-analysis.md) | ✅ 완료 |
| Phase 3 | [TypeScript Types](../packages/sdk/src/types/api-provider.types.ts) | ⚠️ 수정 필요 |
| Phase 3 | [Zod Schemas](../packages/sdk/src/schemas/api-provider.schema.ts) | ⚠️ 수정 필요 |
| Phase 3 | [JSON Schema](../packages/sdk/schema/api-provider-config.json) | ⚠️ 수정 필요 |

### 주요 변경 사항 (v2)

**피드백 반영**:
1. ❌ **YAML에서 HTTP tool 정의 삭제** → ✅ **Function injection 패턴 채택**
2. ❌ `gateway` 용어 → ✅ `url` 용어 사용
3. ❌ Provider 3종류만 → ✅ **7종류** (openai, anthropic, google, bedrock, litellm, ollama, **sowonai**)
4. ❌ Tools string array만 → ✅ **include/exclude 패턴** (skills 참고)
5. ❌ MCP만 include/exclude → ✅ **Tools도 include/exclude**

---

## 핵심 설계 철학

### 1. Framework Philosophy (프레임워크로서의 CrewX)

CrewX는 **라이브러리가 아니라 프레임워크**다:
- ❌ **Wrong**: YAML에 모든 것을 정의 (정적, 확장 불가)
- ✅ **Right**: TypeScript로 확장 가능 (동적, 유연함)

### 2. Tool Injection Pattern (SowonFlow 방식)

```typescript
// ❌ Wrong: YAML에 HTTP tool 정의
tools:
  - name: company_search
    type: http
    endpoint: https://api.company.com/search

// ✅ Right: TypeScript로 function 주입
import { tool } from 'ai';

const companySearchTool = tool({
  name: 'company_search',
  description: 'Search company database',
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    // Custom business logic
    return await myAPI.search(query);
  },
});

// Framework API 사용
const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [companySearchTool, weatherTool],  // ← Function injection!
});
```

### 3. YAML은 선언만, Code는 구현

| 항목 | YAML (선언적) | TypeScript (구현) |
|------|---------------|-------------------|
| **MCP Servers** | ✅ 설정 (`command`, `args`, `env`) | ✅ MCP 클라이언트 연결 |
| **Tools** | ✅ 활성화 (`include`, `exclude`) | ✅ Tool 구현 (function injection) |
| **Agents** | ✅ 구성 (`provider`, `model`, `prompt`) | ✅ Agent 생성 및 실행 |

---

## SowonFlow 패턴 분석

### 1. WorkflowOptions (Constructor Injection)

```typescript
// SowonFlow: src/workflow/Workflow.ts
export interface WorkflowOptions {
  tools?: BaseTool[];          // ← Tool function injection!
  mcpServers?: Record<string, any>; // MCP 서버 설정
  // ...
}

const workflow = new Workflow({
  mainWorkflow: 'workflow.yaml',
  tools: [customTool1, customTool2],  // ← Injected tools!
  mcpServers: {
    github: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
  },
});
```

### 2. Agent Tool Merging (InlineAgentFactory)

```typescript
// SowonFlow: src/workflow/InlineAgentFactory.ts
let tools = {};

// 1. Supervisor tools (built-in)
if (agentDef.type === 'supervisor') {
  tools = {
    ...tools,
    workflow_template_selector: selectorTool,
    dynamic_workflow_executor: executorTool,
  };
}

// 2. MCP tools (from YAML mcp field)
if (agentDef.mcp && Array.isArray(agentDef.mcp)) {
  const mcpTools = await this.loadMcpTools(agentDef.mcp, mcpServers);
  tools = {
    ...tools,
    ...mcpTools,  // ← MCP tools 병합
  };
}

// 3. Injected tools (from WorkflowOptions.tools)
// → Workflow 클래스에서 주입된 tools를 agent에 전달

// Mastra Agent 생성
const agent = new MastraAgent({
  name: agentId,
  instructions: systemPrompt,
  model: aiModel,
  tools: tools,  // ← 모든 tools 병합!
});
```

### 3. YAML 구조 (SowonFlow)

```yaml
# MCP 서버 설정 (전역)
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

agents:
  - id: research_agent
    model: "openai/gpt-4o"
    system_prompt: "You are a research assistant"

    # MCP 활성화
    mcp:
      - github    # ← MCP tool 활성화
      - slack
```

---

## CrewX 최종 설계

### 1. TypeScript API (Framework Usage)

```typescript
// ========================================
// CrewX Framework API 사용 예시
// ========================================
import { CrewX, tool } from '@crewx/sdk';
import { z } from 'zod';

// 1. Custom tools 정의 (function injection + context)
const companySearchTool = tool({
  name: 'company_search',
  description: 'Search company database',
  parameters: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  execute: async ({ query, limit }, context) => {
    // ✅ Agent 정보 접근 가능!
    console.log(`[${context.agent.id}] Searching: ${query}`);

    // Logging with agent context
    await logToolUsage({
      agentId: context.agent.id,
      provider: context.agent.provider,
      model: context.agent.model,
      toolName: 'company_search',
      timestamp: context.request?.timestamp,
    });

    // Custom business logic
    const results = await fetch(`https://api.company.com/search?q=${query}&limit=${limit}`);
    return results.json();
  },
});

const weatherTool = tool({
  name: 'weather',
  description: 'Get current weather',
  parameters: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    const response = await fetch(`https://api.weather.com/current?city=${city}`);
    return response.json();
  },
});

// 2. CrewX 인스턴스 생성 (tools 주입)
const crewx = new CrewX({
  configPath: 'crewx.yaml',

  // Tool injection (SowonFlow 방식)
  tools: [
    companySearchTool,
    weatherTool,
    // ... more custom tools
  ],
});

// 3. Agent 실행
const result = await crewx.runAgent('research_agent', {
  input: 'Search for AI companies',
});
```

### 2. YAML 구조 (crewx.yaml)

```yaml
# ========================================
# Global Variables (전역 변수)
# ========================================
# 프로젝트 전반에서 공용으로 사용되는 변수 정의
# {{vars.key}} 형태로 프롬프트, 도구, 에이전트 설정 등 어디서든 참조 가능
# Tool Execution Context에도 자동으로 주입됨
vars:
  systemRole: "You are an expert AI assistant specialized in software development"
  companyName: "Acme Corporation"
  projectContext: "This is a microservices architecture project using NestJS and TypeScript"
  defaultTemperature: 0.7
  maxRetries: 3
  apiVersion: "v1"

# ========================================
# MCP Servers 설정 (전역)
# ========================================
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"

  slack:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: "{{env.SLACK_BOT_TOKEN}}"

# ========================================
# Agents 정의
# ========================================
agents:
  # API Provider 예시 1: OpenAI (with vars reference)
  - id: openai_agent
    provider: api/openai
    url: https://api.openai.com/v1
    apiKey: "{{env.OPENAI_API_KEY}}"  # ← Environment variable (recommended)
    model: gpt-4o
    temperature: {{vars.defaultTemperature}}  # ← Using global vars!
    prompt: |
      {{vars.systemRole}}
      You are working for {{vars.companyName}}.
      {{vars.projectContext}}
    tools: [company_search, weather, github]  # ← Simple array (SowonFlow style)
    mcp: [github, slack]  # ← MCP servers to activate

  # API Provider 예시 2: Anthropic (with vars reference)
  - id: claude_agent
    provider: api/anthropic
    url: https://api.anthropic.com
    apiKey: "{{env.ANTHROPIC_API_KEY}}"  # ← Environment variable
    model: claude-3-5-sonnet-20241022
    temperature: {{vars.defaultTemperature}}  # ← Using global vars!
    prompt: |
      You are Claude, an AI assistant for {{vars.companyName}}.
      {{vars.projectContext}}
    tools: [company_search, slack]  # ← Simple array

  # API Provider 예시 3: LiteLLM Gateway
  - id: litellm_agent
    provider: api/litellm
    url: http://localhost:4000
    apiKey: "{{env.LITELLM_API_KEY}}"  # ← LiteLLM master key (optional)
    model: claude-3-5-sonnet-20241022
    prompt: "You are a coding assistant"
    tools: [github, company_search]
    mcp: [github]

  # API Provider 예시 4: Ollama (no API key needed)
  - id: ollama_agent
    provider: api/ollama
    url: http://localhost:11434
    # apiKey not required for Ollama
    model: llama3.2
    prompt: "You are a local assistant"
    tools: [weather]

  # API Provider 예시 5: SowonAI (너의 회사 제품!)
  - id: sowonai_agent
    provider: api/sowonai
    url: https://api.sowon.ai/v1
    apiKey: "{{env.SOWONAI_API_KEY}}"  # ← Your company API key
    model: sowon-v1
    prompt: "You are SowonAI assistant"
    tools: [company_search, github, slack]
    mcp: [github, slack]

  # API Provider 예시 6: Google AI
  - id: gemini_agent
    provider: api/google
    url: https://generativelanguage.googleapis.com/v1
    apiKey: "{{env.GOOGLE_API_KEY}}"  # ← Google AI API key
    model: gemini-pro
    prompt: "You are Gemini"
    tools: [weather]

  # API Provider 예시 7: AWS Bedrock (uses AWS credentials)
  - id: bedrock_agent
    provider: api/bedrock
    url: https://bedrock.us-east-1.amazonaws.com
    # Bedrock uses AWS credentials ({{env.AWS_ACCESS_KEY_ID}}, {{env.AWS_SECRET_ACCESS_KEY}})
    # apiKey not used for Bedrock
    model: anthropic.claude-3-sonnet-20240229-v1:0
    prompt: "You are Bedrock Claude"
    tools: [company_search]
```

**Global Variables (`vars`) 상세 설명**:

`vars` 섹션은 프로젝트 전반에서 공용으로 사용할 수 있는 변수를 정의하는 곳입니다.

**특징**:
1. **템플릿 참조**: `{{vars.key}}` 형태로 YAML 어디서든 참조 가능
2. **Tool Context 주입**: Tool execute 함수에서 `context.vars`로 접근 가능
3. **타입 안전성**: 런타임에 자동으로 검증 (Zod schema)
4. **CLI/SDK 공통**: CLI와 SDK 모두에서 동일하게 사용 가능

**사용 예시**:
```yaml
vars:
  systemRole: "You are an expert developer"
  companyName: "Acme Corp"
  maxRetries: 3

agents:
  - id: my_agent
    provider: api/openai
    model: gpt-4o
    temperature: {{vars.defaultTemperature}}
    prompt: |
      {{vars.systemRole}}
      You work for {{vars.companyName}}.
```

**Tool 내부에서 vars 접근**:
```typescript
const myTool = tool({
  name: 'company_search',
  execute: async (args, context) => {
    const companyName = context.vars?.companyName;
    const maxRetries = context.vars?.maxRetries || 3;
    // ... use vars in tool logic
  },
});
```

### 3. TypeScript Types (수정 버전)

**파일**: `packages/sdk/src/types/api-provider.types.ts`

```typescript
/**
 * API Provider 타입 정의
 */
export type APIProviderType =
  | 'api/openai'      // OpenAI API
  | 'api/anthropic'   // Anthropic API
  | 'api/google'      // Google AI API
  | 'api/bedrock'     // AWS Bedrock
  | 'api/litellm'     // LiteLLM Gateway
  | 'api/ollama'      // Ollama
  | 'api/sowonai';    // SowonAI (너의 회사 제품!)

/**
 * API Provider 설정
 */
export interface APIProviderConfig {
  provider: APIProviderType;

  /** API base URL (gateway → url로 변경!) */
  url?: string;

  /** API key (optional, can use env variable) */
  apiKey?: string;

  /** Model identifier */
  model: string;

  /** Temperature (0.0 - 2.0) */
  temperature?: number;

  /** Max tokens */
  maxTokens?: number;

  /** Tool names to activate (simple array - SowonFlow style) */
  tools?: string[];

  /** MCP server names to activate (simple array - SowonFlow style) */
  mcp?: string[];
}

/**
 * MCP Server 설정
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Tool Execution Context
 * Tool execute 함수에 전달되는 context (템플릿 렌더링과 완전히 동일한 구조!)
 *
 * Template System 통합:
 * - {{env.VAR}} - Environment variables
 * - {{agent.id}} - Agent info
 * - {{context.key}} - User-defined context
 * - {{vars.customKey}} - Custom variables
 * - {{tools.count}} - Tool info
 * - {{messages.length}} - Conversation history
 * - {{documents.name.content}} - Document access
 * - {{mode}} - Execution mode (query | execute)
 * - {{platform}} - Platform (cli | slack | api)
 */
export interface ToolExecutionContext {
  /** Agent information ({{agent.id}}, {{agent.provider}}) */
  agent: {
    id: string;
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };

  /** Agent metadata ({{agentMetadata.description}}) */
  agentMetadata?: Record<string, any>;

  /** Environment variables ({{env.VAR}}) */
  env: Record<string, string>;

  /** User-defined context ({{context.key}}) */
  context?: Record<string, any>;

  /** Custom variables ({{vars.key}}) */
  vars?: Record<string, any>;

  /** Execution mode ({{mode}}) - query | execute */
  mode?: 'query' | 'execute';

  /** Conversation messages ({{messages.length}}) */
  messages?: any[];

  /** Platform ({{platform}}) - cli | slack | api */
  platform?: string;

  /** Tools info ({{tools.count}}, {{tools.json}}) */
  tools?: {
    available: string[];
    count: number;
    json?: string;
  };

  /** Document access ({{documents.name.content}}) */
  documents?: Record<string, {
    content?: string;
    toc?: string;
    summary?: string;
  }>;

  /** Request metadata */
  request?: {
    timestamp: Date;
    conversationId?: string;
    threadId?: string;
  };

  /** CrewX instance for inter-agent communication */
  crewx?: CrewXInstance;  // For agent_call built-in tool
}

/**
 * Tool Definition (Vercel AI SDK 기반)
 * YAML이 아니라 TypeScript에서만 정의!
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: any, context: ToolExecutionContext) => Promise<any>;
}

/**
 * CrewX Framework Options (SowonFlow 패턴)
 */
export interface CrewXOptions {
  /** YAML config file path */
  configPath: string;

  /** Injected tools (function injection!) */
  tools?: ToolDefinition[];

  /** MCP servers (optional, can be in YAML or here) */
  mcpServers?: Record<string, MCPServerConfig>;
}
```

### 4. Tool Registry (Global Tool Management)

**파일**: `packages/sdk/src/core/tools/tool-registry.ts`

```typescript
import { CoreTool, tool } from 'ai';
import { ToolDefinition } from '../../types/api-provider.types';

/**
 * Global Tool Registry
 * - Injected tools (from CrewXOptions.tools)
 * - MCP tools (from MCP servers)
 */
export class ToolRegistry {
  private injectedTools: Map<string, ToolDefinition> = new Map();
  private mcpTools: Map<string, CoreTool> = new Map();

  /**
   * Register injected tools
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.injectedTools.set(tool.name, tool);
    }
  }

  /**
   * Register MCP tools
   */
  registerMCPTools(serverName: string, tools: CoreTool[]): void {
    for (const tool of tools) {
      // MCP tool name: serverName:toolName
      this.mcpTools.set(`${serverName}:${tool.name}`, tool);
    }
  }

  /**
   * Get tools for agent (include/exclude pattern)
   */
  getToolsForAgent(config: {
    include?: string[];
    exclude?: string[];
  }): CoreTool[] {
    const result: CoreTool[] = [];

    // All available tools
    const allToolNames = new Set([
      ...this.injectedTools.keys(),
      ...this.mcpTools.keys(),
    ]);

    // Apply include/exclude
    for (const toolName of allToolNames) {
      // Check exclude first
      if (config.exclude?.includes(toolName)) {
        continue;
      }

      // Check include
      if (config.include && !config.include.includes(toolName)) {
        continue;
      }

      // Get tool
      const injectedTool = this.injectedTools.get(toolName);
      const mcpTool = this.mcpTools.get(toolName);

      if (injectedTool) {
        result.push(this.convertToCoreTool(injectedTool));
      } else if (mcpTool) {
        result.push(mcpTool);
      }
    }

    return result;
  }

  /**
   * Convert ToolDefinition to CoreTool
   */
  private convertToCoreTool(toolDef: ToolDefinition): CoreTool {
    return tool({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      execute: toolDef.execute,
    });
  }
}
```

---

## 의사결정 포인트

### 1. Provider 타입 확정 ✅

**결정**: 7종류 지원

```typescript
export type APIProviderType =
  | 'api/openai'      // ✅ OpenAI
  | 'api/anthropic'   // ✅ Anthropic
  | 'api/google'      // ✅ Google AI
  | 'api/bedrock'     // ✅ AWS Bedrock
  | 'api/litellm'     // ✅ LiteLLM Gateway
  | 'api/ollama'      // ✅ Ollama
  | 'api/sowonai';    // ✅ SowonAI (너의 회사!)
```

**이유**:
- ✅ **다양한 AI 서비스 지원**: OpenAI, Anthropic, Google, AWS
- ✅ **Gateway 지원**: LiteLLM (모든 LLM 통합)
- ✅ **로컬 AI**: Ollama
- ✅ **커스텀 Provider**: SowonAI (너의 회사 제품!)

---

### 2. Tools 설계: Function Injection ✅

#### 옵션 A: YAML에 HTTP tool 정의 ❌

```yaml
# ❌ Wrong: YAML에 모든 것 정의
tools:
  - name: company_search
    type: http
    endpoint: https://api.company.com/search
    method: POST
```

**문제**:
- ❌ **정적**: Business logic을 YAML에 표현 불가
- ❌ **확장 불가**: Custom logic 추가 불가
- ❌ **프레임워크 철학 위배**: CrewX는 라이브러리가 아님

#### 옵션 B: Function Injection (SowonFlow 방식) ✅

```typescript
// ✅ Right: TypeScript로 function 주입
import { tool } from 'ai';

const companySearchTool = tool({
  name: 'company_search',
  description: 'Search company database',
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    // Custom business logic!
    const auth = await getAuthToken();
    const results = await myAPI.search(query, { auth });
    return transformResults(results);
  },
});

const crewx = new CrewX({
  configPath: 'crewx.yaml',
  tools: [companySearchTool],  // ← Function injection!
});
```

**YAML에서는 활성화만**:
```yaml
agents:
  - id: research_agent
    tools:
      include: [company_search]  # ← 활성화만!
```

**장점**:
- ✅ **유연함**: Custom business logic 구현 가능
- ✅ **프레임워크**: Web 서버에서 동적으로 확장 가능
- ✅ **SowonFlow 호환**: 검증된 패턴

**결정**: ✅ **Function Injection 채택**

---

### 3. Tool 활성화: include/exclude 패턴 ✅

**SowonFlow에는 없지만 CrewX skills 패턴 참고**:

```yaml
agents:
  - id: research_agent
    tools:
      include:
        - company_search  # ← Activate
        - weather
        - github          # ← MCP tool
      exclude:
        - file_delete     # ← Deactivate (dangerous)
        - rm_command
```

**장점**:
- ✅ **세밀한 제어**: Agent별로 tool 선택
- ✅ **보안**: 위험한 tool 제외 가능
- ✅ **Skills 일관성**: CrewX skills 패턴과 일치

**결정**: ✅ **include/exclude 패턴 채택**

---

### 4. MCP 활성화: include/exclude 패턴 ✅

**SowonFlow 방식**:
```yaml
agents:
  - id: research_agent
    mcp: [github, slack]  # ← Array만
```

**CrewX 방식 (개선)**:
```yaml
agents:
  - id: research_agent
    mcp:
      include: [github, slack]  # ← include/exclude 가능
      exclude: [dangerous_mcp]
```

**장점**:
- ✅ **Tools와 일관성**: `tools.include/exclude`와 동일 패턴
- ✅ **세밀한 제어**: MCP 서버별 활성화/비활성화

**결정**: ✅ **include/exclude 패턴 채택**

---

### 5. Provider 설정: url 필드 ✅

#### 옵션 A: gateway 용어 ❌

```yaml
agents:
  - provider: api/openai-compatible
    gateway: http://localhost:4000  # ← "gateway"는 부정확
```

#### 옵션 B: url 용어 ✅

```yaml
agents:
  - provider: api/litellm
    url: http://localhost:4000  # ← "url"이 명확
```

**결정**: ✅ **url 필드 채택**

**이유**:
- ✅ **명확함**: `gateway`는 LiteLLM에만 해당, `url`은 모든 API에 적용
- ✅ **일관성**: OpenAI, Anthropic, SowonAI 모두 `url` 필요

---

### 6. Built-in 도구: agent_call (에이전트 간 통신) ✅

**User 요구사항**: "기본 툴로 다른 에이전트를 호출하는 기능이 디폴트로 있었으면 서로 대화 하는데 도움이 많이 될거 같아"

**설계**: CrewX CLI의 `crewx q @agent_name` 패턴을 built-in tool로 제공

```typescript
// Built-in tool: agent_call
import { tool } from 'ai';
import { z } from 'zod';

const agentCallTool = tool({
  name: 'agent_call',
  description: 'Call another agent to perform a task or answer a question',
  parameters: z.object({
    agentId: z.string().describe('Target agent ID (e.g., "research_agent", "translator")'),
    message: z.string().describe('Message or task to send to the agent'),
    context: z.record(z.any()).optional().describe('Optional context to pass to the agent'),
  }),
  execute: async ({ agentId, message, context: passedContext }, context) => {
    // Get agent from registry
    const agent = context.crewx.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Call agent (same as crewx q @agent_name)
    const response = await agent.query(message, {
      ...passedContext,
      // Pass execution context
      parentAgentId: context.agent.id,
      parentConversationId: context.request?.conversationId,
    });

    return {
      agentId,
      response: response.content,
      timestamp: new Date().toISOString(),
    };
  },
});
```

**YAML 사용 예시**:

```yaml
agents:
  # Research agent (can call translator)
  - id: research_agent
    provider: api/openai
    model: gpt-4
    tools: [agent_call]  # ← Built-in inter-agent communication
    prompt: |
      You are a research agent. When you find English content that needs
      translation, use the agent_call tool to ask translator_agent for help.

  # Translator agent
  - id: translator_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    prompt: |
      You are a translator. Translate content to Korean.
```

**실행 흐름**:

```
User Query: "미국 AI 시장 조사해줘"
    ↓
research_agent executes
    ↓
Research agent finds English article
    ↓
agent_call({ agentId: "translator_agent", message: "Translate this: [article]" })
    ↓
translator_agent executes
    ↓
Translation result returned
    ↓
research_agent continues with translated content
    ↓
Final response to user
```

**장점**:
- ✅ **자연스러운 협업**: Agent들이 서로 도움 요청 가능
- ✅ **CLI 패턴 재사용**: `crewx q @agent` 패턴과 동일
- ✅ **컨텍스트 전달**: Parent agent 정보, conversation ID 전달
- ✅ **순환 호출 방지**: Max depth limit으로 무한 루프 방지

**구현 포인트**:
1. **Agent Registry**: CrewX가 모든 agent 관리
2. **Context 전달**: `ToolExecutionContext`에 `crewx` 인스턴스 포함
3. **Depth Limit**: `maxAgentCallDepth` 설정으로 무한 루프 방지
4. **Thread 관리**: 각 agent 호출이 별도 thread 생성 가능

---

## 구현 가이드라인

### WBS-20: BaseAPIProvider 구현

**파일**: `packages/sdk/src/core/providers/base-api.provider.ts`

```typescript
import { generateText, CoreTool } from 'ai';
import { AIProvider, AIQueryOptions, AIResponse } from '../../types';
import { APIProviderConfig } from '../../types/api-provider.types';
import { ToolRegistry } from '../tools/tool-registry';

export abstract class BaseAPIProvider implements AIProvider {
  abstract readonly name: string;

  protected config: APIProviderConfig;
  protected toolRegistry: ToolRegistry;

  constructor(config: APIProviderConfig, toolRegistry: ToolRegistry) {
    this.config = config;
    this.toolRegistry = toolRegistry;
  }

  async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
    // 1. Initialize model
    const model = this.initializeModel();

    // 2. Get tools for this agent
    const tools = this.toolRegistry.getToolsForAgent({
      include: this.config.tools?.include,
      exclude: this.config.tools?.exclude,
    });

    // 3. Call generateText
    const result = await generateText({
      model,
      prompt,
      tools,
      maxSteps: options?.maxSteps ?? 10,
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens,
    });

    return {
      content: result.text,
      success: true,
    };
  }

  protected abstract initializeModel(): any;

  async isAvailable(): Promise<boolean> {
    // Health check
    return true;
  }

  async getToolPath(): Promise<string | null> {
    // API provider has no local tool path
    return null;
  }
}
```

### WBS-21: Provider Implementations

**파일**: `packages/sdk/src/core/providers/openai-api.provider.ts`

```typescript
import { openai } from '@ai-sdk/openai';
import { BaseAPIProvider } from './base-api.provider';

export class OpenAIAPIProvider extends BaseAPIProvider {
  readonly name = 'api/openai';

  protected initializeModel() {
    return openai(this.config.model, {
      baseURL: this.config.url,
      apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,  // ← API key
    });
  }
}
```

**파일**: `packages/sdk/src/core/providers/anthropic-api.provider.ts`

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { BaseAPIProvider } from './base-api.provider';

export class AnthropicAPIProvider extends BaseAPIProvider {
  readonly name = 'api/anthropic';

  protected initializeModel() {
    return anthropic(this.config.model, {
      baseURL: this.config.url,
      apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,  // ← API key
    });
  }
}
```

**파일**: `packages/sdk/src/core/providers/litellm-api.provider.ts`

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { BaseAPIProvider } from './base-api.provider';

export class LiteLLMAPIProvider extends BaseAPIProvider {
  readonly name = 'api/litellm';

  protected initializeModel() {
    const provider = createOpenAICompatible({
      name: 'litellm',
      baseURL: this.config.url || 'http://localhost:4000',
      apiKey: this.config.apiKey || process.env.LITELLM_API_KEY || 'dummy',  // ← API key
    });
    return provider(this.config.model);
  }
}
```

**파일**: `packages/sdk/src/core/providers/sowonai-api.provider.ts`

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { BaseAPIProvider } from './base-api.provider';

export class SowonAIAPIProvider extends BaseAPIProvider {
  readonly name = 'api/sowonai';

  protected initializeModel() {
    const provider = createOpenAICompatible({
      name: 'sowonai',
      baseURL: this.config.url || 'https://api.sowon.ai/v1',
      apiKey: this.config.apiKey || process.env.SOWONAI_API_KEY,  // ← API key
    });
    return provider(this.config.model);
  }
}
```

**파일**: `packages/sdk/src/core/providers/ollama-api.provider.ts`

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { BaseAPIProvider } from './base-api.provider';

export class OllamaAPIProvider extends BaseAPIProvider {
  readonly name = 'api/ollama';

  protected initializeModel() {
    const provider = createOpenAICompatible({
      name: 'ollama',
      baseURL: this.config.url || 'http://localhost:11434',
      // Ollama doesn't require API key
    });
    return provider(this.config.model);
  }
}
```

### WBS-22: MCP 통합

**파일**: `packages/sdk/src/core/mcp/mcp-client.ts`

```typescript
import { Client, StdioClientTransport } from '@modelcontextprotocol/sdk/client';
import { CoreTool, tool } from 'ai';
import { MCPServerConfig } from '../../types/api-provider.types';
import { jsonSchemaToZod } from '../utils/json-schema-to-zod';

export class MCPClient {
  private connections: Map<string, Client> = new Map();

  /**
   * Connect to all MCP servers
   */
  async connectAll(mcpServers: Record<string, MCPServerConfig>): Promise<void> {
    for (const [name, config] of Object.entries(mcpServers)) {
      try {
        await this.connect(name, config);
      } catch (error) {
        console.error(`Failed to connect to MCP server ${name}:`, error);
      }
    }
  }

  /**
   * Connect to MCP server
   */
  async connect(name: string, config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    const client = new Client({
      name: `crewx-client-${name}`,
      version: '1.0.0',
    }, {
      capabilities: { tools: {} },
    });

    await client.connect(transport);
    this.connections.set(name, client);
  }

  /**
   * Get all tools from MCP server
   */
  async getToolsForServer(serverName: string): Promise<CoreTool[]> {
    const client = this.connections.get(serverName);
    if (!client) return [];

    const { tools } = await client.listTools();

    return tools.map(mcpTool =>
      tool({
        name: `${serverName}:${mcpTool.name}`,  // ← MCP tool naming
        description: mcpTool.description || '',
        parameters: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (input) => {
          const result = await client.callTool({
            name: mcpTool.name,
            arguments: input,
          });
          return result.content;
        },
      })
    );
  }
}
```

### CrewX 클래스 (Framework Entry Point)

**파일**: `packages/sdk/src/core/crewx.ts`

```typescript
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { CrewXOptions, ToolDefinition, MCPServerConfig } from '../types/api-provider.types';
import { ToolRegistry } from './tools/tool-registry';
import { MCPClient } from './mcp/mcp-client';
import { BaseAPIProvider } from './providers/base-api.provider';
import { OpenAIAPIProvider } from './providers/openai-api.provider';
import { AnthropicAPIProvider } from './providers/anthropic-api.provider';
// ... other providers

export class CrewX {
  private config: any;
  private toolRegistry: ToolRegistry;
  private mcpClient: MCPClient;
  private agents: Map<string, BaseAPIProvider> = new Map();

  constructor(options: CrewXOptions) {
    // 1. Load YAML config
    this.config = yaml.load(fs.readFileSync(options.configPath, 'utf8'));

    // 2. Initialize Tool Registry
    this.toolRegistry = new ToolRegistry();

    // 3. Register injected tools
    if (options.tools) {
      this.toolRegistry.registerTools(options.tools);
    }

    // 4. Initialize MCP Client
    this.mcpClient = new MCPClient();

    // 5. Initialize (async)
    this.initializationPromise = this.initialize(options);
  }

  private async initialize(options: CrewXOptions): Promise<void> {
    // 1. Connect to MCP servers
    const mcpServers = options.mcpServers || this.config.mcp_servers || {};
    await this.mcpClient.connectAll(mcpServers);

    // 2. Register MCP tools
    for (const serverName of Object.keys(mcpServers)) {
      const mcpTools = await this.mcpClient.getToolsForServer(serverName);
      this.toolRegistry.registerMCPTools(serverName, mcpTools);
    }

    // 3. Create agents
    for (const agentConfig of this.config.agents || []) {
      const agent = this.createAgent(agentConfig);
      this.agents.set(agentConfig.id, agent);
    }
  }

  private createAgent(agentConfig: any): BaseAPIProvider {
    switch (agentConfig.provider) {
      case 'api/openai':
        return new OpenAIAPIProvider(agentConfig, this.toolRegistry);
      case 'api/anthropic':
        return new AnthropicAPIProvider(agentConfig, this.toolRegistry);
      // ... other providers
      default:
        throw new Error(`Unsupported provider: ${agentConfig.provider}`);
    }
  }

  async runAgent(agentId: string, options: { input: string }): Promise<any> {
    await this.initializationPromise;

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.query(options.input);
  }
}
```

---

## 다음 단계

### Phase 4 완료 조건

- [x] SowonFlow 패턴 분석 완료
- [x] Function injection 설계 완료
- [x] Provider 7종류 확정
- [x] include/exclude 패턴 설계
- [x] 설계 문서 작성 완료
- [ ] **의사결정 승인** (네가 확인)

### WBS-20 시작 조건

Phase 4 승인 후:
1. TypeScript 타입 수정 (Phase 3 재작업)
2. BaseAPIProvider 구현
3. Provider 7종류 구현
4. ToolRegistry 구현
5. MCPClient 구현
6. CrewX 클래스 구현

---

## 참고 문서

- [Phase 1: Architecture Diagram](wbs-19-architecture-diagram.md)
- [Phase 2: SowonFlow Spec Analysis](wbs-19-sowonflow-spec-analysis.md)
- [Phase 3: TypeScript Types](../packages/sdk/src/types/api-provider.types.ts) (수정 필요)
- [Phase 3: Zod Schemas](../packages/sdk/src/schemas/api-provider.schema.ts) (수정 필요)
- [SowonFlow: Workflow.ts](https://github.com/sowonai/sowonflow/blob/main/src/workflow/Workflow.ts)
- [SowonFlow: InlineAgentFactory.ts](https://github.com/sowonai/sowonflow/blob/main/src/workflow/InlineAgentFactory.ts)
- [WBS 개요](../wbs.md)
