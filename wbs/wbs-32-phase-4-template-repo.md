# WBS-32 Phase 4: 템플릿 저장소 구성

> **목표**: `https://github.com/sowonlabs/crewx-templates` 저장소에 wbs-automation 템플릿 구성
> **상태**: ⬜️ 대기
> **예상 소요**: 1-1.5시간
> **저장소**: `/Users/doha/git/crewx-templates`

---

## 개요

### 배경
- Phase 3에서 giget으로 GitHub 저장소에서 템플릿을 다운로드하는 구조 구현 완료
- 실제 템플릿 파일들을 담을 GitHub 저장소 필요
- CrewX 프로젝트에서 실제로 사용 중인 WBS 자동화 구조를 템플릿으로 제공

### 목표
1. **단기**: wbs-automation 템플릿 1개 완성
2. **중기**: 회사/개인이 fork해서 커스터마이징 가능한 구조
3. **장기**: 커뮤니티 템플릿 기여 생태계

---

## 템플릿 저장소 구조

### 디렉토리 레이아웃

```
crewx-templates/
├── README.md                    # 템플릿 저장소 소개
├── templates.json               # ⭐ 템플릿 레지스트리 (목록 관리)
├── crewx.yaml                   # ⭐ 템플릿 관리자 에이전트
├── .claude/
│   └── skills/
│       └── crewx-template-manager/
│           └── SKILL.md         # ⭐ 템플릿 관리 스킬
├── wbs-automation/              # WBS 자동화 템플릿
│   ├── crewx.yaml              # 메타데이터 + coordinator 에이전트 설정
│   ├── wbs.md                  # WBS 템플릿 (비어있는 구조)
│   ├── wbs-loop.sh            # 자동화 루프 스크립트
│   ├── wbs-progress.log       # 진행 로그 (빈 파일)
│   ├── wbs-errors.log         # 에러 로그 (빈 파일)
│   ├── .gitignore             # Git 무시 파일
│   ├── README.md              # 템플릿 사용 가이드
│   └── .claude/
│       └── skills/
│           ├── crewx-wbs/
│           │   └── SKILL.md   # WBS 작성 스킬
│           └── crewx/
│               └── SKILL.md   # CrewX 사용법 스킬
└── (future templates)/
    ├── docusaurus-admin/
    └── dev-team/
```

---

## Phase 4-1: 저장소 초기화 (15분)

### 세부 작업

1. **로컬 프로젝트 생성** (5분)
   ```bash
   cd /Users/doha/git
   mkdir crewx-templates && cd crewx-templates
   git init
   ```

2. **기본 구조 생성** (5분)
   ```bash
   mkdir -p wbs-automation/.claude/skills/crewx-wbs
   mkdir -p wbs-automation/.claude/skills/crewx
   mkdir -p .claude/skills/crewx-template-manager
   touch README.md
   touch templates.json
   touch crewx.yaml
   ```

3. **Git 설정 및 첫 커밋** (5분)
   ```bash
   git remote add origin https://github.com/sowonlabs/crewx-templates.git
   git add .
   git commit -m "chore: initialize crewx-templates repository"
   git push -u origin main
   ```

**성공 기준**:
- ✅ `/Users/doha/git/crewx-templates` 디렉토리 생성
- ✅ Git 저장소 초기화
- ✅ GitHub 연결

---

## Phase 4-2: wbs-automation 템플릿 구성 (30-45분)

**🌎 중요**: 미국 시장을 타겟으로 하므로 **모든 파일을 영어로 작성**해야 합니다.
- README.md, wbs.md, 코멘트, 설명 등 모두 영어
- 한국어는 사용하지 않음

### 파일별 작업

#### 1. crewx.yaml (10분)

**소스**: `/Users/doha/git/crewx/crewx.wbs.yaml`

**수정 사항**:
- `metadata` 섹션 추가
- `working_directory` 제거 (사용자 환경에서 자동 설정)
- `env.CONTEXT_THREAD` 변수 설명 추가
- **system_prompt를 영어로 번역** (영어권 사용자가 수정 가능하도록)

