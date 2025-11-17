# WBS-28: CLI/API Provider 스펙 호환성 설계

> **상태**: 🟡 진행중 (에이전트 논의 단계)
> **우선순위**: P0
> **소요 기간**: 3-4일
> **디펜던시**: WBS-26 (문서화 완료)

---

## 📋 작업 개요

### 목표
CLI Provider와 API Provider의 `options` 스펙을 통합하여 일관된 사용자 경험 제공 및 마이그레이션 용이성 확보

### 배경 및 동기
- **문제점**:
  - CLI Provider: `options.query`, `options.execute` (spawn 파라미터)
  - API Provider: Tool 기반 제어 필요 (spawn 없음)
  - LLM이 위험한 작업 실수로 수행 (DB 삭제 등)
- **현재 상황**: 두 Provider의 options 구조가 다름
- **요구사항**:
  1. 기존 CLI Provider 사용자가 쉽게 API Provider로 마이그레이션
  2. 두 Provider 모두 query/execute 개념 유지
  3. API Provider는 Tool 권한을 세밀하게 제어

### 핵심 요구사항
1. **스펙 통합**: CLI/API Provider options 구조 통일 또는 명확한 매핑
2. **하위 호환성**: 기존 CLI Provider 설정 유지
3. **Tool 권한 제어**: API Provider에서 모드별 Tool 필터링
4. **마이그레이션 경로**: CLI → API 전환 시나리오 명확화
5. **확장성**: 향후 새로운 Provider 타입 추가 가능

---

## 🎯 설계 목표

### 1. 안전성 우선 (Safety First)
```yaml
# 기본값: 아무 도구도 허용하지 않음
agents:
  - name: safe_agent
    provider: api/anthropic
    # tools 설정 없음 → 기본값으로 빈 배열
```

### 2. 명시적 권한 부여 (Explicit Permission)
```yaml
# 사용자가 명시적으로 허용한 도구만 사용 가능
agents:
  - name: developer_agent
    provider: api/anthropic
    options:
      tools:
        query: [read_file, grep, glob]     # 읽기만
        execute: [read_file, write_file, bash]  # 쓰기 포함
```

### 3. 모드 구분 유지 (Mode Separation)
```bash
# query 모드: tools.query 사용
crewx q "@agent analyze this code"

# execute 모드: tools.execute 사용
crewx execute "@agent fix this bug"
```

---

## 🏗️ 제안하는 설계 방안

### 방안 1: 모드별 Tool 배열 (추천!)

#### YAML 스펙
```yaml
agents:
  - name: claude_api
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:
        query: [read_file, grep, glob]         # query 모드에서 허용
        execute: [read_file, write_file, bash] # execute 모드에서 허용
```

#### TypeScript 타입
```typescript
interface APIProviderOptions {
  tools?: {
    query?: string[];      // query 모드 허용 Tool (기본값: [])
    execute?: string[];    // execute 모드 허용 Tool (기본값: [])
    [mode: string]?: string[];  // 향후 커스텀 모드 확장
  };
  // ... other options
}
```

#### 내부 구현 로직
```typescript
class MastraAPIProvider {
  async query(prompt: string, context: AgentContext): Promise<AIResponse> {
    const mode = 'query';
    const allowedTools = this.getToolsForMode(mode);  // config.options.tools?.query || []

    // allowedTools만 Mastra Agent에 주입
    const mastraTools = this.filterAndConvertTools(allowedTools);

    return this.agent.generate({ prompt, tools: mastraTools });
  }

  async execute(prompt: string, context: AgentContext): Promise<AIResponse> {
    const mode = 'execute';
    const allowedTools = this.getToolsForMode(mode);  // config.options.tools?.execute || []

    const mastraTools = this.filterAndConvertTools(allowedTools);

    return this.agent.generate({ prompt, tools: mastraTools });
  }
}
```

#### 장점
- ✅ 명시적이고 직관적 (query는 읽기, execute는 쓰기)
- ✅ CLI Provider의 query/execute 개념과 자연스럽게 연결
- ✅ 기본값 안전 (빈 배열)
- ✅ 향후 커스텀 모드 추가 가능 (tools.analyze, tools.fix 등)

