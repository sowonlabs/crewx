# WBS-15: 하드코딩 프롬프트 레이아웃 시스템 통합

> **상태**: 🟡 진행중 (Phase 1 완료)
> **방식**: 순차적 (각 Phase 의존성 있음)
> **담당**: @crewx_claude_dev, @crewx_codex_dev, @crewx_glm_dev

---

## 📋 개요

### 목표
CLI의 `<user_query>` 보안 래핑 로직을 레이아웃 시스템으로 통합하여 **모든 프롬프트 구조를 레이아웃 DSL로 제어 가능하게** 만들고, **중복된 하드코딩 제거**를 통해 확장성과 유지보수성 향상.

### 배경
- **WBS-14**에서 `Specialties`, `Capabilities`, `Working Directory` 하드코딩을 제거했으나, **`<user_query>` 래핑 로직은 여전히 하드코딩**됨
- crewx.tool.ts와 base-ai.provider.ts에 중복된 래핑 로직 존재
- 레이아웃 시스템의 설계 의도는 **모든 프롬프트 구조를 DSL로 제어**하는 것이었으나, 보안 래핑만 예외로 남아있음

---

## 🔍 발견된 하드코딩 패턴

### 1. **crewx.tool.ts의 직접 래핑** (🔴 제거 대상)
**위치**: `packages/cli/src/crewx.tool.ts:712-715` (query 모드)

```typescript
const wrappedQuery = `
<user_query key="${securityKey}">
${query}
</user_query>`;
```

**문제점**:
- ❌ 레이아웃 시스템을 우회한 직접 append
- ❌ `systemPrompt` 렌더링 후 별도로 추가되는 구조
- ❌ 래핑 패턴 변경 시 여러 파일 수정 필요

---

### 2. **base-ai.provider.ts의 미사용 메서드** (🟡 정리 대상)
**위치**: `packages/sdk/src/core/providers/base-ai.provider.ts:344-352`

```typescript
protected wrapUserQueryWithSecurity(userQuery: string, securityKey: string): string {
  return `
<user_query key="${securityKey}">
${userQuery}
</user_query>`;
}
```

**문제점**:
- ❌ 정의는 있지만 **어디서도 호출되지 않는 dead code**
- ❌ crewx.tool.ts와 중복된 로직
- 🟡 **Deprecated 표시 후 Phase 3에서 제거 고려**

---

### 3. **dynamic-provider.factory.ts의 파싱 로직** (✅ 유지)
**위치**: `packages/sdk/src/core/providers/dynamic-provider.factory.ts:545`

```typescript
const match = prompt.match(/<user_query key="[^"]+">\s*([\s\S]*?)\s*<\/user_query>/i);
```

**용도**:
- Remote MCP 에이전트로 요청 전송 시 `<user_query>` 태그 제거
- 보안 키 무관 (정규식으로 태그만 파싱)
- ✅ **Phase 3 이후에도 유지** (파싱 로직은 필요)

---

## 📊 5 Phase 구조 (약 8-12일)

### **Phase 1: 래핑 로직 분석 및 안전망 검증** (2일) — ✅ 완료 (2025-10-19)
**목표**: `<user_query>` 래핑의 현재 흐름 파악 및 레이아웃 통합 위험도 평가

**작업**:
1. **래핑 흐름 다이어그램 작성** ✅
   - crewx.tool.ts → base-ai.provider.ts 전체 흐름 (6단계)
   - securityKey 생성 → 래핑 → 파싱 라이프사이클

2. **안전 시나리오 테스트** ✅
   - 시나리오 1: Inline 에이전트 (layout 없음)
   - 시나리오 2: Minimal layout 에이전트
   - 시나리오 3: Default layout 에이전트
   - 시나리오 4: Layout이 securityKey를 사용하지 않는 경우
   - 시나리오 5: 하드코딩 제거 후 Layout이 user_query를 렌더링하지 않는 경우

