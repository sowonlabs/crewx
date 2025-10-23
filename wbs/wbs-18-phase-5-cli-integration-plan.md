# WBS-18 Phase 5: CLI Command SDK Integration

## Overview
This phase integrates the new provider bridge with CLI commands to support provider options, enabling users to specify which AI provider to use via CLI flags.

## Current Status Analysis

### Phase 1-4 Progress
- ✅ **Phase 1**: Provider injection architecture designed (45-page design document)
- ✅ **Phase 2**: AgentRuntime provider integration implemented with MockProvider fallback
- ⬜ **Phase 3**: SDK tests updated (not yet started)
- ⬜ **Phase 4**: CLI Provider Bridge implementation (not yet started)
- ⬜ **Phase 5**: CLI Command SDK integration (this phase)

### Current CLI Architecture
1. **CLI Commands**: `query`, `execute`, `chat` handlers in `packages/cli/src/cli/`
2. **CrewXTool**: Main service with `queryAgent()` and `executeAgent()` methods
3. **AIProviderService**: Manages CLI providers (Claude, Gemini, Copilot, Codex)
4. **AgentLoaderService**: Loads agent configurations from `agents.yaml`
5. **Provider Resolution**: Currently hardcoded through AIProviderService

### Integration Requirements
1. **Add --provider flag**: Support `--provider cli/claude`, `--provider cli/gemini`, etc.
2. **Provider config path**: Support `--provider-config path/to/config.yaml`
3. **Environment variable**: Support `CREWX_PROVIDER` env var
4. **Validation**: Validate provider options before execution
5. **Backward compatibility**: No --provider flag should use current behavior

## Implementation Plan

### Step 1: Extend CLI Options
Add provider-related flags to `CliOptions` interface and yargs parser:

```typescript
export interface CliOptions {
  // ... existing options ...
  
  // Provider options (NEW)
  provider?: string;        // --provider cli/claude, cli/gemini, etc.
  providerConfig?: string;  // --provider-config path/to/config.yaml
}
```

### Step 2: Create Provider Bridge Service
Implement `ProviderBridgeService` that:
- Gets CLI providers from `AIProviderService`
- Converts them to SDK-compatible `AIProvider` instances
- Supports provider configuration from files
- Validates provider availability

### Step 3: Update CrewXTool
Modify `CrewXTool` to:
- Accept optional provider parameter in methods
- Use ProviderBridgeService to resolve providers
- Pass provider to SDK AgentRuntime when available
- Fall back to current behavior when no provider specified

### Step 4: Update CLI Command Handlers
Modify `query.handler.ts`, `execute.handler.ts`, and `chat.handler.ts` to:
- Parse provider options from CLI args
- Pass provider information to CrewXTool methods
- Display provider information in output

### Step 5: Integration Testing
Test all scenarios:
- CLI without --provider flag (backward compatibility)
- CLI with --provider cli/claude
- CLI with --provider cli/gemini
- CLI with invalid provider (error handling)
- Environment variable CREWX_PROVIDER

## Design Decisions

### 1. Provider Flag Format
Use namespace/id format consistent with SDK:
```bash
crewx query "test" --provider cli/claude    # Claude CLI
crewx query "test" --provider cli/gemini    # Gemini CLI
crewx query "test" --provider cli/copilot   # Copilot CLI
crewx query "test" --provider cli/codex     # Codex CLI
```

### 2. Provider Configuration
Support both simple flags and configuration files:
```bash
# Simple provider selection
crewx query "test" --provider cli/claude

# With configuration file
crewx query "test" --provider cli/claude --provider-config config.yaml

# Environment variable
CREWX_PROVIDER=cli/claude crewx query "test"
```

### 3. Precedence Order
1. CLI `--provider` flag (highest priority)
2. `CREWX_PROVIDER` environment variable
3. Agent's default provider from `agents.yaml`
4. System default (current behavior)

### 4. Error Handling
- Invalid provider ID: Clear error message with available providers
- Unavailable provider: Error message with installation instructions
- Missing CLI tool: Error with installation guide

## Files to Modify

### New Files
- `packages/cli/src/services/provider-bridge.service.ts` - Bridge between CLI and SDK providers

### Modified Files
- `packages/cli/src/cli-options.ts` - Add provider options
- `packages/cli/src/crewx.tool.ts` - Integrate provider bridge
- `packages/cli/src/cli/query.handler.ts` - Add provider flag support
- `packages/cli/src/cli/execute.handler.ts` - Add provider flag support
- `packages/cli/src/cli/chat.handler.ts` - Add provider flag support

## Testing Strategy

### Unit Tests
- ProviderBridgeService provider resolution
- CLI options parsing for provider flags
- Error handling for invalid providers

### Integration Tests
- End-to-end CLI commands with --provider flag
- Environment variable CREWX_PROVIDER
- Backward compatibility (no --provider flag)

### Manual Tests
- Test with all available CLI providers
- Test provider availability checks
- Test error messages and help text

## Backward Compatibility

### No Breaking Changes
- All existing CLI commands work unchanged
- Default behavior preserved when no --provider flag
- Existing scripts and automation continue working

### Migration Path
- Users can gradually adopt --provider flags
- Documentation will show new options alongside existing examples
- No forced migration required

## Success Criteria

1. ✅ CLI accepts --provider flag with namespace/id format
2. ✅ Provider bridge successfully converts CLI providers to SDK format
3. ✅ CrewXTool uses specified provider when provided
4. ✅ Backward compatibility maintained (no --provider flag works)
5. ✅ Error handling for invalid/unavailable providers
6. ✅ Environment variable CREWX_PROVIDER support
7. ✅ Integration tests pass for all scenarios
8. ✅ Documentation updated with new examples

## Implementation Timeline

### Part 1: Core Infrastructure (2-3 hours)
- Extend CLI options
- Create ProviderBridgeService
- Update CrewXTool integration

### Part 2: CLI Handler Updates (1-2 hours)
- Update query, execute, chat handlers
- Add provider parsing and validation

### Part 3: Testing & Documentation (1-2 hours)
- Write unit and integration tests
- Update help text and examples
- Manual testing with all providers

## Future Enhancements

### Phase 5+ Features
- Provider-specific options (model, temperature, etc.)
- Provider switching mid-conversation
- Provider performance metrics
- Provider auto-fallback chains

### Integration with WBS-17/18
- Skill runtime provider context
- Multi-provider skill execution
- Provider pool management

---

## Implementation Status

- [ ] Step 1: Extend CLI Options
- [ ] Step 2: Create Provider Bridge Service
- [ ] Step 3: Update CrewXTool
- [ ] Step 4: Update CLI Command Handlers
- [ ] Step 5: Integration Testing
- [ ] Documentation Updates
- [ ] Final Verification

---

**Dependencies**: WBS-18 Phase 1-2 (completed), WBS-18 Phase 3-4 (recommended but not blocking)
**Priority**: High - Enables user control over AI providers
**Risk**: Medium - Requires careful backward compatibility handling