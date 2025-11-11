[← WBS 개요](../wbs.md)

# WBS-19 API Provider 설계 및 기획

> **상태**: 🟡 진행중
> **디펜던시**: -
> **예상 소요**: 2-3일
> **우선순위**: P0

## 목표

Vercel AI SDK 기반 API Provider 아키텍처 설계 및 YAML 스펙 정의

## 배경

현재 CrewX는 CLI Provider만 존재 (spawn 기반, 로컬 코딩 에이전트 전용). 서버 환경에서 실행 가능한 API Provider가 필요하며, 이를 위해:
- Vercel AI SDK 기반 (`generateText`, `tool()`)
- LiteLLM 게이트웨이 지원 (OpenAI Compatible)
- Tool Calling 시스템 (Local tools, MCP tools, HTTP tools)
- SowonFlow YAML 스펙 참고하여 확장 가능하게 설계

## Phase 1: 아키텍처 설계 (1일)

### 작업 내용

#### 1.1 Provider 계층 구조 설계
- `BaseAPIProvider` 추상 클래스 설계
  - `AIProvider` 인터페이스 구현
  - Vercel AI SDK 래핑
  - Tool Calling 지원
- 기존 `BaseAIProvider`와의 관계 정립
  - CLI Provider: spawn 기반, 로컬 실행
  - API Provider: HTTP 기반, 서버 실행
  - 공통 인터페이스: `query()`, `execute()`, `isAvailable()`

#### 1.2 Tool Calling 흐름 설계
```
User Query
    ↓
BaseAPIProvider.query()
    ↓
Vercel AI generateText(tools: [...])
    ↓
AI decides to call tool → executeLocalTool()
    ↓
Tool result → Vercel AI continues
    ↓
Final response
```

**Tool 종류**:
1. **Local Tools**: `read_file`, `write_file`, `bash_command`
2. **MCP Tools**: MCP 서버에서 가져온 tools (Slack, GitHub 등)
3. **HTTP Tools**: Custom HTTP endpoint tools

#### 1.3 MCP 통합 포인트 설계
- MCP Client 초기화 시점: Provider 생성 시
- MCP Tools → Vercel Tools 변환 로직
- MCP Server 연결 관리 (lifecycle)

### 산출물
- `wbs/wbs-19-architecture-diagram.md` - 아키텍처 다이어그램 및 설명

### 완료 조건
- [ ] Provider 계층 구조 다이어그램 완성
- [ ] Tool Calling 흐름도 완성
- [ ] MCP 통합 포인트 명확화

---

## Phase 2: YAML 스펙 정의 (1일)

### 작업 내용

#### 2.1 SowonFlow YAML 스펙 분석
**@sowonflow_claude_dev에게 분석 요청**:
```bash
crewx q "@sowonflow_claude_dev SowonFlow YAML 스펙을 분석해서 다음 항목들을 자세히 설명해줘:
1. mcp_servers 섹션 구조 (command, args, env 설정 방식)
2. tools 섹션 정의 (tool 타입별 설정)
3. agent/workflow 설정 방식 (provider, model, tools 연결)
4. Vercel AI SDK 통합 패턴 (generateText, streamText 사용 방식)

/Users/doha/git/sowonflow 디렉토리의 코드를 참고해서 실제 구현과 함께 설명해줘."
```

**분석 결과 문서화**: `wbs/wbs-19-sowonflow-spec-analysis.md`

#### 2.2 CrewX YAML 스키마 확장 설계

**기존**:
```yaml
agents:
  - id: my_agent
    provider: cli/claude
    model: sonnet
```

**확장 (API Provider)**:
```yaml
# MCP 서버 설정 (전역)
mcp_servers:
  slack:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}

  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]

# Custom HTTP Tools 설정 (전역)
tools:
  - name: company_api
    type: http
    endpoint: https://api.company.com/tool
    method: POST
    headers:
      Authorization: "Bearer ${API_TOKEN}"

# Agent 정의
agents:
  - id: api_agent
    provider: api/openai-compatible  # 새로운 provider 타입!
    gateway: http://localhost:4000   # LiteLLM gateway
    model: claude-3-5-sonnet-20241022

    # Tool 활성화
    tools:
      - read_file      # Local tool
      - write_file     # Local tool
      - slack          # MCP tool (from mcp_servers.slack)
      - github         # MCP tool (from mcp_servers.github)
      - company_api    # HTTP tool (from tools[])
```

#### 2.3 JSON Schema 생성
- `packages/sdk/schema/api-provider-config.json` 작성
- Zod schema와 동기화
- VSCode YAML 자동완성 지원

### 산출물
- `wbs/wbs-19-sowonflow-spec-analysis.md` - SowonFlow 분석 결과
- `packages/sdk/schema/api-provider-config.json` - JSON Schema

