# WBS-18: SDK AgentRuntime Provider 통합

> **상태**: ⬜️ 대기
> **작성일**: 2025-10-20
> **선행 작업**: WBS-17 (Skill Runtime & Package)

## 📋 목표

1. **SDK**: AgentRuntime이 실제 AIProvider를 주입받아 AI 호출 수행
2. **CLI**: CLI가 SDK AgentRuntime을 사용하도록 통합 (일원화)
3. **DX**: 개발자들이 CLI를 보고 SDK 사용법을 배울 수 있게 레퍼런스 제공

## 🔄 Phase 의존성 및 병렬 실행 전략

### Phase 의존성 다이어그램

```
Phase 1 (SDK 타입)
    │
    ├─────────┬─────────────┐
    │         │             │
    ▼         ▼             ▼
Phase 2   Phase 4*      (문서화)
(SDK 구현) (CLI 준비)
    │         │
    ▼         ▼
Phase 3   Phase 5
(테스트)   (CLI 통합)
```

**주요 발견:**
- ⚠️ **Phase 4는 Phase 2와 병렬 가능!** (Phase 1만 의존)
- Phase 3과 Phase 5도 병렬 가능

### 의존성 상세

| Phase | 선행 작업 필수 | 선행 작업 권장 | 독립 실행 가능 | 병렬 가능 대상 |
|-------|--------------|--------------|--------------|--------------|
| Phase 1 | 없음 | - | ✅ | - |
| Phase 2 | Phase 1 | - | ❌ | Phase 4 (같이 진행 가능) |
| Phase 3 | Phase 1, 2 | - | ❌ | Phase 5 (같이 진행 가능) |
| Phase 4 | **Phase 1만** | Phase 2 | ⚠️ 부분 가능 | Phase 2 (같이 진행 가능) |
| Phase 5 | Phase 4 | Phase 2 완료 | ❌ | Phase 3 (같이 진행 가능) |

### 실행 전략

#### 전략 1: 순차 실행 (안전함, 느림)
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
예상 소요: 12-16시간
```

#### 전략 2: 병렬 실행 (빠름, 추천) ⭐
```
Phase 1 (2시간)
    │
    ├──────────────────────┐
    │                      │
Phase 2 (3시간)      Phase 4 (2시간) ← 병렬!
    │                      │
Phase 3 (2시간)      Phase 5 (3시간) ← 병렬!

예상 소요: 10시간 (약 30% 단축)
```

**병렬 실행 조건:**
- Phase 2와 Phase 4: Phase 1 완료 후 동시 시작 가능
  - Phase 2: SDK 구현 (CodexDev)
  - Phase 4: CLI 준비 (ClaudeDev)

- Phase 3과 Phase 5: 각각 Phase 2, 4 완료 후 동시 시작 가능
  - Phase 3: SDK 테스트 (Tester)
  - Phase 5: CLI 통합 (CodexDev)

#### 전략 3: 점진적 실행 (현실적) ⭐⭐
```
[1단계] Phase 1 → Phase 2
  → SDK Provider 통합 완료, 기본 테스트 통과

[2단계] Phase 4 (Phase 2 기반)
  → CLI가 SDK 사용 가능하게 준비

[3단계] Phase 5 (Phase 4 기반)
  → 실제 CLI 명령어 통합

[4단계] Phase 3 (전체 회귀 테스트)
  → 모든 테스트 완성

예상 소요: 11시간
장점: 각 단계마다 검증 가능
```

### Phase 4의 특수성

**Phase 4가 Phase 2와 병렬 가능한 이유:**

Phase 4는 다음만 필요:
```typescript
// Phase 1의 산출물만 있으면 됨
interface AgentRuntimeOptions {
  provider?: AIProvider;  // ← Phase 1에서 정의
  // ...
}

// Phase 4 작업
class ProviderBridgeService {
  getProviderForSDK(id: string): AIProvider {
    return this.aiProviderService.getProvider(id);
  }
}
```

Phase 2의 실제 구현(`query()`, `execute()`)은 Phase 4에서 **호출만** 하면 됨:
```typescript
// Phase 4에서는 호출만 하므로 Phase 2 미완성이어도 타입만 있으면 OK
this.agentRuntime = await createCrewxAgent({
  provider: defaultProvider,
});

