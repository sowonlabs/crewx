# 회의 요약: StructuredPayload/TemplateContext 통합 방안
> **날짜**: 2025-10-19
> **참석**: 팀장 + @crewx_claude_dev (분석 진행 중), @crewx_codex_dev (상세 분석), @crewx_glm_dev (실용 권고)
> **스레드**: thread-0001

---

## 📊 상황 정리

### 문제 상황
CLI의 `crewx.tool.ts`에서 **중복 처리** 발생:

```typescript
// Line 679-683 (query 모드) & Line 960-964 (execute 모드)
systemPrompt += `
Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Analysis'}
Working Directory: ${workingDir}`;
```

**문제**:
- `processAgentSystemPrompt()` 이미 완성된 프롬프트 반환 ✅
- 레이아웃 (`templates/agents/default.yaml:19-47`)에서 이미 조건부로 렌더링 중 ✅
- 다시 하드코딩으로 텍스트 추가 = **중복** ❌

### 데이터 흐름
```
TemplateContext 생성
  ↓ (env, agent, tools, vars)
processAgentSystemPrompt()
  ├─ LayoutLoader 로드
  ├─ RenderContext 구성 (specialties, capabilities 포함)
  ├─ LayoutRenderer 렌더링
  │  → XML로 처리 (레이아웃 DSL)
  ├─ processDocumentTemplate 처리
  ↓
완성된 시스템 프롬프트 ✅
  ↓
[문제 지점] 하드코딩 추가
  ↓
fullPrompt + StructuredPayload → AI 호출
```

---

## 🎤 개발자 분석 결과

### 1️⃣ Codex 개발자: 전략적 분석

**3가지 실패 모드 (Failure Modes)**:
1. **Inline 에이전트 블라인드**
   - 하드코딩 제거 + TemplateContext 확장 없음 → specialties/capabilities 손실
   - CEO 반발: "가벼운 프롬프트(YC exception) 약속 깼어"

2. **SDK 타입 고정화**
   - TemplateContext 공개 → `platform` enum 고정 (cli|slack)
   - 향후 browser, mobile 추가 시 breaking change

3. **표현 발산 (Representation Divergence)**
   - XML (layout) + plaintext (append) 이중 관리
   - 한쪽만 업데이트 시 불일치 버그
   - CEO 반발: "감사는 어떻게 해?"

**3가지 권장 옵션**:

| 옵션 | 전략 | 장점 | 단점 |
|------|------|------|------|
| **1. 점진적 가드레일** | append 유지 + TemplateContext 확장 + 모니터링 | 안전함 + 부드러운 전환 | 기술부채 쌓임 |
| **2. SDK 정렬** | TemplateContext 공개 + 문서화 + 장기 계획 | 외부 재사용 + append 정당화 제거 | 구조 변경 필요 |
| **3. Layout-or-Nothing** | 모든 에이전트 layout 강제 + append 삭제 | 가장 깔끔 + 미래형 | 마이그레이션 비용 높음 |

**Codex의 핵심 통찰**:
```
현재 append는 "layout 실패 시 안전망"이다.
- 레이아웃이 성공 → XML로 처리 ✅
- 레이아웃이 실패 → plaintext append만 의존 ✅
- 레이아웃 없음 (inline) → plaintext append만 의존 ✅

제거하려면:
- 모든 경로에서 layout 사용 보장 OR
- TemplateContext에 metadata 포함시켜서 template layer 보상
```

**6개월 로드맵** (장기 계획):
- **Now (2주)**: Phase 1-2 완료, 기술부채 감소
- **6개월**: SDK 채택 증가 → TemplateContext 공개 + 문서화 → 외부 소비자 지원
- **2년**: 다중 채널 (Slack, VS Code, 브라우저) → "Layout-or-Nothing" 수렴

---

### 2️⃣ GLM 개발자: 실용성 중심 분석

**핵심 답변**:

