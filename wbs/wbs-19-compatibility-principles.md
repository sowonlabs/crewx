# WBS-19 호환성 및 단순성 원칙

## 설계 원칙

### 1. 단순성 유지 (Simplicity First)

#### ✅ 채택된 단순 패턴:
- **Simple Arrays**: `tools?: string[]`, `mcp?: string[]`
  - ❌ 복잡한 include/exclude 패턴 제거
  - ✅ SowonFlow 패턴 그대로 사용

```yaml
# ✅ 단순하고 명확
agents:
  - id: my_agent
    tools: ["read_file", "slack", "company_api"]
    mcp: ["slack", "github"]

# ❌ 불필요한 복잡성 (제거됨)
agents:
  - id: my_agent
    tools:
      include: ["read_file", "slack"]
      exclude: ["dangerous_tool"]
```

#### ✅ 프레임워크 도구 주입 패턴:
- YAML: 도구 이름만 (string[])
- TypeScript: 실제 도구 구현 (FrameworkToolDefinition)

```typescript
// TypeScript에서 도구 정의 및 주입
const myTool = {
  name: 'company_api',
  description: '회사 API 호출',
  parameters: z.object({ query: z.string() }),
  execute: async (args, context) => {
    // 도구 실행 로직
  }
};

crewx.runAgent('my_agent', {
  input: '작업 수행',
  tools: [myTool]  // 도구 주입
});
```

### 2. 기존 시스템과의 호환성 (Backwards Compatibility)

#### ✅ CLI Provider 호환성 보장:

```yaml
# 기존 CLI Provider (변경 없음)
agents:
  - id: cli_agent
    provider: cli/claude
    model: sonnet
    # tools, mcp 필드 무시 (영향 없음)

# 새로운 API Provider
agents:
  - id: api_agent
    provider: api/anthropic
    url: https://api.anthropic.com
    apiKey: "{{env.ANTHROPIC_API_KEY}}"
    model: claude-3-5-sonnet-20241022
    tools: ["read_file", "slack"]  # 새로운 필드
    mcp: ["slack"]                 # 새로운 필드
```

**호환성 전략**:
1. CLI Provider는 `tools`, `mcp` 필드를 **무시**
2. API Provider는 `tools`, `mcp` 필드를 **활용**
3. 기존 YAML 파일은 **수정 없이 동작**
4. 점진적 마이그레이션 가능

#### ✅ 타입 시스템 호환성:

```typescript
// 공통 필드 (모든 Provider)
interface BaseProviderConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// CLI Provider 전용
interface CLIProviderConfig extends BaseProviderConfig {
  provider: 'cli/claude' | 'cli/gemini' | 'cli/copilot';
  // tools, mcp 무시
}

// API Provider 전용
interface APIProviderConfig extends BaseProviderConfig {
  provider: 'api/openai' | 'api/anthropic' | ...;
  url?: string;
  apiKey?: string;
  tools?: string[];  // 새로운 필드
  mcp?: string[];    // 새로운 필드
}
```

### 3. 마이그레이션 경로 (Migration Path)

#### 단계적 마이그레이션:

```yaml
# Step 1: 기존 CLI Provider (변경 없음)
agents:
  - id: my_agent
    provider: cli/claude
    model: sonnet

# Step 2: API Provider로 전환 (provider만 변경)
agents:
  - id: my_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    # 기본 동작은 CLI와 동일

# Step 3: Tool Calling 추가 (선택적)
agents:
  - id: my_agent
    provider: api/anthropic
    model: claude-3-5-sonnet-20241022
    tools: ["read_file", "slack"]  # 도구 활성화
    mcp: ["slack"]                 # MCP 서버 활성화
```

### 4. 코드 변경 사항 요약

#### ✅ 적용된 수정사항 (2025-11-11):

1. **타입 시스템 단순화**:
   - ❌ 제거: `HttpToolDefinition`, `McpToolDefinition`, `ToolDefinition` (v1)
   - ✅ 추가: `FrameworkToolDefinition` (v2)
   - ✅ 추가: `CrewXInstance` 인터페이스

2. **YAML 스펙 단순화**:
   - `tools?: string[]` (simple array)
   - `mcp?: string[]` (simple array)
   - SowonFlow 패턴 완전 일치

3. **호환성 검증**:
   - ✅ TypeScript 컴파일 성공 (0 errors)
   - ✅ CLI Provider 영향 없음 (필드 무시)
   - ✅ API Provider 새 기능 추가

### 5. 다음 단계 (WBS-20)

#### 구현 우선순위:

1. **P0: BaseAPIProvider 구현**
   - Vercel AI SDK 통합
   - Tool Calling 기본 구조
   - 7가지 Provider 타입 지원

2. **P1: Tool Injection 시스템**
   - CrewXOptions.tools 파라미터
   - FrameworkToolDefinition 처리
   - Context 전달 메커니즘

3. **P2: MCP 통합** (선택적)
   - MCP 서버 관리
   - MCP Tools → Vercel Tools 변환
   - Graceful failure handling

## 최종 검증

### ✅ 단순성 검증:
- Simple arrays for tools/mcp
- Clear separation: YAML (names) vs TypeScript (implementations)
- No unnecessary complexity

### ✅ 호환성 검증:
- CLI Providers unaffected
- Gradual migration path
- Type safety maintained
- Zero breaking changes

### ✅ 구현 준비:
- Clear architecture
- Type system complete
- Migration path defined
- WBS-20 ready to start

## 참고 문서

- [WBS-19 설계 문서](wbs-19-design-document.md)
- [설계 리뷰 회의록](wbs-19-design-review-meeting-minutes.md)
- [SowonFlow 스펙 분석](wbs-19-sowonflow-spec-analysis.md)
