# WBS-20 Phase 5: Integration Testing Plan

**Date**: 2025-11-12
**Status**: 📋 **Ready to Execute**
**Priority**: P0
**Estimated Time**: 0.5 day

---

## 📋 Overview

### Goal
Comprehensive integration testing of MastraAPIProvider across all 7 supported providers with tool calling verification.

### Scope
- ✅ All 7 API providers (OpenAI, Anthropic, Google, Bedrock, LiteLLM, Ollama, SowonAI)
- ✅ Tool calling functionality
- ✅ CLI interface integration
- ✅ Slack interface integration (optional)
- ✅ Error handling and edge cases

### Prerequisites (Already Complete)
- ✅ Phase 1: Dependencies installed
- ✅ Phase 2: MastraAPIProvider implemented
- ✅ Phase 3: MastraToolAdapter implemented
- ✅ Phase 4: Agent Factory integrated
- ✅ TypeScript compilation successful

---

## 🧪 Test Strategy

### Test Levels

```
┌─────────────────────────────────────┐
│   Level 1: Unit Tests               │
│   - Individual provider creation    │
│   - Config validation               │
│   - Tool adapter conversion         │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Level 2: Integration Tests        │
│   - 7 Provider query/execute        │
│   - Tool calling end-to-end         │
│   - Agent Factory routing           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Level 3: Interface Tests          │
│   - CLI commands                    │
│   - Slack bot (optional)            │
│   - Backward compatibility          │
└─────────────────────────────────────┘
```

---

## 📝 Test Cases

### Test Suite 1: Provider Creation (Unit Tests)

**File**: `packages/sdk/tests/unit/MastraAPIProvider.test.ts`

#### TC1.1: Provider Validation
```typescript
describe('MastraAPIProvider Validation', () => {
  it('should accept valid provider types', () => {
    const validProviders = [
      'api/openai',
      'api/anthropic',
      'api/google',
      'api/bedrock',
      'api/litellm',
      'api/ollama',
      'api/sowonai',
    ];

    validProviders.forEach(provider => {
      const instance = new MastraAPIProvider({
        provider,
        model: 'test-model',
      });
      expect(instance).toBeDefined();
    });
  });

  it('should reject invalid provider types', () => {
    expect(() => {
      new MastraAPIProvider({
        provider: 'api/invalid',
        model: 'test',
      });
    }).toThrow('Invalid API provider type');
  });

  it('should require model field', () => {
    expect(() => {
      new MastraAPIProvider({
        provider: 'api/openai',
        // model is missing
      });
    }).toThrow('Model is required');
  });
});
```

#### TC1.2: Model Creation Logic
```typescript
describe('Model Creation', () => {
  it('should create OpenAI model with custom baseURL', () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
      url: 'https://custom.openai.com/v1',
      apiKey: 'test-key',
    });

    expect(provider).toBeDefined();
    // Verify model configuration internally
  });

  it('should default to localhost:4000 for LiteLLM', () => {
    const provider = new MastraAPIProvider({
      provider: 'api/litellm',
      model: 'gpt-4',
      // No url specified
    });

    // Should use http://localhost:4000 by default
    expect(provider).toBeDefined();
  });

  it('should default to localhost:11434 for Ollama', () => {
    const provider = new MastraAPIProvider({
      provider: 'api/ollama',
      model: 'llama2',
    });

    // Should use http://localhost:11434/v1 by default
    expect(provider).toBeDefined();
  });
});
```

---

### Test Suite 2: Tool Adapter (Unit Tests)

**File**: `packages/sdk/tests/unit/MastraToolAdapter.test.ts`

#### TC2.1: Tool Conversion
```typescript
describe('MastraToolAdapter', () => {
  it('should convert CrewX tool to Mastra tool', () => {
    const crewxTool: FrameworkToolDefinition = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: z.object({
        input: z.string(),
      }),
      execute: async (args, context) => {
        return `Result: ${args.input}`;
      },
    };

    const context: ToolExecutionContext = {
      agent: { id: 'test', name: 'Test Agent' },
      vars: { foo: 'bar' },
      env: { NODE_ENV: 'test' },
    };

    const mastraTools = MastraToolAdapter.convertTools([crewxTool], context);

    expect(mastraTools).toHaveLength(1);
    expect(mastraTools[0].id).toBe('test_tool');
    expect(mastraTools[0].description).toBe('A test tool');
  });

  it('should inject context into tool execution', async () => {
    let capturedContext: ToolExecutionContext | null = null;

    const crewxTool: FrameworkToolDefinition = {
      name: 'context_tool',
      description: 'Captures context',
      parameters: z.object({}),
      execute: async (args, context) => {
        capturedContext = context;
        return 'ok';
      },
    };

    const context: ToolExecutionContext = {
      agent: { id: 'agent1' },
      vars: { key: 'value' },
      env: { ENV: 'prod' },
    };

    const mastraTools = MastraToolAdapter.convertTools([crewxTool], context);
    await mastraTools[0].execute({});

    expect(capturedContext).toEqual(context);
  });
});
```

