---
name: status
description: GitHub 기반 프로젝트 상태 조회 스킬. gh CLI로 실시간 이슈/PR 상태 확인.
version: 0.1.0
---

# Status Skill

GitHub를 single source of truth로 사용하는 프로젝트 상태 조회 스킬입니다.

## 왜 이 스킬인가?

- **status.md 문제**: 수동 관리, 싱크 안 맞음, 에이전트가 업데이트 안 함
- **GitHub 라벨**: 이미 모든 정보 있음 (status:resolved, worker:xxx, target_release:xxx)
- **이 스킬**: gh CLI로 실시간 조회, 항상 최신 상태

## 사용법

```bash
# 전체 상태 조회
node skills/status/status.js

# 진행 중인 이슈만
node skills/status/status.js in-progress

# resolved 이슈 (PR 대기 중)
node skills/status/status.js resolved

# 열린 PR 목록
node skills/status/status.js prs

# 특정 릴리스 타겟
node skills/status/status.js release 0.8.0
```

## 에이전트 프롬프트 가이드

```markdown
# 작업 시작 전 상태 확인

프로젝트 상태를 확인하려면:
```bash
node skills/status/status.js
```

status.md 파일 대신 이 명령어를 사용하세요.
GitHub이 single source of truth입니다.
```

## 라벨 체계

| 라벨 | 용도 |
|------|------|
| `status:in-progress` | 작업 중 |
| `status:resolved` | 완료, PR/머지 대기 |
| `worker:crewx_claude_dev` | 담당 에이전트 |
| `reviewer:crewx_gemini_dev` | 리뷰어 |
| `target_release:0.8.0` | 타겟 릴리스 |

## 의존성

- `gh` CLI (GitHub CLI) 설치 및 인증 필요
