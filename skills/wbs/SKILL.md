---
name: wbs
description: Work Breakdown Structure (WBS) management skill. Enables AI coordinators to decompose complex tasks into 30-minute timeboxed jobs and execute them via worker agents.
version: 0.1.0
---

# WBS Skill

Provides state management and worker execution for Work Breakdown Structure based task decomposition.

## Core Principle

**System provides state management, AI agent makes intelligent decisions.**

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Coordinator Agent (with WBS skill)                 │
│  - Analyze request (AI judgment)                    │
│  - Decompose into 30-min Jobs (AI judgment)         │
│  - Execute workers: crewx x "@agent action"         │
│  - Track state: wbs.js                              │
└─────────────────────────────────────────────────────┘
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Worker1 │   │ Worker2 │   │ Worker3 │
│ @claude │   │ @gemini │   │ @copilot│
└─────────┘   └─────────┘   └─────────┘
```

## What is WBS Skill?

The WBS (Work Breakdown Structure) skill is a **project management system for complex AI-driven tasks**. It enables coordinator agents to:

1. **Decompose complex tasks** into manageable 30-minute jobs
2. **Track progress** with state management (pending → running → completed/failed)
3. **Coordinate multiple agents** by assigning different jobs to specialized workers
4. **Manage context** through detail documents and structured workflow
5. **Execute in parallel** by distributing jobs across multiple worker agents

### Key Characteristics

- **Structured Approach**: Projects are broken down into jobs with clear status tracking
- **Time-Boxed Execution**: Each job targets 15-45 minutes (optimal: 25-30 min)
- **Multi-Agent Coordination**: Different jobs can be assigned to different AI agents
- **State Persistence**: All project data, jobs, and execution history are tracked in `.wbs-data.json`
- **Automated Workflow**: Git branching, PR templates, and issue tracking integration

## When to Use WBS Skill

### Use WBS When

Choose WBS for tasks that meet **any** of these criteria:

- **Complex multi-step tasks** (> 45 minutes total)
  - Feature implementations spanning multiple files/modules
  - Large-scale refactoring projects
  - Bug fix sprints with multiple related issues

- **30-minute timeboxing needed**
  - Tasks prone to context loss (LLM "Lost in the Middle" problem)
  - Work requiring periodic checkpoints and validation
  - Projects where partial progress needs to be tracked

- **Parallel execution beneficial**
  - Jobs that can be distributed across multiple worker agents
  - Tasks where different agents excel at different subtasks
  - Work that benefits from concurrent execution

- **Progress tracking important**
  - Team collaboration requiring visibility into task status
  - Projects with external stakeholders needing updates
  - Work where partial failure recovery is critical

- **GitHub integration needed**
  - Tasks linked to GitHub issues
  - Projects requiring structured PR workflows
  - Work following standardized git branching strategies

### Use Direct Delegation When

Skip WBS for simpler scenarios:

- Single-step tasks (< 15 minutes)
- One-off file modifications
- Quick code analysis or queries
- Rapid prototyping without tracking needs
- Tasks with no need for state persistence

### Decision Flow

```
Task received
    │
    ▼
Expected duration?
    │
    ├─── < 15 min ──────────────────────► Direct Delegation
    │
    ├─── 15-45 min ─┬─ Single step ──────► Direct Delegation
    │               └─ Multi-step ────────► WBS Skill
    │
    └─── > 45 min ──────────────────────► WBS Skill (required)
