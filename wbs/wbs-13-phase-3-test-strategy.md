# WBS-13 Phase 3: Test Strategy and Regression Plan

**Date**: 2025-10-19
**Status**: In Progress
**Phase**: WBS-13 Phase 3 - Integration Verification and Regression Testing

## Executive Summary

This document outlines the comprehensive test strategy for verifying the CLI-SDK layout integration implemented in WBS-13 Phase 1. The strategy focuses on:

1. **Regression Risk Mitigation**: Ensuring existing functionality remains intact
2. **Integration Verification**: Validating the 2-stage rendering pipeline
3. **Edge Case Coverage**: Testing boundary conditions and error scenarios
4. **Performance Validation**: Ensuring no performance degradation

## Phase 1 Implementation Review

### What Was Implemented

**File**: `packages/cli/src/crewx.tool.ts`

#### 1. SDK Service Integration
```typescript
@Inject('LAYOUT_LOADER') private readonly layoutLoader: LayoutLoader
@Inject('LAYOUT_RENDERER') private readonly layoutRenderer: LayoutRenderer
```

#### 2. Two-Stage Rendering Process
```typescript
private async processAgentSystemPrompt(agent: AgentInfo, templateContext: TemplateContext): Promise<string>
```

**Stage 1**: SDK LayoutRenderer
- Input: `inline.layout` (string or {id, props})
- Process: Load layout from `/templates/agents/*.yaml`
- Output: Rendered Handlebars template with props

**Stage 2**: CLI Template Processor
- Input: Stage 1 output
- Process: Document substitution (`{{{documents.xxx}}}`)
- Output: Final system prompt

#### 3. Backward Compatibility
- Falls back to `inline.system_prompt` if no layout defined
- Falls back to `inline.system_prompt` if layout rendering fails
- Maintains existing agent behavior for agents without `inline.layout`

### What Supports String AND Object Format

**From Phase 1 Implementation** (`crewx.tool.ts:150-160`):

```typescript
const layoutId = typeof inlineLayout === 'string'
  ? inlineLayout
  : inlineLayout.id;
const layoutProps = typeof inlineLayout === 'object' && 'props' in inlineLayout
  ? inlineLayout.props
  : undefined;
```

✅ **Confirmed**: Both formats are supported in the actual implementation:
- **String format**: `inline.layout: "crewx/default"`
- **Object format**: `inline.layout: { id: "crewx/default", props: {...} }`

### Fallback Mechanism Verification

**From Implementation** (`crewx.tool.ts:190-198`):

```typescript
} catch (error) {
  this.logger.warn(`Failed to process layout for agent ${agent.id}: ${getErrorMessage(error)}`);
  this.logger.warn('Falling back to inline.system_prompt');
  // Fall through to fallback logic below
}

// Fallback: Use inline.system_prompt or systemPrompt (backward compatibility)
let systemPrompt = agent.systemPrompt || agent.inline?.system_prompt || agent.description || `You are an expert ${agent.id}.`;
```

✅ **Confirmed**: Multi-level fallback implemented:
1. `inline.layout` → try SDK rendering
2. If fails → `inline.system_prompt`
3. If missing → `agent.systemPrompt`
4. If missing → `agent.description`
5. If missing → default template string

## Regression Risk Analysis

### High Risk Areas

#### 1. Agent Loading Path (AgentLoaderService)
**File**: `packages/cli/src/services/agent-loader.service.ts`

**Risk**: `inline` field parsing might break existing agents
**Impact**: HIGH - Core functionality
**Mitigation**:
- Line 255 preserves entire `inline` object: `inline: agent.inline`
- No schema validation added (lenient approach)
- Legacy fields (`system_prompt`) still work

**Verification**: ✅ SAFE - No changes to AgentLoaderService in Phase 1

#### 2. System Prompt Processing (queryAgent/executeAgent)
**Files**:
- `packages/cli/src/crewx.tool.ts:611` (queryAgent)
- `packages/cli/src/crewx.tool.ts:893` (executeAgent)

**Risk**: Prompt processing logic changed
**Impact**: HIGH - Affects all agent interactions
**Mitigation**:
- New helper method `processAgentSystemPrompt()` isolates changes
- Falls back to original behavior if layout fails
- Same final output format (system prompt string)

**Test Coverage Needed**:
- Agents with `inline.system_prompt` (legacy) → should work unchanged
- Agents with `inline.layout` (new) → should render via SDK
- Agents with both → `layout` takes precedence
- Agents with neither → fallback to `systemPrompt`

