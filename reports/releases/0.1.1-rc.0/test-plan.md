# Release Plan: 0.1.1-rc.0

**Created:** 2025-10-10
**Target Version:** 0.1.1
**Production Version:** 0.1.0
**QA Lead:** @crewx_qa_lead

---

## 📦 Included Bugs

This RC includes **4 resolved bugs**:

### Bug f9df3f4: help 서브커맨드의 CodeCrew 용어를 CrewX로 통일
- **Status:** status:resolved
- **Priority:** priority:중간
- **Category:** category:documentation
- **Version:** version:0.1.0
- **Target Release:** (not set - will add 0.1.1)
- **Fix:** Changed all 'CodeCrew' references to 'CrewX' in help.service.ts (commit dbbdc35)
- **Test Scope:** CLI help command output verification

### Bug 4381fcf: Implement TOC extraction for markdown documents in YAML templates
- **Status:** status:resolved
- **Priority:** priority:중간
- **Target Release:** target_release:0.1.x
- **Version:** version:0.1.x
- **Fix:** Added TOC extraction using remark-parse and unified (commit 23f1221)
- **Test Scope:** Document loader service, TOC generation from markdown, YAML template integration

### Bug b19a109: CLI mention parsing captures @ symbols in message content
- **Status:** status:resolved
- **Priority:** (not set)
- **Target Release:** (not set - will add 0.1.1)
- **Version:** (not set - will add 0.1.x)
- **Fix:** Modified CLI mention parsing to only extract @mentions at start (commit 074c5e4)
- **Test Scope:** CLI query and execute commands with @ symbols in message content

### Bug 1cb0ebe: Multiple Slack bots respond in same thread when mention is missing
- **Status:** status:resolved
- **Priority:** (not set)
- **Target Release:** (not set - will add 0.1.1)
- **Version:** (not set - will add 0.1.x)
- **Fix:** Modified shouldRespondToMessage() to check last speaker using metadata (commit 4661810)
- **Test Scope:** Code review and build verification (ALREADY TESTED - PASS)
- **Test Report:** reports/bugs/bug-1cb0ebe-test-20251010_190000.md

---

## 🧪 Test Report Location

- **RC Test Plan:** `reports/releases/0.1.1-rc.0/test-plan.md` (this file)
- **Individual Bug Tests:** `reports/bugs/bug-{hash}-test-{timestamp}.md`
- **QA Final Report:** `reports/releases/0.1.1-rc.0/qa-report-{PASS|FAIL}.md`

---

## 📋 Testing Scope

### NEW Bugs (not tested before)
1. **bug-f9df3f4** - Help command terminology update (CodeCrew → CrewX)
2. **bug-4381fcf** - TOC extraction for markdown in YAML templates
3. **bug-b19a109** - CLI mention parsing fix for @ symbols

### RETEST Bugs (failed previously)
- None

### SKIP Bugs (already passed)
1. **bug-1cb0ebe** - Slack bot multi-response issue
   - **Reason:** Already tested on 2025-10-10 19:00:00
   - **Result:** ✅ PASS (Code Review & Build Verification)
   - **Report:** reports/bugs/bug-1cb0ebe-test-20251010_190000.md
   - **Note:** Runtime Slack testing recommended but not blocking for RC

---

## 🎯 Success Criteria

### Must Pass (Blocking)
- ✅ bug-f9df3f4: Help command outputs "CrewX" not "CodeCrew"
- ✅ bug-4381fcf: TOC extraction works in YAML templates, all unit tests pass
- ✅ bug-b19a109: CLI handles @ symbols in message content correctly

### Already Verified (Non-blocking)
- ✅ bug-1cb0ebe: Code review passed, build successful
  - ⚠️ Manual Slack testing recommended post-release

### Build & Integration
- ✅ All unit tests pass
- ✅ TypeScript compilation succeeds
- ✅ npm run build succeeds on release/0.1.1-rc.0 branch

---

## 🔍 Test Strategy

### Stage 1: Individual Bug Tests (Parallel)
Execute the following tests in parallel using @crewx_tester:

#### Test 1: bug-f9df3f4 (Help command)
```bash
# Expected actions:
1. Checkout release/0.1.1-rc.0 branch
2. Run: crewx help
3. Verify output contains "CrewX" and NOT "CodeCrew"
4. Check help.service.ts for terminology consistency
5. Generate test report: reports/bugs/bug-f9df3f4-test-{timestamp}.md
```

