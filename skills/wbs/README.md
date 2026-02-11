# WBS (Work Breakdown Structure) Skill

> Decompose complex tasks into manageable 30-minute timeboxed jobs with automated state tracking and multi-agent coordination.

## Table of Contents

- [Overview](#overview)
- [When to Use WBS](#when-to-use-wbs)
- [Quick Start](#quick-start)
- [Basic Commands](#basic-commands)
- [Real Usage Examples](#real-usage-examples)
- [Daemon Management](#daemon-management)
- [WBS vs Direct Delegation](#wbs-vs-direct-delegation)
- [Advanced Topics](#advanced-topics)

---

## Overview

The WBS (Work Breakdown Structure) skill is a **project management system for complex AI-driven tasks**. It enables coordinator agents to:

- **Decompose complex tasks** into manageable 30-minute jobs
- **Track progress** with state management (pending → running → completed/failed)
- **Coordinate multiple agents** by assigning different jobs to specialized workers
- **Manage context** through detail documents and structured workflow
- **Execute in parallel** by distributing jobs across multiple worker agents

### Key Characteristics

- **Structured Approach**: Projects are broken down into jobs with clear status tracking
- **Time-Boxed Execution**: Each job targets 15-45 minutes (optimal: 25-30 min)
- **Multi-Agent Coordination**: Different jobs can be assigned to different AI agents
- **State Persistence**: All project data, jobs, and execution history are tracked in `.wbs-data.json`
- **Automated Workflow**: Git branching, PR templates, and issue tracking integration

### Architecture

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

---

### When to Use WBS

Use WBS when your task meets **any** of these criteria:

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

- **Progress tracking important**
  - Team collaboration requiring visibility into task status
  - Projects with external stakeholders needing updates
  - Work where partial failure recovery is critical

- **GitHub integration needed**
  - Tasks linked to GitHub issues
  - Projects requiring structured PR workflows
  - Work following standardized git branching strategies

### When NOT to Use WBS

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

---

## Quick Start

### Installation

```bash
cd skills/wbs
npm install
```

Requires Node.js 16+.

### Basic Workflow

```bash
# 1. Create a new WBS project
node wbs.js create "User Authentication Implementation"
# Output: { "id": "wbs-1", ... }

# 2. Add jobs to the project
node wbs.js job add wbs-1 --title "Design User model" --agent "@claude:sonnet" --seq 1
node wbs.js job add wbs-1 --title "Implement login API" --agent "@copilot" --seq 2
node wbs.js job add wbs-1 --title "Write unit tests" --agent "@claude:sonnet" --seq 3

# 3. Review planned jobs
node wbs.js status wbs-1

# 4. Run all jobs
node wbs.js job run wbs-1

# 5. Check progress
node wbs.js status wbs-1
```

---

## Basic Commands

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

**Status Icons:**
- ⬜️ `pending` - Not started yet
- 🟡 `running` - Currently executing
- ✅ `completed` - Successfully completed
- ❌ `failed` - Execution failed

---

## Real Usage Examples

### Example 1: Simple Workflow (Create → Add Jobs → Run)

The most basic WBS workflow involves creating a project, adding jobs, and running them sequentially.

**Scenario**: Build a simple REST API for a todo application

```bash
# 1. Create the project
node wbs.js create "Todo REST API"

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

# 3. Review the planned jobs
node wbs.js status wbs-1

# 4. Run all jobs
node wbs.js job run wbs-1

# 5. Verify completion
node wbs.js status wbs-1
```

---

### Example 2: Issue-Based Workflow

Use WBS to manage multiple GitHub issues systematically.

**Scenario**: Fix authentication-related bugs tracked in GitHub

```bash
# 1. Create project for bug fixes
node wbs.js create "Authentication Bug Fixes"

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

# 3. Run all jobs
node wbs.js job run wbs-2
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

# 3. Execute first job only
node wbs.js job next wbs-3

# 4. Review changes before continuing
git diff
npm test

# 5. If satisfied, run next job
node wbs.js job next wbs-3

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
node wbs.js job add wbs-4 --title "Integrate Stripe SDK" --agent "@copilot" --seq 1
node wbs.js job add wbs-4 --title "Implement payment endpoint" --agent "@claude:sonnet" --seq 2
node wbs.js job add wbs-4 --title "Add webhook handler" --agent "@claude:sonnet" --seq 3

# 2. Run all jobs
node wbs.js job run wbs-4

# Suppose job-2 fails, check which jobs failed
node wbs.js job list wbs-4 --json | jq '.[] | select(.status=="failed")'

# 3. Fix the issue (add environment variable or update job description)
node wbs.js job update job-2 \
  --desc "Implement payment endpoint. Use STRIPE_API_KEY from .env file. Handle both test and production modes."

# 4. Retry the failed job
node wbs.js job retry job-2

# 5. Continue with remaining jobs
node wbs.js job run wbs-4
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

### Example 6: Monitoring and JSON Output

Automate WBS monitoring and integrate with other tools.

**Check project status programmatically:**
```bash
# Get JSON output for scripting
node wbs.js status wbs-1 --json | jq '.summary'
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

**Export jobs to CSV:**
```bash
# Export job list
echo "ID,Title,Status,Agent,Seq" > jobs-export.csv
node wbs.js job list wbs-1 --json | \
  jq -r '.[] | [.id,.title,.status,.agent,.seq] | @csv' >> jobs-export.csv
```

---

## Daemon Management

WBS jobs can run as background daemons for long-running tasks or continuous monitoring.

### Job Execution Flow

1. **Job starts**: Status changes from `pending` to `running`
2. **Agent execution**: Worker agent spawned via `crewx x "@agent instructions"`
3. **Timeout**: Automatic timeout after 30 minutes per job
4. **Job completes**: Status changes to `completed` or `failed`
5. **Next job**: Continues to next pending job

### Running Jobs in Background

**Basic background execution:**
```bash
# Run all jobs in background
node wbs.js job run wbs-1 > wbs-1.log 2>&1 &
echo $! > wbs-1.pid

# Monitor log file
tail -f wbs-1.log
```

### Process Management

**Check running processes:**
```bash
# View WBS processes
ps aux | grep "wbs.js job run"

# Kill a specific WBS process
kill $(cat wbs-1.pid)
```

### Daemon Manager Script

**Create a daemon control script:**
```bash
#!/bin/bash
# wbs-daemon.sh

WBS_ID=$1
LOG_FILE="wbs-${WBS_ID}.log"
PID_FILE="wbs-${WBS_ID}.pid"

# Start daemon
start() {
  echo "Starting WBS daemon for $WBS_ID..."
  node wbs.js job run $WBS_ID > $LOG_FILE 2>&1 &
  echo $! > $PID_FILE
  echo "Daemon started with PID: $(cat $PID_FILE)"
}

# Stop daemon
stop() {
  if [ -f $PID_FILE ]; then
    PID=$(cat $PID_FILE)
    echo "Stopping WBS daemon (PID: $PID)..."
    kill $PID
    rm $PID_FILE
    echo "Daemon stopped"
  else
    echo "No PID file found"
  fi
}

# Check status
status() {
  if [ -f $PID_FILE ]; then
    PID=$(cat $PID_FILE)
    if ps -p $PID > /dev/null; then
      echo "WBS daemon is running (PID: $PID)"
      node wbs.js status $WBS_ID
    else
      echo "PID file exists but process is not running"
      rm $PID_FILE
    fi
  else
    echo "WBS daemon is not running"
  fi
}

# Show logs
logs() {
  tail -f $LOG_FILE
}

case "$2" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  logs)
    logs
    ;;
  restart)
    stop
    sleep 2
    start
    ;;
  *)
    echo "Usage: $0 <wbs-id> {start|stop|status|logs|restart}"
    exit 1
esac
```

**Usage:**
```bash
chmod +x wbs-daemon.sh

# Start daemon
./wbs-daemon.sh wbs-1 start

# Check status
./wbs-daemon.sh wbs-1 status

# View logs
./wbs-daemon.sh wbs-1 logs

# Stop daemon
./wbs-daemon.sh wbs-1 stop

# Restart daemon
./wbs-daemon.sh wbs-1 restart
```

### Systemd Service (Linux)

For production environments, use systemd:

```ini
# /etc/systemd/system/wbs@.service
[Unit]
Description=WBS Job Runner for %i
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/skills/wbs
ExecStart=/usr/bin/node wbs.js job run %i
Restart=on-failure
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Usage:**
```bash
# Enable and start service for wbs-1
sudo systemctl enable wbs@wbs-1
sudo systemctl start wbs@wbs-1

# Check status
sudo systemctl status wbs@wbs-1

# View logs
sudo journalctl -u wbs@wbs-1 -f

# Stop service
sudo systemctl stop wbs@wbs-1
```

---

## WBS vs Direct Delegation

When should you use WBS versus directly delegating tasks to agents? This section helps you make the right choice.

### Core Concept Comparison

| Aspect | WBS Skill | Direct Delegation (`crewx x`) |
|--------|-----------|-------------------------------|
| **Definition** | Breaks work into 30-min jobs with state tracking and sequential execution | Direct task delegation via `crewx x "@agent task"` command |
| **Execution Model** | WBS Coordinator → Worker Agents | User → Single Agent |
| **Structure** | Structured, tracked, timeboxed | Ad-hoc, immediate, flexible |
| **Best For** | Complex multi-step tasks | Simple single-step tasks |
| **Setup Time** | 3 steps (create → add jobs → run) | 1 step (immediate execution) |
| **State Tracking** | Automatic (pending/running/completed/failed) | None (one-time execution) |
| **Progress Monitoring** | Real-time status and progress (`wbs.js status`) | None |
| **Job Duration** | 15-45 minute timeboxing | No limit |

### Quick Decision Guide

**Use WBS Skill when your task is:**
- **Structured**: Complex multi-step work requiring coordination
- **Tracked**: Progress visibility and state management needed
- **Timeboxed**: 30-minute jobs prevent context loss
- **Complex**: > 45 minutes total, multiple components, team collaboration

**Use Direct Delegation when your task is:**
- **Quick**: < 15 minutes, immediate results needed
- **Ad-hoc**: One-off operations, no tracking required
- **Simple**: Single file/module, straightforward scope
- **Exploratory**: Analysis, queries, rapid prototyping

### Detailed Comparison

#### By Task Size and Complexity

| Task Characteristics | WBS Skill | Direct Delegation | Recommended |
|---------------------|-----------|-------------------|-------------|
| **< 15 minutes** | Creates overhead | Immediate execution | **Direct** ✅ |
| **15-45 minutes (simple)** | Works but not needed | Fast and sufficient | **Direct** ✅ |
| **15-45 minutes (multi-step)** | Structured tracking | Manual management | **WBS** ✅ |
| **> 45 minutes** | Job decomposition + tracking | Risk of context loss | **WBS** ✅ |
| **Multi-day projects** | Sequential execution + state | Very difficult to manage | **WBS** ✅ |

#### By Feature Capabilities

| Feature | WBS Skill | Direct Delegation |
|---------|-----------|-------------------|
| **Task Decomposition** | AI breaks into 30-min jobs automatically | User manually splits if needed |
| **Progress Tracking** | Real-time via `wbs.js status` | None |
| **State Management** | pending → running → completed/failed | None (stateless) |
| **Failure Recovery** | Selective `job retry` on failed jobs only | Re-run entire task from scratch |
| **Git Workflow** | Auto branch/PR templates with WBS tracking | Depends on agent configuration |
| **GitHub Integration** | Built-in `--issue N` linking | Manual connection required |
| **Execution History** | Persistent logs and queryable history | None (ephemeral) |
| **Multi-Agent Support** | Different agents per job | Single agent per command |
| **Timeout Control** | Automatic 30-minute per job | None (runs until complete) |
| **Context Preservation** | Detail documents shared across jobs | Lost between executions |

#### Pros and Cons Analysis

**WBS Skill**

✅ **Advantages:**
- **Systematic Task Management**: Complex projects broken into structured, manageable jobs
- **Real-Time Progress Visibility**: Always know what's done, what's running, what's pending
- **Easy Failure Recovery**: Retry only failed jobs, not entire project
- **Context Preservation**: Detail documents maintain project context across all jobs
- **Multi-Agent Coordination**: Assign optimal agent for each job type
- **Standardized Git Workflow**: Auto-generated branches and PR templates
- **Execution History**: Persistent logs for analysis and auditing
- **Prevents Context Loss**: 30-min timeboxing prevents LLM "Lost in the Middle" problem

❌ **Disadvantages:**
- **Setup Overhead**: Overkill for simple < 15 minute tasks
- **Learning Curve**: Requires understanding CLI commands and concepts
- **Timeboxing Constraint**: 30-minute limit may feel restrictive
- **Sequential Only**: No parallel job execution (yet)

**Direct Delegation**

✅ **Advantages:**
- **Immediate Execution**: Zero setup, instant results
- **Simple Interface**: Single `crewx x` command
- **No Time Constraints**: Task runs until completion
- **Maximum Flexibility**: Works for any task size or complexity
- **Low Learning Curve**: Easy to understand and use

❌ **Disadvantages:**
- **No State Tracking**: Cannot monitor progress or status
- **Difficult Failure Recovery**: Must re-run entire task if it fails
- **Context Loss Risk**: Long tasks may suffer from LLM context limitations
- **No Execution History**: Work is ephemeral, not recorded
- **Manual Management**: Complex projects require manual coordination

### Decision Guide

**Choose WBS Skill when you need:**
- [ ] Task duration > 45 minutes
- [ ] 3+ logical steps or phases
- [ ] Multiple agents with different specializations
- [ ] Progress tracking and status visibility
- [ ] Selective retry capability (not full re-run)
- [ ] GitHub issue integration and linking
- [ ] Team collaboration and visibility
- [ ] Structured git workflow (branches, PRs)
- [ ] Context preservation across long operations
- [ ] Execution history and audit trail

**Choose Direct Delegation when you need:**
- [ ] Task completion < 15 minutes
- [ ] Single file or module modification
- [ ] Immediate results without overhead
- [ ] One-time, ad-hoc operation
- [ ] Code analysis or query (no file changes)
- [ ] Quick prototyping or experimentation
- [ ] No tracking or history requirements
- [ ] Simple, well-defined scope

### Decision Flowchart

```
Task Received
    │
    ▼
How long will it take?
    │
    ├─── < 15 min ────────────────────────────────► Direct Delegation ✅
    │
    ├─── 15-45 min ─┬─ Single step? ──── Yes ─────► Direct Delegation ✅
    │               └─ Multi-step? ───── Yes ─────► WBS Skill ✅
    │
    └─── > 45 min ────────────────────────────────► WBS Skill ✅
                                                     (Decompose into jobs)
```

### Summary Table

| Situation | Use WBS | Use Direct | Reason |
|-----------|---------|------------|--------|
| Simple bug fix | ❌ | ✅ | Too simple for WBS overhead |
| Typo in README | ❌ | ✅ | 1-minute task, no tracking needed |
| Add single validation | ❌ | ✅ | Single file, straightforward |
| Code analysis query | ❌ | ✅ | No file changes, exploratory |
| Feature implementation | ✅ | ❌ | Multi-step, needs coordination |
| Bug fix sprint (5+ issues) | ✅ | ❌ | Progress tracking critical |
| Large refactoring | ✅ | ❌ | Context preservation essential |
| Multi-agent project | ✅ | ❌ | Different agents per job type |

### Real-World Examples

**Example 1: WBS for Complex Feature (E-commerce Checkout)**

```bash
# Large feature: 5 jobs, 2+ hours total, multiple agents
wbs.js create "E-commerce Checkout Implementation"
wbs.js job add wbs-1 --title "Design checkout schema" --agent "@claude:opus" --seq 1
wbs.js job add wbs-1 --title "Implement payment API" --agent "@copilot" --seq 2
wbs.js job add wbs-1 --title "Add order confirmation" --agent "@claude:sonnet" --seq 3
wbs.js job add wbs-1 --title "Write tests" --agent "@copilot" --seq 4
wbs.js job add wbs-1 --title "Update documentation" --agent "@claude:sonnet" --seq 5
wbs.js job run wbs-1

# Monitor progress
wbs.js status wbs-1
```

**Why WBS?** Multi-step process, different agent specializations, progress tracking essential, structured workflow.

**Example 2: WBS for Bug Fix Sprint**

```bash
# Multiple GitHub issues, tracking needed
wbs.js create "Authentication Bug Fixes"
wbs.js job add wbs-2 --title "Fix login bug" --agent "@claude:sonnet" --issue 42 --seq 1
wbs.js job add wbs-2 --title "Fix session timeout" --agent "@claude:sonnet" --issue 43 --seq 2
wbs.js job add wbs-2 --title "Fix password reset" --agent "@claude:sonnet" --issue 44 --seq 3
wbs.js job run wbs-2
```

**Why WBS?** GitHub integration, failure recovery, team visibility, execution history.

**Example 3: Direct Delegation for Simple Tasks**

```bash
# Quick typo fix: 2 minutes
crewx x "@claude:sonnet Fix typo in README.md line 42"

# Single function update: 10 minutes
crewx x "@copilot Add email validation to UserController.create() method"

# Code analysis: no modifications
crewx q "@claude:opus Explain how the authentication flow works"

# Quick prototype: 15 minutes
crewx x "@copilot Create simple Express server with health check endpoint"
```

**Why Direct?** Fast execution, no tracking needed, simple scope, immediate results.

### Hybrid Approach

Combine both approaches for maximum efficiency:

```bash
# 1. Use WBS for main project structure
wbs.js create "User Authentication Feature"
wbs.js job add wbs-1 --title "Design User model" --agent "@claude:opus" --seq 1
wbs.js job add wbs-1 --title "Implement auth API" --agent "@copilot" --seq 2
wbs.js job add wbs-1 --title "Add JWT middleware" --agent "@copilot" --seq 3

# 2. Run WBS jobs
wbs.js job next wbs-1

# 3. During execution, fix quick issues with Direct Delegation
crewx x "@claude:sonnet Fix import statement in utils.ts"
crewx x "@copilot Update package.json with bcrypt dependency"

# 4. Continue WBS execution
wbs.js job next wbs-1

# 5. Check overall progress
wbs.js status wbs-1
```

**Best Practice:** Use WBS as the project backbone, Direct Delegation for opportunistic quick fixes.

---

## Job Types and Workflows

### Issue-Based Jobs

When you have an existing GitHub issue:

```bash
wbs.js job add wbs-1 --title "Fix bug" --agent "@claude:sonnet" --issue 42
```

**What the worker receives:**
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

**Advantages:**
- Leverages agent's existing workflow
- Automatic issue-branch-PR linking
- Easy tracking

### Independent Jobs

For quick tasks without GitHub issues:

```bash
wbs.js job add wbs-1 --title "Update documentation" --agent "@claude:sonnet"
```

**What the worker receives:**
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

**Use cases:**
- Documentation updates
- Simple refactoring
- Experimental work
- Tasks not tracked in issues

---

## Agent Selection Guide

Choose the right agent for each job:

| Agent | Best For |
|-------|----------|
| `@claude:opus` | Complex logic, architecture design, critical tasks |
| `@claude:sonnet` | General development, code review, testing |
| `@claude:haiku` | Simple tasks, quick operations |
| `@copilot` | Code implementation, boilerplate, patterns |
| `@gemini` | Performance analysis, data processing |

---

## 30-Minute Timeboxing

WBS enforces time-boxed execution to prevent context loss and maintain focus.

| Category | Time | Guideline |
|----------|------|-----------|
| Minimum | 15 min | Below this → use Direct Delegation |
| Optimal | 25-30 min | Target duration for each job |
| Maximum | 45 min | Above this → decompose into smaller jobs |

**Rationale:**
- Prevents LLM context issues ("Lost in the Middle", context rot)
- Aligns with Pomodoro Technique for human productivity
- Enables meaningful checkpoints and validation
- Facilitates better failure recovery

---

## Tips and Best Practices

### Job Creation Checklist

1. [ ] Choose appropriate agent for the task
2. [ ] Use `--issue N` if GitHub issue exists
3. [ ] Keep job title clear and concise
4. [ ] Ensure job is completable in 15-45 minutes
5. [ ] Add `--desc` for complex instructions
6. [ ] Set `--seq` for proper execution order

### Common Patterns

**List failed jobs:**
```bash
wbs.js job list wbs-X --json | jq '.[] | select(.status=="failed")'
```

**Retry all failed jobs:**
```bash
for job in $(wbs.js job list wbs-X --json | jq -r '.[] | select(.status=="failed") | .id'); do
  wbs.js job retry $job
done
```

**Check progress percentage:**
```bash
wbs.js status wbs-X --json | jq '.summary.progress'
```

**Export job list to CSV:**
```bash
echo "ID,Title,Status,Agent,Seq" > jobs.csv
wbs.js job list wbs-X --json | jq -r '.[] | [.id,.title,.status,.agent,.seq] | @csv' >> jobs.csv
```

### Avoiding Common Mistakes

**❌ Don't:**
- Override agent models: `@crewx_claude_dev:sonnet` (incorrect)
- Create jobs > 45 minutes without decomposition
- Skip sequence numbers for dependent tasks
- Use WBS for simple < 15 minute tasks

**✅ Do:**
- Use agent as-is: `@crewx_claude_dev` (correct)
- Break large tasks into 30-minute chunks
- Set proper sequence with `--seq`
- Use Direct Delegation for quick tasks

---

## Command Quick Reference

### Project Commands

| Command | Purpose |
|---------|---------|
| `wbs.js create "Title"` | Create new project |
| `wbs.js list` | List all projects |
| `wbs.js status <wbs-id>` | Get project details |
| `wbs.js delete <wbs-id>` | Delete project |

### Job Commands

| Command | Purpose |
|---------|---------|
| `wbs.js job add <wbs-id> --title "..." --agent "@..."` | Add job |
| `wbs.js job list <wbs-id>` | List jobs |
| `wbs.js job update <job-id> [options]` | Update job |
| `wbs.js job run <wbs-id>` | Run all jobs |
| `wbs.js job next <wbs-id>` | Run next job |
| `wbs.js job retry <job-id>` | Retry job |

### Common Flags

- `--json` - Output structured JSON
- `--detail "path"` - Specify detail document (create only)
- `--seq N` - Set execution sequence
- `--issue N` - Link to GitHub issue
- `--desc "..."` - Add detailed instructions

---

## Architecture

### System Components

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Coordinator Agent (with WBS skill)                 │
│  - Analyze request (AI judgment)                    │
│  - Decompose into 30-min Jobs (AI judgment)         │
│  - Execute workers: crewx x "@agent action"         │
│  - Track state: .wbs-data.json                      │
└─────────────────────────────────────────────────────┘
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Worker1 │   │ Worker2 │   │ Worker3 │
│ @claude │   │ @gemini │   │ @copilot│
└─────────┘   └─────────┘   └─────────┘
```

### Job Status Flow

```
pending → running → completed
                  → failed
```

### Data Storage

All WBS data is stored in `.wbs-data.json`:
- Project metadata
- Job configurations
- Execution history
- Status tracking

---

## Related Documentation

- [SKILL.md](./SKILL.md) - High-level WBS skill documentation
- [COMMANDS.md](./COMMANDS.md) - Complete command reference
- [job-management.md](./job-management.md) - Detailed job management guide
- [WBS-VS-DELEGATION.md](./WBS-VS-DELEGATION.md) - In-depth comparison
- [DESIGN.md](./DESIGN.md) - Architecture and design decisions
- [CrewX Documentation](../../CLAUDE.md) - CrewX platform overview

---

## Support and Feedback

For issues, questions, or contributions:
- GitHub Issues: [CrewX Issues](https://github.com/dohoangson1/crewx/issues)
- Documentation: [CrewX Docs](../../docs/)

---

## License

Part of the CrewX project. See main repository for license information.