#### 3. Template Processing Pipeline
**File**: `packages/cli/src/utils/template-processor.ts`

**Risk**: Document substitution might fail with SDK-rendered output
**Impact**: MEDIUM - Document variables might not resolve
**Mitigation**:
- Two-stage approach keeps existing document processor
- Stage 2 still uses `processDocumentTemplate()`
- Same Handlebars context structure

**Verification**: ✅ SAFE - No changes to template-processor.ts

### Medium Risk Areas

#### 4. Template Path Resolution
**File**: `packages/cli/src/app.module.ts:42-48`

**Risk**: Template files not found in production/global install
**Impact**: MEDIUM - Layouts won't load but fallback works
**Current Implementation**:
```typescript
const templatesPath = path.join(__dirname, '..', 'templates', 'agents');
```

**Issue**: Templates are in `/Users/doha/git/crewx/templates/agents/` (root)
**Expected**: Should point to root `templates/agents/` not `packages/cli/templates/agents/`

**Verification**: ⚠️ **POTENTIAL BUG** - Path resolution needs verification

**Test Case**:
```typescript
test('LayoutLoader finds templates in correct path', () => {
  // Verify templates path resolves to /Users/doha/git/crewx/templates/agents/
  // NOT /Users/doha/git/crewx/packages/cli/templates/agents/
});
```

#### 5. DI Service Lifecycle
**File**: `packages/cli/src/app.module.ts`

**Risk**: Singleton services might cache stale data
**Impact**: LOW - Layouts are static, no staleness expected
**Mitigation**:
- `useFactory` creates instances once
- LayoutLoader caches loaded layouts (intentional)
- `reload()` method available if needed

### Low Risk Areas

#### 6. Error Handling and Logging
**Risk**: New error paths might not be covered
**Impact**: LOW - Affects debugging only
**Coverage**:
- LayoutLoader throws `LayoutLoadError`
- LayoutRenderer throws `LayoutRenderError`
- CrewXTool catches and logs warnings

## Test Strategy

### Test Pyramid

```
              ┌─────────────────┐
              │   E2E Tests     │  1-2 critical flows
              │  (Manual QA)    │
              └─────────────────┘
                     ▲
              ┌─────────────────┐
              │ Integration Tests│  5-10 scenarios
              │  (Vitest)        │
              └─────────────────┘
                     ▲
              ┌─────────────────┐
              │   Unit Tests     │  20-30 test cases
              │  (Vitest)        │
              └─────────────────┘
```

### Unit Test Plan

**File**: `packages/cli/tests/unit/services/crewx-tool-layout.test.ts` (NEW)

#### Test Suite 1: Layout Parsing
```typescript
describe('processAgentSystemPrompt - Layout Parsing', () => {
  test('should parse string layout format', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: { layout: 'crewx/default' }
    };
    // Verify layoutLoader.load() called with 'crewx/default'
  });

  test('should parse object layout format with props', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: {
        layout: {
          id: 'crewx/default',
          props: { theme: 'dark' }
        }
      }
    };
    // Verify layoutLoader.load() called with id and props
  });

  test('should handle layout with no props', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: { layout: { id: 'crewx/default' } }
    };
    // Verify layoutProps is undefined
  });
});
```

#### Test Suite 2: Fallback Behavior
```typescript
describe('processAgentSystemPrompt - Fallback', () => {
  test('should fall back to system_prompt if no layout', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: { system_prompt: 'Legacy prompt' }
    };
    const result = await processAgentSystemPrompt(agent, {});
    expect(result).toContain('Legacy prompt');
    expect(layoutLoader.load).not.toHaveBeenCalled();
  });

  test('should fall back to system_prompt if layout fails', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: {
        layout: 'nonexistent/layout',
        system_prompt: 'Fallback prompt'
      }
    };
    layoutLoader.load.mockImplementation(() => {
      throw new Error('Layout not found');
    });
    const result = await processAgentSystemPrompt(agent, {});
    expect(result).toContain('Fallback prompt');
  });

  test('should use agent.systemPrompt if inline is empty', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      systemPrompt: 'Agent system prompt'
    };
    const result = await processAgentSystemPrompt(agent, {});
    expect(result).toContain('Agent system prompt');
  });

  test('should use agent.description as last resort', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      description: 'Agent description'
    };
    const result = await processAgentSystemPrompt(agent, {});
    expect(result).toContain('Agent description');
  });

  test('should generate default prompt if all fields missing', async () => {
    const agent: AgentInfo = { id: 'test_agent' };
    const result = await processAgentSystemPrompt(agent, {});
    expect(result).toContain('You are an expert test_agent');
  });
});
```

