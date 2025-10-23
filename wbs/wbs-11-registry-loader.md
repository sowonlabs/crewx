[← WBS-11 계획](wbs-11-layout-plan.md)

# WBS-11 Phase 2: 레이아웃 로더 구현 (단순화)

## 문서 정보
- **작성일**: 2025-10-18
- **수정일**: 2025-10-18 (단순화)
- **Phase**: WBS-11 Phase 2 (레이아웃 로더 구현)
- **목적**: Builtin 레이아웃 로딩 및 Props 검증 로직 정의
- **선행 문서**: [wbs-11-layout-spec.md](wbs-11-layout-spec.md) - Phase 1 레이아웃 DSL 명세

## 변경 사항 (2025-10-18)
- 복잡한 레지스트리/캐싱 시스템 제거
- Builtin 레이아웃 + crewx.yaml 오버라이드 구조로 단순화
- CLI/MCP/IDE 공통 인터페이스 제거 (필요 시 추후 추가)
- Props 검증을 React PropTypes 스타일로 변경

## 1. 레이아웃 로딩 전략 (단순화)

### 1.1 CrewX 레이아웃 로딩

레이아웃은 **templates/agents/ 디렉토리**에서만 로드됩니다.

```
레이아웃 위치: <crewx-install>/templates/agents/<layout-name>.yaml

예시:
  - templates/agents/default.yaml      → "crewx/default"
  - templates/agents/dashboard.yaml    → "crewx/dashboard"
  - templates/agents/enterprise.yaml   → "crewx/enterprise"
```

**핵심 원칙:**
- CrewX 레이아웃만 지원 (프로젝트/번들 경로 없음)
- crewx.yaml에서 props만 오버라이드 가능
- 레이아웃 ID는 `crewx/<name>` 형식 (또는 `<name>` 단독 사용 시 자동으로 `crewx/<name>` 변환)

### 1.2 로딩 알고리즘

```typescript
class LayoutLoader {
  private crewxLayouts: Map<string, LayoutDefinition> = new Map();

  constructor(private templatesPath: string) {
    this.loadCrewXLayouts();
  }

  /**
   * CrewX 레이아웃 파일들을 미리 로드
   */
  private loadCrewXLayouts(): void {
    const layoutsDir = path.join(this.templatesPath, 'agents');
    const files = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.yaml'));

    for (const file of files) {
      const layoutName = file.replace('.yaml', '');
      const layoutPath = path.join(layoutsDir, file);
      const layout = this.parseLayoutFile(layoutPath);

      this.crewxLayouts.set(`crewx/${layoutName}`, layout);
    }
  }

  /**
   * 레이아웃 ID로 레이아웃 로드
   */
  load(layoutId: string, propsOverride?: Record<string, any>): LayoutDefinition {
    // "dashboard" → "crewx/dashboard" 자동 변환
    const normalizedId = layoutId.includes('/') ? layoutId : `crewx/${layoutId}`;

    const layout = this.crewxLayouts.get(normalizedId);

    if (!layout) {
      console.warn(`Layout not found: ${normalizedId}, using crewx/default`);
      return this.crewxLayouts.get('crewx/default')!;
    }

    // Props 오버라이드 적용
    if (propsOverride) {
      return {
        ...layout,
        props: { ...layout.defaultProps, ...propsOverride }
      };
    }

    return layout;
  }
}
```

### 1.3 Fallback 전략 (단순화)

| 상황 | 동작 | 로그 |
|------|------|------|
| CrewX 레이아웃 존재 | 해당 레이아웃 사용 | `Using crewx layout: <id>` |
| CrewX 레이아웃 없음 | `crewx/default` 사용 | `Layout not found: <id>, using default` |
| Props 검증 실패 (Lenient) | 기본값 사용, 경고 | `Invalid props, using defaults` |
| Props 검증 실패 (Strict) | 오류 발생, 중단 | `ValidationError: ...` |

## 2. Props 검증 흐름 (React PropTypes 스타일)

### 2.1 PropTypes 기반 검증

**검증 방식:** React PropTypes와 유사한 간단한 타입 체크

