# WBS-14: StructuredPayload/TemplateContext 통합 및 하드코딩 제거 (수정본)

> **상태**: ⬜️ 대기 (Codex 검토 반영 중)
> **방식**: 순차적 + 병렬 (상호의존 Phase는 동시 진행 가능)
> **담당**: @crewx_claude_dev, @crewx_codex_dev, @crewx_glm_dev

---

## 📋 개요

### 목표
CLI의 시스템 프롬프트 생성 로직에서 **중복된 하드코딩 제거**를 통해 레이아웃 시스템의 설계 의도를 정확히 구현하되, **Phase 순서 재조정**을 통해 inline 에이전트 손실 위험을 제거하고, **TemplateContext를 SDK로 공개**하되 **채널 확장성을 고려**하여 설계.

### Codex 검토 반영
- ⚠️ **일정 모순**: 1일 목표 vs 실제 3-4일 필요 → **명확한 기간 재설정**
- 🔴 **Phase 순서 위험**: Phase 2 전에 Phase 3 필요 → **Phase 순서 변경 (1→3→2→4→5)**
- 🟡 **SDK 컨트랙트 문제**: CLI 필드 노출 → **필드 정제 필요**
- 🟡 **텔레메트리 불명확**: 수집 기준 / 종료 계획 없음 → **상세 계획 추가**
- 🟡 **agentMetadata 미매핑**: 필드만 추가 → **실제 사용처 명시**

---

## 📊 수정된 Phase 구조 (5 Phase → 재순서)

### Phase 1: 안전망 검증 (2-3일) ← 변경 없음
**목표**: 하드코딩 제거의 위험 범위 파악

**작업**:
1. **Layout 실패 시나리오 테스트** (크리티컬 경로 식별)
   - Inline 시스템 프롬프트만 있는 에이전트 (layout 없음)
   - Minimal layout 에이전트
   - Layout 파일 누락 시나리오
   - YAML 파싱 오류 시나리오

2. **현재 append 사용 통계 수집** (텔레메트리)
   - **수집 기준**: 어떤 경로에서, 몇 번 호출되는지
   - **소유자**: @crewx_claude_dev
   - **종료 계획**: Phase 2-3 완료 후 10일 내 제거
   - **성공 지표**: append 호출 빈도 < 5% 또는 모두 layout fallback

3. **산출물**: 안전 검증 보고서 + telemetry 계획서

---

### Phase 3: SDK TemplateContext 확장 및 정제 (2-3일) ← **순서 변경: Phase 2 앞으로**
**목표**: TemplateContext를 SDK로 공개하되, 채널 중립적으로 설계

**작업**:
1. **TemplateContext 필드 정제** (CLI 특화 필드 제거)
   ```typescript
   // ❌ 제거할 필드
   - options?: string[] (CLI 파싱 전용)
   - platform?: 'slack' | 'cli' (enum 고정화 위험)

   // ✅ 유지할 필드
   + env?: Record<string, string | undefined>
   + agent?: { id, name, provider, model, workingDirectory, ...metadata }
   + mode?: 'query' | 'execute'
   + messages?: Array<{ text, isAssistant, metadata }>
   + platform?: string (union 대신 string으로 확장 가능)
   + tools?: { list, json, count }
   + vars?: Record<string, any>

   // ✅ 추가할 필드 (Phase 2-3 협업용)
   + agentMetadata?: {
       specialties?: string[];
       capabilities?: string[];
       description?: string;
     }
   ```

2. **agentMetadata 매핑** (실제 사용처 보장)
   - crewx.tool.ts: agent 객체에서 specialties/capabilities → templateContext.agentMetadata로 채우기
   - template-processor.ts: agentMetadata를 template context에서 참조 가능하게
   - default.yaml: agentMetadata 또는 agent.* 둘 다 참조 가능하게

3. **SDK export**
   - packages/sdk/src/types/template.types.ts (신규)
   - packages/sdk/src/index.ts에 export 추가

4. **산출물**:
   - 정제된 TemplateContext 타입 (CLI 필드 제거)
   - agentMetadata 데이터 흐름 문서

---

### Phase 2: 하드코딩 제거 + 컨텍스트 적용 (1-2일) ← **순서 변경: Phase 3 후**
**목표**: crewx.tool.ts의 중복 로직 제거, Phase 3의 TemplateContext 활용