// 실제 호출은 Phase 5에서 함 (Phase 2 완료 필요)
await this.agent.query('test');
```

### 권장 사항

**프로젝트 리소스에 따라 선택:**

1. **개발자 1명**: 전략 1 (순차 실행)
2. **개발자 2명 이상**: 전략 2 (병렬 실행)
   - 개발자 A: Phase 1 → Phase 2 → Phase 3
   - 개발자 B: Phase 1 대기 → Phase 4 → Phase 5
3. **안정성 우선**: 전략 3 (점진적 실행)

## 🔍 현재 문제점

### 1. AgentRuntime이 하드코딩된 Mock 응답만 반환

**파일**: `packages/sdk/src/core/agent/agent-runtime.ts:75-84`

```typescript
async query(request: AgentQueryRequest): Promise<AgentResult> {
  // ...

  // ❌ 문제: 하드코딩된 Mock 응답
  const result: AgentResult = {
    content: `Query executed: ${request.prompt}`,
    success: true,
    agentId,
    metadata: {
      context: request.context,
      messageCount: request.messages?.length ?? 0,
    },
  };

  return result;
}
```

### 2. createCrewxAgent가 ProviderConfig를 무시

**파일**: `packages/sdk/src/core/agent/agent-factory.ts:85-99`

```typescript
export async function createCrewxAgent(
  config: CrewxAgentConfig = {},
): Promise<CrewxAgentResult> {
  const eventBus = new EventBus();

  // ❌ 문제: config.provider를 받지만 사용하지 않음
  const runtimeOptions: AgentRuntimeOptions = {
    eventBus,
    enableCallStack: config.enableCallStack ?? false,
    defaultAgentId: config.defaultAgentId ?? 'crewx',
    // provider 전달 안 됨!
  };

  const runtime = new AgentRuntime(runtimeOptions);
  // ...
}
```

### 3. Provider 생성 로직이 Agent 계층과 분리됨

- `dynamic-provider.factory.ts`에 Provider 생성 로직이 있음
- 하지만 Agent 계층(`agent-factory`, `agent-runtime`)과 연결되지 않음

### 4. 기존 코드베이스 호환성 이슈 (Codex 리뷰 발견)

**파일**: `packages/sdk/src/core/parallel/helpers.ts:310`

```typescript
// ParallelRunner에서 Provider 없이 AgentRuntime 생성
const runtime = new AgentRuntime();  // ❌ Provider 필수로 바꾸면 여기서 throw!
```

**해결 방안**: Provider를 **선택사항**으로 유지하고, 없으면 **자동으로 MockProvider 사용**

## 🎯 설계 방향

### 핵심 원칙

1. **Provider 주입의 유연성**
   - `ProviderConfig` (설정 객체) 또는 `AIProvider` (인스턴스) 둘 다 지원
   - 프로덕션: Config 전달 → Factory가 자동 생성
   - 테스트: Mock 인스턴스 직접 주입

2. **AgentRuntime의 단일 책임**
   - Provider 생성/관리는 Factory 책임
   - Runtime은 주입받은 Provider만 사용
   - 이벤트 발행 및 콜스택 관리에 집중

3. **테스트 용이성 & 하위 호환성** ⭐ (Codex 리뷰 반영)
   - MockProvider를 쉽게 주입 가능
   - **Provider 없이 생성 시 자동으로 MockProvider 사용 (기본값)**
   - 기존 코드 (`ParallelRunner` 등) 깨지지 않음

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│              createCrewxAgent()                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 1. resolveProvider(config.provider)            │    │
│  │    - undefined → MockProvider                  │    │
│  │    - AIProvider 인스턴스 → 그대로 반환         │    │
│  │    - ProviderConfig → createProviderInstance() │    │
│  └────────────────────────────────────────────────┘    │
│                          ↓                               │
│  ┌────────────────────────────────────────────────┐    │
│  │ 2. new AgentRuntime({ provider, ... })        │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              AgentRuntime                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ async query(request) {                         │    │
│  │   // 이벤트 발행                               │    │
│  │   emit('agentStarted')                         │    │
│  │                                                │    │
│  │   // ✅ 실제 Provider 호출                     │    │
│  │   const aiResponse = await this.provider.query()│   │
│  │                                                │    │
│  │   // AIResponse → AgentResult 변환             │    │
│  │   return convertToAgentResult(aiResponse)      │    │
│  │ }                                              │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 📦 Phase 1: Provider 주입 구조 설계

> **의존성**: 없음 (독립 실행 가능) ✅
> **병렬 가능**: 없음 (최초 Phase)
> **추천 에이전트**: `@crewx_claude_dev` (타입 설계 및 인터페이스 - 융통성 필요)
> **대안 에이전트**: `@crewx_codex_dev` (구현 검증 - 꼼꼼한 확인)
> **예상 소요**: 1-2시간
> **작업 범위**: 타입 정의, 인터페이스 설계, 헬퍼 함수 구현
> **에이전트 선택 가이드**:
> - **Claude**: 타입 확장 및 resolveProvider 로직 설계 (융통성 필요)
> - **Codex**: 구현 후 타입 체크 및 빌드 검증 (꼼꼼한 확인)

### 1.1 CrewxAgentConfig 타입 확장

**파일**: `packages/sdk/src/core/agent/agent-factory.ts`

```typescript
import type { AIProvider } from '../providers/ai-provider.interface';

export interface ProviderConfig {
  namespace: string;
  id: string;
  apiKey?: string;
  model?: string;
}

export interface CrewxAgentConfig {
  // ✅ 변경: ProviderConfig | AIProvider 둘 다 허용
  provider?: ProviderConfig | AIProvider;
  knowledgeBase?: KnowledgeBaseConfig;
  enableCallStack?: boolean;
  defaultAgentId?: string;
}
```

### 1.2 resolveProvider 헬퍼 함수 구현

**파일**: `packages/sdk/src/core/agent/agent-factory.ts`

```typescript
import { MockProvider } from '../providers/mock.provider';
import { createProviderFromConfig } from '../providers/provider-factory';

/**
 * Provider 설정을 AIProvider 인스턴스로 변환
 *
 * ⭐ Codex 리뷰 반영: Provider 없으면 MockProvider 기본값 사용
 */
