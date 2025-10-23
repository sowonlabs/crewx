# WBS-9 Phase 3: Remote Agent Manager Migration Guide

## Overview

Phase 3 successfully extracted remote agent management logic from CLI to SDK, enabling reuse across different platforms and applications.

## What Changed

### New SDK Components

#### 1. SDK Remote Module (`packages/sdk/src/core/remote/`)

**Files Created:**
- `types.ts` - Type definitions for remote agent configuration and communication
- `remote-transport.ts` - HTTP transport abstraction (FetchRemoteTransport, MockRemoteTransport)
- `remote-agent-manager.ts` - Core remote agent management logic
- `index.ts` - Module exports

**Key Features:**
- Pure TypeScript implementation (no NestJS dependencies)
- Testable with mock transport
- Pluggable logger interface
- MCP JSON-RPC 2.0 protocol support
- Response normalization
- URL processing and tool name mapping

#### 2. CLI Adapter (`packages/cli/src/`)

**Files Modified:**
- `services/remote-agent.service.ts` - Refactored to use SDK RemoteAgentManager
- `providers/logger.adapter.ts` - Logger adapter for SDK compatibility

### Architecture Changes

**Before (WBS-8):**
```
CLI RemoteAgentService
├── Direct MCP HTTP calls
├── Config loading from YAML
├── Response normalization
└── NestJS Logger
```

**After (WBS-9 Phase 3):**
```
CLI RemoteAgentService (NestJS wrapper)
├── SDK RemoteAgentManager (core logic)
│   ├── RemoteTransport (HTTP abstraction)
│   ├── Config management
│   └── Response normalization
└── CLI-specific adapters
    ├── Logger adapter
    ├── Config loading
    └── AgentLoader integration
```

## SDK API Reference

### RemoteAgentManager

Main class for managing remote MCP agents.

```typescript
import { RemoteAgentManager, RemoteAgentConfig } from '@sowonai/crewx-sdk';

// Create manager
const manager = new RemoteAgentManager({
  logger: (message, level) => console.log(`[${level}] ${message}`),
});

// Load configuration
const config: RemoteAgentConfig = {
  type: 'mcp-http',
  url: 'https://example.com/mcp',
  apiKey: 'your-api-key',
  timeoutMs: 30000,
};

manager.loadConfig('my-agent', config);

// Query agent
const response = await manager.query('my-agent', {
  agentId: 'my-agent',
  query: 'What is the weather?',
  context: 'Optional context',
  model: 'gpt-4',
  messages: [
    { text: 'Hello', isAssistant: false },
    { text: 'Hi there!', isAssistant: true },
  ],
});

// Execute task
const result = await manager.execute('my-agent', {
  agentId: 'my-agent',
  task: 'Create a new feature',
  context: 'Project context',
});
```

### RemoteTransport

HTTP transport abstraction for testing and customization.

```typescript
import {
  FetchRemoteTransport,
  MockRemoteTransport,
  RemoteAgentManager
} from '@sowonai/crewx-sdk';

// Production: Use fetch API
const transport = new FetchRemoteTransport();
const manager = new RemoteAgentManager({ transport });

// Testing: Use mock transport
const mockTransport = new MockRemoteTransport();
mockTransport.setMockResponse('https://example.com/mcp', {
  jsonrpc: '2.0',
  id: 'test',
  result: {
    content: [{ type: 'text', text: 'Mock response' }],
  },
});

const testManager = new RemoteAgentManager({ transport: mockTransport });
```

### Types

```typescript
import type {
  RemoteAgentConfig,
  RemoteAgentQueryRequest,
  RemoteAgentExecuteRequest,
  RemoteAgentResponse,
  RemoteTransport,
  ToolNameMapping,
} from '@sowonai/crewx-sdk';
```

## Migration Path

### For SDK Users

If you want to use remote agent functionality in your own application:

```typescript
import { RemoteAgentManager } from '@sowonai/crewx-sdk';

// 1. Create manager with your logger
const manager = new RemoteAgentManager({
  logger: yourLogger,
});

// 2. Load agent configurations
manager.loadConfig('agent-1', {
  type: 'mcp-http',
  url: 'https://api.example.com',
  apiKey: process.env.API_KEY,
});

// 3. Use the manager
const response = await manager.query('agent-1', {
  agentId: 'agent-1',
  query: 'Hello',
});
```

