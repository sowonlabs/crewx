# CrewX Skill 배포 전략 설계 문서

> **Status**: Draft (토론 중)
> **Created**: 2026-01-02
> **Participants**: Dev Lead, CTO, CPO
> **Thread**: `2026-01-02-skill-strategy`

---

## 1. 현재 상태

### 1.1 구현 완료 (이슈 #60)

| 기능 | 상태 | 파일 |
|------|------|------|
| `crewx skill list` | ✅ | `packages/cli/src/cli/skill.handler.ts` |
| `crewx skill info <name>` | ✅ | `packages/cli/src/services/skill.service.ts` |
| `crewx skill <name> [args]` | ✅ | 스킬 실행 |

### 1.2 스킬 탐색 경로

```
skills/              # 프로젝트 로컬 (우선순위 높음)
.crewx/skills/       # 프로젝트 글로벌
```

### 1.3 지원 엔트리포인트

- JavaScript (`.js`) - `node`로 실행
- Shell (`.sh`) - `sh`로 실행
- Python (`.py`) - `python3`로 실행

---

## 2. 지원 벤더 분석

> CrewX는 오케스트레이션 레이어로서 Claude, Codex, Gemini 등 다양한 AI 벤더를 통합 지원합니다.
> 각 벤더의 스킬 시스템을 분석하여 호환성을 확보합니다.

### 2.1 Claude Code (Anthropic)

| 항목 | 내용 |
|------|------|
| **스킬 정의** | `SKILL.md` (YAML frontmatter + Markdown) |
| **설치 경로** | `~/.claude/skills/`, `.claude/skills/` |
| **마켓플레이스** | Plugin Marketplace (공식) |
| **설치 명령** | `/plugin install plugin-name@marketplace` |
| **특징** | 플러그인 > 스킬 계층 구조, MCP 서버 번들링 |

**Claude Code SKILL.md 포맷:**
```yaml
---
name: skill-name              # 필수, 케밥 케이스, 최대 64자
description: |                # 필수, 1024자 이하
  스킬 설명 (Claude가 사용 시점 결정에 활용)
allowed-tools:                # 선택
  - Read
  - Grep
  - Bash(python:*)
---

# Skill Instructions

마크다운 형식 지시사항
```

### 2.2 Codex CLI (OpenAI)

| 항목 | 내용 |
|------|------|
| **스킬 정의** | `SKILL.md` (YAML frontmatter + Markdown) |
| **설치 경로** | `~/.codex/skills/`, `.codex/skills/` |
| **마켓플레이스** | SkillsMP (커뮤니티, skillsmp.com) |
| **설치 명령** | `$skill-installer <name>` |
| **특징** | Progressive Disclosure, 번들 리소스 지원 |

**Codex SKILL.md 포맷:**
```yaml
---
name: skill-name              # 필수, 최대 100자
description: |                # 필수, 최대 500자
  스킬 설명
metadata:
  short-description: 사용자 대면 설명 (선택)
---

# Skill Instructions
```

**Codex 스킬 디렉토리 구조:**
```
skill-name/
├── SKILL.md                 # 필수
├── scripts/                 # 실행 코드
├── references/              # 참조 문서
└── assets/                  # 템플릿, 아이콘 등
```

### 2.3 호환성 요약

| 항목 | Claude Code | Codex CLI | CrewX (오케스트레이터) |
|------|-------------|-----------|------------------------|
| 스킬 정의 | SKILL.md | SKILL.md | SKILL.md ✅ 호환 |
| 메타데이터 | YAML frontmatter | YAML frontmatter | YAML frontmatter ✅ 호환 |
| 마켓플레이스 | 공식 | SkillsMP (커뮤니티) | 통합 연동 예정 |
| MCP 통합 | 있음 | 있음 | 연동 예정 |

**핵심 발견:**
- SKILL.md는 사실상 업계 표준 → CrewX는 이미 호환
- CrewX는 오케스트레이션 레이어로서 양쪽 마켓플레이스 스킬을 통합 활용 가능

---

## 3. CTO 의견

> 회의 일시: 2026-01-02

### 3.1 추천 방향: GitHub 기반 배포

```bash
crewx skill add sowonlabs/skill-memory
crewx skill add sowonlabs/skill-memory@1.0.0
```

