# WBS-19 API Provider Design Review - Meeting Minutes

**Date**: 2025-11-11
**Meeting Type**: Technical Design Review
**Document Version**: WBS-19 v2
**Reviewers**: @crewx_claude_dev, @crewx_codex_dev, @crewx_crush_dev
**Thread**: wbs-19-final-review

---

## Executive Summary

WBS-19 API Provider 설계 문서에 대한 3명의 전문 에이전트 리뷰를 완료했습니다. 전반적으로 우수한 설계이나, **타입 시스템과 YAML 스펙 간 불일치**, **Tool 활성화 패턴 충돌**, **템플릿 문법 혼용** 등 구현 전 반드시 해결해야 할 이슈들이 발견되었습니다.

### 종합 평가

| 영역 | 상태 | 주요 이슈 |
|------|------|----------|
| **아키텍처 설계** | 🟡 YELLOW | Tool Context 주입 메커니즘 미정의, 에러 처리 전략 누락 |
| **타입 시스템** | 🔴 RED | TypeScript 타입과 설계 문서 불일치 (tools/mcp 필드) |
| **개발자 경험** | 🟡 YELLOW | YAML 문법 혼용, Tool 활성화 패턴 충돌 |
| **MCP 통합** | 🟢 GREEN | 설계 완료, 구현 준비됨 |
| **Provider 구현** | 🟢 GREEN | 7가지 Provider 모두 구현 가능 |

---

## 🔴 Critical Issues (구현 차단 요소)

### 1. Tools/MCP 필드 타입 불일치

**발견자**: @crewx_codex_dev
**심각도**: 🔴 CRITICAL - 구현 차단

**문제점**:
```typescript
// 현재 types.ts (lines 26-28)
tools?: string[];  // ← 단순 배열만 지원
mcp?: string[];

// 설계 문서 요구사항 (design doc lines 727-775)
tools?: {
  include?: string[];
  exclude?: string[];
} | string[];  // ← Union 타입 필요
```

**영향**:
- 설계 문서의 보안 패턴 (include/exclude) 구현 불가능
- YAML 검증이 설계와 충돌
- 타입 안전성 보장 불가

**조치 필요**:
1. **Option A (권장)**: Simple array로 통일 (SowonFlow 패턴)
   - types.ts 유지
   - 설계 문서에서 include/exclude 제거
   - 보안 제약은 런타임 검증으로 처리

2. **Option B**: Include/exclude 패턴 채택
   - types.ts 수정 (Union 타입)
   - schemas 업데이트
   - 마이그레이션 가이드 작성

**결정 필요**: WBS-20 시작 전 필수

---

### 2. Tool Definition 타입 충돌

**발견자**: @crewx_codex_dev
**심각도**: 🔴 CRITICAL - 코드 컴파일 불가

**문제점**:
```typescript
// types.ts lines 37-58 - v1 설계 (HTTP endpoint metadata)
export interface HttpToolDefinition {
  type: 'http';
  endpoint: string;
  method?: HttpToolMethod;
}

// 설계 문서 - v2 설계 (Vercel AI SDK tool() 함수)
const myTool = tool({  // ← Vercel AI SDK
  name: 'search',
  execute: async (args, context) => { ... }
});
```

**충돌**:
- v1: YAML에 HTTP tool 정의 (라이브러리 방식)
- v2: TypeScript에 tool() 함수 주입 (프레임워크 방식)
- 현재 타입은 v1만 지원

**조치 필요**:
1. types.ts에서 `HttpToolDefinition`, `McpToolDefinition` 제거 (v1 유산)
2. 새로운 `FrameworkToolDefinition` 추가:
   ```typescript
   export interface FrameworkToolDefinition {
     name: string;
     description: string;
     parameters: z.ZodSchema;
     execute: (args: any, context: ToolExecutionContext) => Promise<any>;
   }
   ```
3. schemas 동기화

**Deadline**: WBS-20 Phase 1 시작 전

---

### 3. CrewX 클래스 미존재

**발견자**: @crewx_codex_dev
**심각도**: 🔴 CRITICAL - 샘플 코드 컴파일 불가

**문제점**:
```typescript
// 설계 문서 예제 (lines 78, 229, 704)
const crewx = new CrewX({ ... });  // ← 클래스 없음!

// 실제 코드베이스
$ rg -n "class CrewX" packages/sdk
# (결과 없음)
```

