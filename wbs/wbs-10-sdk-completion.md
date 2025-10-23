[← WBS 개요](../wbs.md)

# WBS-10 SDK 완성도 향상 및 누락 기능 구현

> **목표**: SDK 패키지의 미완성 기능 구현 및 요구사항 완전 충족
> **우선순위**: High (배포 전 필수)
> **예상 기간**: 3-4일

## 📋 배경

WBS-9까지 완료되면서 SDK의 기본 골격과 핵심 API는 구현되었으나, 아래 항목들이 미완성 상태:

1. **YAML 설정 로딩**: `loadAgentConfigFromYaml()` placeholder만 존재
2. **병렬 실행 헬퍼**: `runQueriesParallel()`, `runExecutesParallel()` 미구현
3. **security 디렉토리**: 요구사항에 명시되었으나 구현 안됨
4. **MessageFormatter 기능 보강**: Slack 연계 및 플랫폼별 포맷팅 개선

**현재 SDK 완성도**: 85-90%
**목표 완성도**: 100%

## 🎯 작업 범위

### Phase 1: 핵심 타입 정의 및 YAML 로더 구현 (Day 1)
**우선순위**: High

#### 작업 내용

**Phase 1.1: StructuredPayload 타입 SDK로 이동** (0.5일)
- [ ] SDK 타입 정의 생성
  - `packages/sdk/src/types/structured-payload.types.ts` 생성
  - Requirements 문서 기반 완전한 타입 정의
  - CLI의 `StructuredContextPayload` → SDK `StructuredPayload`로 통합
- [ ] CallStack 통합
  - WBS-8의 `CallStackFrame` 타입 활용
  - `metadata.callStack` 필드 추가 (Requirements 215줄 준수)
- [ ] SDK 공개 API export
  - `packages/sdk/src/index.ts`에 export 추가
  - `StructuredPayload`, `StructuredMessage`, `AgentInfo` 등
- [ ] CLI 리팩터링
  - `packages/cli/src/utils/stdin-utils.ts`의 `StructuredContextPayload` 제거
  - SDK의 `StructuredPayload` import 사용
  - 관련 함수들 업데이트

**타입 구조** (Requirements 문서 기준):
```typescript
export interface StructuredPayload {
  version: string;
  agent: {
    id: string;
    provider: string;
    mode: 'query' | 'execute';
    model?: string;
  };
  prompt: string;
  context?: string;
  messages: StructuredMessage[];
  metadata: {
    generatedAt: string;
    messageCount: number;
    originalContext?: string;
    platform: string;
    threadId?: string;
    callStack?: CallStackFrame[];  // WBS-8 통합
  };
}

export interface StructuredMessage {
  id: string;
  userId?: string;
  text: string;
  timestamp: string;
  isAssistant: boolean;
  metadata?: Record<string, any>;
}
```

**Phase 1.2: YAML 설정 로더 구현** (0.5일)
- [ ] `loadAgentConfigFromYaml()` 실제 구현
  - `js-yaml` 라이브러리 활용
  - YAML 문자열 → `CrewxAgentConfig` 변환
  - 스키마 검증 및 오류 처리
- [ ] `loadAgentConfigFromFile()` 추가 구현
  - 파일 경로 받아서 YAML 로딩
  - CLI에서 사용할 헬퍼 함수
- [ ] 타입 안전성 보장
  - YAML 구조 타입 정의
  - 런타임 검증 로직 추가

#### 산출물
- `packages/sdk/src/types/structured-payload.types.ts` (신규)
- `packages/sdk/src/config/yaml-loader.ts`
- `packages/sdk/tests/unit/config/yaml-loader.test.ts`
- `packages/sdk/tests/unit/types/structured-payload.test.ts` (신규)
- `agent-factory.ts` 업데이트 (placeholder 제거)
- CLI `stdin-utils.ts` 리팩터링

#### 수용 기준
- [ ] `StructuredPayload` SDK에서 export 됨
- [ ] CLI가 SDK 타입 사용
- [ ] Requirements 문서와 100% 일치
- [ ] `js-yaml.load()` 정상 작동
- [ ] 잘못된 YAML 입력 시 명확한 에러 메시지
- [ ] README 예시 코드 동작 검증
- [ ] 테스트 커버리지 90% 이상

---

### Phase 2: 병렬 실행 헬퍼 함수 구현 (Day 2)
**우선순위**: Medium