```

## Use Case Examples

### 1. Complex Feature Implementation

**Scenario**: Implement user authentication system

```bash
# WBS approach - structured and tracked
wbs.js create "User Authentication Implementation"
wbs.js job add wbs-1 --title "Design User model" --agent "@claude:sonnet" --seq 1
wbs.js job add wbs-1 --title "Implement login API" --agent "@copilot" --seq 2
wbs.js job add wbs-1 --title "Add JWT handling" --agent "@copilot" --seq 3
wbs.js job add wbs-1 --title "Write unit tests" --agent "@claude:sonnet" --seq 4
wbs.js job run wbs-1
```

**Why WBS**: Multi-step process, multiple agents, progress tracking needed

### 2. Bug Fix Sprint

**Scenario**: Fix multiple related authentication bugs

```bash
# WBS approach - organized issue resolution
wbs.js create "Bug Fix Sprint"
wbs.js job add wbs-2 --title "Fix login bug" --agent "@claude" --issue 42 --seq 1
wbs.js job add wbs-2 --title "Fix session timeout" --agent "@claude" --issue 43 --seq 2
wbs.js job add wbs-2 --title "Fix password reset" --agent "@claude" --issue 44 --seq 3
wbs.js job run wbs-2
```

**Why WBS**: Multiple issues, GitHub integration, failure recovery important

### 3. Large Refactoring

**Scenario**: Refactor API layer across multiple modules

```bash
# WBS approach - context preservation across modules
wbs.js create "API Refactoring"
wbs.js job add wbs-3 --title "Refactor auth module" --agent "@claude" --seq 1
wbs.js job add wbs-3 --title "Refactor user module" --agent "@claude" --seq 2
wbs.js job add wbs-3 --title "Update tests" --agent "@copilot" --seq 3
wbs.js job run wbs-3
```

**Why WBS**: Context preservation critical, step-by-step validation needed

### 4. Simple Code Fix (No WBS)

**Scenario**: Fix a typo in documentation

```bash
# Direct delegation - immediate execution
crewx x "@claude Fix typo in README.md line 42"
```

**Why Direct**: Single-step, < 15 minutes, no tracking needed

## 30-Minute Timeboxing

| Category | Time | Description |
|----------|------|-------------|
| Minimum | 15 min | Below this → don't separate as Job |
| Optimal | 25-30 min | Target duration |
| Maximum | 45 min | Above this → re-decompose |

**Rationale**: LLM context limits (Lost in the Middle, Context Rot) + Pomodoro Technique

## Installation

```bash
cd skills/wbs
npm install
```

Requires Node.js 16+.

## Commands Reference

### Project Management Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| **create** | `wbs.js create "Title" [--detail path]` | Create new WBS project with sequential ID (wbs-1, wbs-2, ...) |
| **list** | `wbs.js list [--json]` | List all projects with status and progress |
| **status** | `wbs.js status <wbs-id> [--json]` | Get detailed project info including all jobs and summary stats |
| **delete** | `wbs.js delete <wbs-id>` | Delete project and all associated jobs/executions (irreversible) |

### Job Management Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| **job add** | `wbs.js job add <wbs-id> --title "Title" --agent "@agent" [options]` | Add new job to project. Options: `--desc`, `--seq`, `--issue` |
| **job list** | `wbs.js job list <wbs-id> [--json]` | List all jobs ordered by sequence number |
| **job update** | `wbs.js job update <job-id> [options]` | Update job properties. Options: `--status`, `--title`, `--desc`, `--agent`, `--seq`, `--issue` |
| **job run** | `wbs.js job run <wbs-id>` | Execute all pending jobs sequentially (30-min timeout each) |
| **job next** | `wbs.js job next <wbs-id>` | Execute only the next pending job (manual step-by-step) |
| **job retry** | `wbs.js job retry <job-id>` | Retry a failed or completed job |

### Execution Management Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| **exec list** | `wbs.js exec list <job-id> [--json]` | List execution history for a job |
| **exec status** | `wbs.js exec status <exec-id> [--json]` | Get detailed execution info |
| **exec kill** | `wbs.js exec kill <exec-id>` | Kill a running execution |
| **exec running** | `wbs.js exec running [--json]` | List all currently running executions |

### Coordinator Commands (Natural Language)

| Command | Syntax | Description |
|---------|--------|-------------|
| **q** | `wbs.js q "질문"` | Ask coordinator a question (via `@wbs_coordinator`) |
| **x** | `wbs.js x "요청"` | Request coordinator to execute an action |

### Daemon Commands (Background Scheduler)

| Command | Syntax | Description |
|---------|--------|-------------|
| **daemon start** | `wbs.js daemon start` | Start background scheduler |
| **daemon stop** | `wbs.js daemon stop` | Stop running daemon |
| **daemon status** | `wbs.js daemon status` | Check daemon status |
| **daemon tick** | `wbs.js daemon tick` | Manual tick for testing |

### Common Usage Patterns

```bash
# Create and run a complete project
wbs.js create "User Authentication"
wbs.js job add wbs-1 --title "Design schema" --agent "@claude:sonnet" --seq 1
wbs.js job add wbs-1 --title "Implement API" --agent "@copilot" --seq 2
wbs.js job add wbs-1 --title "Write tests" --agent "@claude:sonnet" --seq 3
wbs.js job run wbs-1

