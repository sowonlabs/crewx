[← WBS-11 계획](wbs-11-layout-plan.md)

# WBS-11 Phase 1: 레이아웃 DSL 명세

## 문서 정보
- **작성일**: 2025-10-18
- **Phase**: WBS-11 Phase 1 (레이아웃 DSL 요구사항 정리 및 템플릿 훅 정의)
- **목적**: CrewX 레이아웃 시스템의 YAML DSL 구조, 검증 규칙, 보안 요구사항을 정의

## 1. `inline.layout` 스펙 정의

### 1.1 기본 형식: 문자열 ID

에이전트 정의에서 `inline.layout`은 기본적으로 **문자열 레이아웃 ID**를 참조합니다.

```yaml
agents:
  - id: copilot
    name: "GitHub Copilot"
    inline:
      layout: "crewx/default"  # 문자열 ID
      prompt: |
        You are GitHub Copilot, an AI coding assistant.
```

**규칙:**
- 레이아웃 ID는 네임스페이스 형식을 권장: `<namespace>/<name>`
  - 예: `crewx/default`, `crewx/dashboard`, `custom/enterprise`
- ID가 생략되면 기본값 `crewx/default` 사용
- ID는 대소문자 구분, 영숫자와 하이픈(-), 슬래시(/)만 허용
- 최대 길이: 64자

### 1.2 확장 형식: Object with Props

복잡한 레이아웃 커스터마이징을 위해 **Object 형식**을 지원합니다.

```yaml
agents:
  - id: claude
    name: "Claude Reasoning Specialist"
    inline:
      layout:
        id: "crewx/dashboard"
        props:
          sidebarTheme: "light"
          showTimeline: true
          maxDocuments: 5
      prompt: |
        You are Claude, a CrewX reasoning specialist.
```

**Object 구조:**
```typescript
type InlineLayout = string | {
  id: string;           // 필수: 레이아웃 ID
  props?: Record<string, any>;  // 선택: 레이아웃별 커스텀 속성
}
```

**규칙:**
- `id` 필드는 필수
- `props`는 선택사항이며, 각 레이아웃의 `propsSchema`에 따라 검증됨
- 알 수 없는 props는 경고를 출력하지만 실행은 계속됨 (관대한 검증)

### 1.3 `inline.layout`과 `inline.prompt` 분리

**핵심 원칙:** 레이아웃과 프롬프트는 명확히 분리된 책임을 가집니다.

| 항목 | `inline.layout` | `inline.prompt` |
|------|----------------|-----------------|
| **역할** | 프롬프트 구조 템플릿 (감싸는 틀) | 에이전트별 실제 지시사항 (내용) |
| **재사용성** | 여러 에이전트가 공유 가능 | 에이전트 고유 |
| **보안 컨테이너** | `<crewx_system_prompt>` 등 보안 래퍼 포함 | 보안 래퍼 내부에 주입됨 |
| **문서 삽입** | `{{{documents.xxx}}}` 같은 공통 문서 참조 | 에이전트 특화 문서 참조 가능 |

**예시:**

```yaml
# 레이아웃 정의 (templates/agents/default.yaml 또는 layouts/builtin/default.yaml)
layouts:
  default: |
    <crewx_system_prompt>
    You are a built-in AI agent of the CrewX system.
    <document name="CrewX User Manual">
    {{{documents.crewx-manual.content}}}
    </document>
    </crewx_system_prompt>
    <system_prompt key="{{vars.security_key}}">
    {{{agent.inline.prompt}}}
    </system_prompt>

# 에이전트 정의 (crewx.yaml)
agents:
  - id: copilot
    inline:
      layout: "builtin/default"  # 레이아웃 선택
      prompt: |                   # 실제 프롬프트 내용
        You are GitHub Copilot.
        Focus on code quality and best practices.
```

**최종 렌더링 결과:**
```xml
<crewx_system_prompt>
You are a built-in AI agent of the CrewX system.
<document name="CrewX User Manual">
[crewx-manual 내용]
</document>
</crewx_system_prompt>
<system_prompt key="abc123">
You are GitHub Copilot.
Focus on code quality and best practices.
</system_prompt>
```

## 2. Props 키 명세 및 검증 규칙

### 2.1 Props Schema 정의 (React PropTypes 스타일)

각 레이아웃은 `propsSchema`를 선언하여 허용되는 props를 명시합니다. React PropTypes와 유사한 문법을 사용합니다.