async function resolveProvider(
  config?: ProviderConfig | AIProvider
): Promise<AIProvider> {
  // Case 1: Provider 설정 없음 → 기본 MockProvider ✅
  if (!config) {
    return new MockProvider();
  }

  // Case 2: 이미 AIProvider 인스턴스 → 그대로 반환
  if ('query' in config && typeof config.query === 'function') {
    return config as AIProvider;
  }

  // Case 3: ProviderConfig → Provider 인스턴스 생성
  // TODO: createProviderFromConfig 구현 필요 (현재 미구현)
  // 임시로 MockProvider 반환하거나 dynamic-provider.factory 활용
  return createProviderFromConfig(config as ProviderConfig);
}
```

### 1.3 AgentRuntimeOptions에 Provider 필드 추가

**파일**: `packages/sdk/src/core/agent/agent-runtime.ts`

```typescript
import type { AIProvider } from '../providers/ai-provider.interface';

export interface AgentRuntimeOptions {
  // ✅ 추가: Provider 주입
  provider?: AIProvider;
  eventBus?: EventBus;
  enableCallStack?: boolean;
  defaultAgentId?: string;
}

export class AgentRuntime {
  private provider: AIProvider;
  private eventBus: EventBus;
  private enableCallStack: boolean;
  private callStack: CallStackFrame[] = [];
  private defaultAgentId: string;

  constructor(options: AgentRuntimeOptions = {}) {
    // ⭐ Codex 리뷰 반영: Provider 없으면 MockProvider 자동 사용
    // 기존 코드(ParallelRunner 등) 호환성 유지
    this.provider = options.provider ?? new MockProvider();
    this.eventBus = options.eventBus ?? new EventBus();
    this.enableCallStack = options.enableCallStack ?? false;
    this.defaultAgentId = options.defaultAgentId ?? 'default';
  }

