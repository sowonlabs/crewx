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
   - ✅ **PASS**: Merge to `develop` → npm publish
   - ❌ **FAIL**: Exclude failed bugs → `rc.1`, `rc.2`, ... (retry)

## Branch Strategy

```
All issues:          feature/<issue-number>-<short-description>
Integration testing: release/X.X.X-rc.N
Stable development:  develop
Production:          main
```

**Branch naming rules:**
- ALL branches use `feature/` prefix (bug/feature/chore distinction via GitHub Labels)
- Description should be kebab-case (lowercase with hyphens)
- Max 3-4 words in description
- Examples: `feature/42-fix-mcp-parsing`, `feature/55-add-layout-props`, `feature/60-cleanup-tests`

**Workflow:**
```
feature/<issue>-<desc> → release/X.X.X-rc.N → develop → main
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
gh issue comment <issue-number> --body '🤖 **@<agent-name>** started working'
```

### 2. When Work is Completed
```bash
gh issue comment <issue-number> --body '✅ **@<agent-name>** implementation completed
- Branch: <branch-name>
- Commit: <commit-hash>'
```

### 3. Add Label (Optional)
```bash
gh issue edit <issue-number> --add-label 'worker:<agent-name>'
```

### 4. Update status.md
Record the agent name in the worker column

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

### Process Flow

1. **Worker completes PR**
   ```bash
   gh pr create --title "..." --body "..."
   ```

2. **Dev Lead assigns reviewer**
   ```bash
   gh issue edit <number> --add-label "reviewer:crewx_gemini_dev"
   crewx x "@crewx_gemini_dev Review PR #XX for critical issues only. Ignore style."
   ```

3. **Reviewer checks & comments**
   - Approve: "✅ LGTM - No critical issues found"
   - Request changes: "❌ Critical issue: [description]"

4. **After approval → Release Manager merges**
   ```bash
   crewx x "@crewx_release_manager Merge PR #XX to release/X.Y.Z"
   ```

### Review Comment Template

```
## Cross-Review by @[agent_name]

**Status**: ✅ Approved / ❌ Changes Requested

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
