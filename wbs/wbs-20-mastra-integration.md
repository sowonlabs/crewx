# WBS-20: Mastra 통합 구현

**작성일**: 2025-11-11
**상태**: 📋 **계획**
**우선순위**: P0
**예상 소요**: 3일

---

## 📋 개요

### 목표
Mastra 프레임워크를 래핑하여 CrewX API Provider를 구현합니다.

### 배경
- **SowonFlow 히스토리**:
  - v1: LangGraph 기반 → ❌ 복잡성 문제
  - v2: Mastra 마이그레이션 → ✅ clientTool 매커니즘 발견
  - CrewX 탄생: SowonFlow + CLI/Slack 인터페이스

- **왜 Mastra인가?**:
  - Vercel AI SDK 기반 (CrewX와 동일)
  - TypeScript 네이티브
  - Tool calling 내장
  - 40+ Provider 지원
  - Gatsby 팀 개발 (검증됨)

### 전략
```
직접 구현 (WBS-20~25): 17-23일
             ↓
Mastra 래핑 (WBS-20): 3일
             ↓
절감: 14-20일 (85%)
```

---

## 🏗️ 아키텍처

### 통합 구조

```
┌─────────────────────────────────────────────┐
│             CrewX Layer                     │
│  - YAML 파싱 (agents.yaml)                  │
│  - CLI 인터페이스 (crewx query)             │
│  - Slack 인터페이스 (/crewx)                │
│  - Agent Registry (앱스토어)                │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         MastraAPIProvider                   │
│  - CrewX ↔ Mastra 변환 레이어               │
│  - Config → Mastra Agent 초기화             │
│  - Tools 변환 (FrameworkTool → Mastra)      │
│  - Response 변환 (Mastra → AIResponse)      │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│              Mastra Core                    │
│  - Agent orchestration                      │
│  - Tool calling (내장)                      │
│  - Streaming (내장)                         │
│  - 40+ Provider 지원                        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│          Vercel AI SDK                      │
│  - generateText / streamText                │
│  - Model abstraction                        │
│  - Tool execution                           │
└─────────────────────────────────────────────┘
```

---

## 📦 Phase 1: 의존성 추가 (0.5일)

### 1.1 Mastra 패키지 설치

```bash
cd packages/sdk
npm install @mastra/core ai zod
```

### 1.2 package.json 업데이트

```json
{
  "name": "@sowonai/crewx-sdk",
  "dependencies": {
    "@mastra/core": "^0.1.0",
    "ai": "^3.0.0",
    "zod": "^3.22.0",
    "js-yaml": "^4.1.0",
    // ... 기존 의존성
  }
}
```

### 1.3 TypeScript 타입 확인

```bash
npx tsc --noEmit
# ✅ 컴파일 성공 확인
```

---

## 🔧 Phase 2: MastraAPIProvider 구현 (1일)

### 2.1 파일 구조

```
packages/sdk/src/
├── core/
│   └── providers/
│       ├── BaseAIProvider.ts           # 기존
│       ├── CLIProvider.ts              # 기존
│       └── MastraAPIProvider.ts        # ✨ 신규
├── adapters/
│   └── MastraToolAdapter.ts            # ✨ 신규
└── types/
    └── api-provider.types.ts           # 기존 (수정 없음)
```

### 2.2 MastraAPIProvider 구현