3. **위험도 매트릭스** ✅
   | Scenario | 리스크 레벨 | 완화 방안 |
   |----------|------------|----------|
   | Inline 에이전트 | 🟡 중간 | Feature flag fallback |
   | Minimal Layout | 🟡 중간 | Default layout에 user_query 포함 |
   | Default Layout | 🟢 낮음 | - |
   | No Security Key | 🟡 중간 | Layout validation |
   | Broken Layout | 🔴 높음 | **필수 폴백 로직** |

4. **산출물**:
   - ✅ 래핑 로직 다이어그램
   - ✅ 안전 검증 보고서 (`wbs/wbs-15-phase-1-wrapping-analysis.md`)
   - ✅ 위험도 매트릭스 및 완화 전략

---

### **Phase 2: SDK 레이아웃 구조 확장** (2-3일) — ✅ 완료 (2025-10-20)
**목표**: 레이아웃에서 보안 래핑 구조를 정의할 수 있도록 SDK 확장

**작업**:
1. **TemplateContext 필드 추가**
   ```typescript
   // packages/sdk/src/types/template.types.ts
   interface TemplateContext {
     // ...existing fields...
     vars: {
       security_key?: string;      // 기존
       user_input?: string;         // 신규 - 래핑할 사용자 쿼리
     }
   }
   ```

2. **새 레이아웃 예시 작성**
   ```yaml
   # templates/agents/secure-wrapper.yaml (예시)
   layouts:
     crewx/secure-wrapper:
       template: |
         <system_prompt key="{{vars.security_key}}">
           {{{layout.system_prompt}}}

           {{#if vars.user_input}}
           <user_query key="{{vars.security_key}}">
           {{{vars.user_input}}}
           </user_query>
           {{/if}}
         </system_prompt>
   ```

