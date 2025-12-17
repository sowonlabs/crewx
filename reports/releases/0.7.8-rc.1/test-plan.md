# Release Plan: v0.7.8-rc.1

**Created:** 2025-12-10
**QA Lead:** @crewx_qa_lead
**Release Branch:** release/0.7.8
**Target Production Version:** 0.7.8

---

## 📦 Included Issues

This RC includes 3 issues targeting v0.7.8:

- **Issue #10:** [Bug] Slack: Multiple unmentioned agents respond simultaneously in threads (target_release: 0.7.8)
- **Issue #8:** [Feature] Layout Props for toggling default sections on/off (target_release: 0.7.8)
- **Issue #9:** [Chore] Clean up test and debug files (target_release: 0.7.8)

---

## 🧪 Test Report Locations

- **RC Test Plan:** `reports/releases/0.7.8-rc.1/test-plan.md` (this file)
- **RC QA Report:** `reports/releases/0.7.8-rc.1/qa-report-{PASS|FAIL|CONDITIONAL}.md`
- **Individual Bug Tests:** `reports/bugs/issue-{number}-test-{timestamp}.md`

---

## 📋 Testing Scope (Based on rc.0 Results)

### SKIP Issues (Already Passed in rc.0) ✅
**Issue #8 - Layout Props Feature:**
- Previous test: `/Users/doha/git/crewx/reports/bugs/issue-8-test-20251210_111900.md`
- Result: ✅ PASSED (36/36 tests)
- Decision: **SKIP** - No code changes detected, previous test valid
- Rationale: Feature fully verified, no regression risk

**Issue #9 - Cleanup Test Files:**
- Previous test: `/Users/doha/git/crewx/reports/bugs/issue-9-test-20251210_021500.md`
- Result: ✅ PASSED (5 files removed successfully)
- Decision: **SKIP** - One-time cleanup task, no retesting needed
- Rationale: File cleanup is permanent, cannot regress

### MANUAL TEST Required ⚠️
**Issue #10 - Slack Thread Ownership:**
- Type: Bug fix (Slack Bot behavior)
- Status: ⚠️ **REQUIRES MANUAL TESTING**
- Reason: Slack Bot integration cannot be automated via CLI
- Test requirements:
  1. Live Slack workspace access
  2. Real-time message handling verification
  3. Agent mention parsing validation
  4. Thread ownership behavior testing

---

## 🎯 Testing Strategy

### Automated Tests (CLI)
**Scope:** NONE for rc.1
- Issue #8 and #9 already verified in rc.0
- Issue #10 requires manual Slack Bot testing

### Manual Tests Required
**Issue #10 Manual Test Plan:**

1. **Environment Setup**
   - Start Slack Bot with release/0.7.8 code
   - Use test Slack workspace
   - Ensure bot has proper permissions

2. **Test Scenarios**
   - **Scenario A:** Single agent mention
     - Send: "@claude help me"
     - Expected: Only Claude responds
     - Verify: Other agents remain silent

   - **Scenario B:** Multiple agent mentions
     - Send: "@claude @gemini compare approaches"
     - Expected: Only Claude and Gemini respond
     - Verify: Copilot and other agents remain silent

   - **Scenario C:** No agent mention (keyword trigger)
     - Send: "crewx what is this?"
     - Expected: Default fallback agent responds
     - Verify: Only one agent responds, not all

   - **Scenario D:** Thread continuation
     - Reply in existing thread
     - Expected: Thread owner agent responds
     - Verify: Other agents don't hijack thread

3. **Commit Verification**
   - Related fix: `74ea998 - remove showSecurityRules option`
   - Verify fix addresses root cause

---

## 🎯 Success Criteria

**For rc.1 to PASS:**
- ✅ Issue #10 manual test must PASS (all 4 scenarios)
- ✅ No new regressions detected in Slack Bot behavior
- ✅ Thread ownership correctly enforced