```typescript
/**
 * React PropTypes 스타일 Props 검증기
 */
class PropsValidator {
  /**
   * Props 검증 (React PropTypes 스타일)
   */
  validate(
    props: Record<string, any> | undefined,
    propsSchema: Record<string, PropSchema>,
    mode: 'strict' | 'lenient' = 'lenient'
  ): ValidationResult {
    const validatedProps: Record<string, any> = {};
    const errors: ValidationError[] = [];

    // Props 없으면 기본값만 사용
    if (!props) {
      return {
        valid: true,
        props: this.applyDefaults(propsSchema),
        errors: []
      };
    }

    // 각 prop 검증
    for (const [key, schema] of Object.entries(propsSchema)) {
      const value = props[key];

      // 필수 필드 체크 (React: .isRequired)
      if (schema.isRequired && value === undefined) {
        const error = { message: `Required prop '${key}' is missing`, path: key };
        errors.push(error);

        if (mode === 'strict') {
          throw new PropsValidationError(`Required prop '${key}' is missing`);
        }
        continue;
      }

      // 값이 없으면 기본값 사용
      if (value === undefined) {
        validatedProps[key] = schema.defaultValue;
        continue;
      }

      // 타입 검증
      const typeValid = this.validateType(value, schema);
      if (!typeValid.valid) {
        errors.push({ message: typeValid.error!, path: key });

        if (mode === 'strict') {
          throw new PropsValidationError(typeValid.error!);
        }

        // Lenient: 기본값 사용
        validatedProps[key] = schema.defaultValue;
      } else {
        validatedProps[key] = value;
      }
    }

    if (errors.length > 0 && mode === 'lenient') {
      console.warn('Props validation warnings:', errors);
    }

    return {
      valid: errors.length === 0,
      props: validatedProps,
      errors
    };
  }

  /**
   * 타입 검증
   */
  private validateType(value: any, schema: PropSchema): { valid: boolean; error?: string } {
    const { type, oneOf, min, max } = schema;

    // string
    if (type === 'string') {
      if (typeof value !== 'string') {
        return { valid: false, error: `Expected string, got ${typeof value}` };
      }
      if (oneOf && !oneOf.includes(value)) {
        return { valid: false, error: `Must be one of: ${oneOf.join(', ')}` };
      }
      return { valid: true };
    }

    // number (React PropTypes: PropTypes.number)
    if (type === 'number') {
      if (typeof value !== 'number') {
        return { valid: false, error: `Expected number, got ${typeof value}` };
      }
      if (min !== undefined && value < min) {
        return { valid: false, error: `Must be >= ${min}` };
      }
      if (max !== undefined && value > max) {
        return { valid: false, error: `Must be <= ${max}` };
      }
      return { valid: true };
    }

    // bool (React PropTypes: PropTypes.bool)
    if (type === 'bool') {
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Expected boolean, got ${typeof value}` };
      }
      return { valid: true };
    }

    // array (React PropTypes: PropTypes.array)
    if (type === 'array' || type === 'arrayOf') {
      if (!Array.isArray(value)) {
        return { valid: false, error: `Expected array, got ${typeof value}` };
      }

      // arrayOf 추가 검증
      if (type === 'arrayOf' && schema.itemType) {
        for (const item of value) {
          const itemValid = this.validateType(item, { type: schema.itemType } as PropSchema);
          if (!itemValid.valid) {
            return { valid: false, error: `Array item validation failed: ${itemValid.error}` };
          }
        }
      }

      return { valid: true };
    }

    // object (React PropTypes: PropTypes.object)
    if (type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: `Expected object, got ${typeof value}` };
      }
      return { valid: true };
    }

    return { valid: true };
  }

  /**
   * 기본값 적용
   */
  private applyDefaults(propsSchema: Record<string, PropSchema>): Record<string, any> {
    const defaults: Record<string, any> = {};

    for (const [key, schema] of Object.entries(propsSchema)) {
      if (schema.defaultValue !== undefined) {
        defaults[key] = schema.defaultValue;
      }
    }

    return defaults;
  }
}

/**
 * PropSchema 타입 정의 (React PropTypes 스타일)
 */
interface PropSchema {
  type: 'string' | 'number' | 'bool' | 'array' | 'arrayOf' | 'object' | 'shape' | 'oneOfType';
  isRequired?: boolean;           // React: .isRequired
  defaultValue?: any;             // React: defaultProps
  oneOf?: any[];                  // React: PropTypes.oneOf([...])
  min?: number;                   // 숫자 최소값 (커스텀)
  max?: number;                   // 숫자 최대값 (커스텀)
  itemType?: string;              // arrayOf의 아이템 타입
  itemOneOf?: any[];              // arrayOf 아이템의 oneOf
  shape?: Record<string, PropSchema>;  // React: PropTypes.shape({...})
  description?: string;           // 문서화용
}
```

### 2.2 검증 예시

**예시 1: 정상적인 Props 검증**

```yaml
# templates/agents/dashboard.yaml
propsSchema:
  theme:
    type: string
    oneOf: ["light", "dark", "auto"]
    defaultValue: "auto"

  maxDocs:
    type: number
    min: 1
    max: 50
    defaultValue: 10

# crewx.yaml
agents:
  - id: my-agent
    inline:
      layout:
        id: "crewx/dashboard"
        props:
          theme: "dark"   # ✓ Valid
          maxDocs: 20     # ✓ Valid

# 결과: { theme: "dark", maxDocs: 20 }
```

**예시 2: Props 타입 불일치 (Lenient 모드)**

```yaml
# crewx.yaml (잘못된 타입)
agents:
  - id: my-agent
    inline:
      layout:
        id: "crewx/dashboard"
        props:
          theme: "dark"
          maxDocs: "twenty"  # ❌ string instead of number

# Lenient 모드 (기본):
# WARN: Expected number, got string
# 결과: { theme: "dark", maxDocs: 10 }  # 기본값 사용
```

**예시 3: 필수 Props 누락**

```yaml
# templates/agents/api.yaml
propsSchema:
  apiKey:
    type: string
    isRequired: true  # React: .isRequired

