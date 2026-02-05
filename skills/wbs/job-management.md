# Job Management Guide (Job 관리 가이드)

이 문서는 WBS 프로젝트 내 Job을 생성하고 관리하는 방법을 설명합니다.

## Table of Contents

- [Job Commands Reference](#job-commands-reference)
  - [job add](#job-add)
  - [job list](#job-list)
  - [job update](#job-update)
  - [job run](#job-run)
  - [job next](#job-next)
  - [job retry](#job-retry)
- [Job 유형별 처리 방식](#job-유형별-처리-방식)
- [Agent 선택 가이드](#agent-선택-가이드)
- [Examples](#examples)

---

## Job Commands Reference

### job add

Add a new job to a WBS project.

**Syntax:**
```bash
wbs.js job add <wbs-id> --title "Job Title" --agent "@agent" [options]
```

**Required Parameters:**
- `<wbs-id>` - WBS project ID (e.g., `wbs-1`)
- `--title "Job Title"` - Short descriptive title for the job
- `--agent "@agent"` - Worker agent to execute the job (e.g., `@crewx_claude_dev`, `@claude:sonnet`)

**Optional Parameters:**
- `--desc "Detailed instructions"` or `--description "..."` - Detailed instructions for the agent
- `--seq N` - Execution sequence number (default: 0). Lower numbers execute first
- `--issue N` - Related GitHub issue number

**Behavior:**
- Generates a sequential job ID (e.g., `job-1`, `job-2`, etc.)
- Sets initial status to `pending`
- Jobs with `--issue` use existing GitHub workflow
- Jobs without `--issue` get WBS-specific git worktree instructions
- Returns JSON output with job details

**Output:**
```json
{
  "jobId": "job-3",
  "wbsId": "wbs-1",
  "title": "Design schema",
  "description": "Create User model with email, password fields",
  "agent": "@claude:sonnet",
  "seq": 1,
  "issue_number": null
}
```

**Examples:**
```bash
# Simple job without issue
wbs.js job add wbs-1 --title "Design User schema" --agent "@claude:sonnet"

# Job with detailed instructions
wbs.js job add wbs-1 --title "Implement login API" --agent "@copilot" --desc "Create POST /api/login endpoint with JWT authentication"

# Job linked to GitHub issue
wbs.js job add wbs-1 --title "Fix authentication bug" --agent "@crewx_claude_dev" --issue 42

# Job with sequence number
wbs.js job add wbs-1 --title "Write tests" --agent "@copilot" --seq 2 --desc "Unit tests for User model"

# Quick job for documentation
wbs.js job add wbs-2 --title "Update README" --agent "@crewx_codex_dev" --seq 0
```

---

### job list

List all jobs in a WBS project.

**Syntax:**
```bash
wbs.js job list <wbs-id> [--json]
```

**Parameters:**
- `<wbs-id>` (required) - WBS project ID
- `--json` (optional) - Output in JSON format instead of human-readable table

**Behavior:**
- Lists all jobs ordered by sequence number (`seq`)
- Shows job status, title, and assigned agent
- Displays progress statistics

**Output (Default):**
```
📋 Jobs for wbs-1 (5)
   Progress: 60% (3/5)

| 상태 | # | ID    | 작업명                  | 담당            | Status    |
|------|---|-------|------------------------|-----------------|-----------|
| ✅   | 1 | job-1 | Design User schema     | @claude:sonnet  | completed |
| ✅   | 2 | job-2 | Implement login API    | @copilot        | completed |
| 🟡   | 3 | job-3 | Add session mgmt       | @claude:sonnet  | running   |
| ⬜️   | 4 | job-4 | Write unit tests       | @copilot        | pending   |
| ⬜️   | 5 | job-5 | Integration tests      | @claude:opus    | pending   |
```

**Output (--json):**
```json
[
  {
    "id": "job-1",
    "wbs_id": "wbs-1",
    "title": "Design User schema",
    "description": "Create User model with email, password",
    "agent": "@claude:sonnet",
    "status": "completed",
    "seq": 1,
    "created_at": "2025-12-18T07:00:00.000Z",
    "completed_at": "2025-12-18T07:15:00.000Z",
    "issue_number": null
  }
]
```

**Status Icons:**
- ⬜️ `pending` - Not started yet
- 🟡 `running` - Currently executing
- ✅ `completed` - Successfully completed
- ❌ `failed` - Execution failed

**Examples:**
```bash
# List all jobs (human-readable)
wbs.js job list wbs-1

# List jobs in JSON format
wbs.js job list wbs-1 --json

# Count pending jobs
wbs.js job list wbs-1 --json | jq '[.[] | select(.status=="pending")] | length'

# Find failed jobs
wbs.js job list wbs-1 --json | jq '.[] | select(.status=="failed") | .title'
```

---

### job update

Update an existing job's properties.

**Syntax:**
```bash
wbs.js job update <job-id> [options]
```

**Parameters:**
- `<job-id>` (required) - Job ID to update (e.g., `job-3`)

**Update Options (at least one required):**
- `--status <status>` - Update status: `pending`, `running`, `completed`, `failed`
- `--title "New Title"` - Update job title
- `--desc "New instructions"` or `--description "..."` - Update job description
- `--agent "@new_agent"` - Update assigned agent
- `--seq N` - Update execution sequence
- `--issue N` - Update related GitHub issue number

**Behavior:**
- Only specified fields are updated
- When setting status to `completed` or `failed`, automatically sets `completed_at` timestamp
- Returns updated job object in JSON format
- Validates status values

**Output:**
```json
{
  "id": "job-3",
  "wbs_id": "wbs-1",
  "title": "Add session management",
  "description": "Implement JWT-based session handling",
  "agent": "@claude:sonnet",
  "status": "completed",
  "seq": 2,
  "created_at": "2025-12-18T08:00:00.000Z",
  "completed_at": "2025-12-18T08:45:00.000Z",
  "issue_number": null
}
```

**Examples:**
```bash
# Mark job as completed
wbs.js job update job-3 --status completed

# Update job title
wbs.js job update job-5 --title "Write comprehensive unit tests"

# Change assigned agent
wbs.js job update job-2 --agent "@claude:opus"

# Update sequence order
wbs.js job update job-4 --seq 1

# Update description
wbs.js job update job-1 --desc "Design User model with email, password, and role fields"

# Link job to GitHub issue
wbs.js job update job-6 --issue 123

# Multiple updates at once
wbs.js job update job-7 --status pending --seq 0 --agent "@copilot"

# Mark as failed
wbs.js job update job-8 --status failed

# Remove issue link (set to empty)
wbs.js job update job-9 --issue ""
```

**Status Transition Best Practices:**
- `pending` → `running` - When job starts execution
- `running` → `completed` - When job succeeds
- `running` → `failed` - When job fails
- `failed` → `pending` - To retry a failed job (or use `job retry`)
- `completed` → `pending` - To re-run a completed job

---

### job run

Run all pending jobs in a WBS project sequentially.

**Syntax:**
```bash
wbs.js job run <wbs-id>
```

**Parameters:**
- `<wbs-id>` (required) - WBS project ID

**Behavior:**
- Updates project status to `running`
- Executes jobs in sequence order (`seq` field)
- For each job:
  - Updates job status to `running`
  - Spawns worker agent via `crewx x`
  - Passes project detail document content if available
  - Includes job-specific instructions (Issue-based or WBS workflow)
  - Monitors execution with 30-minute timeout
  - Updates job status to `completed` or `failed` based on result
- Continues to next job regardless of failures
- Updates project status to `completed` (all succeeded) or `partial` (some failed) when done
- Displays progress and summary

**Output:**
```
══════════════════════════════════════════════════
[WBS] Starting project: User Authentication
══════════════════════════════════════════════════

[WBS] Running job: Design User schema
[WBS] Agent: @claude:sonnet
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent output here...]
──────────────────────────────────────────────────
[WBS] Job completed: Design User schema

[WBS] Running job: Implement login API
[WBS] Agent: @copilot
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent output here...]
──────────────────────────────────────────────────
[WBS] Job completed: Implement login API

══════════════════════════════════════════════════
[WBS] Project completed: User Authentication
[WBS] Completed: 5, Failed: 0
══════════════════════════════════════════════════
```

**Job Execution Details:**

For **Issue-based jobs** (with `--issue` flag):
```
## 작업 지시
GitHub Issue #42를 처리하세요.

**당신의 기존 개발 프로세스를 따르세요:**
1. `gh issue view 42`로 이슈 확인
2. 브랜치 생성 및 작업
3. PR 생성
4. 이슈에 결과 코멘트

WBS 추적 정보:
- WBS: wbs-1
- Job: job-3
```

For **Independent jobs** (without `--issue`):
```
## 작업 지시 (WBS 독립 작업)

이 작업은 GitHub Issue 없이 WBS에서 직접 생성된 작업입니다.

### Git 워크플로우
```bash
# 1. worktree 생성
git worktree add worktree/feature/wbs-1-3 -b feature/wbs-1-3

# 2. 해당 디렉토리에서 작업
cd worktree/feature/wbs-1-3

# 3. 작업 완료 후 PR 생성
gh pr create --title "[WBS-wbs-1] Job title" --body "WBS Job: job-3"
```

### 주의사항
- main/develop에서 직접 작업 금지
- 반드시 worktree에서 작업
- PR 생성 후 링크 출력

WBS 추적 정보:
- WBS: wbs-1
- Job: job-3
- 브랜치: feature/wbs-1-3
```

**Examples:**
```bash
# Run all pending jobs
wbs.js job run wbs-1

# Monitor in background
wbs.js job run wbs-2 > wbs-2.log 2>&1 &

# Run with notifications (example script)
wbs.js job run wbs-3 && notify-send "WBS Complete" || notify-send "WBS Failed"
```

**⚠️ Important Notes:**
- Jobs run with **30-minute timeout** each
- Failed jobs don't stop the sequence
- Use `job retry` to re-run specific failed jobs
- Check `exec list` for detailed execution history

---

### job next

Run only the next pending job in a WBS project.

**Syntax:**
```bash
wbs.js job next <wbs-id>
```

**Parameters:**
- `<wbs-id>` (required) - WBS project ID

**Behavior:**
- Finds the first `pending` job ordered by `seq`
- Executes only that job
- Returns execution result
- If no pending jobs, outputs "No pending jobs"

**Output:**
```
[WBS] Running job: Design User schema
[WBS] Agent: @claude:sonnet
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent output here...]
──────────────────────────────────────────────────
[WBS] Job completed: Design User schema

{
  "success": true,
  "execId": "exec-5"
}
```

**Use Cases:**
- Manual step-by-step execution
- Testing individual jobs
- Debugging job configurations
- Recovering from failures
- Human review between jobs

**Examples:**
```bash
# Run next job
wbs.js job next wbs-1

# Run next and review before continuing
wbs.js job next wbs-2 && read -p "Continue? (y/n) " && wbs.js job next wbs-2

# Run jobs one at a time with approval
while wbs.js job next wbs-3 --json | jq -e '.success'; do
  read -p "Next job? (y/n) " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && break
done
```

**Comparison: `job next` vs `job run`**

| Feature | `job next` | `job run` |
|---------|-----------|-----------|
| Execution | Single job | All pending jobs |
| Control | Manual | Automatic |
| Use case | Step-by-step | Full automation |
| Stops on failure | Yes | No (continues) |
| Best for | Testing, debugging | Production runs |

---

### job retry

Retry a failed or completed job.

**Syntax:**
```bash
wbs.js job retry <job-id>
```

**Parameters:**
- `<job-id>` (required) - Job ID to retry

**Behavior:**
- Resets job status to `pending`
- Immediately executes the job
- Creates new execution record
- Returns execution result

**Output:**
```
[WBS] Retrying job: Implement login API
[WBS] Running job: Implement login API
[WBS] Agent: @copilot
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent output here...]
──────────────────────────────────────────────────
[WBS] Job completed: Implement login API

{
  "success": true,
  "execId": "exec-12"
}
```

**Use Cases:**
- Retry failed jobs after fixing issues
- Re-run completed jobs with updated requirements
- Debug job configurations
- Recover from transient failures (network, API limits, etc.)

**Examples:**
```bash
# Retry a failed job
wbs.js job retry job-5

# Retry after updating job description
wbs.js job update job-3 --desc "New instructions"
wbs.js job retry job-3

# Retry all failed jobs in a project
for job in $(wbs.js job list wbs-1 --json | jq -r '.[] | select(.status=="failed") | .id'); do
  echo "Retrying $job..."
  wbs.js job retry $job
done
```

**⚠️ Note:**
- Retry preserves job configuration (title, agent, description)
- Creates a new execution record (check with `exec list`)
- Original execution history is preserved

---

## Job 유형별 처리 방식

### 1. Issue 기반 작업 (프로세스 O)

**사용 시점**: GitHub Issue가 이미 있는 경우

```bash
node wbs.js job add <wbs-id> --title "이슈 제목" --agent "@crewx_claude_dev" --issue 42
```

**워커에게 전달되는 지시**:
- "GitHub Issue #42를 처리하세요"
- "당신의 기존 개발 프로세스를 따르세요"
- 워커는 자신의 프롬프트에 정의된 이슈 처리 프로세스 수행

**장점**:
- 개발자 에이전트의 기존 워크플로우 활용
- 이슈-브랜치-PR 연결 자동화
- 트래킹 용이

---

### 2. 독립 작업 (프로세스 X)

**사용 시점**: 빠른 작업, 이슈 없이 직접 지시하는 경우

```bash
node wbs.js job add <wbs-id> --title "간단한 작업 설명" --agent "@crewx_claude_dev"
```

**워커에게 전달되는 지시**:
- WBS 전용 브랜치 명명 규칙 (`feature/wbs-{id}-{job}`)
- Worktree 생성 명령어
- PR 생성 템플릿

**사용 예시**:
- 문서 업데이트
- 간단한 리팩토링
- 실험적 작업

---

## Agent 선택 가이드

| Agent | 적합한 작업 |
|-------|------------|
| `@crewx_claude_dev` | 복잡한 로직, 아키텍처 설계, 신중한 작업 |
| `@crewx_codex_dev` | 단순 구현, 보일러플레이트, 빠른 작업 |
| `@crewx_gemini_dev` | 성능 분석, 데이터 처리 |
| `@crewx_crush_dev` | 간단한 작업 (성능 제한 있음) |

---

## Job 생성 시 체크리스트

1. [ ] 적절한 에이전트 선택
2. [ ] Issue가 있으면 `--issue N` 옵션 사용
3. [ ] 작업 제목은 명확하게 (30분 내 완료 가능한 단위)
4. [ ] 필요시 `--desc`로 상세 지시 추가

---

## 주의사항

- **모델 오버라이드 금지**: `@crewx_claude_dev:sonnet` (X) → `@crewx_claude_dev` (O)
- **30분 타임박싱**: 45분 초과 작업은 분해 필요
- **의존성 순서**: `--seq` 옵션으로 실행 순서 지정

---

## Examples

### Complete Workflow Example

```bash
# 1. Create a WBS project
wbs.js create "User Authentication System"
# Output: { "id": "wbs-5", "title": "User Authentication System", ... }

# 2. Add jobs for the project
wbs.js job add wbs-5 --title "Design User model" --agent "@claude:sonnet" --seq 1
wbs.js job add wbs-5 --title "Implement JWT auth" --agent "@copilot" --seq 2 --desc "Create JWT token generation and validation"
wbs.js job add wbs-5 --title "Add login endpoint" --agent "@copilot" --seq 3
wbs.js job add wbs-5 --title "Write unit tests" --agent "@claude:sonnet" --seq 4
wbs.js job add wbs-5 --title "Update documentation" --agent "@crewx_codex_dev" --seq 5

# 3. Review jobs before running
wbs.js job list wbs-5

# 4. Run all jobs
wbs.js job run wbs-5

# 5. Check final status
wbs.js status wbs-5
```

### Issue-Based Workflow

```bash
# 1. Create project
wbs.js create "Bug Fixes Sprint"

# 2. Add jobs linked to GitHub issues
wbs.js job add wbs-6 --title "Fix login bug" --agent "@crewx_claude_dev" --issue 123 --seq 1
wbs.js job add wbs-6 --title "Fix session timeout" --agent "@crewx_claude_dev" --issue 124 --seq 2
wbs.js job add wbs-6 --title "Fix password reset" --agent "@crewx_claude_dev" --issue 125 --seq 3

# 3. Run next job manually to test
wbs.js job next wbs-6

# 4. If successful, run remaining jobs
wbs.js job run wbs-6
```

### Step-by-Step Manual Execution

```bash
# 1. Create project with jobs
wbs.js create "API Refactoring"
wbs.js job add wbs-7 --title "Refactor auth endpoints" --agent "@claude:opus" --seq 1
wbs.js job add wbs-7 --title "Update tests" --agent "@copilot" --seq 2
wbs.js job add wbs-7 --title "Update docs" --agent "@crewx_codex_dev" --seq 3

# 2. Run first job
wbs.js job next wbs-7

# 3. Review results, then continue
wbs.js status wbs-7
wbs.js job next wbs-7

# 4. If something fails, update and retry
wbs.js job update job-8 --desc "Updated instructions with more details"
wbs.js job retry job-8

# 5. Continue with remaining jobs
wbs.js job next wbs-7
```

### Handling Failures

```bash
# 1. Check which jobs failed
wbs.js job list wbs-5 --json | jq '.[] | select(.status=="failed")'

# 2. Review execution history
wbs.js exec list job-10

# 3. Update job configuration
wbs.js job update job-10 --desc "Fixed: Use correct API endpoint"

# 4. Retry the failed job
wbs.js job retry job-10

# 5. Or retry all failed jobs
for job in $(wbs.js job list wbs-5 --json | jq -r '.[] | select(.status=="failed") | .id'); do
  wbs.js job retry $job
done
```

### Updating Job Sequences

```bash
# 1. View current job order
wbs.js job list wbs-8

# 2. Reorder jobs by updating sequence
wbs.js job update job-15 --seq 0  # Move to first
wbs.js job update job-16 --seq 1  # Second
wbs.js job update job-17 --seq 2  # Third

# 3. Verify new order
wbs.js job list wbs-8
```

### Monitoring Progress

```bash
# Monitor script (monitor-wbs.sh)
#!/bin/bash
WBS_ID="wbs-9"

while true; do
  clear
  wbs.js status $WBS_ID

  PROGRESS=$(wbs.js status $WBS_ID --json | jq '.summary.progress')

  if [ "$PROGRESS" -eq 100 ]; then
    echo -e "\n✅ Project complete!"
    break
  fi

  echo -e "\n⏳ Checking again in 60 seconds..."
  sleep 60
done

# Run monitor
chmod +x monitor-wbs.sh
./monitor-wbs.sh
```

### Batch Operations

```bash
# Add multiple jobs from a file
cat jobs.txt | while IFS='|' read -r title agent seq desc; do
  wbs.js job add wbs-10 --title "$title" --agent "$agent" --seq "$seq" --desc "$desc"
done

# Example jobs.txt:
# Design schema|@claude:sonnet|1|Create database schema
# Implement API|@copilot|2|REST API endpoints
# Write tests|@claude:sonnet|3|Unit and integration tests

# Export job list to CSV
echo "ID,Title,Status,Agent,Seq" > jobs-export.csv
wbs.js job list wbs-10 --json | jq -r '.[] | [.id,.title,.status,.agent,.seq] | @csv' >> jobs-export.csv
```

### Integration with CI/CD

```bash
# GitHub Actions example (.github/workflows/wbs.yml)
name: WBS Job Runner

on:
  workflow_dispatch:
    inputs:
      wbs_id:
        description: 'WBS Project ID'
        required: true
        type: string

jobs:
  run-wbs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm install

      - name: Run WBS jobs
        run: |
          node wbs.js job run ${{ inputs.wbs_id }}

      - name: Check results
        run: |
          node wbs.js status ${{ inputs.wbs_id }} --json | jq '.summary'
```

### Advanced: Parallel Job Execution (Future)

```bash
# Note: Current implementation runs sequentially
# For parallel execution in future versions:

# 1. Mark jobs with same seq for parallel execution
wbs.js job add wbs-11 --title "Task A" --agent "@claude:sonnet" --seq 1
wbs.js job add wbs-11 --title "Task B" --agent "@copilot" --seq 1
wbs.js job add wbs-11 --title "Task C" --agent "@gemini" --seq 1
wbs.js job add wbs-11 --title "Task D" --agent "@claude:opus" --seq 2  # Runs after 1

# 2. Jobs with seq=1 would run in parallel
# 3. Job with seq=2 waits for all seq=1 to complete
```

---

## Quick Reference

### Command Summary

| Command | Purpose | Usage |
|---------|---------|-------|
| `job add` | Create new job | `wbs.js job add <wbs-id> --title "..." --agent "@..."` |
| `job list` | List all jobs | `wbs.js job list <wbs-id> [--json]` |
| `job update` | Update job properties | `wbs.js job update <job-id> [options]` |
| `job run` | Run all pending jobs | `wbs.js job run <wbs-id>` |
| `job next` | Run next pending job | `wbs.js job next <wbs-id>` |
| `job retry` | Retry a job | `wbs.js job retry <job-id>` |

### Common Patterns

**Create and run:**
```bash
wbs.js create "Project" && wbs.js job add wbs-X ... && wbs.js job run wbs-X
```

**List failed jobs:**
```bash
wbs.js job list wbs-X --json | jq '.[] | select(.status=="failed")'
```

**Retry all failed:**
```bash
for job in $(wbs.js job list wbs-X --json | jq -r '.[] | select(.status=="failed") | .id'); do wbs.js job retry $job; done
```

**Check progress:**
```bash
wbs.js status wbs-X --json | jq '.summary.progress'
```

---

## Related Documentation

- [WBS Commands Reference](./COMMANDS.md) - Project-level commands (create, list, status, delete)
- [Execution Management](./DESIGN.md) - Execution tracking and monitoring
- [WBS Skill Overview](./SKILL.md) - High-level skill documentation
- [CrewX CLI Documentation](../../CLAUDE.md) - CrewX platform overview
