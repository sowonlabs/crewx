# Release Plan: 0.7.1-rc.0

**Date:** 2025-11-19
**QA Lead:** CrewX QA Team Lead
**Previous Version:** 0.7.0 (production)
**Target Version:** 0.7.1-rc.0

---

## 📦 Included Features

This release includes **WBS-33: Template Subcommand Enhancement** - no bug fixes, feature-only release.

### Feature: WBS-33 Template Enhancement
- **Phase 1**: File overwrite protection
  - Default: Skip existing files
  - Add `--force` flag for overwrite
  - Provide clear feedback (created/skipped counts)
- **Phase 2**: Dynamic template list
  - Fetch templates.json from GitHub
  - Support custom repo via environment variable
  - Caching for performance
  - Fallback for offline mode

**Related Commits:**
- `dc6cfd0` - feat(template): implement WBS-33 template subcommand enhancements
- `7512a7d` - docs(wbs): add WBS-33 template subcommand enhancement
- `daeec31` - chore: prepare 0.7.1-rc.0 - template enhancements

---

## 🔍 Resolved Bugs Status

**git-bug status:resolved analysis:**

All 7 resolved bugs are from **previous releases** and already tested:

| Bug ID | Title | Target Release | Status |
|--------|-------|----------------|--------|
| 5004ad9 | Slack bot responds without mention | 0.2.x | ✅ Already tested in 0.2.x |
| 72a95d2 | 슬랙 스레드 모든 에이전트 응답 문제 | 0.2.x | ✅ Already tested in 0.2.x |
| 4853ba1 | Doctor command installation guide | 0.1.x | ✅ Already tested in 0.1.x |
| ad308d0 | API Provider inline config not respected | (0.6.0) | ✅ Tested in 0.6.0-rc.0 |
| 6cfcb18 | API Provider env var substitution | (0.6.0) | ✅ Tested in 0.6.0-rc.0 |
| 45d1ed9 | API Provider agent ID extraction | (0.6.0) | ✅ Tested in 0.6.0-rc.0 |
| c934e7d | Parallel processing format mismatch | (0.6.0) | ✅ Tested in 0.6.0-rc.0 |

**Note:** One bug (5aebbf0) shows "closed" state - already merged to develop, not in this RC.

**Decision:** ❌ **NO bug retesting required** - All bugs were tested in their target releases.

---

## 🧪 Test Report Location

- **Test Plan:** `reports/releases/0.7.1-rc.0/test-plan.md` (this file)
- **Integration Test Report:** `reports/releases/0.7.1-rc.0/integration-test-{timestamp}.md`
- **QA Report:** `reports/releases/0.7.1-rc.0/qa-report-{PASS|FAIL}.md`

---

## 📋 Testing Scope

### NEW Features (Must Test)
1. **WBS-33 Phase 1: File Overwrite Protection**
   - Default behavior: skip existing files
   - Feedback: created/skipped file counts
   - `--force` flag: overwrite mode
   - User-friendly messages

2. **WBS-33 Phase 2: Dynamic Template List**
   - Fetch templates.json from GitHub
   - Display template categories
   - Environment variable support (CREWX_TEMPLATE_REPO)
   - Caching mechanism (15 minutes)
   - Fallback when offline

### REGRESSION Tests (Verify Maintained)
From 0.7.0:
- ✅ WBS skill runtime
- ✅ Project template system (basic)
- ✅ CLI template handler
- ✅ Build verification
- ✅ Core CLI functionality

From 0.6.0:
- ✅ API Provider support
- ✅ Multi-agent parallel execution

### SKIP (Already Tested)
- ❌ Slack bot bugs (0.2.x)
- ❌ Doctor command enhancements (0.1.x)
- ❌ API Provider parser bugs (0.6.0)

---

## 🎯 Success Criteria

### Must Pass (Blocking)
1. ✅ Build verification: Clean compilation
2. ✅ Phase 1: File protection working
3. ✅ Phase 2: Dynamic template list working
4. ✅ No breaking changes from 0.7.0
5. ✅ Basic CLI functionality maintained

### Should Pass (High Priority)
6. ✅ Unit tests: 90%+ pass rate
7. ✅ Integration tests: All passing
8. ✅ Template commands: All scenarios working
9. ✅ Performance: No degradation

