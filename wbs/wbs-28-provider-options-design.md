# WBS-28: CLI/API Provider Options 스펙 설계

> **상태**: 🟡 설계 단계
> **우선순위**: P0
> **소요 기간**: 3-4일
> **디펜던시**: WBS-26 (문서화 완료)

---

## 📋 문제 정의

### 현재 상황

#### CLI Provider (기존)
```yaml
agents:
  - name: claude
    provider: cli/claude
    options:
      query: "chat"              # spawn 파라미터 (문자열)
      execute: "execute"         # spawn 파라미터 (문자열)
```

**동작 방식**:
- `crewx q "@claude ..."` → `spawn('claude', ['chat', ...])`
- `crewx execute "@claude ..."` → `spawn('claude', ['execute', ...])`
- CLI 내부에서 tool 관리 (CrewX는 spawn만 수행)

---

#### API Provider (설계 필요)
```yaml
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      # ❓ 여기를 어떻게 설계?
      # query/execute 모드별로 tool 권한 제어 필요
```

**동작 방식**:
- `crewx q "@claude_api ..."` → Mastra Agent.generate(..., tools: ???)
- `crewx execute "@claude_api ..."` → Mastra Agent.generate(..., tools: ???)
- **CrewX가 tool calling 직접 제어** (file_read, file_write, run_shell 등)

---

### 핵심 문제

1. **query/execute 모드 개념은 유지**
   - query: 질문/분석 (안전한 작업)
   - execute: 액션/수정 (위험 포함 가능)

2. **API Provider는 tool 권한 제어 필요**
   - query 모드: 안전한 도구만 (file_read, grep)
   - execute 모드: 위험한 도구 포함 (file_write, run_shell)

3. **CLI와 비슷한 느낌 유지**
   - options 구조 활용
   - query/execute 용어 유지
   - 마이그레이션 가이드로 매핑 명확화

4. **구조는 달라질 수 있음**
   - CLI: spawn 파라미터 (문자열)
   - API: tool calling 제어 (배열/객체)
   - 근본적으로 다른 방식이므로 구조가 다를 수밖에 없음

---

## 🎯 설계 목표

### 1. query/execute 개념 유지
CLI Provider와 동일하게 2가지 모드 지원

### 2. 모드별 tool 권한 제어
LLM이 실수로 위험한 작업 수행하는 것 방지

### 3. 명시적 권한 부여
기본값은 안전(빈 배열), 사용자가 명시적으로 추가

### 4. 하위 호환성
SowonFlow 스타일 (단순 배열) 계속 지원

### 5. 확장성
향후 커스텀 모드 추가 가능

---

## 🏗️ 설계 방안

### 방안 1: tools 필드에 query/execute 하위 필드 ⭐

```yaml
# API Provider
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:
        query: [file_read, grep, glob]              # query 모드 허용 도구
        execute: [file_read, file_write, run_shell] # execute 모드 허용 도구
```

**TypeScript 타입**:
```typescript
interface APIProviderOptions {
  // 기존 필드
  model: string;
  url?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;

  // Tool 권한 제어 (새로 추가)
  tools?: {
    query?: string[];      // query 모드 허용 도구 (기본값: [])
    execute?: string[];    // execute 모드 허용 도구 (기본값: [])
    [mode: string]?: string[];  // 향후 커스텀 모드
  };
}
```

**내부 동작**:
```typescript
class MastraAPIProvider {
  async query(prompt: string, context: AgentContext): Promise<AIResponse> {
    const allowedTools = this.config.options?.tools?.query || [];
    const mastraTools = this.convertTools(allowedTools);
    return this.agent.generate({ prompt, tools: mastraTools });
  }

  async execute(prompt: string, context: AgentContext): Promise<AIResponse> {
    const allowedTools = this.config.options?.tools?.execute || [];
    const mastraTools = this.convertTools(allowedTools);
    return this.agent.generate({ prompt, tools: mastraTools });
  }
}
```