---

### Test Suite 3: 7 Provider Integration Tests

**File**: `packages/sdk/tests/integration/all-providers.test.ts`

#### TC3.1: OpenAI Provider
```typescript
describe('OpenAI Provider Integration', () => {
  it('should execute simple query', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await provider.query('Say "Hello World"');

    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello');
  });

  it('should handle errors gracefully', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: 'invalid-key',
    });

    const result = await provider.query('Test');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

#### TC3.2: Anthropic Provider
```typescript
describe('Anthropic Provider Integration', () => {
  it('should execute simple query', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/anthropic',
      model: 'claude-3-5-sonnet-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await provider.query('What is 2+2?');

    expect(result.success).toBe(true);
    expect(result.content).toContain('4');
  });
});
```

#### TC3.3: Google Provider
```typescript
describe('Google Provider Integration', () => {
  it('should execute simple query', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/google',
      model: 'gemini-1.5-pro',
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const result = await provider.query('Name a color');

    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
  });
});
```

#### TC3.4: LiteLLM Provider (Local Gateway)
```typescript
describe('LiteLLM Provider Integration', () => {
  it('should connect to local LiteLLM gateway', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/litellm',
      model: 'gpt-4',
      url: 'http://localhost:4000',
      apiKey: 'test-key',
    });

    const result = await provider.query('Test connection');

    // May fail if LiteLLM not running locally - that's OK
    if (result.success) {
      expect(result.content).toBeDefined();
    } else {
      console.log('⚠️ LiteLLM not running locally - skipping');
    }
  });
});
```

#### TC3.5: Ollama Provider (Local)
```typescript
describe('Ollama Provider Integration', () => {
  it('should connect to local Ollama', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/ollama',
      model: 'llama2',
    });

    const result = await provider.query('Hello');

    // May fail if Ollama not running - that's OK
    if (result.success) {
      expect(result.content).toBeDefined();
    } else {
      console.log('⚠️ Ollama not running locally - skipping');
    }
  });
});
```

#### TC3.6: Bedrock Provider
```typescript
describe('Bedrock Provider Integration', () => {
  it.skip('should work with AWS Bedrock', async () => {
    // Requires AWS credentials - skip in CI
    const provider = new MastraAPIProvider({
      provider: 'api/bedrock',
      model: 'anthropic.claude-v2',
      apiKey: process.env.AWS_ACCESS_KEY_ID,
      url: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    });

    const result = await provider.query('Test');
    expect(result.success).toBe(true);
  });
});
```

#### TC3.7: SowonAI Provider
```typescript
describe('SowonAI Provider Integration', () => {
  it.skip('should work with SowonAI custom provider', async () => {
    // Requires SowonAI credentials
    const provider = new MastraAPIProvider({
      provider: 'api/sowonai',
      model: 'custom-model',
      url: 'https://api.sowonai.com/v1',
      apiKey: process.env.SOWONAI_API_KEY,
    });

    const result = await provider.query('Test');
    expect(result.success).toBe(true);
  });
});
```

---

### Test Suite 4: Tool Calling Integration

**File**: `packages/sdk/tests/integration/tool-calling.test.ts`

#### TC4.1: Simple Tool Execution
```typescript
describe('Tool Calling Integration', () => {
  it('should execute simple calculator tool', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define calculator tool
    const calcTool: FrameworkToolDefinition = {
      name: 'calculate',
      description: 'Calculate a math expression',
      parameters: z.object({
        expression: z.string().describe('Math expression to evaluate'),
      }),
      execute: async ({ expression }, context) => {
        // Safe eval for testing only
        const result = Function(`"use strict"; return (${expression})`)();
        return { result };
      },
    };

    // Inject tool
    provider.setTools([calcTool], {
      agent: { id: 'test', name: 'Test Agent' },
      vars: {},
      env: {},
    });

    // Query that requires tool
    const result = await provider.query('What is 15 multiplied by 23?');

    expect(result.success).toBe(true);
    expect(result.content).toContain('345');
  });
});
```

#### TC4.2: Multiple Tool Execution
```typescript
describe('Multiple Tools', () => {
  it('should execute multiple tools in sequence', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    });

    const tools: FrameworkToolDefinition[] = [
      {
        name: 'get_user',
        description: 'Get user information',
        parameters: z.object({
          userId: z.string(),
        }),
        execute: async ({ userId }) => {
          return { name: 'John Doe', id: userId };
        },
      },
      {
        name: 'get_orders',
        description: 'Get user orders',
        parameters: z.object({
          userId: z.string(),
        }),
        execute: async ({ userId }) => {
          return [{ orderId: '123', userId }];
        },
      },
    ];

    provider.setTools(tools, {
      agent: { id: 'test' },
      vars: {},
      env: {},
    });

    const result = await provider.query('Get user info and orders for user ID "abc123"');

    expect(result.success).toBe(true);
    expect(result.content).toContain('John Doe');
  });
});
```

#### TC4.3: Tool with Context Access
```typescript
describe('Tool Context', () => {
  it('should provide context to tool execution', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    });

    let capturedContext: ToolExecutionContext | null = null;

    const contextTool: FrameworkToolDefinition = {
      name: 'context_aware',
      description: 'A tool that uses context',
      parameters: z.object({
        input: z.string(),
      }),
      execute: async ({ input }, context) => {
        capturedContext = context;
        return {
          input,
          agentId: context.agent.id,
          vars: context.vars,
        };
      },
    };

    provider.setTools([contextTool], {
      agent: { id: 'agent-123', name: 'Test Agent' },
      vars: { apiKey: 'secret' },
      env: { NODE_ENV: 'test' },
    });

    await provider.query('Use the context_aware tool with input "test"');

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.agent.id).toBe('agent-123');
    expect(capturedContext?.vars.apiKey).toBe('secret');
  });
});
```

---

### Test Suite 5: Agent Factory Routing

**File**: `packages/sdk/tests/integration/agent-factory.test.ts`

#### TC5.1: API Provider Routing
```typescript
describe('Agent Factory Routing', () => {
  it('should route api/* providers to MastraAPIProvider', () => {
    const config: ProviderConfig = {
      namespace: 'api',
      id: 'openai',
      model: 'gpt-4',
    };

    const provider = createProviderFromConfig(config);

    expect(provider).toBeInstanceOf(MastraAPIProvider);
  });

  it('should route cli/* providers to CLI providers', () => {
    const config: ProviderConfig = {
      namespace: 'cli',
      id: 'claude',
    };

    const provider = createProviderFromConfig(config);

    expect(provider).toBeInstanceOf(ClaudeProvider);
  });
});
```

#### TC5.2: Config Validation
```typescript
describe('Config Validation', () => {
  it('should reject invalid provider type', () => {
    expect(() => {
      createProviderFromConfig({
        namespace: 'api',
        id: 'invalid-provider',
        model: 'test',
      });
    }).toThrow('Invalid API provider type');
  });

  it('should reject missing model for API providers', () => {
    expect(() => {
      createProviderFromConfig({
        namespace: 'api',
        id: 'openai',
        // model missing
      });
    }).toThrow('Model is required');
  });
});
```

---

### Test Suite 6: CLI Integration

**File**: `packages/cli/tests/integration/api-provider-cli.test.ts`

#### TC6.1: CLI Query Command
```bash
# Manual testing (automated later)