### 3.2 근거

| 옵션 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| npm 패키지 | 버전 관리, 의존성 | 무겁고 복잡, JS 전용 | 중간 |
| 템플릿 복사 | 단순함 | 업데이트 어려움 | 낮음 |
| **GitHub 직접** | 가벼움, 모든 언어, 버전 태그 | rate limit | **높음** |

### 3.3 제안 아키텍처

```
.crewx/
├── skills/                    # 설치된 스킬
│   ├── memory-v2/
│   │   ├── SKILL.md
│   │   └── memory-v2.js
│   └── .registry.json         # 설치 기록
skills/                        # 프로젝트 로컬 (우선순위 높음)
└── my-custom-skill/
```

### 3.4 제안 서브커맨드

```bash
# 현재 (완료)
crewx skill list
crewx skill info <name>
crewx skill <name> [args]

# 추가 필요
crewx skill add <repo>[@version]    # GitHub에서 설치
crewx skill remove <name>           # 삭제
crewx skill update [name]           # 업데이트
crewx skill search <keyword>        # (Phase 2) 레지스트리 검색
```

---

## 4. CPO 의견

> 회의 일시: 2026-01-02

### 4.1 UX 보완 필요사항

| 이슈 | 해결 방안 |
|------|----------|
| repo명 기억 어려움 | Shortcut alias: `crewx skill add memory` |
| 공식 스킬 구분 | `@crewx/memory` 네임스페이스 |
| 버전 검색 | `crewx skill versions <name>` |

### 4.2 마켓플레이스 진화 경로

```
Phase 1 (현재)     Phase 2           Phase 3
─────────────────────────────────────────────────────
crewx skill add   →  skill search    →  웹 마켓플레이스
sowonlabs/...        (registry)         (UI + 평점)
```

### 4.3 온보딩 통합 제안

```bash
$ crewx init
✓ Created crewx.yaml

💡 Popular skills to get started:
   crewx skill add memory      # 장기 기억
   crewx skill add search      # BM25 검색
```

### 4.4 MVP 스코프 제안

**Phase 1 MVP:**
1. `crewx skill add <owner/repo>[@version]` - 필수
2. `crewx skill remove <name>` - 필수
3. `crewx skill list --installed` - 필수

**Phase 1.5:**
4. Shortcut alias (`memory` → `sowonlabs/skill-memory`)
5. `crewx skill update [name]`

---

## 5. 확장 제안: 4-Tier 스킬 소스

CEO 요청사항 반영: Claude Code/Codex 호환 + 템플릿 + npm

### 5.1 통합 설치 명령어

```bash
# CrewX 마켓플레이스 (prefix 없음 = 기본)
crewx skill add memory
crewx skill add memory@1.0.0

# 외부 소스 (prefix 필수)
crewx skill add github:sowonlabs/skill-memory
crewx skill add github:sowonlabs/skill-memory@v1.0.0
crewx skill add npm:@crewx/memory
crewx skill add template:memory
crewx skill add claude:anthropic/code-review
crewx skill add skillsmp:linear-integration
```

### 5.2 소스 판별 로직

**원칙: prefix 없음 = CrewX 마켓플레이스, prefix 있음 = 외부 소스**

```
입력값                              → 소스 타입
───────────────────────────────────────────────────
memory                             → crewx marketplace (기본)
memory@1.0.0                       → crewx marketplace (버전 지정)
github:owner/repo                  → github
github:owner/repo@v1.0.0           → github (with tag)
npm:@scope/package                 → npm registry
template:name                      → built-in template
claude:name                        → claude code marketplace
skillsmp:name                      → skillsmp marketplace
```

