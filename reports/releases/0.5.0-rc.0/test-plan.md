# Test Plan: Release 0.5.0-rc.0

## Release Information

- **Version**: 0.5.0-rc.0
- **Previous Version**: 0.4.0
- **Release Type**: Minor Release (New Features)
- **Target Date**: TBD
- **Status**: Planning

## Features Included

### 1. Feature: Skills System (feature/skills)
**Branch**: `feature/skills`
**Commits**: 2 commits
- `87b5e9c` - feat: Add skills feature
- `6601c0e` - docs: Add comprehensive skills documentation and configuration

**Description**:
- Claude Code compatible skills system
- Dynamic skill loading from configured paths
- Project and agent-level skill configuration
- Cross-provider support (Claude, Gemini, Copilot, Codex)
- MCP skills tool integration

**Files Changed**: 16 files (+1091, -37)
- `.claude/skills/crewx/SKILL.md`
- `README.md`
- `crewx.skills.yaml`
- `crewx.yaml`
- `docs/skills.md`
- `packages/cli/src/services/skill-loader.service.ts`
- `packages/sdk/schema/skills-config.json`
- `skills/hello/SKILL.md`
- And more...

### 2. Feature: Slack Mention-Only Mode (feature/slack-option-mention)
**Branch**: `feature/slack-option-mention`
**Commits**: Multiple commits including:
- `c8aab19` - feat(slack): Add --mention-only mode to prevent auto-responses in threads
- `2833396` - chore(crewx): bump version to 0.4.1-dev.1 to match CLI

**Description**:
- `--mention-only` CLI option for Slack Bot
- Prevents automatic responses in threads without explicit mentions
- Backward compatible (legacy behavior preserved when flag not used)

**Files Changed**: 11 files (+456, -234)
- `packages/cli/src/cli-options.ts`
- `packages/cli/src/slack/slack-bot.ts`
- `packages/cli/tests/integration/slack/slack-bot-mention.test.ts`
- And more...

## Test Strategy

### Phase 1: Automated Testing
**Objective**: Ensure all existing tests pass and new tests validate features

#### 1.1 Unit Tests
- [ ] Run `npm run test:unit` - all packages
- [ ] Verify skill-loader.service.ts tests pass
- [ ] Verify skills-parser.spec.ts tests pass
- [ ] Verify slack-bot-mention.test.ts tests pass

#### 1.2 Integration Tests
- [ ] Run `npm run test:integration` - all packages
- [ ] Verify slack-bot integration tests with mention-only mode

#### 1.3 Build Verification
- [ ] Run `npm run build` - verify clean build
- [ ] Verify no TypeScript errors
- [ ] Verify CLI executable works

**Success Criteria**: 100% test pass rate, clean build

### Phase 2: Manual Feature Testing

#### 2.1 Skills System Testing

**Test Scenario 1: Basic Skill Loading**
- [ ] Configure `crewx.yaml` with skills path
- [ ] Create a simple test skill in `skills/test-skill/SKILL.md`
- [ ] Verify skill loads on CLI startup
- [ ] Check skill metadata is parsed correctly

**Test Scenario 2: Agent-Level Skills**
- [ ] Configure agent with specific skills in `crewx.yaml`
- [ ] Run query with agent: `crewx q "@agent_name test skill"`
- [ ] Verify skill is available to agent
- [ ] Verify skill content loads on-demand

**Test Scenario 3: Cross-Provider Skills**
- [ ] Test skill with Claude: `crewx q "@claude_agent use hello skill"`
- [ ] Test skill with Gemini: `crewx q "@gemini_agent use hello skill"`
- [ ] Verify skill works consistently across providers

**Test Scenario 4: Skills Configuration File**
- [ ] Use `CREWX_CONFIG=crewx.skills.yaml`
- [ ] Verify skills load from alternate config
- [ ] Test with multiple skill paths

**Test Scenario 5: MCP Skills Tool**
- [ ] Start MCP server: `crewx mcp`
- [ ] Verify `skills/list` tool is available
- [ ] Verify `skills/get` tool retrieves skill content
- [ ] Test from Claude Code IDE integration

