# WBS-32: Project Templates System (crewx template)

> **목표**: Git 기반 템플릿 저장소 시스템 (현재 디렉토리에 템플릿 받아오기)
> **상태**: 🟡 진행중
> **우선순위**: P0
> **예상 소요**: 2-3일 (AI 작업 기준, 10-13시간)
> **시작일**: 2025-11-16
> **Phase 2 리젝일**: 2025-11-18 (설계 변경)

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
- **해결**: Git 기반 템플릿 저장소로 빠른 프로젝트 시작 지원

### 목표
1. **단기**: Git 저장소에서 템플릿을 현재 디렉토리로 받아오기
2. **중기**: 개발자들이 템플릿 저장소를 직접 관리하고 공유
3. **장기**: 마켓플레이스와 통합하여 완전한 생태계 구축

### 핵심 설계 변경 (2025-11-18)
**기존 구현** (리젝됨):
```bash
crewx template init test-wbs --template wbs-automation
# → test-wbs/ 디렉토리 생성 후 템플릿 복사
```

**새로운 설계**:
```bash
# 현재 디렉토리에 템플릿 받아오기
crewx template init wbs-automation
# → ./ (현재 디렉토리)에 템플릿 파일들 생성

# Git 저장소에서 받아오기 (기본)
CREWX_TEMPLATE_GIT=https://github.com/crewx-templates/official.git \
  crewx template init wbs-automation

# 로컬 템플릿 테스트
CREWX_TEMPLATE_LOCAL=/path/to/templates \
  crewx template init wbs-automation
```

**변경 이유**:
- ✅ **사용 편의성**: 디렉토리 이름 고민 불필요
- ✅ **Git 워크플로우 친화적**: 현재 디렉토리 = Git 저장소 루트
- ✅ **템플릿 중앙 관리**: Git 저장소로 버전 관리
- ✅ **확장성**: 여러 템플릿 저장소 지원 가능

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

**일정**: 2-3일 (AI 작업 기준, 설계 변경 후)

| Phase | 작업 | 소요 | 산출물 | 상태 |
|-------|------|------|--------|------|
| Phase 1 | CLI 명령어 구조 | 4-5시간 | `template` 서브커맨드 | ✅ 완료 |
| Phase 2 | 현재 디렉토리 템플릿 init | 3-4시간 | 현재 디렉토리 초기화 | ❌ 리젝 |
| Phase 3 | Git 기반 템플릿 저장소 | 2-3시간 | Git clone + 템플릿 적용 | ⬜️ 대기 |
| Phase 3-1 | Git 저장소 clone | 1시간 | TemplateGitService | ⬜️ |
| Phase 3-2 | 템플릿 파일 복사 | 1시간 | 현재 디렉토리에 복사 | ⬜️ |
| Phase 3-3 | Handlebars 렌더링 | 0.5시간 | 변수 치환 | ⬜️ |
| Phase 4 | 로컬/원격 템플릿 병행 | 1-2시간 | 환경변수 기반 전환 | ⬜️ 대기 |
| Phase 4-1 | 환경변수 처리 | 0.5시간 | CREWX_TEMPLATE_* | ⬜️ |
| Phase 4-2 | 로컬 템플릿 지원 | 0.5시간 | 로컬 경로 처리 | ⬜️ |
| Phase 5 | 문서화 및 테스트 | 2-3시간 | E2E 테스트, 가이드 | ⬜️ 대기 |

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

## Phase 2: 현재 디렉토리 템플릿 init (❌ 리젝됨)

**리젝 이유** (2025-11-18):
- **설계 오류**: 프로젝트명을 받아서 하위 디렉토리 생성하는 방식
- **의도와 불일치**: 현재 디렉토리에 직접 템플릿 파일 생성해야 함
- **Git 워크플로우 불편**: 별도 디렉토리 생성으로 Git 초기화 복잡

**기존 구현** (잘못됨):
```bash
crewx template init test-wbs --template wbs-automation
# → test-wbs/ 디렉토리 생성 후 템플릿 복사
```

**올바른 설계**:
```bash
mkdir my-wbs-bot && cd my-wbs-bot
crewx template init wbs-automation
# → ./ (현재 디렉토리)에 템플릿 파일들 생성
```

