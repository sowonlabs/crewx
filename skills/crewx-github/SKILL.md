---
name: crewx-github
description: GitHub Issues/PR management guide. Activate when creating issues, using labels, or creating/reviewing PRs.
version: 0.0.1
---

# CrewX GitHub Skill

A guide skill for agents to manage GitHub Issues/PRs consistently.

## Purpose

- Standardize GitHub Issues and PR management
- Unify label usage rules
- Support automation using `gh` CLI

## Quick Start

### Create Issue

```bash
# Bug report
gh issue create --template bug_report.yml

# Feature request
gh issue create --template feature_request.yml
```

### Create PR

```bash
gh pr create --template PULL_REQUEST_TEMPLATE.md
```

---

# GitHub Labels Guide

GitHub label system for the CrewX project. All labels are configured via `scripts/setup-github-labels.sh`.

## Label Categories

### Type Labels

Classifies the type of issue/PR.

| Label | Color | Description | Usage Examples |
|-------|-------|-------------|----------------|
| `type:bug` | #d73a4a (red) | Bug, malfunction | Crash, error, unexpected behavior |
| `type:feature` | #a2eeef (sky) | New feature request | New CLI command, API addition |
| `type:docs` | #0075ca (blue) | Documentation improvement | README update, guide addition |
| `type:refactor` | #fbca04 (yellow) | Code refactoring | Structure change (no functional change) |
| `type:test` | #bfd4f2 (light purple) | Test improvement | Add tests, fix tests |
| `type:security` | #b60205 (dark red) | Security related | Vulnerability, security patch |
| `type:performance` | #d4c5f9 (light purple) | Performance improvement | Speed optimization, memory improvement |
| `type:maintenance` | #c5def5 (light blue) | Maintenance | Dependency update, cleanup |

### Priority Labels

Indicates work urgency.

| Label | Color | Description | Response Time |
|-------|-------|-------------|---------------|
| `priority:critical` | #b60205 (dark red) | Immediate fix required | Same day |
| `priority:high` | #d93f0b (orange) | Quick fix required | 1-2 days |
| `priority:medium` | #fbca04 (yellow) | Normal priority | Within sprint |
| `priority:low` | #0e8a16 (green) | Low priority | When available |

### Status Labels

Indicates current progress status.

| Label | Color | Description |
|-------|-------|-------------|
| `status:triage` | #ededed (gray) | Needs classification and evaluation |
| `status:confirmed` | #c2e0c6 (light green) | Confirmed, ready to work |
| `status:in-progress` | #0052cc (blue) | Currently in progress |
| `status:blocked` | #b60205 (red) | Blocked by external dependency |
| `status:needs-info` | #d876e3 (pink) | Additional information needed |
| `status:wontfix` | #ffffff (white) | Will not fix |
| `status:duplicate` | #cfd3d7 (light gray) | Duplicate issue |

### Component Labels

Indicates affected package/module.

| Label | Color | Description |
|-------|-------|-------------|
| `component:cli` | #5319e7 (purple) | CLI package (packages/cli) |
| `component:sdk` | #1d76db (blue) | SDK package (packages/sdk) |
| `component:slack` | #4a154b (slack purple) | Slack Bot integration |
| `component:mcp` | #6f42c1 (purple) | MCP Server |
| `component:docs` | #0075ca (blue) | Documentation |
| `component:ci` | #333333 (black) | CI/CD, GitHub Actions |

### Release Labels

Indicates release plan.

| Label | Color | Description |
|-------|-------|-------------|
| `release:breaking` | #b60205 (red) | Contains breaking changes |
| `release:next-minor` | #c5def5 (light blue) | Target next minor release |
| `release:next-patch` | #c2e0c6 (light green) | Target next patch release |
| `release:next-major` | #fbca04 (yellow) | Target next major release |

### Workflow Labels

Indicates special workflow status.

| Label | Color | Description |
|-------|-------|-------------|
| `good-first-issue` | #7057ff (purple) | Suitable for new contributors |
| `help-wanted` | #008672 (teal) | Extra attention needed |
| `discussion` | #cc317c (pink) | Discussion needed before implementation |
| `rfc` | #fbca04 (yellow) | Request for comments on design |
| `needs-review` | #0e8a16 (green) | Code review needed |

## Label Combination Rules