**장점**:
- ✅ query/execute 개념 명확히 유지
- ✅ 모드별 세밀한 권한 제어
- ✅ CLI와 의미적으로 일관성 (둘 다 query/execute)
- ✅ 기본값 안전 (빈 배열)
- ✅ 확장성 (커스텀 모드 추가 가능)

**단점**:
- ⚠️ CLI의 `options.query/execute`와 구조 다름
  - CLI: `query: "chat"` (문자열)
  - API: `tools: { query: [...] }` (객체)
- ⚠️ 하지만 근본적으로 다른 방식(spawn vs tool calling)이므로 불가피

---

### 방안 2: options.query/execute를 객체로 확장

```yaml
# API Provider
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      query:                # CLI와 동일한 키 이름
        tools: [file_read, grep]
      execute:              # CLI와 동일한 키 이름
        tools: [file_read, file_write, run_shell]
```

**TypeScript 타입**:
```typescript
// CLI Provider
interface CLIProviderOptions {
  query?: string;           // spawn 파라미터
  execute?: string;         // spawn 파라미터
}

// API Provider
interface APIProviderOptions {
  query?: {                 // 객체로 확장
    tools?: string[];
  };
  execute?: {               // 객체로 확장
    tools?: string[];
  };
  // ... 기타 필드
}
```

**장점**:
- ✅ CLI와 키 이름 동일 (options.query, options.execute)
- ✅ 시각적으로 비슷해 보임

**단점**:
- ❌ 타입이 복잡해짐 (Union 타입 필요)
  ```typescript
  type QueryOption = string | { tools?: string[] };
  type ExecuteOption = string | { tools?: string[] };
  ```
- ❌ CLI는 문자열, API는 객체 → 여전히 다름
- ❌ 확장성 떨어짐 (다른 필드 추가 시 중첩 증가)

---

### 방안 3: 단일 tools 배열 + 모드 자동 판단

```yaml
# API Provider
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools: [file_read, file_write, run_shell]  # 전체 도구 목록
```

**내부 로직**:
```typescript
if (mode === 'query') {
  tools = [];  // query는 도구 사용 안 함
} else {
  tools = config.options.tools || [];
}
```

**장점**:
- ✅ 설정 단순

**단점**:
- ❌ query 모드에서 file_read도 못 씀 (분석 불가)
- ❌ 유연성 없음
- ❌ LLM 실수 방지 기능 약함

---

## 📊 방안 비교

| 기준 | 방안 1 (tools.query/execute) | 방안 2 (options.query/execute 확장) | 방안 3 (단일 배열) |
|------|----------------------------|----------------------------------|-----------------|
| **query/execute 유지** | ✅ 명확 | ✅ 키 이름 동일 | ⚠️ 내부에만 존재 |
| **모드별 제어** | ✅ 세밀 | ✅ 세밀 | ❌ 불가능 |
| **CLI 유사성** | ⚠️ 구조 다름 | ✅ 키 이름 같음 | ❌ 전혀 다름 |
| **타입 복잡도** | ✅ 단순 | ❌ Union 필요 | ✅ 단순 |
| **확장성** | ✅ 높음 | ⚠️ 중첩 증가 | ❌ 낮음 |
| **안전성** | ✅ 기본값 빈 배열 | ✅ 기본값 빈 배열 | ⚠️ 모든 도구 허용 |

---

## 🎯 추천 설계: 방안 1 + 레거시 지원

### 최종 YAML 스펙

```yaml
# CLI Provider (기존 유지)
agents:
  - name: claude_cli
    provider: cli/claude
    options:
      query: "chat"              # spawn 파라미터 (문자열)
      execute: "execute"         # spawn 파라미터 (문자열)

# API Provider (새 설계)
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:                     # Tool 권한 제어
        query: [file_read, grep, glob]
        execute: [file_read, file_write, run_shell]

# 레거시 지원 (SowonFlow 호환)
agents:
  - name: simple_agent
    provider: api/anthropic
    model: claude-sonnet-4
    tools: [file_read, file_write]  # 자동 변환: execute만 사용, query는 빈 배열
```