**Phase 3, 4로 재설계됨**

---

## Phase 3: Git 기반 템플릿 저장소 지원 (2-3시간)

**목표**: Git 저장소에서 템플릿을 clone하여 현재 디렉토리에 적용

### Phase 3-1: Git 저장소 clone (1시간)

**세부 작업**:
- TemplateGitService 생성 (30분)
  - `packages/cli/src/services/template-git.service.ts`
  - Git clone 로직 (`simple-git` 또는 `child_process`)
  - 임시 디렉토리 관리
- 환경변수 처리 (15분)
  - `CREWX_TEMPLATE_GIT` 읽기
  - 기본값: `https://github.com/crewx-templates/official.git`
- 템플릿 디렉토리 탐색 (15분)
  - Clone된 저장소에서 템플릿명 폴더 찾기
  - 예: `wbs-automation/` 디렉토리

**성공 기준**:
- ✅ Git 저장소 clone 성공
- ✅ 템플릿 디렉토리 찾기 성공
- ✅ 임시 디렉토리 정리

### Phase 3-2: 템플릿 파일 복사 (1시간)

**세부 작업**:
- 현재 디렉토리에 복사 (30분)
  - Clone된 템플릿 파일들을 `./` (현재 디렉토리)에 복사
  - `.git`, `node_modules` 제외
  - 숨김 파일 포함 (`.gitignore`, `.env.example` 등)
- 덮어쓰기 방지 (15분)
  - 현재 디렉토리가 비어있지 않으면 경고
  - `--force` 옵션으로 강제 허용
- 에러 처리 (15분)
  - 템플릿 없을 때 에러 메시지
  - Git clone 실패 시 fallback

**성공 기준**:
- ✅ 현재 디렉토리에 템플릿 파일 복사
- ✅ 덮어쓰기 방지 동작
- ✅ 명확한 에러 메시지

### Phase 3-3: Handlebars 변수 렌더링 (0.5시간)

**세부 작업**:
- 변수 수집 (15분)
  - 현재 디렉토리명 → `project_name`
  - Git 사용자명 → `author`
  - 현재 날짜 → `date`
- Handlebars 렌더링 (15분)
  - 모든 파일 순회하며 `{{변수}}` 치환
  - 바이너리 파일 제외

**성공 기준**:
- ✅ 변수 치환 동작
- ✅ 프로젝트명 자동 설정

---

## Phase 4: 로컬/원격 템플릿 병행 지원 (1-2시간)

**목표**: 개발/테스트 시 로컬 템플릿 사용 가능하도록 환경변수 지원

### Phase 4-1: 환경변수 처리 (0.5시간)

**세부 작업**:
- 환경변수 우선순위 설정 (15분)
  ```typescript
  // 1. CREWX_TEMPLATE_LOCAL (로컬 경로 - 테스트용)
  // 2. CREWX_TEMPLATE_GIT (Git 저장소 URL)
  // 3. 기본값: https://github.com/crewx-templates/official.git
  ```
- Config 로딩 로직 (15분)
  - `getTemplateSource()` 메서드 구현
  - 환경변수 검증

**성공 기준**:
- ✅ 환경변수 우선순위 동작
- ✅ 명확한 에러 메시지

### Phase 4-2: 로컬 템플릿 지원 (0.5시간)

**세부 작업**:
- 로컬 경로 처리 (15분)
  - `CREWX_TEMPLATE_LOCAL=/path/to/templates` 지원
  - 절대 경로/상대 경로 모두 지원
- 로컬 템플릿 검증 (15분)
  - 경로 존재 여부 확인
  - 템플릿 디렉토리 존재 확인

**성공 기준**:
- ✅ 로컬 템플릿 로딩 동작
- ✅ 개발/테스트 편의성

**사용 예시**:
```bash
# 로컬 템플릿으로 테스트
CREWX_TEMPLATE_LOCAL=./packages/cli/templates \
  crewx template init wbs-automation

# 다른 Git 저장소 사용
CREWX_TEMPLATE_GIT=https://github.com/myorg/my-templates.git \
  crewx template init custom-template

# 기본 저장소 사용
crewx template init wbs-automation
```

---