#### 단점
- ⚠️ 설정 다소 장황 (하지만 안전을 위해 필요)

---

### 방안 2: include/exclude 패턴 (복잡함)

```yaml
agents:
  - name: claude_api
    provider: api/anthropic
    options:
      tools:
        query:
          include: [read_file, grep]
          exclude: []
        execute:
          include: [read_file, write_file]
          exclude: [bash]  # bash는 위험해서 제외
```

#### 장점
- ✅ 세밀한 제어 (화이트리스트 + 블랙리스트)

#### 단점
- ❌ 복잡함 (include/exclude 동시 관리)
- ❌ 사용자 혼란 (어떤 게 우선순위?)
- ❌ 구현 복잡도 증가

**결론**: 방안 1이 더 단순하고 명확함

---

### 방안 3: 단일 tools 배열 + 모드 자동 판단 (안전하지 않음)

```yaml
agents:
  - name: claude_api
    provider: api/anthropic
    options:
      tools: [read_file, write_file, bash]  # execute 모드에서만 사용
```

#### 내부 로직
```typescript
if (mode === 'query') {
  tools = [];  // query는 무조건 빈 배열
} else {
  tools = config.options.tools || [];
}
```

#### 장점
- ✅ 설정 간단

#### 단점
- ❌ query 모드에서 Tool 사용 불가 (때로는 read_file 필요)
- ❌ 유연성 부족
- ❌ 사용자 의도를 명확히 표현하기 어려움

**결론**: 방안 1이 더 유연하고 안전함

---

## 📊 최종 추천: 방안 1 (모드별 Tool 배열)

### 이유
1. **안전성**: 기본값 빈 배열, 명시적으로만 추가
2. **명확성**: query/execute 구분이 명확
3. **호환성**: CLI Provider 개념과 일치
4. **확장성**: 커스텀 모드 추가 가능
5. **직관성**: 개발자가 쉽게 이해 가능

---

## 🔧 구현 계획

### Phase 1: 타입 및 스키마 업데이트 (0.5일)

#### 1.1. TypeScript 타입 확장
```typescript
// packages/sdk/src/types/api-provider.types.ts

export interface APIProviderOptions {
  // ... existing fields

  /**
   * Tool 권한 제어 (모드별)
   *
   * @example
   * ```yaml
   * tools:
   *   query: [read_file, grep]
   *   execute: [read_file, write_file, bash]
   * ```
   */
  tools?: {
    /** query 모드에서 허용할 Tool 목록 (기본값: []) */
    query?: string[];

    /** execute 모드에서 허용할 Tool 목록 (기본값: []) */
    execute?: string[];

    /** 향후 커스텀 모드 확장용 */
    [customMode: string]?: string[];
  };
}
```

#### 1.2. Zod 스키마 업데이트
```typescript
// packages/sdk/src/schemas/api-provider.schema.ts

const toolPermissionsSchema = z.object({
  query: z.array(z.string()).optional().default([]),
  execute: z.array(z.string()).optional().default([]),
}).catchall(z.array(z.string())).optional();  // 커스텀 모드 허용

export const apiProviderOptionsSchema = z.object({
  // ... existing fields
  tools: toolPermissionsSchema,
});
```

#### 1.3. JSON Schema 업데이트
```json
{
  "properties": {
    "tools": {
      "type": "object",
      "description": "Tool 권한 제어 (모드별)",
      "properties": {
        "query": {
          "type": "array",
          "items": { "type": "string" },
          "description": "query 모드에서 허용할 Tool",
          "default": []
        },
        "execute": {
          "type": "array",
          "items": { "type": "string" },
          "description": "execute 모드에서 허용할 Tool",
          "default": []
        }
      },
      "additionalProperties": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

**산출물**:
- `packages/sdk/src/types/api-provider.types.ts` 업데이트
- `packages/sdk/src/schemas/api-provider.schema.ts` 업데이트
- `packages/sdk/schema/api-provider-config.json` 업데이트

---

### Phase 2: MastraAPIProvider 구현 (1일)

#### 2.1. Tool 필터링 로직
```typescript
// packages/sdk/src/core/providers/MastraAPIProvider.ts

