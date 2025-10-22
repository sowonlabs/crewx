# Context Integration Migration Guide

## Audience & Scope
This guide targets developers maintaining custom CrewX agents or channel integrations. It explains how the WBS-14 context integration changes affect existing setups, how to validate migrations, and when the legacy behavior will be retired.

## What Changed in WBS-14
- `TemplateContext` is now the single source for agent metadata (`agentMetadata`), conversation history, and channel flags.
- Layout templates render metadata instead of relying on string append logic in `crewx.tool.ts`.
- Feature flag `CREWX_APPEND_LEGACY` can temporarily reinstate the old append behavior while templates are updated.

## Impact on Existing Agents
| Scenario | Expected Behavior |
| -------- | ----------------- |
| Agents using `inline.layout` (`string` or `{ id, props }`) | Layout receives metadata via `agentMetadata` and continues to render specialties/capabilities automatically. |
| Agents relying on `inline.system_prompt` only | No change. Prompt flows through the priority chain and is processed by `processDocumentTemplate()`. |
| Agents without layout or system prompt | Fallback prompt ``You are an expert ${agent.id}.`` is still generated, now wrapped by security container logic. |
| Custom layouts referencing `agent.specialties` | Continue to work; `default.yaml` demonstrates dual lookup (`agentMetadata.*` first, fallback to `agent.*`). |

## Fallback & Priority Behavior
1. Attempt layout rendering (`inline.layout` or default `crewx/default`).
2. If layout fails, fall back to inline/system prompt priority chain: `inline.prompt` → `inline.system_prompt` → `systemPrompt` → `description` → generated fallback.
3. All fallbacks still pass through `processDocumentTemplate()` so document includes remain intact.

## Migration Steps for Custom Layouts
1. **Audit templates** for direct references to `Specialties:` or `Capabilities:` appended text. Replace with layout blocks that read from `agentMetadata` or `agent`.
2. **Update helper usage** to rely on context variables (e.g., `session.mode`, `platform`) instead of parsing appended strings.
3. **Validate propsSchema** definitions so new props pass validation when `LayoutLoader` runs in strict mode.
4. **Add channel guards** if necessary using `platform` or `session.platform` to customize Slack/MCP rendering.

## Testing Checklist
- Run `npm run build` to confirm TypeScript and layout schema validation succeed.
- Execute `npm run test:cli` (or focus on `packages/cli/tests/unit/services/crewx-tool-layout.spec.ts`) to verify context rendering.
- Perform manual query/execute runs for each custom agent with and without `CREWX_APPEND_LEGACY` to compare prompts.
- For Slack bots, send a thread message and confirm conversation history renders via `<conversation_history>`.
- For MCP integrations, inspect structured payload JSON to ensure metadata fields appear as expected.

## Feature Flag & Timeline
| Milestone | Target Date | Action |
| --------- | ----------- | ------ |
| Phase 2 completion | 2025-10-19 | `CREWX_APPEND_LEGACY` introduced (default off). |
| Telemetry observation window | Phase 2/3 + 10 days | Monitor `CREWX_WBS14_TELEMETRY` logs; ensure legacy append usage < 5% of invocations. |
| Release 0.4.0 | Pending telemetry | Remove legacy append from staging environments; keep flag available for hotfix. |
| Release 0.5.0 (tentative) | After telemetry success | Remove `CREWX_APPEND_LEGACY` code path and retire flag. |

## Slack & MCP Considerations
- Slack threads rely on `messages[].metadata.thread_ts`; ensure layouts do not strip conversation history containers.
- MCP clients may inject additional documents or IDE metadata; layouts should consume `session.platform`/`platform` instead of hardcoding `'cli'` checks.
- Custom Channel integrations should set a unique `platform` value and extend layouts via props rather than modifying core templates.

## Support Resources
- `packages/docs/context-integration-standard.md` — Architectural reference.
- `templates/agents/default.yaml` — Working layout showcasing metadata fallbacks.
- `wbs/wbs-14-phase-2-completion-summary.md` — Feature flag details and test evidence.