  // ...
}
```

### 1.4 createCrewxAgent에서 Provider 주입

**파일**: `packages/sdk/src/core/agent/agent-factory.ts`

```typescript
export async function createCrewxAgent(
  config: CrewxAgentConfig = {},
): Promise<CrewxAgentResult> {
  const eventBus = new EventBus();

  // ✅ Provider 생성
  const provider = await resolveProvider(config.provider);

  // ✅ Runtime 옵션에 provider 포함
  const runtimeOptions: AgentRuntimeOptions = {
    provider,  // 👈 주입!
    eventBus,
    enableCallStack: config.enableCallStack ?? false,
    defaultAgentId: config.defaultAgentId ?? 'crewx',
  };

  const runtime = new AgentRuntime(runtimeOptions);

  const agent: CrewxAgent = {
    query: runtime.query.bind(runtime),
    execute: runtime.execute.bind(runtime),
    getCallStack: runtime.getCallStack.bind(runtime),
  };

  return {
    agent,
    onEvent: (eventName, listener) => eventBus.on(eventName, listener),
    eventBus,
  };
}
```

## 📦 Phase 2: AgentRuntime Provider 통합

> **의존성**: Phase 1 필수 ⚠️
> **병렬 가능**: Phase 4 (CLI 준비)와 동시 진행 가능 ⭐
> **추천 에이전트**: `@crewx_codex_dev` (리팩토링 및 통합 - 꼼꼼한 확인)
> **대안 에이전트**: `@crewx_claude_dev` (에러 처리 로직 - 융통성)
> **예상 소요**: 2-3시간
> **작업 범위**: AgentRuntime 리팩토링, Provider 호출 통합, AIResponse 변환 로직
> **주의사항**: 기존 이벤트 발행 및 콜스택 로직 유지 필수
> **병렬 전략**: Phase 4 작업자는 이 Phase가 진행되는 동안 CLI 준비 가능
> **에이전트 선택 가이드**:
> - **Codex**: 기존 코드 리팩토링, Provider 호출 통합 (꼼꼼한 확인)
> - **Claude**: AIResponse 변환 로직, 에러 핸들링 개선 (융통성 필요)

### 2.1 AgentRuntime.query() 리팩토링

**파일**: `packages/sdk/src/core/agent/agent-runtime.ts`

```typescript
async query(request: AgentQueryRequest): Promise<AgentResult> {
  const agentId = request.agentId ?? this.defaultAgentId;

  try {
    // 이벤트 발행
    await this.eventBus.emit('agentStarted', { agentId, mode: 'query' });

    // 콜스택 추가
    if (this.enableCallStack) {
      const frame: CallStackFrame = {
        depth: this.callStack.length,
        agentId,
        provider: this.provider.name,  // ✅ 실제 Provider 이름
        mode: 'query',
        enteredAt: new Date().toISOString(),
      };
      this.callStack.push(frame);
      await this.eventBus.emit('callStackUpdated', [...this.callStack]);
    }

    // ✅ 실제 Provider 호출
    const aiResponse = await this.provider.query(request.prompt, {
      workingDirectory: request.context,
      messages: request.messages,
      agentId,
    });

    // ✅ AIResponse → AgentResult 변환
    const result: AgentResult = {
      content: aiResponse.content,
      success: aiResponse.success,
      agentId,
      metadata: {
        provider: aiResponse.provider,
        command: aiResponse.command,
        context: request.context,
        messageCount: request.messages?.length ?? 0,
        error: aiResponse.error,
      },
    };

    // ⭐ Codex 리뷰 반영: Provider 응답의 success 상태를 이벤트에 반영
    await this.eventBus.emit('agentCompleted', {
      agentId,
      success: aiResponse.success  // ✅ 실제 Provider 결과 반영
    });

    return result;
  } catch (error) {
    await this.eventBus.emit('agentCompleted', { agentId, success: false });
    throw error;
  } finally {
    // 콜스택 정리
    if (this.enableCallStack && this.callStack.length > 0) {
      this.callStack.pop();
      await this.eventBus.emit('callStackUpdated', [...this.callStack]);
    }
  }
}
```

### 2.2 AgentRuntime.execute() 리팩토링

**파일**: `packages/sdk/src/core/agent/agent-runtime.ts`

```typescript
async execute(request: AgentExecuteRequest): Promise<AgentResult> {
  const agentId = request.agentId ?? this.defaultAgentId;

  try {
    await this.eventBus.emit('agentStarted', { agentId, mode: 'execute' });

    if (this.enableCallStack) {
      const frame: CallStackFrame = {
        depth: this.callStack.length,
        agentId,
        provider: this.provider.name,
        mode: 'execute',
        enteredAt: new Date().toISOString(),
      };
      this.callStack.push(frame);
      await this.eventBus.emit('callStackUpdated', [...this.callStack]);
    }

    // ✅ 실제 Provider execute 호출
    // BaseAIProvider는 execute()가 query()를 호출하지만,
    // 일부 Provider는 execute 모드에서 다른 동작 가능
    const aiResponse = await this.provider.execute
      ? await this.provider.execute(request.prompt, {
          workingDirectory: request.context,
          messages: request.messages,
          agentId,
        })
      : await this.provider.query(request.prompt, {
          workingDirectory: request.context,
          messages: request.messages,
          agentId,
        });

    const result: AgentResult = {
      content: aiResponse.content,
      success: aiResponse.success,
      agentId,
      metadata: {
        provider: aiResponse.provider,
        command: aiResponse.command,
        context: request.context,
        messageCount: request.messages?.length ?? 0,
        error: aiResponse.error,
      },
    };

    await this.eventBus.emit('agentCompleted', { agentId, success: true });

    return result;
  } catch (error) {
    await this.eventBus.emit('agentCompleted', { agentId, success: false });
    throw error;
  } finally {
    if (this.enableCallStack && this.callStack.length > 0) {
      this.callStack.pop();
      await this.eventBus.emit('callStackUpdated', [...this.callStack]);
    }
  }
}
```

## 📦 Phase 3: 테스트 업데이트

> **의존성**: Phase 1, 2 필수 ⚠️
> **병렬 가능**: Phase 5 (CLI 통합)와 동시 진행 가능 ⭐
> **총 예상 소요**: 1.5-2시간 (병렬 처리)
> **병렬 전략**: Phase 5 작업자는 Phase 3이 완료되지 않아도 CLI 통합 작업 시작 가능
>
> **개발 작업 (병렬 1)**:
> - **MockProvider 구현**: `@crewx_codex_dev` (구현 - 꼼꼼한 확인) - 30분
> - **단위 테스트**: `@crewx_glm_dev` (반복 작업 - 20분 이내) - 15분
> - **통합 테스트**: `@crewx_claude_dev` (시나리오 설계 - 융통성) - 1시간
>
> **QA 작업 (병렬 2)**:
> - **QA 리드**: `@crewx_qa_lead` - 테스트 계획 및 검증 전략 수립 - 30분
> - **테스터**: `@crewx_tester` - 전체 테스트 스위트 실행 및 회귀 테스트 - 1시간
>
> **병렬 처리 전략**:
> 1. MockProvider 구현 (Codex) + QA 계획 (QA Lead) 동시 진행
> 2. 단위 테스트 (GLM) + 통합 테스트 (Claude) 동시 진행
> 3. 전체 검증 (Tester) 마지막 실행

### 3.1 MockProvider 클래스 구현

**파일**: `packages/sdk/src/core/providers/mock.provider.ts`

```typescript
import type { AIProvider, AIQueryOptions, AIResponse } from './ai-provider.interface';

/**
 * Mock Provider for testing purposes
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
   * Set custom response for specific prompt
   */
  setResponse(prompt: string, response: Partial<AIResponse>): void {
    this.responses.set(prompt, {
      ...this.defaultResponse,
      ...response,
    });
  }

  /**
   * Set default response for all prompts
   */
  setDefaultResponse(response: Partial<AIResponse>): void {
    this.defaultResponse = {
      ...this.defaultResponse,
      ...response,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
    // Check for custom response
    const customResponse = this.responses.get(prompt);
    if (customResponse) {
      return customResponse;
    }

    // Return default response with prompt echo
    return {
      ...this.defaultResponse,
      content: `Mock response for: ${prompt}`,
    };
  }

  async getToolPath(): Promise<string | null> {
    return '/mock/path';
  }
}
```

### 3.2 agent-factory.test.ts 업데이트

**파일**: `packages/sdk/tests/unit/core/agent/agent-factory.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCrewxAgent } from '../../../../src/core/agent/agent-factory';
import { MockProvider } from '../../../../src/core/providers/mock.provider';

