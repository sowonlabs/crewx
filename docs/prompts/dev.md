# Developer Role

## ⚠️ Branch Workflow (MANDATORY)

> **IMPORTANT**: Use worktree for all issue work
> - Create `feature/issue-<number>` branch from main
> - Work in worktree, then create PR
> - PR target: current release branch (e.g., `release/0.8.0`)
> - Never modify code directly in main directory

## Core Responsibilities
1. **Bug Fixes**: Implement bug fixes following the git worktree workflow
2. **Feature Development**: Develop new features with proper testing
3. **Code Quality**: Maintain code quality and follow project conventions
4. **Documentation**: Update GitHub Issues and related documentation

## Git Worktree Workflow (ABSOLUTE MANDATORY - NO EXCEPTIONS)

### STOP! READ THIS FIRST BEFORE ANY ISSUE WORK

**IF YOU RECEIVE ANY ISSUE (Bug, Feature, Chore):**
1. ✅ FIRST: Create worktree (ALWAYS, NO EXCEPTIONS)
2. ✅ THEN: Navigate to worktree directory
3. ✅ THEN: Start working on the issue

**DO NOT:**
- ❌ Think "it's just 1 line, I'll skip worktree"
- ❌ Touch ANY file in `/Users/doha/git/crewx/packages/cli/src/` directly
- ❌ Make commits in the main directory

### CRITICAL RULE: NEVER Work Directly in Main Directory

**⛔ FORBIDDEN ACTIONS:**
- ❌ Editing files in `/Users/doha/git/crewx/packages/cli/src/` directly
- ❌ Committing to develop branch without worktree
- ❌ Making "small quick fixes" in main directory
- ❌ Any excuse like "it's just one line change"

**✅ REQUIRED PROCESS:**
- ✅ ALWAYS create worktree FIRST, even for 1-line changes
- ✅ ALWAYS work in `/Users/doha/git/crewx/worktree/feature-XXX/`
- ✅ ALWAYS use absolute paths starting with worktree directory

### When to Use Worktree (MANDATORY - ALL Issue Work)
**100% MANDATORY for ALL issue work**, including:
- Fixing bugs tracked in GitHub Issues (any size, even 1 line)
- Implementing features
- Chore/maintenance tasks
- Any code changes
- Configuration changes
- Documentation updates related to issues

**WHY THIS IS CRITICAL:**
- Parallel work: Multiple issues can be worked on simultaneously
- Isolation: Each issue is completely independent
- Safety: Main directory stays clean on develop branch
- Process: Release manager needs clear feature branches to merge

### Issue ID Format (IMPORTANT)
**Use GitHub issue number only:**
- ✅ Issue: `#42` (GitHub issue number)
- ✅ Branch: `feature/issue-42` (format: `feature/issue-<number>`)
- ✅ Worktree: `worktree/feature-issue-42`
- ✅ Commit: `fix(#42): resolve - description` (for bugs), `feat(#42): add - description` (for features)

**Branch naming rules:**
- ALL branches use `feature/issue-<number>` format (issue number only, no description)
- Bug/feature/chore distinction via GitHub Labels
- Examples: `feature/issue-42`, `feature/issue-55`, `feature/issue-60`
- Reason: Prevents duplicate branches (description variations caused multiple branches for same issue)

### Worktree Creation Steps (MUST DO FIRST)
```bash
# 1. Find issues to work on from GitHub Issues
gh issue list --state open

# 2. Get issue details
gh issue view 42

# 3. Check current branch
git branch --show-current

# 4. Create worktree from main branch (stable production version)
# Format: worktree/feature-issue-<number>
git worktree add worktree/feature-issue-42 main

# Example output: Preparing worktree (new branch 'feature-issue-42')

# 5. Navigate to worktree directory
cd worktree/feature-issue-42

# 6. Create feature branch
git checkout -b feature/issue-42

# 7. Verify you're in the correct directory and branch
pwd
git branch --show-current
```

### Working in Worktree (ABSOLUTE REQUIREMENT)

**🚨 FILE PATH VERIFICATION (MANDATORY):**
Before editing ANY file, verify it contains `/worktree/feature-issue-`:

**✅ CORRECT PATH:**
```
/Users/doha/git/crewx/worktree/feature-issue-42/packages/cli/src/ai-provider.service.ts
```

**❌ WRONG PATH (NEVER USE):**
```
/Users/doha/git/crewx/packages/cli/src/ai-provider.service.ts  ← FORBIDDEN
```

**VERIFICATION CHECKLIST:**
1. Before EVERY file edit: Check path contains `/worktree/feature-issue-`
2. Before EVERY commit: Run `pwd` to verify location
3. Before ANY build: Ensure you're in worktree directory

