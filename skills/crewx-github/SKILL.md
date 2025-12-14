---
name: crewx-github
description: GitHub Issues/PR 관리 가이드. 이슈 생성, 라벨 사용, PR 생성/리뷰 시 활성화.
version: 0.0.1
---

# CrewX GitHub Skill

에이전트들이 GitHub Issues/PR을 일관되게 관리할 수 있도록 하는 가이드 스킬입니다.

## 목적

- GitHub Issues와 PR 관리 표준화
- 라벨 사용 규칙 통일
- `gh` CLI를 활용한 자동화 지원

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

---

# GitHub Labels Guide

CrewX 프로젝트의 GitHub 라벨 시스템입니다. 모든 라벨은 `scripts/setup-github-labels.sh`로 설정됩니다.

## 라벨 카테고리

### Type Labels (유형)

이슈/PR의 종류를 분류합니다.

| 라벨 | 색상 | 설명 | 사용 예시 |
|------|------|------|----------|
| `type:bug` | #d73a4a (빨강) | 버그, 오작동 | 크래시, 에러, 예상과 다른 동작 |
| `type:feature` | #a2eeef (하늘) | 새 기능 요청 | 새 CLI 명령어, API 추가 |
| `type:docs` | #0075ca (파랑) | 문서 개선 | README 업데이트, 가이드 추가 |
| `type:refactor` | #fbca04 (노랑) | 코드 리팩토링 | 구조 변경 (기능 변화 없음) |
| `type:test` | #bfd4f2 (연보라) | 테스트 개선 | 테스트 추가, 테스트 수정 |
| `type:security` | #b60205 (진빨강) | 보안 관련 | 취약점, 보안 패치 |
| `type:performance` | #d4c5f9 (연보라) | 성능 개선 | 속도 최적화, 메모리 개선 |
| `type:maintenance` | #c5def5 (연파랑) | 유지보수 | 의존성 업데이트, 정리 작업 |

### Priority Labels (우선순위)

작업 긴급도를 표시합니다.

| 라벨 | 색상 | 설명 | 대응 시간 |
|------|------|------|----------|
| `priority:critical` | #b60205 (진빨강) | 즉시 수정 필요 | 당일 |
| `priority:high` | #d93f0b (주황) | 빠른 수정 필요 | 1-2일 |
| `priority:medium` | #fbca04 (노랑) | 일반 우선순위 | 스프린트 내 |
| `priority:low` | #0e8a16 (녹색) | 낮은 우선순위 | 여유 있을 때 |

### Status Labels (상태)

현재 진행 상태를 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `status:triage` | #ededed (회색) | 분류 및 평가 필요 |
| `status:confirmed` | #c2e0c6 (연녹색) | 확인됨, 작업 가능 |
| `status:in-progress` | #0052cc (파랑) | 현재 작업 중 |
| `status:blocked` | #b60205 (빨강) | 외부 의존성으로 차단됨 |
| `status:needs-info` | #d876e3 (분홍) | 추가 정보 필요 |
| `status:wontfix` | #ffffff (흰색) | 수정하지 않음 |
| `status:duplicate` | #cfd3d7 (연회색) | 중복 이슈 |

### Component Labels (컴포넌트)

영향받는 패키지/모듈을 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `component:cli` | #5319e7 (보라) | CLI 패키지 (packages/cli) |
| `component:sdk` | #1d76db (파랑) | SDK 패키지 (packages/sdk) |
| `component:slack` | #4a154b (슬랙보라) | Slack Bot 통합 |
| `component:mcp` | #6f42c1 (보라) | MCP Server |
| `component:docs` | #0075ca (파랑) | 문서 |
| `component:ci` | #333333 (검정) | CI/CD, GitHub Actions |

### Release Labels (릴리즈)

릴리즈 계획을 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `release:breaking` | #b60205 (빨강) | Breaking changes 포함 |
| `release:next-minor` | #c5def5 (연파랑) | 다음 마이너 릴리즈 타겟 |
| `release:next-patch` | #c2e0c6 (연녹색) | 다음 패치 릴리즈 타겟 |
| `release:next-major` | #fbca04 (노랑) | 다음 메이저 릴리즈 타겟 |

### Workflow Labels (워크플로우)

특수한 워크플로우 상태를 표시합니다.

| 라벨 | 색상 | 설명 |
|------|------|------|
| `good-first-issue` | #7057ff (보라) | 신규 기여자에게 적합 |
| `help-wanted` | #008672 (청록) | 추가 관심 필요 |
| `discussion` | #cc317c (분홍) | 구현 전 논의 필요 |
| `rfc` | #fbca04 (노랑) | 설계 의견 요청 |
| `needs-review` | #0e8a16 (녹색) | 코드 리뷰 필요 |

## 라벨 조합 규칙

### 필수 라벨

모든 이슈에는 최소 다음 라벨이 필요합니다:

1. **type:** 라벨 (1개 필수)
2. **priority:** 라벨 (1개 필수)

### 권장 조합