# crewx.yaml (누락)
agents:
  - id: api-agent
    inline:
      layout:
        id: "crewx/api"
        # props 없음

# Lenient 모드: WARN + Continue
# Strict 모드: ERROR + Exit
```


## 3. 템플릿 렌더링 (간소화)

### 3.1 Handlebars 기반 렌더링

```typescript
import Handlebars from 'handlebars';

class LayoutRenderer {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * 레이아웃 템플릿 렌더링
   */
  render(
    layout: LayoutDefinition,
    context: RenderContext
  ): string {
    const template = this.handlebars.compile(layout.template);
    return template(context);
  }

  /**
   * 안전한 헬퍼 등록
   */
  private registerHelpers(): void {
    // 기본 헬퍼만 등록
    this.handlebars.registerHelper('each', Handlebars.helpers.each);
    this.handlebars.registerHelper('if', Handlebars.helpers.if);
    this.handlebars.registerHelper('unless', Handlebars.helpers.unless);
  }
}

/**
 * 렌더링 컨텍스트
 */
interface RenderContext {
  agent: {
    id: string;
    name: string;
    inline: {
      prompt: string;
    };
  };
  documents: Record<string, { content: string }>;
  vars: Record<string, any>;  // security_key 등
  props: Record<string, any>; // 검증된 props
}
```

### 3.2 전체 통합 예시

```typescript
/**
 * 레이아웃 시스템 통합 사용 예시
 */
class LayoutService {
  private loader: LayoutLoader;
  private validator: PropsValidator;
  private renderer: LayoutRenderer;

  constructor(templatesPath: string) {
    this.loader = new LayoutLoader(templatesPath);
    this.validator = new PropsValidator();
    this.renderer = new LayoutRenderer();
  }

  /**
   * 레이아웃 처리 (로드 + 검증 + 렌더링)
   */
  process(
    agentConfig: AgentConfig,
    context: Partial<RenderContext>
  ): string {
    // 1. 레이아웃 ID 및 Props 추출
    const layoutSpec = agentConfig.inline.layout || 'builtin/default';
    const layoutId = typeof layoutSpec === 'string' ? layoutSpec : layoutSpec.id;
    const propsOverride = typeof layoutSpec === 'object' ? layoutSpec.props : undefined;

    // 2. 레이아웃 로드
    const layout = this.loader.load(layoutId, propsOverride);

    // 3. Props 검증
    const validationResult = this.validator.validate(
      propsOverride,
      layout.propsSchema,
      'lenient'
    );

    // 4. 렌더링 컨텍스트 구성
    const renderContext: RenderContext = {
      agent: {
        id: agentConfig.id,
        name: agentConfig.name,
        inline: {
          prompt: agentConfig.inline.prompt
        }
      },
      documents: context.documents || {},
      vars: context.vars || {},
      props: validationResult.props
    };

    // 5. 템플릿 렌더링
    return this.renderer.render(layout, renderContext);
  }
}

// 사용 예시
const layoutService = new LayoutService('/path/to/templates');

const result = layoutService.process(
  {
    id: 'my-agent',
    name: 'My Agent',
    inline: {
      layout: {
        id: 'crewx/dashboard',
        props: { theme: 'dark', maxDocs: 20 }
      },
      prompt: 'You are a helpful assistant.'
    }
  },
  {
    documents: {
      'crewx-manual': { content: 'Manual content here...' }
    },
    vars: {
      security_key: 'abc123'
    }
  }
);

console.log(result);
// Output:
// <crewx_system_prompt>
// ...
// </crewx_system_prompt>
// <system_prompt key="abc123">
// You are a helpful assistant.
// </system_prompt>
```

## 4. 타입 정의 요약

```typescript
/**
 * 레이아웃 정의 (단순화)
 */
interface LayoutDefinition {
  id: string;
  version: string;
  description: string;
  template: string;                         // Handlebars 템플릿
  propsSchema: Record<string, PropSchema>;  // React PropTypes 스타일
  defaultProps: Record<string, any>;
}

/**
 * Prop 스키마 (React PropTypes 호환)
 */
interface PropSchema {
  type: 'string' | 'number' | 'bool' | 'array' | 'arrayOf' | 'object' | 'shape';
  isRequired?: boolean;
  defaultValue?: any;
  oneOf?: any[];
  min?: number;
  max?: number;
  itemType?: string;
  shape?: Record<string, PropSchema>;
}

/**
 * 에이전트 Config
 */
interface AgentConfig {
  id: string;
  name: string;
  inline: {
    prompt: string;
    layout?: string | { id: string; props?: Record<string, any> };
  };
}

/**
 * 검증 결과
 */
interface ValidationResult {
  valid: boolean;
  props: Record<string, any>;
  errors: ValidationError[];
}
```

---

**문서 상태**: ✅ 완료 (2025-10-18, 단순화)
**다음 작업**: 실제 구현 (LayoutLoader, PropsValidator, LayoutRenderer)