export class MastraAPIProvider extends BaseAPIProvider {
  /**
   * 모드에 따라 허용된 Tool 목록 가져오기
   */
  private getToolsForMode(mode: 'query' | 'execute' | string): string[] {
    const toolPermissions = this.config.options?.tools;

    if (!toolPermissions) {
      return [];  // 기본값: 빈 배열 (안전)
    }

    return toolPermissions[mode] || [];
  }

  /**
   * 허용된 Tool만 필터링하여 Mastra Tool로 변환
   */
  private filterAndConvertTools(
    allowedToolNames: string[],
    context: ToolExecutionContext
  ): MastraTool[] {
    // 1. CrewX 등록된 Tool 가져오기
    const allTools = this.toolRegistry.getAllTools();

    // 2. 허용된 Tool만 필터링
    const allowedTools = allTools.filter(tool =>
      allowedToolNames.includes(tool.name)
    );

    // 3. Mastra Tool로 변환 (MastraToolAdapter 사용)
    return allowedTools.map(tool =>
      MastraToolAdapter.convertToMastraTool(tool, context)
    );
  }

  async query(prompt: string, context: AgentContext): Promise<AIResponse> {
    const allowedToolNames = this.getToolsForMode('query');
    const mastraTools = this.filterAndConvertTools(
      allowedToolNames,
      this.createToolContext(context)
    );

    // Mastra Agent에 필터된 Tool만 주입
    return this.mastraAgent.generate({
      prompt,
      tools: mastraTools,
    });
  }

  async execute(prompt: string, context: AgentContext): Promise<AIResponse> {
    const allowedToolNames = this.getToolsForMode('execute');
    const mastraTools = this.filterAndConvertTools(
      allowedToolNames,
      this.createToolContext(context)
    );

    return this.mastraAgent.generate({
      prompt,
      tools: mastraTools,
    });
  }
}
```

#### 2.2. 로깅 및 보안 강화
```typescript
private filterAndConvertTools(
  allowedToolNames: string[],
  context: ToolExecutionContext
): MastraTool[] {
  // 보안 로깅
  this.logger.info(`[Security] Allowed tools for mode '${context.mode}':`, allowedToolNames);

  const allTools = this.toolRegistry.getAllTools();
  const allowedTools = allTools.filter(tool => {
    const isAllowed = allowedToolNames.includes(tool.name);

    if (!isAllowed && tool.dangerous) {
      this.logger.warn(`[Security] Blocked dangerous tool: ${tool.name}`);
    }

    return isAllowed;
  });

  // 허용되지 않은 Tool 요청 시 경고
  const requestedButDenied = allowedToolNames.filter(name =>
    !allTools.some(t => t.name === name)
  );

  if (requestedButDenied.length > 0) {
    this.logger.warn(`[Security] Requested tools not found:`, requestedButDenied);
  }

  return allowedTools.map(tool =>
    MastraToolAdapter.convertToMastraTool(tool, context)
  );
}
```

**산출물**:
- `packages/sdk/src/core/providers/MastraAPIProvider.ts` 업데이트 (Tool 필터링 로직 추가)

---

### Phase 3: YAML 파서 업데이트 (0.5일)

#### 3.1. 파싱 로직 검증
```typescript
// packages/sdk/src/config/api-provider-parser.ts

export function parseAPIProviderConfig(yamlConfig: any): APIProviderConfig {
  // Zod validation (tools 필드 검증 포함)
  const validatedConfig = apiProviderOptionsSchema.parse(yamlConfig.options);

  // 기본값 처리
  const tools = validatedConfig.tools || { query: [], execute: [] };

  return {
    ...validatedConfig,
    tools,
  };
}
```

**산출물**:
- `packages/sdk/src/config/api-provider-parser.ts` 검증 (이미 구현되어 있을 가능성 높음)

---

### Phase 4: 문서화 및 예제 (0.5일)

#### 4.1. 사용 가이드 업데이트
````markdown
## Tool 권한 제어

### 개요
API Provider는 LLM이 사용할 수 있는 Tool을 모드별로 세밀하게 제어합니다.

### 기본 동작 (안전 우선)
```yaml
agents:
  - name: safe_agent
    provider: api/anthropic
    # tools 설정 없음 → 기본값으로 빈 배열 (도구 사용 불가)
