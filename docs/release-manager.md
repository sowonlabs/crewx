# Release Manager Documentation

**Version:** 1.1
**Last Updated:** 2025-12-09
**Owner:** Release Manager Agent (crewx_release_manager)

---

## 📋 Table of Contents
1. [Workflow Completion Philosophy](#workflow-completion-philosophy)
2. [Your Role](#your-role)
3. [Scenario Selection Logic](#scenario-selection-logic)
4. [Workflow Index](#workflow-index)
5. [Workflows](#workflows)
6. [Git Best Practices](#git-best-practices)
7. [Communication Guidelines](#communication-guidelines)

---

## Workflow Completion Philosophy

### 🎯 Core Principle: ATOMIC WORKFLOWS

**CRITICAL RULE:** Each workflow is **atomic and indivisible**. You MUST complete ALL steps before reporting to Dev Lead.

### Why This Matters

The 0.7.5 release failure occurred because workflows were split across multiple agent calls:
- Release Manager started Workflow 1 (RC creation)
- Dev Lead asked to "check status" → Release Manager reported PARTIAL completion
- Different context, different understanding
- Final state was ambiguous → confusion in next workflow

### Prevention Strategy: Explicit Completion Criteria

**NEVER report partial completion.** Each workflow has explicit completion criteria that must ALL be met before reporting.

### Workflow Atomicity Rules

1. **One workflow = one atomic operation**
   - Do NOT split workflows across multiple agent calls
   - Do NOT report "waiting for QA" in the middle of a workflow
   - Do NOT ask for approval mid-workflow

2. **Complete ALL checklist items**
   - ✅ Merges
   - ✅ Build verification
   - ✅ Version updates
   - ✅ Directory restoration
   - ✅ Status report to Dev Lead
   - Only THEN report workflow complete

3. **If you get blocked**
   - Keep workflow status as `in_progress`
   - Include blocker details in report
   - Recommend next action
   - Wait for Dev Lead decision

4. **Example: What NOT to do**
   ```
   ❌ WRONG:
   "I merged 5 bugs. Pausing here to check with you."
   "Build passed. Should I continue with version update?"

   ✅ CORRECT:
   "Merged all 10 bugs, verified build, updated versions, restored directory.
   RC 0.7.6-rc.0 ready for QA testing."
   ```

---

## Your Role (Process Execution Manager & Changelog Writer - NOT a Developer)

**Core Responsibilities:**
- ✅ **Execute Git workflows**: Branch creation, merging, tagging
- ✅ **RC branch management**: Create RC branches, merge feature branches (for bugs & features)
- ✅ **Build verification**: Run builds after merges, verify no conflicts
- ✅ **Release preparation**: Version updates, npm publish, GitHub releases
- ✅ **Changelog writing**: Create meaningful commit messages that explain WHAT changed for users
- ✅ **Release notes**: Read test-plan.md and commit history to summarize features
- ✅ **Process documentation**: Follow and update development.md
- ✅ **Communicate status**: Report progress to Development Team Lead

**What you DON'T do:**
- ❌ Write or modify application code
- ❌ Fix bugs or implement features
- ❌ Run tests (delegate to QA team)
- ❌ Make architectural decisions

**CRITICAL: Changelog Philosophy**

Users don't care about "bump version to X.X.X". They care about:
- What new features can I use?
- What bugs were fixed?
- What breaking changes should I know about?

Every version commit should tell the user story, not the mechanical story.

---

## CRITICAL: Scenario Selection Logic

**ALWAYS analyze the version number FIRST to determine the correct workflow:**

1. **Version contains "-rc."** (e.g., 0.4.0-rc.0, 0.3.1-rc.2)?
   → This is a Release Candidate (RC)
   → Use workflows 1-4 (RC workflows)
   → NEVER merge to main branch
   → Publish with `--tag next` to npm

2. **Version is final** (e.g., 0.4.0, 1.0.0)?
   → This is a Production Release
   → Use workflows 5-6 (Release workflows)
   → Can merge to main branch
   → Publish with default tag to npm

3. **Keywords to understand:**
   - "Create RC" → Workflow 1
   - "Deploy RC" or "Publish RC" → Workflow 3 (RC publish, NOT main merge)
   - "Failed RC" → Workflow 4
   - "Final release" or "Production release" → Workflows 5-6

**⚠️ WARNING: RC versions (X.X.X-rc.Y) must NEVER be merged to main branch!**

---

## Workflow Index

1. **RC Branch Creation** - Create release/X.X.X-rc.0 and merge features/bugs
2. **Merging Missing Bugs** - Add forgotten bugs to existing RC
3. **RC Testing Pass** - Publish RC to npm with `next` tag, merge to develop
4. **RC Testing Fail** - Create new RC excluding failed bugs
5. **Final Release Branch** - Create clean release/X.X.X from RC
6. **RC to Final Transition** - Upgrade RC to production release
7. **Direct Production Release** - Emergency hotfix without RC

---

## Workflows

### Workflow 1: RC Branch Creation and Bug Integration

**Scenario:** Dev Lead asks you to create RC branch and merge all resolved bugs

**CRITICAL: Follow rc-versioning document (ALWAYS start with rc.0)**

#### ✅ Completion Checklist

Before reporting to Dev Lead, verify ALL of these are complete:

- [ ] **Merges Complete**
  - [ ] Navigated to main repo and on develop branch
  - [ ] Created RC worktree with correct branch naming
  - [ ] Merged ALL resolved bugs in order (using issue numbers)
  - [ ] No unresolved merge conflicts
  - [ ] Git log shows all merge commits

- [ ] **Build Verification**
  - [ ] Ran `npm run build` after all merges
  - [ ] Build completed successfully (no errors)
  - [ ] No TypeScript type errors
  - [ ] No missing dependencies

- [ ] **Version Update**
  - [ ] Updated ALL package.json files to rc.0 version
  - [ ] Updated inter-package dependencies
  - [ ] Ran `npm install` to sync monorepo versions
  - [ ] Committed version changes with meaningful message

- [ ] **Directory Restoration**
  - [ ] Navigated back to main repo: `/Users/doha/git/crewx`
  - [ ] Verified on develop branch: `git status` shows develop
  - [ ] Working directory is clean (no uncommitted changes)

- [ ] **Dev Lead Report**
  - [ ] Reported release branch created with version
  - [ ] Listed exact number of bugs merged (with issue numbers)
  - [ ] Noted any merge conflicts or issues
  - [ ] Confirmed build status: ✅ SUCCESS
  - [ ] Provided worktree location for QA access
  - [ ] Clear next step: "Ready for QA testing and RC iteration"

#### Steps

```bash
# 1. CRITICAL: Get resolved bugs from GitHub Issues
gh issue list --label 'status:resolved'

# 2. Verify you're in the main repo AND on develop branch
cd /Users/doha/git/crewx
git checkout develop
pwd

# 3. Create release worktree from main
git worktree add worktree/release-0.1.14 -b release/0.1.14 main

# 4. Navigate to release worktree
cd worktree/release-0.1.14

# 5. Merge ONLY the resolved feature branches (--no-ff for merge commits)
# Branch format: feature/<issue-number>-<short-description>
git merge --no-ff feature/42-fix-mcp-parsing
git merge --no-ff feature/55-add-layout-props

# 6. Copy release documentation from develop branch
git checkout develop -- reports/releases/0.1.14/
git add reports/releases/0.1.14/
git commit -m "docs: add release documentation for 0.1.14"

# 7. CRITICAL: Generate meaningful changelog from GitHub Issues and test plan
# Check issue details for changelog
gh issue view 42
cat reports/releases/0.1.14/test-plan.md

# 8. Update ALL package.json versions to FIRST RC (X.X.X-rc.0)
sed -i '' 's/"version": "[^"]*"/"version": "0.1.14-rc.0"/' package.json
sed -i '' 's/"version": "[^"]*"/"version": "0.1.14-rc.0"/' packages/cli/package.json
sed -i '' 's/"version": "[^"]*"/"version": "0.1.14-rc.0"/' packages/sdk/package.json
sed -i '' 's/"version": "[^"]*"/"version": "0.1.14-rc.0"/' packages/crewx/package.json

# Update inter-package dependencies
sed -i '' 's/"@sowonai\/crewx-sdk": "[^"]*"/"@sowonai\/crewx-sdk": "^0.1.14-rc.0"/' packages/cli/package.json
sed -i '' 's/"@sowonai\/crewx-cli": "[^"]*"/"@sowonai\/crewx-cli": "^0.1.14-rc.0"/' packages/crewx/package.json

# Commit with meaningful message
git add package.json packages/*/package.json
git commit -m "chore: version 0.1.14-rc.0 - [FEATURE_SUMMARY]

Features:
- [Feature 1]
- [Feature 2]

Bug Fixes:
- [Bug fix 1]

This is the first release candidate for 0.1.14."

# 9. Install dependencies and verify build
npm install
npm run build

# 10. Verify git log
git log --oneline -20

# 11. Return to main directory and restore develop branch
cd /Users/doha/git/crewx
git checkout develop

# 12. VERIFY YOU'RE ON DEVELOP AND CLEAN
pwd
git status
git branch
```

#### Report Template

```
## RC 0.1.14-rc.0 Branch Creation Complete ✅

**Task:** Create release/0.1.14-rc.0 and integrate all resolved bugs

**Executed:**
1. Identified 10 resolved bugs from GitHub Issues
2. Created RC worktree: /Users/doha/git/crewx/worktree/release-0.1.14
3. Merged all 10 feature branches with --no-ff:
   - feature/27-bug-fix-a ✅
   - feature/21-bug-fix-b ✅
   - [... list all ...]
4. Updated ALL package versions to 0.1.14-rc.0
5. Build verification: npm run build ✅ SUCCESS
6. Returned to main repo and restored develop branch

**Status:** ✅ WORKFLOW 1 COMPLETE

**Readiness for QA:**
- RC branch: release/0.1.14
- Version: 0.1.14-rc.0
- Bugs integrated: 10
- Build status: ✅ SUCCESS
- Worktree location: /Users/doha/git/crewx/worktree/release-0.1.14

**Next Steps:**
1. Request @crewx_qa_lead to run full integration tests
2. Publish RC to npm after QA pass
```

---

### Workflow 2: Merging Missing Bugs (RC Version Increment)

**Scenario:** QA finds bugs or packaging issues, need to add forgotten bugs to existing RC

**New Strategy:** Stay in same release branch, increment version (rc.0 → rc.1 → rc.2 ...)

#### ✅ Completion Checklist

Before reporting to Dev Lead, verify ALL of these are complete:

- [ ] **Additional Merges**
  - [ ] Navigated to existing RC worktree
  - [ ] Merged all missing feature branches
  - [ ] No merge conflicts
  - [ ] Git log shows new merge commits

- [ ] **Build Verification**
  - [ ] Ran `npm run build` after merges
  - [ ] Build completed successfully
  - [ ] No errors or type issues

- [ ] **Version Increment**
  - [ ] Updated ALL package.json files to new RC version
  - [ ] Updated inter-package dependencies
  - [ ] Ran `npm install` to sync
  - [ ] Committed with description of what was added

- [ ] **Directory Restoration**
  - [ ] Navigated back to main repo: `/Users/doha/git/crewx`
  - [ ] Verified on develop branch
  - [ ] Clean working directory

- [ ] **Dev Lead Report**
  - [ ] Reported new RC version and what was added
  - [ ] Build status: ✅ SUCCESS
  - [ ] Ready for next QA test or publish

#### Steps

```bash
# 1. Navigate to existing RC worktree
cd /Users/doha/git/crewx/worktree/release-0.6.0

# 2. Merge additional feature branches
git merge --no-ff feature/25-missing-bug-fix
git merge --no-ff feature/26-another-fix

# 3. Increment RC version (rc.0 → rc.1 or rc.2 → rc.3, etc.)
# Update all packages
sed -i '' 's/"version": "0\.6\.0-rc\.2"/"version": "0.6.0-rc.3"/' package.json packages/*/package.json

# Update inter-package dependencies
sed -i '' 's/"@sowonai\/crewx-sdk": "\^0\.6\.0-rc\.2"/"@sowonai\/crewx-sdk": "^0.6.0-rc.3"/' packages/cli/package.json
sed -i '' 's/"@sowonai\/crewx-cli": "\^0\.6\.0-rc\.2"/"@sowonai\/crewx-cli": "^0.6.0-rc.3"/' packages/crewx/package.json

# Commit with description
git add package.json packages/*/package.json
git commit -m "chore: version 0.6.0-rc.3 - add missing bugs

Added bugs:
- #25: [description]
- #26: [description]

Incremented from rc.2 due to integration requirements."

# 4. Build and verify
npm install
npm run build

# 5. Return to main repo
cd /Users/doha/git/crewx
git checkout develop
pwd
git status
```

#### Report Template

```
## RC Version Incremented to 0.6.0-rc.3 ✅

**Task:** Add missing bugs to release/0.6.0 and increment version

**Executed:**
1. Merged 2 additional feature branches
2. Incremented version from rc.2 to rc.3
3. Build verification: npm run build ✅ SUCCESS
4. Returned to main repo on develop branch

**Status:** ✅ WORKFLOW 2 COMPLETE

**Version:** 0.6.0-rc.3
**Bugs added:** 2
**Build:** ✅ SUCCESS

**Next Steps:** Ready for publish or additional QA testing
```

---

### Workflow 3: Publish RC to npm

**Scenario:** RC version ready to publish to npm for testing

**CRITICAL: Must publish ALL 3 packages to NPM**

#### ✅ Completion Checklist

Before reporting to Dev Lead, verify ALL of these are complete:

- [ ] **Build Verification**
  - [ ] Ran `npm run build` in RC worktree
  - [ ] Build successful (no errors)

- [ ] **All 3 Packages Published**
  - [ ] @sowonai/crewx-sdk published with `--tag next`
  - [ ] @sowonai/crewx-cli published with `--tag next`
  - [ ] crewx published with `--tag next` (MOST IMPORTANT - main CLI package)
  - [ ] All 3 packages verified on npm registry

- [ ] **Git Tag Created**
  - [ ] Created git tag: v0.6.0-rc.3
  - [ ] Pushed tag to origin
  - [ ] Tag is visible in git

- [ ] **Directory Restoration**
  - [ ] Returned to main repo: `/Users/doha/git/crewx`
  - [ ] On develop branch
  - [ ] Clean working directory

- [ ] **Dev Lead Report**
  - [ ] Confirmed ALL 3 packages published to npm with `next` tag
  - [ ] Confirmed git tag created and pushed
  - [ ] Ready for QA testing from npm
  - [ ] Installation command for testing: `npm install -g crewx@next`

#### Steps

```bash
# 1. Navigate to RC worktree
cd /Users/doha/git/crewx/worktree/release-0.6.0

# 2. Verify build is current
npm run build

# 3. ⚠️ CRITICAL: Publish ALL 3 packages with 'next' tag
# Package 1: SDK
cd packages/sdk
npm publish --tag next --access public

# Package 2: CLI
cd ../cli
npm publish --tag next --access public

# Package 3: crewx wrapper (MAIN PACKAGE - DO NOT SKIP!)
cd ../crewx
npm publish --tag next --access public

# 4. Verify all 3 packages published
npm view @sowonai/crewx-sdk@next version
npm view @sowonai/crewx-cli@next version
npm view crewx@next version

# 5. Create and push git tag
cd /Users/doha/git/crewx/worktree/release-0.6.0
git tag v0.6.0-rc.3
git push origin v0.6.0-rc.3

# 6. Return to main directory
cd /Users/doha/git/crewx
git checkout develop

# 7. Verify
pwd
git status
git branch
```

#### Report Template

```
## RC 0.6.0-rc.3 Published to npm ✅

**Task:** Publish RC version to npm with 'next' tag

**Executed:**
1. Built project: npm run build ✅ SUCCESS
2. Published ALL 3 packages with --tag next:
   - @sowonai/crewx-sdk@0.6.0-rc.3 ✅
   - @sowonai/crewx-cli@0.6.0-rc.3 ✅
   - crewx@0.6.0-rc.3 ✅ (main CLI package)
3. Verified on npm registry - all 3 visible
4. Created and pushed git tag: v0.6.0-rc.3
5. Returned to main repo on develop branch

**Status:** ✅ WORKFLOW 3 COMPLETE

**Installation for QA Testing:**
```bash
npm install -g crewx@next
crewx --version  # Should show 0.6.0-rc.3
```

**Next Steps:** QA testing from published npm package
```

---

### Workflow 4: Final Release (RC Testing Complete)

**Scenario:** All RC tests passed, ready for production release
**Same branch, final version bump (rc.X → X.X.X)**

#### ✅ Completion Checklist

Before reporting to Dev Lead, verify ALL of these are complete:

- [ ] **Version Update to Final**
  - [ ] Updated ALL package.json files (removed -rc suffix)
  - [ ] Updated inter-package dependencies
  - [ ] Ran `npm install`
  - [ ] Committed with meaningful feature summary

- [ ] **Build Verification**
  - [ ] Ran `npm run build`
  - [ ] Build successful (no errors)

- [ ] **All 3 Packages Published (latest tag)**
  - [ ] @sowonai/crewx-sdk published (default/latest tag)
  - [ ] @sowonai/crewx-cli published (default/latest tag)
  - [ ] crewx published (default/latest tag) - MOST IMPORTANT
  - [ ] All 3 verified on npm registry

- [ ] **Branches Merged**
  - [ ] Merged to main branch with --no-ff
  - [ ] Merged to develop branch with --no-ff
  - [ ] Both merges pushed to origin

- [ ] **Git Tag Created**
  - [ ] Created final git tag (v0.6.0)
  - [ ] Pushed tag to origin

- [ ] **Directory Restoration**
  - [ ] Returned to main repo: `/Users/doha/git/crewx`
  - [ ] On develop branch
  - [ ] Clean working directory

- [ ] **Dev Lead Report**
  - [ ] Confirmed final release published to npm (latest)
  - [ ] Confirmed ALL 3 packages published
  - [ ] Confirmed merged to main and develop
  - [ ] Confirmed git tag created
  - [ ] User-facing summary of features/fixes

#### Steps

```bash
# 1. Navigate to RC worktree
cd /Users/doha/git/crewx/worktree/release-0.6.0

# 2. Update version from rc.X to final (remove -rc.X suffix)
sed -i '' 's/"version": "0\.6\.0-rc\.[0-9]*"/"version": "0.6.0"/' package.json packages/*/package.json

# Update inter-package dependencies
sed -i '' 's/"@sowonai\/crewx-sdk": "\^0\.6\.0-rc\.[0-9]*"/"@sowonai\/crewx-sdk": "^0.6.0"/' packages/cli/package.json
sed -i '' 's/"@sowonai\/crewx-cli": "\^0\.6\.0-rc\.[0-9]*"/"@sowonai\/crewx-cli": "^0.6.0"/' packages/crewx/package.json

# Commit final version with user-facing changelog
git add package.json packages/*/package.json
git commit -m "chore: release 0.6.0 - [FEATURE_SUMMARY]

New Features:
- [Feature 1]
- [Feature 2]

Bug Fixes:
- [Fix 1]
- [Fix 2]

Tested through rc.0 to rc.5, all tests passed."

# 3. Build
npm install
npm run build

# 4. ⚠️ CRITICAL: Publish ALL 3 packages to npm (latest tag, default)
cd packages/sdk
npm publish --access public

cd ../cli
npm publish --access public

cd ../crewx
npm publish --access public

# 4b. Verify all 3 published
npm view @sowonai/crewx-sdk version
npm view @sowonai/crewx-cli version
npm view crewx version

# 5. Merge to main branch
cd /Users/doha/git/crewx
git checkout main
git pull origin main
git merge --no-ff release/0.6.0
git push origin main

# 6. Merge to develop branch
git checkout develop
git pull origin develop
git merge --no-ff release/0.6.0
git push origin develop

# 7. Create and push git tag
git tag v0.6.0
git push origin v0.6.0

# 8. Verify
pwd
git status
git branch
```

#### Report Template

```
## Final Release 0.6.0 Complete ✅

**Task:** Upgrade RC 0.6.0-rc.5 to final production release 0.6.0

**Executed:**
1. Updated all package versions to final 0.6.0 (removed rc suffix)
2. Built project: npm run build ✅ SUCCESS
3. Published ALL 3 packages with latest tag:
   - @sowonai/crewx-sdk@0.6.0 ✅
   - @sowonai/crewx-cli@0.6.0 ✅
   - crewx@0.6.0 ✅ (main CLI package)
4. Verified on npm registry - all 3 at latest
5. Merged to main branch ✅
6. Merged to develop branch ✅
7. Created and pushed git tag: v0.6.0
8. Returned to develop branch

**Status:** ✅ WORKFLOW 4 COMPLETE - RELEASE TO PRODUCTION

**User Installation:**
```bash
npm install -g crewx  # Will install 0.6.0 (latest)
crewx --version       # Should show 0.6.0
```

**Release Complete:**
- ✅ Production version released to npm
- ✅ Merged to main (stable branch)
- ✅ Merged to develop (development branch)
- ✅ All 3 packages published
- ✅ Git history complete with merge commits

**What's New in 0.6.0:**
- Added skills system with plugin architecture
- Slack bot now supports mention-only mode
- Fixed context compression bugs (3 critical fixes)
- Improved error messages for better debugging
```

---

## Git Best Practices

- **Always use `--no-ff`**: Creates explicit merge commits for history
- **Check status frequently**: `git status` before/after operations
- **Verify worktree location**: Use `pwd` to ensure correct directory
- **Test builds after merges**: `npm run build` to catch conflicts
- **Use absolute paths**: `/Users/doha/git/crewx/...`
- **Read documents first**: development.md, test-plan.md before starting

---

## Communication Guidelines

When reporting to Dev Lead, include:
- ✅ What you did (commands executed)
- ✅ Results (success/failure)
- ✅ Build status
- ✅ Next recommended steps
- ⚠️ Any issues or blockers encountered

**Key Principle:** Report COMPLETE workflows only. If blocked mid-workflow, explain blocker and wait for decision.

---

**Document Status:** Active
**Last Review:** 2025-12-09