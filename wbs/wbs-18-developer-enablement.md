# WBS-18 상세 계획 — Developer Enablement

## 개요
- **목표**: 스킬 제작자들이 CrewX SDK를 통해 YAML/코드 기반 에이전트를 손쉽게 개발·검증·배포하도록 도구와 문서를 제공한다.
- **범위**:
  - 검증/테스트 헬퍼와 샘플 스킬 제공
  - IDE/문서/튜토리얼 업데이트
  - 런타임 의존성 점검 및 배포 편의 기능(Docker 로드맵 포함)
- **완료 기준**:
  - SDK에 `validateSkillPackage`, `runSkillSmokeTest` 등 검증 API 추가
  - 예제 스킬 3종 및 튜토리얼, JSON Schema 기반 자동완성 제공
  - 런타임 의존성 검사/안내 출력 및 Docker 베이스 이미지 로드맵 문서화

## Phase 구성

### Phase 1 — 검증/테스트 헬퍼 (예상 3일)
- `packages/sdk/src/testing/skill-helpers.ts` 구현:
  - `validateSkillPackage(pkgPath, options)`
  - `runSkillSmokeTest(manifest, context)`
- Vitest/Jest용 모킹 util 제공 (`createMockSkillContext`)
- 테스트 케이스 추가 (`packages/sdk/tests/skills/validation.spec.ts`)
- **산출물**: 검증 API 코드, 테스트 리포트, 사용 가이드 초안

### Phase 2 — 샘플/문서/IDE 지원 (예상 4일)
- 예제 스킬 번들 3종 작성:
  - 기초 YAML 레이아웃 + Claude 스킬
  - 외부 API 호출 예시
  - 사용자 정의 레이아웃/문서 포함 패키지
- 튜토리얼/워크스루 문서 (`docs/skills/getting-started.md`)
- JSON Schema 기반 자동완성 스니펫 배포 (`.vscode/crewx-skills.code-snippets`)
- 웹/CLI 문서 업데이트 (`CREWX.md`, `packages/cli/README.md`)
- **산출물**: 샘플 리포지토리, 문서, IDE 스니펫

### Phase 3 — 런타임 의존성 & 배포 편의 (예상 5일)
- 런타임 체크 유틸 (`checkRuntimeRequirements`) 구현:
  - Python/Node 버전 감지, 미설치 시 설치 안내 메시지
  - 향후 자동 설치/스크립트 확장 포인트 정의
- Docker 베이스 이미지 로드맵 문서화:
  - 필수 의존성 리스트, 향후 OCI 이미지 설계 초안
  - PoC: Dockerfile 샘플 및 `crewxbundle dev --docker` 옵션 설계
- Marketplace 배포 체크리스트 문서화 (가격/라이선스 placeholder 포함)
- **산출물**: 런타임 체크 코드, 안내 메시지 템플릿, Docker 로드맵 문서, 체크리스트

## 리스크 및 대응
- **환경 다양성**: 런타임 체크를 권고 수준 메시지로 시작, 향후 자동화 옵션 추가.
- **샘플 유지보수 부담**: 샘플은 CI에서 smoke-test 실행, 업데이트 시 릴리즈 노트에 명시.
- **문서 분산 위험**: docs 내 skills 섹션을 단일 TOC로 정리, 변경 시 알림 시스템 적용.

## 커뮤니케이션 & 산출물 관리
- 진행 채널 `#wbs-18-devx`, 주간 데모(샘플 실행) 공유.
- SDK/CLI 릴리즈 노트에 새로운 DevX 기능 하이라이트.
- Developer portal 업데이트 체크리스트 유지, 마켓플레이스 론치 준비팀과 연동.