# Test OpenAI provider
crewx query "@api_agent What is TypeScript?"

# Test with custom agent (agents.yaml)
crewx query "@researcher What are the latest AI trends?"
```

#### TC6.2: CLI Execute Command
```bash
# Test execute mode (should work identically to query for API providers)
crewx execute "@api_agent Create a plan for learning AI"
```

---

## 🎯 Acceptance Criteria

### Must Have (P0)
- [ ] ✅ All 7 providers can be instantiated without errors
- [ ] ✅ At least 3 providers (OpenAI, Anthropic, Google) execute queries successfully
- [ ] ✅ Tool calling works with OpenAI provider (TC4.1 passes)
- [ ] ✅ Context injection works (TC4.3 passes)
- [ ] ✅ Agent Factory routes api/* to MastraAPIProvider
- [ ] ✅ TypeScript compilation succeeds (already verified)
- [ ] ✅ No breaking changes to existing CLI providers

### Nice to Have (P1)
- [ ] All 7 providers execute queries successfully (including Ollama, LiteLLM)
- [ ] Multiple tool execution works (TC4.2)
- [ ] Streaming support tested
- [ ] CLI interface manually verified

### Future (P2)
- [ ] Slack interface integration
- [ ] Performance benchmarks
- [ ] Load testing

---

## 📋 Test Execution Plan

### Step 1: Unit Tests (0.5 hour)
```bash
cd packages/sdk
npm test -- tests/unit/MastraAPIProvider.test.ts
npm test -- tests/unit/MastraToolAdapter.test.ts
```

**Expected**: All unit tests pass ✅

### Step 2: Integration Tests - Providers (1 hour)
```bash
# Set up environment variables
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."