```yaml
metadata:
  name: "wbs-automation"
  displayName: "WBS Automation"
  description: "WBS (Work Breakdown Structure) 기반 프로젝트 자동화 템플릿"
  version: "1.0.0"

agents:
  - id: "coordinator"
    name: "WBS Coordinator"
    role: "coordinator"
    # ... (기존 설정 유지)
```

#### 2. wbs.md (10분)

**소스**: `/Users/doha/git/crewx/wbs.md` 구조 참고

**내용**: 빈 템플릿 구조 제공
```markdown
# 프로젝트 WBS

> 상태: `⬜️ 대기`, `🟡 진행중`, `✅ 완료`, `⏸️ 보류`

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [진행 현황](#진행-현황)

---

## 프로젝트 개요

**목표**: [프로젝트 목표를 입력하세요]

**배경**: [프로젝트 배경을 설명하세요]

**기술 스택**: [사용 기술 나열]

---

## 진행 현황

| 상태 | ID | 작업명 | 산출물 | 소요 | 우선순위 |
|-----|-----|--------|--------|------|---------|
| ⬜️ | WBS-1 | [작업명] | [산출물] | N일 | P0 |

---

## WBS-1: [작업명] (⬜️ 대기)
> 📄 [wbs/wbs-1-작업명.md](wbs/wbs-1-작업명.md)

**목표**: [한 줄로 핵심 목표]

**예상 소요**: X일

**Phase 진행 상황**:
- [ ] Phase 1: [Phase명] (X시간)
- [ ] Phase 2: [Phase명] (X시간)

---
```

#### 3. wbs-loop.sh (5분)

**소스**: `/Users/doha/git/crewx/wbs-loop.sh` 그대로 복사

**주의**: 경로나 환경변수 하드코딩 없는지 확인

#### 4. README.md (10분)

**템플릿 사용 가이드 작성** (영어):

```markdown
# WBS Automation Template

WBS (Work Breakdown Structure) 기반 프로젝트 자동화 템플릿입니다.

## 🚀 빠른 시작

```bash
# 1. 프로젝트 디렉토리 생성
mkdir my-wbs-project && cd my-wbs-project

# 2. 템플릿 다운로드
crewx template init wbs-automation

# 3. WBS 설정 (wbs.md 편집)
# 프로젝트 목표, 작업 항목 정의

# 4. 자동화 실행
./wbs-loop.sh
```

## 📦 포함 파일

- `crewx.yaml` - Coordinator 에이전트 설정
- `wbs.md` - WBS 문서 템플릿
- `wbs-loop.sh` - 자동화 루프 스크립트
- `.claude/skills/crewx-wbs/` - WBS 관리 스킬

## 🛠️ 설정

### Coordinator 에이전트

Coordinator는 wbs.md를 읽고 미완료 작업을 자동으로 진행합니다.

**동작 방식**:
1. wbs.md 읽기
2. 미완료 Phase 확인
3. 독립적인 Phase들 병렬 실행
4. wbs.md 완료 처리 및 시간 추적

### 환경변수

스크립트에서 사용하는 환경변수:
- `CONTEXT_THREAD` - 작업 컨텍스트 공유용 thread ID
- `CREWX_CMD` - CrewX 명령어 경로 (기본: `crewx`)
- `MAX_LOOPS` - 최대 루프 횟수 (기본: 24)
- `SLEEP_TIME` - 루프 간격 초 (기본: 3600 = 1시간)

## 📚 사용법

### WBS 문서 작성

1. `wbs.md` 상단 표에 작업 목록 작성
2. 각 작업마다 상세 섹션 추가
3. Phase 단위로 작업 분해

### 자동화 실행

```bash
# 기본 실행 (24시간, 1시간 간격)
./wbs-loop.sh

# 테스트 모드 (3회, 5분 간격)
./wbs-loop.sh --test

