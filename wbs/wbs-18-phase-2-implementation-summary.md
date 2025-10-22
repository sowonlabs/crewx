# WBS-18 Phase 2: AgentRuntime Provider Integration

## Code Changes
- Added provider injection to `AgentRuntime` with runtime option wiring, real AIProvider execution, and response conversion helpers.
- Implemented `resolveProvider()` helper and provider factory integration in `createCrewxAgent`, including default model propagation and `MockProvider` fallback.
- Created shared provider typing (`provider.types.ts`) plus `MockProvider` and `createProviderFromConfig()` utilities for built-in providers.
- Updated SDK exports/indexes to surface new provider tooling and types across the public API.
- Expanded Vitest coverage for provider resolution/injection scenarios and refreshed existing expectations for mock behaviour.

## Files Modified / Added
- `packages/sdk/src/core/agent/agent-runtime.ts`
- `packages/sdk/src/core/agent/agent-factory.ts`
- `packages/sdk/src/core/agent/index.ts`
- `packages/sdk/src/core/providers/mock.provider.ts`
- `packages/sdk/src/core/providers/provider-factory.ts`
- `packages/sdk/src/core/providers/index.ts`
- `packages/sdk/src/core/providers/ai-provider.interface.ts`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/index.d.ts`
- `packages/sdk/src/types/provider.types.ts`
- `packages/sdk/src/types/index.ts`
- `packages/sdk/tests/unit/core/agent/agent-factory.test.ts`

## SkillRuntime / Skills Parser Integration Notes
- `AgentRuntime` now produces real provider metadata (`provider`, `toolCall`, `model`) expected by SkillRuntime execution contexts defined in WBS-17.
- Default model propagation from `ProviderConfig` ensures Skills Parser outputs (WBS-16) feed directly into runtime requests without manual overrides.
- Maintains mention parsing semantics so Skills Parser agent definitions continue to resolve agents identically post-integration.

## Backward Compatibility
- Fallback `MockProvider` preserves previous behaviour when no provider is supplied, retaining zero-config usage for SDK consumers.
- Public API remains source-compatible (`ProviderConfig` still exported via agent factory), with additional exports for advanced provider injection.
- Tests verify union input support (`ProviderConfig` or `AIProvider`) and ensure warnings for unsupported namespaces remain explicit.

## Testing
- `npm run test:unit --workspace @sowonai/crewx-sdk`