### Required Labels

All issues require at least the following labels:

1. **type:** label (1 required)
2. **priority:** label (1 required)

### Recommended Combinations

| Scenario | Recommended Label Combination |
|----------|-------------------------------|
| Critical bug | `type:bug` + `priority:critical` + `component:*` + `status:in-progress` |
| New feature | `type:feature` + `priority:*` + `component:*` + `status:triage` |
| Security issue | `type:security` + `priority:critical` + `component:*` |
| Documentation improvement | `type:docs` + `priority:low` + `good-first-issue` |
| Breaking change | `type:feature` + `release:breaking` + `release:next-major` |

### Status Transitions

```
status:triage → status:confirmed → status:in-progress → (PR merged) → closed
                              ↘ status:wontfix
                              ↘ status:duplicate
                              ↘ status:needs-info → status:confirmed
```

## Managing Labels with gh CLI

### List Labels

```bash
# List all labels
gh label list

# Search specific pattern
gh label list | grep "type:"
```

### Add/Remove Labels

```bash
# Add label to issue
gh issue edit <number> --add-label "priority:high,status:in-progress"

# Remove label from issue
gh issue edit <number> --remove-label "status:triage"
```

### Search Issues by Label

```bash
# Search issues with specific label
gh issue list --label "type:bug,priority:critical"

# Search with multiple labels
gh issue list --label "type:bug" --label "component:cli"
```

## Label Setup

Set up labels in a new repository:

```bash
./scripts/setup-github-labels.sh sowonlabs/crewx
```

This script updates existing labels and deletes legacy labels (`bug`, `enhancement`, `documentation`).

---

# GitHub Issues Guide

A guide for creating and managing GitHub Issues.

## Issue Templates

CrewX provides 3 issue templates:

| Template | File | Purpose |
|----------|------|---------|
| Bug Report | `.github/ISSUE_TEMPLATE/bug_report.yml` | Bug report |
| Feature Request | `.github/ISSUE_TEMPLATE/feature_request.yml` | Feature request |
| Question | `.github/ISSUE_TEMPLATE/question.md` | Question |

## How to Create Issues

### 1. Using Web UI

```
https://github.com/sowonlabs/crewx/issues/new/choose
```

### 2. Using gh CLI (Recommended)

#### Bug Report

```bash
gh issue create --template bug_report.yml
```

#### Feature Request

```bash
gh issue create --template feature_request.yml
```

#### Direct Creation (Without Template)

```bash
gh issue create \
  --title "[Bug]: Issue title" \
  --body "Issue content" \
  --label "type:bug,priority:medium"
```

## gh CLI Issue Commands

### List Issues

```bash
# All open issues
gh issue list

# Filter by specific label
gh issue list --label "type:bug"
gh issue list --label "priority:critical"

# Multiple label combination
gh issue list --label "type:bug" --label "component:cli"

# Include closed issues
gh issue list --state all

# JSON output
gh issue list --json number,title,labels
```

### View Issue Details

```bash
# View issue content
gh issue view <number>

# Open in web browser
gh issue view <number> --web

# Include comments
gh issue view <number> --comments
```

### Create Issue

```bash
# Interactive creation
gh issue create

# Use template
gh issue create --template bug_report.yml

# One-liner creation
gh issue create --title "[Bug]: Title" --body "Content"

# Create with labels
gh issue create \
  --title "[Feature]: Layout Props feature" \
  --body "Support props for layout section on/off" \
  --label "type:feature,priority:medium,component:sdk"
```

### Edit Issue

```bash
# Add label
gh issue edit <number> --add-label "status:in-progress"

# Remove label
gh issue edit <number> --remove-label "status:triage"

# Change title
gh issue edit <number> --title "New title"

# Assign assignee
gh issue edit <number> --add-assignee "@me"

# Set milestone
gh issue edit <number> --milestone "v0.8.0"
```

### Change Issue Status

```bash
# Close issue
gh issue close <number>

# Reopen issue
gh issue reopen <number>

# Close with comment
gh issue close <number> --comment "Resolved in PR #123"
```

### Add Comment to Issue

```bash
# Add comment
gh issue comment <number> --body "Starting work"

# Using HEREDOC
gh issue comment <number> --body "$(cat <<'EOF'
## Progress

- [x] Analysis complete
- [ ] Implementation in progress
- [ ] Testing planned
EOF
)"
```