### 완료 조건
- [ ] SowonFlow 스펙 분석 완료
- [ ] CrewX YAML 확장 설계 완료
- [ ] JSON Schema 작성 완료

---

## Phase 3: 타입 시스템 설계 (0.5일)

### 작업 내용

#### 3.1 TypeScript 인터페이스 정의

**파일**: `packages/sdk/src/types/api-provider.types.ts`

```typescript
// API Provider 설정
export interface APIProviderConfig {
  provider: 'api/openai-compatible' | 'api/openai' | 'api/anthropic';
  gateway?: string;  // LiteLLM gateway URL
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];  // Tool names to enable
}

// MCP Server 설정
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Tool 정의
export interface ToolDefinition {
  name: string;
  type: 'local' | 'http' | 'mcp';

  // HTTP tool specific
  endpoint?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;

  // MCP tool specific
  mcpServer?: string;  // Reference to mcp_servers key
}

// Local Tool Handler
export interface LocalToolHandler {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<string>;
}
```

#### 3.2 Zod 스키마 정의

**파일**: `packages/sdk/src/schemas/api-provider.schema.ts`

```typescript
import { z } from 'zod';

export const MCPServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()).optional(),
});

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['local', 'http', 'mcp']),
  endpoint: z.string().url().optional(),
  method: z.enum(['GET', 'POST']).optional(),
  headers: z.record(z.string()).optional(),
  mcpServer: z.string().optional(),
});

export const APIProviderConfigSchema = z.object({
  provider: z.enum(['api/openai-compatible', 'api/openai', 'api/anthropic']),
  gateway: z.string().url().optional(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  tools: z.array(z.string()).optional(),
});
```

#### 3.3 SowonFlow 타입 호환성 검증
- SowonFlow의 타입과 비교
- 공통 패턴 추출
- 차이점 문서화

### 산출물
- `packages/sdk/src/types/api-provider.types.ts` - TypeScript 인터페이스
- `packages/sdk/src/schemas/api-provider.schema.ts` - Zod 스키마

### 완료 조건
- [ ] TypeScript 컴파일 성공
- [ ] Zod 스키마 검증 통과
- [ ] SowonFlow 호환성 확인

---

## Phase 4: 설계 검토 및 문서화 (0.5일)

### 작업 내용

#### 4.1 코드 리뷰 (@crewx_claude_dev)
- 아키텍처 설계 검토
- YAML 스펙 검토
- 타입 시스템 검토

#### 4.2 SowonFlow 스펙 검증 (@sowonflow_claude_dev)
- CrewX YAML 스펙이 SowonFlow 패턴과 일치하는지 확인
- 누락된 기능 체크
- 호환성 이슈 확인

#### 4.3 설계 문서 작성
**파일**: `wbs/wbs-19-design-document.md`

**목차**:
1. 개요
2. 아키텍처 설계
   - Provider 계층 구조
   - Tool Calling 흐름
   - MCP 통합
3. YAML 스펙
   - mcp_servers 섹션
   - tools 섹션
   - agents[].inline 확장
4. 타입 시스템
   - TypeScript 인터페이스
   - Zod 스키마
5. 구현 가이드
   - WBS-20: BaseAPIProvider 구현 방향
   - WBS-21: Tool Calling 구현 방향
   - WBS-22: MCP 통합 방향

### 산출물
- `wbs/wbs-19-design-document.md` - 상세 설계 문서 (40+ 페이지)

### 완료 조건
- [ ] @crewx_claude_dev 리뷰 완료
- [ ] @sowonflow_claude_dev 검증 완료
- [ ] 설계 문서 작성 완료

---

## 전체 산출물

1. `wbs/wbs-19-architecture-diagram.md` - 아키텍처 다이어그램
2. `wbs/wbs-19-sowonflow-spec-analysis.md` - SowonFlow 분석
3. `wbs/wbs-19-design-document.md` - 상세 설계 문서
4. `packages/sdk/src/types/api-provider.types.ts` - TypeScript 타입
5. `packages/sdk/src/schemas/api-provider.schema.ts` - Zod 스키마
6. `packages/sdk/schema/api-provider-config.json` - JSON Schema

## 최종 완료 조건

- [ ] 4개 Phase 모두 완료
- [ ] 6개 산출물 모두 생성
- [ ] 아키텍처 다이어그램 승인
- [ ] YAML 스펙 정의 완료
- [ ] 타입 시스템 컴파일 성공
- [ ] 설계 문서 리뷰 완료
- [ ] @sowonflow_claude_dev 검증 통과

## 다음 단계

WBS-19 완료 후 → **WBS-20 BaseAPIProvider 핵심 구현**
