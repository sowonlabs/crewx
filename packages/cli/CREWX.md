# CrewX CLI Package

**📍 You are here:** `packages/cli/`
**⬆️ Parent:** [Project Root](../../CREWX.md)

---

## Overview

`@sowonai/crewx-cli` is the NestJS-based CLI and MCP surface for CrewX. It now
runs on the layout + TemplateContext pipeline delivered in WBS-13 ~ WBS-15 and
shares configuration schemas with the SDK (WBS-16).

**Core Features:**
- Layout-driven prompt orchestration with secure `<user_query>` wrappers (WBS-13~15)
- TemplateContext + AgentMetadata integration across CLI, Slack, and MCP (WBS-14)
- CLI commands (query, execute, chat, agent, doctor, init, templates, mcp)
- Dynamic provider loading (plugin/remote) validated via JSON Schema (WBS-16)
- Slack bot + MCP server surfaces with shared conversation history
- File-backed document system (`templates/documents/*.md`) with per-document
  render flags for literal Handlebars examples

**Tech Stack:**
- NestJS (Dependency Injection, Modular Architecture)
- TypeScript
- Vitest (Testing)

---

## Directory Structure

```
packages/cli/
├── src/
│   ├── cli/                # Command handlers (query/execute/chat/init/doctor/templates/mcp)
│   ├── services/           # Tool pipeline, config, TemplateContext, remote agents
│   ├── providers/          # Dynamic provider factory + logger adapter
│   ├── conversation/       # CLI/Slack conversation history providers
│   ├── slack/              # Slack bot + formatters
│   ├── utils/              # Template helpers, stdin/config/security utilities
│   ├── config/             # Static configuration (timeout)
│   ├── guards/             # CLI guard middleware
│   ├── ai.service.ts       # AI orchestration entrypoint
│   ├── ai-provider.service.ts # Provider registry bridging SDK + CLI
│   ├── crewx.tool.ts       # MCP tool server
│   ├── mcp.controller.ts   # MCP HTTP interface
│   ├── project.service.ts  # Workspace metadata
│   ├── app.module.ts       # NestJS module
│   ├── main.ts             # Application bootstrap
│   ├── cli-options.ts      # CLI option definitions
│   ├── health.controller.ts # Readiness endpoint
│   ├── stderr.logger.ts    # STDERR logger wiring
│   └── version.ts          # Published CLI version constant
├── tests/                  # Vitest suites
├── scripts/                # Build & release scripts
└── README.md               # User-facing documentation
```

---

## Key Components

| File | Description | LOC |
|------|-------------|-----|
| `src/crewx.tool.ts` | MCP server implementation with layout/TemplateContext bridge | 1,838 |
| `src/services/tool-call.service.ts` | Layout-aware tool execution pipeline | 1,187 |
| `src/services/agent-loader.service.ts` | Agent resolution, layout selection, capability gates | 671 |
| `src/slack/slack-bot.ts` | Slack orchestrator with TemplateContext bridge | 599 |
| `src/cli/chat.handler.ts` | Interactive chat entrypoint | 586 |
| `src/services/config-validator.service.ts` | JSON Schema validation + config diagnostics | 580 |
| `src/cli/init.handler.ts` | Project bootstrap + layout/template scaffolding | 491 |
| `src/services/document-loader.service.ts` | Inline/file document loader with render controls | 220 |

---

## Layout & Template Pipeline (WBS-13 ~ WBS-15)

- CLI defers prompt assembly to SDK `LayoutLoader`/`LayoutRenderer`, then applies
  CLI substitutions (document highlights, command previews).
- `ContextEnhancementService` populates `TemplateContext`/`AgentMetadata` before
  rendering to remove hard-coded prompt fragments.
- Secure `<user_query>` handling uses layout props plus `templates/agents/secure-wrapper.yaml`.
- Fallback order: layout → `inline.system_prompt` → legacy `systemPrompt`/`description`.
- Feature flag `CREWX_APPEND_LEGACY` keeps legacy appends available during rollout.

