# WBS Commands Reference

Complete reference guide for WBS (Work Breakdown Structure) project management commands.

## Table of Contents

- [Project Commands](#project-commands)
  - [create](#create)
  - [list](#list)
  - [status](#status)
  - [delete](#delete)
- [Output Formats](#output-formats)
- [Examples](#examples)

---

## Project Commands

### create

Create a new WBS project.

**Syntax:**
```bash
wbs.js create "Project Title" [--detail "path/to/detail.md"]
```

**Parameters:**
- `"Project Title"` (required): Title of the WBS project
- `--detail "path"` (optional): Path to a detail document for the project

**Behavior:**
- Generates a sequential project ID (e.g., `wbs-1`, `wbs-2`, etc.)
- Sets initial status to `planning`
- If `--detail` is not provided, automatically creates a placeholder detail file in `skills/wbs/details/{id}-detail.md`
- Returns JSON output with project details

**Output:**
```json
{
  "id": "wbs-1",
  "title": "Project Title",
  "detailPath": "skills/wbs/details/wbs-1-detail.md"
}
```

**Examples:**
```bash
# Create a simple project
wbs.js create "User Authentication Implementation"

# Create a project with custom detail document
wbs.js create "API Provider Integration" --detail "docs/api-design.md"

# Create a project for feature development
wbs.js create "Shopping Cart Feature" --detail "wbs/wbs-5-requirements.md"
```

**Auto-generated Detail File:**

When no `--detail` is provided, a placeholder file is created:

```markdown
# {Project Title}

## 개요

(프로젝트 개요를 작성하세요)

## 요구사항

(요구사항을 작성하세요)

## 참고 자료

(참고 자료 링크나 설명을 추가하세요)
```

---

### list

List all WBS projects.

**Syntax:**
```bash
wbs.js list [--json]
```

**Parameters:**
- `--json` (optional): Output in JSON format instead of human-readable table

**Behavior:**
- Returns all projects ordered by creation date (newest first)
- Shows project status, job count, and progress percentage
- Calculates progress based on completed vs total jobs

**Output (Default):**
```
📋 WBS Projects (3)

| 상태 | ID    | 프로젝트명                  | Jobs | Progress |
|------|-------|----------------------------|------|----------|
| ✅   | wbs-3 | User Authentication        | 5    | 100%     |
| 🟡   | wbs-2 | API Provider Integration   | 8    | 37%      |
| ⬜️   | wbs-1 | Shopping Cart Feature      | 3    | 0%       |
```

**Output (--json):**
```json
[
  {
    "id": "wbs-3",
    "title": "User Authentication",
    "detail_path": "skills/wbs/details/wbs-3-detail.md",
    "status": "completed",
    "created_at": "2025-12-18T07:30:00.000Z"
  },
  {
    "id": "wbs-2",
    "title": "API Provider Integration",
    "detail_path": null,
    "status": "running",
    "created_at": "2025-12-18T06:15:00.000Z"
  }
]
```

**Status Icons:**
- ⬜️ `pending` - No jobs started yet
- 🟡 `running` - Has running or in-progress jobs
- ✅ `completed` - All jobs completed successfully
- ❌ `failed` - Has failed jobs
- 📝 `planning` - In planning phase
- ⚠️ `partial` - Some jobs completed, some failed

**Examples:**
```bash
# List all projects (human-readable)
wbs.js list

# List all projects (JSON output)
wbs.js list --json

# Use in scripts
PROJECT_COUNT=$(wbs.js list --json | jq 'length')
```

---

### status

Get detailed status of a WBS project, including all jobs.

**Syntax:**
```bash
wbs.js status <wbs-id> [--json]
```

**Parameters:**
- `<wbs-id>` (required): Project ID (e.g., `wbs-1`)
- `--json` (optional): Output in JSON format

**Behavior:**
- Returns project information and all associated jobs
- Calculates summary statistics (pending, running, completed, failed)
- Shows progress percentage
- Displays detail document path if available

**Output (Default):**
```
📋 User Authentication (wbs-3)
   Status: completed | Progress: 100% (5/5)
   Detail: skills/wbs/details/wbs-3-detail.md

   Jobs:
   | 상태 | # | 작업명                    | 담당            |
   |------|---|---------------------------|-----------------|
   | ✅   | 1 | Design User model         | @claude:sonnet  |
   | ✅   | 2 | Implement login API       | @copilot        |
   | ✅   | 3 | Add session management    | @claude:sonnet  |
   | ✅   | 4 | Write unit tests          | @copilot        |
   | ✅   | 5 | Integration testing       | @claude:opus    |
```

**Output (--json):**
```json
{
  "project": {
    "id": "wbs-3",
    "title": "User Authentication",
    "detail_path": "skills/wbs/details/wbs-3-detail.md",
    "status": "completed",
    "created_at": "2025-12-18T07:30:00.000Z"
  },
  "jobs": [
    {
      "id": "job-12",
      "wbs_id": "wbs-3",
      "title": "Design User model",
      "description": "Create User model with email, password fields",
      "agent": "@claude:sonnet",
      "status": "completed",
      "seq": 1,
      "created_at": "2025-12-18T07:31:00.000Z",
      "completed_at": "2025-12-18T07:55:00.000Z",
      "issue_number": null
    }
  ],
  "summary": {
    "total": 5,
    "pending": 0,
    "running": 0,
    "completed": 5,
    "failed": 0,
    "progress": 100
  }
}
```

**Examples:**
```bash
# Get project status
wbs.js status wbs-3

# Get status in JSON format
wbs.js status wbs-3 --json

# Check progress in scripts
PROGRESS=$(wbs.js status wbs-3 --json | jq '.summary.progress')
if [ "$PROGRESS" -eq 100 ]; then
  echo "Project complete!"
fi

# List pending jobs
wbs.js status wbs-2 --json | jq '.jobs[] | select(.status=="pending") | .title'
```

---

### delete

Delete a WBS project and all its associated jobs and executions.

**Syntax:**
```bash
wbs.js delete <wbs-id>
```

**Parameters:**
- `<wbs-id>` (required): Project ID to delete

**Behavior:**
- Deletes the project record
- Deletes all jobs associated with the project
- Deletes all execution records for those jobs
- Permanently removes data from `.wbs-data.json`
- Does NOT delete the detail document file (if it exists)

**Output:**
```
Deleted: wbs-1
```

**⚠️ Warning:**
This operation is **irreversible**. All project data, jobs, and execution history will be permanently deleted.

**Examples:**
```bash
# Delete a project
wbs.js delete wbs-1

# Delete with confirmation in scripts
read -p "Delete project wbs-5? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  wbs.js delete wbs-5
fi

# Bulk delete completed projects (advanced)
for id in $(wbs.js list --json | jq -r '.[] | select(.status=="completed") | .id'); do
  echo "Deleting $id..."
  wbs.js delete $id
done
```

**What Gets Deleted:**
- ✅ Project record from database
- ✅ All job records
- ✅ All execution history
- ✅ Data persisted in `.wbs-data.json`

**What Remains:**
- ❌ Detail document files (must be deleted manually)
- ❌ Any code or artifacts created by jobs
- ❌ Git branches created during job execution

---

## Output Formats

WBS commands support two output formats:

### Human-Readable (Default)

- Uses tables with Unicode box-drawing characters
- Includes emoji status icons
- Shows formatted dates and progress bars
- Optimized for terminal display

### JSON (--json flag)

- Machine-parseable structured data
- Includes all available fields
- Suitable for scripting and automation
- Can be processed with `jq`, `grep`, etc.

**Example: Converting Between Formats**
```bash
# Pretty print JSON output
wbs.js list --json | jq '.'

# Extract specific fields
wbs.js list --json | jq '.[] | {id, title, status}'

# Filter by status
wbs.js list --json | jq '.[] | select(.status=="running")'

# Count projects
wbs.js list --json | jq 'length'
```

---

## Examples

### Complete Workflow Example

```bash
# 1. Create a new project
wbs.js create "E-commerce Checkout Flow"
# Output: { "id": "wbs-4", ... }

# 2. Add jobs (see job-management.md)
wbs.js job add wbs-4 --title "Design checkout schema" --agent "@claude:opus" --seq 1
wbs.js job add wbs-4 --title "Implement payment API" --agent "@copilot" --seq 2
wbs.js job add wbs-4 --title "Add order confirmation" --agent "@claude:sonnet" --seq 3

# 3. Check status before running
wbs.js status wbs-4

# 4. Run all jobs
wbs.js job run wbs-4

# 5. Monitor progress
wbs.js status wbs-4

# 6. View all projects
wbs.js list

# 7. Clean up when done
wbs.js delete wbs-4
```

### Scripting Examples

**Monitor Project Until Complete:**
```bash
#!/bin/bash
WBS_ID="wbs-5"

while true; do
  PROGRESS=$(wbs.js status $WBS_ID --json | jq '.summary.progress')
  echo "Progress: $PROGRESS%"

  if [ "$PROGRESS" -eq 100 ]; then
    echo "Project complete!"
    break
  fi

  sleep 60
done
```

**List Projects by Status:**
```bash
#!/bin/bash
echo "Running projects:"
wbs.js list --json | jq -r '.[] | select(.status=="running") | "\(.id): \(.title)"'

echo -e "\nCompleted projects:"
wbs.js list --json | jq -r '.[] | select(.status=="completed") | "\(.id): \(.title)"'
```

**Export Project Summary:**
```bash
#!/bin/bash
for id in $(wbs.js list --json | jq -r '.[].id'); do
  echo "=== $id ==="
  wbs.js status $id --json | jq '.summary'
  echo
done
```

---

## Related Documentation

- [Job Management Commands](./job-management.md) - Managing jobs within WBS projects
- [WBS Skill Overview](./SKILL.md) - High-level skill documentation
- [CrewX CLI Documentation](../../CLAUDE.md) - CrewX platform overview

---

## Command Quick Reference

| Command | Syntax | Purpose |
|---------|--------|---------|
| create | `wbs.js create "Title" [--detail path]` | Create new WBS project |
| list | `wbs.js list [--json]` | List all projects |
| status | `wbs.js status <wbs-id> [--json]` | Get project details |
| delete | `wbs.js delete <wbs-id>` | Delete project |

**Common Flags:**
- `--json` - Output structured JSON instead of formatted table
- `--detail` - Specify custom detail document path (create only)