## Issue Status Management

### Status Label Transitions

```
[New Issue] status:triage
    ↓
[Confirmed] status:confirmed
    ↓
[Work Started] status:in-progress
    ↓
[PR Merged] → Issue closed
```

### Status Update Examples

```bash
# Triage complete → Confirmed
gh issue edit 42 \
  --remove-label "status:triage" \
  --add-label "status:confirmed"

# Start work
gh issue edit 42 \
  --remove-label "status:confirmed" \
  --add-label "status:in-progress"

# Close after PR merge
gh issue close 42 --comment "Resolved in PR #50"
```

## Issue Creation Examples for Agents

### Bug Issue

```bash
gh issue create \
  --title "[Bug]: MCP response parsing error" \
  --body "$(cat <<'EOF'
## Bug Description

JSON parsing error occurs in MCP server response.

## Steps to Reproduce

1. Run `crewx mcp`
2. Send malformed request
3. Error occurs

## Expected Behavior

Should fail gracefully with error message

## Actual Behavior

Process crashes

## Environment

- CrewX Version: 0.7.7
- Node.js: v20.19.2
- OS: macOS
EOF
)" \
  --label "type:bug,priority:high,component:mcp,status:triage"
```

### Feature Request Issue

```bash
gh issue create \
  --title "[Feature]: Layout Props for section on/off" \
  --body "$(cat <<'EOF'
## Problem Statement

Want to show only specific sections when using crewx/default layout

## Proposed Solution

Implement section on/off via props:
- showManual: bool
- showAgentProfile: bool
- showSkills: bool
- showConversationHistory: bool

## Use Cases

1. Hide unnecessary sections in simple agents
2. Save prompt tokens

## Affected Component

SDK (packages/sdk)
EOF
)" \
  --label "type:feature,priority:medium,component:sdk,status:triage"
```

## Linking Issues and PRs

### Auto-close Keywords

When these keywords are used in a PR, the issue is automatically closed on merge:

- `Closes #123`
- `Fixes #123`
- `Resolves #123`

### PR Body Example

```markdown
## Summary

Implement Layout Props feature

## Related Issues

- Closes #42
- Related to #35
```

## Issue Search Tips

### Advanced Search

```bash
# Issues I created
gh issue list --author "@me"

# Issues assigned to me
gh issue list --assignee "@me"

# Recently updated issues
gh issue list --json number,title,updatedAt | jq 'sort_by(.updatedAt) | reverse'

# Issues without comments
gh issue list --json number,title,comments | jq '[.[] | select(.comments | length == 0)]'
```

---

# GitHub Pull Request Guide

A guide for creating and reviewing GitHub PRs.

## PR Template

CrewX provides a standard PR template:
- Location: `.github/PULL_REQUEST_TEMPLATE.md`

## How to Create PRs

### 1. Using gh CLI (Recommended)

```bash
# Interactive creation
gh pr create

# One-liner creation
gh pr create --title "Title" --body "Content"

# Use template
gh pr create --template PULL_REQUEST_TEMPLATE.md
```

### 2. Detailed PR Creation

```bash
gh pr create --title "feat(sdk): Add Layout Props feature" --body "$(cat <<'EOF'
## Summary

- Implement section on/off via props in Layout template
- Add 5 boolean options to propsSchema

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

## PR Template Sections

### Summary

Summary of changes. Specify cross-package impact (CLI ↔ SDK).

### Change Type

Checklist format:
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactoring
- [ ] Documentation update
- [ ] Configuration change

### Related Issues / WBS Items

- `Closes #123` - Automatically closes issue when PR is merged
- `Related to #456` - Reference to related issue
- Specify WBS items if applicable

### Testing

Build and test execution status:
- `npm run build`
- `npm test --workspace @sowonai/crewx-sdk`
- `npm test --workspace crewx`

### Checklist

Required items:
- Code of Conduct confirmed
- CLA signed
- Contributing Guide followed

### Breaking Changes

If there are breaking changes, provide migration guide

## gh CLI PR Commands

### List PRs

```bash
# Open PR list
gh pr list

# PRs I created
gh pr list --author "@me"

# PRs requesting my review
gh pr list --reviewer "@me"

# Filter by status
gh pr list --state all
gh pr list --state merged
gh pr list --state closed
```