#### 2.2 Slack Mention-Only Mode Testing

**Test Scenario 1: Mention-Only Flag Enabled**
- [ ] Start bot with: `crewx slack --mention-only`
- [ ] Send message in channel (no mention)
- [ ] Verify bot does NOT respond
- [ ] Send message with @mention
- [ ] Verify bot responds

**Test Scenario 2: Thread Behavior with Mention-Only**
- [ ] Start bot with: `crewx slack --mention-only`
- [ ] Create thread with bot mention (initial message)
- [ ] Reply in thread WITHOUT mention
- [ ] Verify bot does NOT auto-respond
- [ ] Reply in thread WITH mention
- [ ] Verify bot responds

**Test Scenario 3: Legacy Behavior (No Flag)**
- [ ] Start bot with: `crewx slack` (no --mention-only)
- [ ] Send message in channel (no mention)
- [ ] Verify bot auto-responds (legacy behavior)
- [ ] Create thread
- [ ] Verify bot auto-responds to thread replies

**Test Scenario 4: DM Behavior**
- [ ] Test DM with --mention-only flag
- [ ] Verify DM still works (mentions not required in DM)

**Test Scenario 5: Multi-Agent Mentions**
- [ ] Configure multiple agents
- [ ] Test @agent1 and @agent2 mentions
- [ ] Verify only mentioned agent responds

**Test Scenario 6: Help Command**
- [ ] Run `crewx slack --help`
- [ ] Verify --mention-only option is documented

### Phase 3: Integration & Regression Testing

#### 3.1 Skills + Slack Integration
- [ ] Start Slack bot with skills enabled
- [ ] Use skill via Slack command
- [ ] Verify skill works in Slack context

#### 3.2 Regression Tests
- [ ] Test existing CLI commands (`query`, `execute`, `agent ls`)
- [ ] Test existing Slack bot basic functionality
- [ ] Test MCP server basic functionality
- [ ] Verify no breaking changes in existing workflows

#### 3.3 Documentation Review
- [ ] Review `README.md` skills section
- [ ] Review `docs/skills.md` completeness
- [ ] Review CLI help output accuracy
- [ ] Verify example skills work as documented

## Risk Assessment

### Skills System Risks
- **Risk Level**: Low to Medium
- **Concerns**:
  - Dynamic file loading may have path resolution issues
  - Cross-provider compatibility needs validation
  - Performance impact of loading many skills
- **Mitigation**:
  - Test with various project structures
  - Validate with all supported providers
  - Monitor load times

### Slack Mention-Only Risks
- **Risk Level**: Low
- **Concerns**:
  - Backward compatibility with existing bots
  - User confusion if flag behavior unclear
  - Edge cases in thread detection
- **Mitigation**:
  - Default behavior unchanged (backward compatible)
  - Clear documentation and help text
  - Comprehensive thread testing

## Dependencies

- Node.js >= 20.x
- All NPM dependencies up to date
- Claude CLI, Gemini CLI for cross-provider tests
- Slack workspace for bot testing

## Rollback Plan

If critical issues found:
1. Do not merge to `develop`
2. Create `0.5.0-rc.1` with fixes
3. Re-run test plan
4. Document issues in QA report

## Success Criteria

- ✅ All automated tests pass (100%)
- ✅ All manual test scenarios pass
- ✅ No critical bugs found
- ✅ Documentation is accurate and complete
- ✅ Both features work independently and together
- ✅ No regression in existing functionality

## Next Steps

1. **Create RC Branch**: Merge both feature branches to `release/0.5.0-rc.0`
2. **Execute Tests**: Delegate to @crewx_tester for automated and manual testing
3. **Generate QA Report**: Document results in `qa-report-{timestamp}.md`
4. **Go/No-Go Decision**: Review results and decide on release or rc.1

## Notes

- This is a feature release (minor version bump)
- Both features are additive and backward compatible
- Requires testing with real Slack workspace
- Cross-provider skills testing may need API access to all providers

---

**Prepared by**: CrewX Dev Lead
**Date**: 2025-11-10
**Approved by**: [Pending Review]
