# WBS-18 Phase 1: SDK Provider Injection Structure Design

> **Status**: ✅ Complete
> **Date**: 2025-10-20
> **Designer**: @crewx_claude_dev
> **Review**: Design phase only - no implementation

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Design Goals](#design-goals)
4. [Provider Injection Architecture](#provider-injection-architecture)
5. [Type System Design](#type-system-design)
6. [Integration Points](#integration-points)
7. [Backward Compatibility Strategy](#backward-compatibility-strategy)
8. [Risk Assessment](#risk-assessment)
9. [Phase 2 Implementation Guide](#phase-2-implementation-guide)

---

## Executive Summary

### Problem Statement

Currently, `AgentRuntime` in the SDK returns hardcoded mock responses instead of calling actual AI providers. This prevents the SDK from being a fully functional agent runtime that can be used standalone or integrated into the CLI.

**Key Issues**:
1. `AgentRuntime.query()` and `AgentRuntime.execute()` return mock strings
2. `createCrewxAgent()` accepts `ProviderConfig` but doesn't use it
3. Provider ecosystem exists in SDK (`BaseAIProvider`, `ClaudeProvider`, etc.) but isn't connected to `AgentRuntime`
4. CLI has its own provider management that can't be shared with SDK

### Solution Overview

Design a **flexible Provider injection system** that:
- Supports both `ProviderConfig` (configuration object) and `AIProvider` (instance) injection
- Uses `MockProvider` as default fallback for backward compatibility
- Integrates with WBS-17 SkillRuntime `ExecutionContext`
- Enables CLI to inject its existing providers into SDK AgentRuntime
- Maintains full backward compatibility with existing code

### Success Criteria

- [ ] Type-safe Provider injection in `AgentRuntimeOptions`
- [ ] `resolveProvider()` helper handles all provider types (config, instance, undefined)
- [ ] `MockProvider` provides sensible defaults for testing
- [ ] Integration points with SkillRuntime (WBS-17) defined
- [ ] Zero breaking changes to existing SDK consumers

---

## Current Architecture Analysis

### 1. AgentRuntime (WBS Current State)

**File**: `packages/sdk/src/core/agent/agent-runtime.ts`

**Current Behavior**:
```typescript
async query(request: AgentQueryRequest): Promise<AgentResult> {
  // ❌ Problem: Returns hardcoded string
  const result: AgentResult = {
    content: `Query executed: ${request.prompt}`,
    success: true,
    agentId,
    metadata: { /*...*/ },
  };
  return result;
}
```

**What's Good**:
- ✅ Event system (EventBus) works well
- ✅ Call stack tracking is solid
- ✅ Mention parsing (MentionParser) is integrated
- ✅ Overloaded signatures support both string and object inputs
- ✅ Logger abstraction allows custom logging

**What's Missing**:
- ❌ No `provider` field in `AgentRuntimeOptions`
- ❌ No actual Provider invocation
- ❌ No AIResponse → AgentResult conversion logic

### 2. Agent Factory (WBS Current State)

**File**: `packages/sdk/src/core/agent/agent-factory.ts`

**Current Behavior**:
```typescript
export interface CrewxAgentConfig {
  provider?: ProviderConfig;  // ✅ Type exists
  // ...
}

export async function createCrewxAgent(config: CrewxAgentConfig = {}): Promise<CrewxAgentResult> {
  const runtimeOptions: AgentRuntimeOptions = {
    eventBus,
    enableCallStack: config.enableCallStack ?? false,
    defaultAgentId: config.defaultAgentId ?? 'crewx',
    // ❌ Problem: config.provider is not passed to runtime
  };

  const runtime = new AgentRuntime(runtimeOptions);
  // ...
}
```

**What's Good**:
- ✅ `ProviderConfig` interface exists
- ✅ Factory pattern is clean
- ✅ Event subscription interface is well-designed

**What's Missing**:
- ❌ No `resolveProvider()` logic
- ❌ `config.provider` is accepted but ignored
- ❌ No fallback to `MockProvider`

### 3. Provider Ecosystem (Existing Assets)

**Available Provider Infrastructure**:

```
packages/sdk/src/core/providers/
├── ai-provider.interface.ts    # AIProvider interface
├── base-ai.provider.ts          # BaseAIProvider base class
├── claude.provider.ts           # ClaudeProvider (CLI)
├── gemini.provider.ts           # GeminiProvider (CLI)
├── copilot.provider.ts          # CopilotProvider (CLI)
├── codex.provider.ts            # CodexProvider (CLI)
└── dynamic-provider.factory.ts  # Plugin/Remote provider factory
```

**`AIProvider` Interface** (`ai-provider.interface.ts:46-51`):
```typescript
export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  getToolPath(): Promise<string | null>;
}
```

**`AIResponse` Structure** (`ai-provider.interface.ts:32-44`):
```typescript
export interface AIResponse {
  content: string;
  provider: string;
  command: string;
  success: boolean;
  error?: string;
  taskId?: string;
  toolCall?: { /*...*/ };
}
```

**What's Good**:
- ✅ Mature provider base class with CLI execution logic
- ✅ Built-in providers (Claude, Gemini, Copilot, Codex)
- ✅ Dynamic provider factory for plugin/remote providers
- ✅ Comprehensive `AIResponse` with error handling

**What's Needed**:
- ⚠️ `MockProvider` doesn't exist yet (need to create)
- ⚠️ No `createProviderFromConfig()` helper (need to create or use `dynamic-provider.factory`)

### 4. SkillRuntime Integration (WBS-17 Context)

**File**: `packages/sdk/src/types/skill-runtime.types.ts`

**`SkillExecutionContext` Structure** (lines 46-82):
```typescript
export interface SkillExecutionContext {
  // Skill identification
  skillName: string;
  skillVersion: string;

  // Execution environment
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;

  // Runtime requirements
  runtimeRequirements: {
    python?: string;
    node?: string;
    docker?: boolean;
    memory?: string;
    [key: string]: string | boolean | undefined;
  };

  // Skill configuration
  configuration: {
    metadata: SkillMetadata;
    content?: SkillContent;
    agentConfig: AgentDefinition;
  };

  // ...
}
```

**Integration Requirements**:
- ✅ AgentRuntime must provide `ExecutionContext` to skills
- ✅ SkillRuntime needs access to Provider for skill execution
- ⚠️ Need to define how `AgentRuntime` → `SkillRuntime` Provider handoff works

### 5. CLI Integration Points (Phase 4 Prep)

**CLI AIProviderService** (packages/cli/src/ai-provider.service.ts):
- CLI manages providers via NestJS DI
- `AIProviderService.getProvider(id)` returns `AIProvider` instances
- CLI providers already implement `AIProvider` interface

**CLI → SDK Bridge Requirements**:
- CLI must be able to inject its `AIProvider` instances into SDK
- Bridge service will extract CLI provider and pass to `createCrewxAgent()`
- No changes to CLI provider logic needed (already compatible)

---

## Design Goals

### Primary Goals

1. **Flexible Provider Injection**: Support multiple ways to provide an AI provider
   - `ProviderConfig` object → Factory creates provider
   - `AIProvider` instance → Direct injection
   - `undefined` → Fallback to MockProvider

2. **Backward Compatibility**: Zero breaking changes
   - Existing code calling `new AgentRuntime()` must continue working
   - Existing tests must pass without modification
   - `ParallelRunner` and other SDK components remain unaffected

3. **Type Safety**: Compile-time guarantees
   - `provider` field correctly typed in all interfaces
   - Proper overloads for different injection patterns
   - No `any` types in public APIs

4. **Testability**: Easy mocking for tests
   - `MockProvider` can be customized per test
   - Direct injection allows full control in tests
   - Spy/stub patterns supported

5. **CLI Integration Ready**: Enable Phase 4 CLI integration
   - CLI can inject its existing providers
   - No duplication of provider logic
   - Shared interfaces between CLI and SDK

### Secondary Goals

1. **Future-Proof**: Support upcoming features
   - Multi-provider agents (different skills use different providers)
   - Provider switching at runtime
   - Provider pooling for parallel execution

2. **Developer Experience**: Clear and intuitive API
   - Minimal configuration required
   - Sensible defaults
   - Clear error messages

3. **Performance**: Efficient provider usage
   - Lazy provider initialization
   - Provider instance reuse
   - Minimal overhead in hot paths

---

## Provider Injection Architecture

### Design Philosophy

**Principle**: "Progressive Enhancement with Safe Defaults"

- **Default**: MockProvider (no configuration needed, instant testing)
- **Simple**: ProviderConfig (configuration object, factory handles creation)
- **Advanced**: AIProvider instance (full control, custom implementations)

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   createCrewxAgent(config)                   │
│                                                              │
│  1. resolveProvider(config.provider)                        │
│     ├─ undefined → new MockProvider()                       │
│     ├─ AIProvider instance → return as-is                   │
│     └─ ProviderConfig → createProviderFromConfig()          │
│                                                              │
│  2. new AgentRuntime({ provider, ... })                     │
│     └─ Store provider in runtime                            │
│                                                              │
│  3. return { agent, onEvent, eventBus }                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AgentRuntime                            │
│                                                              │
│  - constructor(options: AgentRuntimeOptions)                │
│    • provider: AIProvider (default: MockProvider)           │
│    • eventBus: EventBus                                     │
│    • enableCallStack: boolean                               │
│                                                              │
│  - async query(request)                                     │
│    1. Emit 'agentStarted' event                             │
│    2. Call this.provider.query(prompt, options)             │
│    3. Convert AIResponse → AgentResult                      │
│    4. Emit 'agentCompleted' event                           │
│    5. Return AgentResult                                    │
│                                                              │
│  - async execute(request)                                   │
│    [Same flow as query, but execute mode]                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AIProvider                              │
│                                                              │
│  interface AIProvider {                                     │
│    readonly name: string;                                   │
│    isAvailable(): Promise<boolean>;                         │
│    query(prompt, options?): Promise<AIResponse>;            │
│    getToolPath(): Promise<string | null>;                   │
│  }                                                           │
│                                                              │
│  Implementations:                                            │
│  ├─ MockProvider (testing, default)                         │
│  ├─ ClaudeProvider (CLI tool)                               │
│  ├─ GeminiProvider (CLI tool)                               │
│  ├─ CopilotProvider (CLI tool)                              │
│  ├─ CodexProvider (CLI tool)                                │
│  └─ DynamicAIProvider (plugin/remote)                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
User Code
    │
    │ createCrewxAgent({ provider: { namespace: 'cli', id: 'claude' } })
    ▼
┌────────────────────────────────────────────────────────────┐
│ Agent Factory (agent-factory.ts)                          │
│                                                            │
│ 1. resolveProvider(config.provider)                       │
│    ├─ Check: undefined?          → new MockProvider()     │
│    ├─ Check: has query() method? → return as AIProvider   │
│    └─ Check: is ProviderConfig?  → createProviderFromConfig()│
│                                                            │
│ 2. Create AgentRuntime with resolved provider             │
│ 3. Return { agent, onEvent, eventBus }                    │
└────────────────────────────────────────────────────────────┘
    │
    │ { agent, onEvent }
    ▼
User Code
    │
    │ agent.query("@backend analyze code")
    ▼
┌────────────────────────────────────────────────────────────┐
│ AgentRuntime.query()                                       │
│                                                            │
│ 1. Parse mention (MentionParser)                          │
│ 2. Emit 'agentStarted' event                              │
│ 3. Call this.provider.query(prompt, {                     │
│      workingDirectory: context,                            │
│      messages: messages,                                   │
│      agentId: agentId,                                     │
│      model: model                                          │
│    })                                                      │
│ 4. Receive AIResponse                                     │
│ 5. Convert to AgentResult                                 │
│ 6. Emit 'agentCompleted' with success status              │
│ 7. Return AgentResult                                     │
└────────────────────────────────────────────────────────────┘
    │
    │ AIResponse
    ▼
┌────────────────────────────────────────────────────────────┐
│ Provider (e.g., ClaudeProvider)                            │
│                                                            │
│ 1. Build CLI command with args                            │
│ 2. spawn('claude', ['-p', prompt])                        │
│ 3. Capture stdout/stderr                                  │
│ 4. Parse response                                          │
│ 5. Return AIResponse {                                    │
│      content: "Analysis result...",                        │
│      provider: "cli/claude",                               │
│      command: "claude -p ...",                             │
│      success: true                                         │
│    }                                                       │
└────────────────────────────────────────────────────────────┘
```

---

## Type System Design

### 1. Enhanced `AgentRuntimeOptions`

**File**: `packages/sdk/src/core/agent/agent-runtime.ts`

```typescript
import type { AIProvider } from '../providers/ai-provider.interface';

export interface AgentRuntimeOptions {
  // ✅ NEW: Provider injection (optional with fallback)
  provider?: AIProvider;

  // Existing fields
  eventBus?: EventBus;
  enableCallStack?: boolean;
  defaultAgentId?: string;
  logger?: LoggerLike;
  validAgents?: string[];
}
```

**Design Decisions**:
- `provider` is **optional** → defaults to `MockProvider`
- Type is `AIProvider` (interface, not concrete class) → supports any implementation
- No `ProviderConfig` here → factory handles conversion

### 2. Extended `CrewxAgentConfig`

**File**: `packages/sdk/src/core/agent/agent-factory.ts`

```typescript
import type { AIProvider } from '../providers/ai-provider.interface';

// Existing interface (unchanged)
export interface ProviderConfig {
  namespace: string;
  id: string;
  apiKey?: string;
  model?: string;
}

// ✅ UPDATED: Accept both ProviderConfig and AIProvider
export interface CrewxAgentConfig {
  // Flexible provider injection
  provider?: ProviderConfig | AIProvider;

  // Existing fields (unchanged)
  knowledgeBase?: KnowledgeBaseConfig;
  enableCallStack?: boolean;
  defaultAgentId?: string;
  validAgents?: string[];
}
```

**Design Decisions**:
- Union type `ProviderConfig | AIProvider` → maximum flexibility
- Discriminate at runtime using duck typing (`'query' in obj`)
- Backward compatible (existing code passes `ProviderConfig`)

### 3. `resolveProvider()` Helper Function

**File**: `packages/sdk/src/core/agent/agent-factory.ts`

```typescript
import { MockProvider } from '../providers/mock.provider';
import { createProviderFromConfig } from '../providers/provider-factory';
import type { AIProvider } from '../providers/ai-provider.interface';

/**
 * Resolve provider configuration to AIProvider instance.
 *
 * ⭐ Codex Review: Provider optional with MockProvider fallback
 *
 * @param config - Provider configuration (ProviderConfig | AIProvider | undefined)
 * @returns AIProvider instance
 *
 * @example
 * // No provider → MockProvider
 * const provider = await resolveProvider();
 *
 * @example
 * // AIProvider instance → pass through
 * const mockProvider = new MockProvider();
 * const provider = await resolveProvider(mockProvider);
 *
 * @example
 * // ProviderConfig → create from config
 * const provider = await resolveProvider({
 *   namespace: 'cli',
 *   id: 'claude',
 *   apiKey: process.env.CLAUDE_KEY
 * });
 */
async function resolveProvider(
  config?: ProviderConfig | AIProvider
): Promise<AIProvider> {
  // Case 1: No provider specified → default MockProvider
  if (!config) {
    return new MockProvider();
  }

  // Case 2: Already an AIProvider instance → return as-is
  // Duck typing check: has query() method?
  if ('query' in config && typeof config.query === 'function') {
    return config as AIProvider;
  }

  // Case 3: ProviderConfig → create provider instance
  return await createProviderFromConfig(config as ProviderConfig);
}
```

**Design Decisions**:
- **Async function** → allows async provider initialization
- **Duck typing** for AIProvider detection → robust and flexible
- **Fallback to MockProvider** → zero-config default
- **Type guards** → TypeScript knows which branch we're in

### 4. `createProviderFromConfig()` Factory

**File**: `packages/sdk/src/core/providers/provider-factory.ts` (NEW)

```typescript
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { CopilotProvider } from './copilot.provider';
import { CodexProvider } from './codex.provider';
import { BaseDynamicProviderFactory, type DynamicProviderConfig } from './dynamic-provider.factory';
import type { AIProvider } from './ai-provider.interface';
import type { ProviderConfig } from '../agent/agent-factory';

/**
 * Create AIProvider instance from ProviderConfig.
 *
 * Supports:
 * - Built-in providers (cli/claude, cli/gemini, etc.)
 * - Plugin providers (plugin/*)
 * - Remote providers (remote/*)
 *
 * @param config - Provider configuration
 * @returns AIProvider instance
 * @throws Error if provider namespace/id is unknown
 *
 * @example
 * // Built-in provider
 * const claude = await createProviderFromConfig({
 *   namespace: 'cli',
 *   id: 'claude'
 * });
 *
 * @example
 * // Dynamic provider
 * const custom = await createProviderFromConfig({
 *   namespace: 'plugin',
 *   id: 'custom-ai',
 *   model: 'gpt-4'
 * });
 */
export async function createProviderFromConfig(
  config: ProviderConfig
): Promise<AIProvider> {
  const fullId = `${config.namespace}/${config.id}`;

  // Built-in providers
  switch (fullId) {
    case 'cli/claude':
      return new ClaudeProvider();
    case 'cli/gemini':
      return new GeminiProvider();
    case 'cli/copilot':
      return new CopilotProvider();
    case 'cli/codex':
      return new CodexProvider();
  }

  // Plugin/Remote providers → use dynamic factory
  if (config.namespace === 'plugin' || config.namespace === 'remote') {
    // TODO: Need to load full DynamicProviderConfig from registry
    // For now, throw error (implement in Phase 2)
    throw new Error(
      `Dynamic provider '${fullId}' not yet supported. ` +
      `Please use AIProvider instance directly or use built-in providers.`
    );
  }

  throw new Error(
    `Unknown provider: ${fullId}. ` +
    `Available: cli/claude, cli/gemini, cli/copilot, cli/codex`
  );
}
```

**Design Decisions**:
- **Factory pattern** → centralized provider creation
- **Switch statement** for built-in providers → fast and clear
- **Error handling** → clear messages for unknown providers
- **Plugin/Remote TODO** → Phase 2 enhancement (not blocking Phase 1)

### 5. `MockProvider` Implementation

**File**: `packages/sdk/src/core/providers/mock.provider.ts` (NEW)

```typescript
import type { AIProvider, AIQueryOptions, AIResponse } from './ai-provider.interface';

/**
 * Mock AI Provider for testing and development.
 *
 * Features:
 * - Configurable responses per prompt
 * - Default fallback response
 * - Instant responses (no network calls)
 * - Full AIProvider interface compliance
 *
 * @example
 * // Basic usage
 * const mock = new MockProvider();
 * const response = await mock.query('hello');
 * // response.content: "Mock response for: hello"
 *
 * @example
 * // Custom responses
 * const mock = new MockProvider();
 * mock.setResponse('analyze', {
 *   content: 'Analysis: Code looks good',
 *   success: true
 * });
 * const response = await mock.query('analyze');
 * // response.content: "Analysis: Code looks good"
 *
 * @example
 * // Custom default
 * const mock = new MockProvider();
 * mock.setDefaultResponse({
 *   content: 'Custom default response',
 *   success: true
 * });
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';

  private responses: Map<string, AIResponse> = new Map();
  private defaultResponse: AIResponse = {
    content: 'Mock response',
    provider: 'mock',
    command: 'mock-command',
    success: true,
  };

  /**
   * Set custom response for specific prompt.
   *
   * @param prompt - Prompt to match
   * @param response - Response to return (partial, merged with defaults)
   */
  setResponse(prompt: string, response: Partial<AIResponse>): void {
    this.responses.set(prompt, {
      ...this.defaultResponse,
      ...response,
    });
  }

  /**
   * Set default response for all prompts.
   *
   * @param response - Default response (partial, merged with built-in defaults)
   */
  setDefaultResponse(response: Partial<AIResponse>): void {
    this.defaultResponse = {
      ...this.defaultResponse,
      ...response,
    };
  }

  /**
   * Clear all custom responses (reset to default).
   */
  clearResponses(): void {
    this.responses.clear();
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
    // Check for custom response
    const customResponse = this.responses.get(prompt);
    if (customResponse) {
      return {
        ...customResponse,
        taskId: options?.taskId,
      };
    }

    // Return default response with prompt echo
    return {
      ...this.defaultResponse,
      content: `Mock response for: ${prompt}`,
      taskId: options?.taskId,
    };
  }

  async getToolPath(): Promise<string | null> {
    return '/mock/path/to/tool';
  }
}
```

**Design Decisions**:
- **Simple API** → easy to use in tests
- **Configurable** → can simulate different scenarios
- **Instant responses** → no async delays
- **Map-based lookups** → O(1) performance

---

## Integration Points

### 1. WBS-17 SkillRuntime Integration

**Requirement**: AgentRuntime must provide ExecutionContext to SkillRuntime

**Design**:

```typescript
// In packages/sdk/src/core/agent/agent-runtime.ts

import type { SkillExecutionContext } from '../../types/skill-runtime.types';
import type { ISkillRuntime } from '../../types/skill-runtime.types';

export class AgentRuntime {
  private provider: AIProvider;
  private skillRuntime?: ISkillRuntime; // Optional skill runtime

  constructor(options: AgentRuntimeOptions = {}) {
    this.provider = options.provider ?? new MockProvider();
    // ... other initialization
  }

  /**
   * Set SkillRuntime for skill execution support.
   * (Optional feature, not required for basic agent functionality)
   */
  setSkillRuntime(skillRuntime: ISkillRuntime): void {
    this.skillRuntime = skillRuntime;
  }

  /**
   * Build ExecutionContext for skill execution.
   * Provides provider and environment info to skills.
   */
  private buildExecutionContext(
    skillName: string,
    agentConfig: any, // AgentDefinition from WBS-16
    options: Partial<SkillExecutionContext>
  ): SkillExecutionContext {
    return {
      skillName,
      skillVersion: options.skillVersion ?? '1.0.0',
      workingDirectory: options.workingDirectory ?? process.cwd(),
      environment: options.environment ?? {},
      timeout: options.timeout ?? 600000,
      runtimeRequirements: options.runtimeRequirements ?? {},
      configuration: {
        metadata: options.configuration?.metadata ?? {},
        content: options.configuration?.content,
        agentConfig,
      },
      options: {
        validationMode: 'lenient',
        progressiveLoading: true,
        cacheEnabled: true,
      },
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
    };
  }

  /**
   * Execute skill with provider context.
   * (Future enhancement, not in Phase 1)
   */
  async executeSkill(skillName: string, input: string, agentConfig: any): Promise<any> {
    if (!this.skillRuntime) {
      throw new Error('SkillRuntime not initialized. Call setSkillRuntime() first.');
    }

    // Build execution context
    const context = this.buildExecutionContext(skillName, agentConfig, {
      workingDirectory: process.cwd(),
    });

    // Execute skill
    return await this.skillRuntime.executeSkill(context, input);
  }
}
```

**Integration Flow**:

```
User Code
    │
    │ const { agent } = await createCrewxAgent({ provider: claudeProvider })
    │ agent.setSkillRuntime(skillRuntime)
    ▼
AgentRuntime
    │
    │ executeSkill(skillName, input, agentConfig)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ buildExecutionContext()                                      │
│ - Use this.provider.name for context.configuration          │
│ - Pass workingDirectory, environment, timeout               │
│ - Generate executionId                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
SkillRuntime.executeSkill(context, input)
    │
    │ Skill needs to call AI?
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Skill accesses provider via context.configuration           │
│ - Skill can call provider.query() if needed                 │
│ - Provider instance shared between AgentRuntime and Skills  │
└─────────────────────────────────────────────────────────────┘
```

**Note**: Full SkillRuntime integration is a Phase 3+ feature. Phase 1 only needs to ensure the architecture supports it.

### 2. WBS-16 Skills Parser Integration

**Requirement**: AgentRuntime must support skills defined via Skills Parser

**Design**: Skills Parser provides `AgentDefinition` → passed to `executeSkill()`

```typescript
// In packages/sdk/src/core/agent/agent-factory.ts

import { parseCrewxConfig, type AgentDefinition } from '../../schema/skills-parser';

export interface CrewxAgentConfigWithSkills extends CrewxAgentConfig {
  // Path to crewx.yaml or YAML string
  configPath?: string;
  configYaml?: string;

  // Or pre-parsed agent definitions
  agents?: AgentDefinition[];
}

export async function createCrewxAgent(
  config: CrewxAgentConfigWithSkills = {}
): Promise<CrewxAgentResult> {
  // ... existing provider resolution ...

  // Load agent definitions if config provided
  let agentDefinitions: AgentDefinition[] = [];
  if (config.configPath) {
    const { agents } = await parseCrewxConfig(config.configPath);
    agentDefinitions = agents;
  } else if (config.configYaml) {
    const { agents } = await parseCrewxConfig(config.configYaml, { fromString: true });
    agentDefinitions = agents;
  } else if (config.agents) {
    agentDefinitions = config.agents;
  }

  // Pass agent definitions to runtime (future use)
  const runtimeOptions: AgentRuntimeOptions = {
    provider,
    eventBus,
    enableCallStack: config.enableCallStack ?? false,
    defaultAgentId: config.defaultAgentId ?? 'crewx',
    validAgents: config.validAgents ?? agentDefinitions.map(a => a.id),
  };

  const runtime = new AgentRuntime(runtimeOptions);

  // Store agent definitions for skill execution
  // (Implementation detail for Phase 3+)

  // ... return agent interface ...
}
```

**Note**: This is forward-looking design. Phase 1 doesn't need full implementation.

### 3. CLI Provider Bridge (Phase 4 Prep)

**Requirement**: CLI must inject its existing providers into SDK

**CLI Architecture**:

```typescript
// In packages/cli/src/services/provider-bridge.service.ts (Phase 4)

import { Injectable } from '@nestjs/common';
import { AIProviderService } from '../ai-provider.service';
import type { AIProvider } from '@sowonai/crewx-sdk';

@Injectable()
export class ProviderBridgeService {
  constructor(private readonly aiProviderService: AIProviderService) {}

  /**
   * Get CLI provider for SDK use.
   * CLI providers already implement AIProvider interface.
   */
  getProviderForSDK(providerId: string): AIProvider {
    const provider = this.aiProviderService.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    // CLI providers are already AIProvider-compatible!
    return provider;
  }
}
```

**Usage in CLI**:

```typescript
// In packages/cli/src/services/agent-runtime.service.ts (Phase 4)

import { Injectable } from '@nestjs/common';
import { createCrewxAgent, type CrewxAgent } from '@sowonai/crewx-sdk';
import { ProviderBridgeService } from './provider-bridge.service';

@Injectable()
export class AgentRuntimeService {
  constructor(
    private readonly providerBridge: ProviderBridgeService
  ) {}

  async initializeRuntime() {
    // Get CLI's actual provider
    const claudeProvider = this.providerBridge.getProviderForSDK('claude');

    // Create SDK agent with CLI provider
    const { agent } = await createCrewxAgent({
      provider: claudeProvider, // ✅ Direct instance injection!
      enableCallStack: true,
    });

    this.agent = agent;
  }
}
```

**Key Insight**: No adapter needed! CLI providers already implement `AIProvider`.

---

## Backward Compatibility Strategy

### 1. No Breaking Changes

**Principle**: All existing code must continue working without modification.

**Affected Code**:

1. **Direct AgentRuntime instantiation**:
   ```typescript
   // Before (still works):
   const runtime = new AgentRuntime();
   // Behavior: Uses MockProvider automatically
   ```

2. **ParallelRunner** (packages/sdk/src/core/parallel/helpers.ts:310):
   ```typescript
   // Before (currently broken if provider is required):
   const runtime = new AgentRuntime();
   // After Phase 1: Works! Defaults to MockProvider
   ```

3. **Existing tests**:
   ```typescript
   // Before (still works):
   const { agent } = await createCrewxAgent();
   const result = await agent.query({ prompt: 'test' });
   // After Phase 1: Returns mock response (same as before)
   ```

### 2. Migration Path for New Features

**Users who want real providers can opt-in**:

```typescript
// Old way (mock responses):
const { agent } = await createCrewxAgent();

// New way (real responses):
const { agent } = await createCrewxAgent({
  provider: { namespace: 'cli', id: 'claude' }
});
```

**No forced migration**: Old code continues working.

### 3. Deprecation Strategy (Future)

If we ever want to make provider required, we can:

1. Add warnings when MockProvider is used
2. Update documentation to recommend explicit providers
3. After multiple versions, deprecate default MockProvider

**For Phase 1**: No deprecations, full backward compatibility.

---

## Risk Assessment

### High Risks (🔴)

**None identified**. Design is conservative and backward compatible.

### Medium Risks (🟡)

1. **Plugin/Remote Provider Support Not Implemented**
   - **Risk**: `createProviderFromConfig()` throws error for plugin/remote providers
   - **Mitigation**: Users can pass AIProvider instance directly (workaround exists)
   - **Resolution**: Implement in Phase 2 using `dynamic-provider.factory`

2. **AIResponse → AgentResult Conversion Logic**
   - **Risk**: Mismatch between AIResponse fields and AgentResult expectations
   - **Mitigation**: Comprehensive mapping in Phase 2 implementation
   - **Resolution**: Test with all provider types (Claude, Gemini, Copilot, Codex)

3. **Provider Availability Checks**
   - **Risk**: AgentRuntime accepts unavailable providers, fails at query time
   - **Mitigation**: Add `await provider.isAvailable()` check in `resolveProvider()`
   - **Resolution**: Document requirement, provide clear error messages

### Low Risks (🟢)

1. **MockProvider Behavior Differences**
   - **Risk**: MockProvider doesn't perfectly simulate real provider edge cases
   - **Impact**: Tests might pass with MockProvider but fail with real providers
   - **Mitigation**: Document MockProvider limitations, recommend integration tests

2. **Type Inference in resolveProvider**
   - **Risk**: TypeScript might not infer types correctly in edge cases
   - **Impact**: Possible type errors at compile time
   - **Mitigation**: Explicit type annotations, comprehensive type tests

---

## Phase 2 Implementation Guide

### Implementation Checklist

**Phase 2.1: Core Provider Integration** (2-3 hours)

- [ ] Create `MockProvider` class
  - [ ] Implement all `AIProvider` methods
  - [ ] Add `setResponse()` and `setDefaultResponse()` helpers
  - [ ] Write 5+ unit tests

- [ ] Create `provider-factory.ts`
  - [ ] Implement `createProviderFromConfig()`
  - [ ] Support built-in providers (claude, gemini, copilot, codex)
  - [ ] Error handling for unknown providers
  - [ ] Write 8+ unit tests

- [ ] Update `agent-factory.ts`
  - [ ] Add `resolveProvider()` helper
  - [ ] Update `createCrewxAgent()` to use `resolveProvider()`
  - [ ] Pass provider to `AgentRuntime` constructor
  - [ ] Write 10+ unit tests

- [ ] Update `agent-runtime.ts`
  - [ ] Add `provider` field to `AgentRuntimeOptions`
  - [ ] Default to `MockProvider` in constructor
  - [ ] Update `query()` to call `this.provider.query()`
  - [ ] Update `execute()` to call `this.provider.execute()`
  - [ ] Implement AIResponse → AgentResult conversion
  - [ ] Update event emission to use actual provider success status
  - [ ] Write 15+ unit tests

**Phase 2.2: Integration Testing** (1-2 hours)

- [ ] Write integration tests for all built-in providers
- [ ] Test provider fallback logic
- [ ] Test error handling
- [ ] Verify backward compatibility (run existing tests)
- [ ] Performance testing (provider overhead)

**Phase 2.3: Documentation** (1 hour)

- [ ] Update API documentation
- [ ] Add usage examples
- [ ] Document MockProvider API
- [ ] Update CREWX.md files

### AIResponse → AgentResult Conversion

**Implementation**:

```typescript
// In packages/sdk/src/core/agent/agent-runtime.ts

private convertAIResponse(
  aiResponse: AIResponse,
  agentId: string,
  context?: string,
  messageCount?: number
): AgentResult {
  return {
    content: aiResponse.content,
    success: aiResponse.success,
    agentId,
    metadata: {
      provider: aiResponse.provider,
      command: aiResponse.command,
      taskId: aiResponse.taskId,
      error: aiResponse.error,
      toolCall: aiResponse.toolCall,
      context,
      messageCount,
    },
  };
}
```

### Provider Availability Check

**Implementation**:

```typescript
// In packages/sdk/src/core/agent/agent-factory.ts

async function resolveProvider(
  config?: ProviderConfig | AIProvider
): Promise<AIProvider> {
  // ... existing logic ...

  const provider = /* resolved provider */;

  // Check availability (optional but recommended)
  const available = await provider.isAvailable();
  if (!available) {
    console.warn(
      `Warning: Provider '${provider.name}' is not available. ` +
      `Queries will fail until the provider is installed.`
    );
  }

  return provider;
}
```

### CallStack Provider Name

**Update**:

```typescript
// In packages/sdk/src/core/agent/agent-runtime.ts

if (this.enableCallStack) {
  const frame: CallStackFrame = {
    depth: this.callStack.length,
    agentId,
    provider: this.provider.name, // ✅ Use actual provider name
    mode: 'query',
    enteredAt: new Date().toISOString(),
  };
  this.callStack.push(frame);
}
```

---

## Design Validation Test Outline

### Unit Tests

**MockProvider Tests** (`mock.provider.spec.ts`):
- ✅ Default response returns mock content
- ✅ Custom response overrides default
- ✅ setDefaultResponse affects all prompts
- ✅ clearResponses resets to defaults
- ✅ isAvailable always returns true
- ✅ Implements AIProvider interface

**Provider Factory Tests** (`provider-factory.spec.ts`):
- ✅ createProviderFromConfig returns ClaudeProvider for cli/claude
- ✅ createProviderFromConfig returns GeminiProvider for cli/gemini
- ✅ createProviderFromConfig returns CopilotProvider for cli/copilot
- ✅ createProviderFromConfig returns CodexProvider for cli/codex
- ✅ createProviderFromConfig throws for unknown provider
- ✅ createProviderFromConfig throws for plugin/remote (not implemented)

**resolveProvider Tests** (`agent-factory.spec.ts`):
- ✅ resolveProvider returns MockProvider when config is undefined
- ✅ resolveProvider returns AIProvider instance when passed directly
- ✅ resolveProvider calls createProviderFromConfig for ProviderConfig
- ✅ resolveProvider duck types AIProvider correctly
- ✅ resolveProvider handles async provider creation

**AgentRuntime Tests** (`agent-runtime.spec.ts`):
- ✅ AgentRuntime uses MockProvider by default
- ✅ AgentRuntime accepts custom provider
- ✅ AgentRuntime.query calls provider.query
- ✅ AgentRuntime.execute calls provider.execute
- ✅ AgentRuntime converts AIResponse to AgentResult
- ✅ AgentRuntime emits events with provider success status
- ✅ AgentRuntime includes provider name in call stack
- ✅ AgentRuntime handles provider errors gracefully

**Agent Factory Tests** (`agent-factory.spec.ts`):
- ✅ createCrewxAgent works without provider (MockProvider)
- ✅ createCrewxAgent accepts AIProvider instance
- ✅ createCrewxAgent accepts ProviderConfig
- ✅ createCrewxAgent passes provider to AgentRuntime
- ✅ createCrewxAgent validates provider availability (optional)

### Integration Tests

**Provider Integration Tests** (`agent-provider.integration.spec.ts`):
- ✅ Agent with ClaudeProvider executes real query (if available)
- ✅ Agent with GeminiProvider executes real query (if available)
- ✅ Agent with MockProvider returns custom responses
- ✅ Agent handles provider unavailability gracefully
- ✅ Agent converts AIResponse fields correctly for all providers

### Backward Compatibility Tests

**Regression Tests** (`backward-compatibility.spec.ts`):
- ✅ new AgentRuntime() works without provider
- ✅ ParallelRunner works without provider
- ✅ Existing agent tests pass unchanged
- ✅ Event emission still works
- ✅ Call stack tracking still works

### Edge Case Tests

**Error Handling Tests** (`error-handling.spec.ts`):
- ✅ Provider query fails → AgentResult has success:false
- ✅ Provider not available → warning logged
- ✅ Invalid ProviderConfig → clear error message
- ✅ Provider throws exception → caught and wrapped in AgentResult

---

## Summary

### Key Design Decisions

1. **Provider is Optional**: Defaults to `MockProvider` for backward compatibility
2. **Flexible Injection**: Supports `ProviderConfig`, `AIProvider` instance, or `undefined`
3. **Factory Pattern**: `resolveProvider()` and `createProviderFromConfig()` centralize logic
4. **Type-Safe**: Union types and duck typing provide compile-time and runtime safety
5. **CLI-Ready**: Direct AIProvider injection enables Phase 4 CLI integration
6. **Future-Proof**: Architecture supports WBS-17 SkillRuntime and WBS-16 Skills Parser

### Phase 1 Deliverables

- ✅ **Design Document** (this file)
- ✅ **Type Definitions**: Updated interfaces, new types
- ✅ **Architecture Diagrams**: Component, data flow, integration points
- ✅ **Test Outline**: 40+ test cases defined
- ✅ **Implementation Guide**: Clear roadmap for Phase 2

### Next Steps

1. **Review Design**: Team review and approval
2. **Phase 2 Implementation**: Implement provider integration (2-3 hours)
3. **Phase 3 Testing**: Comprehensive test coverage (1-2 hours)
4. **Phase 4 CLI Integration**: CLI provider bridge (2-3 hours)
5. **Phase 5 CLI Migration**: Migrate CLI commands to SDK (3-4 hours)

---

**Design Sign-Off**:

- Designer: @crewx_claude_dev
- Date: 2025-10-20
- Status: ✅ Ready for Phase 2 Implementation
