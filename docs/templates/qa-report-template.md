# QA Report: v{VERSION}

**Date:** {YYYY-MM-DD}
**Branch:** {branch-name}
**Tester:** @{username}
**Verdict:** {PASS | FAIL | CONDITIONAL-PASS}

---

## Executive Summary

<!-- Brief summary of the test results (2-3 sentences) -->

-

**Recommendation:** {GO | NO-GO | CONDITIONAL-GO} for release

---

## Test Environment

### System Information

| Item | Value |
|------|-------|
| **Node.js Version** | v{X.X.X} |
| **npm Version** | v{X.X.X} |
| **OS** | macOS/Linux/Windows {version} |
| **Test Branch** | {branch-name} |
| **Base Commit** | {commit-hash} |

### Build Verification

| Check | Status | Notes |
|-------|--------|-------|
| `npm run build` | PASS/FAIL | |
| SDK Compilation | PASS/FAIL | |
| CLI Compilation | PASS/FAIL | |
| Template Sync | PASS/FAIL | |

---

## Test Results Summary

### Overall Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Tests** | {N} | 100% |
| **Passed** | {N} | {X}% |
| **Failed** | {N} | {X}% |
| **Skipped** | {N} | {X}% |

### By Category

| Category | Total | Pass | Fail | Skip | Status |
|----------|-------|------|------|------|--------|
| Unit Tests | | | | | PASS/FAIL |
| Integration Tests | | | | | PASS/FAIL |
| Smoke Tests | | | | | PASS/FAIL |
| Regression Tests | | | | | PASS/FAIL |

---

## Test Categories

### 1. Build Verification

**Status:** PASS/FAIL

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| TypeScript Compilation | PASS/FAIL | Xs | |
| NestJS Build | PASS/FAIL | Xs | |
| Post-build Scripts | PASS/FAIL | Xs | |

### 2. CLI Commands

**Status:** PASS/FAIL

| Command | Status | Notes |
|---------|--------|-------|
| `crewx --version` | PASS/FAIL | |
| `crewx doctor` | PASS/FAIL | |
| `crewx agent ls` | PASS/FAIL | |
| `crewx query` | PASS/FAIL | |
| `crewx execute` | PASS/FAIL | |

### 3. Agent Functionality

**Status:** PASS/FAIL

| Agent | Query | Execute | Notes |
|-------|-------|---------|-------|
| @claude | PASS/FAIL | PASS/FAIL | |
| @gemini | PASS/FAIL | PASS/FAIL | |
| @copilot | PASS/FAIL | PASS/FAIL | |
| @codex | PASS/FAIL | PASS/FAIL | |

### 4. Feature Tests

**Status:** PASS/FAIL

| Feature | Status | Notes |
|---------|--------|-------|
| Template Rendering | PASS/FAIL | |
| Document Loading | PASS/FAIL | |
| Environment Variables | PASS/FAIL | |
| MCP Server | PASS/FAIL | |
| Slack Bot | PASS/FAIL | |

### 5. Regression Tests

**Status:** PASS/FAIL

| Previous Issue | Status | Notes |
|----------------|--------|-------|
| #xxx - Issue title | PASS/FAIL | |

---

## Issue-Specific Tests

<!-- For bug fix releases, test each fixed bug -->

### Bug #{xxx}: {Bug Title}

**Status:** PASS/FAIL

**Test Steps:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:** Description

**Actual Result:** Description

**Evidence:**
```
<!-- Paste logs or screenshots -->
```

---

## Failed Tests

<!-- Document all failed tests with details -->

### Test: {Test Name}

**Status:** FAIL

**Error Message:**
```
Error details here
```

**Root Cause:** (if known)

**Blocking Release:** Yes/No

**Workaround:** (if available)

---

## Skipped Tests

<!-- Document skipped tests with reasons -->

| Test | Reason | Ticket |
|------|--------|--------|
| Test name | Reason for skip | #xxx |

---

## Performance Metrics

<!-- Optional: Include if performance testing was done -->

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Build Time | Xs | Xs | +/-X% |
| CLI Startup | Xs | Xs | +/-X% |
| Query Response | Xs | Xs | +/-X% |

---

## Security Checks

<!-- Optional: Include if security testing was done -->

| Check | Status | Notes |
|-------|--------|-------|
| Dependency Audit | PASS/FAIL | |
| Secret Scanning | PASS/FAIL | |
| Prompt Injection | PASS/FAIL | |

---

## Recommendations

### Release Decision

- [ ] **GO** - All tests pass, ready for release
- [ ] **NO-GO** - Critical failures, release blocked
- [ ] **CONDITIONAL-GO** - Minor issues, document and proceed

### Action Items

<!-- List any issues that need attention before/after release -->

| Priority | Item | Owner | Status |
|----------|------|-------|--------|
| Critical | | @username | Pending |
| High | | @username | Pending |
| Medium | | @username | Pending |

### Follow-up Issues

<!-- Issues discovered during testing that should be tracked -->

- [ ] #xxx - Issue description

---

## Test Logs

### Build Log

```
<!-- Paste relevant build output -->
```

### Test Output

```
<!-- Paste test summary output -->
```

---

## Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| **QA Tester** | @{username} | Approved/Pending | {date} |
| **QA Lead** | @{username} | Approved/Pending | {date} |
| **Release Manager** | @{username} | Approved/Pending | {date} |

---

**Report Generated:** {TIMESTAMP}
**Test Framework:** CrewX QA System v{VERSION}
**Test Duration:** {X} minutes
