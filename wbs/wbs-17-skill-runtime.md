# WBS-17: Skill Runtime & Package

> **목표**: Claude 스킬과 CrewX 에이전트를 결합한 실행 환경 및 패키지 포맷 정의
> **상태**: ⬜️ 대기
> **예상 소요**: 13일 (Phase 1-3)

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [Phase 구성](#phase-구성)
3. [리스크 및 대응](#리스크-및-대응)

---

## 프로젝트 개요

### 목표

- **SkillRuntime API 설계**: progressive disclosure 호환 로더
- **스킬 번들 시스템**: AppManifest + 리소스 생성/검증/서명
- **Registry Mock**: 향후 Marketplace/레지스트리 연동 준비

### 완료 기준

- ✅ SDK에서 `SkillRuntime` 제공
- ✅ AppManifest 스펙 및 번들 구조 문서화
- ✅ 검증 CLI 프로토타입 배포
- ✅ Mock Registry 스크립트 및 API 계약서 완성

---

## Phase 구성

### 일정: 13일

| Phase | 작업 | 소요 | 산출물 | 상세 문서 |
|-------|------|------|--------|-----------|
| Phase 1 | SkillRuntime 설계 | 4일 | 아키텍처, 인터페이스, PoC | [Phase 1 상세](wbs-17-phase-1-skill-runtime-design.md) |
| Phase 2 | AppManifest & 번들 빌더 | 5일 | Manifest 스펙, 빌더 CLI | [Phase 2 상세](wbs-17-phase-2-app-manifest-design.md) |
| Phase 3 | Registry Mock 및 E2E | 4일 | Mock Registry, E2E 테스트 | [Phase 3 상세](wbs-17-phase-3-e2e-test-outline.md) |

### Phase 1: SkillRuntime 설계 (4일)

**작업 내용**:
- progressive disclosure 플로우 정의
  - frontmatter 캐시, 본문/리소스 지연 로딩
- 실행 컨텍스트 인터페이스 설계
  - `SkillExecutionContext`, `SkillIoSchema`
- Claude API 어댑터 초안
  - `skills.md` frontmatter와 CrewX 레이아웃 매핑
- 스킬 소스 우선순위 규칙 설계
  - 기본 Claude Code `skills/` + 사용자 지정 경로 병합
  - 에이전트별 include/exclude 적용
- 보안/샌드박스 요구사항 정리

**산출물**:
- 아키텍처 다이어그램
- 인터페이스 정의
- PoC 코드

### Phase 2: AppManifest & 번들 빌더 (5일)

**작업 내용**:
- AppManifest 스펙 정의 (`manifest.yaml`)
  - `id`, `version`, `skillSources[]`, `skills[]`
  - `agents[]`, `dependencies`, `permissions`, `assets`
  - `runtimeRequirements` 섹션 (Python, Node, Docker 등)
    - 초기에는 안내 메시지용 메타데이터만 저장
- 번들 생성 파이프라인 구현
  - 디렉터리 구조 → `.cxa`(zip) 포맷 변환
  - 해시/서명 메타데이터 포함
  - `skills/` 디렉터리와 리소스 번들링
  - `crewxbundle build` CLI 프로토타입
- 검증/정적 분석 로직 (`validateBundle`)
- 테스트 케이스 포함

**산출물**:
- Manifest 스펙 문서
- 번들 빌더 CLI
- 검증 테스트

### Phase 3: Registry Mock 및 E2E (4일)

**작업 내용**:
- Mock Registry 스크립트(REST/CLI) 구현
- API 계약 문서화
- 업로드/버전 관리/권한 모델 설계 (placeholder)
- 설치/업데이트 워크플로우 프로토타입
  - `runtimeRequirements` 읽어서 필요 환경 안내
- E2E 테스트
  - 로컬 번들 → Mock 업로드 → 다른 워크스페이스에서 설치 → 실행

**산출물**:
- Registry Mock 스크립트
- API 계약서
- CLI 통합 PoC
- 테스트 로그

---

## 리스크 및 대응

### Claude API 변경 가능성
- **대응**: 어댑터를 인터페이스 기반으로 설계
- **대응**: 버전 필드를 AppManifest에 포함

### 보안/서명 요구
- **대응**: 초기엔 해시 검증으로 시작
- **대응**: Phase 3 후반에 서명 구조 초안 마련

### 배포 워크플로우 복잡성
- **대응**: Mock Registry로 UX 검증 후 실 서비스 설계
- **대응**: CLI에 `--dry-run` 옵션 제공

---

## 커뮤니케이션 & 산출물 관리

- 진행 채널: `#wbs-17-skill-runtime`
- 주 2회 스탠드업 노트 공유
- Manifest/번들 스펙은 RFC 방식으로 확정 후 docs에 반영
- E2E 테스트 로그와 샘플 번들은 `examples/skill-bundles/`에 보관

---

## 참고 문서

- [Phase 1: SkillRuntime Design](wbs-17-phase-1-skill-runtime-design.md)
- [Phase 2: AppManifest Design](wbs-17-phase-2-app-manifest-design.md)
- [Phase 3: E2E Test Outline](wbs-17-phase-3-e2e-test-outline.md)
- [Phase 3: Registry Mock Requirements](wbs-17-phase-3-registry-mock-requirements.md)
- [Phase 3: Registry Mock Design](wbs-17-phase-3-registry-mock-design.md)
