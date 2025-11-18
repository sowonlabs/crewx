# WBS-32: Project Templates System (crewx template)

> **목표**: Git 기반 템플릿 저장소 시스템 (현재 디렉토리에 템플릿 받아오기)
> **상태**: 🟡 진행중 (Phase 3 구현)
> **우선순위**: P0
> **예상 소요**: 2시간 (Phase 3 MVP만)
> **시작일**: 2025-11-16
> **Phase 2 리젝일**: 2025-11-18 (설계 변경)
> **Phase 3 설계 완료**: 2025-11-18

---

## 🎯 핵심 의사결정 요약

| 항목 | 결정 사항 | 비고 |
|------|----------|------|
| **라이브러리** | `giget` (UnJS) | Git CLI 불필요, tarball API 사용 |
| **기본 저장소** | `https://github.com/sowonlabs/crewx-templates` | 공식 템플릿 저장소 |
| **환경변수** | `CREWX_TEMPLATE_REPO` | 퍼블릭 GitHub 저장소만 지원 |
| **Phase 3 범위** | giget + 환경변수만 | 2시간 구현 목표 |
| **Phase 6 이동** | Registry, --from, Handlebars, simple-git | 선택사항 (4-5시간) |
| **회사 사용** | 공식 템플릿 fork → 커스터마이징 → 환경변수로 사용 | 소스 공개 (퍼블릭 GitHub) |

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

**Phase 2 리젝** → **Phase 3 MVP 설계**:

**기존 구현** (리젝됨):
```bash
crewx template init test-wbs --template wbs-automation
# → test-wbs/ 디렉토리 생성 후 템플릿 복사 (로컬 파일 복사)
```

**최종 설계** (MVP):
```bash
# 기본 사용 (sowonlabs 공식 저장소)
mkdir my-wbs-bot && cd my-wbs-bot
crewx template init wbs-automation
# → giget으로 GitHub에서 다운로드 (Git CLI 불필요)

# 커스텀 저장소 사용 (회사/개인 템플릿)
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation
# → 회사가 fork한 템플릿 저장소에서 다운로드
```

**핵심 의사결정**:
1. ✅ **라이브러리**: `giget` (UnJS) - Git CLI 불필요, tarball API 사용
2. ✅ **기본 저장소**: `https://github.com/sowonlabs/crewx-templates`
3. ✅ **환경변수**: `CREWX_TEMPLATE_REPO` (퍼블릭 GitHub 저장소만)
4. ❌ **제외 (Phase 6 이동)**: registry.json, Handlebars, --from 옵션, simple-git

**회사 사용 시나리오**:
```bash
# 1. 공식 템플릿 fork
git clone https://github.com/sowonlabs/crewx-templates
cd crewx-templates
# 2. 회사 표준에 맞게 커스터마이징
# 3. 회사 GitHub에 push
git push https://github.com/mycompany/crewx-templates

# 4. 신입 개발자 온보딩
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation
# → 회사 커스텀 템플릿으로 프로젝트 시작
```

**변경 이유**:
- ✅ **사용 편의성**: 디렉토리 이름 고민 불필요
- ✅ **Git 워크플로우 친화적**: 현재 디렉토리 = Git 저장소 루트
- ✅ **템플릿 중앙 관리**: Git 저장소로 버전 관리
- ✅ **확장성**: 환경변수로 저장소 변경 가능 (회사/개인)
- ✅ **단순성**: MVP는 giget + 환경변수만 (Registry는 Phase 6)

---

## 핵심 전략

### 1. 개발자 vs 사용자 구분