**레이아웃 매니페스트 구조:**

```yaml
# templates/agents/dashboard.yaml (builtin 레이아웃)
id: "builtin/dashboard"
version: "1.0.0"
description: "Dashboard layout with customizable sidebar and timeline"

# Props 스키마 (React PropTypes 스타일)
propsSchema:
  sidebarTheme:
    type: string
    oneOf: ["light", "dark", "auto"]
    defaultValue: "auto"
    description: "UI theme preference"

  showTimeline:
    type: bool
    defaultValue: true
    description: "Show conversation timeline"

  maxDocuments:
    type: number
    min: 1
    max: 20
    defaultValue: 10
    description: "Maximum number of context documents"

  sections:
    type: arrayOf
    itemType: string
    itemOneOf: ["overview", "tasks", "knowledge", "tools"]
    defaultValue: ["overview", "tasks"]
    description: "Dashboard sections to display"

# 레이아웃 템플릿
template: |
  <crewx_system_prompt>
  <document name="Dashboard Config">
  Sidebar Theme: {{props.sidebarTheme}}
  Timeline Enabled: {{props.showTimeline}}
  Max Documents: {{props.maxDocuments}}
  Sections: {{#each props.sections}}{{this}}, {{/each}}
  </document>
  </crewx_system_prompt>
  <system_prompt key="{{vars.security_key}}">
  {{{agent.inline.prompt}}}
  </system_prompt>
```

### 2.2 검증 규칙

**검증 레벨:**

1. **Strict Mode (권장)**: JSON Schema 기반 완전 검증
   - 타입 불일치 → 오류 발생, 실행 중단
   - 알 수 없는 props → 오류 발생, 실행 중단
   - 필수 필드 누락 → 오류 발생, 실행 중단

2. **Lenient Mode (기본값)**: 관대한 검증
   - 타입 불일치 → 경고 출력, 기본값 사용
   - 알 수 없는 props → 경고 출력, 무시
   - 필수 필드 누락 → 경고 출력, 기본값 사용

**검증 흐름:**

```typescript
// 의사코드
function validateLayoutProps(
  layoutId: string,
  props: Record<string, any> | undefined
): ValidationResult {
  const layout = registry.getLayout(layoutId);

  if (!layout) {
    throw new Error(`Layout not found: ${layoutId}`);
  }

  if (!props) {
    return { valid: true, props: layout.defaultProps };
  }

  const schema = layout.propsSchema;
  const result = jsonSchema.validate(props, schema);

  if (!result.valid) {
    if (validationMode === 'strict') {
      throw new ValidationError(result.errors);
    } else {
      console.warn(`Layout props validation warnings:`, result.errors);
      return { valid: true, props: mergeWithDefaults(props, layout.defaultProps) };
    }
  }

  return { valid: true, props };
}
```

### 2.3 Props 타입 시스템 (React PropTypes 호환)

**지원 타입 (React PropTypes 스타일):**

| PropTypes 타입 | CrewX Schema | 예시 | React 비교 |
|---------------|--------------|------|-----------|
| `string` | `type: string` | `"light"` | `PropTypes.string` |
| `number` | `type: number` | `42`, `3.14` | `PropTypes.number` |
| `bool` | `type: bool` | `true`, `false` | `PropTypes.bool` |
| `array` | `type: array` | `["doc1", "doc2"]` | `PropTypes.array` |
| `arrayOf` | `type: arrayOf, itemType: string` | `["a", "b"]` | `PropTypes.arrayOf(PropTypes.string)` |
| `object` | `type: object` | `{ key: "value" }` | `PropTypes.object` |
| `shape` | `type: shape, shape: {...}` | 구조화된 객체 | `PropTypes.shape({...})` |
| `oneOf` | `oneOf: [...]` | `["light", "dark"]` | `PropTypes.oneOf([...])` |
| `oneOfType` | `oneOfType: [...]` | 여러 타입 허용 | `PropTypes.oneOfType([...])` |
| `func` | `type: func` | 함수 참조 (헬퍼만) | `PropTypes.func` |
| `node` | `type: node` | 렌더링 가능한 값 | `PropTypes.node` |

**제약 조건 (React와 유사):**

| 제약 조건 | 설명 | React 비교 |
|----------|------|-----------|
| `isRequired: true` | 필수 필드 | `.isRequired` |
| `defaultValue` | 기본값 | `defaultProps` |
| `min`, `max` | 숫자 범위 (커스텀) | 없음 |
| `minLength`, `maxLength` | 문자열/배열 길이 | 없음 |
| `pattern` | 정규식 검증 | 없음 |
| `validator` | 커스텀 검증 함수 | 커스텀 validator |