| 시나리오 | 권장 라벨 조합 |
|----------|---------------|
| 긴급 버그 | `type:bug` + `priority:critical` + `component:*` + `status:in-progress` |
| 새 기능 | `type:feature` + `priority:*` + `component:*` + `status:triage` |
| 보안 이슈 | `type:security` + `priority:critical` + `component:*` |
| 문서 개선 | `type:docs` + `priority:low` + `good-first-issue` |
| Breaking 변경 | `type:feature` + `release:breaking` + `release:next-major` |

### 상태 전이

```
status:triage → status:confirmed → status:in-progress → (PR 머지) → 종료
                              ↘ status:wontfix
                              ↘ status:duplicate
                              ↘ status:needs-info → status:confirmed
```

## gh CLI로 라벨 관리

### 라벨 조회

```bash
# 모든 라벨 목록
gh label list

# 특정 패턴 검색
gh label list | grep "type:"
```

### 라벨 추가/제거

```bash
# 이슈에 라벨 추가
gh issue edit <번호> --add-label "priority:high,status:in-progress"

# 이슈에서 라벨 제거
gh issue edit <번호> --remove-label "status:triage"
```

### 라벨로 이슈 검색

```bash
# 특정 라벨 이슈 검색
gh issue list --label "type:bug,priority:critical"

# 여러 라벨 조합 검색
gh issue list --label "type:bug" --label "component:cli"
```

## 라벨 설정

새 저장소에서 라벨 설정:

```bash
./scripts/setup-github-labels.sh sowonlabs/crewx
```

이 스크립트는 기존 라벨을 업데이트하고, 레거시 라벨(`bug`, `enhancement`, `documentation`)을 삭제합니다.

---

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

---

# GitHub Pull Request Guide

GitHub PR 생성 및 리뷰 가이드입니다.

## PR 템플릿

CrewX는 표준 PR 템플릿을 제공합니다:
- 위치: `.github/PULL_REQUEST_TEMPLATE.md`

## PR 생성 방법

### 1. gh CLI 사용 (권장)

```bash
# 대화형 생성
gh pr create

# 한 줄로 생성
gh pr create --title "제목" --body "내용"

# 템플릿 사용
gh pr create --template PULL_REQUEST_TEMPLATE.md
```

### 2. 상세 PR 생성

```bash
gh pr create --title "feat(sdk): Layout Props 기능 추가" --body "$(cat <<'EOF'
## Summary

- Layout 템플릿에서 props를 통해 섹션 on/off 가능하도록 구현
- propsSchema에 5개 boolean 옵션 추가

## Change Type

- [x] New feature (non-breaking change that adds functionality)

## Related Issues / WBS Items

- Closes #42
- WBS reference: wbs-layout-props

## Testing

### Build & Test Commands

- [x] `npm run build`
- [x] `npm test --workspace @sowonai/crewx-sdk`

### Test Coverage

- [x] Unit tests added/updated
- [x] Manual testing performed

### Test Results

```
✓ All tests passing
```

## Checklist

### Required

- [x] I have read the Code of Conduct
- [x] I followed the Contributing Guide

### Documentation

- [x] I documented user-facing changes
- [x] I updated CREWX.md files if code structure changed

### Compatibility

- [x] I considered backward compatibility
- [x] I tested with existing configurations

## Screenshots / Logs

N/A

## Breaking Changes

N/A
EOF
)"
```

## PR 템플릿 섹션 설명

### Summary

변경 사항 요약. 패키지 간 영향(CLI ↔ SDK) 명시.

### Change Type

체크리스트 형식:
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactoring
- [ ] Documentation update
- [ ] Configuration change

### Related Issues / WBS Items

- `Closes #123` - PR 머지 시 자동으로 이슈 종료
- `Related to #456` - 관련 이슈 참조
- WBS 항목이 있으면 명시

### Testing

빌드 및 테스트 수행 여부:
- `npm run build`
- `npm test --workspace @sowonai/crewx-sdk`
- `npm test --workspace crewx`

### Checklist

필수 항목:
- Code of Conduct 확인
- CLA 서명
- Contributing Guide 준수

### Breaking Changes

하위 호환성을 깨는 변경이 있으면 마이그레이션 가이드 제공

## gh CLI PR 명령어

### PR 목록 조회

```bash
# 열린 PR 목록
gh pr list

# 내가 만든 PR
gh pr list --author "@me"

# 리뷰 요청받은 PR
gh pr list --reviewer "@me"

# 상태별 필터
gh pr list --state all
gh pr list --state merged
gh pr list --state closed
```

### PR 상세 조회

```bash
# PR 내용 보기
gh pr view <번호>

# 웹에서 열기
gh pr view <번호> --web

# 변경 파일 목록
gh pr diff <번호>

# PR 체크 상태
gh pr checks <번호>
```

### PR 생성

```bash
# 기본 생성
gh pr create

# 제목과 본문 지정
gh pr create --title "feat: 새 기능" --body "설명..."

# Draft PR 생성
gh pr create --draft

# Base 브랜치 지정
gh pr create --base develop

# 라벨 추가
gh pr create --label "type:feature"
```

