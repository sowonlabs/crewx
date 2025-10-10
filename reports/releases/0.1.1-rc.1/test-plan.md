# Release Plan: 0.1.1-rc.1

## 📦 Release Context

**Current Production Version:** 0.1.0
**Previous RC:** 0.1.1-rc.0 (100% PASS - all 4 bugs passed)
**Target RC Version:** 0.1.1-rc.1
**Planned Release Version:** 0.1.1

## 🎯 Test Strategy: FOCUSED TESTING

This RC adds 2 NEW critical bug fixes on top of the 4 bugs that already passed in rc.0.

**Testing Principle:** Only test NEW bugs. Skip bugs that passed in rc.0 to save time and resources.

---

## 📋 Included Bugs

### SKIP Bugs (Already Passed in rc.0)
✅ **bug-f9df3f4:** Help command terminology update (CodeCrew → CrewX)
- **rc.0 Result:** ✅ PASS (7/7 tests)
- **Action:** SKIP - Already verified working

✅ **bug-4381fcf:** TOC extraction for markdown in YAML templates
- **rc.0 Result:** ✅ PASS (10/10 unit tests + 8/8 sample tests)
- **Action:** SKIP - Already verified working

✅ **bug-b19a109:** CLI mention parsing fix for @ symbols
- **rc.0 Result:** ✅ PASS (5/5 tests)
- **Action:** SKIP - Already verified working

✅ **bug-1cb0ebe:** Slack multi-bot response issue
- **rc.0 Result:** ✅ PASS (code review + build verification)
- **Action:** SKIP - Already verified working

### NEW Bugs (Must Test in rc.1)
🔴 **bug-39da8c1:** Slack bot crewx_response event type support
- **Priority:** 높음 (High)
- **Target Release:** 0.1.1
- **Description:** Extension of bug-1cb0ebe - CSO bot uses `crewx_response` event type, CodeCrewDev uses `crewx_response`
- **Fix:** Modified slack-bot.ts to support BOTH event types in find logic
- **Test Scope:**
  - Unit tests: 14 tests must pass (new test case for crewx_response)
  - Code review: Verify both event types handled correctly
  - Build verification: Clean compilation
- **Action:** TEST (new bug for rc.1)

🔴 **bug-1ea7e5c:** Template rendering skipped when conversation history is empty
- **Priority:** 높음 (High)
- **Target Release:** 0.1.1
- **Description:** CRITICAL - System prompts/templates not applied on first message (empty history)
- **Fix:** Removed `messages.length > 0` condition from queryAgent method
- **Test Scope:**
  - First message test: Verify template renders on empty history
  - Subsequent messages: Verify templates still work with history
  - System prompt test: Verify prompts applied correctly
  - Regression: Ensure no breaking changes to existing flows
- **Action:** TEST (new bug for rc.1)
- **CRITICAL:** This affects ALL first messages across ALL agents!

---

## 🧪 Test Scope

### Testing Phases

#### Phase 1: Individual Bug Tests (Parallel Execution)
**Goal:** Verify each NEW bug fix works independently

**Tests:**
1. **bug-39da8c1 test** (Slack event type support)
   - Unit test verification (14 tests must pass)
   - Code review: Both event types supported
   - Build verification

2. **bug-1ea7e5c test** (Template rendering on empty history)
   - First message test (empty history → template applied)
   - Subsequent messages test (history exists → template still applied)
   - System prompt verification
   - Regression check (no breaking changes)

**Expected Reports:**
- `reports/bugs/bug-39da8c1-test-{timestamp}.md`
- `reports/bugs/bug-1ea7e5c-test-{timestamp}.md`

#### Phase 2: Integration Test (After Phase 1)
**Goal:** Verify all bugs (old + new) work together in RC branch

**Tests:**
1. Build verification (clean compilation)
2. Unit test suite (check for regressions)
3. Core CLI functionality (same 8 tests from rc.0)
4. Regression check (4 old bugs still working)
5. New bug integration (2 new bugs working in full system)

**Expected Report:**
- `reports/releases/0.1.1-rc.1/integration-test-{timestamp}.md`

---

## 🎯 Success Criteria

### Individual Bug Tests
- ✅ bug-39da8c1: Unit tests pass (14/14), both event types supported
- ✅ bug-1ea7e5c: Template rendering works on empty history + existing flows work

### Integration Test
- ✅ Build: Clean compilation, no errors
- ✅ Unit Tests: Pass rate ≥ rc.0 (no regressions)
- ✅ Core CLI: All 8 manual tests pass
- ✅ Old Bugs: 4 bugs from rc.0 still working
- ✅ New Bugs: 2 new bugs working in integrated system

### Overall Verdict
- ✅ **PASS:** All tests pass → Ready for merge to develop
- ❌ **FAIL:** Any critical test fails → Create rc.2 excluding failed bugs

---

## 📊 Test Report Location