**예시:**

```yaml
propsSchema:
  # React: PropTypes.string.isRequired
  title:
    type: string
    isRequired: true

  # React: PropTypes.number
  count:
    type: number
    defaultValue: 0

  # React: PropTypes.oneOf(['news', 'photos'])
  optionalEnum:
    type: string
    oneOf: ["news", "photos"]

  # React: PropTypes.arrayOf(PropTypes.number)
  numbers:
    type: arrayOf
    itemType: number

  # React: PropTypes.shape({ color: PropTypes.string, fontSize: PropTypes.number })
  style:
    type: shape
    shape:
      color:
        type: string
        defaultValue: "black"
      fontSize:
        type: number
        defaultValue: 14

  # React: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  id:
    type: oneOfType
    types:
      - string
      - number
```

## 3. 보안 컨테이너 준수 사항

### 3.1 보안 컨테이너 구조

CrewX는 다층 보안 컨테이너 구조를 사용합니다:

```xml
<crewx_system_prompt>
  <!-- 레벨 1: CrewX 시스템 프롬프트 (최상위) -->
  <!-- 여기에는 시스템 전체 보안 정책, 공통 문서 등이 포함됨 -->
</crewx_system_prompt>

<system_prompt key="{{vars.security_key}}">
  <!-- 레벨 2: 에이전트별 시스템 프롬프트 (보안 키로 보호) -->
  <!-- 여기에 agent.inline.prompt가 주입됨 -->
</system_prompt>
```

### 3.2 레이아웃 보안 규칙

**MUST 규칙:**

1. ✅ **보안 컨테이너 필수 사용**
   - 모든 레이아웃은 `<crewx_system_prompt>` 또는 `<system_prompt>` 태그를 포함해야 함
   - `agent.inline.prompt`는 반드시 `<system_prompt>` 내부에 주입되어야 함

2. ✅ **보안 키 검증**
   - `<system_prompt key="...">` 속성은 필수
   - `{{vars.security_key}}` 템플릿 변수 사용 권장
   - 하드코딩된 키 사용 금지

3. ✅ **XSS/Injection 방어**
   - Props 값은 HTML/XML 이스케이프 처리
   - `{{{raw}}}` 트리플 브레이스는 신뢰된 소스에만 사용
   - 사용자 입력이 포함된 props는 더블 브레이스 `{{escaped}}` 사용

4. ✅ **문서 참조 제한**
   - `{{{documents.xxx}}}` 참조는 허용 목록(whitelist) 기반
   - 시스템 문서(`crewx-manual`, `builtin-agent-guidelines`)만 레이아웃에서 참조 가능
   - 프로젝트별 문서는 `agent.inline.prompt`에서만 참조

**MUST NOT 규칙:**

1. ❌ **절대 금지: 보안 컨테이너 우회**
   ```yaml
   # 잘못된 예: 보안 컨테이너 없음
   layouts:
     bad-layout: |
       {{{agent.inline.prompt}}}  # ❌ 보안 컨테이너 없이 직접 주입
   ```

2. ❌ **절대 금지: 하드코딩된 민감 정보**
   ```yaml
   # 잘못된 예
   template: |
     <system_prompt key="hardcoded-secret-123">  # ❌ 하드코딩 금지
   ```

3. ❌ **절대 금지: 임의 코드 실행**
   - 레이아웃 템플릿에서 JavaScript/shell 명령 실행 불가
   - `eval()`, `exec()` 류 함수 사용 금지

### 3.3 보안 체크리스트

**레이아웃 작성 시 확인 사항:**

- [ ] `<crewx_system_prompt>` 또는 `<system_prompt>` 태그 포함 여부
- [ ] `<system_prompt key="{{vars.security_key}}">` 사용 여부
- [ ] `{{{agent.inline.prompt}}}` 올바른 위치 주입 여부
- [ ] Props 값 이스케이프 처리 여부
- [ ] 하드코딩된 비밀 정보 부재 여부
- [ ] 허용된 문서만 참조하는지 확인
- [ ] `propsSchema`에서 위험한 타입(function, code) 제외 여부

## 4. 샘플 레이아웃 2종

### 4.1 Sample 1: `crewx/default`

**위치:** `templates/agents/default.yaml`

