[← WBS 개요](../wbs.md)

# WBS-9 SDK/CLI 공유 로직 통합 고도화 상세 계획

> 상태 표시는 Phase 진행 시 `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `⚠️ 위험` 등으로 갱신해 주세요.

## 개요
- **목표**: CLI 전용으로 남아 있는 핵심 로직(Base Provider, Remote Agent, Parallel Runner 등)을 SDK로 승격해 재사용성을 높이고, Slack 포맷터/구조화 페이로드 등 공통 유틸을 체계화한다.
- **범위**:
  - 메시지 포맷팅 추상화 및 Slack 구현 리팩터링
  - 빌트인 AI 프로바이더 SDK 이전 및 Nest 의존성 제거
  - Remote Agent/Parallel 실행 로직의 SDK화와 CLI 어댑터 정리
  - MCP 툴에서 사용하는 순수 로직을 SDK 유틸로 이동
  - 전반적인 테스트/문서/마이그레이션 가이드 업데이트
- **선행 디펜던시**: WBS-2, WBS-3, WBS-8 완료 상태가 전제
- **결과물**: SDK 공개 API 확장, CLI 래퍼 최소화, 문서/테스트/마이그레이션 가이드

## Phase 1 — 메시지 포맷터 추상화 확보 (⬜️ 대기)
- SDK `packages/sdk/src/utils` 하위에 `base-message-formatter.ts`(가칭) 생성
  - 공통 포맷 함수, 플랫폼 전환 스위치, 메시지 안전성 검증 로직 포함
  - Vitest 단위 테스트 작성 (CLI/Slack 시나리오, 에지 케이스)
- CLI Slack 포맷터(`packages/cli/src/slack/formatters/message.formatter.ts`)는 SDK 베이스 상속하도록 리팩터링
  - Markdown→Slack 변환, 이모지 치환 등 채널 특화 로직만 남김
  - requirements-monorepo.md의 스펙에 따라 재사용 가능성 검증
- CLI/SDK 내 메시지 히스토리 사용처 업데이트 및 회귀 테스트

## Phase 2 — AI 프로바이더 베이스 및 빌트인 이전 (⬜️ 대기)
- `BaseAIProvider`를 SDK `core/providers`로 이동, Nest 의존성 제거
  - 로깅/툴콜/타임아웃/로그 파일 경로 등을 주입 가능한 전략 패턴으로 분리
  - CLI는 Nest `Injectable` 래퍼에서 필요한 주입/로그 설정 수행
- Claude/Copilot/Gemini/Codex 프로바이더 구현을 SDK로 이동
  - CLI 특화 추가 옵션은 어댑터 레이어에서 설정
  - CLI 서비스(`AIProviderService`)는 SDK 프로바이더 클래스를 사용하도록 변경
- SDK `index.ts`에 새로운 프로바이더 export 추가, 마이그레이션 노트 작성
- SDK/CLI 테스트 업데이트: Provider 가용성, 에러 파싱, 도구 호출 경로

## Phase 3 — 리모트 에이전트 매니저 추출 (⬜️ 대기)
- CLI `RemoteAgentService` 로직을 SDK `RemoteAgentManager`(가칭)로 재구성
  - Remote provider 설정 로딩 인터페이스 정의 (파일/메모리)
  - MCP HTTP 호출 인터페이스 추상화 (`RemoteTransport` 등)
  - 응답 정규화/URL 처리/툴 이름 매핑을 SDK에서 담당
- CLI는 Concrete 구현(AgentLoader, ConfigService, McpClientService)을 어댑터로 제공
- HTTP 및 file-based remote 시나리오에 대한 유닛 테스트/통합 테스트 작성
- requirements-monorepo.md 대비 기능 누락 여부 확인 및 문서화

## Phase 4 — 병렬 실행 러너 공용화 (✅ 완료)
- `ParallelProcessingService` 핵심 로직을 SDK `ParallelRunner`로 이동
  - 청크 처리, fail-fast, 타임아웃, 메트릭 산출을 순수 함수/클래스로 구성
  - Task/로그 연결 로직은 콜백(`onTaskStart`, `onTaskComplete`)으로 추상화
- CLI는 기존 TaskManagementService/AIService를 콜백으로 연결하는 래퍼 제공
- SDK 테스트: 다양한 동시성/실패 패턴/시간 측정 검증
- CLI 통합 테스트: 기존 기능 유지, 새로운 추상화와의 호환성 확인
- 예제/문서에 병렬 실행 API 사용법 추가

**Phase 4 완료 요약:** SDK ParallelRunner 구현, CLI ParallelProcessingService 콜백 연동, SDK/CLI 테스트 보강, 마이그레이션 가이드 작성

## Phase 5 — MCP 지원 유틸리티 정리 (⬜️ 대기)
- `CrewXTool` 내 순수 함수(구조화 페이로드, 보안 키 생성 등)를 SDK 유틸로 추출
- MCP 서버는 SDK 유틸을 사용하도록 리팩터링, Nest/MCP 어댑터만 CLI에 유지
- Remote/Parallel과 MCP 통합 경로 회귀 테스트 작성 (도구 호출 → 결과 파이프라인)
- MCP 문서/보안 주석 업데이트, 외부 소비자 가이드에 SDK 활용 예시 추가

## Phase 6 — 통합 검증 및 문서 업데이트 (⬜️ 대기)
- SDK/CLI 전체 테스트/빌드 스위트 실행 및 CI 파이프라인 업데이트
- 개발자 문서, requirements-monorepo.md, README 등에서 새 구조/확장 포인트 설명
- 마이그레이션 체크리스트/릴리즈 노트 초안 작성
- 주요 이해관계자 리뷰 및 최종 승인 절차 준비

## 리스크 및 대응
- **Nest 의존성 잔존**: 추상화가 미흡하면 SDK 소비자가 Nest를 강제하게 됨 → 모든 신규 SDK 클래스를 순수 TS로 설계하고, CLI는 어댑터에서 Nest 주입.
- **회귀 위험**: 프로바이더/원격/병렬 로직 이동 시 기존 CLI 기능이 깨질 수 있음 → Phase 별로 유닛 + 통합 테스트 보강, 테스트 우선 전략.
- **문서 부재**: SDK API 확장 시 외부 개발자 혼란 → Phase 6에서 문서/가이드/예제 선행 업데이트.

## 마일스톤
1. Phase 1-2 완료 → 프로바이더/포맷터 SDK화 골격 완성
2. Phase 3-4 완료 → 원격/병렬 기능 공용화
3. Phase 5-6 완료 → MCP·문서·릴리즈 준비 마무리
