# WBS-13 Phase 1: Implementation Progress

**Date**: 2025-10-19
**Status**: In Progress

## Completed Steps

### 1. SDK Export Updates ✅
- **File**: `packages/sdk/src/index.ts`
- **Changes**: Added `LayoutLoader` and related types to SDK exports
- **Exports Added**:
  ```typescript
  export { LayoutLoader } from './services/layout-loader.service';
  export type {
    LoaderOptions,
    LayoutLoadError,
    InlineLayoutSpec,
  } from './types/layout.types';
  ```

### 2. CLI Module DI Setup ✅
- **File**: `packages/cli/src/app.module.ts`
- **Changes**: Registered SDK layout services as Nest providers
- **Services Registered**:
  - `LAYOUT_LOADER`: LayoutLoader instance pointing to `templates/agents`
  - `PROPS_VALIDATOR`: PropsValidator instance
  - `LAYOUT_RENDERER`: LayoutRenderer instance (injected with PropsValidator)

## Remaining Implementation Steps

### 3. CrewXTool Integration (IN PROGRESS)
**Goal**: Make CrewXTool use SDK layout services for agents with `inline.layout`

**Required Changes**:

#### 3.1 Add Constructor Injections
```typescript
constructor(
  // ... existing services
  @Inject('LAYOUT_LOADER') private readonly layoutLoader: LayoutLoader,
  @Inject('LAYOUT_RENDERER') private readonly layoutRenderer: LayoutRenderer,
) {}
```

#### 3.2 Add Helper Method
```typescript
/**
 * Process agent system prompt using SDK layout services if inline.layout is defined
 * Falls back to inline.system_prompt if no layout is specified
 */
private async processAgentSystemPrompt(
  agent: AgentInfo,
  templateContext: TemplateContext
): Promise<string> {
  // Check for inline.layout
  const inlineLayout = agent.inline?.layout;
  
  if (inlineLayout) {
    // Parse layout spec
    const layoutId = typeof inlineLayout === 'string' 
      ? inlineLayout 
      : inlineLayout.id;
    const layoutProps = typeof inlineLayout === 'object' 
      ? inlineLayout.props 
      : undefined;
    
    // Load and render with SDK
    const layout = this.layoutLoader.load(layoutId, layoutProps);
    const renderContext: RenderContext = {
      agent: {
        id: agent.id,
        name: agent.name || agent.id,
        inline: { prompt: agent.inline?.prompt || agent.inline?.system_prompt || '' }
      },
      documents: {}, // Populated by DocumentLoaderService  
      vars: templateContext.vars || {},
      props: layout.defaultProps
    };
    
    const rendered = this.layoutRenderer.render(layout, renderContext);
    
    // Still use CLI template processor for document substitution
    const { processDocumentTemplate } = await import('./utils/template-processor');
    return await processDocumentTemplate(rendered, this.documentLoaderService, templateContext);
  }
  
  // Fallback to inline.system_prompt (backward compatibility)
  let systemPrompt = agent.systemPrompt || agent.inline?.system_prompt || ...;
  const { processDocumentTemplate } = await import('./utils/template-processor');
  return await processDocumentTemplate(systemPrompt, this.documentLoaderService, templateContext);
}
```

#### 3.3 Update queryAgent Method
**Line ~510-543**: Replace direct system prompt processing with call to new helper:
```typescript
// OLD:
let systemPrompt = agent.systemPrompt || agent.description || `You are an expert ${agentId}.`;
if (systemPrompt) {
  const { processDocumentTemplate } = await import('./utils/template-processor');
  systemPrompt = await processDocumentTemplate(systemPrompt, this.documentLoaderService, templateContext);
}

// NEW:
const systemPrompt = await this.processAgentSystemPrompt(agent, templateContext);
```

#### 3.4 Update executeAgent Method
**Line ~796-830**: Same replacement as queryAgent

### 4. AgentLoaderService Updates (PENDING)
**Goal**: Parse and store `inline.layout` field from YAML

**Required Changes**:

#### 4.1 Update Agent Info Interface
Ensure `inline.layout` is included in the agent data structure returned by `loadAgentsFromConfig` and `loadBuiltInAgents`.

Currently at line ~254-256:
```typescript
systemPrompt: systemPrompt,
options: agent.options || [],
inline: agent.inline,  // ← Already captures inline.layout if present
```