```

### 읽기 전용 Agent (Query 모드)
```yaml
agents:
  - name: analyst
    provider: api/anthropic
    options:
      tools:
        query: [read_file, grep, glob]  # 읽기만 가능
        execute: []                     # 쓰기 불가
```

```bash
# 안전하게 코드 분석
crewx q "@analyst analyze this codebase"
```

### 개발자 Agent (Execute 모드)
```yaml
agents:
  - name: developer
    provider: api/anthropic
    options:
      tools:
        query: [read_file, grep]                    # 읽기
        execute: [read_file, write_file, edit, bash] # 쓰기 포함
```

```bash
# 버그 수정 (쓰기 권한 필요)
crewx execute "@developer fix bug #123"
```

### 하이브리드 Agent (신중하게!)
```yaml
agents:
  - name: hybrid_agent
    provider: api/anthropic
    options:
      tools:
        query: [read_file, bash]  # bash를 query에 허용 (주의!)
        execute: [read_file, write_file, bash]
```

⚠️ **경고**: query 모드에 bash를 허용하면 읽기 작업 중에도 명령어 실행 가능!

### 보안 권장 사항

#### ✅ 안전한 설정
```yaml
# 분석 전용
tools:
  query: [read_file, grep, glob]
  execute: []

# 파일 수정만
tools:
  query: [read_file]
  execute: [read_file, write_file, edit]

# 읽기 + 빌드 테스트
tools:
  query: [read_file]
  execute: [read_file, write_file, bash]
```

#### ❌ 위험한 설정
```yaml
# query에 쓰기 도구 허용 (위험!)
tools:
  query: [read_file, write_file, bash]  # ❌ query는 읽기만 권장

# execute에 모든 도구 허용 (신중하게!)
tools:
  execute: [read_file, write_file, edit, bash, delete_file]  # ⚠️ 삭제 가능
```

### 향후 확장: 커스텀 모드
```yaml
agents:
  - name: advanced_agent
    provider: api/anthropic
    options:
      tools:
        query: [read_file]
        execute: [read_file, write_file]
        analyze: [read_file, grep, glob]  # 커스텀 모드
        fix: [read_file, edit]             # 커스텀 모드
```

```bash
# 향후 지원 예정
crewx --mode analyze "@agent deep analysis"
crewx --mode fix "@agent quick fix"
```
````

#### 4.2. 예제 추가
```yaml
# examples/api-agent-tools/crewx-tool-permissions.yaml

agents:
  # 읽기 전용 분석가
  - name: read_only_analyst
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:
        query: [read_file, grep, glob]
        execute: []

  # 신중한 개발자
  - name: cautious_developer
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:
        query: [read_file]
        execute: [read_file, write_file, edit]  # bash 제외

  # 풀스택 개발자 (주의!)
  - name: fullstack_developer
    provider: api/anthropic
    model: claude-sonnet-4
    options:
      tools:
        query: [read_file, grep]
        execute: [read_file, write_file, edit, bash]  # 모든 도구 허용
```

**산출물**:
- `docs/api-provider-guide.md` 업데이트 (Tool 권한 제어 섹션 추가)
- `examples/api-agent-tools/crewx-tool-permissions.yaml` 예제 추가
- `examples/api-agent-tools/README-tool-permissions.md` 설명 추가

---

### Phase 5: 테스트 (0.5일)

#### 5.1. 단위 테스트
```typescript
// packages/sdk/tests/unit/tool-permission-control.test.ts

