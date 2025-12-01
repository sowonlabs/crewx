# WBS-34: Dynamic Tool Selection (동적 도구 선택)

## 문서 정보
- **작성일**: 2025-11-19
- **WBS 번호**: 34
- **우선순위**: P2 (Enhanced Feature)
- **상태**: Design
- **관련 이슈**: 없음

## 개요

CrewX에서 에이전트가 사용할 도구를 런타임에 동적으로 선택할 수 있도록 하는 기능입니다. 기존의 정적인 YAML 설정 방식에서 벗어나, `vars` 시스템과 Handlebars 템플릿을 활용하여 조건부로 도구를 활성화/비활성화할 수 있습니다.

## 핵심 아이디어

### 기본 개념
- **vars 기반 동적 제어**: 런타임 변수를 통해 도구 활성화 여부 결정
- **템플릿 조건문 활용**: Handlebars의 `{{#if}}` 구문으로 프롬프트 및 도구 목록 제어
- **기존 인프라 재사용**: 현재 CrewX의 템플릿 시스템 그대로 활용

### 왜 간단한가?

CrewX에 이미 필요한 모든 인프라가 존재:
1. ✅ `vars` 시스템 - `template-processor.ts:57`
2. ✅ Handlebars 조건문 - `{{#if vars.xxx}}`
3. ✅ 모든 필요한 헬퍼 - `eq`, `ne`, `and`, `or`, etc.

**필요한 것 (정말 간단):**
1. CLI에서 `--vars` 옵션 추가 (파싱)
2. 해당 vars를 `additionalContext`에 전달
3. 끝!

## 구현 방법

### 방법 1: 프롬프트에서만 조건부 (지금 바로 가능)

**장점**: 코드 변경 없이 즉시 작동

```yaml
# crewx.yaml
agents:
  - id: "worker"
    inline:
      vars:
        use_jira: true
        use_github: false

      prompt: |
        You are a worker assistant.

        {{#if vars.use_jira}}
        You have access to Jira tools for ticket management.
        Use them when the user asks about tickets or issues.
        {{/if}}

        {{#if vars.use_github}}
        You have access to GitHub tools for repository management.
        {{/if}}

      # 모든 도구 로드하되, AI가 프롬프트 기반으로 선택
      tools:
        - jira_create
        - github_create
```

**장점:**
- ✅ 지금 당장 작동함 (코드 변경 없음)
- ✅ AI가 프롬프트 보고 적절한 도구만 사용
- ✅ 도구는 다 로드되지만 사용은 선택적

**단점:**
- ⚠️ 불필요한 도구도 메모리에 로드됨 (성능 영향은 미미)

### 방법 2: 도구 목록도 조건부 (약간의 수정 필요)

현재 `tools` 필드는 YAML 배열이라 Handlebars 처리가 안 됨. 2가지 방법으로 해결:

#### Option A: 문자열로 변환 후 파싱

```yaml
agents:
  - id: "worker"
    inline:
      vars:
        use_jira: true

      # tools를 문자열 템플릿으로 정의
      tools_template: |
        {{#if vars.use_jira}}
        jira_create, jira_search,
        {{/if}}
        {{#if vars.use_github}}
        github_create, github_pr,
        {{/if}}
        base_tool
```

#### Option B: Agent Loader 수정 (권장)

```typescript
// packages/cli/src/services/agent-loader.service.ts에서
// tools 필드를 템플릿 처리하도록 추가

if (typeof agentConfig.tools === 'string') {
  // tools가 문자열이면 Handlebars 처리
  const processedTools = await processDocumentTemplate(
    agentConfig.tools,
    this.documentLoader,
    { vars: agentConfig.vars }
  );
  agentConfig.tools = processedTools
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}
```

### 방법 3: CLI에서 런타임 vars 주입 (선택사항)

```bash
# 기본 vars 사용
crewx query "@worker create jira ticket"

# 런타임에 vars 오버라이드 (구현 필요)
crewx query "@worker create ticket" --vars use_jira=false,use_github=true
```

## 구현 계획