# Check progress
wbs.js status wbs-1

# Handle failures
wbs.js job list wbs-1 --json | jq '.[] | select(.status=="failed")'
wbs.js job retry job-5

# Issue-based workflow
wbs.js job add wbs-2 --title "Fix bug" --agent "@claude" --issue 42
```

### Output Formats

- **Default**: Human-readable tables with emoji status icons
- **--json**: Machine-parseable JSON for scripting and automation

For detailed command documentation, see:
- [COMMANDS.md](./COMMANDS.md) - Complete project commands reference
- [job-management.md](./job-management.md) - Comprehensive job management guide

## Practical Usage Examples

This section provides comprehensive real-world examples of using the WBS skill effectively.

### Example 1: Simple Workflow (Create → Add Jobs → Run)

The most basic WBS workflow involves creating a project, adding jobs, and running them sequentially.

**Scenario**: Build a simple REST API for a todo application

```bash
# 1. Create the project
node wbs.js create "Todo REST API"
```

**Expected output:**
```json
{
  "id": "wbs-1",
  "title": "Todo REST API",
  "status": "planning",
  "detailPath": "skills/wbs/details/wbs-1-detail.md",
  "created_at": "2025-12-18T08:00:00.000Z"
}
```

```bash
# 2. Add jobs for implementation
node wbs.js job add wbs-1 \
  --title "Design database schema" \
  --agent "@claude:sonnet" \
  --seq 1 \
  --desc "Create SQLite schema for todos table with id, title, completed, created_at fields"

node wbs.js job add wbs-1 \
  --title "Implement CRUD endpoints" \
  --agent "@copilot" \
  --seq 2 \
  --desc "Create Express routes: GET /todos, POST /todos, PUT /todos/:id, DELETE /todos/:id"

node wbs.js job add wbs-1 \
  --title "Add input validation" \
  --agent "@claude:sonnet" \
  --seq 3 \
  --desc "Implement request validation middleware using express-validator"

node wbs.js job add wbs-1 \
  --title "Write integration tests" \
  --agent "@copilot" \
  --seq 4 \
  --desc "Create test suite covering all CRUD operations using supertest"
```

```bash
# 3. Review the planned jobs
node wbs.js status wbs-1
```

**Expected output:**
```
📋 Todo REST API (wbs-1)
   Status: planning | Progress: 0% (0/4)
   Detail: skills/wbs/details/wbs-1-detail.md

   Jobs:
   | 상태 | #  | ID    | 작업명                    | 담당            |
   |------|----|----|--------------------------|-----------------|
   | ⬜️  | 1  | job-1 | Design database schema    | @claude:sonnet  |
   | ⬜️  | 2  | job-2 | Implement CRUD endpoints  | @copilot        |
   | ⬜️  | 3  | job-3 | Add input validation      | @claude:sonnet  |
   | ⬜️  | 4  | job-4 | Write integration tests   | @copilot        |
```

```bash
# 4. Run all jobs
node wbs.js job run wbs-1
```

**Expected output:**
```
══════════════════════════════════════════════════
[WBS] Starting project: Todo REST API
══════════════════════════════════════════════════