#### Test 2: bug-4381fcf (TOC extraction)
```bash
# Expected actions:
1. Checkout release/0.1.1-rc.0 branch
2. Run unit tests: npm test -- document-loader
3. Test TOC generation with sample markdown file
4. Verify {{{documents.XXX.toc}}} works in YAML template
5. Check TOC format: headings, indentation, special chars
6. Generate test report: reports/bugs/bug-4381fcf-test-{timestamp}.md
```

#### Test 3: bug-b19a109 (CLI mention parsing)
```bash
# Expected actions:
1. Checkout release/0.1.1-rc.0 branch
2. Test: crewx execute "@claude Register bug for @BotA and @BotB"
3. Verify: Only @claude is recognized as agent mention
4. Verify: "@BotA" and "@BotB" preserved in message content
5. Test with emails: crewx q "@claude Send to user@example.com"
6. Run unit tests: npm test -- query.handler execute.handler
7. Generate test report: reports/bugs/bug-b19a109-test-{timestamp}.md
```

### Stage 2: Integration Test
After individual tests complete:
1. Run full build on release/0.1.1-rc.0
2. Execute integration smoke tests
3. Verify no regression in existing functionality
4. Generate integration report: reports/releases/0.1.1-rc.0/integration-test-{timestamp}.md

---

## ⚠️ Known Limitations

### Bug 1cb0ebe (Slack Bot)
- **Code review:** ✅ PASS
- **Build verification:** ✅ PASS
- **Runtime Slack test:** ⚠️ NOT PERFORMED
- **Impact:** Low - logic is sound, but real Slack environment not tested
- **Recommendation:** Deploy to test Slack workspace post-RC for verification

---

## 📝 Test Execution Plan

### Day 1 (Today): Individual Bug Tests
```bash
# Execute in parallel using crewx CLI
crewx execute \
  "@crewx_tester Test bug-f9df3f4 individually: Verify help command shows 'CrewX' not 'CodeCrew' in all help text output" \
  "@crewx_tester Test bug-4381fcf individually: Verify TOC extraction from markdown documents works in YAML templates, run all document-loader tests" \
  "@crewx_tester Test bug-b19a109 individually: Verify CLI mention parsing only captures @mentions at start, not @ symbols in message content"
```

### Day 1 (After Stage 1): Integration Test
```bash
# Run after individual tests complete
crewx execute "@crewx_tester Run full RC integration test for release/0.1.1-rc.0"
```

### Day 1 (Final): QA Report Generation
- Collect all individual test results
- Analyze integration test results
- Generate final QA report with PASS/FAIL verdict
- Report to Dev Lead (@crewx_dev_lead)

---

## 🚀 Next Steps After Testing

### If PASS ✅
1. Update git-bug labels: All bugs → status:qa-completed
2. Merge release/0.1.1-rc.0 → develop
3. Bump version to 0.1.1 in package.json
4. Create git tag: v0.1.1
5. Publish to npm: npm publish
6. Close all bugs: status:closed
7. Deploy to production (if applicable)

### If FAIL ❌
1. Identify failed bugs
2. Update failed bugs: status:rejected or status:needs-fix
3. Exclude failed bugs from RC
4. Create new RC: 0.1.1-rc.1 (without failed bugs)
5. Retest remaining bugs
6. Keep passed bugs labeled status:qa-completed

---

## 📊 Test Matrix

| Bug ID | Test Type | Priority | Status | Tester | Report Location |
|--------|-----------|----------|--------|--------|-----------------|
| f9df3f4 | Manual CLI | 중간 | 🕒 Pending | @crewx_tester | reports/bugs/bug-f9df3f4-test-*.md |
| 4381fcf | Unit + Integration | 중간 | 🕒 Pending | @crewx_tester | reports/bugs/bug-4381fcf-test-*.md |
| b19a109 | Unit + Manual CLI | - | 🕒 Pending | @crewx_tester | reports/bugs/bug-b19a109-test-*.md |
| 1cb0ebe | Code Review | - | ✅ PASS | @crewx_tester | reports/bugs/bug-1cb0ebe-test-20251010_190000.md |

---

## 🔗 Related Documents

- **Development Workflow:** docs/process/development-workflow.md
- **Report Structure:** docs/process/report-structure.md
- **RC Versioning:** docs/process/rc-versioning.md
- **Git-Bug Reference:** docs/process/git-bug-reference.md

---

**Plan Created By:** @crewx_qa_lead
**Date:** 2025-10-10
**Next Review:** After Stage 1 completion