### Phase 1: 프롬프트 조건부 (즉시 가능)
**구현 시간**: 0분 (지금 바로 사용 가능)

- [ ] 에이전트 설정에 vars 추가
- [ ] 프롬프트에서 `{{#if vars.xxx}}` 사용
- [ ] 테스트 및 검증

### Phase 2: 도구 목록 템플릿 처리 (선택사항)
**구현 시간**: 1-2시간

- [ ] `agent-loader.service.ts`에서 tools 필드 템플릿 처리 로직 추가
- [ ] YAML 스키마 업데이트 (tools_template 또는 tools 문자열 지원)
- [ ] 기존 에이전트 호환성 테스트

### Phase 3: CLI --vars 옵션 (선택사항)
**구현 시간**: 2-3시간

- [ ] CLI에서 `--vars` 파라미터 파싱
- [ ] `additionalContext`에 런타임 vars 전달
- [ ] 우선순위: 런타임 vars > 설정 파일 vars
- [ ] 테스트 및 문서화

## 기술적 상세

### 현재 시스템 분석

#### 1. template-processor.ts
```typescript
// packages/cli/src/utils/template-processor.ts:48-58
// 이미 additionalContext 지원
export async function processDocumentTemplate(
  template: string,
  documentLoader: DocumentLoaderService,
  additionalContext?: TemplateContext
): Promise<string>
```

#### 2. agent-loader.service.ts
```typescript
// tools 로딩 로직 (현재)
const tools = agentConfig.tools || [];

// 개선 필요 (문자열 템플릿 지원)
if (typeof agentConfig.tools === 'string') {
  // Handlebars 처리 로직
}
```

#### 3. Handlebars 헬퍼
CrewX가 이미 지원하는 조건 헬퍼:
- `{{#if condition}}...{{/if}}`
- `{{#unless condition}}...{{/unless}}`
- `{{#each array}}...{{/each}}`
- `{{eq a b}}`, `{{ne a b}}`
- `{{and a b}}`, `{{or a b}}`

### 구현 파일 위치

1. **Agent Loader**: `packages/cli/src/services/agent-loader.service.ts`
2. **Template Processor**: `packages/cli/src/utils/template-processor.ts`
3. **CLI Parser**: `packages/cli/src/cli/query.command.ts`, `packages/cli/src/cli/execute.command.ts`

## 사용 예시

### 예시 1: Jira/GitHub 선택적 활성화

```yaml
agents:
  - id: "dev_assistant"
    inline:
      vars:
        use_jira: true
        use_github: true
        use_slack: false

      prompt: |
        You are a development assistant.

        {{#if vars.use_jira}}
        🎫 Jira Tools: Available for issue tracking
        {{/if}}

        {{#if vars.use_github}}
        🐙 GitHub Tools: Available for repository management
        {{/if}}

        {{#if vars.use_slack}}
        💬 Slack Tools: Available for team communication
        {{/if}}

      tools:
        - filesystem  # 항상 활성화
        - git         # 항상 활성화
        {{#if vars.use_jira}}
        - jira_create
        - jira_search
        {{/if}}
        {{#if vars.use_github}}
        - github_pr
        - github_issue
        {{/if}}
```

### 예시 2: 환경별 도구 설정

```yaml
agents:
  - id: "api_worker"
    inline:
      vars:
        environment: "production"  # production | staging | development

      prompt: |
        You are an API worker in {{vars.environment}} environment.

        {{#if (eq vars.environment "production")}}
        ⚠️ PRODUCTION MODE: Use tools with extra caution.
        {{/if}}

      tools:
        - api_call
        {{#if (eq vars.environment "development")}}
        - debug_tool
        - mock_api
        {{/if}}
```

### 예시 3: CLI에서 런타임 제어

```bash
# 기본 설정 사용
crewx query "@dev_assistant analyze the codebase"

# Jira만 활성화
crewx query "@dev_assistant create a ticket" \
  --vars use_jira=true,use_github=false

# GitHub만 활성화
crewx query "@dev_assistant create a PR" \
  --vars use_jira=false,use_github=true
```

## 장점 및 단점