#### 작업 내용
- [ ] `runQueriesParallel()` 구현
  - `ParallelRunner` 기반
  - `AgentQueryRequest[]` 배열 처리
  - 동시성 제어 (concurrency 옵션)
- [ ] `runExecutesParallel()` 구현
  - `AgentExecuteRequest[]` 배열 처리
  - 타임아웃 및 재시도 정책
- [ ] `ParallelConfig` 인터페이스 정의
  - concurrency, timeout, retryPolicy 등
- [ ] 진행 상황 모니터링
  - `TaskLogStream` 또는 EventEmitter 활용

#### 산출물
- `packages/sdk/src/core/parallel/helpers.ts`
- `packages/sdk/tests/unit/core/parallel/helpers.test.ts`
- `index.ts` export 추가

#### 수용 기준
- [ ] requirements-monorepo.md 예시 코드 동작
- [ ] 동시성 제어 정확히 작동 (concurrency: 2 → 2개씩 실행)
- [ ] 에러 처리 및 부분 실패 처리
- [ ] 테스트 커버리지 85% 이상

---

### Phase 3: Security 모듈 검토 (⊘ 생략) (Day 2-3)
**우선순위**: Low
**상태**: ⊘ 미구현 (생략)

#### 검토 결과
- [x] **검토 완료**: security 디렉토리 불필요 결정
  - ✅ 요구사항 문서 재검토 완료
  - ✅ 코드베이스 분석 완료 (CLI에 이미 구현됨)

#### 생략 사유
1. **CLI 전용 기능**:
   - `BearerAuthGuard` 및 `AuthService`는 `packages/cli/src/guards/` 및 `packages/cli/src/services/`에 이미 존재
   - NestJS HTTP 컨트롤러 전용 (`@UseGuards` 데코레이터 사용)
   - MCP 서버 인증은 전송 계층 관심사

2. **SDK 철학과 불일치**:
   - SDK는 순수 비즈니스 로직 (AI 제공자, 대화 관리, 문서 로딩)
   - 인증/인가는 HTTP/WebSocket 전송 계층 관심사
   - 현재 CLI 구현이 올바른 책임 분리를 보여줌

3. **재사용성 낮음**:
   - SDK 사용자는 자체 인증 메커니즘을 가질 가능성 높음
   - 범용 `AuthGuard` 인터페이스는 불필요한 추상화 오버헤드

#### 완료된 조치
- [x] requirements-monorepo.md 업데이트 (security 섹션 CLI 전용으로 명시)
- [x] SDK 디렉토리 구조에서 security/ 제거
- [x] 예제 코드 정리 (AuthGuard/CrewXServer 예제 제거)

#### 참고 구현
- **CLI 구현 위치**:
  - `packages/cli/src/guards/bearer-auth.guard.ts`
  - `packages/cli/src/services/auth.service.ts`
  - `packages/cli/src/mcp.controller.ts` (사용 예시)

---

### Phase 4: MessageFormatter 고도화 (Day 3)
**우선순위**: Medium

#### 작업 내용
- [ ] Slack 전용 포맷터 개선
  - CLI의 `SlackMessageFormatter` 검토
  - SDK `BaseMessageFormatter` 확장 포인트 확인
- [ ] 플랫폼별 포맷팅 전략
  - Slack 이모지, Markdown 변환
  - CLI 터미널 색상 지원
  - 웹/API용 플레인 텍스트
- [ ] 타임스탬프 및 메타데이터 처리 개선
  - ISO 포맷, 상대 시간 표시
  - 사용자 ID, 에이전트 ID 표시 옵션

#### 산출물
- `packages/sdk/src/utils/base-message-formatter.ts` 개선
- CLI `SlackMessageFormatter` 리팩터링 검토
- 예제 코드 추가

#### 수용 기준
- [ ] 다양한 플랫폼 포맷 지원
- [ ] SDK README에 사용 예제 추가
- [ ] 기존 테스트 모두 통과

---

### Phase 5: 통합 검증 및 문서화 (Day 4)
**우선순위**: High

#### 작업 내용
- [ ] **전체 빌드 검증**
  - `npm run build` 성공
  - `npm run build --workspace @sowonai/crewx-sdk` 성공
  - `npm run build --workspace @sowonai/crewx-cli` 성공
- [ ] **전체 테스트 실행**
  - `npm run test:unit` 모두 통과
  - `npm run test:integration` 모두 통과
  - 테스트 커버리지 확인 (SDK 90%+, CLI 80%+)
- [ ] **README 예시 코드 검증**
  - requirements-monorepo.md 예시 실행
  - packages/sdk/README.md 예시 실행
  - 모든 예시가 실제 동작하는지 확인
