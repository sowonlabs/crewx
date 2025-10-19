/**
 * LayoutRenderer Service
 *
 * Handlebars 템플릿 엔진을 사용한 레이아웃 렌더링 서비스
 * - 보안 이스케이프 처리
 * - XSS 방지 헬퍼 제어
 * - Props 주입 및 렌더링
 */

import Handlebars from 'handlebars';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PropsValidator } from './props-validator.service';
import type {
  LayoutDefinition,
  RenderContext,
  PropSchema,
  ValidationResult,
} from '../types/layout.types';
import { PropsValidationError as LayoutPropsValidationError } from '../types/layout.types';

// Re-export PropsValidationError and related types for backward compatibility
export { PropsValidationError } from '../types/layout.types';
export type {
  LayoutDefinition,
  RenderContext,
  PropSchema,
  ValidationResult as PropsValidationResult,
} from '../types/layout.types';

export interface RenderOptions {
  /** Validation mode used when props schema is available. Defaults to lenient. */
  validationMode?: 'strict' | 'lenient';
  /** Skip schema validation and only merge defaults. Use when props are pre-validated. */
  skipValidation?: boolean;
}

/**
 * LayoutRenderer Service
 *
 * Handlebars 템플릿 엔진을 사용한 레이아웃 렌더링
 */
export class LayoutRenderer {
  private readonly handlebars: typeof Handlebars;
  private readonly propsValidator: PropsValidator;

  constructor(propsValidator?: PropsValidator) {
    this.handlebars = Handlebars.create();
    this.propsValidator = propsValidator ?? new PropsValidator();
    this.registerHelpers();
  }