[WBS] Running job: Design database schema
[WBS] Agent: @claude:sonnet
[WBS] Description: Create SQLite schema for todos table...
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent executes and produces output...]
──────────────────────────────────────────────────
[WBS] Job completed: Design database schema

[WBS] Running job: Implement CRUD endpoints
[WBS] Agent: @copilot
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent executes and produces output...]
──────────────────────────────────────────────────
[WBS] Job completed: Implement CRUD endpoints

[... continues for remaining jobs ...]

══════════════════════════════════════════════════
[WBS] Project completed: Todo REST API
[WBS] Completed: 4, Failed: 0
══════════════════════════════════════════════════
```

```bash
# 5. Verify completion
node wbs.js status wbs-1
```

**Final output:**
```
📋 Todo REST API (wbs-1)
   Status: completed | Progress: 100% (4/4)
   Detail: skills/wbs/details/wbs-1-detail.md

   Jobs:
   | 상태 | #  | ID    | 작업명                    | 담당            | Status    |
   |------|----|----|--------------------------|-----------------|-----------|
   | ✅   | 1  | job-1 | Design database schema    | @claude:sonnet  | completed |
   | ✅   | 2  | job-2 | Implement CRUD endpoints  | @copilot        | completed |
   | ✅   | 3  | job-3 | Add input validation      | @claude:sonnet  | completed |
   | ✅   | 4  | job-4 | Write integration tests   | @copilot        | completed |
```

---

### Example 2: Issue-Based Workflow

Use WBS to manage multiple GitHub issues systematically.

**Scenario**: Fix authentication-related bugs tracked in GitHub

```bash
# 1. Create project for bug fixes
node wbs.js create "Authentication Bug Fixes"
```

**Output:**
```json
{
  "id": "wbs-2",
  "title": "Authentication Bug Fixes",
  "status": "planning"
}
```

```bash
# 2. Add jobs linked to GitHub issues
node wbs.js job add wbs-2 \
  --title "Fix: Login fails with special characters in password" \
  --agent "@claude:sonnet" \
  --issue 123 \
  --seq 1

node wbs.js job add wbs-2 \
  --title "Fix: Session timeout not working" \
  --agent "@claude:sonnet" \
  --issue 124 \
  --seq 2

node wbs.js job add wbs-2 \
  --title "Fix: Password reset email not sent" \
  --agent "@claude:sonnet" \
  --issue 125 \
  --seq 3
```

**What happens during execution:**

When you run `node wbs.js job run wbs-2`, each job receives these instructions:

```
## 작업 지시
GitHub Issue #123를 처리하세요.

**당신의 기존 개발 프로세스를 따르세요:**
1. `gh issue view 123`로 이슈 확인
2. 브랜치 생성 및 작업
3. PR 생성
4. 이슈에 결과 코멘트

WBS 추적 정보:
- WBS: wbs-2
- Job: job-1
```

**Advantages:**
- Automatic issue-branch-PR linking
- Agent follows its own development workflow
- Easy progress tracking via GitHub
- Issue comments document resolution

---

### Example 3: Step-by-Step Execution

Execute jobs manually one at a time with review between each step.

**Scenario**: Refactoring legacy code where each step needs verification

```bash
# 1. Create project
node wbs.js create "Legacy Code Refactoring"

# 2. Add jobs
node wbs.js job add wbs-3 \
  --title "Extract UserService from monolithic controller" \
  --agent "@claude:opus" \
  --seq 1 \
  --desc "Move user-related logic from AppController to new UserService class"

node wbs.js job add wbs-3 \
  --title "Add dependency injection" \
  --agent "@claude:sonnet" \
  --seq 2 \
  --desc "Refactor UserService to use constructor injection for database"

node wbs.js job add wbs-3 \
  --title "Update unit tests" \
  --agent "@copilot" \
  --seq 3 \
  --desc "Modify tests to work with new UserService architecture"