#### Test Suite 3: Two-Stage Rendering
```typescript
describe('processAgentSystemPrompt - Two-Stage Rendering', () => {
  test('should render layout with SDK then process documents with CLI', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: {
        layout: 'crewx/default',
        prompt: 'Test prompt'
      }
    };
    const templateContext = {
      documents: { 'test-doc': { content: 'Document content' } }
    };

    layoutRenderer.render.mockReturnValue('Rendered layout with {{{documents.test-doc}}}');

    const result = await processAgentSystemPrompt(agent, templateContext);

    // Verify SDK rendering called first
    expect(layoutRenderer.render).toHaveBeenCalled();

    // Verify CLI document processing called second
    expect(result).toContain('Document content'); // {{{documents.test-doc}}} resolved
  });

  test('should pass correct renderContext to SDK', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      name: 'Test Agent',
      inline: {
        layout: { id: 'crewx/default', props: { theme: 'dark' } },
        prompt: 'Test prompt'
      }
    };
    const templateContext = { vars: { security_key: 'abc123' } };

    await processAgentSystemPrompt(agent, templateContext);

    expect(layoutRenderer.render).toHaveBeenCalledWith(
      expect.anything(), // layout object
      expect.objectContaining({
        agent: {
          id: 'test_agent',
          name: 'Test Agent',
          inline: { prompt: 'Test prompt' }
        },
        vars: { security_key: 'abc123' },
        props: expect.any(Object) // layout defaultProps
      })
    );
  });
});
```

#### Test Suite 4: Edge Cases
```typescript
describe('processAgentSystemPrompt - Edge Cases', () => {
  test('should handle empty layout id', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: { layout: '' }
    };
    // Should fail and fall back to system_prompt
  });

  test('should handle null layout props', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: { layout: { id: 'crewx/default', props: null } }
    };
    // Should pass undefined to layoutLoader.load()
  });

  test('should handle missing templateContext', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: { layout: 'crewx/default' }
    };
    const result = await processAgentSystemPrompt(agent, undefined);
    // Should not crash, vars should be {}
  });

  test('should handle inline.prompt AND inline.system_prompt', async () => {
    const agent: AgentInfo = {
      id: 'test_agent',
      inline: {
        layout: 'crewx/default',
        prompt: 'New prompt',
        system_prompt: 'Legacy prompt'
      }
    };
    // Should prefer inline.prompt over inline.system_prompt for renderContext
  });
});
```

### Integration Test Plan

**File**: `packages/cli/tests/integration/layout-integration.test.ts` (NEW)

#### Test Suite 1: End-to-End Layout Rendering
```typescript
describe('SDK Layout Integration (E2E)', () => {
  let app: INestApplication;
  let crewxTool: CrewXTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Full DI setup
    }).compile();

    app = module.createNestApplication();
    await app.init();
    crewxTool = module.get<CrewXTool>(CrewXTool);
  });

  test('should load and render agent with inline.layout', async () => {
    const agent: AgentInfo = {
      id: 'test_layout_agent',
      inline: {
        layout: 'crewx/default',
        prompt: 'You are a test agent'
      }
    };

    // Mock queryAgent to expose processAgentSystemPrompt result
    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, {});

    expect(systemPrompt).toBeDefined();
    expect(systemPrompt).toContain('crewx_system_prompt'); // From default.yaml layout
    expect(systemPrompt).toContain('You are a test agent'); // inline.prompt
  });

  test('should resolve template path correctly', async () => {
    const layoutLoader = app.get('LAYOUT_LOADER') as LayoutLoader;

    // Verify templates path points to root templates/ directory
    expect(layoutLoader['options'].templatesPath).toContain('templates/agents');

    // Verify default.yaml is loadable
    const layout = layoutLoader.load('crewx/default');
    expect(layout).toBeDefined();
    expect(layout.id).toBe('crewx/default');
  });

  test('should handle layout with props override', async () => {
    const agent: AgentInfo = {
      id: 'test_props_agent',
      inline: {
        layout: {
          id: 'crewx/default',
          props: { custom_field: 'custom_value' }
        },
        prompt: 'Test'
      }
    };

    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, {});

    // Props should be merged and available in template context
    expect(systemPrompt).toBeDefined();
  });
});
```

