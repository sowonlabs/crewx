# Branch Protection Rule

## CRITICAL: NEVER Change Main Directory Branch

**ABSOLUTE RULE:** Main directory (`/Users/doha/git/crewx`) branch는 **절대 변경 금지**

현재 브랜치가 `develop`이든 `release/x.x.x`이든 **그대로 유지**해야 합니다.

## Why This Matters

메인 디렉토리 브랜치를 변경하면:
- Release Manager가 잘못된 코드 상태를 읽음
- QA가 잘못된 브랜치를 테스트함
- 다른 에이전트들이 혼란에 빠짐
- 전체 릴리스 프로세스 실패

## Rules

1. **모든 작업은 worktree에서**: 코드 수정이 필요하면 반드시 worktree 생성
2. **메인 브랜치 변경 금지**: `git checkout`, `git switch` 명령어 사용 금지
3. **worktree 작업 후**: 메인 디렉토리로 돌아오되 브랜치는 그대로

## Worktree 필수 사용

```bash
# 1. 항상 worktree 생성해서 작업
git worktree add worktree/feature-issue-42 -b feature/issue-42

# 2. worktree에서 작업
cd worktree/feature-issue-42
# (코드 수정, 커밋, PR 생성)

# 3. 작업 완료 후 메인 디렉토리로 복귀 (브랜치 변경 없이!)
cd /Users/doha/git/crewx
# git checkout 명령어 절대 사용하지 않음!
```

## Examples

### BAD - 메인 브랜치 변경
```bash
cd /Users/doha/git/crewx
git checkout feature/issue-42  # ❌ 절대 금지!
# (작업)
git checkout develop           # ❌ 절대 금지!
```

### GOOD - worktree 사용
```bash
# worktree 생성
git worktree add worktree/feature-issue-42 -b feature/issue-42

# worktree에서 작업
cd worktree/feature-issue-42
# (작업)

# 메인으로 복귀 (브랜치 변경 없음)
cd /Users/doha/git/crewx
```

## Forbidden Commands (메인 디렉토리에서)

```bash
# ❌ 이 명령어들 절대 사용 금지
git checkout <branch>
git switch <branch>
git checkout -b <branch>
```

## Allowed Commands

```bash
# ✅ worktree 관련 명령어는 허용
git worktree add ...
git worktree remove ...
git worktree list

# ✅ 읽기 전용 명령어는 허용
git status
git log
git diff
git branch -a
```

## Emergency Recovery

만약 실수로 브랜치를 변경했다면, Dev Lead에게 보고하세요.
Dev Lead만이 메인 디렉토리 브랜치를 관리할 권한이 있습니다.
