# WBS-15 Phase 1: 래핑 로직 분석 및 안전망 검증

> **Phase**: 1/5
> **완료일**: 2025-10-19
> **담당**: @crewx_codex_dev
> **상태**: ✅ 완료

---

## 📋 개요

`<user_query>` 보안 래핑 로직의 현재 구현 분석 및 레이아웃 시스템 통합 시 위험도 평가.

---

## 🔍 래핑 로직 전체 흐름

### 1. **Security Key 생성 단계**

**위치**: `packages/cli/src/crewx.tool.ts`

```typescript
// Line 29-31
private generateSecurityKey(): string {
  return crypto.randomBytes(8).toString('hex');
}
```

**호출 위치**:
- Line 650: `queryAgent()` 진입 시 생성
- Line 958: `executeAgent()` 진입 시 생성

**특징**:
- 16자 hexadecimal 문자열 (128-bit entropy)
- 세션별 고유값 (매 호출마다 새로 생성)
- Prompt injection 방어 목적

---

### 2. **TemplateContext 전달 단계**

**위치**: `packages/cli/src/crewx.tool.ts`

**Query Mode (Line 656-677)**:
```typescript
const templateContext: TemplateContext = {
  env: process.env,
  agent: { ... },
  agentMetadata: { ... },
  mode: 'query',
  messages: contextMessages,
  platform: platform,
  tools: this.buildToolsContext(),
  vars: {
    security_key: securityKey,  // ← 여기서 전달
  },
};
```

**Execute Mode (Line 965-986)**:
```typescript
const templateContext: TemplateContext = {
  // ... (동일 구조)
  vars: {
    security_key: securityKey,  // ← 여기서도 전달
  },
};
```

**특징**:
- `vars.security_key`로 레이아웃에 전달됨
- 레이아웃에서 `{{vars.security_key}}` 로 참조 가능

---

### 3. **하드코딩 래핑 단계 (⚠️ 제거 대상)**

**위치**: `packages/cli/src/crewx.tool.ts`

**Query Mode (Line 712-715)**:
```typescript
const wrappedQuery = `
<user_query key="${securityKey}">
${query}
</user_query>`;
```

**문제점**:
1. ❌ 레이아웃 시스템을 우회한 직접 래핑
2. ❌ `systemPrompt` 이후에 append되는 구조 (레이아웃 의도와 불일치)
3. ❌ 래핑 로직 변경 시 여러 파일 수정 필요

**현재 사용 위치**:
- Line 726: `fullPrompt += \n\n${wrappedQuery}`

---

### 4. **Provider 전달 단계**

**위치**: `packages/cli/src/crewx.tool.ts`

**Query Mode (Line 764-774)**:
```typescript
response = await this.aiService.queryAI(fullPrompt, provider, {
  workingDirectory: workingDir,
  timeout: this.timeoutConfig.parallel,
  additionalArgs: agentOptions,
  taskId,
  model: modelToUse,
  agentId,
  securityKey,  // ← AI Provider에게 전달
  messages,
  pipedContext: structuredPayload,
});
```

**특징**:
- `securityKey`가 AIService → Provider로 전달됨
- 하지만 **base-ai.provider.ts는 이 값을 사용하지 않음** (현재)

---

### 5. **Base Provider의 래핑 메서드 (🟡 현재 미사용)**

**위치**: `packages/sdk/src/core/providers/base-ai.provider.ts`

```typescript
// Line 344-352
protected wrapUserQueryWithSecurity(userQuery: string, securityKey: string): string {
  return `
<user_query key="${securityKey}">
${userQuery}
</user_query>`;
}

// Line 358-362
protected extractUserQuery(wrappedQuery: string, securityKey: string): string {
  const regex = new RegExp(`<user_query key="${securityKey}">\\s*([\\s\\S]*?)\\s*</user_query>`, 'm');
  const match = wrappedQuery.match(regex);
  return match && match[1] ? match[1].trim() : wrappedQuery;
}
```

**현재 상태**:
- ✅ 메서드는 존재하지만 **어디서도 호출되지 않음**
- ✅ `crewx.tool.ts`가 직접 하드코딩으로 래핑 수행
- 🟡 **중복 로직**: 동일한 래핑 패턴이 2곳에 존재

---

### 6. **Remote Provider의 파싱 로직**

**위치**: `packages/sdk/src/core/providers/dynamic-provider.factory.ts`

```typescript
// Line 545-551
const match = prompt.match(/<user_query key="[^"]+">\s*([\s\S]*?)\s*<\/user_query>/i);
if (match && match[1]) {
  return match[1].trim();
}
return prompt.trim();
```

**용도**:
- Remote MCP 에이전트로 요청 전송 시 `<user_query>` 태그를 제거하고 순수 쿼리만 추출
- 보안 키 무관 (정규식으로 태그만 파싱)

---