#### Test Suite 2: Backward Compatibility
```typescript
describe('Backward Compatibility', () => {
  test('should work with legacy agents (no inline.layout)', async () => {
    const agent: AgentInfo = {
      id: 'legacy_agent',
      inline: {
        system_prompt: 'Legacy system prompt content'
      }
    };

    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, {});
    expect(systemPrompt).toContain('Legacy system prompt content');
  });

  test('should work with agents using only systemPrompt', async () => {
    const agent: AgentInfo = {
      id: 'old_agent',
      systemPrompt: 'Old style system prompt'
    };

    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, {});
    expect(systemPrompt).toContain('Old style system prompt');
  });

  test('should maintain document substitution for legacy agents', async () => {
    const agent: AgentInfo = {
      id: 'doc_agent',
      inline: {
        system_prompt: 'Use this manual: {{{documents.manual.content}}}'
      }
    };
    const templateContext = {
      documents: { manual: { content: 'Manual content here' } }
    };

    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, templateContext);
    expect(systemPrompt).toContain('Manual content here');
  });
});
```

#### Test Suite 3: Error Handling
```typescript
describe('Error Handling', () => {
  test('should gracefully handle layout not found', async () => {
    const agent: AgentInfo = {
      id: 'missing_layout_agent',
      inline: {
        layout: 'nonexistent/layout',
        system_prompt: 'Fallback content'
      }
    };

    // Should not throw, should fall back
    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, {});
    expect(systemPrompt).toContain('Fallback content');
  });

  test('should handle layout rendering errors', async () => {
    const agent: AgentInfo = {
      id: 'broken_template_agent',
      inline: {
        layout: 'crewx/broken',
        system_prompt: 'Safe fallback'
      }
    };

    // Even if template has syntax errors, should fall back
    const systemPrompt = await crewxTool['processAgentSystemPrompt'](agent, {});
    expect(systemPrompt).toBeDefined();
  });
});
```

### Manual QA Test Plan

#### Critical Flow 1: CLI Query with Layout Agent
```bash
# Setup: Create test agent in agents.yaml
# agents:
#   - id: "qa_layout_test"
#     inline:
#       layout: "crewx/default"
#       prompt: "You are a QA test agent"

# Test command
crewx query "@qa_layout_test hello"

# Expected:
# ✅ Agent responds successfully
# ✅ System prompt contains crewx_system_prompt tags
# ✅ Response is coherent and matches agent prompt
```

#### Critical Flow 2: CLI Execute with Layout Agent
```bash
# Test command
crewx execute "@qa_layout_test create a test file"

# Expected:
# ✅ Agent can execute tasks
# ✅ File creation works
# ✅ No errors in console logs
```

#### Critical Flow 3: Legacy Agent Still Works
```bash
# Test with built-in @claude agent (uses inline.system_prompt)
crewx query "@claude analyze this code"

# Expected:
# ✅ Agent works as before
# ✅ No layout-related warnings
# ✅ Same quality of responses
```

#### Critical Flow 4: Template Path Resolution
```bash
# Test in development mode
cd /Users/doha/git/crewx
npm run build
crewx query "@crewx what is CrewX?"

# Expected:
# ✅ Templates load from /Users/doha/git/crewx/templates/agents/
# ✅ No "template not found" errors
# ✅ Layout rendering works
```

## Test Coverage Goals

### Coverage Targets

| Component | Unit Tests | Integration Tests | Manual QA |
|-----------|-----------|-------------------|-----------|
| Layout Parsing | 95% | - | - |
| Fallback Logic | 100% | - | ✓ |
| Two-Stage Rendering | 90% | 100% | ✓ |
| Error Handling | 100% | 100% | ✓ |
| Backward Compatibility | - | 100% | ✓ |

### Current Coverage (Baseline)

**CLI Package**:
- Total Tests: 166 passed, 21 skipped
- Files: 15 passed, 4 skipped

**SDK Package**:
- Total Tests: 240 passed, 13 skipped
- Files: 22 passed, 3 skipped

### Expected Coverage After Phase 3

**New Test Files**:
1. `packages/cli/tests/unit/services/crewx-tool-layout.test.ts` (~20 tests)
2. `packages/cli/tests/integration/layout-integration.test.ts` (~10 tests)

**Updated Test Files**:
1. `packages/cli/tests/unit/services/crewx-tool-options.test.ts` (unskip and refactor)

**Total Expected**: +30-40 tests

## Implementation Timeline