1. **하드코딩 정말 필요?**
   - ❌ **아니요**. 이미 레이아웃에서 조건부로 처리
   - 데이터 중복, 포맷팅 불일치, 유지보수 부담 초래

2. **TemplateContext SDK 공개 가능?**
   - ⚠️ **부분적으로만**
   - ✅ 공개 가능: env, agent, mode, messages, platform, tools, vars
   - ❌ CLI 전용: options (CLI 옵션 파싱), 런타임 필드

3. **RenderContext 공개 필요?**
   - ✅ **이미 공개됨** (SDK에서 정의되어 사용 중)

**GLM 권고**:
> 즉시 제거 가능. processAgentSystemPrompt()가 이미 완성된 프롬프트 반환하므로 하드코딩은 **완전한 중복**

---

## ✅ 최종 결정안

### 권장 경로: "Codex Option 1 + GLM 즉시 제거" 하이브리드

```
안전성 (Codex) + 실용성 (GLM) 결합
  ↓
Phase 1: 안전 검증 (실패 모드 테스트)
  ↓
Phase 2: 하드코딩 제거 (즉시 구현)
  ↓
Phase 3: SDK 확장 (agentMetadata 필드)
  ↓
Phase 4: 문서화 (장기 로드맵)
```

---

## 📋 구체적 실행 계획

> ℹ️ **일정 노트**: 각 Phase는 **1일 완성 목표**로 진행하며, 병목 발생 시 다음 phase로 자동 연장

### Phase 1: 안전망 검증 (1일)
**목표**: 하드코딩 제거의 위험 범위 파악

- Inline 시스템 프롬프트만 있는 에이전트 테스트
- Minimal layout 에이전트 테스트
- Layout 파일 누락 시나리오
- YAML 파싱 오류 시나리오
- 현재 append 사용 통계 수집

**산출물**: 안전 검증 보고서 + 테스트 케이스

---

### Phase 2: 하드코딩 제거 (1일)
**목표**: crewx.tool.ts 중복 로직 제거

**코드 변경**:
```typescript
// 삭제 대상
// crewx.tool.ts:679-683 (query 모드)
systemPrompt += `
Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Analysis'}
Working Directory: ${workingDir}`;

// crewx.tool.ts:960-964 (execute 모드)
systemPrompt += `
Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Implementation'}
Working Directory: ${workingDir}`;
```

**회귀 테스트**:
- `npm test:cli` 전부 통과
- `npm test:sdk` 전부 통과
- E2E 테스트 (inline, minimal layout 에이전트)

**산출물**: 수정된 crewx.tool.ts + 테스트 보고서

---

### Phase 3: SDK TemplateContext 확장 (1일)
**목표**: TemplateContext를 SDK로 공개 & 메타데이터 확장

**구현**:
1. `packages/sdk/src/types/template.types.ts` (신규)
   ```typescript
   export interface TemplateContext {
     env?: Record<string, string | undefined>;
     agent?: { id, name, provider, model, workingDirectory };
     mode?: 'query' | 'execute';
     messages?: Array<{ text, isAssistant, metadata }>;
     platform?: 'slack' | 'cli';
     tools?: { list, json, count };
     vars?: Record<string, any>;

     // [Phase 3 추가] 확장 필드 (향후 레이아웃 보상용)
     agentMetadata?: {
       specialties?: string[];
       capabilities?: string[];
       description?: string;
     };
   }
   ```

2. `packages/sdk/src/index.ts` 업데이트
   ```typescript
   export type { TemplateContext } from './types/template.types';
   ```

3. CLI 임포트 변경
   ```typescript
   // 기존
   import { TemplateContext } from './utils/template-processor';

   // 변경
   import { TemplateContext } from '@sowonai/crewx-sdk';
   ```

**산출물**: SDK 타입 확장 + CLI 임포트 변경

---

### Phase 4: 문서화 (1일)
**목표**: 컨텍스트 생명주기 명확화

