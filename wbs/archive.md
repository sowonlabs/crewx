[← WBS 개요](../wbs.md)

# WBS 아카이브 (1-10)

| ID | 상태 | 핵심 결과 | 주요 산출물 |
| -- | ---- | --------- | ----------- |
| WBS-1 | ✅ 완료 | 모노레포 워크스페이스·빌드 기반 확립 | 루트 `package.json`, `tsconfig.base.json`, 초기 빌드 스크립트 |
| WBS-2 | ✅ 완료 | SDK 패키지 분리 및 API 정비 | `packages/sdk/`, 공개 API 축소, Apache-2.0/CLA 적용 |
| WBS-3 | ✅ 완료 | CLI 전용 패키지 구조화 | `packages/cli/`, Slack 통합 재정비, 배포 스크립트 |
| WBS-4 | ✅ 완료 | 테스트/QA 체계 재편 | Vitest 환경, 커버리지 파이프라인, CI 통합 |
| WBS-5 | ✅ 완료 | 빌드·릴리즈 자동화 정비 | Changesets, CI/CD 워크플로우, RELEASE 가이드 |
| WBS-6 | ✅ 완료 | 문서·개발자 가이드 완성 | 루트/SDK/CLI README 개편, 마이그레이션 가이드 |
| WBS-7 | ✅ 완료 | 운영·거버넌스 체계 구축 | CONTRIBUTING, CODE_OF_CONDUCT, PR/ISSUE 템플릿 |
| WBS-8 | ✅ 완료 | SDK 퍼블릭 API 정합성 회복 | `createCrewxAgent`, 이벤트 시스템, 예제/테스트 |
| WBS-9 | ✅ 완료 | SDK/CLI 공유 로직 통합 | MessageFormatter, RemoteAgentManager, 통합 가이드 |
| WBS-10 | ✅ 완료 | SDK 최종 기능 보강 | YAML 로더, 병렬 헬퍼, CHANGELOG, 회귀 테스트 |

## WBS-1 모노레포 스켈레톤 구축
- Workspace 구성, 공통 설정 공유, 빌드/테스트 스모크까지 완료하여 이후 작업 기반 확보.

## WBS-2 SDK 패키지 분리
- SDK 디렉터리 정비, Provider 인터페이스 확립, 공용 API 축소 및 라이선스 정리.
- 📄 상세 계획: [wbs-2-sdk-plan.md](wbs-2-sdk-plan.md)
- 📄 Phase 4 보고서: [wbs-2-phase4-summary.md](wbs-2-phase4-summary.md)

## WBS-3 CLI 패키지 정리
- CLI 핸들러/플랫폼 코드 분리, Slack·배포 스크립트 재정비, 워크스페이스 의존성 전환.
- 📄 상세 계획: [wbs-3-cli-plan.md](wbs-3-cli-plan.md)

## WBS-4 테스트·QA 재편
- 패키지별 테스트 환경 분리, 커버리지/CI 파이프라인 구축, 테스트 케이스 정돈.
- 📄 상세 계획: [wbs-4-test-plan.md](wbs-4-test-plan.md)

## WBS-5 빌드·릴리즈 파이프라인 정비
- Changesets 기반 버전 관리, GitHub Actions 빌드·릴리즈 파이프라인 구성.
- 📄 상세 계획: [wbs-5-build-plan.md](wbs-5-build-plan.md)
- 📄 완료 보고서: [WBS-5-SUMMARY.md](WBS-5-SUMMARY.md)
- 📄 진행 스레드: [WBS-5-THREAD-SUMMARY.md](WBS-5-THREAD-SUMMARY.md)

## WBS-6 문서·개발자 가이드 업데이트
- README·가이드 전면 개편, API 레퍼런스와 마이그레이션 문서화.
- 📄 상세 계획: [wbs-6-docs-plan.md](wbs-6-docs-plan.md)

## WBS-7 운영·거버넌스 준비
- 라이선스/CLA, 버전 정책, 기여 프로세스 및 커뮤니티 가이드라인 정립.
- 📄 상세 계획: [wbs-7-governance-plan.md](wbs-7-governance-plan.md)

## WBS-8 SDK 퍼블릭 API 정합성 복구
- `createCrewxAgent`와 이벤트 버스 구현, 테스트·예제·문서 동기화로 요구사항 충족.
- 📄 상세 계획: [wbs-8-sdk-plan.md](wbs-8-sdk-plan.md)
- 📄 완료 보고서: [wbs-8-summary.md](wbs-8-summary.md)

## WBS-9 SDK/CLI 공유 로직 통합 고도화
- 공통 포맷터/프로바이더/리모트 매니저 통합, 마이그레이션 가이드 제공으로 재사용성 극대화.
- 📄 상세 계획: [wbs-9-shared-plan.md](wbs-9-shared-plan.md)
- 📄 Phase 1 보고서: [WBS-9-PHASE1-SUMMARY.md](WBS-9-PHASE1-SUMMARY.md)
- 📄 완료 보고서: [wbs-9-summary.md](wbs-9-summary.md)

## WBS-10 SDK 완성도 향상 및 누락 기능 구현
- YAML 로더/병렬 헬퍼 완성, MessageFormatter 고도화, 회귀 테스트와 문서 갱신으로 출시 준비 완료.
- 📄 상세 계획: [wbs-10-sdk-completion.md](wbs-10-sdk-completion.md)
- 📄 Phase 5 보고서: [wbs-10-summary.md](wbs-10-summary.md)
