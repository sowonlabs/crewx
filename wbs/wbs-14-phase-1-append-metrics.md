# WBS-14 Phase 1: Append Usage Metrics Plan

> **작성일**: 2025-10-19
> **단계**: Phase 1 - 안전망 검증 + 텔레메트리 계획
> **목표**: append 호출 현황 파악 및 제거 후 영향 측정 계획 수립

---

## 📊 개요

### 목적
- 하드코딩된 append (specialties/capabilities) 사용 현황 정량화
- Phase 2 제거 작업 영향도 평가 기준 수립
- 제거 후 레이아웃 폴백 동작 검증 메트릭 정의

### 범위
- **Query 모드**: `packages/cli/src/crewx.tool.ts:684-701`
- **Execute 모드**: `packages/cli/src/crewx.tool.ts:983-1000`

---

## 🔍 현재 Append 사용 분석

### 1. Query 모드 (lines 684-701)

**코드 위치**: `packages/cli/src/crewx.tool.ts:684-701`

```typescript
if (process.env.CREWX_WBS14_TELEMETRY === 'true') {
  this.logger.debug('[WBS-14] Appending inline metadata (query mode)', {
    agentId: agent.id,
    hasLayout: Boolean(agent.inline?.layout),
    layoutId: typeof agent.inline?.layout === 'string'
      ? agent.inline?.layout
      : agent.inline?.layout?.id ?? 'crewx/default',
    specialtiesCount: agent.specialties?.length ?? 0,
    capabilitiesCount: agent.capabilities?.length ?? 0,
    workingDirectory: workingDir,
  });
}

systemPrompt += `

Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Analysis'}
Working Directory: ${workingDir}`;
```

**특징**:
- Feature Flag (`CREWX_WBS14_TELEMETRY`)로 로그 활성화
- 레이아웃 렌더링 **후** append가 실행되어 중복 가능성 존재
- 기본값: `Specialties: General`, `Capabilities: Analysis`

**영향 에이전트**:
- Built-in 에이전트: @crewx, @claude, @gemini, @copilot (default.yaml 사용)
- Custom 에이전트: crewx_glm_dev (crewx_dev_layout 사용)

#### Static Usage Snapshot (2025-10-19)
| Usage pattern | Owner | Frequency | Lifecycle | Notes |
|---------------|-------|-----------|-----------|-------|
| `queryAgent` hardcoded append (`Specialties/Capabilities/Working Directory`) | CLI (CrewXTool) | 1 per query call (100%) | Legacy guardrail | Layout already renders specialties/capabilities; append duplicates output |
| `executeAgent` hardcoded append (`Specialties/Capabilities/Working Directory`) | CLI (CrewXTool) | 1 per execute call (100%) | Legacy guardrail | `Capabilities` default differs (Implementation); duplication risk identical |

> Measurement method: static grep baseline (2025-10-19) + telemetry flag (`CREWX_WBS14_TELEMETRY`) for runtime validation.

### 2. Execute 모드 (lines 983-1000)

**코드 위치**: `packages/cli/src/crewx.tool.ts:983-1000`

```typescript
if (process.env.CREWX_WBS14_TELEMETRY === 'true') {
  this.logger.debug('[WBS-14] Appending inline metadata (execute mode)', {
    agentId: agent.id,
    hasLayout: Boolean(agent.inline?.layout),
    layoutId: typeof agent.inline?.layout === 'string'
      ? agent.inline?.layout
      : agent.inline?.layout?.id ?? 'crewx/default',
    specialtiesCount: agent.specialties?.length ?? 0,
    capabilitiesCount: agent.capabilities?.length ?? 0,
    workingDirectory: workingDir,
  });
}

systemPrompt += `
Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Implementation'}
Working Directory: ${workingDir}`;
```

**특징**:
- Query 모드와 동일한 로그 & append 구조
- 기본값 차이: `Capabilities: Implementation` (execute 컨텍스트)

**영향 에이전트**: Query 모드와 동일

---

## 📐 메트릭 정의

### Metric 1: Append 호출 빈도
- **측정 대상**: 각 모드에서 append가 실행되는 총 횟수
- **수집 방법**: 로그 또는 카운터 (Phase 2 전 임시 텔레메트리)
- **목표**: 제거 전후 비교 (기준선 확립)

### Metric 2: 레이아웃 폴백 경로
- **측정 대상**: append 제거 후 어떤 레이아웃이 specialties/capabilities를 렌더링하는지
- **수집 방법**:
  - Layout ID 별 렌더링 빈도 로그
  - Fallback 경로 추적 (inline.layout → crewx/default)
- **목표**: 100% 레이아웃 렌더링 검증

### Metric 3: 중복 렌더링 탐지
- **측정 대상**: 시스템 프롬프트에 `Specialties:`가 2회 이상 등장하는 경우
- **수집 방법**: 정규식 매칭으로 중복 탐지
- **목표**: 제거 전 중복률 vs 제거 후 중복률 = 0%

### Metric 4: 에이전트별 영향도
- **측정 대상**: 각 에이전트가 append에 의존하는 비율
- **분류**:
  - **High**: inline.layout 없고 specialties/capabilities만 있는 에이전트
  - **Medium**: inline.layout 있지만 레이아웃이 specialties/capabilities 미렌더링
  - **Low**: 레이아웃에서 이미 specialties/capabilities 렌더링 중