describe('createCrewxAgent - Provider Integration', () => {
  describe('Provider 주입', () => {
    it('should accept AIProvider instance directly', async () => {
      const mockProvider = new MockProvider();
      mockProvider.setDefaultResponse({
        content: 'Custom mock response',
        success: true,
      });

      const { agent } = await createCrewxAgent({
        provider: mockProvider,
      });

      const result = await agent.query({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Custom mock response');
    });

    it('should accept ProviderConfig and create provider', async () => {
      const { agent } = await createCrewxAgent({
        provider: {
          namespace: 'cli',
          id: 'mock',
        },
      });

      const result = await agent.query({ prompt: 'test config' });

      expect(result.success).toBe(true);
      expect(result.content).toContain('test config');
    });

    it('should use MockProvider when no provider specified', async () => {
      const { agent } = await createCrewxAgent();

      const result = await agent.query({ prompt: 'test default' });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Mock response');
    });
  });

  describe('Provider 응답 변환', () => {
    it('should convert AIResponse to AgentResult correctly', async () => {
      const mockProvider = new MockProvider();
      mockProvider.setResponse('analyze', {
        content: 'Analysis complete',
        provider: 'cli/claude',
        command: 'claude -p "analyze"',
        success: true,
      });

      const { agent } = await createCrewxAgent({
        provider: mockProvider,
      });

      const result = await agent.query({ prompt: 'analyze' });

      expect(result).toMatchObject({
        content: 'Analysis complete',
        success: true,
        metadata: expect.objectContaining({
          provider: 'cli/claude',
          command: 'claude -p "analyze"',
        }),
      });
    });

    it('should handle provider errors gracefully', async () => {
      const mockProvider = new MockProvider();
      mockProvider.setResponse('fail', {
        content: '',
        success: false,
        error: 'Provider error occurred',
      });

      const { agent } = await createCrewxAgent({
        provider: mockProvider,
      });

      const result = await agent.query({ prompt: 'fail' });

      expect(result.success).toBe(false);
      expect(result.metadata?.error).toBe('Provider error occurred');
    });
  });

  describe('Provider와 EventBus 통합', () => {
    it('should emit events with provider information', async () => {
      const mockProvider = new MockProvider();
      const { agent, onEvent } = await createCrewxAgent({
        provider: mockProvider,
        enableCallStack: true,
      });

      const callStacks: any[] = [];
      onEvent('callStackUpdated', (stack) => {
        callStacks.push([...stack]);
      });

      await agent.query({ prompt: 'test' });

      // Provider name should be in call stack
      expect(callStacks[0][0]).toMatchObject({
        provider: 'mock',
        mode: 'query',
      });
    });
  });
});
```

### 3.3 Integration 테스트

**파일**: `packages/sdk/tests/integration/agent-provider.integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createCrewxAgent } from '../../src/core/agent/agent-factory';
import { CodexProvider } from '../../src/core/providers/codex.provider';

describe('AgentRuntime with Real Provider', () => {
  it('should work with CodexProvider', async () => {
    const codexProvider = new CodexProvider();

    // Skip if codex is not available
    const isAvailable = await codexProvider.isAvailable();
    if (!isAvailable) {
      console.log('Skipping: CodexProvider not available');
      return;
    }

    const { agent } = await createCrewxAgent({
      provider: codexProvider,
    });

    const result = await agent.query({
      prompt: 'What is 2+2?',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
    expect(result.metadata?.provider).toContain('codex');
  });
});
```

## 📊 사용 예시

### 예시 1: Mock Provider 직접 주입 (테스트)

```typescript
import { createCrewxAgent } from '@sowonai/crewx-sdk';
import { MockProvider } from '@sowonai/crewx-sdk/providers';

// Mock Provider 커스터마이징
const mockProvider = new MockProvider();
mockProvider.setResponse('analyze code', {
  content: 'Code analysis: No issues found',
  success: true,
});

// Agent 생성
const { agent } = await createCrewxAgent({
  provider: mockProvider,
  enableCallStack: true,
});

// 사용
const result = await agent.query({ prompt: 'analyze code' });
console.log(result.content); // "Code analysis: No issues found"
```

### 예시 2: ProviderConfig 전달 (프로덕션)

```typescript
import { createCrewxAgent } from '@sowonai/crewx-sdk';

// ProviderConfig로 Agent 생성
const { agent, onEvent } = await createCrewxAgent({
  provider: {
    namespace: 'cli',
    id: 'claude',
    apiKey: process.env.CLAUDE_API_KEY,
  },
  enableCallStack: true,
});

// 이벤트 모니터링
onEvent('agentStarted', (payload) => {
  console.log('Agent started:', payload);
});

// 실제 Claude 호출
const result = await agent.query({
  prompt: 'Explain this function',
  context: '/path/to/code',
});

console.log(result.content); // Claude의 실제 응답
```

### 예시 3: Provider 없이 생성 (기본 Mock)

```typescript
import { createCrewxAgent } from '@sowonai/crewx-sdk';

// Provider 지정 없음 → 자동으로 MockProvider 사용
const { agent } = await createCrewxAgent();

const result = await agent.query({ prompt: 'hello' });
console.log(result.content); // "Mock response for: hello"
```

### 예시 4: 실제 Provider 인스턴스 주입

```typescript
import { createCrewxAgent } from '@sowonai/crewx-sdk';
import { ClaudeProvider } from '@sowonai/crewx-sdk/providers';

// Provider 인스턴스 직접 생성
const claudeProvider = new ClaudeProvider({
  apiKey: process.env.CLAUDE_API_KEY,
  model: 'claude-3-5-sonnet',
});

// 인스턴스 주입
const { agent } = await createCrewxAgent({
  provider: claudeProvider,
});

const result = await agent.query({ prompt: 'What is TypeScript?' });
```

## 🎯 완료 기준

### Phase 1
- [ ] `CrewxAgentConfig.provider` 타입이 `ProviderConfig | AIProvider` 지원
- [ ] `resolveProvider()` 헬퍼 함수 구현 완료 (MockProvider 기본값 포함)
- [ ] `AgentRuntimeOptions.provider` 필드 추가 (선택사항, MockProvider fallback)
- [ ] `createCrewxAgent()`에서 Provider 생성 및 주입 로직 구현
- [ ] ⭐ 기존 `ParallelRunner` 코드 깨지지 않는지 확인

### Phase 2
- [ ] `AgentRuntime.query()`가 실제 `this.provider.query()` 호출
- [ ] `AgentRuntime.execute()`가 실제 `this.provider.execute()` 호출
- [ ] AIResponse → AgentResult 변환 로직 구현
- [ ] ⭐ `agentCompleted` 이벤트가 Provider 실제 결과(`aiResponse.success`) 반영
- [ ] 에러 핸들링 및 콜스택 로직 유지

### Phase 3
- [ ] `MockProvider` 클래스 구현 완료 (setResponse, setDefaultResponse 포함)
- [ ] `agent-factory.test.ts` 업데이트 (10+ 새 테스트)
- [ ] Integration 테스트 작성 (CodexProvider)
- [ ] ⭐ 기존 테스트 회귀 검증 (ParallelRunner, EventBus 등)
- [ ] 모든 테스트 통과 (기존 + 신규)

## 📝 산출물

- [ ] `packages/sdk/src/core/agent/agent-factory.ts` - Provider 주입 로직
- [ ] `packages/sdk/src/core/agent/agent-runtime.ts` - Provider 통합
- [ ] `packages/sdk/src/core/providers/mock.provider.ts` - MockProvider
- [ ] `packages/sdk/src/core/providers/provider-factory.ts` - createProviderFromConfig (신규 또는 기존 활용)
- [ ] `packages/sdk/tests/unit/core/agent/agent-factory.test.ts` - 테스트 업데이트
- [ ] `packages/sdk/tests/integration/agent-provider.integration.test.ts` - 통합 테스트
- [ ] `packages/sdk/src/core/providers/index.ts` - MockProvider export 추가

## 📦 Phase 4: CLI Provider 통합 준비

> **의존성**: Phase 1 필수 ⚠️ (Phase 2는 권장, 필수 아님!)
> **병렬 가능**: Phase 2 (SDK 구현)와 동시 진행 가능 ⭐⭐
> **추천 에이전트**: `@crewx_claude_dev` (아키텍처 설계 - 융통성 필요)
> **대안 에이전트**: `@crewx_codex_dev` (구현 검증 - 꼼꼼한 확인)
> **예상 소요**: 2-3시간
> **작업 범위**: CLI AIProviderService를 SDK Provider로 변환하는 브릿지 구현
> **목표**: CLI의 기존 Provider 인스턴스를 SDK AgentRuntime에 주입 가능하게 만들기
> **병렬 전략**: Phase 1 완료 후 Phase 2와 동시 시작 → 30% 시간 단축!

### 4.1 문제 분석

**현재 CLI 구조:**
```
query.handler.ts
  ↓
CrewXTool.queryAgent()
  ↓ (복잡한 템플릿/레이아웃/보안 처리)
AIProviderService.getProvider('claude')
  ↓
SdkClaudeProvider (SDK 제공)
```

**목표 구조:**
```
query.handler.ts
  ↓
AgentRuntimeService (NEW)
  ↓
SDK AgentRuntime
  ↓
AIProviderService.getProvider('claude') (기존 CLI Provider 재사용)
```

**핵심 과제:**
- CLI는 이미 `AIProviderService`로 Provider를 관리
- SDK `AgentRuntime`은 `AIProvider` 인스턴스가 필요
- 기존 CLI Provider를 SDK에 주입하는 브릿지 필요

### 4.2 ProviderBridge 구현

**파일**: `packages/cli/src/services/provider-bridge.service.ts` (신규)

```typescript
import { Injectable } from '@nestjs/common';
import { AIProviderService } from '../ai-provider.service';
import type { AIProvider } from '@sowonai/crewx-sdk';

/**
 * Bridge between CLI's AIProviderService and SDK's AIProvider interface.
 * Allows SDK AgentRuntime to use CLI's existing provider instances.
 */
@Injectable()
export class ProviderBridgeService {
  constructor(private readonly aiProviderService: AIProviderService) {}

  /**
   * Get CLI provider instance for SDK AgentRuntime
   *
   * @param providerId - Provider ID (e.g., 'claude', 'gemini', 'copilot')
   * @returns AIProvider instance compatible with SDK
   */
  getProviderForSDK(providerId: string): AIProvider {
    const provider = this.aiProviderService.getProvider(providerId);

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // CLI providers already implement AIProvider interface
    // Just return as-is
    return provider;
  }

  /**
   * Get all available provider IDs
   */
  getAvailableProviderIds(): string[] {
    return this.aiProviderService.getAvailableProviders();
  }

  /**
   * Check if provider is available
   */
  async isProviderAvailable(providerId: string): Promise<boolean> {
    try {
      const provider = this.getProviderForSDK(providerId);
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }
}
```

### 4.3 AgentRuntimeService 개선

**파일**: `packages/cli/src/services/agent-runtime.service.ts` (수정)

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createCrewxAgent,
  CrewxAgent,
  CrewxAgentResult,
  AgentQueryRequest,
  AgentExecuteRequest,
  AgentResult,
} from '@sowonai/crewx-sdk';
import type { LoggerLike } from '@sowonai/crewx-sdk';
import { AgentLoaderService } from './agent-loader.service';
import { ProviderBridgeService } from './provider-bridge.service'; // NEW

@Injectable()
export class AgentRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(AgentRuntimeService.name);
  private agentRuntime: CrewxAgentResult | null = null;
  private agent: CrewxAgent | null = null;

  constructor(
    private readonly agentLoaderService: AgentLoaderService,
    private readonly providerBridge: ProviderBridgeService, // NEW
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing AgentRuntimeService with real CLI providers');
    await this.initializeRuntime();
  }

  private async initializeRuntime() {
    try {
      const agents = await this.agentLoaderService.getAllAgents();
      const validAgentIds = agents.map(a => a.id);

      // ✅ Use CLI's actual provider (e.g., ClaudeProvider)
      const defaultProvider = this.providerBridge.getProviderForSDK('claude');

      const customLogger: LoggerLike = {
        log: (message: string, ...args: any[]) => this.logger.log(message, ...args),
        warn: (message: string, ...args: any[]) => this.logger.warn(message, ...args),
        error: (message: string, ...args: any[]) => this.logger.error(message, ...args),
      };

      // ✅ Create SDK AgentRuntime with real Provider
      this.agentRuntime = await createCrewxAgent({
        provider: defaultProvider, // 실제 CLI Provider!
        defaultAgentId: 'crewx',
        validAgents: validAgentIds,
        enableCallStack: true,
      });

      this.agent = this.agentRuntime.agent;

      // Subscribe to events
      this.agentRuntime.onEvent('agentStarted', (data) => {
        this.logger.debug(`Agent started: ${JSON.stringify(data)}`);
      });

      this.agentRuntime.onEvent('agentCompleted', (data) => {
        this.logger.debug(`Agent completed: ${JSON.stringify(data)}`);
      });

      this.logger.log('✅ AgentRuntime initialized with real CLI providers');
    } catch (error) {
      this.logger.error(
        `Failed to initialize AgentRuntime: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    }
  }

  // ... rest of the methods unchanged
}
```

### 4.4 AppModule 업데이트

**파일**: `packages/cli/src/app.module.ts` (수정)

```typescript
import { ProviderBridgeService } from './services/provider-bridge.service';

// ... providers array에 추가
providers: [
  // ...
  ProviderBridgeService, // NEW - Bridge CLI providers to SDK
  AgentRuntimeService,
  // ...
]
```

### 4.5 완료 기준

- [ ] `ProviderBridgeService` 구현 완료
- [ ] `AgentRuntimeService`가 실제 CLI Provider 사용
- [ ] AppModule에 ProviderBridge 등록
- [ ] 빌드 성공 (타입 에러 없음)
- [ ] CLI 실행 시 AgentRuntime이 실제 Provider로 초기화

## 📦 Phase 5: CLI 명령어에서 SDK 사용

> **의존성**: Phase 4 필수, Phase 2 권장 ⚠️
> **병렬 가능**: Phase 3 (테스트)와 동시 진행 가능 ⭐
> **추천 에이전트**: `@crewx_codex_dev` (리팩토링 - 꼼꼼한 확인)
> **대안 에이전트**: `@crewx_claude_dev` (통합 로직 - 융통성)
> **예상 소요**: 3-4시간
> **작업 범위**: query.handler.ts를 SDK 기반으로 리팩토링
> **목표**: 실제 CLI 명령어가 SDK AgentRuntime을 사용하도록 변경
> **병렬 전략**: Phase 3 테스트와 동시에 CLI 통합 작업 가능
> **주의**: 실제 AI 호출 테스트는 Phase 2 완료 후에만 가능

### 5.1 문제 분석

**현재 query.handler.ts 흐름:**
```typescript
// 1. 멘션 파싱 (자체 로직)
const parsedQueries = parseMentions(queryInput);

// 2. CrewXTool 호출 (복잡한 로직)
const result = await crewXTool.queryAgent({
  agentId,
  query,
  context,
  model,
  messages,
});

// 3. 결과 포맷팅
formatSingleAgentResult(result);
```

**문제점:**
- CLI가 자체 멘션 파싱 (SDK에 동일 기능 있음)
- CrewXTool이 SDK 없이 직접 Provider 호출
- SDK와 CLI가 중복 로직 유지

**목표 구조:**
```typescript
// 1. SDK AgentRuntime 사용 (멘션 파싱 포함!)
const result = await agentRuntimeService.query(
  '@backend analyze this code' // SDK가 자동 파싱!
);

// 2. 결과 포맷팅만 CLI가 담당
formatSingleAgentResult(result);
```

### 5.2 간단한 쿼리는 SDK 사용

**파일**: `packages/cli/src/cli/query.handler.ts` (수정)

```typescript
import { AgentRuntimeService } from '../services/agent-runtime.service';

export async function handleQuery(app: any, args: CliOptions) {
  const agentRuntimeService = app.get(AgentRuntimeService);
  const crewXTool = app.get(CrewXTool);

  // ... 기존 파이프 입력, 쓰레드 처리 로직 ...

  const queryStr = Array.isArray(args.query) ? args.query[0] : args.query;

  // ✅ 간단한 경우: SDK 사용 (템플릿 처리 불필요)
  const useSDK = !args.thread && !contextFromPipe && parsedQueries.length === 1;

  if (useSDK && agentRuntimeService.isReady()) {
    console.log('🎯 Using SDK AgentRuntime (simplified path)');

    try {
      // ✅ SDK가 멘션 파싱, Provider 호출, 결과 반환까지 처리!
      const result = await agentRuntimeService.query(queryStr);

      if (!result.success) {
        console.error(`Error: ${result.metadata?.error || 'Query failed'}`);
        process.exit(1);
      }

      // 결과 출력
      if (args.raw) {
        console.log(result.content);
      } else {
        console.log(`\n📊 Results from SDK AgentRuntime:`);
        console.log('═'.repeat(60));
        console.log(`🟢 Status: Success`);
        console.log(`🤖 Agent: @${result.agentId}`);
        console.log('\n📄 Response:');
        console.log('─'.repeat(40));
        console.log(result.content);
        console.log('\n✅ Query completed via SDK');
      }

      return;
    } catch (error) {
      console.error(`SDK query failed, falling back to CrewXTool`);
      // Fall through to CrewXTool path
    }
  }

  // ❌ 복잡한 경우: 기존 CrewXTool 사용 (템플릿, 레이아웃, 보안 처리 필요)
  console.log('📋 Using CrewXTool (full-featured path)');

  // ... 기존 CrewXTool 로직 유지 ...
}
```

### 5.3 점진적 마이그레이션 전략

**Phase 5.1 (즉시):**
- 간단한 쿼리만 SDK 사용
- 조건: 쓰레드 없음, 파이프 입력 없음, 단일 에이전트

**Phase 5.2 (향후):**
- SDK에 템플릿 처리 기능 추가
- SDK에 보안키 생성 기능 추가
- CrewXTool 로직을 SDK로 점진적 이관

**Phase 5.3 (장기):**
- CrewXTool 완전 제거
- CLI가 100% SDK 기반으로 동작

### 5.4 사용자 경험 개선

**명령어 실행 시:**
```bash
# 간단한 쿼리 - SDK 사용
$ crewx query "@backend analyze code"
🎯 Using SDK AgentRuntime (simplified path)
[실제 Claude 응답]
✅ Query completed via SDK

# 복잡한 쿼리 - CrewXTool 사용
$ crewx query "@backend analyze code" --thread my-session
📋 Using CrewXTool (full-featured path)
[기존 CrewXTool 로직]
```

### 5.5 완료 기준

- [ ] `query.handler.ts`에 SDK 사용 로직 추가
- [ ] 간단한 쿼리는 SDK AgentRuntime 사용
- [ ] 복잡한 쿼리는 CrewXTool fallback 유지
- [ ] 사용자에게 어느 경로를 사용하는지 표시
- [ ] 실제 AI 응답 정상 작동 확인
- [ ] 기존 기능 회귀 없음 (쓰레드, 파이프 등)

## 🚀 후속 작업

- WBS-19: SDK에 템플릿/레이아웃 처리 기능 추가
- WBS-20: CLI CrewXTool 로직을 SDK로 점진적 이관
- WBS-21: Remote Agent에서 SDK AgentRuntime 사용
- WBS-22: Multi-provider Agent 지원

---

## 📋 변경 이력

### 2025-10-20 (Codex 리뷰 반영)

**주요 변경사항:**
1. ⭐ **Provider를 선택사항으로 변경**: 필수에서 선택으로 (MockProvider 자동 fallback)
   - 기존 코드 호환성 유지 (`ParallelRunner` 등)
   - `new AgentRuntime()` 그대로 동작 ✅

2. ⭐ **이벤트 발행 개선**: `agentCompleted` 이벤트가 실제 Provider 결과 반영
   - 기존: 항상 `success: true`
   - 개선: `success: aiResponse.success`

3. ⭐ **완료 기준 강화**: 회귀 테스트 항목 추가
   - ParallelRunner 호환성 검증
   - 기존 테스트 통과 확인

**Codex 발견 이슈:**
- ❌ ParallelRunner가 Provider 없이 AgentRuntime 생성 → **해결: MockProvider 기본값**
- ⚠️ AIProvider 인터페이스에 execute 미정의 → **TODO: 향후 인터페이스 확장**
- ⚠️ createProviderFromConfig 미구현 → **TODO: Phase 1에서 구현 필요**

---

**마지막 업데이트**: 2025-10-20 (Codex 리뷰 반영)