describe('MastraAPIProvider Tool Permission Control', () => {
  it('should use empty tools by default', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/anthropic',
      model: 'claude-sonnet-4',
      options: {}  // tools 없음
    });

    const tools = provider['getToolsForMode']('query');
    expect(tools).toEqual([]);
  });

  it('should filter tools for query mode', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/anthropic',
      model: 'claude-sonnet-4',
      options: {
        tools: {
          query: ['read_file', 'grep'],
          execute: ['read_file', 'write_file', 'bash']
        }
      }
    });

    const queryTools = provider['getToolsForMode']('query');
    expect(queryTools).toEqual(['read_file', 'grep']);

    const executeTools = provider['getToolsForMode']('execute');
    expect(executeTools).toEqual(['read_file', 'write_file', 'bash']);
  });

  it('should block dangerous tools in query mode', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/anthropic',
      model: 'claude-sonnet-4',
      options: {
        tools: {
          query: ['read_file'],  // bash 없음
          execute: ['read_file', 'bash']
        }
      }
    });

    const context = { mode: 'query', agentName: 'test' };
    const mastraTools = provider['filterAndConvertTools'](['bash'], context);

    expect(mastraTools).toHaveLength(0);  // bash 차단됨
  });

  it('should support custom modes', async () => {
    const provider = new MastraAPIProvider({
      provider: 'api/anthropic',
      model: 'claude-sonnet-4',
      options: {
        tools: {
          analyze: ['read_file', 'grep', 'glob'],
          fix: ['read_file', 'edit']
        }
      }
    });

    const analyzeTools = provider['getToolsForMode']('analyze');
    expect(analyzeTools).toEqual(['read_file', 'grep', 'glob']);

    const fixTools = provider['getToolsForMode']('fix');
    expect(fixTools).toEqual(['read_file', 'edit']);
  });
});
```

#### 5.2. 통합 테스트
```typescript
// packages/sdk/tests/integration/tool-permission-e2e.test.ts