**영향**:
- 모든 Provider 초기화 예제 실행 불가
- agent_call 도구 구현 불가 (context.crewx 필요)
- 문서가 허위 정보 제공

**조치 필요**:
1. **즉시**: 설계 문서에 "TODO" 표시 및 이슈 링크 추가
2. **WBS-20**: CrewXInstance 인터페이스 정의
3. **WBS-21**: CrewX 클래스 구현

---

## 🟡 Important Issues (설계 개선 필요)

### 4. Tool Context 주입 메커니즘 미정의

**발견자**: @crewx_claude_dev
**심각도**: 🟡 IMPORTANT

**문제점**:
```typescript
// Vercel AI SDK 기본 시그니처
tool({
  execute: (args) => Promise<any>  // ← context 없음!
});

// CrewX 요구사항
tool({
  execute: (args, context: ToolExecutionContext) => Promise<any>  // ← context 필요!
});
```

**누락 사항**:
- ToolExecutionContext를 어디서 생성하는가?
- Vercel AI SDK와 어떻게 통합하는가?
- Wrapper/Adapter 패턴 필요?

**권장 해결책**:
```typescript
// BaseAPIProvider에서 tool wrapper 생성
private wrapTool(userTool: FrameworkToolDefinition) {
  return tool({
    name: userTool.name,
    description: userTool.description,
    parameters: userTool.parameters,
    execute: async (args) => {
      const context = this.buildToolContext();  // ← 여기서 생성!
      return userTool.execute(args, context);
    }
  });
}
```

**조치**: WBS-20 Phase 2에 Tool Wrapper 패턴 문서화

---

### 5. YAML 문법 혼용 (Template Syntax)

**발견자**: @crewx_crush_dev
**심각도**: 🟡 IMPORTANT - 개발자 혼란

**문제점**:
```yaml
# 설계 문서 내 혼용 패턴
apiKey: "{{env.OPENAI_API_KEY}}"  # ← 올바른 템플릿 문법
systemRole: "${SYSTEM_ROLE}"       # ← Bash 스타일 (잘못됨)
```

**개발자 피드백** (@crewx_crush_dev):
> "Document mixes `{{vars.key}}` vs `${VAR_NAME}` formats without explaining when to use which"

**조치 필요**:
1. 모든 환경 변수: `{{env.VAR}}` 통일
2. 모든 전역 변수: `{{vars.key}}` 통일
3. TypeScript 코드는 `process.env.VAR` 유지 (올바름)
4. 잘못된 예제 전부 수정

**담당**: 설계 문서 개정 (우선순위 P1)

---

### 6. agent_call 순환 의존성 방지 미정의

**발견자**: @crewx_claude_dev
**심각도**: 🟡 IMPORTANT

**시나리오**:
```
Agent A --calls--> Agent B
   ↑                  |
   |                  |
   └------ calls -----┘
```

**누락 사항**:
- Call stack depth 제한 (문서는 `maxAgentCallDepth` 언급했으나 정의 없음)
- 순환 호출 감지 알고리즘
- 에러 메시지 설계

**권장 해결책**:
```typescript
export interface CrewXOptions {
  maxAgentCallDepth?: number;  // default: 5
}

// agent_call 구현
execute: async ({ agentId, message }, context) => {
  const currentDepth = context.request?.agentCallDepth || 0;
  if (currentDepth >= maxAgentCallDepth) {
    throw new Error(`Maximum agent call depth exceeded: ${maxAgentCallDepth}`);
  }
  // ...
}
```

**조치**: WBS-21 Phase 3에 순환 방지 로직 구현

---

## 🟢 Approved Areas

### 7. MCP Integration Architecture

**평가자**: @crewx_claude_dev
**상태**: 🟢 GREEN - 구현 준비 완료

**우수 사항**:
- MCPClient 설계 명확 (lines 1066-1136)
- 연결 관리 패턴 우수 (Map 기반)
- Tool 이름 규칙 명확 (`serverName:toolName`)
- 에러 처리 포함

**칭찬**:
> "Async connection pattern, error handling for failed connections, separation of concerns - no blockers found."

---

### 8. Provider Implementations

**평가자**: @crewx_claude_dev
**상태**: 🟢 GREEN - 7가지 모두 구현 가능