**판별 순서 (구현 시):**
```typescript
function resolveSource(input: string): SkillSource {
  // 1. URL (가장 명확)
  if (input.startsWith('https://') || input.startsWith('git+')) {
    return { type: 'url', url: input };
  }

  // 2. 명시적 prefix (외부 소스)
  if (input.startsWith('github:')) return parseGitHub(input.slice(7));
  if (input.startsWith('npm:')) return { type: 'npm', package: input.slice(4) };
  if (input.startsWith('template:')) return { type: 'template', name: input.slice(9) };
  if (input.startsWith('claude:')) return { type: 'claude', id: input.slice(7) };
  if (input.startsWith('skillsmp:')) return { type: 'skillsmp', id: input.slice(9) };

  // 3. prefix 없음 → CrewX 마켓플레이스 (기본)
  const match = input.match(/^([a-zA-Z0-9-_]+)(@[a-zA-Z0-9.-]+)?$/);
  if (match) {
    return { type: 'crewx', name: match[1], version: match[2]?.slice(1) };
  }

  throw new Error(`Invalid skill identifier: ${input}`);
}
```

### 5.3 디렉토리 구조 (npm 패턴)

**npm과 동일한 멘탈 모델:**

| npm | CrewX | 설명 |
|-----|-------|------|
| `node_modules/` | `.crewx/skills/` | 설치된 패키지/스킬 |
| `src/` | `skills/` | 내가 만든 코드/스킬 |
| `package-lock.json` | `.crewx/registry.json` | 설치 추적 |

**프로젝트 구조:**
```
프로젝트/
├── .crewx/
│   ├── skills/           # 설치된 스킬 (gitignore 대상)
│   │   ├── memory/
│   │   └── search/
│   ├── registry.json     # 설치 추적 (커밋 가능)
│   ├── logs/             # 기존 사용 중
│   └── conversations/    # 기존 사용 중
│
├── skills/               # 내가 만든 스킬 (커밋 대상)
│   └── my-custom/
│
└── crewx.yaml
```

**글로벌 구조:**
```
~/.crewx/
├── skills/           # 글로벌 설치 스킬
├── registry.json     # 글로벌 레지스트리
└── config.json       # 글로벌 설정 (향후)
```

**스킬 해결 우선순위:**
```
1. ./skills/             # 프로젝트 커스텀 스킬 (최우선)
2. ./.crewx/skills/      # 프로젝트 설치 스킬
3. ~/.crewx/skills/      # 글로벌 설치 스킬
```

**.gitignore 권장:**
```gitignore
# CrewX
.crewx/skills/
.crewx/logs/
.crewx/conversations/
```

### 5.4 registry.json 구조

**역할:** 설치된 스킬의 출처와 버전 추적 (업데이트, 중복 방지용)

```json
{
  "skills": {
    "memory": {
      "source": "crewx",
      "name": "memory",
      "version": "1.0.0",
      "installed": "2026-01-02T10:00:00Z"
    },
    "skill-memory": {
      "source": "github",
      "repo": "sowonlabs/skill-memory",
      "version": "v1.0.0",
      "installed": "2026-01-02T10:00:00Z"
    },
    "search": {
      "source": "npm",
      "package": "@crewx/search",
      "version": "1.2.0",
      "installed": "2026-01-02T10:00:00Z"
    },
    "code-review": {
      "source": "claude",
      "id": "anthropic/code-review",
      "installed": "2026-01-02T10:00:00Z"
    },
    "linear": {
      "source": "skillsmp",
      "id": "linear-integration",
      "installed": "2026-01-02T10:00:00Z"
    }
  }
}
```

### 5.5 업데이트 가능 여부

| 소스 | 업데이트 | 이유 |
|------|---------|------|
| `crewx` | ✅ | 마켓플레이스 버전 관리 |
| `github:` | ✅ | 태그/브랜치 버전 관리 |
| `npm:` | ✅ | semver 버전 관리 |
| `template:` | ❌ | 일회성 복사, 로컬 수정 허용 |
| `claude:` | ⚠️ | 마켓플레이스 정책에 따름 |
| `skillsmp:` | ⚠️ | 마켓플레이스 정책에 따름 |

```bash
crewx skill update memory
# → source=crewx: 최신 버전 확인 후 업데이트
# → source=template: 에러 "Template skills cannot be updated"
```

---

## 6. 호환성 매핑

### 6.1 Claude Code → CrewX

```bash
# Claude Code 플러그인 import
crewx skill import claude:my-plugin

# 변환 과정
1. marketplace.json에서 플러그인 소스 확인
2. skills/ 디렉토리 추출
3. .crewx/skills/에 설치
4. plugin.json 메타데이터 → SKILL.md 병합
```

