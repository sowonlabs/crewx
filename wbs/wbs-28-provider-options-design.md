# WBS-28: CLI/API Provider Options 스펙 설계

> **상태**: ✅ 구현 완료 (2025-01-13)
> **결정**: 방안 2 (`options.query/execute` 객체 확장)

---

## 🔧 중요 구현 노트: OpenRouter Tool Calling 해결

### 문제 상황
- OpenRouter를 `createOpenAI()`로 사용 시 tool calling 동작 안함
- `tool_choice: "required"` 전달되어도 모델이 무시
- `toolCalls: []`, `text: ""` 응답만 반환

### 해결책: OpenRouter 전용 SDK 사용
```typescript
// ❌ 문제: createOpenAI 사용
import { createOpenAI } from '@ai-sdk/openai';
const openai = createOpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1'
});

// ✅ 해결: OpenRouter 전용 SDK 사용
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
const openrouter = createOpenRouter({ apiKey });
const model = openrouter('openai/gpt-4o-mini');
```

### 구현 위치
- **파일**: `packages/sdk/src/core/providers/MastraAPIProvider.ts`
- **로직**: URL에 `openrouter.ai` 포함 시 자동으로 OpenRouter SDK 사용
- **패키지**: `@openrouter/ai-sdk-provider` 추가

### 검증 완료
- ✅ `openai/gpt-4o-mini`: Tool calling 완벽 동작
- ✅ `openai/gpt-oss-20b`: Tool calling 동작 (reasoning 모델)
- ✅ WBS-21 built-in tools (read_file, write_file, grep, ls, replace, run_shell_command)
- ✅ `toolChoice: 'required'` 강제 호출 지원

---

## 📋 최종 설계: 방안 2

### YAML 스펙

```yaml
# CLI Provider (기존 유지)
agents:
  - name: claude_cli
    provider: cli/claude
    options:
      query: "chat"              # 문자열 (spawn 파라미터)
      execute: "execute"         # 문자열

# API Provider (신규)
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      query:                     # 객체로 확장
        tools: [file_read, grep, glob]
        mcp: [filesystem]
      execute:                   # 객체로 확장
        tools: [file_read, file_write, run_shell]
        mcp: [filesystem, git, database]

# 레거시 지원 (SowonFlow 호환)
agents:
  - name: simple_agent
    provider: api/anthropic
    tools: [file_read, file_write]       # 루트 레벨
    mcp_servers: [filesystem]            # 루트 레벨
    # → 자동 변환: options.execute로 이동
```

---

## ✅ 선택 이유

### 장점
- ✅ **CLI와 키 이름 완전 동일** (`query`, `execute`)
- ✅ **모드별 설정 그룹화** (tools, mcp가 한 곳에)
- ✅ **확장 용이** (query/execute 안에 추가 설정 가능)
- ✅ **마이그레이션 직관적** (CLI → API 매핑 명확)

### 단점 및 대응
- ⚠️ **타입 복잡도**: Union 타입 필요
  - → TypeScript discriminated union으로 해결
- ⚠️ **런타임 타입 체크**: 문자열 vs 객체 구분 필요
  - → Zod 스키마로 검증

---

## 🔧 TypeScript 타입

```typescript
// packages/sdk/src/types/api-provider.types.ts

// CLI Provider
interface CLIProviderOptions {
  query?: string;       // spawn 파라미터
  execute?: string;     // spawn 파라미터
}

// API Provider
interface APIProviderModeConfig {
  tools?: string[];     // 허용 도구
  mcp?: string[];       // 허용 MCP 서버
}

interface APIProviderOptions {
  query?: APIProviderModeConfig;
  execute?: APIProviderModeConfig;

  // 기타 설정
  model: string;
  url?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

// Discriminated Union
type ProviderConfig =
  | { provider: `cli/${string}`; options?: CLIProviderOptions }
  | { provider: `api/${string}`; options?: APIProviderOptions };
```

---

## 📋 레거시 호환

### 자동 변환 규칙

**입력 (레거시)**:
```yaml
agents:
  - name: simple_agent
    provider: api/anthropic
    tools: [file_read, file_write]
    mcp_servers: [filesystem]
```

**변환 후**:
```yaml
agents:
  - name: simple_agent
    provider: api/anthropic
    options:
      execute:
        tools: [file_read, file_write]
        mcp: [filesystem]
```

### 변환 로직

```typescript
function normalizeAPIProviderConfig(config: any): APIProviderConfig {
  // 레거시 감지
  if (config.tools || config.mcp_servers) {
    config.options = config.options || {};
    config.options.execute = {
      tools: config.tools || [],
      mcp: config.mcp_servers || [],
    };
    delete config.tools;
    delete config.mcp_servers;
  }

  return config;
}
```

---

## 🔄 마이그레이션 가이드

### Before (CLI Provider)
```yaml
agents:
  - name: my_agent
    provider: cli/claude
    options:
      query: "chat --tools read_file,grep"
      execute: "execute --tools read_file,write_file"
```

### After (API Provider)
```yaml
agents:
  - name: my_agent
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      query:
        tools: [file_read, grep]
      execute:
        tools: [file_read, file_write]
```

**매핑 규칙**:
1. `provider: cli/claude` → `provider: api/anthropic`
2. `options.query: "..."` → `options.query: { tools: [...] }`
3. `options.execute: "..."` → `options.execute: { tools: [...] }`

---

## 📊 추가 결정 사항

### 2. 레거시 배열 지원
- ✅ **지원** - `tools: []` 자동 변환

### 3. 기본값 정책
- ✅ **빈 배열** - 명시적 추가 필요 (안전 우선)

---

## 🔄 다음 단계

### Phase 2: 타입 구현 (0.5일)
- [ ] TypeScript 타입 정의 (Discriminated Union)
- [ ] Zod 스키마 구현
- [ ] JSON Schema 업데이트

### Phase 3: Provider 구현 (1일)
- [ ] MastraAPIProvider 수정
- [ ] normalizeAPIProviderConfig 함수
- [ ] 모드별 필터링 로직

### Phase 4: 테스트 (0.5일)
- [ ] 단위 테스트 (15+ tests)
- [ ] 레거시 변환 테스트
- [ ] 통합 테스트

### Phase 5: 문서화 (0.5일)
- [ ] API Provider 가이드 업데이트
- [ ] 마이그레이션 가이드
- [ ] 예제 추가

---

## 📎 참고

- [WBS-19: API Provider 설계](wbs-19-design-document.md)
- [WBS-20: Mastra 통합](wbs-20-mastra-integration.md)