  /**
   * 레이아웃 템플릿 렌더링
   *
   * @param layout 레이아웃 정의
   * @param context 렌더링 컨텍스트
   * @param options 렌더링 옵션
   * @returns 렌더링된 문자열
   */
  render(
    layout: LayoutDefinition,
    context: RenderContext,
    options: RenderOptions = {},
  ): string {
    try {
      const preparedContext = this.prepareRenderContext(layout, context, options);
      const template = this.handlebars.compile(layout.template);
      const result = template(preparedContext);

      this.validateSecurityConstraints(result);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Template rendering failed for layout '${layout.id}': ${error.message}`);
      }
      throw new Error(`Unknown error rendering layout '${layout.id}'`);
    }
  }

  /**
   * Props 검증 (React PropTypes 스타일)
   */
  validate(
    props: Record<string, any> | undefined,
    propsSchema: Record<string, PropSchema>,
    mode: 'strict' | 'lenient' = 'lenient',
  ): ValidationResult {
    return this.executeValidation(props, propsSchema, mode);
  }

  /**
   * 기본 props와 런타임 props를 병합하고 필요시 검증한다.
   */
  resolveProps(
    layout: LayoutDefinition,
    props: Record<string, any> | undefined,
    mode: 'strict' | 'lenient' = 'lenient',
  ): ValidationResult {
    const mergedProps = this.mergeProps(layout.defaultProps, props);

    if (!layout.propsSchema || Object.keys(layout.propsSchema).length === 0) {
      return {
        valid: true,
        props: mergedProps,
        errors: [],
      };
    }

    return this.executeValidation(mergedProps, layout.propsSchema, mode);
  }

  private prepareRenderContext(
    layout: LayoutDefinition,
    context: RenderContext,
    options: RenderOptions,
  ): RenderContext {
    const { validationMode = 'lenient', skipValidation = false } = options;
    const resolvedProps = skipValidation
      ? this.mergeProps(layout.defaultProps, context.props)
      : this.resolveProps(layout, context.props, validationMode).props;

    return {
      ...context,
      props: resolvedProps,
    };
  }

  /**
   * 안전한 헬퍼 등록
   * 보안을 위해 허용된 헬퍼만 등록
   */
  private registerHelpers(): void {
    if (Handlebars.helpers.each) {
      this.handlebars.registerHelper('each', Handlebars.helpers.each);
    }
    if (Handlebars.helpers.if) {
      this.handlebars.registerHelper('if', Handlebars.helpers.if);
    }
    if (Handlebars.helpers.unless) {
      this.handlebars.registerHelper('unless', Handlebars.helpers.unless);
    }
    if (Handlebars.helpers.with) {
      this.handlebars.registerHelper('with', Handlebars.helpers.with);
    }

    this.handlebars.registerHelper('eq', function(a: any, b: any): boolean {
      return a === b;
    });

    this.handlebars.registerHelper('ne', function(a: any, b: any): boolean {
      return a !== b;
    });

    this.handlebars.registerHelper('gt', function(a: number, b: number): boolean {
      return a > b;
    });

    this.handlebars.registerHelper('lt', function(a: number, b: number): boolean {
      return a < b;
    });

    this.handlebars.registerHelper('json', function(obj: any): Handlebars.SafeString {
      return new Handlebars.SafeString(JSON.stringify(obj));
    });

    this.handlebars.registerHelper('raw', function(this: any, options: any) {
      return typeof options?.fn === 'function' ? options.fn(this) : '';
    });

    const handlebarsInstance = this.handlebars;

    this.handlebars.registerHelper('formatConversation', (messages: any, platform: any, options?: any) => {
      const isBlockHelper = options && typeof options.fn === 'function';

      if (!Array.isArray(messages) || messages.length === 0) {
        return '';
      }

      const assistantAgentIds: string[] = Array.from(
        new Set(
          messages
            .filter((msg: any) => msg?.isAssistant && msg?.metadata?.agent_id)
            .map((msg: any) => msg.metadata.agent_id)
        )
      );

      const primaryAgentId = assistantAgentIds.length > 0 ? assistantAgentIds[0] : '';

      if (isBlockHelper) {
        return options.fn({
          messages,
          platform,
          messagesCount: messages.length,
          agentIds: assistantAgentIds,
          primaryAgentId,
        });
      }

      const templatePath = join(process.cwd(), '.crewx', 'templates', 'conversation-history-default.hbs');
      let templateContent: string | undefined;

      try {
        if (existsSync(templatePath)) {
          templateContent = readFileSync(templatePath, 'utf8');
        }
      } catch {
        // Ignore read errors and fall back to inline template
      }

      if (!templateContent) {
        templateContent = `{{#if messages}}
{{#if primaryAgentId}}Primary agent: @{{primaryAgentId}}
{{else}}Primary agent: (unknown)
{{/if}}
Previous conversation ({{messagesCount}} messages):
{{#each messages}}
{{#if isAssistant}}
**Assistant{{#if metadata.agent_id}} (@{{metadata.agent_id}}){{/if}}**
{{else}}
**{{#if metadata.slack}}{{#with metadata.slack}}{{#if user_profile.display_name}}{{user_profile.display_name}}{{else if username}}{{username}}{{else if user_id}}User ({{user_id}}){{else}}User{{/if}}{{/with}}{{else}}User{{/if}}**
{{/if}}: {{{text}}}
{{/each}}{{/if}}`;
      }

      const template = handlebarsInstance.compile(templateContent, { noEscape: true });
      return template({
        messages,
        platform,
        messagesCount: messages.length,
        agentIds: assistantAgentIds,
        primaryAgentId,
      });
    });
  }

  /**
   * 보안 제약 조건 검증
   */
  private validateSecurityConstraints(content: string): void {
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        throw new Error('Security constraint violation: Potentially dangerous content detected');
      }
    }

    if (!content.includes('<crewx_system_prompt>') && !content.includes('<system_prompt')) {
      console.warn('Warning: Layout does not contain required security containers');
    }
  }

  private executeValidation(
    props: Record<string, any> | undefined,
    propsSchema: Record<string, PropSchema>,
    mode: 'strict' | 'lenient',
  ): ValidationResult {
    try {
      return this.propsValidator.validate(props, propsSchema, mode);
    } catch (error) {
      if (error instanceof LayoutPropsValidationError && error.errors && error.errors.length > 0) {
        const firstError = error.errors[0];
        if (firstError) {
          throw new LayoutPropsValidationError(firstError.message, error.errors);
        }
      }
      throw error;
    }
  }

  private mergeProps(
    defaultProps: Record<string, any> | undefined,
    overrides: Record<string, any> | undefined,
  ): Record<string, any> {
    const base = this.cloneDeep(defaultProps ?? {});

    if (!overrides) {
      return base;
    }

    return this.deepMerge(base, overrides);
  }

  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    for (const [key, value] of Object.entries(source)) {
      if (this.isPlainObject(value)) {
        const existing = target[key];
        target[key] = this.deepMerge(
          this.isPlainObject(existing) ? existing : {},
          value as Record<string, any>,
        );
        continue;
      }

      if (Array.isArray(value)) {
        target[key] = this.cloneDeep(value);
        continue;
      }

      target[key] = value;
    }

    return target;
  }

  private cloneDeep<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map(item => this.cloneDeep(item)) as unknown as T;
    }

    if (this.isPlainObject(value)) {
      const cloned: Record<string, any> = {};
      for (const [key, nested] of Object.entries(value as Record<string, any>)) {
        cloned[key] = this.cloneDeep(nested);
      }
      return cloned as T;
    }

    return value;
  }

  private isPlainObject(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