```typescript
// packages/sdk/src/core/providers/MastraAPIProvider.ts

import { Agent } from '@mastra/core';
import {
  createOpenAI,
  createAnthropic,
  createGoogle,
  // ... 기타 Provider
} from 'ai';
import { BaseAIProvider } from './BaseAIProvider';
import { APIProviderConfig } from '../../types/api-provider.types';
import { MastraToolAdapter } from '../../adapters/MastraToolAdapter';

/**
 * Mastra 프레임워크를 래핑한 API Provider
 *
 * @example
 * ```typescript
 * const provider = new MastraAPIProvider({
 *   agentId: 'researcher',
 *   provider: 'api/openai',
 *   model: 'gpt-4',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * const result = await provider.query('최신 AI 뉴스 조사해줘');
 * ```
 */
export class MastraAPIProvider extends BaseAIProvider {
  private agent: Agent;
  private config: APIProviderConfig;

  constructor(config: APIProviderConfig) {
    super(config);
    this.config = config;

    // Mastra Agent 초기화
    this.agent = new Agent({
      name: config.agentId,
      model: this.createModel(config),
      instructions: config.systemPrompt || '',
      tools: [],  // 나중에 주입
    });
  }

  /**
   * Provider별 모델 생성
   */
  private createModel(config: APIProviderConfig) {
    const { provider, model, apiKey, url } = config;

    switch (provider) {
      case 'api/openai':
        return createOpenAI({
          apiKey: apiKey,
          baseURL: url,
        })(model);

      case 'api/anthropic':
        return createAnthropic({
          apiKey: apiKey,
        })(model);

      case 'api/google':
        return createGoogle({
          apiKey: apiKey,
        })(model);

      case 'api/bedrock':
        // AWS Bedrock 설정
        return createAnthropic({
          baseURL: url || 'https://bedrock-runtime.us-east-1.amazonaws.com',
          apiKey: apiKey,
        })(model);

      case 'api/litellm':
        // LiteLLM은 OpenAI 호환 API
        return createOpenAI({
          baseURL: url || 'http://localhost:4000',
          apiKey: apiKey || 'dummy',
        })(model);

      case 'api/ollama':
        // Ollama는 OpenAI 호환 API
        return createOpenAI({
          baseURL: url || 'http://localhost:11434/v1',
          apiKey: apiKey || 'ollama',
        })(model);

      case 'api/sowonai':
        // SowonAI custom provider
        return createOpenAI({
          baseURL: url,
          apiKey: apiKey,
        })(model);

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Tool 주입
   */
  setTools(tools: any[], context: any) {
    const mastraTools = MastraToolAdapter.convertTools(tools, context);
    this.agent.tools = mastraTools;
  }

  /**
   * Query 실행 (사용자 질문)
   */
  async query(input: string, context?: any): Promise<any> {
    try {
      const result = await this.agent.generate(input, {
        // Mastra context 전달
        context: context || {},
      });

      return this.convertResponse(result);
    } catch (error) {
      return {
        content: '',
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
        },
      };
    }
  }

  /**
   * Execute 실행 (에이전트 태스크)
   */
  async execute(task: string, context?: any): Promise<any> {
    // API Provider는 query와 execute 동일
    return this.query(task, context);
  }

  /**
   * Streaming 지원
   */
  async *stream(input: string, context?: any): AsyncGenerator<any> {
    const stream = await this.agent.stream(input, {
      context: context || {},
    });

    for await (const chunk of stream) {
      yield this.convertStreamChunk(chunk);
    }
  }

  /**
   * Mastra 응답 → CrewX AIResponse 변환
   */
  private convertResponse(mastraResult: any) {
    return {
      content: mastraResult.text || '',
      success: true,
      messages: mastraResult.messages || [],

      // 선택적 메타데이터
      metadata: {
        model: this.config.model,
        provider: this.config.provider,
        usage: mastraResult.usage,
      },
    };
  }

  /**
   * Streaming chunk 변환
   */
  private convertStreamChunk(chunk: any) {
    return {
      type: chunk.type,
      content: chunk.content,
      delta: chunk.delta,
    };
  }
}
```

---

## 🔌 Phase 3: Tool 어댑터 (0.5일)

### 3.1 MastraToolAdapter 구현

```typescript
// packages/sdk/src/adapters/MastraToolAdapter.ts

import { tool as mastraTool } from '@mastra/core';
import { z } from 'zod';
import {
  FrameworkToolDefinition,
  ToolExecutionContext
} from '../types/api-provider.types';

/**
 * CrewX Tool ↔ Mastra Tool 변환 어댑터
 */
export class MastraToolAdapter {
  /**
   * 여러 도구를 한 번에 변환
   */
  static convertTools(
    crewxTools: FrameworkToolDefinition[],
    context: ToolExecutionContext
  ) {
    return crewxTools.map(tool =>
      this.convertTool(tool, context)
    );
  }

  /**
   * CrewX FrameworkToolDefinition → Mastra tool
   */
  static convertTool(
    crewxTool: FrameworkToolDefinition,
    context: ToolExecutionContext
  ) {
    return mastraTool({
      id: crewxTool.name,
      description: crewxTool.description,

      // Zod schema 변환
      parameters: this.convertParameters(crewxTool.parameters),

      // CrewX context를 주입하여 execute 호출
      execute: async (args: any) => {
        return crewxTool.execute(args, context);
      },
    });
  }

  /**
   * Parameters 변환 (Zod schema 그대로 사용)
   */
  private static convertParameters(params: any): z.ZodSchema {
    // 이미 Zod schema라면 그대로 반환
    if (params && typeof params.parse === 'function') {
      return params;
    }

    // JSON Schema → Zod 변환 (필요시)
    // TODO: 향후 구현
    return z.object({});
  }
}
```

### 3.2 Context 주입 예시

```typescript
// CrewX에서 Tool 사용 예시

import { tool } from '@mastra/core';
import { z } from 'zod';

const searchTool: FrameworkToolDefinition = {
  name: 'search',
  description: 'Search the web',

  parameters: z.object({
    query: z.string().describe('Search query'),
  }),

  execute: async (args, context) => {
    // context는 MastraToolAdapter가 주입
    console.log('Agent ID:', context.agent.id);
    console.log('Vars:', context.vars);
    console.log('Env:', context.env);

    // 실제 검색 로직
    const results = await fetch(`https://api.search.com?q=${args.query}`);
    return results.json();
  },
};
```

---

## 🏭 Phase 4: Agent Factory 수정 (0.5일)

### 4.1 AgentFactory 업데이트

```typescript
// packages/sdk/src/agent/AgentFactory.ts

