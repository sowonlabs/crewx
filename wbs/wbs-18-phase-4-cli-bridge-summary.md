# WBS-18 Phase 4: CLI Provider Bridge Implementation

## Architecture & Integration Updates
- Introduced `ProviderBridgeService` as the single integration surface between CLI provider discovery and the SDK's `createCrewxAgent` factory, supporting direct instances, config strings, and automatic fallback to registered providers.
- Updated `CrewXTool` query and execute flows to resolve providers via the bridge and execute through `AgentRuntime`, enabling call-stack events, mention parsing, and provider metadata propagation.
- Normalized CLI message payloads into SDK `ConversationMessage` structures to preserve history metadata and align with SkillRuntime expectations from WBS-17.
- Added runtime option merging in the SDK (`AgentRuntime`) so CLI-specific provider options (timeouts, working directory, structured payload, task IDs, security keys) are forwarded without losing default model propagation.

## Files Modified / Added
- `packages/sdk/src/core/agent/agent-runtime.ts`
- `packages/sdk/tests/unit/core/agent/agent-factory.test.ts`
- `packages/cli/src/crewx.tool.ts`
- `packages/cli/src/services/provider-bridge.service.ts`
- `packages/cli/tests/unit/provider-bridge.service.test.ts`

## Testing
- `npm test --workspace=@sowonai/crewx-cli` (pass after rebuilding SDK workspace).
- `npm test --workspace=@sowonai/crewx-sdk` (fails: existing YAML loader validation tests expect namespace/id errors that are currently allowed upstream).
- Targeted SDK verification: `npx vitest run tests/unit/core/agent/agent-factory.test.ts`.
- Targeted CLI verification: `npx vitest run tests/unit/provider-bridge.service.test.ts`.

## Risks & Follow-ups
- CLI provider bridge depends on the SDK dist output; rebuild SDK before running CLI tests to pick up runtime changes.
- YAML loader enforcement tests in the SDK remain red; coordinating fix is outside Phase 4 scope but should be tracked before GA.
- Provider options now surface additional metadata (timeouts, working directory, structured payload); downstream providers should be audited for unused fields before expanding usage.