## 🔄 전체 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Security Key 생성                                             │
│    crewx.tool.ts:650 (query) / 958 (execute)                   │
│    → crypto.randomBytes(8).toString('hex')                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. TemplateContext 구성                                          │
│    vars: { security_key: securityKey }                          │
│    → processAgentSystemPrompt(agent, templateContext)           │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Layout 렌더링 (현재)                                          │
│    default.yaml:                                                │
│    <system_prompt key="{{vars.security_key}}">                  │
│      {{{layout.system_prompt}}}                                 │
│    </system_prompt>                                             │
│    → systemPrompt (렌더링된 결과)                                │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ⚠️ 하드코딩 래핑 (제거 대상)                                  │
│    crewx.tool.ts:712-715                                        │
│    wrappedQuery = `<user_query key="${securityKey}">${query}`  │
│    fullPrompt = systemPrompt + wrappedQuery                     │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. AI Provider 호출                                              │
│    aiService.queryAI(fullPrompt, provider, {securityKey, ...})  │
│    → base-ai.provider.ts:query()                                │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Child Process 실행 (claude/gemini/copilot CLI)               │
│    spawn(cliCommand, args, { stdin: fullPrompt })               │
│    → AI 응답                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ 문제점 분석

### 1. **이중 래핑 구조**

**현상**:
- Layout에서 `<system_prompt key="{{vars.security_key}}">` 래핑 (보안 컨테이너)
- 그 이후 CLI에서 `<user_query key="${securityKey}">` 추가 래핑 (사용자 입력 격리)

**의도**:
- `<system_prompt>`: 시스템 프롬프트 전체를 보호
- `<user_query>`: 사용자 쿼리만 별도 격리 (prompt injection 방어)

**문제**:
- ✅ 의도는 명확하지만, **구현이 레이아웃 시스템과 분리**됨
- ❌ `<user_query>` 래핑이 하드코딩되어 레이아웃 DSL로 제어 불가

---

### 2. **base-ai.provider.ts의 미사용 메서드**

**현상**:
- `wrapUserQueryWithSecurity()` / `extractUserQuery()` 메서드 존재
- 하지만 **어디서도 호출되지 않음**

**문제**:
- ❌ 중복 코드 (crewx.tool.ts에 동일 로직)
- ❌ 유지보수 부담 (2곳 동기화 필요)
- ❌ Provider 레벨에서 래핑을 지원하려는 의도였으나 실제로는 CLI에서 처리

---

### 3. **레이아웃 확장성 부재**

**현상**:
- 레이아웃에서 `{{{layout.system_prompt}}}`만 렌더링
- 사용자 쿼리는 레이아웃 바깥에서 append

**문제**:
- ❌ 레이아웃 DSL로 프롬프트 구조 전체를 제어할 수 없음
- ❌ 새로운 보안 패턴 추가 시 CLI 코드 수정 불가피

---

## 🧪 안전 시나리오 테스트

### Scenario 1: Inline 에이전트 (layout 없음)

**설정**:
```yaml
agents:
  - id: "inline_only"
    inline:
      type: "agent"
      provider: "claude"
      prompt: "You are a developer."
      # layout 필드 없음
```

**예상 동작**:
1. `processAgentSystemPrompt()` 호출
2. Layout 로딩 실패 → fallback to `inline.prompt`
3. **하드코딩 래핑 여전히 적용됨** (`crewx.tool.ts:712-715`)
4. ✅ 정상 동작 (하드코딩이 안전망 역할)

**위험도**: 🟢 낮음

---

### Scenario 2: Minimal Layout 에이전트

**설정**:
```yaml
layouts:
  minimal:
    template: |
      {{{agent.inline.prompt}}}

agents:
  - id: "minimal_agent"
    inline:
      layout: "minimal"
      prompt: "You are a minimal agent."
```

**예상 동작**:
1. Layout 렌더링 → `"You are a minimal agent."`
2. **하드코딩 래핑 적용** → `<user_query key="${securityKey}">...</user_query>` append
3. ✅ 정상 동작

**위험도**: 🟢 낮음

---

### Scenario 3: Default Layout 에이전트

**설정**:
```yaml
# 현재 default.yaml 사용
```

**예상 동작**:
1. Layout 렌더링 → `<system_prompt key="${securityKey}">...</system_prompt>`
2. **하드코딩 래핑 추가** → `<user_query>` append
3. ✅ 정상 동작 (이중 보안 컨테이너)

**위험도**: 🟢 낮음

---

### Scenario 4: Layout이 securityKey를 사용하지 않는 경우

**설정**:
```yaml
layouts:
  no_security:
    template: |
      {{{agent.inline.prompt}}}
      # vars.security_key 미사용
```

**예상 동작**:
1. Layout 렌더링 → 보안 태그 없음
2. **하드코딩 래핑은 여전히 적용됨**
3. ⚠️ 보안 컨테이너가 `<user_query>`만 적용 (시스템 프롬프트는 보호 안 됨)

**위험도**: 🟡 중간 (설계 의도와 불일치하지만 최소한의 보안은 유지)

