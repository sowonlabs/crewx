# Release Plan: v0.7.8-rc.0

## 📋 Context Analysis

**Production Status:**
- NPM version: 0.7.7 (latest published)
- Git tags: v0.7.8-rc.0 exists (tagged but not yet published)
- Release branch: `release/0.7.8` exists

**Previous Test Reports:**
- No test reports found in `/reports/releases/` (directory doesn't exist yet)
- This is the first structured QA test for v0.7.8-rc.0

## 📦 Included Issues

Based on GitHub issue analysis, the following issues are targeted for v0.7.8:

**Issue #8: [Feature] Layout Props for toggling default sections on/off**
- Type: Enhancement
- Status: OPEN (no status:resolved label yet)
- Worker: @crewx_claude_dev
- Related commits in release branch: `b1f3cac feat(sdk): add layout props for default template sections`

**Issue #9: [Chore] Clean up test and debug files**
- Type: Chore
- Status: OPEN (no status:resolved label yet)
- Worker: @crewx_claude_dev
- Related commits in release branch: `a012073 chore(cleanup): remove test and debug files for a3bb8c7`

**Issue #10: [Bug] Slack: Multiple unmentioned agents respond simultaneously in threads**
- Type: Bug
- Status: OPEN (no status:resolved label yet)
- Worker: @crewx_claude_dev
- Reviewer: @crewx_gemini_dev
- Related commits in release branch: `74ea998 fix(bug): resolve 5f3e6b3 - remove showSecurityRules option`

## 🔍 Issue Status Assessment

**⚠️ CRITICAL FINDING:**
None of the issues have `status:resolved` label, which indicates:
- Issues may still be in development
- Or labels haven't been updated after completion
- RC branch was created prematurely

**Branch Analysis:**
The release/0.7.8 branch contains merged feature branches:
- `feature/a3bb8c7` (merged)
- `feature/5f3e6b3` (merged)

This suggests the fixes are integrated but issue tracking labels are not updated.

## 🧪 Test Report Location

- Individual Bug Tests: `/Users/doha/git/crewx/reports/bugs/issue-{number}-test-{timestamp}.md`
- RC Integration Test: `/Users/doha/git/crewx/reports/releases/0.7.8-rc.0/integration-test-report.md`
- QA Final Report: `/Users/doha/git/crewx/reports/releases/0.7.8-rc.0/qa-report-{PASS|FAIL}.md`

## 📋 Testing Scope

**NEW issues (not tested before):**
- Issue #8: Layout Props feature (NEW)
- Issue #9: Cleanup test/debug files (NEW)
- Issue #10: Slack multiple agents bug (NEW)

**RETEST issues:** None (no previous test failures)

**SKIP issues:** None (all issues are new)

## 🎯 Test Strategy

### Phase 1: Individual Issue Testing (Parallel)

Test each issue independently to isolate failures:

1. **Issue #8 Test**: Layout Props functionality
   - Verify new layout props are added to SDK
   - Check that sections can be toggled on/off
   - Validate API compatibility

2. **Issue #9 Test**: Cleanup verification
   - Verify test/debug files are removed
   - Check no broken imports/references
   - Ensure clean repository state

3. **Issue #10 Test**: Slack Bot behavior
   - **⚠️ MANUAL TEST REQUIRED** (Slack Bot integration)
   - Verify only mentioned agents respond
   - Check thread behavior with multiple agents
   - Requires live Slack workspace testing

### Phase 2: Integration Testing

After individual tests pass, verify:
- All changes work together
- No regression in existing functionality
- Build and publish readiness

## 🎯 Success Criteria

**For PASS:**
- Issue #8: ✅ Layout props working correctly
- Issue #9: ✅ Files cleaned up properly
- Issue #10: ⚠️ Manual verification in Slack OR automated test passes
- All issues have updated GitHub labels (status:qa-completed)

**For FAIL:**
- Any issue test fails
- Integration issues discovered
- Build/publish process broken

## 🚨 Risk Assessment

**HIGH RISK:**
- Issue #10 (Slack Bot) requires manual testing - not automatable via @crewx_tester
- No previous test baseline to compare against

**MEDIUM RISK:**
- Issue tracking labels not updated (creates confusion about completion status)

**LOW RISK:**
- Issue #8 and #9 are automatable and testable via CLI

## 📝 Recommendations

**Before Testing:**
1. Verify with Dev Lead that all issues are actually completed
2. Update GitHub issue labels if implementations are done
3. Confirm Slack Bot testing requirements

**Testing Approach:**
1. Run automated tests for #8 and #9 via @crewx_tester
2. Report #10 as MANUAL_REQUIRED to Dev Lead
3. Generate conditional approval pending manual Slack verification

## 🔄 Next Steps

1. Delegate Issue #8 test to @crewx_tester
2. Delegate Issue #9 test to @crewx_tester
3. Report Issue #10 as requiring manual Slack Bot testing
4. Collect results and generate QA report
5. Provide go/no-go recommendation to Dev Lead