# 커스텀 설정
./wbs-loop.sh --loops 10 --sleep 1800
```

## 🔧 커스터마이징

### 에이전트 추가

`crewx.yaml`에 개발팀 에이전트 추가:

```yaml
agents:
  - id: "my_dev"
    name: "My Developer"
    inline:
      type: "agent"
      provider: "cli/claude"
      model: "sonnet"
      prompt: |
        You are a developer...
```

### WBS 스킬 활용

`.claude/skills/crewx-wbs/SKILL.md`는 WBS 작성 가이드를 제공합니다.
Claude Code에서 자동으로 감지됩니다.

## 📖 참고 문서

- [CrewX Documentation](https://github.com/sowonlabs/crewx)
- [WBS Best Practices](../docs/wbs-guide.md)
```

#### 5. .gitignore (3분)

```gitignore
# Logs
*.log
wbs-progress.log
wbs-errors.log

# CrewX
.crewx/

# Node modules (if any)
node_modules/

# OS
.DS_Store
Thumbs.db
```

#### 6. .claude/skills/crewx-wbs/SKILL.md (2분)

**소스**: `/Users/doha/git/crewx/.claude/skills/crewx-wbs/SKILL.md` 그대로 복사

**목적**: WBS 작성 및 관리 가이드 제공

#### 7. .claude/skills/crewx/SKILL.md (2분)

**소스**: `/Users/doha/git/crewx/.claude/skills/crewx/SKILL.md` 그대로 복사

**목적**: CrewX 프레임워크 사용법 및 명령어 레퍼런스 제공

**중요성**:
- wbs-automation은 CrewX 기반 템플릿이므로 필수
- 사용자가 `crewx q`, `crewx execute` 등 명령어를 이해해야 함
- Agent 설정, YAML 구성 방법 참조 가능

#### 8. 로그 파일 (1분)

**파일**:
- `wbs-progress.log` - 빈 파일
- `wbs-errors.log` - 빈 파일

**목적**: 로그 파일 예시 제공

**성공 기준**:
- ✅ 모든 파일 생성 완료 (8개)
- ✅ crewx.yaml에 metadata 포함
- ✅ wbs.md 템플릿 구조 제공
- ✅ README.md 사용 가이드 완성
- ✅ **두 가지 스킬 포함** (crewx-wbs + crewx)

---

## Phase 4-3: 저장소 마무리 (20-25분)

### 1. templates.json 작성 (5분)

**템플릿 레지스트리** - `crewx template list`가 읽는 파일

```json
{
  "version": "1.0.0",
  "templates": [
    {
      "name": "wbs-automation",
      "displayName": "WBS Automation",
      "description": "WBS (Work Breakdown Structure) 기반 프로젝트 자동화 템플릿",
      "version": "1.0.0",
      "path": "wbs-automation",
      "author": "SowonLabs",
      "tags": ["automation", "wbs", "project-management", "coordinator"],
      "crewxVersion": ">=0.3.0",
      "features": [
        "Coordinator agent for automatic task execution",
        "Phase-based parallel execution",
        "Git-based time tracking",
        "1-hour interval automation loop"
      ]
    }
  ]
}
```

**필드 설명**:
- `name`: 템플릿 ID (디렉토리명과 일치)
- `displayName`: 사용자용 이름
- `description`: 한 줄 설명
- `version`: 템플릿 버전 (SemVer)
- `path`: 템플릿 디렉토리 경로
- `author`: 작성자
- `tags`: 검색용 태그
- `crewxVersion`: 요구 CrewX 버전
- `features`: 주요 기능 목록

### 2. 루트 crewx.yaml 작성 (5분)

**템플릿 관리자 에이전트** - 템플릿 추가/검증 자동화