**산출물**:
1. **"Context Integration Standard"** 아키텍처 문서
   - StructuredPayload (메시지 전달용)
   - RenderContext (렌더링 내부용)
   - TemplateContext (로컬 생성 입력용)
   - 각각의 역할, 생명주기, 사용 예시

2. **"레이아웃 DSL 필드 참조"** 가이드
   - 레이아웃에서 기대하는 필드 목록
   - 예: agent.specialties, agent.capabilities, agent.workingDirectory

3. **"마이그레이션 가이드"**
   - Slack/MCP 플랫폼 영향도 최소화
   - 외부 소비자 재사용 방법

---

## 🎯 성공 기준

| Phase | 검수 기준 |
|-------|---------|
| **1** | ✅ 5가지 폴백 시나리오 테스트 통과, 안전 검증 보고서 작성 |
| **2** | ✅ 2개 하드코딩 세트 제거, npm test:cli/sdk 전부 통과 |
| **3** | ✅ TemplateContext SDK export, CLI import 변경, TypeScript strict 통과 |
| **4** | ✅ 아키텍처 문서, DSL 가이드, 마이그레이션 가이드 작성 |

---

## 📌 의존성 & 위험도

### 선행 필수
- ✅ **WBS-13 완료**: CLI 레이아웃 통합 (2025-10-19 완료)

### 외부 의존도
- Slack: TemplateContext 공개 후 재사용 가능 (선택)
- MCP: crewx.tool.ts 공유 → Phase 2 변경사항 자동 적용
- 원격 에이전트: StructuredPayload만 사용 → 영향 없음

### 위험도 평가

| 위험 | 심각도 | 완화 방안 |
|------|--------|---------|
| Inline 에이전트 손실 | 🔴 High | Phase 1 테스트 + 폴백 검증 |
| 테스트 회귀 | 🟡 Medium | Phase 2 회귀 테스트 강화 |
| SDK 타입 고정화 | 🟡 Medium | agentMetadata 필드로 확장 가능 설계 |

---

## 📊 일정

| Phase | 소요 | 시작 | 종료 | 담당 |
|-------|------|------|------|------|
| 1 | 3-4일 | 2025-10-20 | 2025-10-23 | Claude + Codex |
| 2 | 2-3일 | 2025-10-24 | 2025-10-26 | Claude (주) |
| 3 | 2-3일 | 2025-10-27 | 2025-10-29 | GLM (주) |
| 4 | 2-3일 | 2025-10-30 | 2025-11-01 | Claude (주) |
| **전체** | **~2주** | **2025-10-20** | **2025-11-01** | Dev Team |

---

## 🔗 참고 링크

### 문제 코드
- [packages/cli/src/crewx.tool.ts:679-683](../packages/cli/src/crewx.tool.ts#L679-L683) - Query 하드코딩
- [packages/cli/src/crewx.tool.ts:960-964](../packages/cli/src/crewx.tool.ts#L960-L964) - Execute 하드코딩

### 관련 레이아웃
- [templates/agents/default.yaml:19-47](../templates/agents/default.yaml#L19-L47) - Agent profile 렌더링
- [crewx.yaml:19-47](../crewx.yaml#L19-L47) - 프로젝트 레이아웃

### WBS
- [wbs/wbs-14-context-integration.md](wbs/wbs-14-context-integration.md) - 상세 계획
- [wbs.md](wbs.md#wbs-14) - 전체 WBS 현황

---

## 🚀 Next Steps

1. ✅ 분석 완료 + 최종 결정안 수립 (본 문서)
2. ⬜️ **Phase 1 시작**: 안전망 검증 (2025-10-20)
3. ⬜️ **Phase 2 시작**: 하드코딩 제거 (2025-10-24)
4. ⬜️ **Phase 3 시작**: SDK 확장 (2025-10-27)
5. ⬜️ **Phase 4 시작**: 문서화 (2025-10-30)

---

**작성**: 팀장
**상태**: 📋 계획 수립 완료 → 🟡 진행 중 (Phase 1 시작 시)
**다음 회의**: Phase 1 완료 후 (2025-10-24)