node wbs.js job add wbs-3 \
  --title "Verify integration tests pass" \
  --agent "@copilot" \
  --seq 4 \
  --desc "Run full test suite and fix any integration issues"
```

```bash
# 3. Execute first job only
node wbs.js job next wbs-3
```

**Output:**
```
[WBS] Running job: Extract UserService from monolithic controller
[WBS] Agent: @claude:opus
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent output...]
──────────────────────────────────────────────────
[WBS] Job completed: Extract UserService from monolithic controller

{
  "success": true,
  "execId": "exec-1"
}
```

```bash
# 4. Review changes before continuing
git diff
npm test

# 5. If satisfied, run next job
node wbs.js job next wbs-3
```

**Output:**
```
[WBS] Running job: Add dependency injection
[WBS] Agent: @claude:sonnet
...
```

```bash
# 6. Continue step by step
node wbs.js status wbs-3  # Check progress
node wbs.js job next wbs-3  # Run next job
```

**Use cases for step-by-step execution:**
- Code reviews between steps
- Testing after each change
- Learning/understanding the codebase
- High-risk refactoring
- Debugging job configurations

---

### Example 4: Handling Failures

Recover from failed jobs and retry with updated configurations.

**Scenario**: API implementation where initial attempts fail

```bash
# 1. Create project and add jobs
node wbs.js create "Payment API Integration"

node wbs.js job add wbs-4 \
  --title "Integrate Stripe SDK" \
  --agent "@copilot" \
  --seq 1

node wbs.js job add wbs-4 \
  --title "Implement payment endpoint" \
  --agent "@claude:sonnet" \
  --seq 2

node wbs.js job add wbs-4 \
  --title "Add webhook handler" \
  --agent "@claude:sonnet" \
  --seq 3

# 2. Run all jobs
node wbs.js job run wbs-4
```

**Suppose job-2 fails:**

```
[WBS] Running job: Implement payment endpoint
[WBS] Agent: @claude:sonnet
──────────────────────────────────────────────────
Error: Missing API key configuration
──────────────────────────────────────────────────
[WBS] Job failed: Implement payment endpoint
```

```bash
# 3. Check which jobs failed
node wbs.js job list wbs-4 --json | jq '.[] | select(.status=="failed")'
```

**Output:**
```json
{
  "id": "job-2",
  "wbs_id": "wbs-4",
  "title": "Implement payment endpoint",
  "status": "failed",
  "agent": "@claude:sonnet",
  "seq": 2
}
```

```bash
# 4. Review execution history
node wbs.js exec list job-2
```

**Output:**
```
📋 Executions for job-2

| 상태 | ID      | PID   | 시작                | 종료                | 코드 |
|------|---------|-------|---------------------|---------------------|------|
| ❌   | exec-2  | 45678 | 2025-12-18 09:15:00 | 2025-12-18 09:18:00 | 1    |
```

```bash
# 5. Fix the issue (add environment variable or update job description)
node wbs.js job update job-2 \
  --desc "Implement payment endpoint. Use STRIPE_API_KEY from .env file. Handle both test and production modes."

# 6. Retry the failed job
node wbs.js job retry job-2
```

**Output:**
```
[WBS] Retrying job: Implement payment endpoint
[WBS] Running job: Implement payment endpoint
[WBS] Agent: @claude:sonnet
[WBS] Timeout: 30 minutes
──────────────────────────────────────────────────
[Agent output...]
──────────────────────────────────────────────────
[WBS] Job completed: Implement payment endpoint

{
  "success": true,
  "execId": "exec-5"
}
```

```bash
# 7. Continue with remaining jobs
node wbs.js job run wbs-4
```

**Final status:**
```
📋 Payment API Integration (wbs-4)
   Status: completed | Progress: 100% (3/3)

   Jobs:
   | 상태 | #  | ID    | 작업명                    | Status    |
   |------|----|----|--------------------------|-----------|
   | ✅   | 1  | job-1 | Integrate Stripe SDK      | completed |
   | ✅   | 2  | job-2 | Implement payment endpoint| completed |
   | ✅   | 3  | job-3 | Add webhook handler       | completed |
