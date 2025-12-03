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