```yaml
agents:
  - id: "template_manager"
    name: "Template Manager"
    role: "template_manager"
    description: "CrewX template repository manager - validates, adds, and maintains templates"
    inline:
      type: "agent"
      provider: "cli/claude"
      model: "sonnet"
      prompt: |
        You are the Template Manager for the CrewX templates repository.

        ## Your Responsibilities

        1. **Add New Templates**:
           - Create template directory structure
           - Generate crewx.yaml with metadata
           - Update templates.json registry
           - Create README stub

        2. **Validate Templates**:
           - Check crewx.yaml has required metadata fields
           - Verify all referenced files exist
           - Ensure README is present
           - Validate templates.json consistency

        3. **Update Registry**:
           - Keep templates.json synchronized
           - Generate template listings
           - Update documentation

        ## Usage Examples

        Add new template:
        ```bash
        crewx execute "@template_manager Add new template: docusaurus-admin with description: 'Documentation site management template'"
        ```

        Validate all templates:
        ```bash
        crewx query "@template_manager Validate all templates and report any issues"
        ```

        Update templates.json:
        ```bash
        crewx execute "@template_manager Sync templates.json with current templates"
        ```
```

### 3. .claude/skills/crewx-template-manager/SKILL.md 작성 (5분)

**템플릿 관리 가이드**

```markdown
---
name: crewx-template-manager
description: Guide for managing CrewX template repository. Activate when adding, validating, or maintaining templates.
---

# CrewX Template Manager

You are an expert on managing the CrewX templates repository.

## When to Use This Skill

Activate when:
- Adding new templates
- Validating existing templates
- Updating templates.json
- Creating template documentation
- Checking template structure

## Template Structure Requirements

### Required Files

Every template must have:
1. **crewx.yaml** with metadata section
2. **README.md** with usage guide
3. **Entry in templates.json**

### crewx.yaml Metadata

```yaml
metadata:
  name: "template-name"        # Template ID (matches directory)
  displayName: "Template Name" # User-friendly name
  description: "Description"   # One-line description
  version: "1.0.0"             # SemVer

agents:
  # Agent configurations
```

### templates.json Entry

```json
{
  "name": "template-name",
  "displayName": "Template Name",
  "description": "Description",
  "version": "1.0.0",
  "path": "template-name",
  "author": "Author Name",
  "tags": ["tag1", "tag2"],
  "crewxVersion": ">=0.3.0",
  "features": ["Feature 1", "Feature 2"]
}
```

## Validation Checklist

- [ ] Template directory exists
- [ ] crewx.yaml present with metadata
- [ ] README.md present
- [ ] templates.json includes entry
- [ ] Metadata name matches directory name
- [ ] All referenced files exist
- [ ] No broken links in README

## Adding New Template

Steps:
1. Create template directory: `mkdir template-name`
2. Create crewx.yaml with metadata
3. Create README.md with usage guide
4. Add entry to templates.json
5. Test: `crewx template init template-name`
```

### 4. 루트 README.md 작성 (10분)

```markdown
# CrewX Templates

공식 CrewX 프로젝트 템플릿 저장소입니다.

## 📦 사용 가능한 템플릿

### wbs-automation
WBS 기반 프로젝트 자동화 템플릿

**사용법**:
```bash
mkdir my-project && cd my-project
crewx template init wbs-automation
```

**특징**:
- Coordinator 에이전트로 자동 작업 진행
- Phase 단위 병렬 실행
- Git 기반 시간 추적
- 1시간 간격 자동 루프

[상세 가이드 →](./wbs-automation/README.md)

---

## 🏢 회사/개인 템플릿 저장소 만들기

### 1. Fork & Clone

```bash
git clone https://github.com/sowonlabs/crewx-templates
cd crewx-templates
```

### 2. 커스터마이징

- `wbs-automation/crewx.yaml` - 에이전트 설정 수정
- `wbs-automation/wbs.md` - 회사 표준 WBS 구조
- 새 템플릿 추가: `my-company-template/`

### 3. 회사 저장소에 Push

```bash
git remote set-url origin https://github.com/mycompany/crewx-templates
git push
```

### 4. 팀원들이 사용

```bash
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation
```

---

## 🤖 템플릿 관리자 에이전트

이 저장소에는 템플릿 추가/검증을 자동화하는 에이전트가 포함되어 있습니다!

### 새 템플릿 추가

```bash
# 템플릿 저장소로 이동
cd crewx-templates

