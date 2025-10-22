# WBS-13 Phase 3: Test Case Catalog

**Document Version**: 1.0
**Date**: 2025-10-19
**Related**: [WBS-13 Phase 3 Test Strategy](wbs-13-phase-3-test-strategy.md)

## Test Case Index

### Unit Tests (20+ cases)
- [UT-01 to UT-05] Layout Parsing Tests
- [UT-06 to UT-10] Fallback Behavior Tests
- [UT-11 to UT-13] Two-Stage Rendering Tests
- [UT-14 to UT-20] Edge Case Tests

### Integration Tests (10+ cases)
- [IT-01 to IT-03] End-to-End Layout Rendering
- [IT-04 to IT-06] Backward Compatibility
- [IT-07 to IT-10] Error Handling

### Manual QA Tests (4 critical flows)
- [QA-01 to QA-04] Critical User Flows

---

## Unit Test Cases

### Layout Parsing Tests

#### UT-01: Parse String Layout Format
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout` as string

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: { layout: 'crewx/default' }
};
```

**Expected Behavior**:
- `layoutLoader.load()` called with `layoutId = 'crewx/default'`
- `layoutProps = undefined`

**Assertions**:
```typescript
expect(layoutLoader.load).toHaveBeenCalledWith('crewx/default', undefined);
```

**Priority**: P0 (Critical)

---

#### UT-02: Parse Object Layout Format with Props
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout` as object with id and props

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: {
      id: 'crewx/dashboard',
      props: { theme: 'dark', mode: 'debug' }
    }
  }
};
```

**Expected Behavior**:
- `layoutLoader.load()` called with correct id and props

**Assertions**:
```typescript
expect(layoutLoader.load).toHaveBeenCalledWith(
  'crewx/dashboard',
  { theme: 'dark', mode: 'debug' }
);
```

**Priority**: P0 (Critical)

---

#### UT-03: Parse Object Layout Format without Props
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout` as object without props field

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: { id: 'crewx/minimal' }
  }
};
```

**Expected Behavior**:
- `layoutProps` should be `undefined`

**Assertions**:
```typescript
expect(layoutLoader.load).toHaveBeenCalledWith('crewx/minimal', undefined);
```

**Priority**: P1 (High)

---

#### UT-04: Handle Layout with Empty Props Object
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout` with empty props object

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: { id: 'crewx/default', props: {} }
  }
};
```

**Expected Behavior**:
- Empty object should be passed as props

**Assertions**:
```typescript
expect(layoutLoader.load).toHaveBeenCalledWith('crewx/default', {});
```

**Priority**: P2 (Medium)

---

#### UT-05: Handle Layout with Null Props
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout` with null props

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: { id: 'crewx/default', props: null }
  }
};
```

**Expected Behavior**:
- Should treat null as undefined

**Assertions**:
```typescript
expect(layoutLoader.load).toHaveBeenCalledWith('crewx/default', undefined);
```

**Priority**: P2 (Medium)

---

### Fallback Behavior Tests

#### UT-06: Fallback to system_prompt When No Layout
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has no `inline.layout`
- Agent has `inline.system_prompt`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'legacy_agent',
  inline: { system_prompt: 'Legacy system prompt content' }
};
```

**Expected Behavior**:
- `layoutLoader.load()` NOT called
- Result contains `system_prompt` content

**Assertions**:
```typescript
expect(layoutLoader.load).not.toHaveBeenCalled();
expect(result).toContain('Legacy system prompt content');
```

**Priority**: P0 (Critical - Backward Compatibility)

---

#### UT-07: Fallback When Layout Loading Fails
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout` that doesn't exist
- Agent has `inline.system_prompt` as fallback

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: 'nonexistent/layout',
    system_prompt: 'Fallback prompt content'
  }
};
layoutLoader.load.mockImplementation(() => {
  throw new Error('Layout not found');
});
```

**Expected Behavior**:
- Error caught and logged as warning
- Falls back to `system_prompt`

**Assertions**:
```typescript
expect(result).toContain('Fallback prompt content');
expect(logger.warn).toHaveBeenCalledWith(
  expect.stringContaining('Failed to process layout')
);
```

**Priority**: P0 (Critical - Error Handling)

---

#### UT-08: Fallback Chain - systemPrompt
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has no `inline` field
- Agent has `systemPrompt`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'old_agent',
  systemPrompt: 'System prompt from agent config'
};
```

**Expected Behavior**:
- Uses `agent.systemPrompt`

**Assertions**:
```typescript
expect(result).toContain('System prompt from agent config');
```