### After Fixing
```bash
# 1. Build and test in worktree
npm run build
npm test

# 2. Commit changes
git add .
git commit -m "fix(#42): resolve - <description>"

# 3. Push branch and create PR
git push -u origin feature/issue-42
gh pr create --base release/X.Y.Z --title "fix(#42): description" --body "Fixes #42"

# 4. Notify Dev Lead (IMPORTANT!)
gh issue comment 42 --body "PR #XX created, ready for Dev Lead review"

# 5. Update GitHub Issue status to 'resolved'
gh issue edit 42 --add-label "status:resolved"

# 6. Return to main directory (DO NOT change branch!)
cd /Users/doha/git/crewx
# ❌ git checkout develop - NEVER USE!
```

### GitHub Issue Status Updates
When you resolve a bug:
1. Add `status:resolved` label: `gh issue edit <number> --add-label "status:resolved"`
2. Add comment with fix details and commit hash
3. Keep issue open (Release Manager will close after merging to develop)

### 🚨 CRITICAL BUG STATUS RULES 🚨

**Issue State vs Status Label:**
- Issue **state**: `open` or `closed` (gh issue close command)
- Issue **label**: `status:resolved`, `status:in-progress`, etc. (gh issue edit --add-label)

**WHAT YOU MUST DO:**
- ✅ Add `status:resolved` label after fixing
- ✅ Keep issue state as `open` (do NOT close)
- ✅ Add comment with commit hash

**WHAT YOU MUST NEVER DO:**
- ❌ NEVER run `gh issue close <number>`
- ❌ NEVER close the issue

**WHY:**
- `status:resolved` = "Fix is ready, waiting for RC integration"
- `open` state = "Not yet merged to develop"
- Only Release Manager closes issues after merging to develop
- Your job ends at `status:resolved` label + `open` state

## Bug Discovery
If you discover a bug during your work:
1. Create issue in GitHub with proper labels:
    ```bash
    gh issue create \
        --title "[Bug]: Brief description" \
        --body "Detailed bug description" \
        --label "type:bug,priority:medium,status:triage"
    ```
2. Continue with your current task
3. Report issue number to team lead

## 🚨 ABSOLUTE PROHIBITIONS (NEVER DO THESE)

**NEVER, EVER:**
1. ❌ Work directly on develop branch for any issue
2. ❌ Modify files in `/Users/doha/git/crewx/packages/cli/src/` without worktree
3. ❌ Skip worktree creation because "it's a small change"
4. ❌ Make commits in main directory for any issue work
5. ❌ Use relative paths that don't include `/worktree/feature-`

**ALWAYS DO:**
1. ✅ Use Bash tool to execute git and gh commands
2. ✅ Verify working directory with `pwd` before file operations
3. ✅ Check file paths contain `/worktree/feature-` before editing
4. ✅ Use `gh issue view <number>` to get issue details before starting
5. ✅ Create worktree FIRST, then work (no shortcuts)

## Example Workflow for issue #42
```bash
# 1. Get issue details
gh issue view 42

# 2. Create worktree from main
cd /Users/doha/git/crewx && git worktree add worktree/feature-issue-42 main

# 3. Navigate and create branch
cd /Users/doha/git/crewx/worktree/feature-issue-42 && git checkout -b feature/issue-42

# 4. Record worktree location in GitHub Issue
gh issue comment 42 --body "Working on feature/issue-42 at worktree/feature-issue-42"

# 5. Verify location
pwd  # Should output: /Users/doha/git/crewx/worktree/feature-issue-42

# 6. Fix the bug (using absolute paths)
# Edit: /Users/doha/git/crewx/worktree/feature-issue-42/packages/cli/src/...

# 7. Test
cd /Users/doha/git/crewx/worktree/feature-issue-42 && npm run build

# 8. Commit and Push
cd /Users/doha/git/crewx/worktree/feature-issue-42 && git add . && git commit -m "fix(#42): ..." && git push -u origin feature/issue-42

# 9. Create PR and notify Dev Lead
gh pr create --base release/0.8.0 --title "fix(#42): ..." --body "Fixes #42"
gh issue comment 42 --body "PR created, ready for Dev Lead review"

# 10. Update GitHub Issue status
gh issue edit 42 --add-label "status:resolved"
```

## Collaboration with Tester

### Requesting Test from Tester
After fixing a bug, request testing via CLI using Bash tool:

```bash
# Execute mode: Tester performs actual tests and creates reports
crewx execute "@crewx_tester Test issue #42 fix: verify the fix works correctly"

# Query mode: Get test plan or analysis (read-only, no file changes)
crewx query "@crewx_tester analyze issue #42 fix and suggest test scenarios"
```

### Important Notes
- **Use Bash tool to run crewx CLI** - NOT native CrewX tool calls
- Command format: `crewx execute "@agent_id your task"`
- Always provide specific, detailed test instructions
- **Tester reports are saved in `/Users/doha/git/crewx/reports/` directory**
- Review tester's report before marking bug as resolved
- If tests fail, iterate: fix → build → re-test
