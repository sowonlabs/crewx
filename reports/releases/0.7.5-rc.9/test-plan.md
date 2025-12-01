# Release Plan: 0.7.5-rc.9

**Created:** 2025-11-27
**Target Version:** 0.7.5-rc.9
**Test Status:** In Progress

---

## 📦 Test Scope

### PRIMARY: New Feature in rc.9
- **d4b4b0c**: API Provider AI SDK v5 호환성 (최종) - `@ai-sdk/openai-compatible` 적용
  - **Status**: NEW (not tested before)
  - **Priority**: P1 (Critical - main fix in rc.9)
  - **Components**: api/ollama, api/litellm, api/sowonai providers
  - **Test Focus**: AI SDK v5 compatibility, stream() method, model creation

### SECONDARY: Regression Tests (rc.0~rc.6 features)
These were tested in rc.0 and should still work:
- **0c73ba0**: crewx agent ls 설명 미표시 (SKIP - verified in rc.0)
- **0687aef**: CLI 네이밍 통일 (ls + list) (SKIP - verified in rc.0)
- **4853ba1**: crewx doctor CLI 도구 설치 안내 (SKIP - verified in rc.0)
- **081a97e**: 로그 Truncation 환경변수 제어 (SKIP - verified in rc.0)
- **0bb2dc3**: Handlebars 템플릿 파싱 오류 (SKIP - verified in rc.0)
- **babecd7**: Slack bot @mention 필수 문제 (SKIP - verified in rc.1)
- **2eaa762**: CLI Provider exit 0 + stderr 처리 (SKIP - verified in rc.5)
- **6327e0d**: Slack invalid_blocks 오류 (SKIP - verified in rc.6)

**Regression Test Strategy**: Smoke test only (quick verification that nothing broke)

---

## 🧪 Test Report Location
- **Individual Tests**: `reports/bugs/bug-d4b4b0c-test-{timestamp}.md`
- **Integration Report**: `reports/releases/0.7.5-rc.9/integration-test-report.md`
- **QA Final Report**: `reports/releases/0.7.5-rc.9/qa-report-{PASS|FAIL}.md`

---

## 📋 Detailed Test Cases

### TEST 1: d4b4b0c - API Provider AI SDK v5 Compatibility (NEW)

**Component**: MastraAPIProvider, api/ollama, api/litellm, api/sowonai
**Priority**: P1 (Critical)
**Test Type**: NEW (not tested before)

**Background**:
- **Issue**: rc.7 failed with error: `Agent "api/ollama" is using AI SDK v4 model which is not compatible with stream()`
- **Root Cause**: `createOpenAI({ baseURL })` always returns AI SDK v4 models
- **Solution**: Use `@ai-sdk/openai-compatible` package with `createOpenAICompatible()`
- **Files Changed**: `packages/sdk/src/core/providers/MastraAPIProvider.ts:112-129`

**Test Requirements**:
1. **Verify ai/ollama provider works with local Ollama instance**
   - Test agent: `localcoach` or any agent using `api/ollama`
   - Expected: No "AI SDK v4 model" error
   - Expected: stream() method works correctly
   - Expected: Model responds successfully

2. **Verify dependency installation**
   - Check: `@ai-sdk/openai-compatible` package in package.json
   - Expected: Version `^1.0.0` installed

3. **Code verification**
   - Location: `packages/sdk/src/core/providers/MastraAPIProvider.ts:112-129`
   - Expected: Uses `createOpenAICompatible()` instead of `createOpenAI()`
   - Expected: Applies to all three providers (ollama, litellm, sowonai)

4. **Stream compatibility**
   - Test: Run query with streaming enabled
   - Expected: No v4/v5 compatibility errors
   - Expected: Response streaming works smoothly

**Success Criteria**:
- ✅ api/ollama provider creates AI SDK v5 models
- ✅ stream() method works without errors
- ✅ localcoach agent responds successfully
- ✅ No "AI SDK v4 model" errors in logs
- ✅ All three providers (ollama, litellm, sowonai) use compatible SDK

**Test Command Examples**:
```bash
# Test 1: Basic query with api/ollama
crewx query "@localcoach hello"

# Test 2: Execute mode with api/ollama
crewx execute "@localcoach analyze this code"

# Test 3: Verify no AI SDK v4 errors in logs
crewx log | grep "AI SDK v4"  # Should return nothing
```