**Priority**: P1 (High - Backward Compatibility)

---

#### UT-09: Fallback Chain - description
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has no `inline`, no `systemPrompt`
- Agent has `description`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'minimal_agent',
  description: 'This is a minimal agent'
};
```

**Expected Behavior**:
- Uses `agent.description`

**Assertions**:
```typescript
expect(result).toContain('This is a minimal agent');
```

**Priority**: P2 (Medium)

---

#### UT-10: Fallback Chain - Default Template
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has no `inline`, no `systemPrompt`, no `description`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'bare_agent'
};
```

**Expected Behavior**:
- Generates default template: "You are an expert {id}"

**Assertions**:
```typescript
expect(result).toContain('You are an expert bare_agent');
```

**Priority**: P2 (Medium)

---

### Two-Stage Rendering Tests

#### UT-11: Stage 1 - SDK LayoutRenderer Called First
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has `inline.layout`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: 'crewx/default',
    prompt: 'Test prompt'
  }
};
```

**Expected Behavior**:
- `layoutRenderer.render()` called with layout and renderContext

**Assertions**:
```typescript
expect(layoutRenderer.render).toHaveBeenCalledWith(
  expect.objectContaining({ id: 'crewx/default' }),
  expect.objectContaining({
    agent: {
      id: 'test_agent',
      name: expect.any(String),
      inline: { prompt: 'Test prompt' }
    }
  })
);
```

**Priority**: P0 (Critical)

---

#### UT-12: Stage 2 - CLI Template Processor Called Second
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Stage 1 output contains document placeholders
- TemplateContext has documents

**Test Input**:
```typescript
layoutRenderer.render.mockReturnValue(
  'System prompt with {{{documents.manual.content}}}'
);
const templateContext = {
  documents: { manual: { content: 'Manual content here' } }
};
```

**Expected Behavior**:
- Document placeholder resolved in final output

**Assertions**:
```typescript
expect(result).toContain('Manual content here');
expect(result).not.toContain('{{{documents.manual.content}}}');
```

**Priority**: P0 (Critical)

---

#### UT-13: RenderContext Construction
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Preconditions**:
- Agent has full inline config
- TemplateContext has vars

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'full_agent',
  name: 'Full Test Agent',
  inline: {
    layout: { id: 'crewx/default', props: { theme: 'dark' } },
    prompt: 'Agent prompt',
    system_prompt: 'Legacy prompt' // Should be ignored
  }
};
const templateContext = {
  vars: { security_key: 'test-key-123' },
  documents: {}
};
```

**Expected Behavior**:
- RenderContext has correct structure
- `inline.prompt` preferred over `inline.system_prompt`

**Assertions**:
```typescript
expect(layoutRenderer.render).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({
    agent: {
      id: 'full_agent',
      name: 'Full Test Agent',
      inline: { prompt: 'Agent prompt' } // NOT system_prompt
    },
    vars: { security_key: 'test-key-123' },
    props: expect.any(Object)
  })
);
```

**Priority**: P1 (High)

---

### Edge Case Tests

#### UT-14: Empty Layout ID
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: '',
    system_prompt: 'Fallback'
  }
};
```

**Expected Behavior**:
- Empty string treated as invalid
- Falls back to `system_prompt`

**Priority**: P2 (Medium)

---

#### UT-15: Undefined TemplateContext
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: { layout: 'crewx/default' }
};
const result = await processAgentSystemPrompt(agent, undefined);
```

**Expected Behavior**:
- Should not crash
- `vars` defaults to `{}`

**Priority**: P1 (High - Defensive Programming)

---

#### UT-16: Missing Inline Object
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  systemPrompt: 'System prompt'
  // No inline object
};
```

**Expected Behavior**:
- Should not crash accessing `agent.inline?.layout`

**Priority**: P1 (High)

---

#### UT-17: Both inline.prompt and inline.system_prompt
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: 'crewx/default',
    prompt: 'New prompt',
    system_prompt: 'Legacy prompt'
  }
};
```

**Expected Behavior**:
- `inline.prompt` takes precedence for renderContext

**Priority**: P2 (Medium)

---

#### UT-18: Layout Rendering Throws Exception
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
layoutRenderer.render.mockImplementation(() => {
  throw new Error('Rendering failed');
});
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: 'crewx/default',
    system_prompt: 'Safe fallback'
  }
};
```

**Expected Behavior**:
- Error caught and logged
- Falls back to `system_prompt`

**Priority**: P0 (Critical - Error Handling)

---

#### UT-19: Very Long Layout Template
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
const hugeTemplate = 'x'.repeat(100000); // 100KB template
layoutRenderer.render.mockReturnValue(hugeTemplate);
```

