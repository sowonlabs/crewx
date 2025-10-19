# Context Integration Standard

## Purpose
This standard defines how CrewX composes agent prompts by combining SDK `TemplateContext`, layout DSL artifacts, and channel-specific hooks. It captures the post-WBS-14 integration model so CLI, Slack, and MCP surfaces produce the same structured prompt without per-channel hardcoding.

## Architecture Overview
- **Source data**: Agent definitions (`crewx.yaml`), runtime inputs (query/task, conversation history), discovery services (tool registry, document loader), and environment variables.
- **Context builder**: `CrewXTool.buildTemplateContext()` assembles `TemplateContext` with `agent`, `agentMetadata`, `mode`, `messages`, `platform`, `tools`, `env`, and `vars.security_key`.
- **Layout loading**: `LayoutLoader.load(layoutId, props)` resolves YAML layout manifests, validates props against the schema, and returns a compiled layout template.
- **Rendering**: `LayoutRenderer.render(layout, renderContext)` merges context, props, and layout metadata, then `processDocumentTemplate()` resolves document includes and Handlebars helpers.
- **Prompt assembly**: The rendered layout becomes the base system prompt. CLI wraps the active user query or execute task (`<user_query key="{{vars.security_key}}">…</user_query>`) while preserving conversation history.
- **Structured payload**: `buildStructuredPayload()` serializes the final prompt, context, and metadata for downstream providers or telemetry consumers.

### Rendering Pipeline
```
AgentConfig → TemplateContext → LayoutLoader → LayoutRenderer → Template Processor → Final Prompt
                           ↓                             ↑
                     propsSchema validation   DocumentLoaderService + helpers
```
- Layout evaluation always receives both raw agent fields and normalized `agentMetadata` to keep backwards compatibility.
- Channel-specific nuances (Slack thread IDs, MCP metadata) travel via `TemplateContext.platform`, `messages[].metadata`, and `vars`.

### TemplateContext Snapshot (post-WBS-14)
| Field | Source | Notes |
| ----- | ------ | ----- |
| `env` | `process.env` | Passed through for layouts that read deployment metadata; avoid secrets in templates. |
| `agent` | Agent config | Minimal identity (`id`, `name`, `provider`, `model`, `workingDirectory`). |
| `agentMetadata` | Agent config (`specialties`, `capabilities`, `description`) | Preferred surface for layouts; `default.yaml` falls back to `agent.*` when metadata missing. |
| `mode` | CLI execution mode | `'query'` or `'execute'`. |
| `messages` | Conversation history | Current turn excluded for `query`; includes metadata for Slack/MCP. |
| `platform` | Invocation surface | `'cli'`, `'slack'`, `'mcp'`, etc. |
| `tools` | `ToolCallService.list()` | Includes count, JSON snapshot, schema references. |
| `vars` | Runtime variables | Currently includes `security_key`; extend cautiously. |

## Layout DSL Integration
- Layout manifests declare `layout.system_prompt` (or language-specific templates) and optional `propsSchema` for custom rendering knobs.
- Layouts may safely access `agentMetadata.*`, `agent.*`, `tools.*`, `session.*`, `messages`, and any validated `props`.
- See `packages/docs/layout-dsl-field-reference.md` (WBS-14 Phase 4) for the exhaustive field matrix, schema syntax, and helper catalogue.

## Agent Metadata Mapping Flow
1. Agent loader hydrates `AgentInfo` with raw config (including specialties/capabilities).
2. `buildTemplateContext()` copies human-readable attributes into `agentMetadata`.
3. `LayoutRenderer` receives both `agentMetadata` and legacy `agent.*` arrays so existing layouts keep working.
4. Layout templates decide presentation, e.g. `<specialties>` blocks iterate over `agentMetadata.specialties` with fallback to `agent.specialties`.
5. Feature-specific documents (e.g., built-in manuals) are pulled by `DocumentLoaderService` and interpolated during final rendering.

## Field Priority Chain
When no layout is present or rendering fails, CrewX derives the system prompt from available fields in the following order:
1. `agent.inline.prompt`
2. `agent.inline.system_prompt`
3. `agent.systemPrompt`
4. `agent.description`
5. Generated fallback: ``You are an expert ${agent.id}.``
The chosen base text still flows through `processDocumentTemplate()` so document includes and helpers remain available even in fallback mode.

## Feature Flag Guide
| Flag | Default | Description |
| ---- | ------- | ----------- |
| `CREWX_APPEND_LEGACY` | unset (`false`) | Re-enables pre-WBS-14 string append of specialties/capabilities/working directory after layout rendering. Use only if a custom layout is missing metadata bindings. |
| `CREWX_WBS14_TELEMETRY` | unset (`false`) | Emits debug-level telemetry when metadata is delegated to layouts, aiding post-migration audits. |
- Legacy append writes plain text immediately after rendered layouts. It is incompatible with custom XML wrappers, so prefer enabling only during short-lived migrations.
- Telemetry flag should remain limited to staging; logs include agent IDs and layout identifiers.

## Channel Extension Points
- **Slack**: `platform` is set to `'slack'`; `messages[].metadata` carries Slack user and thread info; layouts can branch on `{{#if (eq platform 'slack')}}` guards.
- **MCP**: MCP server passes session IDs through `messages[].metadata` and may provide IDE-specific documents; layouts should rely on `session.platform` if present.
- **CLI**: Default `platform` and `session.mode`; layouts reference `session.options` for per-mode CLI hints.
- **New channels**: Populate `TemplateContext.platform`, extend `messages[].metadata`, and add channel-specific documents; avoid modifying layout templates—use props or documents instead.

## Related Documents
- `packages/docs/context-integration-migration.md` — Migration workflow and testing checklist.
- `packages/packages/docs/layout-dsl-field-reference.md` — Detailed layout DSL field & helper catalogue.
- `templates/agents/default.yaml` — Reference implementation demonstrating metadata fallback blocks.
