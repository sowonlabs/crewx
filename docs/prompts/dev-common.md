# Development Process (Common)

This document defines the common development process for all development team members.

## Development Process Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Development Process Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. ISSUE ASSIGNED                                                   │
│     └─ status:in-progress                                           │
│                    ↓                                                 │
│  2. CREATE WORKTREE (from main)                                      │
│     └─ git worktree add worktree/feature-issue-XX main              │
│                    ↓                                                 │
│  3. DEVELOP (feature/issue-XX branch)                                │
│     └─ Build, Test, Commit                                          │
│                    ↓                                                 │
│  4. CREATE PR (→ release/X.Y.Z)                                      │
│     ├─ gh pr create --base release/X.Y.Z                            │
│     ├─ Issue comment: "PR #XX created"                              │
│     └─ status:resolved                                              │
│                    ↓                                                 │
│  5. CROSS REVIEW (worker ≠ reviewer)                                 │
│     │                                                                │
│     ├─ Problems Found ──→ status:changes-requested                  │
│     │   ├─ PR comment (details)                                     │
│     │   ├─ Issue comment (summary)                                  │
│     │   └─ Developer fixes → back to step 3                         │
│     │                                                                │
│     └─ Approved ────────→ status:approved                           │
│         └─ PR approve                                               │
│                    ↓                                                 │
│  6. MERGE TO RELEASE (by Release Manager)                            │
│     ├─ Merge PR to release/X.Y.Z                                    │
│     ├─ status:merged                                                │
│     └─ Issue closed                                                 │
│                    ↓                                                 │
│  7. CLEANUP                                                          │
│     └─ git worktree remove worktree/feature-issue-XX                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Status Label Flow:
  status:triage → status:in-progress → status:resolved
                                            ↓
                         ┌──────────────────┴──────────────────┐
                         ↓                                     ↓
              status:changes-requested              status:approved
              (reviewer found issues)               (review passed)
                         ↓                                     ↓
                   Developer fixes                    status:merged
                         ↓                            (issue closed)
                  status:resolved
                  (ready for re-review)
```

## Code Review Process

When assigned as a reviewer for a PR, follow this process:

### Review Checklist
1. **Code Quality**: Check for bugs, security issues, performance problems
2. **Requirements**: Verify PR matches issue requirements
3. **Testing**: Ensure adequate test coverage
4. **Standards**: Follow project coding conventions

### If Problems Found (CRITICAL - Follow All Steps)

```bash
# 1. Add detailed review comment to PR
gh pr comment <PR-number> --body "## Code Review: Changes Requested

### Issues Found:
- Issue 1: [description]
- Issue 2: [description]

### Required Actions:
- [ ] Fix issue 1
- [ ] Fix issue 2

Reviewer: @<your-agent-id>"

# 2. Add summary comment to the ISSUE (for tracking)
gh issue comment <issue-number> --body "PR #<PR-number> review: Changes requested.
Issues: [brief summary]
See PR for details."

# 3. Update issue status label
gh issue edit <issue-number> --remove-label "status:resolved" --add-label "status:changes-requested"
```

### If Review Passed

```bash
# 1. Approve the PR
gh pr review <PR-number> --approve --body "Code review passed. LGTM!"

# 2. Add comment to the ISSUE (for tracking)
gh issue comment <issue-number> --body "PR #<PR-number> review: Approved. Ready for merge."

# 3. Update issue status label
gh issue edit <issue-number> --remove-label "status:resolved" --add-label "status:approved"
```

### Review Rules
- **ALWAYS** comment on both PR AND Issue (for traceability)
- **ALWAYS** update issue status label after review
- **NEVER** approve your own PR (worker ≠ reviewer)
- Focus on security, correctness, and maintainability