### Nice to Have
10. ✅ Documentation complete
11. ✅ Error messages clear
12. ✅ Offline mode working

---

## 🔬 Test Strategy

### Stage 1: Build & Unit Tests
```bash
npm run build
npm run test
```
**Expected:** Clean build, 90%+ unit tests passing

### Stage 2: Feature Testing (WBS-33)

#### Phase 1: File Overwrite Protection
```bash
# Test 1: Fresh directory (should create all files)
mkdir /tmp/crewx-test-fresh && cd /tmp/crewx-test-fresh
crewx template init wbs-automation
# Expected: All files created, summary shown

# Test 2: Existing files (should skip)
crewx template init wbs-automation
# Expected: All files skipped, hint to use --force

# Test 3: Force overwrite
crewx template init wbs-automation --force
# Expected: All files overwritten

# Test 4: Mixed scenario (some files exist)
rm crewx.yaml
crewx template init wbs-automation
# Expected: crewx.yaml created, others skipped
```

#### Phase 2: Dynamic Template List
```bash
# Test 5: List templates (online)
crewx template list
# Expected: Templates fetched from GitHub, categories shown

# Test 6: Cached list (should be fast)
crewx template list
# Expected: Instant response from cache

# Test 7: Custom repo (environment variable)
export CREWX_TEMPLATE_REPO=https://github.com/custom/templates
crewx template list
# Expected: Fetches from custom repo

# Test 8: Offline mode (fallback)
# (disconnect network or mock fetch failure)
crewx template list
# Expected: Shows fallback list, no crash
```

### Stage 3: Regression Testing
```bash
# Test basic CLI functionality from 0.7.0
crewx agent ls
crewx doctor
crewx init --template development
crewx query "@claude:haiku test"
```

### Stage 4: Integration Test
```bash
# End-to-end template workflow
mkdir /tmp/e2e-test && cd /tmp/e2e-test
crewx template list                    # Dynamic list
crewx template init wbs-automation     # Fresh install
ls -la                                 # Verify files
crewx template init wbs-automation     # Skip existing
crewx template init wbs-automation --force  # Overwrite
```

---

## 📊 Risk Assessment

**Overall Risk:** 🟢 **LOW**

### Risk Factors
1. **Template fetch failure** - 🟡 Medium (mitigated by fallback)
2. **File system edge cases** - 🟡 Medium (tested in crewx-quickstart)
3. **Breaking changes** - 🟢 Low (additive changes only)
4. **Regression** - 🟢 Low (0.7.0 stable)

### Mitigation
- Comprehensive test scenarios cover edge cases
- Fallback mechanisms for network failures
- File protection prevents data loss
- No changes to core agent functionality

---

## 👥 Test Delegation

**Tester:** @crewx_tester

**Delegation Command:**
```bash
crewx execute "@crewx_tester Test release 0.7.1-rc.0: Run full integration test for WBS-33 template enhancements. Focus on Phase 1 (file overwrite protection) and Phase 2 (dynamic template list). Verify all 8 test scenarios in test plan, check regression from 0.7.0, and generate detailed test report in reports/releases/0.7.1-rc.0/"
```

---

## 📝 Next Steps

### QA Lead Actions
1. ✅ Test plan created
2. 🔄 Delegate to @crewx_tester
3. ⏳ Wait for test results
4. 📄 Generate QA report
5. 📢 Report to Development Team Lead

### Development Team Actions (After QA)
1. ⏳ Review QA report
2. ⏳ Fix any issues if FAIL
3. ⏳ Approve for release if PASS

### Release Manager Actions (After Approval)
1. ⏳ Merge release/0.7.1 to develop
2. ⏳ Publish 0.7.1 to npm
3. ⏳ Tag release as v0.7.1

---

## 📚 References

- **WBS Document:** `/Users/doha/git/crewx/wbs/wbs-33-template-enhancement.md`
- **Previous QA Report:** `/Users/doha/git/crewx/reports/releases/0.7.0/qa-report-PASS.md`
- **Release Branch:** `release/0.7.1`
- **Feature Branch:** `feature/wbs-33`

---

**Test Plan Created:** 2025-11-19
**Status:** ✅ Ready for testing
**Next Action:** Delegate to @crewx_tester