```bash
# 🛠️ 개발자용 (Developer Mode)
crewx template init wbs-automation
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

**일정**: 3-4시간 (AI 작업 기준, MVP만)

| Phase | 작업 | 소요 | 산출물 | 상태 |
|-------|------|------|--------|------|
| Phase 1 | CLI 명령어 구조 | 4-5시간 | `template` 서브커맨드 | ✅ 완료 |
| Phase 2 | 현재 디렉토리 템플릿 init | 3-4시간 | 현재 디렉토리 초기화 | ❌ 리젝 |
| **Phase 3** | **Git 템플릿 다운로드 (MVP)** | **2시간** | **giget + 환경변수** | **✅ 완료** |
| Phase 3-1 | giget 통합 | 1시간 | TemplateService 업데이트 | ✅ |
| Phase 3-2 | CLI 명령어 연결 | 30분 | handleTemplateInit 수정 | ✅ |
| Phase 3-3 | 테스트 및 검증 | 30분 | 기본/환경변수 테스트 | ✅ |
| **Phase 4** | **템플릿 저장소 구성** | **1-1.5시간** | **crewx-templates repo** | **⬜️ 대기** |
| Phase 4-1 | 저장소 초기화 | 15분 | Git 저장소 + 구조 | ⬜️ |
| Phase 4-2 | wbs-automation 템플릿 | 30-45분 | 6개 템플릿 파일 | ⬜️ |
| Phase 4-3 | 저장소 마무리 | 15분 | README + push | ⬜️ |
| **Phase 5** | **문서화** | **30분** | **사용자 가이드** | **✅ 완료** |
| Phase 5-1 | 사용자 가이드 | 30분 | project-templates.md | ✅ |

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

## Phase 3: Git 기반 템플릿 저장소 지원 (2-3시간) - MVP

**목표**: Git 저장소에서 템플릿을 다운로드하여 현재 디렉토리에 적용

**기술 스택**: `giget` (UnJS) - Git CLI 불필요, tarball API 사용

**기본 저장소**: `https://github.com/sowonlabs/crewx-templates`

**환경변수 지원**: `CREWX_TEMPLATE_REPO` (퍼블릭 GitHub 저장소만)

### 구현 전략

**Phase 3 (MVP)**: 기본 Git 다운로드만 구현
- ✅ **선택된 라이브러리**: `giget` (UnJS)
  - Git CLI 불필요 (tarball API 사용)
  - 최신 유지보수 (2024년 활발)
  - GitHub/GitLab/Bitbucket 지원
  - 서브디렉토리 추출 지원
- ✅ **기본 저장소**: `https://github.com/sowonlabs/crewx-templates`
- ✅ **환경변수**: `CREWX_TEMPLATE_REPO` (퍼블릭 GitHub만)
- ❌ **제외**: registry.json, Handlebars, --from 옵션

**사용 예시**:

```bash
# 기본 사용 (sowonlabs 저장소)
mkdir my-wbs-bot && cd my-wbs-bot
crewx template init wbs-automation

# 커스텀 저장소 사용 (회사/개인 템플릿)
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation
```

---

### Phase 3-1: giget 통합 및 기본 다운로드 (1시간)

**세부 작업**:
- giget 패키지 설치 (5분)
  - `npm install giget --save`
- TemplateService 업데이트 (30분)
  - `packages/cli/src/services/template.service.ts`
  - giget의 `downloadTemplate()` 함수 사용
  - GitHub tarball API로 다운로드 (Git CLI 불필요)
- 환경변수 처리 (15분)
  - `CREWX_TEMPLATE_REPO` 읽기
  - 기본값: `https://github.com/sowonlabs/crewx-templates`
  - URL → giget source 형식 변환
- 에러 처리 (10분)
  - 템플릿 없을 때 에러 메시지
  - 네트워크 에러 처리

**구현 예시**:
```typescript
import { downloadTemplate } from 'giget'

@Injectable()
export class TemplateService {
  private readonly DEFAULT_REPO = 'https://github.com/sowonlabs/crewx-templates'

  async scaffoldProject(templateName: string, targetDir: string): Promise<void> {
    const repo = process.env.CREWX_TEMPLATE_REPO || this.DEFAULT_REPO
    const source = `github:${this.parseGitHubUrl(repo)}/${templateName}`

    await downloadTemplate(source, {
      dir: targetDir,
      force: true,
    })

    console.log(`✅ Template downloaded: ${templateName}`)
  }

  private parseGitHubUrl(url: string): string {
    // https://github.com/sowonlabs/crewx-templates → sowonlabs/crewx-templates
    return url.replace('https://github.com/', '')
  }
}
```

**성공 기준**:
- ✅ giget으로 템플릿 다운로드 성공
- ✅ 환경변수 처리 동작
- ✅ 에러 메시지 명확

### Phase 3-2: CLI 명령어 연결 (30분)