**작업**:
1. **코드 수정**
   - [crewx.tool.ts:679-683](packages/cli/src/crewx.tool.ts#L679-L683) 제거 (query 모드)
   - [crewx.tool.ts:960-964](packages/cli/src/crewx.tool.ts#L960-L964) 제거 (execute 모드)
   - **대신**: templateContext.agentMetadata를 processDocumentTemplate에 전달
   - **추가**: feature flag `CREWX_APPEND_LEGACY=true` (호환성 유지)

2. **회귀 테스트**
   - Phase 1 테스트 케이스 실행 (append 없이도 inline 에이전트 동작)
   - npm test:cli (전부 통과)
   - npm test:sdk (전부 통과)
   - E2E 테스트 (inline, minimal layout 에이전트)

3. **샘프링 검증** (telemetry 기반)
   - Phase 1 통계에서 식별한 fallback 경로 재검증

4. **산출물**:
   - 수정된 crewx.tool.ts
   - 모든 테스트 통과 보고서
   - Feature flag 문서

---

### Phase 4: 문서화 (1-2일) ← 변경 없음
**목표**: 컨텍스트 생명주기를 명확히 문서화

**작업**:
1. **아키텍처 문서**
   - packages/sdk/CREWX.md 확장
   - "Context Integration Standard" 섹션
   - StructuredPayload vs RenderContext vs TemplateContext 명확화

2. **레이아웃 DSL 문서**
   - docs/layout-dsl.md 또는 기존 확장
   - 레이아웃에서 기대하는 필드 목록
   - agentMetadata 사용 예시

3. **마이그레이션 가이드**
   - docs/migration/wbs-14-context-migration.md
   - Slack/MCP 플랫폼에 영향 최소화 설명

4. **산출물**:
   - 아키텍처 문서 (Context Integration Standard)
   - 레이아웃 DSL 문서
   - 마이그레이션 가이드

---

### Phase 5: CREWX.md 정리 (1-2일) ← 변경 없음
**목표**: 컨텍스트 통합 결과를 프로젝트 문서에 반영

**작업**:
1. **packages/sdk/CREWX.md 업데이트**
   - "Key Exports" 섹션에 TemplateContext 추가
   - "Context Management" 섹션 신규 추가

2. **packages/cli/CREWX.md 업데이트**
   - "Key Components" 섹션에서 template-processor 설명 강화

3. **README 링크 추가**
   - Template context standard 가이드 링크

4. **산출물**:
   - 업데이트된 CREWX.md (sdk + cli)
   - Context integration 관련 README 섹션

---

## 📊 수정된 일정

| Phase | 작업 | 소요 | 담당 | 의존도 |
|-------|------|------|------|--------|
| **1** | 안전 검증 + 텔레메트리 계획 | 2-3일 | Claude + Codex | 독립 |
| **3** | SDK TemplateContext 정제 + export | 2-3일 | GLM | Phase 1 후 |
| **2** | 하드코딩 제거 + 컨텍스트 적용 | 1-2일 | Claude | Phase 3 후 |
| **4** | 문서화 | 1-2일 | Claude | Phase 2 후 |
| **5** | CREWX.md 정리 | 1-2일 | GLM | Phase 4 후 |
| **총합** | **5 Phase 순차** | **7-11일** | Dev Team | - |

---

## 📌 실행 흐름 (의존도 다이어그램)

```
Phase 1 (안전망 검증 + 텔레메트리)
    ↓
Phase 3 (SDK TemplateContext 정제)
    ↓
Phase 2 (하드코딩 제거 + agentMetadata 적용)
    ↓
Phase 4 (문서화)
    ↓
Phase 5 (CREWX.md 정리)
```

---

## 🎯 성공 기준

### Phase 1 완료
- ✅ 5가지 폴백 시나리오 테스트 작성 및 통과
- ✅ append 사용 통계 수집 (호출 빈도, fallback 경로 명시)
- ✅ Telemetry 소유자/종료 계획 문서화
- ✅ 안전 검증 보고서 작성

### Phase 3 완료
- ✅ TemplateContext 정제 (CLI 필드 제거)
- ✅ agentMetadata 필드 추가 및 매핑 (crewx.tool.ts → templateContext)
- ✅ TypeScript strict mode 통과
- ✅ SDK export 완료

### Phase 2 완료
- ✅ crewx.tool.ts 2개 라인 세트 제거
- ✅ feature flag CREWX_APPEND_LEGACY 구현
- ✅ npm test:cli 전부 통과
- ✅ npm test:sdk 전부 통과
- ✅ E2E 테스트 통과 (inline 에이전트 동작)

### Phase 4 완료
- ✅ "Context Integration Standard" 문서
- ✅ "레이아웃 DSL 필드 참조" 문서
- ✅ "마이그레이션 가이드" 문서

### Phase 5 완료
- ✅ packages/sdk/CREWX.md "Key Exports" 업데이트
- ✅ packages/cli/CREWX.md "Key Components" 강화
- ✅ README에 Context Integration 링크 추가

---

## 🔗 관련 파일

### 문제 코드
- [packages/cli/src/crewx.tool.ts:679-683](packages/cli/src/crewx.tool.ts#L679-L683)
- [packages/cli/src/crewx.tool.ts:960-964](packages/cli/src/crewx.tool.ts#L960-L964)

### 관련 문서
- [templates/agents/default.yaml:19-47](templates/agents/default.yaml#L19-L47)
- [packages/cli/src/utils/template-processor.ts:17](packages/cli/src/utils/template-processor.ts#L17)

### WBS
- [wbs.md#wbs-14](wbs.md#wbs-14)

---

## 🚀 주요 변경사항 (원래 계획 대비)

| 항목 | 원래 | 수정 | 이유 |
|------|------|------|------|
| **Phase 순서** | 1→2→3→4→5 | 1→3→2→4→5 | Codex: Phase 2 전에 TemplateContext 필요 |
| **일정** | 1일/Phase | 2-3일 재조정 | Codex: 실제 필요 시간 반영 |
| **TemplateContext** | CLI 필드 포함 | CLI 필드 제거 | Codex: 채널 확장성 고려 |
| **agentMetadata** | 필드만 추가 | 실제 매핑 추가 | Codex: 사용처 명시 필수 |
| **Append 제거** | 완전 제거 | Feature flag 뒤로 | Codex: 호환성 유지 필요 |
| **텔레메트리** | 수집만 | 상세 계획 (소유자/종료) | Codex: 임시 로깅 방지 |

---

## 🚀 Next Steps

1. ⬜️ **Phase 1 시작**: 안전망 검증 + 텔레메트리 계획
2. ⬜️ **Phase 3 시작**: SDK TemplateContext 정제 (Phase 1 후)
3. ⬜️ **Phase 2 시작**: 하드코딩 제거 (Phase 3 후)
4. ⬜️ **Phase 4 시작**: 문서화 (Phase 2 후)
5. ⬜️ **Phase 5 시작**: CREWX.md 정리 (Phase 4 후)

---

**Codex 검토 반영**: 2025-10-19
**상태**: ⬜️ 계획 수정 완료 → 대기 (승인)
