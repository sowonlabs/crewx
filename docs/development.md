# SowonAI CrewX Development Process

**Version:** 2.0
**Last Updated:** 2025-12-09
**Owner:** Development Team Lead

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Issue Workflow](#issue-workflow)
3. [Branch Strategy](#branch-strategy)
4. [Agent Collaboration](#agent-collaboration)
5. [Integration Testing Process](#integration-testing-process)
6. [Release Process](#release-process)

---

## Overview

SowonAI CrewX aims for AI agent-based collaborative development.
- **Development Team Lead**: GitHub Copilot (task distribution, coordination, decision-making)
- **Developer Agents**: @claude, @copilot (analysis, implementation)
- **Tester Agent**: @crewx_tester (verification)
- **Issue Management**: GitHub Issues (bugs, features, task tracking)

---

## Issue Workflow

### Issue State Transitions (GitHub Labels)
```
status:triage → status:in-progress → status:resolved → closed
                                              ↘ status:rejected
```

### Status Descriptions
- **status:triage**: Issue initially registered, awaiting analysis
- **status:in-progress**: Fix/development work in progress
- **status:resolved**: Fix complete, tests passed, committed (awaiting merge)
- **closed**: Merged to develop branch, reflected in release
- **status:rejected**: Fix failed or cannot reproduce, needs rework

### GitHub Issue Management
- All issues are registered in GitHub Issues
- Label system:
  - `type:bug`, `type:feature`, `type:chore`
  - `priority:high`, `priority:medium`, `priority:low`
  - `status:triage`, `status:in-progress`, `status:resolved`, `status:rejected`

### Issue Work Process
```bash
# 1. Check issue list
gh issue list --state open

# 2. Check issue details
gh issue view 42

# 3. Change label when starting work
gh issue edit 42 --add-label "status:in-progress" --remove-label "status:triage"

# 4. Change label when fix is complete
gh issue edit 42 --add-label "status:resolved" --remove-label "status:in-progress"
gh issue comment 42 --body "Fixed in commit $(git rev-parse --short HEAD)"

# 5. Close issue after merge (Release Manager only)
gh issue close 42
```

---

## Branch Strategy

### Branch Structure
```
main (production, always stable)
  ↑
develop (development integration)
  ↑
release/X.X.X-rc.N (release candidate integration)
  ↑
feature/issue-<number> (all issue work, based on main)
```

**Branch Naming Rules:**
- `feature/issue-<number>`: All issue work (**branched from main**)
- `release/X.X.X-rc.N`: RC integration branch (branched from develop)

**Examples:**
- `feature/issue-42` (bug fix)
- `feature/issue-55` (feature addition)
- `feature/issue-60` (cleanup work)

**Core Principles:**
- ALL branches use `feature/issue-<number>` format (issue number only, no description)
- Bug/feature/chore distinction managed via GitHub Labels
- Prevents duplicate branches (description variations caused multiple branches for same issue)

### Worktree Usage
**All branches are created via Git Worktree to provide isolated environments**

#### Issue Work Workflow
```bash
# 1. Check issue
gh issue list --state open
gh issue view 42

# 2. Create Worktree (based on main)
cd $(git rev-parse --show-toplevel)
git worktree add worktree/feature-issue-42 -b feature/issue-42 main

# 3. Record work branch (comment on GitHub Issue)
gh issue comment 42 --body "Working on: feature/issue-42
Worktree: $(git rev-parse --show-toplevel)/worktree/feature-issue-42"

# 4. Work
cd worktree/feature-issue-42
# ... code modifications ...
git add .
git commit -m "fix(#42): resolve - description"

# 5. Update GitHub Issue status
gh issue edit 42 --add-label "status:resolved" --remove-label "status:in-progress"
gh issue comment 42 --body "Fixed: description in commit $(git rev-parse --short HEAD)"

# 6. Wait for integration testing (to be integrated into release/X.X.X-rc.N)
```

#### Release Candidate (RC) Branch Workflow
```bash
# 1. Create RC branch as worktree (based on develop)
git worktree add worktree/release-0.3.9-rc.0 -b release/0.3.9-rc.0 develop

# 2. Merge all resolved issue branches
cd worktree/release-0.3.9-rc.0
git merge --no-ff feature/issue-42
git merge --no-ff feature/issue-55
git merge --no-ff feature/issue-60
# ... (all resolved issues)

# 3. Build and integration testing
npm run build

# 4. Request integration tests from QA Lead
# @crewx_qa_lead coordinates testers for parallel testing

# 5-A. When tests pass (PASS)
cd $(git rev-parse --show-toplevel)
git checkout develop
git merge --no-ff release/0.3.9-rc.0

# Version tag and npm deployment
npm version 0.3.9-rc.0
npm run build
npm publish --tag next
git push origin develop --tags

# 5-B. When tests fail (FAIL)
# - Review QA report (reports/releases/0.3.9/rc.0-test-report.md)
# - Mark failed issues as status:rejected
# - Create rc.1 to retry or exclude failed issues
```

**Core Principles:**
- ✅ RC version always starts from rc.0
- ✅ RC branch naming: `release/X.X.X-rc.N`
- ✅ **All issues branch from main**: Based on stable version, prevents confusion
- ✅ RC is for integration testing only: No new development
- ✅ Retry on failure: rc.0 → rc.1 → rc.2 (no partial merges)

---

## Agent Collaboration

### Agent Role Definitions

#### 1. GitHub Copilot (Development Team Lead)
**Role:**
- Task decomposition and todo management
- Agent selection and task distribution
- Progress monitoring
- Decision-making and reporting to CEO

**Does NOT do:**
- ❌ Write code directly
- ❌ Perform analysis directly
- ❌ Execute tests directly

#### 2. @crewx_qa_lead (QA Lead)
**Agent ID:** `crewx_qa_lead`
**Provider:** Claude Sonnet
**Role:**
- Test planning
- Delegate tests to testers
- Collect and analyze test results
- Generate integrated QA reports
- Go/No-Go decision-making

#### 3. @crewx_dev (CrewX Specialist Developer)
**Agent ID:** `crewx_claude_dev`
**Provider:** Claude
**Role:**
- Fix CrewX project issues
- Feature development and implementation
- Git worktree workflow expert
- GitHub Issue updates

#### 4. @crewx_tester (Verification Specialist)
**Agent ID:** `crewx_tester`
**Provider:** Claude Haiku
**Role:**
- Verify fixes
- Test reproduction scenarios
- Check edge cases
- Write test reports

#### 5. @claude (General Analysis)
**Role:**
- Complex issue root cause analysis
- Architecture review and design
- Security vulnerability analysis

#### 6. @copilot (General Implementation)
**Role:**
- General code writing
- Test code writing
- Code review

### Role Hierarchy Structure
```
CEO/CTO
    ↓
GitHub Copilot (Development Team Lead)
    ↓
    ├─ @crewx_dev (Developer) → Issue fixes/feature development
    ├─ @crewx_qa_lead (QA Lead) → Test management
    │    ↓
    │    └─ @crewx_tester (Tester) → Actual testing
    ├─ @claude (Analyst) → Complex analysis
    └─ @copilot (Implementer) → General implementation
```

---

## Integration Testing Process

### Efficient Approach ✅
```
All resolved issues
    ↓
release/0.3.9-rc.0 (integration branch)
    ↓
Parallel testing (all issues tested simultaneously)
    ↓
PASS → merge to develop
FAIL → exclude problematic issues and retry
```

### Integration Testing Workflow

#### 1. Collect resolved issues
```bash
# Extract resolved status issues from GitHub Issues
gh issue list --label "status:resolved" --state open
```

#### 2. Create RC branch and integrate
```bash
# Create RC branch (isolated via worktree)
git worktree add worktree/release-0.3.9-rc.0 -b release/0.3.9-rc.0 develop
cd worktree/release-0.3.9-rc.0

# Merge all resolved issues
git merge --no-ff feature/issue-42
git merge --no-ff feature/issue-55
# ... (resolve conflicts if any)
```

#### 3. Process test results

##### All tests PASS ✅
```bash
# 1. Merge to develop branch
cd $(git rev-parse --show-toplevel)
git checkout develop
git merge --no-ff release/0.3.9-rc.0
git push origin develop

# 2. Close GitHub Issues
gh issue close 42
gh issue close 55
gh issue close 60

# 3. Deploy RC
npm version 0.3.9-rc.0
npm run build
npm publish --tag next
```

##### Some tests FAIL ❌
```bash
# 1. Change label for failed issues
gh issue edit 55 --add-label "status:rejected" --remove-label "status:resolved"

# 2. Create next RC version (retry)
git worktree add worktree/release-0.3.9-rc.1 -b release/0.3.9-rc.1 develop
cd worktree/release-0.3.9-rc.1

# Merge only passed issues or include fixed issues
git merge --no-ff feature/issue-42
git merge --no-ff feature/issue-60
# (feature/issue-55 excluded or included after re-fix)
```

---

## Release Process

### Version Strategy (Semantic Versioning)
```
MAJOR.MINOR.PATCH-TAG
  |     |     |     |
  |     |     |     └─ rc.0, rc.1 (release candidates)
  |     |     └─────── Bug fixes
  |     └─────────── Feature additions (backward compatible)
  └───────────────── Breaking Changes
```

### RC Release (for testing)
```bash
# 1. Create RC branch as worktree (based on develop)
cd $(git rev-parse --show-toplevel)
git worktree add worktree/release-0.3.9-rc.0 -b release/0.3.9-rc.0 develop

# 2. Navigate to integration-tested RC branch
cd worktree/release-0.3.9-rc.0

# 3. Update version
npm version 0.3.9-rc.0

# 4. Build and deploy
npm run build
npm publish --tag next --access public

# 5. Build and deploy Docker image (RC version)
docker build -t sowonai/crewx:0.3.9-rc.0 -t sowonai/crewx:rc .
docker push sowonai/crewx:0.3.9-rc.0
docker push sowonai/crewx:rc

# 6. Push branch and tag
git push -u origin release/0.3.9-rc.0
git push origin v0.3.9-rc.0

# 7. Merge to develop
cd $(git rev-parse --show-toplevel)
git checkout develop
git merge --no-ff release/0.3.9-rc.0
git push origin develop
```

### Production Release
```bash
# 1. Create release branch
cd $(git rev-parse --show-toplevel)
git worktree add worktree/release-0.3.9 -b release/0.3.9 develop

# 2. Update version (remove RC suffix)
cd worktree/release-0.3.9
npm version 0.3.9

# 3. Build and deploy
npm run build
npm publish --access public

# 4. Build and deploy Docker image (production version)
docker build -t sowonai/crewx:0.3.9 -t sowonai/crewx:latest .
docker push sowonai/crewx:0.3.9
docker push sowonai/crewx:latest

# 5. Push branch and tag
git push -u origin release/0.3.9
git push origin v0.3.9

# 6. Merge to develop and main branches
cd $(git rev-parse --show-toplevel)
git checkout develop
git merge --no-ff release/0.3.9
git push origin develop

git checkout main
git merge --no-ff release/0.3.9
git push origin main

# 7. Create GitHub Release
gh release create v0.3.9 --title "v0.3.9" --notes "Release notes here"
```

### Release Checklist
- [ ] All resolved issues passed integration testing
- [ ] All issues `closed` in GitHub Issues
- [ ] package.json version updated
- [ ] CHANGELOG.md updated
- [ ] npm publish successful
- [ ] Docker image build and push successful
- [ ] GitHub Release created
- [ ] Slack Bot update confirmed

---

## Check Current Release Status

### Pre-Release Planning Checks
```bash
# 1. NPM Registry (current production version)
npm view crewx version

# 2. Git Tags (release history)
git tag | grep "^v0\.3" | sort -V | tail -5

# 3. Release Branches (in-progress RCs)
git branch -r | grep "release/"

# 4. Resolved Issues (awaiting merge)
gh issue list --label "status:resolved" --state open
```

---

## Documentation Update Rules

- Update this document first when process changes
- Change history managed via Git commits
- Increment version number for major changes
- Finalized after CEO approval

---

## Reference Documents

- `docs/process/release-workflow.md`: RC versioning, release process
- `docs/prompts/`: Agent role definitions
- `agents.yaml`: Agent configuration
- `package.json`: Version management

---

**Document Status: GitHub Issues-based Workflow (v2.0)**