describe('Tool Permission Control E2E', () => {
  it('should prevent write operations in query mode', async () => {
    const config = {
      agents: [{
        name: 'safe_agent',
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          tools: {
            query: ['read_file'],      // 읽기만
            execute: ['read_file', 'write_file']
          }
        }
      }]
    };

    const agent = await AgentFactory.createAgent(config.agents[0]);

    // query 모드: write_file 사용 불가
    const response = await agent.query('Write hello to test.txt');
    expect(response.toolsUsed).not.toContain('write_file');

    // execute 모드: write_file 사용 가능
    const executeResponse = await agent.execute('Write hello to test.txt');
    expect(executeResponse.toolsUsed).toContain('write_file');
  });
});
```

#### 5.3. 보안 테스트
```typescript
describe('Security Tests', () => {
  it('should log warnings for dangerous tool attempts', async () => {
    const logger = jest.spyOn(console, 'warn');

    const provider = new MastraAPIProvider({
      provider: 'api/anthropic',
      model: 'claude-sonnet-4',
      options: {
        tools: {
          query: ['read_file']  // bash 없음
        }
      }
    });

    // LLM이 bash 시도 (하지만 차단됨)
    await provider.query('Run bash command');

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('Blocked dangerous tool: bash')
    );
  });
});
```

**산출물**:
- `packages/sdk/tests/unit/tool-permission-control.test.ts` (단위 테스트)
- `packages/sdk/tests/integration/tool-permission-e2e.test.ts` (통합 테스트)
- `packages/sdk/tests/security/tool-permission-security.test.ts` (보안 테스트)

---

## 📄 완료 조건

- [ ] TypeScript 타입 확장 완료 (APIProviderOptions.tools)
- [ ] Zod 스키마 업데이트 완료
- [ ] JSON Schema 업데이트 완료 (VSCode 자동완성 지원)
- [ ] MastraAPIProvider에 Tool 필터링 로직 추가
- [ ] 보안 로깅 추가
- [ ] YAML 파서 검증 완료
- [ ] 사용 가이드 업데이트 (Tool 권한 제어 섹션)
- [ ] 예제 추가 (3가지 시나리오: 읽기 전용, 신중한 개발자, 풀스택 개발자)
- [ ] 단위 테스트 작성 (15+ test cases)
- [ ] 통합 테스트 작성 (5+ E2E scenarios)
- [ ] 보안 테스트 작성 (3+ security tests)
- [ ] TypeScript 컴파일 성공
- [ ] 모든 테스트 통과 (20+ tests)

---

## 🎯 의사결정 필요 사항

### 1. 기본값 정책
- **옵션 A**: `tools` 필드 없으면 기본값 `{ query: [], execute: [] }` (안전 우선) ✅ **추천**
- **옵션 B**: `tools` 필드 없으면 모든 도구 허용 (편리하지만 위험)

**추천**: 옵션 A (안전 우선)

---

### 2. 커스텀 모드 지원 시점
- **옵션 A**: Phase 1부터 타입에 포함 (`[mode: string]?: string[]`) ✅ **추천**
- **옵션 B**: WBS-29에서 별도 구현

**추천**: 옵션 A (타입만 추가, 실제 사용은 나중에)

---

### 3. Tool 위험도 표시
- **옵션 A**: Tool 정의에 `dangerous: boolean` 플래그 추가
  ```typescript
  const bashTool = {
    name: 'bash',
    dangerous: true,  // 위험한 도구 표시
    // ...
  };
  ```
- **옵션 B**: 위험도 표시 없이 사용자 책임

**추천**: 옵션 A (향후 WBS-29에서 구현 고려)

---

### 4. query 모드에서 bash 허용 여부
- **옵션 A**: 사용자가 명시적으로 추가하면 허용 (경고 로그만) ✅ **추천**
- **옵션 B**: query 모드에서 bash 절대 불가 (하드코딩)

**추천**: 옵션 A (유연성 제공, 경고는 충분히)

---

### 5. Tool 필터링 실패 시 동작
- **옵션 A**: 경고 로그만 출력하고 계속 진행 ✅ **추천**
- **옵션 B**: 에러 발생 및 작업 중단

**추천**: 옵션 A (LLM이 사용 가능한 도구로 대체 시도 가능)

---

## 📊 비교 분석

### CLI Provider vs API Provider Tool 제어

| 항목 | CLI Provider | API Provider (WBS-28) |
|------|--------------|------------------------|
| **Tool 제어 방식** | spawn 파라미터 (`--tools` 플래그) | YAML 설정 (tools.query/execute) |
| **모드 구분** | query/execute 명령어 구분 | 동일 (query/execute) |
| **기본값** | Provider별 다름 | 빈 배열 (안전 우선) |
| **세밀한 제어** | ❌ 불가능 (Provider 전체 설정) | ✅ 가능 (모드별 개별 설정) |
| **확장성** | ❌ 어려움 (spawn 한계) | ✅ 쉬움 (커스텀 모드 추가 가능) |

### 기존 스펙과의 호환성

#### CLI Provider (기존)
```yaml
agents:
  - name: claude
    provider: cli/claude
    options:
      query: "chat"       # query 모드 명령어
      execute: "execute"  # execute 모드 명령어
```

#### API Provider (WBS-28)
```yaml
agents:
  - name: claude_api
    provider: api/anthropic
    options:
      tools:
        query: [read_file]                  # query 모드 도구
        execute: [read_file, write_file]    # execute 모드 도구
```

**호환성**: 개념은 동일 (query/execute 구분), 구현만 다름 ✅

---

## 🚀 다음 단계 (WBS-29 후보)

### Tool 레지스트리 강화
- Tool 위험도 표시 (`dangerous: boolean`)
- Tool 카테고리 분류 (read, write, execute, network)
- Tool 의존성 관리

### 커스텀 모드 구현
- `crewx --mode analyze` 지원
- 사용자 정의 모드 추가 기능
- 모드별 프롬프트 커스터마이징

### 감사(Audit) 로그
- Tool 사용 이력 추적
- 위험한 도구 사용 알림
- 사용 통계 대시보드

---

## 📝 참고 자료

- [WBS-19: API Provider 설계](wbs-19-design-document.md)
- [WBS-20: Mastra 통합](wbs-20-mastra-integration.md)
- [API Provider 사용 가이드](../docs/api-provider-guide.md)
- [SowonFlow Tool 패턴](file:///Users/doha/git/sowonai/packages/sowonflow/src/tools/)

---

## 🔄 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2025-11-12 | v1.0 | 초안 작성 (설계 방안 3가지 제시) | Dev Lead |
