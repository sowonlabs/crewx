# Changelog

## 0.1.0-dev.42

### Patch Changes

- dev bump

## 0.1.0-dev.41

### Patch Changes

- dev bump

## 0.1.0-dev.40

### Patch Changes

- dev bump

## 0.1.0-dev.39

### Patch Changes

- dev bump

## 0.1.0-dev.38

### Patch Changes

- dev bump

## 0.1.0-dev.37

### Patch Changes

- dev bump

## 0.1.0-dev.36

### Patch Changes

- dev bump

## 0.1.0-dev.35

### Patch Changes

- dev bump

## 0.1.0-dev.34

### Patch Changes

- dev bump

## 0.1.0-dev.33

### Patch Changes

- dev bump

## 0.1.0-dev.32

### Patch Changes

- dev bump

## 0.1.0-dev.31

### Patch Changes

- dev bump

## 0.1.0-dev.30

### Patch Changes

- dev bump

## 0.1.0-dev.29

### Patch Changes

- dev bump

## 0.1.0-dev.28

### Patch Changes

- dev bump

## 0.1.0-dev.27

### Patch Changes

- dev bump

## 0.1.0-dev.26

### Patch Changes

- dev bump

## 0.1.0-dev.25

### Patch Changes

- dev bump

## 0.1.0-dev.24

### Patch Changes

- dev bump

## 0.1.0-dev.23

### Patch Changes

- dev bump

## 0.1.0-dev.22

### Patch Changes

- fix doctor errors about wrong provider name

## 0.1.0-dev.21

### Patch Changes

- dev bump

All notable changes to the CrewX SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-dev.1] - 2025-10-17

### Added - WBS-10: SDK Completion and Feature Implementation

#### Phase 1: Core Types and YAML Configuration

- **StructuredPayload Types** (`src/types/structured-payload.types.ts`)

  - Complete type definitions for structured context payload
  - `StructuredPayload`, `StructuredMessage`, `AgentInfo` interfaces
  - Integration with WBS-8 CallStack types (`CallStackFrame` in metadata)
  - Full compliance with requirements-monorepo.md specification (line 215)
  - 21 comprehensive unit tests covering all type variants

- **YAML Configuration Loader** (`src/config/yaml-loader.ts`)
  - `loadAgentConfigFromYaml()` - Parse YAML strings to CrewxAgentConfig
  - `loadAgentConfigFromFile()` - Load agent configs from YAML files
  - `validateAgentConfig()` - Runtime config validation
  - Support for multiple agent configurations
  - Provider format: `namespace/id` (e.g., `cli/claude`, `mcp/custom`)
  - Knowledge base configuration (path or sources array)
  - Comprehensive error handling with `YamlConfigError`
  - 23 unit tests with 100% coverage

#### Phase 2: Parallel Execution Helpers

- **Parallel Query/Execute Functions** (`src/core/parallel/helpers.ts`)
  - `runQueriesParallel()` - Execute multiple agent queries in parallel
  - `runExecutesParallel()` - Execute multiple agent actions in parallel
  - Concurrency control with configurable limits
  - Progress tracking via callbacks
  - Error aggregation and partial failure handling
  - Timeout and retry policy support
  - 17 unit tests covering concurrency scenarios

#### Phase 3: Security Module Review

- Security features determined to be CLI-specific
- Authentication/authorization kept in CLI package (`packages/cli/src/guards/`)
- SDK remains focused on pure business logic (AI providers, conversation management)
- Updated requirements-monorepo.md to clarify security as CLI-only

#### Phase 4: Message Formatter Enhancements

- Enhanced `BaseMessageFormatter` with metadata extraction
- Improved timestamp formatting (ISO, relative, unix)
- Platform-specific formatting strategies
- Slack formatter integration verified
- Terminal color support maintained

#### Phase 5: Integration Verification

- All 98 SDK unit tests passing
- Full build verification (TypeScript compilation)
- Core functionality regression tests:
  - `createCrewxAgent()` factory function
  - `loadAgentConfigFromYaml()` YAML parsing
  - `runQueriesParallel()` parallel execution
- npm pack verification successful
- Package.json exports validated

### Technical Improvements

- **Test Coverage**: 90%+ across all new modules
- **Type Safety**: Strict TypeScript with no `any` types
- **Documentation**: Comprehensive JSDoc comments
- **Error Handling**: Custom error classes with detailed messages
- **Performance**: Efficient YAML parsing with js-yaml library

### Dependencies

- Added `js-yaml` for YAML configuration parsing
- Added `@types/js-yaml` for TypeScript definitions

### Files Added

- `src/types/structured-payload.types.ts` (224 lines, 21 tests)
- `src/config/yaml-loader.ts` (267 lines, 23 tests)
- `src/core/parallel/helpers.ts` (186 lines, 17 tests)
- `tests/unit/types/structured-payload.test.ts`
- `tests/unit/config/yaml-loader.test.ts`
- `tests/unit/core/parallel/helpers.test.ts`

### Exports Added

- `StructuredPayload` - Main structured context type
- `StructuredMessage` - Message format type
- `AgentInfo` - Agent metadata type
- `loadAgentConfigFromYaml` - YAML config loader
- `loadAgentConfigFromFile` - File-based config loader
- `validateAgentConfig` - Config validation
- `runQueriesParallel` - Parallel query execution
- `runExecutesParallel` - Parallel execute execution
- `YamlConfigError` - YAML parsing error class

### Breaking Changes

None - All additions are backwards compatible

### Migration Notes

#### Using StructuredPayload (Recommended for CLI developers)

```typescript
import { StructuredPayload } from "@sowonai/crewx-sdk";

// CLI can now import StructuredPayload from SDK
// Remove CLI-local StructuredContextPayload definitions
```

#### Using YAML Configuration

```typescript
import { loadAgentConfigFromYaml, createCrewxAgent } from "@sowonai/crewx-sdk";

const yamlConfig = `
agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-opus
    knowledgeBase: ./docs
`;

const config = loadAgentConfigFromYaml(yamlConfig);
const { agent } = await createCrewxAgent(config);
```

#### Using Parallel Execution

```typescript
import { runQueriesParallel } from "@sowonai/crewx-sdk";

const requests = [
  { agentId: "@claude", prompt: "Analyze backend" },
  { agentId: "@gemini", prompt: "Review frontend" },
];

const results = await runQueriesParallel(requests, {
  concurrency: 2,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  },
});
```

## [0.1.0-dev.0] - 2025-10-15

### Added - WBS-8 & WBS-9: Foundation and Shared Components

- Initial SDK package structure
- Core agent factory with `createCrewxAgent()`
- Event system for agent lifecycle tracking
- Call stack management
- Message formatting abstractions
- AI provider interfaces (Claude, Gemini, Copilot, Codex)
- Conversation history management
- Document manager utilities
- Remote agent communication
- Parallel runner infrastructure

[0.1.0-dev.1]: https://github.com/sowonlabs/crewx/compare/v0.1.0-dev.0...v0.1.0-dev.1
[0.1.0-dev.0]: https://github.com/sowonlabs/crewx/releases/tag/v0.1.0-dev.0