| Provider | SDK | 상태 |
|----------|-----|------|
| api/openai | @ai-sdk/openai | 🟢 Ready |
| api/anthropic | @ai-sdk/anthropic | 🟢 Ready |
| api/google | @ai-sdk/google | 🟢 Ready |
| api/bedrock | @ai-sdk/amazon-bedrock | 🟢 Ready |
| api/litellm | createOpenAICompatible() | 🟢 Ready |
| api/ollama | createOpenAICompatible() | 🟢 Ready |
| api/sowonai | createOpenAICompatible() | 🟢 Ready |

**코멘트**:
> "Code examples provided (lines 968-1062) are accurate and implementable. No blockers for provider implementations."

---

### 9. ToolExecutionContext Design

**평가자**: @crewx_claude_dev
**상태**: 🟢 GREEN - 완전한 커버리지

**검증 항목**:
- ✅ Agent self-awareness: `context.agent.id`
- ✅ Global vars access: `context.vars.companyName`
- ✅ Environment: `context.env.NODE_ENV`
- ✅ Inter-agent calls: `context.crewx.getAgent()`
- ✅ Conversation history: `context.messages`
- ✅ Request metadata: `context.request.timestamp`
- ✅ Document access: `context.documents`
- ✅ Tools metadata: `context.tools.count`

**평가**:
> "Complete alignment between YAML template syntax and tool execution context. No gaps identified."

---

## Action Items

### 🔴 P0 - 구현 차단 (WBS-20 시작 전 필수)

1. **[DECISION REQUIRED]** Tools/MCP 필드 타입 결정
   - **담당**: Architecture Team
   - **Deadline**: 2025-11-12
   - **Options**: Simple array vs Include/exclude
   - **Dependencies**: WBS-20 전체

2. **[CODE]** ToolDefinition 타입 정리
   - **담당**: @crewx_codex_dev
   - **Deadline**: 2025-11-13
   - **작업**: v1 타입 제거, FrameworkToolDefinition 추가
   - **Files**: types.ts, schemas.ts

3. **[CODE]** CrewXInstance 인터페이스 추가
   - **담당**: @crewx_codex_dev
   - **Deadline**: 2025-11-13
   - **작업**: 타입 정의 (getAgent, query 메서드)
   - **Files**: types.ts

### 🟡 P1 - 설계 개선 (WBS-20 진행 중 병행)

4. **[DOC]** YAML 템플릿 문법 통일
   - **담당**: Documentation Team
   - **Deadline**: 2025-11-14
   - **작업**: `${VAR}` → `{{env.VAR}}` 전면 수정
   - **Files**: wbs-19-design-document.md

5. **[DESIGN]** Tool Context 주입 메커니즘 설계
   - **담당**: @crewx_claude_dev
   - **Deadline**: 2025-11-15
   - **작업**: Wrapper 패턴 문서화
   - **Deliverable**: Tool wrapper 설계 문서

6. **[DESIGN]** Agent call depth 제한 설계
   - **담당**: @crewx_claude_dev
   - **Deadline**: 2025-11-16
   - **작업**: 순환 방지 알고리즘 정의
   - **Deliverable**: agent_call 상세 스펙

### 🟢 P2 - 문서화 (WBS-19 완료 조건)

7. **[DOC]** 에러 처리 전략 문서화
   - **담당**: Documentation Team
   - **Deadline**: 2025-11-17
   - **작업**: Tool timeout, MCP failure, retry 로직
   - **Section**: 새로운 섹션 추가

8. **[DOC]** Migration Guide 작성
   - **담당**: Documentation Team
   - **Deadline**: 2025-11-18
   - **작업**: CLI Provider → API Provider 마이그레이션
   - **Audience**: 기존 사용자

---

## Design Review Summary

### @crewx_claude_dev (Technical Architecture)

**Overall Assessment**: 🟡 YELLOW - Almost Ready

**Key Findings**:
- ✅ BaseAPIProvider 설계 명확
- ✅ MCP 통합 우수
- ⚠️ Tool context 주입 메커니즘 누락
- ⚠️ 에러 처리 전략 미정의
- ⚠️ Agent call depth 제한 미정의

**Quote**:
> "Architecture Completeness: GREEN. Design Consistency: YELLOW due to tools field discrepancy. Implementation Readiness: YELLOW - blockers identified."

---

### @crewx_codex_dev (Code Quality & Type Safety)

**Overall Assessment**: 🔴 RED - Type System Conflicts