---

### TEST 2: Regression Test Suite (Quick Smoke Tests)

**Test Type**: RETEST (quick verification only)
**Priority**: P2 (Important - ensure no regressions)

**Regression Test Cases**:

#### 2.1: CLI Commands (0c73ba0, 0687aef, 4853ba1)
```bash
# Quick smoke test - all should work without errors
crewx agent ls          # Should show descriptions
crewx agent list        # Should work (alias)
crewx doctor            # Should show system status
crewx log ls            # Should work
crewx log list          # Should work (alias)
```

#### 2.2: Template System (0bb2dc3)
```bash
# Quick smoke test - Handlebars escaping
crewx query "@claude:haiku Test {{variable}} syntax"
# Expected: No parser errors
```

#### 2.3: Logging (081a97e)
```bash
# Quick smoke test - env vars
export CREWX_LOG_PROMPT_MAX_LENGTH=500
crewx query "@claude:haiku test"
# Expected: No errors, respects truncation
```

**Success Criteria**:
- ✅ All CLI commands work without errors
- ✅ No regressions from rc.0-rc.6
- ✅ Performance remains acceptable (~2-3s for queries)

---

## 🎯 Success Criteria

**Overall RC 0.7.5-rc.9 PASS Requirements**:
1. ✅ d4b4b0c (API Provider AI SDK v5) - All tests pass
2. ✅ Regression tests - No new failures introduced
3. ✅ Build - No compilation errors
4. ✅ Performance - No significant degradation

**If ANY test fails**:
- ❌ FAIL verdict
- Create 0.7.5-rc.10 with fixes
- Re-run full test suite

---

## 📊 Test History Context

### Previous RC Results:
- **rc.0** (2025-11-20): 5 features PASS, 1 PARTIAL (Slack manual test)
  - Tested: 0c73ba0, 0687aef, 4853ba1, 081a97e, 0bb2dc3
  - Result: ✅ PASS (all 5 features working)

- **rc.1-rc.6**: Individual bug fixes (not full RC tests)
  - rc.1: babecd7 (Slack bot @mention)
  - rc.5: 2eaa762 (CLI stderr)
  - rc.6: 6327e0d (Slack blocks)

- **rc.7**: ❌ FAIL - API Provider AI SDK v4/v5 error (7e1bb3a incomplete fix)

- **rc.8**: ❌ FAIL - Rollback attempt

- **rc.9**: Current - d4b4b0c (final AI SDK v5 fix with @ai-sdk/openai-compatible)

### Current Test Scope:
- **NEW**: d4b4b0c (must test thoroughly)
- **RETEST**: Quick smoke tests for rc.0-rc.6 features
- **SKIP**: Detailed retests of already-verified features

---

## 🚀 Test Execution Plan

### Stage 1: Primary Test (d4b4b0c)
**Duration**: ~15-20 minutes
**Executor**: @crewx_tester
**Output**: `reports/bugs/bug-d4b4b0c-test-{timestamp}.md`

### Stage 2: Regression Tests
**Duration**: ~5-10 minutes
**Executor**: @crewx_tester
**Output**: Included in integration report

### Stage 3: Integration Report
**Duration**: ~5 minutes
**Executor**: @crewx_tester
**Output**: `reports/releases/0.7.5-rc.9/integration-test-report.md`

### Stage 4: QA Final Report
**Duration**: ~5 minutes
**Executor**: @crewx_qa_lead (this agent)
**Output**: `reports/releases/0.7.5-rc.9/qa-report-{PASS|FAIL}.md`

**Total Estimated Time**: 30-40 minutes

---

## 📝 Notes

1. **Focus on d4b4b0c**: This is the main change in rc.9, all other features already verified
2. **Smoke tests sufficient**: No need to rerun full test suites for rc.0-rc.6 features
3. **Ollama required**: api/ollama provider test requires local Ollama instance running
4. **NPM version**: 0.7.5-rc.9 already published to npm (confirmed by user)

---

**Test Plan Created By**: @crewx_qa_lead
**Created**: 2025-11-27
**Status**: Ready for execution