---

### TypeScript 타입 정의

```typescript
// packages/sdk/src/types/api-provider.types.ts

/**
 * API Provider Tool 권한 맵
 */
export type ModeToolMap = {
  query?: string[];      // query 모드 허용 도구
  execute?: string[];    // execute 모드 허용 도구
  [mode: string]?: string[];  // 향후 커스텀 모드
};

/**
 * Tool 설정 입력 (레거시 호환)
 */
export type ToolConfigInput = string[] | ModeToolMap;

/**
 * Tool 설정 정규화 함수
 */
export function normalizeTools(input?: ToolConfigInput): ModeToolMap {
  if (!input) {
    return { query: [], execute: [] };  // 기본값: 안전
  }

  if (Array.isArray(input)) {
    // 레거시 배열 형식 → execute만 사용
    return { query: [], execute: input };
  }

  // 새 형식 그대로 반환 (기본값 보완)
  return {
    query: input.query || [],
    execute: input.execute || [],
    ...input,  // 커스텀 모드 포함
  };
}

/**
 * API Provider 설정
 */
export interface APIProviderOptions {
  // Provider 설정
  model: string;
  url?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;

  // Tool 권한 제어 (새로 추가)
  tools?: ToolConfigInput;

  // MCP 설정
  mcp?: {
    include?: string[];
    exclude?: string[];
  };
}

export interface APIProviderConfig {
  id: string;
  name: string;
  provider: `api/${string}`;
  options?: APIProviderOptions;
}
```

---

### Zod 스키마

```typescript
// packages/sdk/src/schemas/api-provider.schema.ts

import { z } from 'zod';

const modeToolMapSchema = z.object({
  query: z.array(z.string()).optional().default([]),
  execute: z.array(z.string()).optional().default([]),
}).catchall(z.array(z.string())).optional();  // 커스텀 모드 허용

const toolConfigSchema = z.union([
  z.array(z.string()),        // 레거시 배열
  modeToolMapSchema,          // 새 형식
]);

export const apiProviderOptionsSchema = z.object({
  model: z.string(),
  url: z.string().url().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),

  tools: toolConfigSchema.optional(),

  mcp: z.object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
});
```

---

### MastraAPIProvider 구현

```typescript
// packages/sdk/src/core/providers/MastraAPIProvider.ts

import { normalizeTools } from '../../types/api-provider.types';

export class MastraAPIProvider extends BaseAPIProvider {
  private toolPermissions: ModeToolMap;

  constructor(config: APIProviderConfig) {
    super(config);

    // Tool 권한 정규화
    this.toolPermissions = normalizeTools(config.options?.tools);
  }

  /**
   * query 모드 실행
   */
  async query(prompt: string, context: AgentContext): Promise<AIResponse> {
    const allowedToolNames = this.toolPermissions.query || [];
    const mastraTools = this.filterAndConvertTools(allowedToolNames, context);

    return this.mastraAgent.generate({
      prompt,
      tools: mastraTools,
    });
  }

  /**
   * execute 모드 실행
   */
  async execute(prompt: string, context: AgentContext): Promise<AIResponse> {
    const allowedToolNames = this.toolPermissions.execute || [];
    const mastraTools = this.filterAndConvertTools(allowedToolNames, context);

    return this.mastraAgent.generate({
      prompt,
      tools: mastraTools,
    });
  }

  /**
   * 허용된 도구만 필터링하여 Mastra Tool로 변환
   */
  private filterAndConvertTools(
    allowedToolNames: string[],
    context: AgentContext
  ): MastraTool[] {
    // 1. 등록된 모든 도구 가져오기
    const allTools = this.toolRegistry.getAllTools();

    // 2. 허용된 도구만 필터링
    const allowedTools = allTools.filter(tool =>
      allowedToolNames.includes(tool.name)
    );

    // 3. 보안 로깅
    this.logger.info(`[Security] Allowed tools for mode '${context.mode}':`, allowedToolNames);

    // 4. Mastra Tool로 변환
    return allowedTools.map(tool =>
      MastraToolAdapter.convertToMastraTool(tool, {
        ...context,
        mode: context.mode,
      })
    );
  }
}
```

