[← WBS 개요](../wbs.md)

# WBS-8: SDK 퍼블릭 API 정합성 복구 작업 계획

## 목표
- `requirements-monorepo.md`에 명시된 `createCrewxAgent` 기반 SDK 사용 흐름을 실제 코드로 구현
- CLI와 SDK 간 네이밍, 의존성, 경로 매핑을 다시 정렬해 문서와 일치시키기
- 샘플 코드와 테스트를 통해 새로운 퍼블릭 API의 동작을 검증하고 문서화

## 선행 조건
- [x] WBS-1~WBS-7 기본 구조 및 파이프라인 완료
- [ ] CLI 패키지명/배포 전략 재검토 (WBS-3 산출물 확인 필요)
- [ ] SDK 내부 구조/도메인 모듈 최신 상태 정리 (`packages/sdk/src`)

## Phase 1: 현황 점검 및 요구사항 확정 (Day 1)

### 1.1 현행 코드 분석
- `packages/sdk/src/index.ts` 공개 API 확인 (`createCrewxAgent` 미구현 상태 기록)
- `packages/cli/src`에서 SDK가 실제로 사용하는 항목 목록화
- `requirements-monorepo.md`의 예제 및 API 계약 항목 추출 (이벤트 훅, call stack 지원 등)

### 1.2 격차 목록 정리
- 누락된 퍼블릭 API (`createCrewxAgent`, `onEvent`, `runQueriesParallel`, 등) 목록화
- CLI 패키지명(`@sowonai/crewx-cli`) ↔ 요구사항(`crewx`) 불일치 여부와 영향 범위 파악
- tsconfig path alias, package.json 의존성 프로토콜 변경 히스토리 수집

### 1.3 계획 승인 체크포인트
- ✅ 요구사항 대비 격차 레포트 초안 작성
- ✅ 관련 이해관계자(문서 작성자, CLI 담당)와 수정 범위 합의

## Phase 2: `createCrewxAgent` 설계 및 구현 (Day 2-4)

### 2.1 설계
- Agent 팩토리 책임 정의: 설정 로딩, 프로바이더 초기화, 이벤트 스트림 브릿지
- SDK 내 기존 모듈 재사용 전략 수립 (`ai-provider.interface`, `mention-parser`, `DocumentManager`)
- 이벤트 시스템 API 결정: `onEvent(eventName, listener)` 혹은 `EventEmitter` 반환

### 2.2 구현
- `packages/sdk/src/core/agent` (신규) 디렉터리 생성
  - `agent-factory.ts`: `createCrewxAgent` 실체
  - `agent-runtime.ts`: query/execute 래퍼
  - `event-bus.ts`: 내부 이벤트 브로커 (call stack, tool-call 등)
- 기존 CLI 코드에서 재사용 가능한 로직을 SDK로 이동/복사
- `index.ts`에 신규 모듈 export 추가

### 2.3 내부 의존성 정리
- CLI 전용 구현체와 충돌하지 않도록 인터페이스/어댑터 레이어 정의
- 필요 시 `packages/sdk/src/internal` 하위에 CLI 연동용 adapter 배치

### 2.4 수용 기준
- ✅ `createCrewxAgent` 호출 시 agent 인스턴스, `onEvent` 핸들러 제공
- ✅ call stack 업데이트 이벤트가 샘플 코드에서 출력됨
- ✅ SDK 단독으로 실행 가능한 샘플 (`examples/basic-agent.ts`) 작성

## Phase 3: CLI 네이밍/의존성 재정렬 (Day 4-5)

### 3.1 패키지 식별자 정리
- `packages/cli/package.json` 이름을 요구사항(`crewx`)과 일치하도록 조정 (필요 시 별도 publish 패키지 유지 전략 문서화)
- `@sowonai/crewx-sdk` workspace 의존성 복원 (`workspace:*` 프로토콜)
- 루트 `package.json` 스크립트와 CLI 배포 스크립트 업데이트

### 3.2 경로 alias 동기화
- `tsconfig.base.json`, `packages/cli/tsconfig.json`에서 `@sowonai/crewx-sdk`/`@sowonai/crewx-sdk/internal` 경로 재설정
- CLI 소스 import 경로 재검토, 신규 API (`createCrewxAgent`) 사용부 도입 여부 결정

### 3.3 회귀 방지
- 기존 CLI 배포/빌드 파이프라인(`npm run build:cli`, `npm run release`) 재검증
- 패키지 명 변경에 따른 README, 문서, 배포 스크립트 영향 반영

## Phase 4: 테스트 및 문서 동기화 (Day 5-6)

### 4.1 테스트 작성
- `packages/sdk/tests`에 `createCrewxAgent` 단위/통합 테스트 추가
  - 이벤트 구독, call stack 업데이트, `agent.execute` 흐름 검증
  - CLI 의존 로직은 mock으로 대체 (I/O 없는 순수 로직 우선)
- `examples/` 또는 `tests/integration`에 샘플 시나리오 작성

### 4.2 문서 업데이트
- `requirements-monorepo.md` 예제 코드 최신 구현과 일치하도록 수정
- `packages/sdk/README.md`에 신규 API 설명 및 사용 가이드 추가
- `CHANGELOG`/`RELEASE.md`에 변경사항 기록

### 4.3 품질 게이트
- ✅ `npm run build:sdk`, `npm run build:cli`, `npm run test:sdk` 통과
- ✅ 샘플 코드 실행 결과 캡처/로그 첨부
- ✅ 릴리즈 노트 초안 작성

## Phase 5: 검토 및 핸드오프 (Day 7)

### 5.1 코드 리뷰 일정
- 주요 모듈별 담당자 지정 (SDK 코어, CLI, 문서)
- 이벤트/팩토리 설계에 대한 아키텍처 리뷰 세션 진행

### 5.2 운영 전환
- 변경된 퍼블릭 API를 사용하는 CLI 브랜치/워크트리 업데이트
- 외부 소비자 영향 분석 (버전 범프 필요 여부 결정)

### 5.3 마무리 산출물
- ✅ 최종 작업 보고서
- ✅ 문서/테스트 링크 정리
- ✅ 후속 작업(To-do) 목록화 (예: remote agent 확장, SDK examples 샘플 확대)

---

## 체크리스트 요약
- [ ] `createCrewxAgent` 구현 및 export
- [ ] 이벤트 시스템 동작 검증
- [ ] CLI 패키지명/의존성 재조정
- [ ] 경로 alias/워크스페이스 설정 동기화
- [ ] SDK 테스트/문서 업데이트
- [ ] 빌드·테스트 파이프라인 통과
- [ ] 릴리즈 노트 및 후속 계획 정리