**For rc.1 to FAIL:**
- ❌ Issue #10 manual test fails any scenario
- ❌ New bugs discovered during testing
- ❌ Regression in previously working functionality

---

## 📊 Risk Assessment

### HIGH RISK ⚠️
- **Issue #10 untested in rc.0:** Core Slack Bot functionality at risk
- **Manual testing only:** Cannot automate verification
- **Production impact:** Bug affects live Slack workspace users

### MEDIUM RISK ⚠️
- **No automated regression tests:** Relying on manual verification
- **Limited test coverage:** Only 1 new issue being tested

### LOW RISK ✅
- **Issues #8 and #9 verified:** Already tested and passed in rc.0
- **Small change scope:** Single bug fix for Issue #10

---

## 📝 Test Execution Plan

### Stage 1: Manual Slack Bot Testing
**Owner:** QA Team (human tester with Slack access)
**Duration:** 30-60 minutes
**Output:** `reports/bugs/issue-10-test-{timestamp}.md`

**Steps:**
1. Set up Slack Bot in test workspace
2. Execute 4 test scenarios (A, B, C, D)
3. Document results with screenshots
4. Verify fix commit 74ea998 works correctly

### Stage 2: Integration Verification
**Owner:** @crewx_qa_lead
**Duration:** 15 minutes
**Output:** `reports/releases/0.7.8-rc.1/qa-report-{PASS|FAIL|CONDITIONAL}.md`

**Steps:**
1. Review Issue #10 manual test results
2. Cross-reference with rc.0 results (#8, #9)
3. Make go/no-go decision
4. Generate final QA report

---

## 🚦 Decision Matrix

### Scenario A: Issue #10 PASSES ✅
**Action:** APPROVE rc.1
**Next Steps:**
1. Update all issues to `status:qa-completed`
2. Merge release/0.7.8 to develop
3. Tag v0.7.8 and publish to npm
4. Close all 3 issues

### Scenario B: Issue #10 FAILS ❌
**Action:** REJECT rc.1
**Next Steps:**
1. Mark Issue #10 as `status:rejected`
2. Exclude Issue #10 from release
3. Create v0.7.8-rc.2 with only #8 and #9
4. Move Issue #10 to next release cycle (0.7.9 or 0.8.0)

---

## 📎 Related Artifacts

### rc.0 Test Reports (Reference Only)
- Test Plan: `/Users/doha/git/crewx/reports/releases/0.7.8-rc.0/test-plan.md`
- QA Report: `/Users/doha/git/crewx/reports/releases/0.7.8-rc.0/qa-report-CONDITIONAL.md`
- Issue #8 Test: `/Users/doha/git/crewx/reports/bugs/issue-8-test-20251210_111900.md`
- Issue #9 Test: `/Users/doha/git/crewx/reports/bugs/issue-9-test-20251210_021500.md`

### rc.1 Test Reports (To Be Created)
- Issue #10 Test: `reports/bugs/issue-10-test-{timestamp}.md` (PENDING)
- QA Report: `reports/releases/0.7.8-rc.1/qa-report-{PASS|FAIL}.md` (PENDING)

---

## 📌 Notes

**Why rc.1 exists:**
- rc.0 received CONDITIONAL APPROVAL (pending Issue #10 manual test)
- Issue #10 requires manual Slack Bot testing (cannot be automated)
- rc.1 represents the same codebase, waiting for manual test completion

**Difference from rc.0:**
- No code changes between rc.0 and rc.1
- rc.1 is a procedural increment waiting for manual test execution
- Tag v0.7.8-rc.1 created to track testing progress

**Production Status:**
- Latest published: v0.7.7 (npm)
- Latest tag: v0.7.8-rc.1 (git)
- Next release: v0.7.8 (pending this QA cycle)

---

**Plan Created By:** @crewx_qa_lead
**Date:** 2025-12-10T03:44:00Z
**Status:** READY FOR MANUAL TESTING