3. **Default layout 강화**
   ```yaml
   # templates/agents/default.yaml 수정
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

4. **Layout Validation 추가**
   ```typescript
   // packages/sdk/src/services/layout-renderer.service.ts
   if (!rendered.includes('<user_query>') && context.vars?.user_input) {
     this.logger.warn('[WBS-15] Layout does not render user_query - potential query loss');
   }
   ```

5. **산출물**:
   - TemplateContext 타입 확장
   - `templates/agents/secure-wrapper.yaml` (신규)
   - `templates/agents/default.yaml` (수정)
   - Layout validation 로직

**성과 요약**:
- ✅ TemplateContext에 타입 안정성이 보장된 `vars` 추가 (`security_key`, `user_input`, `user_input_raw`)
- ✅ LayoutRenderer가 `vars.user_input`을 HTML 이스케이프 처리하고 진단용 원본(`user_input_raw`)을 보존
- ✅ `packages/cli/templates/agents/default.yaml`과 `minimal.yaml`에 `<user_query>` 블록 추가
- ✅ 신규 예시 레이아웃 `secure-wrapper.yaml` 작성 (propsSchema 포함)
- ✅ Unit test 2건 추가: 사용자 입력 이스케이프/RAW 확인 및 보안 컨테이너 유지 검증
- ✅ `npm run test --workspace @sowonai/crewx-sdk`, `npm run build` 실행 (type-check 스크립트 부재는 SDK build로 대체)

---

### **Phase 3: CLI 하드코딩 제거 및 레이아웃 위임** (2-3일) — ⬜️ 대기
**목표**: crewx.tool.ts의 `<user_query>` 하드코딩 제거 및 레이아웃 기반 래핑으로 전환

**작업**:
1. **crewx.tool.ts 수정**
   ```typescript
   // Query Mode (Line 712-726 수정)
   if (process.env.CREWX_WRAPPING_LEGACY === 'true') {
     // 기존 하드코딩 방식 유지
     const wrappedQuery = `
   <user_query key="${securityKey}">
   ${query}
   </user_query>`;
     fullPrompt += `\n\n${wrappedQuery}`;
   } else {
     // 레이아웃 기반 래핑 (Phase 2에서 추가한 vars.user_input 사용)
     templateContext.vars.user_input = query;
     fullPrompt = await this.processAgentSystemPrompt(agent, templateContext);
   }
   ```

2. **Execute Mode도 동일하게 수정** (Line 1020-1029)

3. **base-ai.provider.ts Deprecated 표시**
   ```typescript
   /**
    * @deprecated Use layout-based wrapping instead (WBS-15)
    * This method is kept for backward compatibility only.
    * Will be removed in future versions.
    */
   protected wrapUserQueryWithSecurity(userQuery: string, securityKey: string): string {
     // ...existing code...
   }
   ```

4. **Feature Flag 문서화**
   | Flag | Behavior |
   |------|----------|
   | `CREWX_WRAPPING_LEGACY=true` | 기존 하드코딩 방식 (backward compatibility) |
   | `CREWX_WRAPPING_LEGACY` unset | 레이아웃 기반 래핑 (default, recommended) |
   | `CREWX_WBS15_TELEMETRY=true` | Debug logging for wrapping delegation |

5. **산출물**:
   - 수정된 `packages/cli/src/crewx.tool.ts`
   - Deprecated 표시된 `packages/sdk/src/core/providers/base-ai.provider.ts`
   - Feature flag 문서

**성공 기준**:
- ✅ crewx.tool.ts Line 712-715 제거 (query 모드)
- ✅ crewx.tool.ts execute 모드도 동일하게 수정
- ✅ Feature flag `CREWX_WRAPPING_LEGACY` 구현
- ✅ CLI 빌드 성공

---

### **Phase 4: 회귀 테스트 및 통합 검증** (1-2일) — ⬜️ 대기
**목표**: 모든 에이전트 타입에서 래핑이 정상 동작하는지 검증

**작업**:
1. **테스트 케이스 작성**
   ```typescript
   // packages/cli/tests/unit/services/crewx-tool-wrapping.spec.ts (신규)

   describe('WBS-15: User Query Wrapping Integration', () => {
     it('should wrap user query via layout (default behavior)', async () => {
       process.env.CREWX_WRAPPING_LEGACY = undefined;
       const result = await tool.queryAgent({ agentId: 'test', query: 'Hello' });
       expect(result.success).toBe(true);
       // Layout should render <user_query> tag
     });

     it('should fallback to hardcoded wrapping (legacy mode)', async () => {
       process.env.CREWX_WRAPPING_LEGACY = 'true';
       const result = await tool.queryAgent({ agentId: 'test', query: 'Hello' });
       expect(result.success).toBe(true);
       // Hardcoded wrapping should still work
     });

     it('should handle inline agent without layout', async () => {
       // Inline agent test
     });

     it('should handle minimal layout agent', async () => {
       // Minimal layout test
     });

     it('should handle secure-wrapper layout agent', async () => {
       // Secure-wrapper test
     });

     it('should handle remote MCP agent', async () => {
       // Remote agent test (parseUserQueryForRemote)
     });
   });
   ```

2. **회귀 테스트 실행**
   - `npm run build`
   - `npm test:cli`
   - `npm test:sdk`
   - `crewx.layout.yaml` 기반 E2E 테스트

3. **E2E 테스트 (crewx.layout.yaml 활용)**
   ```yaml
   # crewx.layout.yaml 테스트 에이전트 추가
   agents:
     - id: "wbs15_inline_test"
       inline:
         provider: "claude"
         prompt: "You are a test agent."
         # layout 없음 - fallback 테스트

     - id: "wbs15_minimal_test"
       inline:
         provider: "claude"
         layout: "minimal"
         prompt: "Minimal layout test."

     - id: "wbs15_secure_wrapper_test"
       inline:
         provider: "claude"
         layout: "crewx/secure-wrapper"
         prompt: "Secure wrapper test."
   ```

4. **산출물**:
   - `packages/cli/tests/unit/services/crewx-tool-wrapping.spec.ts` (신규)
   - 테스트 리포트 (`wbs/wbs-15-phase-4-test-report.md`)
   - E2E 테스트 결과

**성공 기준**:
- ✅ 5가지 에이전트 타입 테스트 전부 통과
- ✅ npm build 성공
- ✅ npm test:cli 전부 통과 (excluding pre-existing failures)
- ✅ npm test:sdk 전부 통과
- ✅ crewx.layout.yaml E2E 테스트 성공

---

### **Phase 5: 문서화 및 마이그레이션 가이드** (1-2일) — ⬜️ 대기
**목표**: 레이아웃 기반 래핑 표준 문서화 및 마이그레이션 가이드 제공

**작업**:
1. **아키텍처 문서 작성**
   ```markdown
   # Prompt Wrapping Standard (WBS-15)

   ## Overview
   CrewX uses layout-based prompt wrapping to ensure security and consistency.

   ## Security Container Pattern
   - `<system_prompt key="${securityKey}">`: System prompt container
   - `<user_query key="${securityKey}">`: User input container

   ## Data Flow
   1. Security Key Generation (crewx.tool.ts)
   2. TemplateContext Construction (vars.security_key, vars.user_input)
   3. Layout Rendering (SDK LayoutRenderer)
   4. AI Provider Invocation

   ## Layout DSL Usage
   ```yaml
   layouts:
     my-secure-layout:
       template: |
         <system_prompt key="{{vars.security_key}}">
           {{{layout.system_prompt}}}

           {{#if vars.user_input}}
           <user_query key="{{vars.security_key}}">
           {{{vars.user_input}}}
           </user_query>
           {{/if}}
         </system_prompt>
   ```
   ```

2. **Layout DSL 필드 레퍼런스 확장**
   ```markdown
   # Layout DSL Field Reference

   ## vars.security_key
   - Type: `string`
   - Purpose: Random 16-char hexadecimal security key
   - Usage: `<system_prompt key="{{vars.security_key}}">`

   ## vars.user_input
   - Type: `string | undefined`
   - Purpose: User query to be wrapped
   - Usage: `{{#if vars.user_input}}<user_query>{{vars.user_input}}</user_query>{{/if}}`

   ## Backward Compatibility
   - Feature flag: `CREWX_WRAPPING_LEGACY=true`
   - Legacy mode keeps hardcoded wrapping
   - Default: layout-based wrapping (recommended)
   ```

3. **마이그레이션 가이드 작성**
   ```markdown
   # WBS-15 Migration Guide

   ## For Agent Developers

   ### Option 1: Use Default Layout (Recommended)
   No changes needed - default layout already includes user_query block.

   ### Option 2: Custom Layout
   Add user_query block to your custom layout:
   ```yaml
   layouts:
     my-layout:
       template: |
         <!-- your existing content -->

         {{#if vars.user_input}}
         <user_query key="{{vars.security_key}}">
         {{{vars.user_input}}}
         </user_query>
         {{/if}}
   ```

   ### Option 3: Legacy Mode
   Set environment variable for backward compatibility:
   ```bash
   export CREWX_WRAPPING_LEGACY=true
   ```

   ## Testing Checklist
   - [ ] Test with inline agent (no layout)
   - [ ] Test with minimal layout
   - [ ] Test with custom layout
   - [ ] Test with remote MCP agent
   - [ ] Verify security key in rendered output
   ```

4. **CREWX.md 업데이트**
   - `packages/sdk/CREWX.md`: Layout System 섹션에 wrapping pattern 추가
   - `packages/cli/CREWX.md`: Prompt Wrapping 섹션 신규 추가
   - `README.md`: WBS-15 링크 추가

5. **산출물**:
   - `docs/architecture/prompt-wrapping-standard.md` (신규)
   - `docs/architecture/layout-dsl-field-reference.md` (확장)
   - `docs/migration/wbs-15-wrapping-migration.md` (신규)
   - 업데이트된 CREWX.md (SDK + CLI)

**성공 기준**:
- ✅ 프롬프트 래핑 표준 문서 완성
- ✅ Layout DSL 필드 레퍼런스 확장
- ✅ 마이그레이션 가이드 작성
- ✅ CREWX.md 업데이트 (SDK + CLI)

---

## 📅 예상 일정

| Phase | 작업 | 소요 | 담당 | 의존도 |
|-------|------|------|------|--------|
| **1** | 래핑 로직 분석 + 안전망 | 2일 | @crewx_codex_dev | 독립 |
| **2** | SDK 레이아웃 구조 확장 | 2-3일 | @crewx_glm_dev | Phase 1 후 |
| **3** | CLI 하드코딩 제거 | 2-3일 | @crewx_claude_dev | Phase 2 후 |
| **4** | 회귀 테스트 | 1-2일 | @crewx_claude_dev | Phase 3 후 |
| **5** | 문서화 | 1-2일 | @crewx_glm_dev | Phase 4 후 |
| **총합** | **5 Phase** | **8-12일** | Dev Team | - |

---

## 🎯 성공 기준

### 전체 프로젝트 완료 기준
- ✅ Phase 1: 래핑 로직 전체 흐름 파악 및 위험도 평가
- ⬜️ Phase 2: TemplateContext에 `vars.user_input` 추가
- ⬜️ Phase 3: crewx.tool.ts 하드코딩 제거 (2개 location)
- ⬜️ Phase 4: 5가지 에이전트 타입 테스트 전부 통과
- ⬜️ Phase 5: 아키텍처 문서 + 마이그레이션 가이드 완성

---

## 🔗 관련 파일

### 문제 코드
- [packages/cli/src/crewx.tool.ts:712-715](packages/cli/src/crewx.tool.ts#L712-L715) — `<user_query>` 하드코딩 (query 모드)
- [packages/sdk/src/core/providers/base-ai.provider.ts:344-352](packages/sdk/src/core/providers/base-ai.provider.ts#L344-L352) — wrapUserQueryWithSecurity (미사용)
- [packages/sdk/src/core/providers/dynamic-provider.factory.ts:545](packages/sdk/src/core/providers/dynamic-provider.factory.ts#L545) — parseUserQueryForRemote (파싱용, 유지)

### 관련 문서
- [templates/agents/default.yaml](templates/agents/default.yaml) — Default layout (수정 예정)
- [packages/sdk/src/types/template.types.ts](packages/sdk/src/types/template.types.ts) — TemplateContext (확장 예정)
- [wbs/wbs-14-context-integration-revised.md](wbs/wbs-14-context-integration-revised.md) — WBS-14 참고

### WBS
- [wbs.md#wbs-15](wbs.md#wbs-15)

---

## 🚀 주요 변경사항

| 항목 | 현재 | 계획 | 이유 |
|------|------|------|------|
| **래핑 로직** | 하드코딩 (crewx.tool.ts) | 레이아웃 기반 | 레이아웃 시스템 설계 의도와 일치 |
| **vars 필드** | security_key만 | +user_input | 사용자 쿼리를 레이아웃에 전달 |
| **default.yaml** | user_query 없음 | user_query 블록 추가 | 기본 래핑 지원 |
| **base-ai.provider** | wrapUserQuery 메서드 | @deprecated 표시 | 중복 코드 정리 |
| **호환성** | N/A | Feature flag 추가 | CREWX_WRAPPING_LEGACY |

---

## 📌 실행 흐름 (의존도 다이어그램)

```
Phase 1 (래핑 로직 분석 + 안전망 검증)
    ↓
Phase 2 (SDK 레이아웃 구조 확장)
    ↓
Phase 3 (CLI 하드코딩 제거 + 레이아웃 위임)
    ↓
Phase 4 (회귀 테스트 + 통합 검증)
    ↓
Phase 5 (문서화 + 마이그레이션 가이드)
```

---

## 🚀 Next Steps

1. ✅ **Phase 1 완료**: 래핑 로직 분석 및 안전망 검증
2. ⬜️ **Phase 2 시작**: SDK 레이아웃 구조 확장 (@crewx_glm_dev)
3. ⬜️ **Phase 3 대기**: CLI 하드코딩 제거 (Phase 2 후)
4. ⬜️ **Phase 4 대기**: 회귀 테스트 (Phase 3 후)
5. ⬜️ **Phase 5 대기**: 문서화 (Phase 4 후)

---

**작성일**: 2025-10-19
**상태**: 🟡 진행중 (Phase 1 완료 → Phase 2 대기)