- **목표**: High/Medium 에이전트 0개 달성 (Phase 3 전)

---

## 🎯 성공 지표

### Phase 2 완료 기준
1. **Append 호출 횟수 = 0** (하드코딩 제거 완료)
2. **레이아웃 폴백 성공률 = 100%** (모든 에이전트가 레이아웃 통해 렌더링)
3. **중복 렌더링 발생률 = 0%** (시스템 프롬프트에 Specialties/Capabilities 1회만 등장)
4. **High/Medium 영향 에이전트 = 0개** (모든 에이전트가 레이아웃 커버리지 확보)

---

## 🔧 텔레메트리 구현 계획

### 옵션 1: 임시 로그 추가 (권장)
```typescript
// packages/cli/src/crewx.tool.ts (query/execute 모드 공통)
if (process.env.CREWX_WBS14_TELEMETRY === 'true') {
  this.logger.debug('[WBS-14] Appending inline metadata (query mode)', {
    agentId: agent.id,
    hasLayout: Boolean(agent.inline?.layout),
    layoutId: typeof agent.inline?.layout === 'string'
      ? agent.inline?.layout
      : agent.inline?.layout?.id ?? 'crewx/default',
    specialtiesCount: agent.specialties?.length ?? 0,
    capabilitiesCount: agent.capabilities?.length ?? 0,
    workingDirectory: workingDir,
  });
}
```

**장점**: 간단, 비침투적, Feature Flag (`CREWX_WBS14_TELEMETRY`)로 제어 가능
**단점**: 수동 분석 필요

### 옵션 2: 메트릭 카운터 (추천하지 않음)
```typescript
// 별도 메트릭 서비스 생성
this.metricsService.incrementAppendCount('query', agent.id);
```

**장점**: 구조화된 데이터
**단점**: 인프라 복잡도 증가, Phase 2 후 제거 부담

### ✅ 선택: 옵션 1 (Feature Flag + 임시 로그)
- 소유자: @crewx_claude_dev
- 활성 조건: `CREWX_WBS14_TELEMETRY=true` 환경 변수 사용
- 수집 기간: Phase 1 완료 ~ Phase 2 시작 (1-2일)
- 제거 계획: Phase 2 완료 직후 (하드코딩 제거 커밋에 포함)
- 데이터 분석: 로그 파일 grep/awk 처리

---

## 📊 예상 결과

### 제거 전 (현재)
```
[DEBUG] [WBS-14] Appending inline metadata (query mode)
  agentId: claude
  hasLayout: false
  layoutId: crewx/default
  specialtiesCount: 2
  capabilitiesCount: 1
  workingDirectory: /Users/doha/git/crewx
```

**예상 빈도**: 모든 query/execute 호출 시 1회 (100%)

### 제거 후 (Phase 2)
```
[DEBUG] Rendering layout: crewx/default
  agentId: claude
  specialties: ["Complex reasoning", "Code analysis"]
  capabilities: ["Analysis"]
  rendered: true (via layout)
```

**예상 빈도**: Append 호출 0회 (0%)

---

## 🚦 위험도 평가

### 🟢 Low Risk (안전)
- **대상**: 모든 에이전트 (@crewx, @claude, @gemini, @copilot, @codex, `crewx_glm_dev`)
- **이유**: default.yaml 및 crewx_dev_layout이 metadata를 조건부 렌더링 → append 제거 시 손실 없음
- **추가 보호**: 텔레메트리 로그로 Phase 2 전후 영향 모니터링 가능

---

## 📝 액션 아이템

### Phase 1 (현재)
- [x] 메트릭 정의 완료
- [x] 텔레메트리 방법 선택 (옵션 1: 임시 로그)
- [x] 로그 코드 추가 (crewx.tool.ts:684-700, 983-999)
- [ ] 1-2일 로그 수집
- [ ] 로그 분석 및 보고서 작성

### Phase 2 (하드코딩 제거)
- [ ] append 코드 제거 (lines 684-701, 983-1000)
- [ ] 텔레메트리 로그 제거
- [ ] 회귀 테스트 실행
- [ ] 메트릭 검증 (성공 지표 달성 확인)

### Phase 3 (SDK 확장)
- [ ] TemplateContext.agentMetadata 추가
- [ ] default.yaml에서 agentMetadata 참조
- [ ] 레이아웃 커버리지 100% 검증

---

## 📚 참고 자료

- **WBS-14 전체 계획**: [wbs/wbs-14-context-integration-revised.md](wbs-14-context-integration-revised.md)
- **회의 요약**: [wbs/wbs-14-meeting-summary.md](wbs-14-meeting-summary.md)
- **코드 위치**:
  - Query append + telemetry: `packages/cli/src/crewx.tool.ts:684-701`
  - Execute append + telemetry: `packages/cli/src/crewx.tool.ts:983-1000`
  - Layout fallback: `packages/cli/src/crewx.tool.ts:145-260`

---

**작성자**: @crewx_claude_dev
**검토**: @crewx_codex_dev (계획 검증)
**상태**: ✅ 완료