**세부 작업**:
- template.handler.ts 업데이트 (20분)
  - `handleTemplateInit()` 함수 수정
  - 현재 디렉토리를 targetDir로 전달
  - 성공 메시지 출력
- 사용 예시 출력 (10분)
  - 환경변수 설정 방법 안내
  - 기본 저장소 정보 표시

**구현 예시**:
```typescript
async function handleTemplateInit(templateService: TemplateService, args: CliOptions) {
  const templateName = args.templateName || process.argv[4]

  if (!templateName) {
    console.error('❌ Error: Template name is required')
    console.log('Usage: crewx template init <template-name>')
    process.exit(1)
  }

  console.log(`\n📦 Downloading template: ${templateName}`)

  const repo = process.env.CREWX_TEMPLATE_REPO ||
    'https://github.com/sowonlabs/crewx-templates'
  console.log(`📋 Repository: ${repo}\n`)

  await templateService.scaffoldProject(templateName, process.cwd())

  console.log(`\n✅ Template initialized successfully!`)
  console.log(`\nNext steps:`)
  console.log(`  # Edit crewx.yaml to configure your agents`)
  console.log(`  # Run your project\n`)
}
```

**성공 기준**:
- ✅ 현재 디렉토리에 템플릿 다운로드
- ✅ 명확한 성공 메시지
- ✅ 환경변수 정보 표시

### Phase 3-3: 테스트 및 검증 (30분)

**세부 작업**:
- 기본 동작 테스트 (15분)
  - 빈 디렉토리에서 `crewx template init wbs-automation` 실행
  - 파일 생성 확인
- 환경변수 테스트 (15분)
  - `CREWX_TEMPLATE_REPO` 설정 후 테스트
  - 다른 GitHub 저장소에서 다운로드 확인

**성공 기준**:
- ✅ 기본 저장소에서 템플릿 다운로드 동작
- ✅ 환경변수로 저장소 변경 동작
- ✅ 에러 처리 정상 동작

**참고**: Handlebars 변수 치환과 --from 옵션은 Phase 6으로 이동 (선택사항)

---

## Phase 4: 템플릿 저장소 구성 (1-1.5시간)

> 📄 상세 문서: [wbs/wbs-32-phase-4-template-repo.md](wbs-32-phase-4-template-repo.md)

**목표**: GitHub에 실제 템플릿 저장소 구성 (wbs-automation 템플릿 포함)

**저장소**: `https://github.com/sowonlabs/crewx-templates`
**로컬 경로**: `/Users/doha/git/crewx-templates`

### Phase 4-1: 저장소 초기화 (15분)

**세부 작업**:
- 로컬 프로젝트 생성 (5분)
  - `cd /Users/doha/git && mkdir crewx-templates && cd crewx-templates`
  - `git init`
- 기본 구조 생성 (5분)
  - `mkdir -p wbs-automation/.claude/skills/crewx-wbs`
  - `touch README.md`
- Git 설정 및 첫 커밋 (5분)
  - `git remote add origin https://github.com/sowonlabs/crewx-templates.git`
  - 첫 커밋 및 push

**성공 기준**:
- ✅ `/Users/doha/git/crewx-templates` 디렉토리 생성
- ✅ Git 저장소 초기화
- ✅ GitHub 연결

### Phase 4-2: wbs-automation 템플릿 구성 (30-45분)

**🌎 중요**: 미국 시장을 타겟으로 하므로 **모든 파일을 영어로 작성**해야 합니다.
- README.md, wbs.md, crewx.yaml의 system_prompt, 코멘트, 설명 등 모두 영어
- 한국어는 사용하지 않음
- 영어권 사용자가 읽고 수정할 수 있어야 함

**템플릿 파일 8개**:

1. **crewx.yaml** (10분)
   - 소스: `/Users/doha/git/crewx/crewx.wbs.yaml`
   - 수정: `metadata` 섹션 추가, `working_directory` 제거

2. **wbs.md** (10분)
   - 빈 템플릿 구조 제공 (사용자가 채울 수 있게)

3. **wbs-loop.sh** (5분)
   - 소스: `/Users/doha/git/crewx/wbs-loop.sh` 그대로 복사

4. **README.md** (10분)
   - 템플릿 사용 가이드 작성

