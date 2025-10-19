# WBS-17 상세 계획 — Skill Runtime & Package

## 개요
- **목표**: Claude 스킬과 CrewX 에이전트를 결합한 실행 수명주기와 패키지(AppManifest) 포맷을 정의해 Marketplace 배포를 준비한다.
- **범위**:
  - SkillRuntime API 설계 및 progressive disclosure 호환 로더
  - 스킬 번들(AppManifest + 리소스) 생성/검증/서명 플로우
  - 레지스트리(Mock)와의 업로드/다운로드, 설치/업데이트 워크플로우
- **완료 기준**:
  - SDK에서 `SkillRuntime`, `SkillRegistryClient` 제공
  - AppManifest 스펙 및 번들 구조 문서화, 검증 CLI 프로토타입 배포
  - Mock Registry(E2E) 테스트로 업로드→설치→실행 시나리오 검증

## Phase 구성

### Phase 1 — SkillRuntime 설계 (예상 4일)
- progressive disclosure 플로우 정의: frontmatter 캐시, 본문/리소스 지연 로딩
- 실행 컨텍스트 인터페이스 설계 (`SkillExecutionContext`, `SkillIoSchema`)
- Claude API 어댑터 초안: `skills.md` frontmatter와 CrewX 레이아웃 매핑 전략
- 보안/샌드박스 요구사항 정리 (입력 검증, 실행 제한)
- **산출물**: 아키텍처 다이어그램, 인터페이스 정의, PoC 코드

### Phase 2 — AppManifest & 번들 빌더 (예상 5일)
- AppManifest 스펙 정의 (`manifest.yaml`):
  - `id`, `version`, `skills[]`, `agents[]`, `dependencies`, `permissions`, `assets`
- 번들 생성 파이프라인 구현:
  - 디렉터리 구조 → `.cxa`(zip) 포맷 변환
  - 해시/서명 메타데이터 포함
  - `crewxbundle build` CLI 프로토타입
- 검증/정적 분석 로직 (`validateBundle`) 작성, 테스트 케이스 포함
- **산출물**: Manifest 스펙 문서, 번들 빌더 CLI, 검증 테스트

### Phase 3 — Registry 연동 및 E2E (예상 6일)
- Mock Registry 서버 구현 (REST/gRPC 선택) 및 `SkillRegistryClient` 추가
- 업로드/버전 관리/권한 모델 설계 (private/public, license, pricing placeholder)
- CLI 설치/업데이트 워크플로우 (`crewxbundle install/update`) 초안
- E2E 테스트: 로컬 번들 → 업로드 → 다른 워크스페이스에서 설치 → 실행
- **산출물**: Registry Mock 서버, SDK 클라이언트, CLI 통합, 테스트 레포트

## 리스크 및 대응
- **Claude API 변경 가능성**: 어댑터를 인터페이스 기반으로 설계하고 버전 필드를 AppManifest에 포함.
- **보안/서명 요구**: 초기엔 해시 검증으로 시작, Phase 3 후반에 서명 구조 초안 마련.
- **배포 워크플로우 복잡성**: Mock Registry로 UX 검증 후 실 서비스 설계, CLI에는 `--dry-run` 옵션 제공.

## 커뮤니케이션 & 산출물 관리
- 진행 채널 `#wbs-17-skill-runtime`, 주 2회 스탠드업 노트 공유.
- Manifest/번들 스펙은 RFC 방식으로 확정 후 docs에 반영.
- E2E 테스트 로그와 샘플 번들은 `examples/skill-bundles/`에 보관.
