# Template Code Modification Rules

**CRITICAL: When modifying template-related code, ALWAYS follow these steps:**

## Files That Require Special Attention

- `packages/cli/src/crewx.tool.ts` - MCP tool server & template context creation
- `packages/cli/src/utils/template-processor.ts` - Document template processing
- Any layout-related code in SDK or CLI packages

## Before Making Changes

### 1. Read the Reference Documentation

**MUST read `packages/cli/CREWX.md` sections:**
- "Template Rendering Data Flow Pipeline"
- "Template Bug Fix Checklist"

### 2. Understand the Data Flow

- Step 0: Zod Schema Sync (queryAgent/executeAgent schemas)
- Step 1: Initial Context Creation (crewx.tool.ts - runQuery/runExecute)
- Step 2: Enriched Context Building (crewx.tool.ts - processAgentSystemPrompt)
- Step 3: Layout Rendering (SDK LayoutRenderer.render)
- Step 4: Document Processing (template-processor.ts)

### 3. Verify ALL Steps Are Updated

- [ ] Zod schemas synchronized (both queryAgent AND executeAgent)
- [ ] templateContext updated if needed (Step 1)
- [ ] renderContext updated with new fields (Step 2)
- [ ] Layout templates can access new fields (Step 3)
- [ ] Document processing handles new context (Step 4)

## Common Mistakes to Avoid

- ❌ Adding field to TypeScript but forgetting Zod schema → Field gets stripped
- ❌ Adding to templateContext but not renderContext → Template can't access it
- ❌ Only updating queryAgent schema, not executeAgent → Execute mode breaks
- ❌ Not checking if field needs to be in both query AND execute modes

## Testing Requirements

After template-related changes, ALWAYS test:
- [ ] Both query and execute modes
- [ ] CLI and MCP platforms
- [ ] With actual agent configuration
- [ ] Handlebars compilation succeeds

## Important Note

**If you're unsure about the template flow, READ `packages/cli/CREWX.md` first before making any changes!**
