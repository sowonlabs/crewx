# WBS-18: SDK AgentRuntime Provider 통합

> **목표**: AgentRuntime에 실제 AIProvider 주입 및 CLI 통합
> **상태**: ⬜️ 대기
> **작성일**: 2025-10-20
> **선행 작업**: WBS-17 (Skill Runtime & Package)
> **예상 소요**: 10-12시간

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [핵심 문제](#핵심-문제)
3. [설계 방향](#설계-방향)
4. [Phase 구성](#phase-구성)

---

## 프로젝트 개요

### 목표

1. **SDK**: AgentRuntime이 실제 AIProvider를 주입받아 AI 호출 수행
2. **CLI**: CLI가 SDK AgentRuntime을 사용하도록 통합 (일원화)
3. **DX**: 개발자들이 CLI를 보고 SDK 사용법을 배울 수 있게 레퍼런스 제공

### 병렬 실행 전략

```
Phase 1 (SDK 타입)
    │
    ├─────────┬─────────────┐
    │         │             │
    ▼         ▼             ▼
Phase 2   Phase 4*      (문서화)
(SDK 구현) (CLI 준비)
    │         │
    ▼         ▼
Phase 3   Phase 5
(테스트)   (CLI 통합)
```

**주요 발견**:
- Phase 4는 Phase 2와 병렬 가능 (Phase 1만 의존)
- Phase 3과 Phase 5도 병렬 가능
- **예상 소요**: 순차 12-16시간 → 병렬 10시간 (30% 단축)

---

## 핵심 문제

### 1. AgentRuntime이 하드코딩된 Mock 응답만 반환

**packages/sdk/src/core/agent/agent-runtime.ts:75-84**

```typescript
async query(request: AgentQueryRequest): Promise<AgentResult> {
  // ❌ 문제: 하드코딩된 Mock 응답
  const result: AgentResult = {
    content: `Query executed: ${request.prompt}`,
    success: true,
    // ...
  };
  return result;
}
```

### 2. createCrewxAgent가 ProviderConfig를 무시

**packages/sdk/src/core/agent/agent-factory.ts**

```typescript
export async function createCrewxAgent(config: CrewxAgentConfig = {}) {
  // ❌ config.provider를 받지만 사용하지 않음
  const runtimeOptions: AgentRuntimeOptions = {
    eventBus,
    enableCallStack: config.enableCallStack ?? false,
    // provider 전달 안 됨!
  };
}
```

### 3. Provider 생성 로직이 Agent 계층과 분리됨

- `dynamic-provider.factory.ts`에 Provider 생성 로직 있음
- Agent 계층(`agent-factory`, `agent-runtime`)과 연결 안 됨

---

## 설계 방향

### 핵심 원칙

1. **Provider 주입의 유연성**
   - `ProviderConfig` (설정 객체) 또는 `AIProvider` (인스턴스) 둘 다 지원
   - 프로덕션: Config 전달 → Factory가 자동 생성
   - 테스트: Mock 인스턴스 직접 주입

2. **AgentRuntime의 단일 책임**
   - Provider 생성/관리는 Factory 책임
   - Runtime은 주입받은 Provider만 사용

3. **테스트 용이성 & 하위 호환성**
   - MockProvider를 쉽게 주입 가능
   - Provider 없이 생성 시 자동으로 MockProvider 사용 (기본값)
   - 기존 코드 (`ParallelRunner` 등) 깨지지 않음

---

## Phase 구성

### 일정: 10-12시간 (병렬 실행)

| Phase | 작업 | 소요 | 산출물 | 병렬 가능 | 상세 문서 |
|-------|------|------|--------|-----------|-----------|
| Phase 1 | Provider 주입 구조 설계 | 2h | 타입 정의, 인터페이스 | - | [Phase 1 상세](wbs-18-phase-1-provider-design.md) |
| Phase 2 | AgentRuntime Provider 통합 | 3h | Provider 호출 구현 | Phase 4 | [Phase 2 상세](wbs-18-phase-2-implementation-summary.md) |
| Phase 3 | 테스트 업데이트 | 2h | MockProvider, 단위/통합 테스트 | Phase 5 | [Phase 3 상세](wbs-18-phase-3-test-summary.md) |
| Phase 4 | CLI Provider 통합 준비 | 2h | ProviderBridge 구현 | Phase 2 | [Phase 4 상세](wbs-18-phase-4-cli-bridge-summary.md) |
| Phase 5 | CLI 명령어에서 SDK 사용 | 3h | query.handler 리팩토링 | Phase 3 | [Phase 5 상세](wbs-18-phase-5-cli-integration-summary.md) |

### Phase 1: Provider 주입 구조 설계 (2h)
- CrewxAgentConfig 타입 확장
- resolveProvider 헬퍼 함수 구현
- AgentRuntimeOptions에 Provider 필드 추가

### Phase 2: AgentRuntime Provider 통합 (3h)
- AgentRuntime.query() 리팩토링
- AgentRuntime.execute() 리팩토링
- AIResponse → AgentResult 변환

### Phase 3: 테스트 업데이트 (2h)
- MockProvider 클래스 구현
- agent-factory.test.ts 업데이트
- Integration 테스트 작성

### Phase 4: CLI Provider 통합 준비 (2h)
- ProviderBridge 서비스 구현
- AgentRuntimeService 개선
- AppModule 업데이트

### Phase 5: CLI 명령어에서 SDK 사용 (3h)
- query.handler.ts를 SDK 기반으로 리팩토링
- 간단한 쿼리는 SDK 사용
- 복잡한 쿼리는 CrewXTool fallback 유지

---

## 완료 기준

### Phase 1
- ✅ `CrewxAgentConfig.provider` 타입 지원
- ✅ `resolveProvider()` 헬퍼 함수 구현
- ✅ `AgentRuntimeOptions.provider` 필드 추가
- ✅ 기존 `ParallelRunner` 코드 호환

### Phase 2
- ✅ `AgentRuntime.query()`가 실제 Provider 호출
- ✅ AIResponse → AgentResult 변환 로직
- ✅ `agentCompleted` 이벤트가 Provider 실제 결과 반영
- ✅ 에러 핸들링 및 콜스택 로직 유지

### Phase 3
- ✅ `MockProvider` 클래스 구현
- ✅ 10+ 새 테스트 작성
- ✅ Integration 테스트 (CodexProvider)
- ✅ 기존 테스트 회귀 검증

### Phase 4
- ✅ `ProviderBridgeService` 구현
- ✅ `AgentRuntimeService`가 실제 CLI Provider 사용
- ✅ 빌드 성공 (타입 에러 없음)

### Phase 5
- ✅ `query.handler.ts`에 SDK 사용 로직 추가
- ✅ 간단한 쿼리는 SDK AgentRuntime 사용
- ✅ 복잡한 쿼리는 CrewXTool fallback
- ✅ 실제 AI 응답 정상 작동

---

## 다음 단계

1. **WBS-19**: SDK에 템플릿/레이아웃 처리 기능 추가
2. **WBS-20**: CLI CrewXTool 로직을 SDK로 점진적 이관
3. **WBS-21**: Remote Agent에서 SDK AgentRuntime 사용
4. **WBS-22**: Multi-provider Agent 지원

---

## 참고 문서

- [Phase 1: Provider Design](wbs-18-phase-1-provider-design.md)
- [Phase 2: Implementation Summary](wbs-18-phase-2-implementation-summary.md)
- [Phase 3: Test Summary](wbs-18-phase-3-test-summary.md)
- [Phase 4: CLI Bridge Summary](wbs-18-phase-4-cli-bridge-summary.md)
- [Phase 5: CLI Integration Summary](wbs-18-phase-5-cli-integration-summary.md)
- [Phase 5: CLI Integration Plan](wbs-18-phase-5-cli-integration-plan.md)
