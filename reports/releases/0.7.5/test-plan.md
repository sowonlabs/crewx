# Release Test Plan: 0.7.5

**Date Created:** 2025-11-20
**Release Type:** Minor Release
**Previous Version:** 0.7.4

---

## 📦 Release Contents

### Included Items (6 total)

**Bugs (5):**
1. **bug-4853ba1** - crewx doctor 명령어에 설치 안된 CLI 도구 설치 스크립트 안내 기능 추가
2. **bug-0bb2dc3** - Handlebars token in conversation history causes template parsing error
3. **bug-081a97e** - 로그 출력 Truncation 설정을 환경변수로 제어 가능하게 개선
4. **bug-0c73ba0** - crewx agent ls command does not display agent descriptions
5. **bug-0687aef** - CLI 서브커맨드 네이밍 컨벤션 통일 (ls + list 둘 다 지원)

**Features (1):**
6. **feature-af37098** - [WBS-35] Slack File Download 기능 구현

---

## 📋 Testing Scope

### NEW items (6 - all need testing)
All 6 items are new and have not been tested in previous RC releases:
- bug-4853ba1 ✓ (NEW)
- bug-0bb2dc3 ✓ (NEW)
- bug-081a97e ✓ (NEW)
- bug-0c73ba0 ✓ (NEW)
- bug-0687aef ✓ (NEW)
- feature-af37098 ✓ (NEW)

### RETEST items
None (no items previously failed)

### SKIP items
None (no items previously passed)

---

## 🧪 Test Report Locations

### Individual Bug Test Reports
- `/Users/doha/git/crewx/reports/bugs/bug-4853ba1-test-{timestamp}.md`
- `/Users/doha/git/crewx/reports/bugs/bug-0bb2dc3-test-{timestamp}.md`
- `/Users/doha/git/crewx/reports/bugs/bug-081a97e-test-{timestamp}.md`
- `/Users/doha/git/crewx/reports/bugs/bug-0c73ba0-test-{timestamp}.md`
- `/Users/doha/git/crewx/reports/bugs/bug-0687aef-test-{timestamp}.md`
- `/Users/doha/git/crewx/reports/bugs/feature-af37098-test-{timestamp}.md`

### RC Integration Test Report
- `/Users/doha/git/crewx/reports/releases/0.7.5/rc.0-test-report.md`

### Final QA Report
- `/Users/doha/git/crewx/reports/releases/0.7.5/qa-report-{PASS|FAIL}.md`

---

## 🎯 Detailed Test Specifications

### 1. bug-4853ba1: CLI Tool Installation Scripts in crewx doctor

**Priority:** Medium
**Component:** CLI, doctor command
**Labels:** feature, status:resolved, target_release:0.7.5
**Implementation:** bugfix/4853ba1 (commit: ac936da)

**Test Objectives:**
- Verify doctor command shows installation scripts for missing CLI tools
- Verify platform-specific commands (macOS, Linux, Windows)
- Verify authentication setup instructions
- Verify formatted output is user-friendly

**Test Cases:**

**TC-4853ba1-01: Doctor Command Output Structure**
```bash
# Prerequisites: At least one AI CLI tool not installed
crewx doctor

# Expected Output:
# ✅ Installed tools listed with checkmarks
# ❌ Missing tools listed with installation instructions
# 📋 Platform-specific commands displayed
# 🔑 Authentication setup instructions provided
```

**TC-4853ba1-02: Installation Script Accuracy**
```bash
# Test each platform's installation commands
# macOS: npm, brew
# Linux: npm, curl
# Windows: npm, npx

# Verify:
# - Commands are syntactically correct
# - Commands can be copy-pasted directly
# - Multiple installation methods provided
```

**TC-4853ba1-03: Authentication Instructions**
```bash
# For each CLI tool (claude, gemini, copilot, codex):
# Verify authentication setup instructions are present
# Verify instructions match official documentation
```

**Success Criteria:**
- ✅ Installation scripts displayed for all missing tools
- ✅ Platform detection works correctly
- ✅ Commands are copy-paste ready
- ✅ Authentication instructions complete
- ✅ Build passes without errors

---

### 2. bug-0bb2dc3: Handlebars Token Template Parsing Error