```yaml
# templates/agents/default.yaml
layouts:
  default: |
    <crewx_system_prompt>
    You are a built-in AI agent of the CrewX system.

    <document name="CrewX User Manual">
    {{{documents.crewx-manual.content}}}
    </document>

    <document name="Agent Guidelines">
    {{{documents.builtin-agent-guidelines.content}}}
    </document>
    </crewx_system_prompt>

    <system_prompt key="{{vars.security_key}}">
    {{{agent.inline.prompt}}}
    </system_prompt>
```

**특징:**
- 가장 기본적인 레이아웃
- CrewX 시스템 프롬프트 + 에이전트 프롬프트
- Props 없음 (단순 구조)
- 모든 에이전트의 기본값

**사용 예:**

```yaml
# crewx.yaml
agents:
  - id: copilot
    inline:
      # layout 생략 시 자동으로 "crewx/default" 사용
      prompt: |
        You are GitHub Copilot, an AI coding assistant.
```

### 4.2 Sample 2: `crewx/dashboard` with Props Override

**위치:** `templates/agents/dashboard.yaml`

```yaml
# templates/agents/dashboard.yaml
id: "crewx/dashboard"
version: "1.0.0"
description: "Dashboard layout with configurable sections"

# Props 스키마 (React PropTypes 스타일)
propsSchema:
  theme:
    type: string
    oneOf: ["light", "dark", "auto"]
    defaultValue: "auto"
    description: "UI theme preference"

  enableTimeline:
    type: bool
    defaultValue: true
    description: "Show conversation timeline"

  maxContextDocs:
    type: number
    min: 1
    max: 50
    defaultValue: 10
    description: "Maximum number of context documents"

  sections:
    type: arrayOf
    itemType: string
    itemOneOf: ["overview", "tasks", "knowledge", "tools"]
    defaultValue: ["overview", "tasks"]
    description: "Dashboard sections to display"

# 레이아웃 템플릿
template: |
  <crewx_system_prompt>
  You are a dashboard agent for the CrewX system.

  <document name="Dashboard Configuration">
  ## UI Settings
  - Theme: {{props.theme}}
  - Timeline Enabled: {{props.enableTimeline}}
  - Max Context Documents: {{props.maxContextDocs}}
  - Active Sections: {{#each props.sections}}{{this}}, {{/each}}
  </document>

  <document name="System Guidelines">
  {{{documents.crewx-manual.content}}}
  </document>
  </crewx_system_prompt>

  <system_prompt key="{{vars.security_key}}">
  ## Agent-Specific Instructions
  {{{agent.inline.prompt}}}

  ## Dashboard Context
  You have access to {{props.maxContextDocs}} context documents.
  Present information in a {{props.theme}} theme optimized format.
  </system_prompt>
```

**특징:**
- CrewX 시스템 레이아웃 (기본 제공)
- React PropTypes 스타일 스키마
- crewx.yaml에서 props만 오버라이드 가능
- 다양한 대시보드 구성 지원

**사용 예 (crewx.yaml에서 오버라이드):**

```yaml
# crewx.yaml
agents:
  - id: dashboard-agent
    name: "Project Dashboard"
    inline:
      layout:
        id: "crewx/dashboard"
        props:
          theme: "dark"              # "auto" → "dark"로 오버라이드
          enableTimeline: true
          maxContextDocs: 20         # 10 → 20으로 오버라이드
          sections: ["overview", "tasks", "knowledge", "tools"]
      prompt: |
        You are the project dashboard assistant.
        Provide clear, actionable insights on project status.
```

## 5. 레이아웃 오버라이드 전략 (단순화)

### 5.1 레이아웃 해석 순서 (2-tier 구조)

레이아웃은 **CrewX 기본값 → crewx.yaml 오버라이드** 2단계 구조로 단순화됩니다.

```
1. CrewX 레이아웃 (기본):  templates/agents/<layout-name>.yaml
2. 프로젝트 오버라이드:     crewx.yaml의 agents[].inline.layout
```

**핵심 원칙:**
- **CrewX 레이아웃**: 시스템 제공 기본 템플릿 (`templates/agents/default.yaml`, `templates/agents/dashboard.yaml` 등)
- **프로젝트 오버라이드**: `crewx.yaml`에서 `inline.layout` 사용 시 props만 오버라이드 가능
- **경로 시스템 없음**: `.crewx/layouts/` 또는 `~/.crewx/layouts/` 같은 별도 경로는 사용하지 않음