### 6.2 Codex → CrewX

```bash
# Codex 스킬은 직접 호환
cp -r ~/.codex/skills/my-skill ./skills/

# 또는 import 명령어
crewx skill import codex:my-skill
```

### 6.3 SKILL.md 통합 스키마

```yaml
---
# 공통 필드 (Claude Code + Codex + CrewX)
name: skill-name              # 필수
description: |                # 필수
  스킬 설명
version: 1.0.0               # CrewX 추가

# Claude Code 호환
allowed-tools:               # 선택
  - Read
  - Grep

# Codex 호환
metadata:                    # 선택
  short-description: 짧은 설명

# CrewX 전용
entry_point: script.js       # 선택 (없으면 자동 탐색)
dependencies:                # 선택
  - node >= 18
---

# Skill Instructions
```

---

## 7. 구현 우선순위

### Phase 1: MVP (0.8.x)

| 우선순위 | 기능 | 담당 |
|----------|------|------|
| P0 | `skill list/info/execute` | ✅ 완료 |
| P1 | `skill add <github>` | TBD |
| P1 | `skill remove` | TBD |
| P1 | `.registry.json` 구현 | TBD |

### Phase 2: 확장 (0.9.x)

| 기능 | 설명 |
|------|------|
| `skill add @crewx/*` | npm 공식 스킬 |
| `skill add template:*` | 템플릿 추출 |
| `skill update` | 업데이트 |
| Shortcut alias | 별칭 지원 |

### Phase 3: 마켓플레이스 (1.0.x)

| 기능 | 설명 |
|------|------|
| `skill marketplace add` | 외부 마켓플레이스 등록 |
| `skill search` | 검색 |
| Claude/Codex import | 호환성 |

---

## 8. 미결 사항 (Discussion Needed)

### 8.1 네이밍 컨벤션

- [ ] 공식 스킬 repo 이름: `skill-*` vs `crewx-skill-*`?
- [ ] npm 패키지 이름: `@crewx/skill-*` vs `@crewx/*`?

### 8.2 설치 경로 ✅ 확정

- [x] 글로벌 설치 경로: `~/.crewx/skills/`
- [x] 프로젝트 설치 경로: `.crewx/skills/`
- [x] 커스텀 스킬 경로: `skills/`
- [x] XDG Base Directory: 미준수 (`.crewx/` 패턴 유지)

### 8.3 버전 관리

- [ ] GitHub 태그 vs branch 우선순위?
- [ ] npm 버전과 GitHub 태그 동기화 방법?

### 8.4 마켓플레이스 전략

- [ ] 자체 마켓플레이스 구축 vs SkillsMP 연동?
- [ ] Claude Code marketplace 접근 방법?

### 8.5 MCP 통합

- [ ] 스킬에 MCP 서버 번들링 지원?
- [ ] `crewx mcp` 서브커맨드 추가?

### 8.6 CLI 용어 ✅ 확정

- [x] 추가: `add` (yarn 패턴)
- [x] 삭제: `remove` (add의 반대)
- [x] 스킬/에이전트 공통 용어 사용

---

## 9. 참고 자료

### 공식 문서
- [Claude Code Skills](https://docs.anthropic.com/claude-code/skills)
- [Claude Code Plugins](https://docs.anthropic.com/claude-code/plugins)
- [Codex CLI Skills](https://developers.openai.com/codex/skills/)
- [SkillsMP](https://skillsmp.com/)

### 내부 문서
- [CrewX Skill Handler](../packages/cli/src/cli/skill.handler.ts)
- [CrewX Skill Service](../packages/cli/src/services/skill.service.ts)
- [이슈 #60](https://github.com/sowonlabs/crewx/issues/60)

---

## 변경 이력

| 날짜 | 작성자 | 내용 |
|------|--------|------|
| 2026-01-02 | Dev Lead | 초안 작성, CTO/CPO 의견 반영 |
| 2026-01-02 | Dev Lead | 소스 판별 로직 확정: prefix 없음=CrewX 마켓플레이스, prefix 있음=외부 소스 |
| 2026-01-02 | Dev Lead | CTO 협의: 디렉토리 구조 확정 (npm 패턴), CLI 용어 확정 (add/remove) |