**Priority:** P1
**Component:** Template System
**Labels:** affected-version:0.7.x, component:template-system, status:resolved
**Implementation:** bugfix/0bb2dc3 (commit: d350aba)

**Test Objectives:**
- Verify conversation history with Handlebars tokens doesn't crash
- Verify escapeHandlebars helper works correctly
- Verify secondary template compilation safe

**Test Cases:**

**TC-0bb2dc3-01: Handlebars Token in Conversation History**
```bash
# Prerequisites: Create a conversation thread with Handlebars tokens
# Thread content examples:
# - "{{#if vars.xxx}}"
# - "{{#each items}}"
# - "{{{raw content}}}"

# Create thread with Handlebars tokens:
crewx chat -t test-handlebars-thread
# Send message: "Testing {{#if condition}} syntax"
# Exit chat

# Reuse the thread:
crewx chat -t test-handlebars-thread
# Send another message

# Expected:
# ✅ No parser errors (no "Expected end of comment")
# ✅ Previous messages displayed correctly
# ✅ Handlebars tokens escaped (shown as &#123;&#123;)
```

**TC-0bb2dc3-02: Context Thread Reuse Pattern**
```bash
# Test wbs-loop.sh pattern (coordinator reuse scenario)
# Create thread with template syntax in messages
export CONTEXT_THREAD="test-wbs-context"
crewx query "@coordinator Test message with {{#if vars.test}}"

# Reuse same thread
crewx query "@coordinator Another query"

# Expected:
# ✅ No EOF parser errors
# ✅ @coordinator processes successfully
# ✅ History includes escaped tokens
```

**TC-0bb2dc3-03: Edge Cases**
```bash
# Test various Handlebars syntax patterns:
# - Nested blocks: {{#if}}{{#each}}{{/each}}{{/if}}
# - Comments: {{!-- comment --}}
# - Raw blocks: {{{{raw}}}}
# - Partials: {{> partial}}

# Expected:
# ✅ All patterns properly escaped
# ✅ No compilation errors
```