**Test Plan:** `reports/releases/0.1.1-rc.1/test-plan.md` (this file)

**Individual Bug Tests:**
- `reports/bugs/bug-39da8c1-test-{timestamp}.md`
- `reports/bugs/bug-1ea7e5c-test-{timestamp}.md`

**Integration Test:**
- `reports/releases/0.1.1-rc.1/integration-test-{timestamp}.md`

**QA Report:**
- `reports/releases/0.1.1-rc.1/qa-report-{PASS|FAIL}.md`

---

## ⚠️ Risk Assessment

### High Risk Items
1. **bug-1ea7e5c (Template rendering):**
   - **Risk:** CRITICAL bug affecting ALL first messages
   - **Impact:** If broken, all agents fail on empty history
   - **Mitigation:** Comprehensive testing of empty + non-empty history flows
   - **Priority:** TEST FIRST

### Medium Risk Items
1. **bug-39da8c1 (Slack event type):**
   - **Risk:** Cross-bot interaction edge cases
   - **Impact:** Multiple bots responding in same thread
   - **Mitigation:** Unit tests cover both event types
   - **Note:** Runtime Slack testing recommended (non-blocking)

### Low Risk Items
1. **Regression risk for rc.0 bugs:**
   - **Risk:** New bugs break existing fixes
   - **Mitigation:** Integration test verifies all 6 bugs together
   - **Confidence:** HIGH (well-isolated changes)

---

## 🚀 Test Execution Plan

### Timeline (Estimated: 30-40 minutes)

**Phase 1: Individual Bug Tests (15-20 min, parallel)**
- Start: 2025-10-10 ~23:00
- Tests: bug-39da8c1 + bug-1ea7e5c (parallel execution)
- Duration: ~15-20 minutes (parallel)

**Phase 2: Integration Test (10-15 min)**
- Start: After Phase 1 completes
- Test: Full RC integration
- Duration: ~10-15 minutes

**Phase 3: QA Report Generation (5 min)**
- Analysis and verdict
- Report creation
- Git-bug updates

**Total Duration:** ~30-40 minutes

---

## 📝 Notes for Testers

### @crewx_tester Instructions

**Phase 1 (Parallel Execution):**
```bash
# Test bug-39da8c1 (Slack event type support)
Test bug-39da8c1 individually:
- Run unit test suite for Slack bot (14 tests must pass)
- Verify both 'crewx_response' and 'crewx_response' event types supported
- Check code in src/slack/slack-bot.ts (lines 134-141)
- Verify new test case in tests/slack/slack-bot-mention.test.ts (lines 335-367)
- Build verification
Create report: reports/bugs/bug-39da8c1-test-{timestamp}.md

# Test bug-1ea7e5c (Template rendering on empty history)
Test bug-1ea7e5c individually:
- Create test scenario: First message with empty history
- Verify template/system prompt is rendered
- Test subsequent messages (with history)
- Check code in queryAgent method (removed messages.length > 0 condition)
- Regression: Verify existing flows still work
Create report: reports/bugs/bug-1ea7e5c-test-{timestamp}.md
```

**Phase 2 (After Phase 1):**
```bash
# Run full RC integration test
- Build verification (clean compilation)
- Unit test suite (check pass rate vs rc.0)
- Core CLI tests (8 manual tests from rc.0)
- Verify all 6 bugs working together
Create report: reports/releases/0.1.1-rc.1/integration-test-{timestamp}.md
```

### Key Testing Points
1. **bug-1ea7e5c is CRITICAL** - Test this thoroughly!
2. **Skip rc.0 bugs** - Don't waste time retesting passed bugs
3. **Watch for regressions** - Ensure new bugs don't break old fixes
4. **Parallel execution** - Run Phase 1 tests simultaneously for speed

---

## 📋 Checklist

### Pre-Test
- [x] Review rc.0 test results
- [x] Identify NEW bugs vs SKIP bugs
- [x] Create test plan
- [ ] Create report directories
- [ ] Delegate tests to @crewx_tester

### Phase 1: Individual Bug Tests
- [ ] bug-39da8c1 tested individually
- [ ] bug-1ea7e5c tested individually
- [ ] Git-bug status updated for both bugs
- [ ] Individual reports created

### Phase 2: Integration Test
- [ ] Build verification passed
- [ ] Unit tests checked
- [ ] Core CLI tests passed
- [ ] Integration report created

### Phase 3: QA Report
- [ ] Analyze all test results
- [ ] Generate QA verdict (PASS/FAIL)
- [ ] Create QA report in reports/releases/0.1.1-rc.1/
- [ ] Report to Dev Lead

### Post-Test
- [ ] Update all bugs to qa-completed (if PASS)
- [ ] Notify Release Manager
- [ ] Archive test reports

---

**Test Plan Created:** 2025-10-10
**QA Lead:** @crewx_qa_lead
**Version:** 1.0
**Status:** Ready for execution