### PR 수정

```bash
# 라벨 추가
gh pr edit <번호> --add-label "needs-review"

# 리뷰어 추가
gh pr edit <번호> --add-reviewer username

# 제목 변경
gh pr edit <번호> --title "새 제목"

# Draft → Ready 변경
gh pr ready <번호>
```

### PR 리뷰

```bash
# 리뷰 승인
gh pr review <번호> --approve

# 변경 요청
gh pr review <번호> --request-changes --body "수정이 필요합니다"

# 코멘트
gh pr review <번호> --comment --body "LGTM!"
```

### PR 머지

```bash
# 머지 (기본: merge commit)
gh pr merge <번호>

# Squash 머지
gh pr merge <번호> --squash

# Rebase 머지
gh pr merge <번호> --rebase

# 머지 후 브랜치 삭제
gh pr merge <번호> --delete-branch

# 자동 머지 설정 (CI 통과 후)
gh pr merge <번호> --auto --squash
```

## PR 브랜치 전략

### 브랜치 명명 규칙

| 유형 | 패턴 | 예시 |
|------|------|------|
| 기능 | `feature/<이름>` | `feature/layout-props` |
| 버그 수정 | `bugfix/<hash>` | `bugfix/5f3e6b3` |
| 핫픽스 | `hotfix/<설명>` | `hotfix/critical-crash` |
| 릴리즈 | `release/<버전>` | `release/0.8.0-rc.0` |

### PR 워크플로우

```
feature/xxx → develop → release/x.x.x → main
     ↓            ↓            ↓
   코드 리뷰    통합 테스트    릴리즈 QA
```

## 리뷰 요청 방법

### 1. PR 생성 시

```bash
gh pr create --reviewer reviewer1,reviewer2
```

### 2. 기존 PR에 추가

```bash
gh pr edit <번호> --add-reviewer reviewer1
```

### 3. 팀 리뷰 요청

```bash
gh pr edit <번호> --add-reviewer @sowonlabs/core-team
```

## PR 체크 확인

### CI 상태 확인

```bash
# 모든 체크 상태
gh pr checks <번호>

# 체크 통과 대기
gh pr checks <번호> --watch
```

### 실패한 체크 디버깅

```bash
# 실패한 워크플로우 로그 조회
gh run list --limit 5
gh run view <run-id> --log-failed
```

## 에이전트용 PR 생성 예시

### 기능 PR

```bash
gh pr create \
  --title "feat(sdk): Layout Props 기능 추가" \
  --body "$(cat <<'EOF'
## Summary

- Layout 템플릿에서 props를 통해 섹션 on/off 가능하도록 구현
- propsSchema에 5개 boolean 옵션 추가

## Change Type

- [x] New feature (non-breaking change that adds functionality)

## Related Issues / WBS Items

- Closes #42

## Testing

- [x] `npm run build`
- [x] `npm test --workspace @sowonai/crewx-sdk`

## Checklist

- [x] I followed the Contributing Guide
- [x] I considered backward compatibility
EOF
)" \
  --label "type:feature,component:sdk"
```

### 버그 수정 PR

```bash
gh pr create \
  --title "fix(cli): MCP 응답 파싱 에러 수정" \
  --body "$(cat <<'EOF'
## Summary

MCP 서버 응답에서 JSON 파싱 시 발생하던 크래시 수정

## Change Type

- [x] Bug fix (non-breaking change that fixes an issue)

## Related Issues / WBS Items

- Closes #35

## Testing

- [x] `npm run build`
- [x] `npm test --workspace crewx`
- [x] Manual testing performed

## Checklist

- [x] I followed the Contributing Guide
EOF
)" \
  --label "type:bug,component:cli"
```

## Draft PR 활용

진행 중인 작업에 대한 피드백을 받고 싶을 때:

```bash
# Draft PR 생성
gh pr create --draft --title "WIP: Layout Props 구현 중"

# 작업 완료 후 Ready로 변경
gh pr ready <번호>
```

## Conflict 해결

```bash
# 현재 브랜치에 base 브랜치 머지
git fetch origin
git merge origin/develop

# 또는 rebase
git rebase origin/develop

# Conflict 해결 후 push
git push --force-with-lease
```

---

## 관련 리소스

- 라벨 설정 스크립트: `scripts/setup-github-labels.sh`
- 이슈 템플릿: `.github/ISSUE_TEMPLATE/`
- PR 템플릿: `.github/PULL_REQUEST_TEMPLATE.md`

## 라벨 카테고리 요약

| 카테고리 | 용도 | 예시 |
|----------|------|------|
| `type:*` | 이슈/PR 유형 분류 | `type:bug`, `type:feature` |
| `priority:*` | 우선순위 | `priority:high`, `priority:critical` |
| `status:*` | 현재 상태 | `status:triage`, `status:in-progress` |
| `component:*` | 영향받는 컴포넌트 | `component:cli`, `component:sdk` |
| `release:*` | 릴리즈 타겟 | `release:next-minor` |