## Document Loading & Template Processing

- `DocumentLoaderService` now accepts strings or `{ path, render }` objects. Relative
  paths resolve against the bundled template directory so docs such as
  `templates/documents/crewx-manual.md` ship with the CLI.
- `render` defaults to `false`, keeping literal `{{…}}` examples intact. Opt-in per
  document when Handlebars evaluation is desired.
- `processDocumentTemplate` imports `TemplateContext` types directly from the SDK and
  only renders documents whose `render` flag is enabled. Requests for `{{{documents.*}}}`
  that cannot be satisfied fall back to the original expression instead of blank strings.

## Configuration & Provider Schema (WBS-16)

- `ConfigService` merges `crewx.yaml` + `crewX.layout.yaml`, exposing dynamic
  provider definitions and skills schema data.
- `ConfigValidatorService` runs AJV-based JSON Schema validation with actionable
  diagnostics used by `crewx doctor`.
- `DynamicProviderFactory` registers `plugin/*` and `remote/*` providers with
  strict environment variable validation.

## Skill Runtime Bridge (WBS-17 Phase 1)

- CLI consumes SDK `SkillRuntime` metadata for future MCP integrations.
- `AgentLoaderService` stashes skill metadata in `TemplateContext` for downstream
  surfaces (CLI, Slack) even before execution wiring lands.

---

## Template Rendering Data Flow Pipeline