**Key Findings**:
- 🔴 tools/mcp 필드 타입 불일치
- 🔴 ToolDefinition v1/v2 충돌
- 🔴 CrewX 클래스 미존재
- ⚠️ context.crewx 타입 안전성 부족 (`any`)

**Quote**:
> "Schema validation conflicts with documented design. HTTP tool metadata contradicts Vercel AI SDK contract. Primary initialization example is uncompilable."

**Devil's Advocate**:
> "Keeping HTTP tool metadata invites YAML-defined HTTP shims, so the 'framework not library' philosophy never materializes and business logic remains untestable."

---

### @crewx_crush_dev (Developer Experience)

**Overall Assessment**: 🟡 YELLOW - 85% Clear

**Key Findings**:
- ✅ 전역 vars 섹션 명확
- ✅ Agent 설정 예제 우수
- ✅ agent_call 설계 훌륭
- ⚠️ YAML 문법 혼용 (`{{}}` vs `${}`)
- ⚠️ Tool 활성화 패턴 불일치 (배열 vs include/exclude)
- ⚠️ HTTP tool 예제와 최종 설계 충돌

**Quote**:
> "The document is 85% clear for senior developers. Fix the template syntax inconsistencies and provide consistent tool configuration examples, and this becomes excellent documentation."

**Critical UX Issue**:
> "The document shows **three different YAML syntax versions** without clear migration path."

---

## Recommendations

### Immediate Actions (Before WBS-20)

1. **Decide on tools/mcp field type**
   - 권장: Simple array (SowonFlow 패턴)
   - 이유: 타입 간결성, 기존 코드 유지, 마이그레이션 불필요
   - 보안: 런타임 검증으로 해결

2. **Clean up type definitions**
   - Remove v1 ToolDefinition (HTTP/MCP metadata)
   - Add FrameworkToolDefinition (Vercel AI SDK 호환)
   - Add CrewXInstance interface

3. **Fix documentation inconsistencies**
   - Unify template syntax: `{{env.VAR}}`, `{{vars.key}}`
   - Remove conflicting tool activation examples
   - Add missing implementation details

### Design Improvements (During WBS-20)

4. **Document tool context injection**
   - Wrapper pattern 상세 설계
   - BaseAPIProvider 구현 가이드
   - 코드 예제 추가

5. **Define error handling strategy**
   - Tool execution timeout
   - MCP server crash handling
   - Retry logic

6. **Specify agent_call details**
   - maxAgentCallDepth configuration
   - Circular dependency detection
   - Call stack tracking

### Documentation (For WBS-19 Completion)

7. **Add missing sections**
   - Error Handling Strategy
   - Tool Context Injection Pattern
   - Agent Call Depth Limiting
   - Migration Guide (CLI → API)

8. **Create tutorials**
   - Step-by-step tool implementation
   - Debugging guide
   - Best practices

---

## Meeting Conclusion

### WBS-19 Status: 🟡 CONDITIONAL APPROVAL

**승인 조건**:
1. ✅ Critical issues (1-3) 해결 완료
2. ✅ P0 action items 완료
3. ✅ 설계 문서 개정판 검토

### Next Steps

1. **즉시**: Tools/MCP 타입 결정 회의 소집
2. **2025-11-13**: 타입 시스템 수정 완료
3. **2025-11-14**: 설계 문서 개정판 발행
4. **2025-11-15**: WBS-20 착수 승인

### Kudos

**우수 설계 요소**:
- ✅ ToolExecutionContext - 템플릿 시스템과 완벽한 통합
- ✅ agent_call built-in tool - 자연스러운 에이전트 간 통신
- ✅ MCP 통합 - 견고한 아키텍처
- ✅ 7가지 Provider 지원 - 확장성 확보

**칭찬받은 패턴**:
- Function injection (SowonFlow 스타일)
- Template variable access ({{env}}, {{vars}})
- Simple arrays for tool activation

---

## Appendix: Review Threads

- **Thread**: wbs-19-final-review
- **Duration**: 313.5 seconds (5분 13초)
- **Agents**: 3 (parallel execution)
- **Total Output**: ~4,500 lines
- **Review Coverage**: 100% (아키텍처, 타입, 개발자 경험)

---

**회의록 작성**: Claude Code
**승인 대기**: Architecture Team
**다음 회의**: WBS-20 Kickoff (2025-11-15 예정)