**Expected Behavior**:
- Should handle large templates without crashing
- Performance should be acceptable

**Priority**: P3 (Low - Performance)

---

#### UT-20: Special Characters in Props
**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: {
      id: 'crewx/default',
      props: {
        message: 'Hello "world" & <friends>'
      }
    }
  }
};
```

**Expected Behavior**:
- Special characters should be escaped properly

**Priority**: P2 (Medium - Security)

---

## Integration Test Cases

### End-to-End Layout Rendering

#### IT-01: Load and Render Agent with Layout
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Preconditions**:
- Full NestJS application initialized
- LayoutLoader, LayoutRenderer injected

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'integration_test_agent',
  inline: {
    layout: 'crewx/default',
    prompt: 'You are an integration test agent'
  }
};
```

**Expected Behavior**:
- Layout loaded from actual file `/templates/agents/default.yaml`
- Template rendered with SDK
- Documents substituted with CLI processor
- Final prompt contains expected content

**Assertions**:
```typescript
expect(systemPrompt).toContain('crewx_system_prompt'); // From template
expect(systemPrompt).toContain('You are an integration test agent'); // From inline.prompt
```

**Priority**: P0 (Critical - E2E)

---

#### IT-02: Template Path Resolution Verification
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Preconditions**:
- Application initialized

**Test Steps**:
1. Get LayoutLoader from DI container
2. Check `templatesPath` option
3. Verify path points to correct directory

**Expected Behavior**:
- Path resolves to `/Users/doha/git/crewx/templates/agents/`
- NOT `/Users/doha/git/crewx/packages/cli/templates/agents/`

**Assertions**:
```typescript
const layoutLoader = app.get('LAYOUT_LOADER') as LayoutLoader;
expect(layoutLoader['options'].templatesPath).toMatch(/templates\/agents$/);

// Verify default.yaml is loadable
const layout = layoutLoader.load('crewx/default');
expect(layout).toBeDefined();
expect(layout.id).toBe('crewx/default');
```

**Priority**: P0 (Critical - **BUG VERIFICATION**)

---

#### IT-03: Layout with Props Override
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Preconditions**:
- Custom layout with prop placeholders

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'props_test_agent',
  inline: {
    layout: {
      id: 'crewx/default',
      props: { custom_var: 'custom_value' }
    },
    prompt: 'Test'
  }
};
```

**Expected Behavior**:
- Props merged correctly
- Custom props available in template

**Priority**: P1 (High)

---

### Backward Compatibility

#### IT-04: Legacy Agent with inline.system_prompt
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Preconditions**:
- Agent uses old `inline.system_prompt` format

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'legacy_agent',
  inline: {
    system_prompt: 'This is a legacy system prompt with {{{documents.manual.content}}}'
  }
};
const templateContext = {
  documents: { manual: { content: 'Manual content' } }
};
```

**Expected Behavior**:
- Layout rendering skipped
- Document substitution still works
- Output identical to pre-WBS-13 behavior

**Assertions**:
```typescript
expect(systemPrompt).toContain('Manual content');
expect(systemPrompt).not.toContain('{{{documents'); // Resolved
```

**Priority**: P0 (Critical - Backward Compatibility)

---

