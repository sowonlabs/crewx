# CrewX GitHub Skill

에이전트들이 GitHub Issues/PR을 일관되게 관리할 수 있도록 하는 가이드 스킬입니다.

## 목적

- GitHub Issues와 PR 관리 표준화
- 라벨 사용 규칙 통일
- `gh` CLI를 활용한 자동화 지원

## 문서 구조

| 파일 | 설명 |
|------|------|
| [labels.md](./labels.md) | 라벨 종류 및 사용 규칙 |
| [issues.md](./issues.md) | 이슈 생성/관리 가이드 + `gh` 명령어 예시 |
| [pr.md](./pr.md) | PR 생성/리뷰 가이드 |

## 빠른 시작

### 이슈 생성

```bash
# 버그 리포트
gh issue create --template bug_report.yml

# 기능 요청
gh issue create --template feature_request.yml
```

### PR 생성

```bash
gh pr create --template PULL_REQUEST_TEMPLATE.md
```

## 라벨 카테고리 요약

| 카테고리 | 용도 | 예시 |
|----------|------|------|
| `type:*` | 이슈/PR 유형 분류 | `type:bug`, `type:feature` |
| `priority:*` | 우선순위 | `priority:high`, `priority:critical` |
| `status:*` | 현재 상태 | `status:triage`, `status:in-progress` |
| `component:*` | 영향받는 컴포넌트 | `component:cli`, `component:sdk` |
| `release:*` | 릴리즈 타겟 | `release:next-minor` |

## 관련 리소스

- 라벨 설정 스크립트: `scripts/setup-github-labels.sh`
- 이슈 템플릿: `.github/ISSUE_TEMPLATE/`
- PR 템플릿: `.github/PULL_REQUEST_TEMPLATE.md`

## 사용 예시

### 에이전트가 버그 이슈 생성 시

```bash
gh issue create \
  --title "[Bug]: MCP 응답 파싱 에러" \
  --body "## Bug Description
MCP 서버 응답에서 JSON 파싱 에러 발생

## Steps to Reproduce
1. Run \`crewx mcp\`
2. Send malformed request

## Expected Behavior
에러 메시지와 함께 graceful 실패

## Actual Behavior
크래시 발생" \
  --label "type:bug,priority:high,component:mcp"
```

### 에이전트가 기능 요청 이슈 생성 시

```bash
gh issue create \
  --title "[Feature]: Layout Props 기능" \
  --body "## Problem Statement
레이아웃 섹션을 선택적으로 표시하고 싶음

## Proposed Solution
props를 통해 섹션 on/off 가능하도록 구현" \
  --label "type:feature,priority:medium,component:sdk"
```