### Week 1: Unit Tests (Current Week)
- [ ] Create `crewx-tool-layout.test.ts`
- [ ] Implement Test Suite 1-4 (Layout Parsing, Fallback, Two-Stage, Edge Cases)
- [ ] Run tests and fix any failures
- [ ] Coverage report and gap analysis

### Week 2: Integration Tests
- [ ] Create `layout-integration.test.ts`
- [ ] Implement E2E test suite
- [ ] Implement backward compatibility tests
- [ ] Implement error handling tests

### Week 3: Manual QA and Documentation
- [ ] Execute manual QA test plan
- [ ] Document any bugs found
- [ ] Create bug tickets if needed
- [ ] Update WBS-13 Phase 3 status

## Success Criteria

✅ **Definition of Done**:

1. **Test Coverage**:
   - [ ] All unit tests passing (20+ new tests)
   - [ ] All integration tests passing (10+ new tests)
   - [ ] Manual QA tests executed and documented

2. **Regression Prevention**:
   - [ ] No existing tests broken
   - [ ] Legacy agents work unchanged
   - [ ] CLI commands work as before

3. **Documentation**:
   - [ ] Test strategy documented (this file)
   - [ ] Test cases written and reviewed
   - [ ] Known issues documented

4. **Quality Metrics**:
   - [ ] Code coverage ≥ 90% for new code
   - [ ] All critical paths tested
   - [ ] No P0/P1 bugs in production

## Risks and Mitigation

### Risk 1: Template Path Resolution Bug
**Severity**: HIGH
**Likelihood**: MEDIUM
**Impact**: Layouts won't load in production

**Mitigation**:
- Create integration test to verify path
- Test in both dev and production builds
- Add logging to show resolved template path

**Action Item**: 🚨 **IMMEDIATE** - Verify templates path in next session

### Risk 2: Test Complexity
**Severity**: MEDIUM
**Likelihood**: HIGH
**Impact**: Tests are hard to maintain

**Mitigation**:
- Use NestJS Testing utilities
- Create test helpers for common setups
- Keep tests simple and focused

### Risk 3: Missing Edge Cases
**Severity**: MEDIUM
**Likelihood**: MEDIUM
**Impact**: Bugs in production

**Mitigation**:
- Review Phase 1 implementation thoroughly
- Use property-based testing for input variations
- Manual QA testing with real agents

## Appendix

### Test Fixtures Needed

**File**: `packages/cli/tests/fixtures/agents/test-layout.yaml`
```yaml
layouts:
  test-layout: |
    <test_prompt>
    Agent: {{{agent.name}}}
    Prompt: {{{agent.inline.prompt}}}
    Props: {{props.testProp}}
    </test_prompt>
```

**File**: `packages/cli/tests/fixtures/agents.yaml`
```yaml
agents:
  - id: "test_layout_agent"
    name: "Test Layout Agent"
    inline:
      layout: "crewx/test-layout"
      prompt: "Test prompt content"

  - id: "test_legacy_agent"
    name: "Test Legacy Agent"
    inline:
      system_prompt: "Legacy system prompt"
```

### Test Helper Functions

```typescript
// tests/helpers/layout-test-helpers.ts

export function createMockLayoutLoader(): LayoutLoader {
  const mockLoader = {
    load: vi.fn(),
    hasLayout: vi.fn(),
    getLayoutIds: vi.fn(),
    reload: vi.fn(),
  };
  return mockLoader as unknown as LayoutLoader;
}

export function createMockLayoutRenderer(): LayoutRenderer {
  const mockRenderer = {
    render: vi.fn(),
  };
  return mockRenderer as unknown as LayoutRenderer;
}

export function createTestAgent(overrides?: Partial<AgentInfo>): AgentInfo {
  return {
    id: 'test_agent',
    name: 'Test Agent',
    ...overrides,
  };
}

export function createTestTemplateContext(overrides?: Partial<TemplateContext>): TemplateContext {
  return {
    vars: {},
    documents: {},
    ...overrides,
  };
}
```

## Conclusion

This test strategy provides comprehensive coverage for WBS-13 Phase 1 implementation. The approach balances:

- **Speed**: Focus on high-risk areas first
- **Coverage**: Unit → Integration → Manual pyramid
- **Quality**: Clear success criteria and coverage goals
- **Maintainability**: Well-structured test suites with helpers

**Next Steps**:
1. ✅ Review and approve this strategy
2. 🚨 **URGENT**: Verify template path resolution bug
3. Start implementing unit tests
4. Update WBS-13 Phase 3 status in wbs.md