**Success Criteria:**
- ✅ Conversation history with Handlebars tokens works
- ✅ No "Parse error" or "EOF" errors
- ✅ escapeHandlebars helper converts {{ → &#123;&#123;
- ✅ Build passes without TypeScript errors

---

### 3. bug-081a97e: Log Truncation Environment Variables

**Priority:** Medium
**Component:** Logging
**Labels:** component:logging, status:resolved
**Implementation:** bugfix/081a97e (commit: d2918e2)

**Test Objectives:**
- Verify new environment variables control log truncation
- Verify defaults match specifications
- Verify all providers respect settings

**Test Cases:**

**TC-081a97e-01: Default Truncation Values**
```bash
# Without environment variables set
crewx query "@claude Long prompt message..." --verbose

# Expected log output:
# Prompt truncated at 10000 characters (default)
# Tool results truncated at 2000 characters (default)
# Conversation truncated at 4000 characters (default)
```

**TC-081a97e-02: Custom Environment Variables**
```bash
# Set custom truncation values
export CREWX_LOG_PROMPT_MAX_LENGTH=500
export CREWX_LOG_TOOL_RESULT_MAX_LENGTH=100
export CREWX_LOG_CONVERSATION_MAX_LENGTH=200

crewx query "@claude Test query" --verbose

# Expected:
# ✅ Prompt truncated at 500 chars
# ✅ Tool results truncated at 100 chars
# ✅ Conversation truncated at 200 chars
```

**TC-081a97e-03: All Providers Support**
```bash
# Test CLI Providers (BaseAIProvider)
crewx query "@claude Test" --verbose
crewx query "@gemini Test" --verbose
crewx query "@copilot Test" --verbose

# Test API Provider (MastraAPIProvider) - if applicable
# (Requires API provider configuration)

# Expected:
# ✅ All providers respect environment variables
# ✅ No hardcoded 500 or 200 character limits
```

**TC-081a97e-04: Configuration File**
```bash
# Verify log.config.ts exists and exports correct values
cat packages/sdk/src/config/log.config.ts

# Expected:
# ✅ CREWX_LOG_PROMPT_MAX_LENGTH exported
# ✅ CREWX_LOG_TOOL_RESULT_MAX_LENGTH exported
# ✅ CREWX_LOG_CONVERSATION_MAX_LENGTH exported
# ✅ Default values: 10000, 2000, 4000
```

**Success Criteria:**
- ✅ Environment variables control truncation
- ✅ Default values correct (10000/2000/4000)
- ✅ All providers (CLI + API) updated
- ✅ .env.example updated with new variables

---

### 4. bug-0c73ba0: Agent Description Display

**Priority:** Medium
**Component:** CLI, agent command
**Labels:** component:cli, type:ux, status:resolved
**Implementation:** bugfix/0c73ba0 (commit: eb8a946)

**Test Objectives:**
- Verify agent descriptions shown in `crewx agent ls`
- Verify output formatting is clear
- Verify all agents display descriptions

**Test Cases:**

**TC-0c73ba0-01: Agent List Output**
```bash
crewx agent ls

# Expected output format:
# ID: agent_id
# Name: Agent Name
# Description: [Agent description text] ← NEW FIELD
# Provider: cli/claude
# Role: developer
# Team: Development
# ---
```

**TC-0c73ba0-02: Description Content Verification**
```bash
# Verify descriptions from crewx.yaml are displayed
crewx agent ls | grep -A 2 "crewx_claude_dev"

# Expected:
# ✅ Description field present
# ✅ Description text matches crewx.yaml
# ✅ Multi-line descriptions formatted correctly
```

**TC-0c73ba0-03: Built-in vs Custom Agents**
```bash
# Test both built-in agents and custom agents
crewx agent ls

# Expected:
# ✅ Built-in agents (@claude, @gemini, etc.) show descriptions
# ✅ Custom agents from crewx.yaml show descriptions
# ✅ Agents without description show blank or "N/A"
```

**Success Criteria:**
- ✅ Description field displayed in agent list
- ✅ All agents show their descriptions
- ✅ Output formatting clear and readable
- ✅ Helps users understand agent capabilities

---

### 5. bug-0687aef: CLI Subcommand Naming Convention

**Priority:** Medium
**Component:** CLI
**Labels:** component:cli, type:enhancement, status:resolved
**Implementation:** bugfix/0687aef (commit: 225e7cd)

**Test Objectives:**
- Verify both `ls` and `list` work for all commands
- Verify consistency across agent, log, template commands
- Verify help messages updated

**Test Cases:**

**TC-0687aef-01: Agent Command Aliases**
```bash
# Both should work identically
crewx agent ls
crewx agent list

# Expected:
# ✅ Both commands produce identical output
# ✅ No errors or warnings
```

**TC-0687aef-02: Log Command Aliases**
```bash
# Both should work identically
crewx log ls
crewx log list

# Expected:
# ✅ Both commands produce identical output
# ✅ No errors or warnings
```

**TC-0687aef-03: Template Command Aliases**
```bash
# Both should work identically
crewx template ls
crewx template list

# Expected:
# ✅ Both commands produce identical output
# ✅ No errors or warnings
```

**TC-0687aef-04: Help Messages**
```bash
# Verify help shows both options
crewx agent --help
crewx log --help
crewx template --help

# Expected:
# ✅ Help text mentions both 'ls' and 'list'
# ✅ Aliases documented correctly
```

**TC-0687aef-05: Default Behavior**
```bash
# Without subcommand (should default to ls/list)
crewx agent
crewx log
crewx template

# Expected:
# ✅ Defaults to list behavior
# ✅ No errors
```

**Success Criteria:**
- ✅ `ls` and `list` both work for agent, log, template
- ✅ Commands produce identical output
- ✅ Help messages document both options
- ✅ Backward compatibility maintained (existing `ls` users unaffected)

---

### 6. feature-af37098: WBS-35 Slack File Download

**Priority:** P1
**Component:** Slack Integration
**Labels:** component:slack-integration, type:feature, status:in-progress
**Implementation:** feature/wbs-35 (develop branch)

**Test Objectives:**
- Verify Slack file auto-download functionality
- Verify thread-based directory structure
- Verify path injection prevention
- Verify rate limiting
- Verify AI agent integration

**Test Cases:**

**TC-af37098-01: Automatic File Download**
```bash
# Prerequisites: Slack bot running, test workspace
npm run start:slack

# In Slack:
# 1. Upload a file to a thread
# 2. Check .crewx/slack-files/{thread_id}/ directory

# Expected:
# ✅ File downloaded automatically
# ✅ Saved in .crewx/slack-files/{thread_id}/
# ✅ Original filename preserved
# ✅ File content intact
```

**TC-af37098-02: Thread Isolation**
```bash
# Upload files to different threads
# Thread A: file_a.txt
# Thread B: file_b.txt

# Expected directory structure:
# .crewx/slack-files/
#   thread_a_id/
#     file_a.txt
#   thread_b_id/
#     file_b.txt

# Verify:
# ✅ Files isolated by thread
# ✅ No cross-thread contamination
```

**TC-af37098-03: Path Injection Prevention**
```bash
# In Slack, upload file with malicious names:
# - "../../../etc/passwd"
# - "../../.env"
# - "file\x00.txt"

# Expected:
# ✅ Path traversal blocked
# ✅ Files saved with sanitized names
# ✅ No files written outside .crewx/slack-files/
# ✅ Warning/error logged
```

**TC-af37098-04: Rate Limiting**
```bash
# Upload multiple files rapidly (>10 files in 1 minute)

# Expected:
# ✅ Rate limiting kicks in
# ✅ Some downloads delayed or rejected
# ✅ Appropriate error message to user
# ✅ No bot crash
```

**TC-af37098-05: AI Agent File Recognition**
```bash
# In Slack thread:
# 1. Upload document.txt with content "Test content"
# 2. Ask agent: "@crewx what's in the file I uploaded?"

# Expected:
# ✅ Agent recognizes uploaded file
# ✅ Agent can read file content
# ✅ Agent responds with file information
```

**TC-af37098-06: File Types Support**
```bash
# Upload various file types:
# - Text: .txt, .md, .json
# - Code: .js, .ts, .py
# - Images: .png, .jpg
# - Documents: .pdf, .docx

# Expected:
# ✅ All file types downloaded
# ✅ Correct MIME types preserved
# ✅ File integrity maintained
```

**TC-af37098-07: CLI Command (slack-files)**
```bash
# List downloaded files
crewx slack-files ls

# Expected:
# ✅ Shows all downloaded files
# ✅ Grouped by thread
# ✅ File metadata displayed (size, date, thread)
```

**TC-af37098-08: Environment Variables**
```bash
# Test configuration via environment variables
export SLACK_FILE_DOWNLOAD_ENABLED=false
npm run start:slack

# Upload file in Slack
# Expected:
# ✅ File NOT downloaded (feature disabled)

export SLACK_FILE_DOWNLOAD_ENABLED=true
export SLACK_FILE_MAX_SIZE=1048576  # 1MB
# Upload 2MB file
# Expected:
# ✅ File rejected (exceeds max size)
# ✅ User notified
```

**Success Criteria:**
- ✅ Files auto-download from Slack to .crewx/slack-files/{thread_id}/
- ✅ Path injection prevented
- ✅ Rate limiting works
- ✅ AI agents can access downloaded files
- ✅ CLI commands work (slack-files ls)
- ✅ Environment variable configuration works
- ✅ No security vulnerabilities

**⚠️ Manual Testing Required:**
This feature requires:
- Active Slack workspace with bot installed
- Slack API credentials configured
- Real file uploads from Slack client
- Cannot be fully automated

---

## 🔄 Test Execution Strategy

### Stage 1: Individual Bug Tests (Parallel Execution)

Execute all 6 tests in parallel using @crewx_tester:

```bash
crewx execute \
  "@crewx_tester Test bug-4853ba1: Verify crewx doctor shows CLI installation scripts for missing tools with platform-specific commands and auth instructions" \
  "@crewx_tester Test bug-0bb2dc3: Verify conversation history with Handlebars tokens doesn't crash template parser. Test thread reuse pattern" \
  "@crewx_tester Test bug-081a97e: Verify log truncation environment variables (CREWX_LOG_PROMPT_MAX_LENGTH, CREWX_LOG_TOOL_RESULT_MAX_LENGTH, CREWX_LOG_CONVERSATION_MAX_LENGTH) control output in all providers" \
  "@crewx_tester Test bug-0c73ba0: Verify 'crewx agent ls' displays agent descriptions from crewx.yaml configuration" \
  "@crewx_tester Test bug-0687aef: Verify both 'ls' and 'list' aliases work for agent, log, and template commands" \
  "@crewx_tester Test feature-af37098 (WBS-35): Slack File Download - verify auto-download, thread isolation, path injection prevention, rate limiting, AI integration. NOTE: Manual Slack testing required"
```

**Expected Deliverables (Stage 1):**
- 6 individual test reports in `/Users/doha/git/crewx/reports/bugs/`
- Each bug should have `status:qa-completed` or `status:rejected` label updated in git-bug

### Stage 2: Integration Test (After Stage 1)

After individual tests complete, run full integration test:

```bash
crewx execute "@crewx_tester Run full RC integration test for release 0.7.5-rc.0. Verify all 6 items work together without conflicts"
```

**Expected Deliverables (Stage 2):**
- Integration test report: `/Users/doha/git/crewx/reports/releases/0.7.5/rc.0-test-report.md`

---

## 🎯 Success Criteria

### Individual Item Success
Each bug/feature must:
- ✅ Pass all test cases defined above
- ✅ Build successfully without errors
- ✅ No regression in existing functionality
- ✅ Documentation updated if needed

### Overall Release Success
- ✅ All 6 items individually tested and passed
- ✅ Integration test passed (no conflicts between features)
- ✅ Build and npm publish preparation successful
- ✅ No P0/P1 bugs introduced
- ✅ Manual Slack testing completed for af37098

### Special Considerations

**WBS-35 (af37098) - Manual Testing Required:**
- Requires live Slack workspace
- Requires real file uploads
- Cannot be fully automated
- May delay release if manual testing unavailable

**If WBS-35 manual testing blocked:**
- Option 1: Exclude from 0.7.5, defer to 0.7.6
- Option 2: Partial testing (automated parts only), manual testing post-release

---

## 📊 Test Coverage Matrix

| Item | Component | Automated | Manual | Priority |
|------|-----------|-----------|--------|----------|
| bug-4853ba1 | CLI doctor | ✅ Full | ❌ None | Medium |
| bug-0bb2dc3 | Template | ✅ Full | ❌ None | P1 |
| bug-081a97e | Logging | ✅ Full | ❌ None | Medium |
| bug-0c73ba0 | CLI agent | ✅ Full | ❌ None | Medium |
| bug-0687aef | CLI commands | ✅ Full | ❌ None | Medium |
| feature-af37098 | Slack | ⚠️ Partial | ✅ Required | P1 |

---

## 📝 Notes

### Test Environment Requirements
- Node.js version: As per package.json
- NPM packages: Fresh `npm install`
- Git worktree: For branch testing isolation
- Environment variables: Clean slate, no legacy vars

### Slack Testing Prerequisites (af37098)
- Slack workspace with CrewX bot installed
- Valid tokens: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET
- Test channels with appropriate permissions
- File upload permissions enabled

### Risk Assessment

**Low Risk Items (4):**
- bug-4853ba1: Additive feature, no breaking changes
- bug-0c73ba0: Display enhancement only
- bug-0687aef: Alias addition, backward compatible
- bug-081a97e: Environment variable addition

**Medium Risk Items (1):**
- bug-0bb2dc3: Template system changes, could affect message rendering

**High Risk Items (1):**
- feature-af37098: New Slack integration, security critical (path injection), requires manual testing

---

## 🚀 Next Steps After Testing

### If All Tests PASS:
1. Update git-bug status for all items: `status:qa-completed`
2. Create final QA report: `qa-report-PASS.md`
3. Notify Development Team Lead: Ready for merge to develop
4. Prepare 0.7.5 release notes

### If Any Test FAILS:
1. Update git-bug status for failed items: `status:rejected`
2. Create final QA report: `qa-report-FAIL.md`
3. Decide: Exclude failed items → 0.7.5-rc.1, or fix and retest
4. Notify Development Team Lead with failure details

### Manual Testing Coordination (af37098)
1. Schedule Slack bot testing session
2. Assign manual tester (QA or Dev Team)
3. Use test plan TC-af37098-01 through TC-af37098-08
4. Document results in manual test report
5. Update feature status based on manual test results

---

**Test Plan Version:** 1.0
**Created By:** @crewx_qa_lead
**Review Status:** Ready for execution
**Estimated Test Time:**
- Automated tests: 2-3 hours
- Manual Slack tests (af37098): 1-2 hours
- **Total: 3-5 hours**