## Phase 5: 문서화 및 테스트 (2-3시간)

**목표**: E2E 테스트 작성 및 사용자 가이드 문서화

### Phase 5-1: E2E 테스트 (1시간)

**세부 작업**:
- Git 템플릿 테스트 (30분)
  - Git clone 테스트
  - 현재 디렉토리 복사 테스트
  - 덮어쓰기 방지 테스트
- 로컬 템플릿 테스트 (15분)
  - 로컬 경로 로딩 테스트
- Handlebars 렌더링 테스트 (15분)
  - 변수 치환 검증

**성공 기준**:
- ✅ 모든 E2E 테스트 통과
- ✅ 테스트 커버리지 80% 이상

### Phase 5-2: 사용자 가이드 작성 (1시간)

**세부 작업**:
- 명령어 레퍼런스 (30분)
  - `crewx template init <template-name>`
  - 환경변수 설명
  - 옵션 설명 (`--force`)
- 사용 예시 (30분)
  - wbs-automation 템플릿 사용법
  - 커스텀 템플릿 저장소 만들기
  - Troubleshooting

**성공 기준**:
- ✅ 사용자 가이드 완성
- ✅ 예시 코드 검증

### Phase 5-3: 템플릿 개발 가이드 (1시간)

**세부 작업**:
- 템플릿 구조 설명 (30분)
  - 필수 파일 (`crewx.yaml`, `README.md`)
  - Handlebars 변수 사용법
  - 메타데이터 스키마
- 템플릿 저장소 만들기 (30분)
  - Git 저장소 구조
  - 여러 템플릿 관리 방법
  - 버전 관리 전략

**성공 기준**:
- ✅ 개발자 가이드 완성
- ✅ 템플릿 저장소 예시

---

## 성공 기준 요약

**새로운 설계 목표** (2025-11-18 설계 변경 후):
- ✅ Phase 1 완료 (CLI 명령어 구조)
- ❌ Phase 2 리젝 (설계 변경)
- ⬜️ Phase 3 대기 (Git 기반 템플릿 저장소)
- ⬜️ Phase 4 대기 (로컬/원격 병행 지원)
- ⬜️ Phase 5 대기 (문서화 및 테스트)

**완료 조건** (재정의):
1. **기본 기능**:
   - ✅ `crewx template init <template-name>` 명령어 동작
   - ⬜️ 현재 디렉토리에 템플릿 파일 생성
   - ⬜️ Git 저장소에서 템플릿 clone
   - ⬜️ Handlebars 변수 치환

2. **환경변수 지원**:
   - ⬜️ `CREWX_TEMPLATE_GIT` 지원 (기본 저장소 변경)
   - ⬜️ `CREWX_TEMPLATE_LOCAL` 지원 (로컬 템플릿 테스트)

3. **테스트 및 문서**:
   - ⬜️ E2E 테스트 통과
   - ⬜️ 사용자 가이드 작성
   - ⬜️ 템플릿 개발 가이드 작성

**MVP 성공 기준**:
- ⬜️ Git 저장소에서 템플릿 받아오기 동작
- ⬜️ 현재 디렉토리에 템플릿 생성 동작
- ⬜️ 로컬 템플릿으로 테스트 가능
- ⬜️ 1개 이상의 템플릿 사용 가능 (wbs-automation)

**Phase 2 리젝 사유**:
- ❌ 프로젝트명 받아서 하위 디렉토리 생성 (잘못된 설계)
- ✅ 현재 디렉토리에 직접 템플릿 생성 (올바른 설계)
- ✅ Git 기반 템플릿 저장소 (확장성)

---

## 참고 문서

- [Phase 1: CLI 명령어 구조](wbs-32-phase-1-cli-structure.md)
- [Phase 2: WBS Automation 템플릿](wbs-32-phase-2-wbs-template.md)
- [Phase 3: 추가 템플릿](wbs-32-phase-3-additional-templates.md)
- [Phase 4: 테스트 & 문서화](wbs-32-phase-4-testing-docs.md)
- [Commander.js 문서](https://github.com/tj/commander.js)
- [Inquirer.js 문서](https://github.com/SBoudrias/Inquirer.js)
- [Handlebars 문서](https://handlebarsjs.com/)