**🎯 Critical Context:** This section documents the complete template rendering pipeline to prevent bugs like 97b5631 and 98a6656 where template data wasn't properly flowing through the rendering stages.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. crewx.tool.ts - Initial Context Creation                         │
│    runQuery() and runExecute() methods - templateContext object     │
├─────────────────────────────────────────────────────────────────────┤
│ Creates templateContext: RenderContext with:                        │
│ • user_input: query/task string                                     │
│ • messages: contextMessages (conversation history)                  │
│ • agent: { id, name, provider, model, workingDirectory, inline,    │
│           specialties, capabilities, description }                  │
│ • documents: { [docName]: { content, toc } }                        │
│ • vars: { security_key: securityKey }                               │
│ • props: {}                                                          │
│ • mode: 'query' | 'execute'                                         │
│ • platform: 'cli' | 'slack' | 'mcp'                                 │
│ • env: process.env                                                   │
│ • tools: buildToolsContext()                                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. crewx.tool.ts - processAgentSystemPrompt() method                │
├─────────────────────────────────────────────────────────────────────┤
│ Builds enriched renderContext: RenderContext by:                    │
│                                                                      │
│ A. Loading Documents:                                               │
│    documentLoaderService.getDocumentNames() loop                    │
│      documentsForTemplate[docName] = {                              │
│        content, toc, summary                                        │
│      }                                                               │
│                                                                      │
│ B. Loading Agent Skills:                                            │
│    agentSkills = await skillLoaderService.loadAgentSkills()         │
│                                                                      │
│ C. Building Complete RenderContext object literal:                  │
│    renderContext = {                                                │
│      user_input: templateContext.user_input,                        │
│      agent: {                                                        │
│        id, name, role, team, description,                           │
│        workingDirectory, capabilities, specialties,                 │
│        provider, providerList, providerRaw,                         │
│        inline: { ...agent.inline, prompt: baseSystemPrompt },      │
│        model, options, optionsArray, optionsByMode,                 │
│        remote, documents                                            │
│      },                                                              │
│      documents: documentsForTemplate,  // ← Full docs with summary │
│      skills: agentSkills,                                           │
│      vars: templateContext.vars,                                    │
│      props: layoutProps,                                            │
│      messages: templateContext.messages,                            │
│      platform: templateContext.platform,                            │
│      tools: templateContext.tools,                                  │
│      session: { mode, platform, options, env, vars, tools },       │
│      env: templateContext.env,                                      │
│      context: { mode, platform, options, env, vars, agent },       │
│      layout: { system_prompt, prompt }                              │
│    }                                                                 │
│                                                                      │
│ ⚠️ CRITICAL: platformMetadata must be added HERE in renderContext   │
│    if you want templates to access it!                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SDK LayoutRenderer.render() method                               │
│    packages/sdk/src/services/layout-renderer.service.ts             │
├─────────────────────────────────────────────────────────────────────┤
│ render(layout: LayoutDefinition, context: RenderContext):           │
│   1. preparedContext = prepareRenderContext(layout, context)        │
│      - Merges layout.defaultProps with context.props               │
│      - Sanitizes vars                                               │
│      - Returns: { ...context, vars: sanitized, props: merged }     │
│                                                                      │
│   2. template = handlebars.compile(layout.template)                │
│                                                                      │
│   3. result = template(preparedContext)                            │
│      - Handlebars renders with ALL context fields available        │
│      - Can access: {{agent.id}}, {{platform}}, {{vars.key}},       │
│        {{documents.doc-name.content}}, {{tools.count}}, etc.       │
│                                                                      │
│   Returns: rendered string                                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. template-processor.ts - processDocumentTemplate() function       │
│    packages/cli/src/utils/template-processor.ts                     │
├─────────────────────────────────────────────────────────────────────┤
│ processDocumentTemplate(rendered, documentLoader, templateContext): │
│                                                                      │
│   1. Builds final context object:                                   │
│      context = {                                                    │
│        documents: {},                                               │
│        env: additionalContext?.env || process.env,                  │
│        agent: additionalContext?.agent,                             │
│        agentMetadata: additionalContext?.agentMetadata,             │
│        mode: additionalContext?.mode,                               │
│        messages: additionalContext?.messages,                       │
│        platform: additionalContext?.platform,                       │
│        tools: additionalContext?.tools,                             │
│        vars: additionalContext?.vars                                │
│      }                                                               │
│                                                                      │
│   2. Registers Handlebars helpers via registerHandlebarsHelpers():  │
│      - eq, ne, contains, and, or, not                               │
│      - json, truncate, length                                       │
│      - escapeHandlebars, formatFileSize                             │
│      - formatConversation                                           │
│                                                                      │
│   3. Extracts document references via regex pattern matching:       │
│      - Pattern: {{{documents.doc-name.property}}}                   │
│      - Loads: content, toc, summary for each document               │
│      - If document.render=true, renders it with Handlebars          │
│      - Fallback: keeps original expression if doc not found         │
│                                                                      │
│   4. Final Handlebars compilation and rendering:                    │
│      compiledTemplate = Handlebars.compile(template)                │
│      return compiledTemplate(context)                               │
│                                                                      │
│   Returns: fully processed system prompt                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                   Final System Prompt Ready
```

### How to Add Data to Templates

#### 1. Adding Data to renderContext (Step 2)

**Location:** `packages/cli/src/crewx.tool.ts` in `processAgentSystemPrompt()` method - renderContext object literal

**Example - Adding platformMetadata (from bug 97b5631):**

```typescript
const renderContext: RenderContext & Record<string, any> = {
  user_input: templateContext.user_input,
  agent: { /* ... */ },
  documents: documentsForTemplate,
  skills: agentSkills,
  vars: templateContext.vars || {},
  props: layoutProps ?? {},
  messages: templateContext.messages || [],
  platform: templateContext.platform ?? 'cli',
  tools: templateContext.tools,
  session: sessionInfo,
  env: templateContext.env ?? {},
  context: { /* ... */ },

  // ✅ ADD YOUR CUSTOM DATA HERE
  platformMetadata: {
    slack: {
      channel: 'C123456',
      thread_ts: '1234567890.123456'
    }
  },
  // Any custom fields you add here will be accessible in templates
};
```

**Then in your template:**
```handlebars
{{#if platformMetadata.slack}}
Slack Channel: {{platformMetadata.slack.channel}}
Thread: {{platformMetadata.slack.thread_ts}}
{{/if}}
```

#### 2. Adding Data to documents

**Location:** `packages/cli/src/crewx.tool.ts` in `runQuery()` or `runExecute()` methods - documents loop

```typescript
const documents: Record<string, { content: string; toc?: string }> = {};
for (const docName of docNames) {
  const content = await this.documentLoaderService.getDocumentContent(docName);
  const toc = await this.documentLoaderService.getDocumentToc(docName);
  if (content) {
    documents[docName] = { content, toc };
  }
}
```

**Access in template:**
```handlebars
{{{documents.my-manual.content}}}
{{documents.my-manual.toc}}
```

#### 3. Adding Data to vars

**Location:** `packages/cli/src/crewx.tool.ts` in `runQuery()` or `runExecute()` methods - templateContext.vars field

```typescript
vars: {
  security_key: securityKey,
  // ✅ ADD CUSTOM VARS HERE
  custom_value: 'my-value',
  api_endpoint: process.env.API_ENDPOINT,
}
```

**Access in template:**
```handlebars
{{vars.security_key}}
{{vars.custom_value}}
```

#### 4. Adding Data to agent metadata

**Location:** `packages/cli/src/crewx.tool.ts` in `runQuery()` or `runExecute()` methods - templateContext.agent field

```typescript
agent: {
  id: agent.id,
  name: agent.name || agent.id,
  provider: (Array.isArray(agent.provider) ? agent.provider[0] : agent.provider) || 'claude',
  model: model || agent.inline?.model,
  workingDirectory: workingDir,
  inline: {
    prompt: agent.inline?.prompt || agent.inline?.system_prompt || agent.systemPrompt || '',
  },
  specialties: agent.specialties,
  capabilities: agent.capabilities,
  description: agent.description,
  // ✅ ADD CUSTOM AGENT FIELDS HERE
}
```

**Access in template:**
```handlebars
Agent: {{agent.name}} ({{agent.id}})
Provider: {{agent.provider}}
Model: {{agent.model}}
{{#if agent.specialties}}
Specialties: {{#each agent.specialties}}{{this}}, {{/each}}
{{/if}}
```

### Template Bug Fix Checklist

When fixing template-related bugs, verify:

- [ ] **Step 0: Zod Schema Sync (crewx.tool.ts - queryAgent/executeAgent schemas)**
  - [ ] Are new fields added to BOTH TypeScript args AND Zod schema?
  - [ ] queryAgent schema와 executeAgent schema 모두 동기화되었는가?
  - [ ] Zod schema에 없는 필드는 validation 시 제거됨 주의!

- [ ] **Step 1: Initial Context (crewx.tool.ts - runQuery/runExecute methods)**
  - [ ] Is the data added to `templateContext`?
  - [ ] Are all required fields populated (user_input, agent, documents, vars, mode, platform)?

- [ ] **Step 2: Enriched Context (crewx.tool.ts - processAgentSystemPrompt method)**
  - [ ] Is the data added to `renderContext`?
  - [ ] For new fields, are they added to the `renderContext` object literal?
  - [ ] Are documents properly loaded with content, toc, summary?

- [ ] **Step 3: Layout Rendering (SDK layout-renderer.service.ts - render method)**
  - [ ] Does the layout template reference the correct context field names?
  - [ ] Are props properly defined in layout's propsSchema if needed?
  - [ ] Is the Handlebars syntax correct ({{field}} vs {{{field}}})?

- [ ] **Step 4: Document Processing (template-processor.ts - processDocumentTemplate function)**
  - [ ] If using {{{documents.X.Y}}}, is the document loaded?
  - [ ] If the document needs rendering, is `render: true` set?
  - [ ] Are any custom Handlebars helpers needed?

- [ ] **Context Consistency**
  - [ ] Is the data available in BOTH query and execute modes?
  - [ ] Is the data type consistent (string vs object vs array)?
  - [ ] Are optional fields properly handled with {{#if}} checks?

- [ ] **Testing**
  - [ ] Test with actual agent configuration
  - [ ] Verify in both CLI and MCP modes
  - [ ] Check both query and execute commands
  - [ ] Validate Handlebars compilation doesn't fail

### Common Template Bugs and Fixes

#### Bug: Data passed but not reaching template (Zod schema mismatch)

**Root Cause:** Field exists in TypeScript args but missing from Zod schema

**Fix:** Add field to BOTH queryAgent and executeAgent Zod schemas
```typescript
// In crewx.tool.ts - queryAgent @McpTool schema
schema: {
  // ... existing fields
  platform: z.enum(['cli', 'slack']).optional(),
  metadata: z.record(z.any()).optional(),
}
// ALSO add to executeAgent schema!
```

#### Bug: Template field is undefined

**Root Cause:** Field not added to renderContext in Step 2

**Fix:** Add field to renderContext in `crewx.tool.ts` - `processAgentSystemPrompt()` method's renderContext object literal

```typescript
// ❌ WRONG: Only in templateContext (Step 1)
const templateContext: RenderContext = {
  myField: 'value',  // This won't be in layout rendering!
};

// ✅ CORRECT: In renderContext (Step 2)
const renderContext: RenderContext & Record<string, any> = {
  myField: templateContext.myField,  // Now accessible in layouts
};
```

#### Bug: Document content is empty

**Root Cause:** Document not loaded or render flag not set

**Fix 1:** Ensure document is loaded in Step 1
```typescript
const documents: Record<string, { content: string; toc?: string }> = {};
for (const docName of docNames) {
  const content = await this.documentLoaderService.getDocumentContent(docName);
  // ✅ Check content exists
  if (content) {
    documents[docName] = { content, toc };
  }
}
```

**Fix 2:** Enable rendering if document has Handlebars
```yaml
# In agent configuration
inline:
  documents:
    - path: "my-doc.md"
      render: true  # ✅ Enable Handlebars rendering
```

#### Bug: Platform-specific data not available

**Root Cause:** Platform metadata not passed through context

**Fix:** Add platformMetadata to renderContext
```typescript
// In processAgentSystemPrompt() method - renderContext object literal
const renderContext: RenderContext & Record<string, any> = {
  // ... other fields
  platform: templateContext.platform,

  // ✅ ADD: Platform-specific metadata
  platformMetadata: {
    slack: templateContext.slackMetadata,
    cli: templateContext.cliMetadata,
  }
};
```

### Type Definitions Reference

**RenderContext** (`packages/sdk/src/types/layout.types.ts` - RenderContext interface):
```typescript
export interface RenderContext {
  user_input?: string;
  messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
  mode?: 'query' | 'execute';
  platform?: string;
  env?: Record<string, any>;
  tools?: { list?: Array<any>; json?: string; count?: number } | null;
  vars: TemplateVars;
  agent: { id, name, provider?, model?, workingDirectory?, inline, ... };
  documents: Record<string, { content: string; toc?: string; summary?: string }>;
  props: Record<string, any>;
  session?: { options?: string[]; ... };
  context?: Record<string, any>;
}
```

---

## Learn More

- 🔗 [../../CREWX.md](../../CREWX.md) - Project root
- 🔗 [src/CREWX.md](src/CREWX.md) - Source architecture
- 🔗 [../sdk/CREWX.md](../sdk/CREWX.md) - SDK package
- 🔗 [../../wbs/wbs-14-phase-1-append-metrics.md](../../wbs/wbs-14-phase-1-append-metrics.md) - Append safety metrics

---

**Last Updated:** 2025-10-21