### View PR Details

```bash
# View PR content
gh pr view <number>

# Open in web
gh pr view <number> --web

# List changed files
gh pr diff <number>

# PR check status
gh pr checks <number>
```

### Create PR

```bash
# Basic creation
gh pr create

# Specify title and body
gh pr create --title "feat: New feature" --body "Description..."

# Create Draft PR
gh pr create --draft

# Specify base branch
gh pr create --base develop

# Add label
gh pr create --label "type:feature"
```

### Edit PR

```bash
# Add label
gh pr edit <number> --add-label "needs-review"

# Add reviewer
gh pr edit <number> --add-reviewer username

# Change title
gh pr edit <number> --title "New title"

# Change Draft → Ready
gh pr ready <number>
```

### PR Review

```bash
# Approve review
gh pr review <number> --approve

# Request changes
gh pr review <number> --request-changes --body "Changes needed"

# Comment
gh pr review <number> --comment --body "LGTM!"
```

### Merge PR

```bash
# Merge (default: merge commit)
gh pr merge <number>

# Squash merge
gh pr merge <number> --squash

# Rebase merge
gh pr merge <number> --rebase

# Delete branch after merge
gh pr merge <number> --delete-branch

# Auto merge (after CI passes)
gh pr merge <number> --auto --squash
```

## PR Branch Strategy

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<issue-number>-<short-description>` | `feature/55-add-layout-props` |
| Bug fix | `bugfix/<issue-number>-<short-description>` | `bugfix/42-fix-mcp-parsing` |
| Hotfix | `hotfix/<issue-number>-<short-description>` | `hotfix/99-critical-crash` |
| Release | `release/<version>` | `release/0.8.0` |
| Chore | `chore/<issue-number>-<short-description>` | `chore/60-cleanup-tests` |

**Branch naming rules:**
- description in kebab-case (lowercase + hyphens)
- Maximum 3-4 words

### PR Workflow

```
feature/xxx → develop → release/x.x.x → main
     ↓            ↓            ↓
   Code Review   Integration Test   Release QA
```

## How to Request Review

### 1. When Creating PR

```bash
gh pr create --reviewer reviewer1,reviewer2
```

### 2. Add to Existing PR

```bash
gh pr edit <number> --add-reviewer reviewer1
```

### 3. Request Team Review

```bash
gh pr edit <number> --add-reviewer @sowonlabs/core-team
```

## Check PR Status

### CI Status Check

```bash
# All check status
gh pr checks <number>

# Wait for checks to pass
gh pr checks <number> --watch
```

### Debug Failed Checks

```bash
# View failed workflow logs
gh run list --limit 5
gh run view <run-id> --log-failed
```

## PR Creation Examples for Agents

### Feature PR

```bash
gh pr create \
  --title "feat(sdk): Add Layout Props feature" \
  --body "$(cat <<'EOF'
## Summary

- Implement section on/off via props in Layout template
- Add 5 boolean options to propsSchema

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

### Bug Fix PR

```bash
gh pr create \
  --title "fix(cli): Fix MCP response parsing error" \
  --body "$(cat <<'EOF'
## Summary

Fix crash that occurred when parsing JSON from MCP server response

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

## Using Draft PRs

When you want feedback on work in progress:

```bash
# Create Draft PR
gh pr create --draft --title "WIP: Implementing Layout Props"

# Change to Ready after completion
gh pr ready <number>
```

## Resolving Conflicts

```bash
# Merge base branch into current branch
git fetch origin
git merge origin/develop

# Or rebase
git rebase origin/develop

# Push after resolving conflicts
git push --force-with-lease
```

---

## Related Resources

- Label setup script: `scripts/setup-github-labels.sh`
- Issue templates: `.github/ISSUE_TEMPLATE/`
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`

## Label Category Summary

| Category | Purpose | Examples |
|----------|---------|----------|
| `type:*` | Issue/PR type classification | `type:bug`, `type:feature` |
| `priority:*` | Priority level | `priority:high`, `priority:critical` |
| `status:*` | Current status | `status:triage`, `status:in-progress` |
| `component:*` | Affected component | `component:cli`, `component:sdk` |
| `release:*` | Release target | `release:next-minor` |
