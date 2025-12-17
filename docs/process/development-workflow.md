# Development Workflow Overview

## Bug Status Flow
```
created → analyzed → in-progress → resolved → closed
                                           ↘ rejected
```

**Important:** Agents should NEVER set status to `closed` - only users can close bugs after verification.

## RC Versioning Convention

**ALWAYS start from rc.0**

- First RC: `0.3.14-rc.0` ✅
- After failure: `0.3.14-rc.1`, `rc.2`, ...
- Never start with rc.1 ❌

## RC Release Process

1. **Merge**: All `resolved` bugs → `release/X.X.X-rc.0` branch
2. **Test**: QA team runs integration tests
3. **Decision**:
   - **PASS**: Merge to `develop` → npm publish
   - **FAIL**: Exclude failed bugs → `rc.1`, `rc.2`, ... (retry)

### RC Version Policy

**RC period can run 1-2 weeks for thorough verification:**
- RC numbers can increment as needed: `rc.0`, `rc.1`, ... `rc.10`, `rc.11`, etc.
- Each RC should be tested thoroughly before final release
- No rush to release - quality over speed
- RC version increments are normal and expected during active development

**Example Timeline:**
```
Day 1:  rc.0 - Initial RC with 5 bug fixes
Day 3:  rc.1 - Found issue in rc.0, fixed + 2 new features
Day 5:  rc.2 - Minor fixes from QA feedback
Day 7:  rc.3 - Final tweaks
Day 10: QA PASS → Release v0.7.8
```

## Branch Strategy

```
All issues:          feature/issue-<number>
Integration testing: release/X.X.X-rc.N
Stable development:  develop
Production:          main
```

**Branch naming rules:**
- ALL branches use `feature/issue-<number>` format (issue number only, no description)
- Bug/feature/chore distinction via GitHub Labels
- Examples: `feature/issue-42`, `feature/issue-55`, `feature/issue-60`
- Reason: Prevents duplicate branches for same issue (description variations caused multiple branches)

**Workflow:**
```
feature/issue-<number> → release/X.X.X-rc.N → develop → main
```

## 🚨 Release Branch Workflow (Important!)

During active release cycles, **work directly on the release branch** instead of develop.

### Why?

Previously, agents worked on develop branch by default. This caused issues:
- ❌ Agents analyzed develop branch code, not release branch changes
- ❌ Bug fixes in release branch weren't visible to agents
- ❌ Cross-review missed release-specific changes
- ❌ Conversation history and context were based on wrong branch state

### Current Workflow

**During Release Cycle (e.g., 0.7.8):**
```
Working directory: release/0.7.8 branch (NOT develop)

1. Clone/checkout release branch directly
2. Create feature branches FROM release branch
3. PRs target release branch
4. Agents analyze release branch state
```

**After Release Complete:**
```
1. Merge release/X.X.X → main (production)
2. Merge release/X.X.X → develop (sync)
3. Switch working directory to develop for next cycle
```

### Agent Configuration

All dev agent prompts include release branch awareness:
- [docs/prompts/dev-claude.md](docs/prompts/dev-claude.md)
- [docs/prompts/dev-gemini.md](docs/prompts/dev-gemini.md)
- [docs/prompts/dev-codex.md](docs/prompts/dev-codex.md)

These prompts contain "Current Release Branch" section that reminds agents to:
- Analyze current branch, not develop
- Target PRs to current release branch
- NOT use git worktree for release branch (already on it)

### Benefits

- ✅ Accurate code analysis based on actual release state
- ✅ Cross-review sees real changes in release context
- ✅ No confusion between develop and release differences
- ✅ Conversation history reflects release branch work

## Agent Work Tracking

Track which agent worked on an issue via GitHub Issue comments.

### 1. When Starting Work
```bash
gh issue comment <issue-number> --body '**@<agent-name>** started working'
```

### 2. When Work is Completed
```bash
gh issue comment <issue-number> --body '**@<agent-name>** implementation completed
- Branch: <branch-name>
- Commit: <commit-hash>'
```

### 3. Add Label (Optional)
```bash
gh issue edit <issue-number> --add-label 'worker:<agent-name>'
```

### 4. Update status.md
Record the agent name in the worker column

## Issue-Branch-PR-RC Connection Flow

Understanding the complete flow from Issue to Release:

```
┌──────────────┐     ┌─────────────────────────────┐     ┌──────────────┐
│   Issue #28  │ ──→ │ feature/28-log-limits       │ ──→ │    PR #29    │
│  (GitHub)    │     │ (worktree/feature-28-...)   │     │  (GitHub)    │
└──────────────┘     └─────────────────────────────┘     └──────────────┘
       │                                                        │
       │                                                        ▼
       │                                              ┌──────────────────┐
       │                                              │ Dev Lead verifies│
       │                                              │ (gh pr diff)     │
       │                                              └──────────────────┘
       │                                                        │
       │                                                        ▼
       │                                              ┌──────────────────┐
       │                                              │ Cross-review by  │
       │                                              │ different agent  │
       │                                              └──────────────────┘
       │                                                        │
       │                                                        ▼
       ▼                                              ┌──────────────────┐
┌──────────────┐                                      │ Merge to release │
│ status.md    │ ◄───────────────────────────────────│ branch           │
│ updated      │                                      └──────────────────┘
└──────────────┘                                               │
                                                               ▼
                                                    ┌──────────────────┐
                                                    │ RC version bump  │
                                                    │ (0.7.8-rc.11)    │
                                                    └──────────────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────┐
                                                    │ QA Testing       │
                                                    │                  │
                                                    └──────────────────┘
                                                               │
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                          ┌─────────────┐       ┌─────────────┐
                                          │ PASS → main │       │ FAIL → fix  │
                                          │ release     │       │ → new RC    │
                                          └─────────────┘       └─────────────┘
```

