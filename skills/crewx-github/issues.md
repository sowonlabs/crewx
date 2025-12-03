# GitHub Issues Guide

GitHub Issues 생성 및 관리 가이드입니다.

## 이슈 템플릿

CrewX는 3가지 이슈 템플릿을 제공합니다:

| 템플릿 | 파일 | 용도 |
|--------|------|------|
| Bug Report | `.github/ISSUE_TEMPLATE/bug_report.yml` | 버그 리포트 |
| Feature Request | `.github/ISSUE_TEMPLATE/feature_request.yml` | 기능 요청 |
| Question | `.github/ISSUE_TEMPLATE/question.md` | 질문 |

## 이슈 생성 방법

### 1. 웹 UI 사용

```
https://github.com/sowonlabs/crewx/issues/new/choose
```

### 2. gh CLI 사용 (권장)

#### 버그 리포트

```bash
gh issue create --template bug_report.yml
```

#### 기능 요청

```bash
gh issue create --template feature_request.yml
```

#### 직접 생성 (템플릿 없이)

```bash
gh issue create \
  --title "[Bug]: 이슈 제목" \
  --body "이슈 내용" \
  --label "type:bug,priority:medium"
```

## gh CLI 이슈 명령어

### 이슈 목록 조회

```bash
# 모든 열린 이슈
gh issue list

# 특정 라벨로 필터
gh issue list --label "type:bug"
gh issue list --label "priority:critical"

# 여러 라벨 조합
gh issue list --label "type:bug" --label "component:cli"

# 닫힌 이슈 포함
gh issue list --state all

# JSON 출력
gh issue list --json number,title,labels
```

### 이슈 상세 조회

```bash
# 이슈 내용 보기
gh issue view <번호>

# 웹 브라우저에서 열기
gh issue view <번호> --web

# 댓글 포함
gh issue view <번호> --comments
```

### 이슈 생성

```bash
# 대화형 생성
gh issue create

# 템플릿 사용
gh issue create --template bug_report.yml

# 한 줄로 생성
gh issue create --title "[Bug]: 제목" --body "내용"

# 라벨과 함께 생성
gh issue create \
  --title "[Feature]: Layout Props 기능" \
  --body "레이아웃 섹션 on/off 가능하도록 props 지원" \
  --label "type:feature,priority:medium,component:sdk"
```

### 이슈 수정

```bash
# 라벨 추가
gh issue edit <번호> --add-label "status:in-progress"

# 라벨 제거
gh issue edit <번호> --remove-label "status:triage"

# 제목 변경
gh issue edit <번호> --title "새 제목"

# 담당자 지정
gh issue edit <번호> --add-assignee "@me"

# 마일스톤 설정
gh issue edit <번호> --milestone "v0.8.0"
```

### 이슈 상태 변경

```bash
# 이슈 닫기
gh issue close <번호>

# 이슈 다시 열기
gh issue reopen <번호>

# 닫으면서 댓글 추가
gh issue close <번호> --comment "PR #123에서 해결됨"
```

### 이슈에 댓글 추가

```bash
# 댓글 추가
gh issue comment <번호> --body "작업 시작합니다"

# HEREDOC 사용
gh issue comment <번호> --body "$(cat <<'EOF'
## 진행 상황

- [x] 분석 완료
- [ ] 구현 중
- [ ] 테스트 예정
EOF
)"
```

## 이슈 상태 관리

### 상태 라벨 전이

```
[새 이슈] status:triage
    ↓
[확인됨] status:confirmed
    ↓
[작업 시작] status:in-progress
    ↓
[PR 머지] → 이슈 close
```

### 상태 업데이트 예시

```bash
# 분류 완료 → 확인
gh issue edit 42 \
  --remove-label "status:triage" \
  --add-label "status:confirmed"

# 작업 시작
gh issue edit 42 \
  --remove-label "status:confirmed" \
  --add-label "status:in-progress"

# PR 머지 후 종료
gh issue close 42 --comment "PR #50에서 해결됨"
```

## 에이전트용 이슈 생성 예시

### 버그 이슈

```bash
gh issue create \
  --title "[Bug]: MCP 응답 파싱 에러" \
  --body "$(cat <<'EOF'
## Bug Description

MCP 서버 응답에서 JSON 파싱 에러가 발생합니다.

## Steps to Reproduce

1. `crewx mcp` 실행
2. 잘못된 형식의 요청 전송
3. 에러 발생

## Expected Behavior

에러 메시지와 함께 graceful하게 실패해야 함

## Actual Behavior

프로세스가 크래시됨

## Environment

- CrewX Version: 0.7.7
- Node.js: v20.19.2
- OS: macOS
EOF
)" \
  --label "type:bug,priority:high,component:mcp,status:triage"
```

### 기능 요청 이슈

```bash
gh issue create \
  --title "[Feature]: Layout Props로 기본 섹션 on/off 기능" \
  --body "$(cat <<'EOF'
## Problem Statement

crewx/default 레이아웃 사용 시 특정 섹션만 표시하고 싶음

## Proposed Solution

props를 통해 섹션별 on/off 가능하도록 구현:
- showManual: bool
- showAgentProfile: bool
- showSkills: bool
- showConversationHistory: bool

## Use Cases

1. 간단한 에이전트에서 불필요한 섹션 숨기기
2. 프롬프트 토큰 절약

## Affected Component

SDK (packages/sdk)
EOF
)" \
  --label "type:feature,priority:medium,component:sdk,status:triage"
```

## git-bug에서 GitHub Issues로 마이그레이션

### 마이그레이션 절차

1. git-bug 이슈 조회
2. GitHub Issue 생성
3. git-bug에 마이그레이션 기록
4. (선택) git-bug 이슈 종료

```bash
# 1. git-bug 이슈 조회
git bug bug show <hash>

# 2. GitHub Issue 생성
gh issue create \
  --title "[Feature]: 제목" \
  --body "내용..." \
  --label "type:feature,..."

# 3. git-bug에 마이그레이션 기록
git bug bug comment new <hash> --message "Migrated to GitHub Issue #XX"

# 4. (선택) git-bug 종료
git bug bug close <hash>
```

## 이슈와 PR 연결

### 자동 종료 키워드

PR에서 다음 키워드 사용 시 머지되면 이슈 자동 종료:

- `Closes #123`
- `Fixes #123`
- `Resolves #123`

### PR 본문 예시

```markdown
## Summary

Layout Props 기능 구현

## Related Issues

- Closes #42
- Related to #35
```

## 이슈 검색 팁

### 고급 검색

```bash
# 내가 생성한 이슈
gh issue list --author "@me"

# 내게 할당된 이슈
gh issue list --assignee "@me"

# 최근 업데이트된 이슈
gh issue list --json number,title,updatedAt | jq 'sort_by(.updatedAt) | reverse'

# 댓글 없는 이슈
gh issue list --json number,title,comments | jq '[.[] | select(.comments | length == 0)]'
```