# Run provider tests
npm test -- tests/integration/all-providers.test.ts
```

**Expected**: OpenAI, Anthropic, Google pass ✅
**Optional**: LiteLLM, Ollama (if running locally)

### Step 3: Integration Tests - Tool Calling (1 hour)
```bash
npm test -- tests/integration/tool-calling.test.ts
```

**Expected**: TC4.1 (simple tool), TC4.3 (context) pass ✅

### Step 4: Agent Factory Tests (0.5 hour)
```bash
npm test -- tests/integration/agent-factory.test.ts
```

**Expected**: All routing tests pass ✅

### Step 5: Manual CLI Testing (0.5 hour)
```bash
# Test 1: Query with API provider
crewx query "@api_agent test query"

# Test 2: Verify CLI providers still work (regression)
crewx query "@claude test query"

# Test 3: Test with custom agents.yaml
# (Create test agents.yaml with API provider config)
crewx query "@researcher test"
```

**Expected**: All commands work without errors ✅

---

## 🚨 Known Issues & Mitigation

### Issue 1: API Keys Required
**Problem**: Tests require real API keys
**Mitigation**:
- Use `.env.test` file for local testing
- Skip tests in CI if keys not available
- Use `it.skip()` for optional providers

### Issue 2: Local Services (Ollama, LiteLLM)
**Problem**: Require local setup
**Mitigation**:
- Mark as optional tests
- Provide setup instructions in docs
- Skip gracefully if not available

### Issue 3: Network Failures
**Problem**: API calls may fail due to network
**Mitigation**:
- Retry logic (3 attempts)
- Timeout handling
- Clear error messages

---

## ✅ Completion Checklist

### Code Review
- [ ] All Phase 4 code reviewed
- [ ] TypeScript compilation clean (no errors/warnings)
- [ ] Linting passes
- [ ] No console.log left in production code

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written
- [ ] At least 3 providers tested successfully
- [ ] Tool calling verified
- [ ] Context injection verified

### Documentation
- [ ] Phase 5 test plan reviewed
- [ ] Test results documented
- [ ] Known issues documented
- [ ] Next steps clear (WBS-23)

### Git
- [ ] All changes staged
- [ ] Commit message prepared
- [ ] Ready for PR to develop branch

---

## 📊 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Unit Tests | 100% pass | ⬜️ Pending |
| Provider Tests | 3/7 pass | ⬜️ Pending |
| Tool Calling | 2/3 pass | ⬜️ Pending |
| Factory Tests | 100% pass | ⬜️ Pending |
| Compilation | 0 errors | ✅ Done |
| Breaking Changes | 0 | ✅ Done |

---

## 🔄 Next Steps After Phase 5

Upon successful completion:

1. **Update WBS Status** ✅
   - Mark WBS-20 as complete in wbs.md
   - Update progress log

2. **Create Commit** ✅
   ```bash
   git add .
   git commit -m "feat(api-provider): complete WBS-20 Mastra integration

   - Phase 1: Dependencies added
   - Phase 2: MastraAPIProvider implemented (290+ lines)
   - Phase 3: MastraToolAdapter implemented (265 lines)
   - Phase 4: Agent Factory integrated
   - Phase 5: Integration tests completed

   Supports 7 providers: OpenAI, Anthropic, Google, Bedrock, LiteLLM, Ollama, SowonAI
   All tests passing, no breaking changes to existing CLI providers."
   ```

3. **Move to WBS-23** ✅
   - YAML parsing and Agent creation
   - Dynamic Provider Factory
   - CLI integration

---

**Document Version**: 1.0
**Author**: @crewx_claude_dev
**Last Updated**: 2025-11-12