5. **.claude/skills/crewx-wbs/SKILL.md** (2분)
   - 소스: `/Users/doha/git/crewx/.claude/skills/crewx-wbs/SKILL.md` 복사
   - 클로드코드와 wbs 작성시 도움

6. **.claude/skills/crewx/SKILL.md** (2분)
   - 소스: `/Users/doha/git/crewx/.claude/skills/crewx/SKILL.md` 복사
   - CrewX 전반적인 사용법 도움

7. **wbs-progress.log**, **wbs-errors.log** (1분)
   - 빈 파일 생성 (로그 예시)

**성공 기준**:
- ✅ 모든 파일 생성 완료 (8개)
- ✅ crewx.yaml에 metadata 포함
- ✅ README.md 사용 가이드 완성
- ✅ 두 가지 스킬 포함 (crewx-wbs + crewx)

### Phase 4-3: 저장소 마무리 (15분)

**세부 작업**:
- 루트 README.md 작성 (10분)
  - 템플릿 저장소 소개
  - 회사 템플릿 fork 가이드
  - 템플릿 작성 가이드
- Git 커밋 및 Push (5분)
  - `git add . && git commit -m "feat: add wbs-automation template"`
  - `git push`

**성공 기준**:
- ✅ 루트 README.md 작성 완료
- ✅ GitHub에 push 완료
- ✅ `https://github.com/sowonlabs/crewx-templates` 접속 가능

---

## Phase 5: 문서화 (30분)

**목표**: 기본 테스트 및 사용자 가이드 문서화

### Phase 5-1: 기본 테스트 (30분)

**세부 작업**:
- 수동 테스트 (30분)
  - 기본 동작 확인: `crewx template init wbs-automation`
  - 환경변수 테스트: `CREWX_TEMPLATE_REPO` 설정 후 테스트
  - 에러 케이스 확인

**성공 기준**:
- ✅ 기본 저장소에서 다운로드 동작
- ✅ 환경변수로 저장소 변경 동작
- ✅ 에러 메시지 명확

### Phase 5-2: 사용자 가이드 작성 (30분-1시간)

**세부 작업**:
- 명령어 레퍼런스 (15분)
  - `crewx template init <template-name>`
  - 환경변수 설명 (`CREWX_TEMPLATE_REPO`)
- 사용 예시 (15분)
  - wbs-automation 템플릿 사용법
  - 회사 템플릿 저장소 사용법
- Troubleshooting (선택, 15분)
  - 네트워크 에러 해결
  - 템플릿 없을 때 대처법

**성공 기준**:
- ✅ 사용자 가이드 완성
- ✅ 예시 코드 동작 확인

---

## 성공 기준 요약

**최종 설계 목표** (2025-11-18 설계 완료):
- ✅ Phase 1 완료 (CLI 명령어 구조)
- ❌ Phase 2 리젝 (설계 변경)
- ⬜️ **Phase 3 준비완료** (Git 템플릿 다운로드 - MVP, 2시간)
- ⬜️ Phase 5 대기 (문서화 및 테스트, 1-2시간)

**MVP 완료 조건** (Phase 3 + 5):

1. **Phase 3: 핵심 기능 구현** (2시간)
   - ⬜️ giget 패키지 설치
   - ⬜️ TemplateService 업데이트 (giget 통합)
   - ⬜️ 환경변수 처리 (`CREWX_TEMPLATE_REPO`)
   - ⬜️ CLI 명령어 연결 (handleTemplateInit 수정)
   - ⬜️ 현재 디렉토리에 템플릿 다운로드

2. **Phase 5: 테스트 및 문서** (1-2시간)
   - ⬜️ 기본 동작 테스트
   - ⬜️ 환경변수 테스트
   - ⬜️ 사용자 가이드 작성

**사용자 시나리오**:
```bash
# 기본 사용 (sowonlabs 저장소)
mkdir my-wbs-bot && cd my-wbs-bot
crewx template init wbs-automation

# 커스텀 저장소 사용
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation
```

**제외된 기능** (향후 구현 시 별도 WBS):
- ❌ Template Registry (registry.json, crewx config)
- ❌ --from 옵션 (직접 URL 지정)
- ❌ Handlebars 변수 치환
- ❌ Self-hosted Git 지원 (simple-git)

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
