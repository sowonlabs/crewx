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

## Commands

### Project Commands

```bash
# Create a new WBS project
node skills/wbs/wbs.js create "Project Title"

# List all projects
node skills/wbs/wbs.js list

# Get project status with summary
node skills/wbs/wbs.js status <wbs-id>

# Delete a project
node skills/wbs/wbs.js delete <wbs-id>
```

### Job Commands

```bash
# List all jobs in a project
node skills/wbs/wbs.js job list <wbs-id>

# Add a job to the project
node skills/wbs/wbs.js job add <wbs-id> --title "Job Title" --agent "@claude:sonnet" --seq 1

# Update a job (status, title, agent, or sequence)
node skills/wbs/wbs.js job update <job-id> --status completed
node skills/wbs/wbs.js job update <job-id> --title "New Title" --agent "@claude:opus"

# Run the next pending job
node skills/wbs/wbs.js job next <wbs-id>

# Run all pending jobs sequentially
node skills/wbs/wbs.js job run <wbs-id>
```

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

### `wbs.create(title)`
Create a new WBS project. Returns project ID.

### `wbs.addJob(wbsId, { title, agent, seq })`
Add a job to the project. Returns job ID.
- `title`: Job description
- `agent`: Worker agent mention (e.g., `@claude:sonnet`)
- `seq`: Execution order (0-based)

### `wbs.getNextJob(wbsId)`
Get the next pending job. Returns job object or null.

### `wbs.updateJob(jobId, status)`
Update job status. Status: `pending`, `running`, `completed`, `failed`.

### `wbs.runWorker(job)`
Execute a single worker. Returns `{ success, error? }`.

### `wbs.run(wbsId)`
Execute all pending jobs sequentially.

### `wbs.status(wbsId)`
Get project and all jobs status.

### `wbs.list()`
List all WBS projects.

## Related Documentation

- [WBS Skill Spec](/docs/cto/designs/wbs-skill-spec.md)
- [CrewX CLI Documentation](/packages/cli/CREWX.md)