### Key Checkpoints

| Step | Action | Responsible |
|------|--------|-------------|
| 1. Issue created | Add labels, assign worker | Dev Lead |
| 2. Branch created | `feature/issue-<number>` from develop | Worker |
| 3. Implementation | Code changes in worktree | Worker |
| 4. PR created | Target: release branch | Worker |
| 5. PR verification | `gh pr diff`, check requirements | Dev Lead |
| 6. Cross-review | Critical issues only | Assigned reviewer |
| 7. Merge to release | After approval | Release Manager |
| 8. RC version | Bump and deploy | Release Manager |
| 9. QA test | Integration testing | QA Lead |
| 10. Final release | Merge to main, npm publish | Release Manager |

### Real Example: Issue #28

```bash
# Step 1: Issue #28 created (log limits feature request)

# Step 2: Worker creates branch
git worktree add worktree/feature-issue-28 develop
cd worktree/feature-issue-28
git checkout -b feature/issue-28

# Step 3: Implementation (code changes)
# ... edit files ...

# Step 4: Worker creates PR #29
gh pr create --base release/0.7.8 --title "feat(#28): increase log limits"

# Step 5: Dev Lead verifies
gh pr diff 29  # Check changes match requirements
gh issue view 28  # Verify all requirements covered

# Step 6-7: Cross-review and merge
# Dev Lead assigns reviewer, Release Manager merges after approval

# Step 8: RC version bump
npm version 0.7.8-rc.11

# Step 9-10: QA and release
```

## PR Cross-Review Process

**All PRs require cross-review before merge.**

### Cross-Review Pairing

| Worker | Reviewer |
|--------|----------|
| @crewx_claude_dev | @crewx_gemini_dev |
| @crewx_gemini_dev | @crewx_claude_dev |
| @crewx_codex_dev | @crewx_claude_dev or @crewx_gemini_dev |

### Review Scope

**DO Review (Critical Issues Only):**
- ❗ Logic errors and bugs
- ❗ Security vulnerabilities
- ❗ Performance problems
- ❗ Missing error handling
- ❗ Breaking changes

**DO NOT Review (Ignore):**
- ✗ Code style preferences
- ✗ Variable naming (unless confusing)
- ✗ Comment formatting
- ✗ Import ordering
- ✗ Whitespace issues

### Process Flow (Dev Lead PR Cross-Check)

**IMPORTANT**: Dev Lead performs PR verification before assigning to Release Manager.

1. **Worker completes PR and notifies Dev Lead**
   ```bash
   # Worker creates PR
   gh pr create --title "feat(#28): add feature" --body "..."

   # Worker notifies Dev Lead (via issue comment)
   gh issue comment 28 --body "PR #XX created, ready for Dev Lead review"
   ```

2. **Dev Lead verifies PR changes**
   ```bash
   # Check PR diff matches requirements
   gh pr diff <PR-number>

   # Verify implementation covers all requirements from issue
   gh issue view 28
   ```

3. **Dev Lead assigns reviewer (after verification)**
   ```bash
   gh issue edit <number> --add-label "reviewer:crewx_gemini_dev"
   crewx x "@crewx_gemini_dev Review PR #XX for critical issues only. Ignore style."
   ```

4. **Reviewer checks & comments**
   - Approve: "LGTM - No critical issues found"
   - Request changes: "Critical issue: [description]"

5. **After approval → Release Manager merges**
   ```bash
   crewx x "@crewx_release_manager Merge PR #XX to release/X.Y.Z"
   ```

### Dev Lead PR Verification Checklist

Before assigning a reviewer, Dev Lead must verify:
- [ ] PR diff shows expected changes (`gh pr diff <number>`)
- [ ] All issue requirements are addressed
- [ ] No unrelated changes included
- [ ] Commit messages follow convention
- [ ] Target branch is correct (release/X.Y.Z or develop)

### Review Comment Template

```
## Cross-Review by @[agent_name]

**Status**: Approved / Changes Requested

### Critical Issues Found
- [ ] Issue 1: ...
- [ ] Issue 2: ...

### Summary
[Brief assessment - focus on logic, security, performance only]
```

## Checking Current Release Status

Before planning a new RC, always check the current production status:

### 1. Check NPM Registry (Production Version)
```bash
npm view crewx version
# Output: 0.3.16 → Latest published version
```

### 2. Check Git Tags (Release History)
```bash
git tag | grep "^v0\.3" | sort -V | tail -5
# Shows recent release tags like v0.3.16, v0.3.15, etc.
```

### 3. Check Release Branches (In-Progress RCs)
```bash
git branch -r | grep "release/"
# Shows active RC branches like origin/release/0.3.17-rc.0
```

### Decision Logic
```
NPM version: 0.3.16
Latest tag: v0.3.16
Latest RC reports: 0.3.16-rc.2 (PASS)
Resolved bugs: 3

→ Conclusion: 0.3.16 already released
→ Next RC: 0.3.17-rc.0 (with 3 resolved bugs)
```

**Key Principle:** Git tags and NPM registry are the single source of truth for release status, not test reports.

## Release Plan Structure

Each release should have a plan document defining:
- Target version
- Included bugs (with `target_release` field)
- Test report location
- Expected timeline

See: Release Plan Template in agents.yaml documents section