### For CLI Maintainers

The CLI RemoteAgentService now wraps SDK RemoteAgentManager:

```typescript
// CLI Service (NestJS)
@Injectable()
export class RemoteAgentService {
  private readonly manager: RemoteAgentManager;

  constructor(
    private readonly agentLoaderService: AgentLoaderService,
    private readonly configService: ConfigService,
  ) {
    // Create SDK manager with CLI logger
    this.manager = new RemoteAgentManager({
      logger: createSdkLoggerAdapter(this.logger),
    });
  }

  // CLI methods delegate to SDK manager
  async queryRemoteAgent(agent: AgentInfo, params) {
    const sdkConfig = this.convertToSdkConfig(agent.remote);
    if (!this.manager.isRemoteAgent(agent.id)) {
      this.manager.loadConfig(agent.id, sdkConfig);
    }
    return await this.manager.query(agent.id, {
      agentId: agent.remote.agentId ?? agent.id,
      ...params,
    });
  }
}
```

## Testing

### SDK Tests

The SDK includes comprehensive tests for RemoteAgentManager:

```bash
# Run SDK tests
npm run test:unit --workspace @sowonai/crewx-sdk -- remote-agent-manager

# Results: 30 tests passed
# - Configuration management
# - URL normalization
# - Query/Execute operations
# - Response normalization
# - Tool name mapping
# - Error handling
# - Logging
# - Custom headers and auth
# - Timeout configuration
```

### Test Coverage

- Configuration loading and validation
- Query and execute operations
- Response normalization (various formats)
- URL processing (trailing slashes, /mcp suffix)
- Tool name mapping
- Error handling (MCP errors, transport errors)
- Logging integration
- Custom headers and authentication
- Timeout handling

## Benefits

### For SDK

1. **Reusability**: Remote agent logic can be used in any TypeScript application
2. **Testability**: MockRemoteTransport enables easy unit testing
3. **No Dependencies**: Pure TypeScript, no framework lock-in
4. **Type Safety**: Full TypeScript type definitions
5. **Extensibility**: Pluggable transport and logger

### For CLI

1. **Simplified Service**: CLI service focuses on NestJS integration
2. **Better Separation**: Business logic (SDK) vs. framework code (CLI)
3. **Easier Testing**: Can test SDK logic independently
4. **Maintainability**: Changes to remote logic happen in one place

## Files Modified

### SDK (`packages/sdk/`)
- `src/core/remote/types.ts` (new)
- `src/core/remote/remote-transport.ts` (new)
- `src/core/remote/remote-agent-manager.ts` (new)
- `src/core/remote/index.ts` (new)
- `src/index.ts` (updated exports)
- `tests/unit/core/remote/remote-agent-manager.test.ts` (new)

### CLI (`packages/cli/`)
- `src/services/remote-agent.service.ts` (refactored)
- `src/providers/logger.adapter.ts` (updated)
- `src/cli/mcp.handler.ts` (import fix)

## Breaking Changes

**None.** The CLI RemoteAgentService maintains backward compatibility. All existing functionality continues to work.

## Next Steps

**Phase 4: Parallel Execution Runner**
- Extract ParallelProcessingService logic to SDK
- Create pure TypeScript parallel runner
- Add CLI adapter for task management integration

**Phase 5: MCP Support Utilities**
- Extract MCP-related utilities from CrewXTool
- Create SDK MCP helper functions
- Maintain CLI-specific MCP server integration

## Validation

### Build Status
```bash
npm run build
# ✅ SDK build successful
# ✅ CLI build successful
```

### Test Status
```bash
npm run test:unit --workspace @sowonai/crewx-sdk
# ✅ 84 tests passed (including 30 RemoteAgentManager tests)
```

## References

- **Requirements**: `requirements-monorepo.md`
- **WBS**: `wbs.md` (Phase 3)
- **Detailed Plan**: `wbs-9-shared-plan.md`
- **SDK README**: `packages/sdk/README.md`
- **CLI README**: `packages/cli/README.md`

---

**Completed**: 2025-10-17
**Author**: @crewx_claude_dev
**WBS**: WBS-9 Phase 3