### 장점
1. ✅ **간단한 구현**: 기존 인프라 재사용
2. ✅ **명시적 제어**: 사용자가 정확히 어떤 도구가 활성화되는지 알 수 있음
3. ✅ **점진적 도입**: Phase 1부터 즉시 사용 가능
4. ✅ **디버깅 용이**: 조건문이 명확해서 문제 파악 쉬움
5. ✅ **성능 영향 최소**: 템플릿 처리는 에이전트 로딩 시 한 번만

### 단점
1. ⚠️ **수동 설정**: LLM이 자동으로 도구를 선택하지 않음
2. ⚠️ **초기 설정 필요**: vars와 조건문을 YAML에 작성해야 함
3. ⚠️ **복잡한 조건**: 많은 도구를 다룰 경우 YAML이 복잡해질 수 있음

## 대안과 비교

### 대안 1: LLM 기반 자동 도구 선택
**개념**: LLM이 프롬프트를 분석해서 필요한 도구 자동 선택

**장점**:
- 완전 자동화
- 사용자 편의성 높음

**단점**:
- LLM 호출 추가 → 2-3초 지연
- 예측 불가능 (디버깅 어려움)
- 복잡도 높음 (1-2개월 구현)

**결론**: 현재 단계에서는 과도함

### 대안 2: 정적 설정 유지
**개념**: 현재처럼 YAML에 고정된 도구 목록

**장점**:
- 예측 가능
- 성능 최적화
- 디버깅 쉬움

**단점**:
- 유연성 부족
- 불필요한 도구도 항상 로드

**결론**: 소규모 프로젝트에 적합, 확장성 부족

### 선택: vars 기반 조건부 (현재 제안)
**이유**:
1. 간단하고 명확함
2. 기존 시스템 활용
3. 점진적 도입 가능
4. 디버깅 용이

## 타임라인

### Immediate (지금)
- Phase 1: 프롬프트 조건부 사용
- 코드 변경 없이 즉시 활용 가능

### Short-term (1-2주)
- Phase 2: Agent Loader에서 tools 템플릿 처리
- 구현 시간: 1-2시간
- 테스트 및 검증: 1주

### Mid-term (1개월)
- Phase 3: CLI --vars 옵션 추가
- 구현 시간: 2-3시간
- 문서화 및 예제 작성: 1주

## 관련 파일

### 수정 필요
- `packages/cli/src/services/agent-loader.service.ts` (Phase 2)
- `packages/cli/src/cli/query.command.ts` (Phase 3)
- `packages/cli/src/cli/execute.command.ts` (Phase 3)

### 영향받지 않음
- `packages/cli/src/utils/template-processor.ts` (이미 지원)
- `packages/sdk/src/core/agent/agent-runtime.ts` (수정 불필요)

## 참고사항

### 기존 시스템과의 호환성
- ✅ 기존 YAML 설정 완전 호환
- ✅ vars 없는 에이전트도 정상 동작
- ✅ 점진적 마이그레이션 가능

### 성능 고려사항
- 템플릿 처리는 에이전트 로딩 시 한 번만 실행
- 런타임 오버헤드 거의 없음
- 도구 목록이 줄어들면 오히려 성능 향상

## 결론

이 기능은 **간단하지만 강력한** 동적 도구 선택 메커니즘을 제공합니다. 복잡한 LLM 기반 라우팅 없이, 기존의 vars와 Handlebars 템플릿만으로 충분히 구현 가능합니다.

**핵심 통찰**:
> "LLM이 자동으로 도구를 선택하게 할 필요 없다. vars로 명시적으로 제어하는 것이 더 간단하고 예측 가능하다."

**실행 계획**:
1. Phase 1부터 즉시 적용 (코드 변경 없음)
2. 필요시 Phase 2, 3 순차적으로 구현
3. 사용자 피드백 기반으로 개선

## 다음 단계

- [ ] Phase 1 예제 작성 및 테스트
- [ ] 문서화 (README 및 예제)
- [ ] Phase 2 구현 여부 결정 (사용자 피드백 기반)
- [ ] Phase 3 필요성 검토