- [ ] **문서 업데이트**
  - SDK README에 Phase 1-4 기능 추가
  - 마이그레이션 가이드 업데이트
  - CHANGELOG.md 작성

#### 산출물
- 검증 리포트
- 업데이트된 문서
- `WBS-10-COMPLETION-REPORT.md`

#### 수용 기준
- [ ] 모든 빌드 성공
- [ ] 모든 테스트 통과
- [ ] 문서와 코드 100% 일치
- [ ] SDK 완성도 100% 달성

---

## 📊 작업 분해 및 일정

| Phase | 작업 | 예상 시간 | 담당 에이전트 | 의존성 |
|-------|------|-----------|---------------|--------|
| 1.1 | StructuredPayload 타입 이동 | 0.5일 | @crewx_dev | 없음 |
| 1.2 | YAML 설정 로더 | 0.5일 | @crewx_dev | Phase 1.1 |
| 2 | 병렬 실행 헬퍼 | 1일 | @crewx_dev | Phase 1 |
| 3 | Security 모듈 | 0.5일 | @crewx_dev | Phase 1 (검토만) |
| 4 | MessageFormatter | 0.5일 | @crewx_dev | Phase 1-2 |
| 5 | 통합 검증 | 1일 | @crewx_qa_lead, @crewx_tester | Phase 1-4 완료 |

**총 예상 기간**: 3-4일 (병렬 작업 가능)

---

## 🎯 성공 지표

### 기술적 지표
- [ ] SDK 완성도: 100% (현재 85-90%)
- [ ] 테스트 커버리지: SDK 90%+, CLI 80%+
- [ ] 모든 공개 API 구현 완료
- [ ] Requirements와 코드 100% 일치

### 품질 지표
- [ ] 모든 빌드 성공
- [ ] 모든 테스트 통과
- [ ] README 예시 코드 모두 동작
- [ ] 문서와 코드 동기화

### 비즈니스 지표
- [ ] 배포 준비 완료
- [ ] CLA 체계 정비
- [ ] 커뮤니티 기여 가능 상태

---

## 🚨 리스크 및 대응

### 1. YAML 스키마 복잡도
**리스크**: YAML 구조가 복잡할 경우 검증 로직 어려움
**대응**:
- 단계별 검증 (필수 필드 → 선택 필드)
- 명확한 에러 메시지
- 기본값 제공

### 2. 병렬 실행 복잡도
**리스크**: 동시성 제어 및 에러 처리 복잡
**대응**:
- 기존 `ParallelRunner` 활용
- 단순한 API 설계 (복잡도 내부에 숨김)
- 충분한 테스트 케이스

### 3. Security 모듈 범위 불명확
**리스크**: 요구사항 해석 차이
**대응**:
- Phase 3 시작 전 명확히 확인
- 불필요하면 과감히 제거
- 문서 우선 업데이트

---

## 📦 최종 산출물

### 코드
- `packages/sdk/src/types/structured-payload.types.ts` (신규 - 핵심!)
- `packages/sdk/src/config/yaml-loader.ts`
- `packages/sdk/src/core/parallel/helpers.ts`
- `packages/sdk/src/security/` (조건부)
- 업데이트된 `index.ts` exports
- CLI `stdin-utils.ts` 리팩터링

### 테스트
- StructuredPayload 타입 테스트 (8+ 케이스)
- YAML 로더 테스트 (10+ 케이스)
- 병렬 헬퍼 테스트 (15+ 케이스)
- Security 테스트 (조건부)

### 문서
- `WBS-10-COMPLETION-REPORT.md`
- 업데이트된 SDK README (StructuredPayload API 추가)
- 업데이트된 requirements-monorepo.md
- 타입 마이그레이션 가이드 (CLI 개발자용)

---

## 🔄 이전 WBS와의 관계

- **WBS-8**: SDK 퍼블릭 API 정합성 복구 → WBS-10에서 미완성 API 완성
- **WBS-9**: SDK/CLI 공유 로직 통합 → WBS-10에서 SDK 독립성 강화
- **WBS-2**: SDK 패키지 분리 → WBS-10에서 최종 완성

---

## ✅ 완료 기준

1. **모든 Phase 완료** (1-5)
2. **빌드 및 테스트 성공**
3. **문서 100% 동기화**
4. **배포 준비 완료**

WBS-10 완료 시, SDK는 **프로덕션 배포 가능 상태**가 됨.