# 템플릿 관리자에게 요청
crewx execute "@template_manager Add new template: docusaurus-admin with description: 'Documentation site management template'"
```

**자동으로 수행**:
- 템플릿 디렉토리 생성
- `crewx.yaml` 생성 (metadata 포함)
- `README.md` stub 생성
- `templates.json` 업데이트

### 템플릿 검증

```bash
# 모든 템플릿 검증
crewx query "@template_manager Validate all templates and report any issues"

# templates.json 동기화
crewx execute "@template_manager Sync templates.json with current templates"
```

---

## 📝 수동 템플릿 작성 가이드

템플릿 관리자 없이 수동으로 추가하려면:

### 필수 파일

```
my-template/
├── crewx.yaml       # 필수: metadata + agents
├── README.md        # 필수: 사용 가이드
└── ...              # 템플릿 파일들
```

### 1. crewx.yaml 메타데이터

```yaml
metadata:
  name: "my-template"           # 템플릿 ID (영문, 하이픈 가능)
  displayName: "My Template"    # 사용자용 이름
  description: "템플릿 설명"
  version: "1.0.0"              # SemVer

agents:
  - id: "my_agent"
    # ... 에이전트 설정
```

### 2. templates.json 업데이트

```json
{
  "name": "my-template",
  "displayName": "My Template",
  "description": "템플릿 설명",
  "version": "1.0.0",
  "path": "my-template",
  "author": "Your Name",
  "tags": ["category", "feature"],
  "crewxVersion": ">=0.3.0",
  "features": ["Feature 1", "Feature 2"]
}
```

### 3. 템플릿 등록

1. 템플릿 디렉토리 생성
2. `crewx.yaml` 작성 (metadata 필수)
3. `README.md` 작성
4. `templates.json`에 항목 추가
5. Git commit & push

---

## 🤝 기여하기

커뮤니티 템플릿 기여를 환영합니다!

1. Fork this repository
2. Create your template
3. Submit a Pull Request

**요구사항**:
- `metadata` 섹션 포함된 `crewx.yaml`
- 사용 가이드 포함된 `README.md`
- 명확한 템플릿 설명

---

## 📄 라이선스

MIT License - 자유롭게 사용하고 수정하세요.
```

### Git 커밋 및 Push (5분)

```bash
git add .
git commit -m "feat: add wbs-automation template"
git push
```

**성공 기준**:
- ✅ 루트 README.md 작성 완료
- ✅ 전체 템플릿 구조 GitHub에 push
- ✅ `https://github.com/sowonlabs/crewx-templates` 접속 가능

---

## 성공 기준 요약

**Phase 4 완료 조건**:

1. **저장소 구조** (Phase 4-1)
   - ✅ `/Users/doha/git/crewx-templates` 로컬 저장소
   - ✅ GitHub remote 연결

2. **wbs-automation 템플릿** (Phase 4-2)
   - ✅ crewx.yaml (metadata 포함)
   - ✅ wbs.md (템플릿 구조)
   - ✅ wbs-loop.sh
   - ✅ README.md (사용 가이드)
   - ✅ .gitignore
   - ✅ .claude/skills/crewx-wbs/SKILL.md

3. **저장소 문서** (Phase 4-3)
   - ✅ 루트 README.md
   - ✅ Git push 완료

**사용자 테스트**:
```bash
# 다른 디렉토리에서 테스트
cd /tmp
mkdir test-wbs && cd test-wbs
crewx template init wbs-automation

# 파일 생성 확인
ls -la
# → crewx.yaml, wbs.md, wbs-loop.sh, README.md, .claude/
```

---

## 다음 단계

Phase 4 완료 후:
1. **Phase 3 진행** - giget 통합 (TemplateService 업데이트)
2. **Phase 5 진행** - 문서화 및 테스트
3. **WBS-32 완료!**

**전체 플로우**:
```
Phase 1 (완료) → Phase 4 (템플릿 저장소) → Phase 3 (giget) → Phase 5 (문서화)
```

**왜 Phase 4를 먼저?**
- Phase 3 테스트를 위해 실제 GitHub 저장소 필요
- 템플릿 구조 확정되어야 giget 통합 테스트 가능