import { MastraAPIProvider } from '../core/providers/MastraAPIProvider';
import { CLIProvider } from '../core/providers/CLIProvider';
import { AgentConfig } from '../types';

export class AgentFactory {
  static createAgent(config: AgentConfig) {
    // API Provider → Mastra 사용
    if (config.provider?.startsWith('api/')) {
      return new MastraAPIProvider(config);
    }

    // CLI Provider → 기존 방식
    if (config.provider?.startsWith('cli/')) {
      return new CLIProvider(config);
    }

    throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

### 4.2 YAML 파싱 (변경 없음)

```yaml
# agents.yaml - 기존 스펙 그대로

agents:
  - id: researcher
    provider: api/openai  # ← MastraAPIProvider 자동 선택
    model: gpt-4
    system_prompt: "You are a research assistant"
    tools: [search, scrape]

  - id: coder
    provider: cli/claude  # ← CLIProvider 선택
    # ...
```

---

## 🧪 Phase 5: 통합 테스트 (0.5일)

### 5.1 단위 테스트

```typescript
// packages/sdk/tests/unit/MastraAPIProvider.test.ts

import { describe, it, expect } from 'vitest';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';

describe('MastraAPIProvider', () => {
  it('should initialize with OpenAI config', () => {
    const provider = new MastraAPIProvider({
      agentId: 'test',
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: 'test-key',
    });

    expect(provider).toBeDefined();
  });

  it('should execute query', async () => {
    const provider = new MastraAPIProvider({
      agentId: 'test',
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await provider.query('Hello');

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  });
});
```

### 5.2 통합 테스트 (7가지 Provider)

```typescript
// packages/sdk/tests/integration/providers.test.ts

import { describe, it } from 'vitest';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';

const providers = [
  { name: 'OpenAI', provider: 'api/openai', model: 'gpt-4' },
  { name: 'Anthropic', provider: 'api/anthropic', model: 'claude-3-5-sonnet-20241022' },
  { name: 'Google', provider: 'api/google', model: 'gemini-1.5-pro' },
  { name: 'Bedrock', provider: 'api/bedrock', model: 'anthropic.claude-v2' },
  { name: 'LiteLLM', provider: 'api/litellm', model: 'gpt-4' },
  { name: 'Ollama', provider: 'api/ollama', model: 'llama2' },
  { name: 'SowonAI', provider: 'api/sowonai', model: 'custom-model' },
];

describe('All Providers', () => {
  providers.forEach(({ name, provider, model }) => {
    it(`should work with ${name}`, async () => {
      const p = new MastraAPIProvider({
        agentId: 'test',
        provider,
        model,
        apiKey: process.env[`${name.toUpperCase()}_API_KEY`],
      });

      const result = await p.query('Hello');
      expect(result.success).toBe(true);
    });
  });
});
```

### 5.3 Tool Calling 테스트

```typescript
// packages/sdk/tests/integration/tool-calling.test.ts

import { describe, it, expect } from 'vitest';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';
import { z } from 'zod';

describe('Tool Calling', () => {
  it('should execute tool', async () => {
    const provider = new MastraAPIProvider({
      agentId: 'test',
      provider: 'api/openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 간단한 계산 도구
    const calcTool = {
      name: 'calculate',
      description: 'Calculate math expression',
      parameters: z.object({
        expr: z.string(),
      }),
      execute: async ({ expr }) => {
        return eval(expr);
      },
    };

    provider.setTools([calcTool], {
      agent: { id: 'test' },
      vars: {},
      env: {},
    });

    const result = await provider.query('What is 2 + 2?');

    expect(result.success).toBe(true);
    expect(result.content).toContain('4');
  });
});
```

---

## 📊 완료 조건

### 필수 (P0)
- [ ] Mastra 의존성 설치 완료
- [ ] MastraAPIProvider 구현 완료
- [ ] MastraToolAdapter 구현 완료
- [ ] AgentFactory 수정 완료
- [ ] 7가지 Provider 모두 작동 확인
- [ ] Tool calling 테스트 통과
- [ ] CLI/Slack 인터페이스 검증

### 선택 (P1)
- [ ] Streaming 지원 구현
- [ ] Error handling 강화
- [ ] 성능 최적화

---

## 🎯 성공 지표

1. **개발 속도**: 3일 이내 완료 (목표 달성)
2. **테스트 통과율**: 100% (7/7 Provider)
3. **코드 커버리지**: 80% 이상
4. **Breaking Change**: 0건 (기존 CLI Provider 영향 없음)

---

## 🚧 알려진 제약사항

### 1. Mastra 버전 의존성
- Mastra는 아직 v0.x (불안정)
- Breaking change 가능성 있음
- **대응**: 버전 고정 (`@mastra/core@^0.1.0`)

### 2. Provider별 차이점
- Bedrock은 AWS 인증 필요
- Ollama는 로컬 서버 필요
- **대응**: 상세한 설정 문서 작성

### 3. Tool calling 제약
- Mastra tool signature가 Vercel AI SDK와 약간 다름
- **대응**: MastraToolAdapter로 변환

---

## 📚 참고 자료

### Mastra 문서
- [Mastra 공식 문서](https://mastra.ai/docs)
- [Mastra + Vercel AI SDK](https://mastra.ai/docs/frameworks/agentic-uis/ai-sdk)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)

### 내부 문서
- [WBS-19 설계 문서](wbs-19-design-document.md)
- [WBS-19 최종 상태](wbs-19-final-status.md)
- [앱스토어 비전](wbs-19-appstore-vision.md)

---

## 🔄 다음 단계: WBS-21

WBS-20 완료 후:
- ~~WBS-21: Tool Calling 시스템~~ → ✅ Mastra가 제공 (생략)
- ~~WBS-22: MCP 통합~~ → ✅ Mastra MCP 활용 (간소화)
- WBS-23: YAML 파싱 및 Agent 생성 (2-3일)
- WBS-24: CLI 통합 (1-2일)

**총 절감**: 7-9일 → 3-5일 (50% 단축)

---

**작성자**: Claude (WBS-19 설계 에이전트)
**최종 업데이트**: 2025-11-11