**Verification**: The current implementation already preserves `agent.inline`, so if agents.yaml contains:
```yaml
agents:
  - id: my-agent
    inline:
      layout:
        id: "crewx/dashboard"
        props:
          theme: "dark"
```

It should already be available as `agent.inline.layout` in CrewXTool. ✅ **No changes needed here**.

### 5. Mention Parser Cleanup (PENDING)
**Goal**: Remove duplicate `packages/cli/src/utils/mention-parser.ts`

**Current State**:
- CLI has `/Users/doha/git/crewx/packages/cli/src/utils/mention-parser.ts` (147 lines)
- SDK has `packages/sdk/src/utils/mention-parser.ts` (exported from SDK)

**Action**:
```bash
# Delete CLI version
rm packages/cli/src/utils/mention-parser.ts

# Update all imports in CLI to use SDK version
# Find affected files:
grep -r "from.*utils/mention-parser" packages/cli/src
```

**Expected Files to Update**:
- Search CLI codebase for imports like `from './utils/mention-parser'` or `from '../utils/mention-parser'`
- Replace with `from '@sowonai/crewx-sdk'`

### 6. Package.json Cleanup (PENDING)
**File**: `packages/cli/package.json`

**Review Dependencies**:
- Check if direct `handlebars` dependency is still needed (SDK uses it for layouts)
- Verify all dependencies are actually used

### 7. Testing (PENDING)
**Create**: `packages/cli/tests/integration/layout-integration.test.ts`

**Test Cases**:
```typescript
describe('SDK Layout Integration', () => {
  test('Agent with inline.layout uses SDK LayoutRenderer', async () => {
    // Setup agent with inline.layout
    // Verify SDK services are called
    // Verify correct output
  });
  
  test('Agent without layout falls back to inline.system_prompt', async () => {
    // Verify backward compatibility
  });
  
  test('Layout props override works correctly', async () => {
    // Test props override from crewx.yaml
  });
});
```

### 8. Build Verification (PENDING)
```bash
# Build SDK first
cd packages/sdk
npm run build

# Build CLI with new integration
cd ../cli
npm run build

# Run tests
npm test
```

## Design Decisions

### Backward Compatibility Strategy
✅ **Decision**: Keep `inline.system_prompt` as fallback
- If `inline.layout` is present → Use SDK layout stack
- If `inline.layout` is absent → Use existing `inline.system_prompt` processing
- No breaking changes to existing agents

### Document Processing
✅ **Decision**: Two-stage processing
1. SDK LayoutRenderer renders layout template with props
2. CLI template-processor handles document substitution (`{{{documents.xxx}}}`)

**Rationale**: 
- SDK layouts focus on structure and props
- CLI documents are environment-specific (loaded from project files)
- Clean separation of concerns

### Template Path Resolution  
✅ **Decision**: Use `__dirname` relative path
```typescript
const templatesPath = path.join(__dirname, '..', 'templates', 'agents');
```
**Rationale**: Works in both dev and installed (global npm) scenarios

## Risks & Mitigation

### Risk 1: Template Path Not Found in Production
**Mitigation**: LayoutLoader will throw clear error if templates/ directory missing
**Fallback**: Agents can still use `inline.system_prompt`

### Risk 2: Breaking Existing Agents
**Mitigation**: Fallback strategy ensures backward compatibility
**Verification**: Run full integration test suite before merging

### Risk 3: Document Processing Edge Cases
**Mitigation**: Two-stage processing maintains existing document behavior
**Verification**: Test with agents that use both layouts and documents

## Next Actions

1. **Implement CrewXTool changes** (Step 3 above)
   - Add injections
   - Add helper method
   - Update queryAgent/executeAgent

2. **Remove duplicate mention-parser** (Step 5)
   - Find and update imports
   - Delete CLI version

3. **Create integration tests** (Step 7)
   - Basic layout rendering
   - Fallback behavior
   - Props override

4. **Build and verify** (Step 8)
   - npm run build in both packages
   - Run test suite
   - Manual smoke test with sample agent

5. **Update WBS documentation**
   - Mark Phase 1 as complete in wbs.md
   - Document any issues found
   - Note any deviations from original plan

## Questions for Review

1. Should we add logging/metrics for layout rendering performance?
2. Do we need migration guide for users to convert `inline.system_prompt` to `inline.layout`?
3. Should Phase 2 include template migration scripts?