---

## 📋 마이그레이션 가이드

### CLI → API 전환 예시

#### Before (CLI Provider)
```yaml
agents:
  - name: my_agent
    provider: cli/claude
    options:
      query: "chat --tools read_file,grep"
      execute: "execute --tools read_file,write_file,bash"
```

#### After (API Provider)
```yaml
agents:
  - name: my_agent
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:
        query: [file_read, grep]              # CLI의 --tools 파라미터에서 추출
        execute: [file_read, file_write, bash]
```

**매핑 규칙**:
1. `provider: cli/claude` → `provider: api/anthropic`
2. `options.query: "chat --tools X,Y"` → `options.tools.query: [X, Y]`
3. `options.execute: "execute --tools X,Y,Z"` → `options.tools.execute: [X, Y, Z]`

---

### SowonFlow 스타일 (레거시 지원)

#### 단순 배열 (계속 동작)
```yaml
agents:
  - name: simple_agent
    provider: api/anthropic
    model: claude-sonnet-4
    tools: [file_read, file_write]
```

**자동 변환**:
```typescript
// 내부적으로 변환
{
  query: [],                    // query는 도구 사용 안 함
  execute: [file_read, file_write]  // execute만 도구 사용
}
```

**경고 로그**:
```
[WARN] tools: [...] is deprecated. Use options.tools: { query: [], execute: [] } instead.
```

---

## 🎯 의사결정 필요 사항

### 1. 방안 선택
- [ ] **방안 1** (추천): `options.tools.query/execute`
- [ ] **방안 2**: `options.query/execute` 객체 확장
- [ ] **방안 3**: 단일 배열 + 자동 판단

### 2. 레거시 배열 지원
- [ ] **지원** (추천): SowonFlow 호환, 자동 변환
- [ ] **미지원**: 새 형식만 허용

### 3. 기본값 정책
- [ ] **빈 배열** (추천): 안전 우선, 명시적 추가 필요
- [ ] **모든 도구**: 편리하지만 위험

---

## 🔄 다음 단계

### Phase 1: 의사결정 (0.5일)
- [ ] 방안 선택
- [ ] 레거시 지원 여부 결정

### Phase 2: 타입 구현 (0.5일)
- [ ] TypeScript 타입 정의 업데이트
- [ ] Zod 스키마 구현
- [ ] JSON Schema 업데이트

### Phase 3: Provider 구현 (1일)
- [ ] MastraAPIProvider에 tool 필터링 로직 추가
- [ ] normalizeTools 함수 구현
- [ ] 보안 로깅 추가

### Phase 4: 테스트 (0.5일)
- [ ] 단위 테스트 (normalizeTools, 필터링)
- [ ] 통합 테스트 (query/execute 모드별)
- [ ] 레거시 배열 변환 테스트

### Phase 5: 문서화 (0.5일)
- [ ] API Provider 가이드 업데이트
- [ ] 마이그레이션 가이드 작성
- [ ] 예제 추가

---

## 📎 참고 자료

- [WBS-19: API Provider 설계](wbs-19-design-document.md)
- [WBS-20: Mastra 통합](wbs-20-mastra-integration.md)
- [MastraAPIProvider 구현](../packages/sdk/src/core/providers/MastraAPIProvider.ts)
- [Tool 어댑터](../packages/sdk/src/adapters/MastraToolAdapter.ts)