#### IT-05: Agent with Only systemPrompt Field
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'old_style_agent',
  systemPrompt: 'Old style system prompt'
};
```

**Expected Behavior**:
- Works exactly as before
- No layout processing attempted

**Priority**: P0 (Critical - Backward Compatibility)

---

#### IT-06: Built-in Agents Still Work
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Test Steps**:
1. Load built-in agents from `/templates/agents/default.yaml`
2. Test @claude, @gemini, @copilot agents
3. Verify they use `inline.system_prompt`

**Expected Behavior**:
- All built-in agents functional
- No regression in behavior

**Priority**: P0 (Critical - Regression)

---

### Error Handling

#### IT-07: Layout File Not Found
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Test Input**:
```typescript
const agent: AgentInfo = {
  id: 'missing_layout_agent',
  inline: {
    layout: 'nonexistent/missing',
    system_prompt: 'Fallback content'
  }
};
```

**Expected Behavior**:
- Error logged (warning level)
- Falls back to `system_prompt`
- No exception thrown

**Priority**: P0 (Critical - Error Handling)

---

#### IT-08: Template Syntax Error
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Preconditions**:
- Create layout with invalid Handlebars syntax

**Test Input**:
```yaml
# fixtures/broken-template.yaml
layouts:
  broken: |
    {{#if unclosed
    This template is broken
```

**Expected Behavior**:
- Rendering error caught
- Falls back gracefully

**Priority**: P1 (High - Error Handling)

---

#### IT-09: Missing Template Variables
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Test Input**:
```typescript
// Template expects {{props.requiredField}}
const agent: AgentInfo = {
  id: 'test_agent',
  inline: {
    layout: 'crewx/default'
    // No props provided
  }
};
```

**Expected Behavior**:
- Missing variables render as empty strings
- No crash

**Priority**: P2 (Medium)

---

#### IT-10: Circular Template References
**File**: `packages/cli/tests/integration/layout-integration.test.ts`

**Test Input**:
```yaml
# Template A includes Template B
# Template B includes Template A
```

**Expected Behavior**:
- Handlebars detects cycle
- Error thrown and caught
- Fallback triggered

**Priority**: P3 (Low - Unlikely)

---

## Manual QA Test Cases

### QA-01: CLI Query with Layout Agent
**Platform**: CLI
**Execution**: Manual

**Setup**:
1. Create test agent in `agents.yaml`:
```yaml
agents:
  - id: "qa_layout_test"
    name: "QA Layout Test Agent"
    inline:
      layout: "crewx/default"
      prompt: "You are a QA test agent designed to verify layout integration"
```

**Test Command**:
```bash
crewx query "@qa_layout_test Tell me about yourself"
```

**Expected Output**:
- ✅ Agent responds successfully
- ✅ Response mentions "QA test agent"
- ✅ No error logs in console
- ✅ Response time < 5 seconds

**Pass Criteria**:
- All expected outputs present
- No errors or warnings

**Priority**: P0 (Critical)

---

### QA-02: CLI Execute with Layout Agent
**Platform**: CLI
**Execution**: Manual

**Test Command**:
```bash
crewx execute "@qa_layout_test Create a test file named test.txt with content 'Hello World'"
```

**Expected Output**:
- ✅ File `test.txt` created
- ✅ File contains "Hello World"
- ✅ No errors in console

**Cleanup**:
```bash
rm test.txt
```

**Priority**: P0 (Critical)

---

### QA-03: Legacy Agent Unchanged
**Platform**: CLI
**Execution**: Manual

**Test Command**:
```bash
# Test built-in @claude agent (uses inline.system_prompt)
crewx query "@claude What is your name?"
```

**Expected Output**:
- ✅ Agent responds "Claude" or similar
- ✅ No layout-related warnings
- ✅ Same quality of response as before WBS-13

**Priority**: P0 (Critical - Regression)

---

### QA-04: Template Path Resolution in Production
**Platform**: CLI (Production Build)
**Execution**: Manual

**Test Steps**:
1. Build CLI package:
```bash
cd /Users/doha/git/crewx
npm run build
```

2. Test in development:
```bash
crewx query "@crewx What is CrewX?"
```

3. Verify logs show template path

**Expected Output**:
- ✅ Templates loaded from `/Users/doha/git/crewx/templates/agents/`
- ✅ No "template not found" errors
- ✅ @crewx agent responds correctly

**Debug**:
```bash
# Enable debug logging
DEBUG=crewx:* crewx query "@crewx test"
```

**Priority**: P0 (Critical - **BUG VERIFICATION**)

---

## Test Execution Checklist

### Pre-Execution
- [ ] All test files created
- [ ] Test fixtures created
- [ ] Mock helpers implemented
- [ ] Test environment configured

### Execution
- [ ] Unit tests run and passing
- [ ] Integration tests run and passing
- [ ] Manual QA tests executed
- [ ] All bugs documented

### Post-Execution
- [ ] Coverage report generated
- [ ] Gaps analyzed and documented
- [ ] Known issues logged
- [ ] WBS-13 Phase 3 status updated

---

## Bug Template

**Title**: [Component] Brief description

**Severity**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happens

**Test Case**: UT-XX or IT-XX

**Environment**:
- Node.js version:
- OS:
- Branch:

**Logs**:
```
Error logs here
```

---

## Summary Statistics

| Category | Total Cases | Priority Breakdown |
|----------|-------------|-------------------|
| Unit Tests | 20 | P0: 7, P1: 6, P2: 6, P3: 1 |
| Integration Tests | 10 | P0: 7, P1: 2, P2: 1, P3: 1 |
| Manual QA | 4 | P0: 4 |
| **Total** | **34** | **P0: 18, P1: 8, P2: 7, P3: 2** |

**High Priority Tests**: 26 (P0 + P1) = 76% of total

**Critical Path**: P0 tests must pass before Phase 3 completion
