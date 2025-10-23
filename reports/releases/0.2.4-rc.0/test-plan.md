# Release Plan: 0.2.4-rc.0

## 📦 Release Overview

**Current Production:** 0.2.3
**Target Release:** 0.2.4-rc.0
**Base Commit:** bbdf86f (v0.2.3)
**RC Branch:** release/0.2.4-rc.0

## 🆕 Included Features

This release includes **3 new feature commits**:

1. **b9f9565** - feat(branding): align Slack UI with CrewX
2. **76df4f6** - feat: add environment variable support for plugin providers
3. **b316dc4** - feat: add Codex provider and remote MCP agent support

## 🐛 Resolved Bugs

According to git-bug status:resolved:
- **5aebbf0** - [feature] Implement namespace-based provider system with plugin support
  - Status: CLOSED (already released in 0.2.2, marked as released:0.2.2)
  - Test Status: ✅ PASSED in previous release
  - **Decision: SKIP** (already released and tested)

- **5004ad9** - [bug] Slack bot responds to all messages without mention (regression)
  - Status: OPEN, status:resolved, target_release:0.2.x
  - Priority: 높음 (high)
  - Description: Bot auto-responds without @mention, fixed in commit 236ff50
  - Test Status: ⚠️ **NEEDS MANUAL TEST** (Slack Bot integration)
  - **Decision: MANUAL TEST REQUIRED**

## 🧪 Test Report Location

- RC Test Reports: `reports/releases/0.2.4-rc.0/`
- Individual Bug Tests: `reports/bugs/bug-XXXXX-test-{timestamp}.md`
- QA Final Report: `reports/releases/0.2.4-rc.0/qa-report-{PASS|FAIL}.md`

## 📋 Testing Scope

### NEW Features (not tested before)
1. **Slack UI Branding (b9f9565)**
   - Test Type: MANUAL (Slack Bot UI)
   - Scope: Verify Slack messages display "CrewX" branding

2. **Environment Variable Support for Plugins (76df4f6)**
   - Test Type: AUTOMATED
   - Scope:
     - Plugin provider with env var substitution
     - Verify {env:VAR_NAME} replacement works
     - Verify error handling for missing env vars

3. **Codex Provider & Remote MCP (b316dc4)**
   - Test Type: AUTOMATED
   - Scope:
     - Codex provider registration
     - Remote MCP agent configuration
     - Agent discovery and execution
     - Tool calling via remote agents

### RETEST Features (previously tested, verify no regression)
None - this is a clean feature release

### MANUAL Tests Required
1. **Slack Bot Mention Bug (5004ad9)** ⚠️
   - Verify bot only responds to @mentions, DMs, or when last speaker
   - Verify bot does NOT auto-respond without mention
   - Requires running Slack bot in live environment

2. **Slack UI Branding (b9f9565)** ⚠️
   - Verify "CrewX" branding in Slack messages
   - Requires running Slack bot in live environment

## 🎯 Success Criteria

### For AUTOMATED tests:
- ✅ Environment variable substitution works correctly
- ✅ Codex provider can be configured and used
- ✅ Remote MCP agents can be discovered and executed
- ✅ No regression in existing CLI functionality

### For MANUAL tests (to be verified by Dev Lead):
- ✅ Slack bot responds ONLY to mentions/DMs/thread continuations
- ✅ Slack UI shows "CrewX" branding consistently

## 🚀 Test Execution Plan

### Phase 1: Automated Tests (Parallel)
Execute these tests in parallel using @crewx_tester:

1. **Environment Variable Plugin Test**
   - Create test plugin with {env:TEST_VAR} placeholders
   - Verify substitution works
   - Verify error handling

2. **Codex Provider Test**
   - Configure Codex provider in crewx.yaml
   - Test query mode with @codex agent
   - Test execute mode with @codex agent

3. **Remote MCP Agent Test**
   - Configure remote agent in remote-agents.yaml
   - Test agent discovery
   - Test agent execution

### Phase 2: Manual Test Verification
Dev Lead must verify:
1. Slack bot mention behavior (bug 5004ad9)
2. Slack UI branding (feature b9f9565)

## 📊 Test Result Summary Template

```markdown
## Phase 1: Automated Tests

| Test | Result | Notes |
|------|--------|-------|
| Env Var Plugin | ✅/❌ | ... |
| Codex Provider | ✅/❌ | ... |
| Remote MCP | ✅/❌ | ... |

## Phase 2: Manual Tests

| Test | Result | Verified By | Notes |
|------|--------|-------------|-------|
| Slack Mention Bug | ⚠️ MANUAL | Dev Lead | ... |
| Slack UI Branding | ⚠️ MANUAL | Dev Lead | ... |
```

## 🔍 Risk Assessment

**Low Risk:**
- Codex provider is new, isolated feature
- Remote MCP agents are optional, won't break existing functionality
- Environment variable support is additive feature

**Medium Risk:**
- Slack bot changes could affect live deployments
- Manual testing required for Slack features

**Mitigation:**
- Comprehensive automated tests for CLI features
- Manual verification checklist for Slack features
- RC testing before production release

## 📝 Notes

- This RC includes mostly new features (not bug fixes)
- Only 1 bug fix (5004ad9) requires manual Slack testing
- Environment variable support adds new template variable syntax
- Codex provider enables integration with external Codex CLI
- Remote MCP agents enable distributed agent architecture

## ⏭️ Next Steps

1. Execute Phase 1 automated tests in parallel
2. Generate individual test reports
3. Compile Phase 1 results
4. Create manual test checklist for Dev Lead
5. Generate final QA report with recommendations

---

**Test Plan Created:** 2025-10-13
**Plan Author:** @crewx_qa_lead
**Status:** READY FOR EXECUTION