**예시: 레이아웃 해석 과정**

```typescript
function resolveLayout(
  layoutId: string,
  propsOverride?: Record<string, any>
): LayoutDefinition {
  // 1. CrewX 레이아웃 로드
  const crewxLayouts = loadCrewXLayouts(); // templates/agents/*.yaml

  if (!crewxLayouts[layoutId]) {
    // 2. 레이아웃 없으면 최종 폴백: crewx/default
    console.warn(`Layout not found: ${layoutId}, falling back to crewx/default`);
    return crewxLayouts['crewx/default'];
  }

  const layout = crewxLayouts[layoutId];

  // 3. crewx.yaml에서 props 오버라이드 적용
  if (propsOverride) {
    console.log(`Applying props override for layout: ${layoutId}`);
    layout.props = { ...layout.defaultProps, ...propsOverride };
  }

  return layout;
}

// 사용 예시
// crewx.yaml에서 정의:
// agents:
//   - id: my-agent
//     inline:
//       layout:
//         id: "crewx/dashboard"
//         props:
//           theme: "dark"      # 기본값 "auto" → "dark"로 오버라이드
//           maxDocuments: 20   # 기본값 10 → 20으로 오버라이드

const layout = resolveLayout("crewx/dashboard", { theme: "dark", maxDocuments: 20 });
```

### 5.2 폴백 시나리오 (단순화)

| 상황 | 동작 | 로그 |
|------|------|------|
| CrewX 레이아웃 존재 | 해당 레이아웃 사용 | `Using crewx layout: <id>` |
| CrewX 레이아웃 없음 | `crewx/default` 사용 | `Layout not found: <id>, using default` |
| Props 검증 실패 (Lenient) | 기본값 사용, 경고 출력 | `Invalid props, using defaults` |
| Props 검증 실패 (Strict) | 오류 발생, 실행 중단 | `ValidationError: ...` |

## 6. 통합 예시 (단순화)

### 6.1 전체 워크플로우

**1단계: CrewX 레이아웃 정의 (시스템 제공)**

```yaml
# templates/agents/enterprise.yaml
id: "crewx/enterprise"
version: "1.0.0"

propsSchema:
  companyName:
    type: string
    defaultValue: "Acme Corp"

  complianceLevel:
    type: string
    oneOf: ["standard", "high", "critical"]
    defaultValue: "standard"

template: |
  <crewx_system_prompt>
  Enterprise Agent for {{props.companyName}}
  Compliance Level: {{props.complianceLevel}}
  </crewx_system_prompt>
  <system_prompt key="{{vars.security_key}}">
  {{{agent.inline.prompt}}}
  </system_prompt>
```

**2단계: crewx.yaml에서 Props 오버라이드**

```yaml
# crewx.yaml
agents:
  - id: enterprise-assistant
    name: "Enterprise Assistant"
    inline:
      layout:
        id: "crewx/enterprise"
        props:
          companyName: "TechCorp"    # 기본값 오버라이드
          complianceLevel: "high"    # 기본값 오버라이드
      prompt: |
        You are an enterprise assistant for TechCorp.
        Ensure all recommendations comply with high-level security standards.
```

**3단계: 최종 렌더링 결과**

```xml
<crewx_system_prompt>
Enterprise Agent for TechCorp
Compliance Level: high
</crewx_system_prompt>
<system_prompt key="abc123xyz">
You are an enterprise assistant for TechCorp.
Ensure all recommendations comply with high-level security standards.
</system_prompt>
```

## 7. 구현 우선순위 (간소화)

Phase 1 완료 후 구현할 핵심 요소:

1. **Props 검증 엔진**
   - React PropTypes 스타일 검증 로직
   - 기본값 적용 및 오버라이드 처리

2. **템플릿 렌더러**
   - Handlebars 템플릿 엔진
   - Props 변수 주입 및 이스케이프 처리

3. **CrewX 레이아웃 로더**
   - `templates/agents/*.yaml` 파일 로드
   - Fallback to `crewx/default` 처리

## 8. 참고 자료

- **React PropTypes**: https://reactjs.org/docs/typechecking-with-proptypes.html
- **YAML 1.2 스펙**: https://yaml.org/spec/1.2/spec.html
- **Handlebars 템플릿**: https://handlebarsjs.com/

---

**문서 상태**: ✅ 완료 (2025-10-18)
**다음 Phase**: WBS-11 Phase 2 - 레지스트리·로더 아키텍처 설계
