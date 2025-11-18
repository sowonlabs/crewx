# WBS-32: Project Templates System (crewx template)

> **목표**: `crewx template` 서브커맨드 기반 프로젝트 스캐폴딩 시스템
> **상태**: 🟡 진행중
> **우선순위**: P0
> **예상 소요**: 2-3일 (AI 작업 기준, 12-16시간)
> **시작일**: 2025-01-18

---

## 📋 목차

1. [개요](#개요)
2. [핵심 전략](#핵심-전략)
3. [아키텍처](#아키텍처)
4. [Phase 구성](#phase-구성)
5. [Phase 1: CLI 명령어 구조](#phase-1-cli-명령어-구조-4-5시간)
6. [Phase 2: WBS Automation 템플릿](#phase-2-wbs-automation-템플릿-3-4시간)
7. [Phase 3: 추가 템플릿](#phase-3-추가-템플릿-3-4시간)
8. [Phase 4: 문서화](#phase-4-문서화-2-3시간)
9. [성공 기준 요약](#성공-기준-요약)

---

## 개요

### 배경
- **문제**: 마켓플레이스(WBS-31) 완성 전까지 CrewX 프로젝트 시작이 어려움
- **해결**: `crewx template` 서브커맨드로 빈자리 메꾸기 + 개발자 생태계 구축

### 목표
1. **단기**: 마켓플레이스 완성 전까지 프로젝트 템플릿 제공
2. **중기**: 개발자들이 `template → develop → deploy` 워크플로우로 마켓플레이스 기여
3. **장기**: 마켓플레이스와 통합하여 완전한 생태계 구축

### npm create 대신 서브커맨드를 선택한 이유
- ✅ **단일 패키지**: 버전 싱크 문제 없음
- ✅ **CLI UX 일관성**: `crewx` 하나로 모든 작업
- ✅ **유지보수 편의성**: 템플릿을 `packages/cli/templates/` 안에 포함
- ✅ **확장성**: `crewx template list`, `show` 등 부가 기능 추가 쉬움
- ✅ **마켓플레이스 연결**: 자연스러운 전환 경로

---

## 핵심 전략

### 1. 개발자 vs 사용자 구분

```bash
# 🛠️ 개발자용 (Developer Mode)
crewx template init my-wbs-bot --template wbs-automation
# - crewx.yaml 편집 가능
# - 소스코드 전부 노출
# - 자유롭게 커스터마이징
# - crewx deploy → 마켓플레이스 배포 가능

# 👤 사용자용 (Consumer Mode) - WBS-31에서 제공
crewx install wbs-automation
# - 암호화된 패키지
# - 소스코드 숨김 (IP 보호)
# - 수정 불가, 사용만 가능
```

### 2. 생태계 플로우

```
개발자 워크플로우
  ↓
crewx template init → 커스터마이징 → 테스트 → crewx deploy
  ↓
마켓플레이스 (WBS-31)
  ↓
사용자 워크플로우
  ↓
crewx install → 즉시 사용 → crewx update
```

---

## 아키텍처

### 패키지 구조 (Monorepo 내부)

**실제 구현된 구조** (2025-11-18 기준):

```
packages/cli/
├── src/
│   ├── cli/
│   │   ├── template.handler.ts        # 통합 핸들러 (init, list, show)
│   │   └── templates.handler.ts       # 기존 파일 (별도 기능)
│   ├── services/
│   │   └── template.service.ts        # 템플릿 스캐폴딩 로직
│   └── utils/
│       └── template-processor.ts      # 템플릿 처리 유틸
│
└── templates/                          # 템플릿 파일들
    ├── agents/                         # 기존 에이전트 템플릿
    │   ├── minimal.yaml
    │   └── default.yaml
    ├── documents/                      # 기존 문서 템플릿
    │   └── crewx-manual.md
    ├── wbs-automation/                 # WBS 자동화 템플릿 ✅
    │   ├── crewx.yaml                  # 메타데이터 + 에이전트 설정
    │   ├── wbs.md
    │   ├── wbs-loop.sh
    │   └── README.md
    └── versions.json
```

**참고**:
- `docusaurus-admin`, `dev-team` 템플릿은 Phase 3에서 구현 예정이었으나 미구현
- 현재는 `wbs-automation` 템플릿만 완성되어 사용 가능

### 템플릿 메타데이터 (crewx.yaml에 포함)

**설계 결정**: 별도 `manifest.json` 없이 `crewx.yaml`에 메타데이터 통합

```yaml
# templates/wbs-automation/crewx.yaml
metadata:
  name: wbs-automation                    # 필수 - 템플릿 ID
  displayName: "WBS Automation"           # 필수 - 사용자용 이름
  description: "WBS 자동화 프로젝트 템플릿"  # 필수 - 설명
  version: "1.0.0"                        # 필수 - SemVer

# 기존 에이전트 설정
agents:
  - name: coordinator
    provider: cli/claude
    ...
```

**장점**:
- ✅ 단일 소스: crewx.yaml 하나로 메타데이터 + 에이전트 설정 관리
- ✅ YAML 파서 재사용: 이미 구현된 파서 활용
- ✅ 단순성: 초기 버전은 4개 필수 필드만 사용
- ✅ 확장성: 나중에 필요시 필드 추가 가능 (후방 호환)

### 기술 스택

**Dependencies** (모두 이미 설치됨):
- **yargs**: CLI 파싱
- **chalk**: 색상 출력
- **handlebars**: 템플릿 렌더링
- **js-yaml**: YAML 파싱
- **fs**: 파일 복사 (Node.js 내장)

---

## Phase 구성

**일정**: 2-3일 (AI 작업 기준)

| Phase | 작업 | 소요 | 산출물 |
|-------|------|------|--------|
| Phase 1 | CLI 명령어 구조 | 4-5시간 | `template` 서브커맨드 |
| Phase 1-1 | 명령어 스켈레톤 | 1.5시간 | 3개 명령어 인터페이스 |
| Phase 1-2 | TemplateService 핵심 | 2시간 | Service + 3개 메서드 |
| Phase 1-3 | 테스트 | 1시간 | 단위 테스트 |
| Phase 2 | WBS Automation 템플릿 | 3-4시간 | wbs-automation 완성 |
| Phase 2-1 | 템플릿 구조 | 1.5시간 | crewx.yaml + 기본 구조 |
| Phase 2-2 | 스크립트 & 문서 | 1.5시간 | wbs-loop.sh + README |
| Phase 2-3 | 통합 테스트 | 1시간 | 템플릿 검증 |
| Phase 3 | 추가 템플릿 | 3-4시간 | docusaurus, dev-team |
| Phase 4 | 문서화 | 2-3시간 | E2E 테스트, 가이드 |

---

## Phase 1: CLI 명령어 구조 (4-5시간)

### Phase 1-1: 명령어 스켈레톤 (1.5시간)

**세부 작업**:
- yargs 서브커맨드 등록 (30분)
  - `packages/cli/src/commands/template/index.ts` 생성
  - yargs builder에 template 서브커맨드 추가
- 3개 명령어 핸들러 스텁 (45분)
  - `init.command.ts`: 프로젝트 생성 핸들러
  - `list.command.ts`: 템플릿 목록 핸들러
  - `show.command.ts`: 템플릿 상세 핸들러
- CLI 옵션 정의 (15분)
  - init: `--template`, `--name` 옵션
  - show: `<template-name>` 인자

**성공 기준**:
- ✅ `crewx template --help` 동작
- ✅ 3개 서브커맨드 인식

### Phase 1-2: TemplateService 핵심 (2시간)

**세부 작업**:
- TemplateService 클래스 골격 (30분)
  - `packages/cli/src/services/template.service.ts` 생성
  - 5개 메서드 시그니처 정의
- copyTemplate() 구현 (45분)
  - fs로 템플릿 디렉토리 복사
  - .gitignore, node_modules 제외
- renderHandlebars() 구현 (45분)
  - Handlebars 렌더링 로직
  - 변수 치환 (project_name, author, date)

**성공 기준**:
- ✅ 템플릿 복사 동작
- ✅ Handlebars 변수 치환 동작

### Phase 1-3: 테스트 (1시간)

**세부 작업**:
- TemplateService 단위 테스트 (45분)
  - copyTemplate() 테스트
  - renderHandlebars() 테스트
- CLI 통합 테스트 (15분)
  - `crewx template init` 전체 플로우 테스트

**성공 기준**:
- ✅ 단위 테스트 통과
- ✅ 통합 테스트 통과

---

## Phase 2: WBS Automation 템플릿 (3-4시간)

### Phase 2-1: 템플릿 구조 (1.5시간)

**세부 작업**:
- 디렉토리 구조 생성 (15분)
  - `packages/cli/templates/wbs-automation/` 생성
- crewx.yaml 작성 (45분)
  - metadata 섹션 (name, displayName, description, version)
  - agents 섹션 (coordinator agent + CLI provider)
- wbs.md 템플릿 작성 (30분)
  - Handlebars 변수 ({{project_name}}, {{author}}, {{date}})
  - 기본 WBS 구조

**성공 기준**:
- ✅ crewx.yaml 메타데이터 완성
- ✅ wbs.md 템플릿 완성

### Phase 2-2: 스크립트 & 문서 (1.5시간)

**세부 작업**:
- wbs-loop.sh 작성 (45분)
  - git pull + crewx query 로직
  - 5분마다 WBS 체크 루프
- README.md 작성 (45분)
  - 설치 및 사용법
  - 환경 변수 설정 가이드
  - cron 설정 예시

**성공 기준**:
- ✅ wbs-loop.sh 실행 가능
- ✅ README.md 완성

### Phase 2-3: 통합 테스트 (1시간)

**세부 작업**:
- 템플릿 생성 테스트 (30분)
  - `crewx template init test-wbs --template wbs-automation`
  - 생성된 파일 검증
- 템플릿 실행 테스트 (30분)
  - wbs-loop.sh 동작 확인
  - Handlebars 변수 치환 확인

**성공 기준**:
- ✅ 템플릿 생성 동작
- ✅ 변수 치환 정상 동작

---

## Phase 3: 추가 템플릿 (3-4시간)

**⚠️ 실제 구현 상태**: **미구현** (Phase 3는 실제로 수행되지 않음)

**원래 계획된 작업**:
- docusaurus-admin 템플릿 (1.5시간)
  - crewx.yaml (docs-writer, docs-reviewer 에이전트)
  - 문서 빌드 스크립트
  - README 작성
- dev-team 템플릿 (1.5시간)
  - crewx.yaml (developer, reviewer, tester 에이전트)
  - PR 자동 리뷰 스크립트
  - README 작성
- 3개 템플릿 통합 테스트 (1시간)
  - 각 템플릿 생성 확인
  - 변수 치환 검증

**실제 완료 사항**:
- ❌ Docusaurus 템플릿 미구현
- ❌ Dev Team 템플릿 미구현
- ✅ 1개 템플릿만 동작 (wbs-automation만)

**참고**: Phase 3 로그는 2025-11-18 13:37-13:42 (5분)에 실행되었으나, 추가 템플릿 구현 대신 다른 작업 수행된 것으로 추정

---

## Phase 4: 문서화 (2-3시간)

**⚠️ 실제 구현 상태**: **일부 구현**

**원래 계획된 작업**:
- E2E 테스트 (1시간)
  - 전체 플로우 테스트 (init → build → run)
  - 3개 템플릿 모두 검증
- 템플릿 개발 가이드 (1시간)
  - 새 템플릿 만드는 방법
  - Handlebars 문법 설명
  - 메타데이터 스키마
- 사용자 가이드 (1시간)
  - `crewx template` 명령어 레퍼런스
  - 각 템플릿 사용법
  - Troubleshooting

**실제 완료 사항**:
- ✅ E2E 테스트 구현 (`packages/cli/tests/e2e/template.e2e.spec.ts`)
  - wbs-automation 템플릿 테스트만 구현
  - docusaurus-admin, dev-team 테스트 코드는 있으나 실제 템플릿 미구현
- ❌ 템플릿 개발 가이드 미작성
- ❌ 사용자 가이드 미작성

**실제 소요**: 2025-11-18 13:41-13:47 (6분)

---

## 성공 기준 요약

**원래 계획된 완료 조건**:
- ✅ 모든 Phase 완료
- ✅ 3개 템플릿 (wbs-automation, docusaurus-admin, dev-team) 작동 확인
- ✅ 전체 테스트 통과율 90% 이상
- ✅ 문서화 완료 (사용자 가이드, 개발자 가이드)

**실제 달성 상황** (2025-11-18 기준):
- ✅ Phase 1 완료 (CLI 명령어 구조)
- ✅ Phase 2 완료 (WBS Automation 템플릿)
- ⚠️ Phase 3 미완료 (추가 템플릿 미구현)
- ⚠️ Phase 4 부분 완료 (E2E 테스트만, 문서 미작성)
- ✅ **1개 템플릿** 작동 확인 (wbs-automation만)
- ✅ E2E 테스트 통과 (wbs-automation 템플릿)
- ❌ 문서화 미완료 (개발자 가이드, 사용자 가이드 미작성)

**MVP 성공 기준** (실용적 목표):
- ✅ `crewx template init` 명령어 동작
- ✅ wbs-automation 템플릿 사용 가능
- ✅ E2E 테스트 통과
- ⚠️ 추가 템플릿 및 문서화는 향후 개선 필요

---

## 참고 문서

- [Phase 1: CLI 명령어 구조](wbs-32-phase-1-cli-structure.md)
- [Phase 2: WBS Automation 템플릿](wbs-32-phase-2-wbs-template.md)
- [Phase 3: 추가 템플릿](wbs-32-phase-3-additional-templates.md)
- [Phase 4: 테스트 & 문서화](wbs-32-phase-4-testing-docs.md)
- [Commander.js 문서](https://github.com/tj/commander.js)
- [Inquirer.js 문서](https://github.com/SBoudrias/Inquirer.js)
- [Handlebars 문서](https://handlebarsjs.com/)