```

**Batch retry all failed jobs:**
```bash
# Find and retry all failed jobs in a project
for job in $(node wbs.js job list wbs-4 --json | jq -r '.[] | select(.status=="failed") | .id'); do
  echo "Retrying $job..."
  node wbs.js job retry $job
done
```

---

### Example 5: Complex Multi-Agent Coordination

Distribute work across different AI agents based on their strengths.

**Scenario**: Build a full-stack feature with frontend, backend, and tests

```bash
# 1. Create project
node wbs.js create "User Profile Feature"

# 2. Add jobs with appropriate agent selection
# Backend work - @claude:sonnet for complex logic
node wbs.js job add wbs-5 \
  --title "Design User Profile data model" \
  --agent "@claude:sonnet" \
  --seq 1 \
  --desc "Create schema with fields: avatar, bio, social_links, preferences"

# Implementation - @copilot for straightforward coding
node wbs.js job add wbs-5 \
  --title "Implement profile CRUD API" \
  --agent "@copilot" \
  --seq 2 \
  --desc "REST endpoints for profile operations with validation"

# Complex architecture - @claude:opus for advanced decisions
node wbs.js job add wbs-5 \
  --title "Design avatar upload system" \
  --agent "@claude:opus" \
  --seq 3 \
  --desc "S3 integration with image processing, CDN, and caching strategy"

# Implementation again
node wbs.js job add wbs-5 \
  --title "Implement avatar upload" \
  --agent "@copilot" \
  --seq 4 \
  --desc "File upload endpoint with S3 SDK and image optimization"

# Frontend - @claude:sonnet for React components
node wbs.js job add wbs-5 \
  --title "Create profile edit form" \
  --agent "@claude:sonnet" \
  --seq 5 \
  --desc "React component with form validation and avatar preview"

# Testing - @copilot excels at test generation
node wbs.js job add wbs-5 \
  --title "Write comprehensive tests" \
  --agent "@copilot" \
  --seq 6 \
  --desc "Unit tests for API, integration tests, and React Testing Library tests"

# 3. Run the entire pipeline
node wbs.js job run wbs-5
```

**Agent selection rationale:**
- `@claude:sonnet`: Complex logic, architecture, React components
- `@claude:opus`: Very complex architectural decisions
- `@copilot`: Straightforward implementation, test generation
- `@gemini`: Performance optimization, data analysis (not shown here)

---

### Example 6: Working with Detail Documents

Use detail documents to provide comprehensive context to all jobs.

```bash
# 1. Create project with detail document
node wbs.js create "E-commerce Checkout Flow" --detail ./docs/checkout-spec.md

# The system creates: skills/wbs/details/wbs-6-detail.md
```

**Edit the detail document:**

```bash
# Edit skills/wbs/details/wbs-6-detail.md
```

**Content:**
```markdown
# E-commerce Checkout Flow

## Overview
Implement a secure checkout process for our e-commerce platform.

## Requirements

### Functional Requirements
1. Multi-step checkout (cart → shipping → payment → confirmation)
2. Address validation with autocomplete
3. Multiple payment methods (credit card, PayPal)
4. Order summary with promo codes
5. Email confirmation

### Technical Requirements
- Payment processing via Stripe
- Address validation via Google Maps API
- Session management for cart persistence
- Transactional email via SendGrid

### Security
- PCI compliance for credit card handling
- HTTPS only
- CSRF protection
- Rate limiting on payment endpoints

### Performance
- Checkout flow should complete in < 3 seconds
- Optimize for mobile devices