---

### Scenario 5: 하드코딩 제거 후 Layout이 user_query를 렌더링하지 않는 경우

**설정**:
```yaml
layouts:
  broken:
    template: |
      <system_prompt key="{{vars.security_key}}">
      {{{layout.system_prompt}}}
      </system_prompt>
      # user_query 태그 누락
```

**예상 동작** (하드코딩 제거 후):
1. Layout 렌더링 → 사용자 쿼리 누락
2. ❌ **AI에게 빈 프롬프트 전달 또는 쿼리 손실**

**위험도**: 🔴 높음 (크리티컬 경로 - 반드시 폴백 필요)

---

## 🛡️ 위험도 매트릭스

| Scenario | 현재 (하드코딩) | Phase 3 이후 (레이아웃) | 리스크 레벨 | 완화 방안 |
|----------|----------------|------------------------|------------|----------|
| **Inline 에이전트** | ✅ 정상 | ⚠️ Layout 없으면 user_query 누락 | 🟡 중간 | Feature flag fallback |
| **Minimal Layout** | ✅ 정상 | ⚠️ user_query 렌더링 누락 가능 | 🟡 중간 | Default layout에 user_query 포함 |
| **Default Layout** | ✅ 정상 | ✅ Layout에 user_query 추가 | 🟢 낮음 | - |
| **No Security Key** | ⚠️ 부분 보안 | ⚠️ 동일 | 🟡 중간 | Layout validation |
| **Broken Layout** | ✅ 하드코딩이 커버 | 🔴 쿼리 손실 | 🔴 높음 | **필수 폴백 로직** |

---

## 🎯 Phase 3 완화 전략

### 1. **Feature Flag 폴백**

```typescript
// crewx.tool.ts 수정 예시
if (process.env.CREWX_WRAPPING_LEGACY === 'true') {
  // 기존 하드코딩 방식 유지
  const wrappedQuery = `<user_query key="${securityKey}">${query}</user_query>`;
  fullPrompt += `\n\n${wrappedQuery}`;
} else {
  // 레이아웃 기반 래핑 (vars.user_input 전달)
  templateContext.vars.user_input = query;
  fullPrompt = await this.processAgentSystemPrompt(agent, templateContext);
}
```

---

### 2. **Default Layout 강화**

```yaml
# templates/agents/default.yaml (Phase 2 수정 예정)
layouts:
  crewx/default:
    template: |
      <crewx_system_prompt key="{{vars.security_key}}">
        <!-- Agent metadata -->
      </crewx_system_prompt>

      <system_prompt key="{{vars.security_key}}">
        {{{layout.system_prompt}}}

        {{#if messages.[0]}}
        <conversation_history>...</conversation_history>
        {{/if}}
      </system_prompt>

      {{#if vars.user_input}}
      <user_query key="{{vars.security_key}}">
      {{{vars.user_input}}}
      </user_query>
      {{/if}}
```

---

### 3. **Layout Validation (Phase 2)**

```typescript
// Layout renderer에서 필수 필드 검증
if (!rendered.includes('<user_query>') && templateContext.vars.user_input) {
  this.logger.warn('[WBS-15] Layout does not render user_query - falling back to legacy wrapping');
  // Fallback to hardcoded wrapping
}
```

---

## 📊 통계 및 사용 빈도

### 하드코딩 래핑 호출 위치

| 파일 | 라인 | 모드 | 호출 빈도 추정 |
|------|------|------|--------------|
| `crewx.tool.ts` | 712-715 | query | 🔥 매우 높음 (모든 query 호출) |
| `crewx.tool.ts` | (execute 모드 미확인) | execute | 🔥 높음 (모든 execute 호출) |
| `base-ai.provider.ts` | 349-351 | 미사용 | ⚪️ 0회 (dead code) |

---

## ✅ Phase 1 산출물 체크리스트

- ✅ **래핑 로직 다이어그램**: 6단계 흐름 완성
- ✅ **안전 시나리오 5가지**: Inline, Minimal, Default, No Security, Broken Layout
- ✅ **위험도 매트릭스**: 5개 시나리오 × 리스크 레벨 평가
- ✅ **완화 전략**: Feature flag, Default layout 강화, Layout validation
- ✅ **통계 수집**: 하드코딩 호출 위치 및 빈도

---

## 🚀 Phase 2 준비사항

### Phase 2에서 작업할 파일
1. `packages/sdk/src/types/template.types.ts` (TemplateContext 확장)
2. `templates/agents/default.yaml` (user_query 블록 추가)
3. `templates/agents/secure-wrapper.yaml` (신규 레이아웃 예시)

### Phase 2 선행 요구사항
- ✅ TemplateContext에 `vars.user_input?: string` 추가 필요
- ✅ Layout renderer가 `vars.user_input` 처리 가능 확인 (이미 가능)

---

**Phase 1 완료** 🎉

**다음 단계**: Phase 2 - SDK Layout 구조 확장