## References
- [Stripe API Docs](https://stripe.com/docs/api)
- [Design Mockups](./figma-link)
```

**Add jobs:**
```bash
node wbs.js job add wbs-6 \
  --title "Implement multi-step form navigation" \
  --agent "@claude:sonnet" \
  --seq 1

node wbs.js job add wbs-6 \
  --title "Integrate Stripe payment" \
  --agent "@copilot" \
  --seq 2

# ... more jobs
```

**When jobs run, they automatically receive the detail document content as context.**

---

### Example 7: Monitoring and JSON Output

Automate WBS monitoring and integrate with other tools.

**Check project status programmatically:**
```bash
# Get JSON output for scripting
node wbs.js status wbs-1 --json | jq '.summary'
```

**Output:**
```json
{
  "total_jobs": 4,
  "completed": 4,
  "failed": 0,
  "pending": 0,
  "running": 0,
  "progress": 100
}
```

**Create a monitoring script:**
```bash
#!/bin/bash
# monitor-wbs.sh

WBS_ID="wbs-7"

while true; do
  clear
  echo "═══════════════════════════════════════"
  echo "  WBS Monitor - $WBS_ID"
  echo "═══════════════════════════════════════"

  node wbs.js status $WBS_ID

  PROGRESS=$(node wbs.js status $WBS_ID --json | jq -r '.summary.progress')

  if [ "$PROGRESS" -eq 100 ]; then
    echo ""
    echo "✅ Project complete!"
    break
  fi

  echo ""
  echo "⏳ Checking again in 60 seconds..."
  sleep 60
done
```

**Run monitor:**
```bash
chmod +x monitor-wbs.sh
./monitor-wbs.sh
```

**Export jobs to CSV:**
```bash
# Export job list
echo "ID,Title,Status,Agent,Seq" > jobs-export.csv
node wbs.js job list wbs-1 --json | \
  jq -r '.[] | [.id,.title,.status,.agent,.seq] | @csv' >> jobs-export.csv
```

**Check specific job execution history:**
```bash
# List all executions for a job
node wbs.js exec list job-5 --json | jq '.'
```

---

### Example 8: Recovering from Interruptions

Handle scenarios where execution is interrupted.

**Scenario**: Long-running project interrupted by system crash

```bash
# 1. Check current status
node wbs.js list
```

**Output:**
```
📋 WBS Projects (3)

| ID    | 제목                    | 상태      | 진행      |
|-------|-----------------------|----------|----------|
| wbs-1 | Todo REST API         | completed| 100% 4/4 |
| wbs-2 | Bug Fixes             | running  | 50% 2/4  |
| wbs-3 | Refactoring           | planning | 0% 0/5   |
```

```bash
# 2. Check which jobs were running
node wbs.js status wbs-2
```

**Output:**
```
📋 Bug Fixes (wbs-2)
   Status: running | Progress: 50% (2/4)

   Jobs:
   | 상태 | #  | ID    | 작업명         | Status    |
   |------|----|----|---------------|-----------|
   | ✅   | 1  | job-1 | Fix bug #123   | completed |
   | ✅   | 2  | job-2 | Fix bug #124   | completed |
   | 🟡   | 3  | job-3 | Fix bug #125   | running   |
   | ⬜️  | 4  | job-4 | Fix bug #126   | pending   |
```

```bash
# 3. Check if the running job actually completed
node wbs.js exec list job-3
```

**If the execution failed or timed out:**
```
| 상태 | ID      | PID   | 시작                | 종료                | 코드 |
|------|---------|-------|---------------------|---------------------|------|
| ❌   | exec-7  | 23456 | 2025-12-18 10:30:00 | N/A (timeout)       | -1   |
```

```bash
# 4. Reset the job and retry
node wbs.js job update job-3 --status pending
node wbs.js job retry job-3

# 5. Continue with remaining jobs
node wbs.js job run wbs-2
```

---

### Summary: Quick Command Reference

**Basic workflow:**
```bash
# Create → Add → Run → Check
node wbs.js create "Project Name"
node wbs.js job add wbs-X --title "Task" --agent "@agent" --seq N
node wbs.js job run wbs-X
node wbs.js status wbs-X
```

**Issue-based workflow:**
```bash
node wbs.js create "Bug Fixes"
node wbs.js job add wbs-X --title "Fix bug" --agent "@agent" --issue 123
node wbs.js job run wbs-X
```

**Step-by-step workflow:**
```bash
node wbs.js job next wbs-X  # Run one job
# Review changes...
node wbs.js job next wbs-X  # Run next
```

**Handle failures:**
```bash
node wbs.js job list wbs-X --json | jq '.[] | select(.status=="failed")'
node wbs.js job update job-Y --desc "Updated instructions"
node wbs.js job retry job-Y
```

**Monitoring:**
```bash
node wbs.js list
node wbs.js status wbs-X
node wbs.js status wbs-X --json | jq '.summary'
```

For more examples, see:
- [EXAMPLE.md](./EXAMPLE.md) - Korean language detailed walkthrough
- [job-management.md](./job-management.md) - Job-specific examples and patterns

## Usage in Coordinator Agent

The coordinator agent uses this skill programmatically:

```javascript
const wbs = require('./wbs.js');

// 1. Create project
const id = wbs.create('User Authentication Implementation');

// 2. Add jobs (AI decomposed)
wbs.addJob(id, { title: 'Design User model', agent: '@claude:sonnet', seq: 1 });
wbs.addJob(id, { title: 'Implement login API', agent: '@copilot', seq: 2 });
wbs.addJob(id, { title: 'Write tests', agent: '@claude:sonnet', seq: 3 });

// 3. Execute
await wbs.run(id);

// 4. Check status
console.log(wbs.status(id));
```

## Job Status Flow

```
pending → running → completed
                  → failed
```

## Key Design Decisions

1. **AI makes intelligent decisions** - Complexity analysis, job decomposition
2. **Code handles state only** - wbs.js does DB CRUD + worker execution
3. **30-minute timeboxing** - Each job is 15-45 minutes
4. **Start simple, improve iteratively** - MVP first

## API Reference

### Project Management

#### `wbs.create(title, options?)`
Create a new WBS project. Returns project ID.
- `options.detailPath`: Path to detail document (auto-created if not specified)

#### `wbs.list()`
List all WBS projects.

#### `wbs.status(wbsId)`
Get project and all jobs status.

#### `wbs.delete(wbsId)`
Delete a project and all associated jobs/executions.

### Job Management

#### `wbs.addJob(wbsId, { title, description?, agent, seq?, issue_number? })`
Add a job to the project. Returns job ID.
- `title`: Job title (short name)
- `description`: Detailed instructions for the agent
- `agent`: Worker agent mention (e.g., `@crewx_claude_dev`)
- `seq`: Execution order (default: 0)
- `issue_number`: Related GitHub issue number

#### `wbs.getNextJob(wbsId)`
Get the next pending job. Returns job object or null.

#### `wbs.updateJob(jobId, status)`
Update job status. Status: `pending`, `running`, `completed`, `failed`.

#### `wbs.runWorker(job)`
Execute a single worker. Returns `{ success, error?, execId }`.

#### `wbs.run(wbsId)`
Execute all pending jobs sequentially.

### Execution Management

#### `wbs.createExecution(jobId, pid)`
Create a new execution record. Returns execution ID.

#### `wbs.updateExecution(execId, status, options?)`
Update execution status.
- `options.exitCode`: Process exit code
- `options.error`: Error message

#### `wbs.getExecution(execId)`
Get execution by ID.

#### `wbs.listExecutions(jobId)`
List all executions for a job.

#### `wbs.killExecution(execId)`
Kill a running execution. Returns boolean success.

#### `wbs.getRunningExecutions()`
Get all currently running executions.

## Related Documentation

- [WBS Skill Spec](/docs/cto/designs/wbs-skill-spec.md)
- [CrewX CLI Documentation](/packages/cli/CREWX.md)
