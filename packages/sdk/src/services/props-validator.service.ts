import {
  PropSchema,
  PropsValidationError,
  ValidationError,
  ValidationResult,
} from '../types/layout.types';

export type ValidationMode = 'strict' | 'lenient';

export interface PropsValidatorOptions {
  /** Default validation mode when none is provided */
  defaultMode?: ValidationMode;
}

interface ResolveResult {
  shouldAssign: boolean;
  value?: any;
}

export class PropsValidator {
  private readonly defaultMode: ValidationMode;

  constructor(options: PropsValidatorOptions = {}) {
    this.defaultMode = options.defaultMode ?? 'lenient';
  }

  validate(
    props: Record<string, any> | undefined,
    schema: Record<string, PropSchema>,
    mode: ValidationMode = this.defaultMode,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const resolvedProps = this.validateObject(
      props ?? {},
      schema,
      mode,
      ['props'],
      errors,
    );

    if (errors.length > 0 && mode === 'strict') {
      throw new PropsValidationError('Props validation failed in strict mode', errors);
    }

    return {
      valid: errors.length === 0,
      props: resolvedProps,
      errors,
    };
  }

  private validateObject(
    provided: Record<string, any>,
    schema: Record<string, PropSchema>,
    mode: ValidationMode,
    pathSegments: string[],
    errors: ValidationError[],
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // Strict mode rejects unknown props
    if (mode === 'strict') {
      for (const key of Object.keys(provided)) {
        if (!schema[key]) {
          errors.push({
            path: this.buildPath([...pathSegments, key]),
            message: `Unknown prop '${key}'`,
            value: provided[key],
          });
        }
      }
    }

    for (const [key, propSchema] of Object.entries(schema)) {
      const fullPath = [...pathSegments, key];
      const rawValue = provided[key];
      const result = this.resolveProp(rawValue, propSchema, fullPath, mode, errors);

      if (result.shouldAssign) {
        sanitized[key] = result.value;
      }
    }

    if (mode === 'lenient') {
      // Unknown props are ignored, but valid known props are preserved.
      // No further action needed; sanitized already contains known props.
    } else if (mode === 'strict') {
      // In strict mode, validation errors caused by unknown props should trigger failure later.
    }

    return sanitized;
  }

  private resolveProp(
    value: any,
    schema: PropSchema,
    pathSegments: string[],
    mode: ValidationMode,
    errors: ValidationError[],
  ): ResolveResult {
    const path = this.buildPath(pathSegments);

    if (this.isNil(value)) {
      if (schema.isRequired) {
        errors.push({
          path,
          message: `Required prop '${pathSegments[pathSegments.length - 1]}' is missing`,
        });
      }

      if (schema.defaultValue !== undefined) {
        return { shouldAssign: true, value: this.cloneValue(schema.defaultValue) };
      }

      if (schema.type === 'shape' && schema.shape) {
        const nestedDefaults = this.applyDefaults(schema.shape);
        if (Object.keys(nestedDefaults).length > 0) {
          return { shouldAssign: true, value: nestedDefaults };
        }
      }

      return { shouldAssign: false };
    }

    const typeResult = this.validateType(value, schema, pathSegments, mode, errors);

    if (!typeResult.valid) {
      if (
        schema.type === 'shape' &&
        typeResult.value &&
        this.isPlainObject(typeResult.value)
      ) {
        // Nested validation already reported precise errors; keep sanitized result.
        return { shouldAssign: true, value: typeResult.value };
      }

      errors.push({ path, message: typeResult.error ?? 'Invalid value', value });

      if (schema.defaultValue !== undefined) {
        return { shouldAssign: true, value: this.cloneValue(schema.defaultValue) };
      }

      if (schema.type === 'shape' && schema.shape) {
        const nestedDefaults = this.applyDefaults(schema.shape);
        if (Object.keys(nestedDefaults).length > 0) {
          return { shouldAssign: true, value: nestedDefaults };
        }
      }

      return { shouldAssign: false };
    }

    return { shouldAssign: true, value: typeResult.value };
  }

  private validateType(
    value: any,
    schema: PropSchema,
    pathSegments: string[],
    mode: ValidationMode,
    errors: ValidationError[],
  ): { valid: boolean; error?: string; value?: any } {
    const { type } = schema;

    switch (type) {
      case 'string':
        return this.validateString(value, schema);
      case 'number':
        return this.validateNumber(value, schema);
      case 'bool':
        return this.validateBoolean(value);
      case 'array':
        return this.validateArray(value, schema);
      case 'arrayOf':
        return this.validateArrayOf(value, schema, pathSegments, mode, errors);
      case 'object':
        return this.validatePlainObject(value);
      case 'shape':
        return this.validateShape(value, schema, pathSegments, mode, errors);
      case 'oneOfType':
        return this.validateOneOfType(value, schema);
      case 'func':
        return this.validateFunction(value);
      case 'node':
        return { valid: true, value };
      default:
        return { valid: true, value };
    }
  }

  private validateString(value: any, schema: PropSchema) {
    if (typeof value !== 'string') {
      return { valid: false, error: `Expected string, got ${this.describeType(value)}` };
    }

    if (schema.oneOf && !schema.oneOf.includes(value)) {
      return {
        valid: false,
        error: `Expected one of: ${schema.oneOf.join(', ')}`,
      };
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return {
        valid: false,
        error: `String length must be >= ${schema.minLength}`,
      };
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return {
        valid: false,
        error: `String length must be <= ${schema.maxLength}`,
      };
    }

    if (schema.pattern) {
      const pattern = new RegExp(schema.pattern);
      if (!pattern.test(value)) {
        return {
          valid: false,
          error: `String does not match pattern ${schema.pattern}`,
        };
      }
    }

    return { valid: true, value };
  }

  private validateNumber(value: any, schema: PropSchema) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { valid: false, error: `Expected number, got ${this.describeType(value)}` };
    }

    if (schema.min !== undefined && value < schema.min) {
      return { valid: false, error: `Number must be >= ${schema.min}` };
    }

    if (schema.max !== undefined && value > schema.max) {
      return { valid: false, error: `Number must be <= ${schema.max}` };
    }

    if (schema.oneOf && !schema.oneOf.includes(value)) {
      return {
        valid: false,
        error: `Expected one of: ${schema.oneOf.join(', ')}`,
      };
    }

    return { valid: true, value };
  }

  private validateBoolean(value: any) {
    if (typeof value !== 'boolean') {
      return { valid: false, error: `Expected boolean, got ${this.describeType(value)}` };
    }

    return { valid: true, value };
  }

  private validateArray(value: any, schema: PropSchema) {
    if (!Array.isArray(value)) {
      return { valid: false, error: `Expected array, got ${this.describeType(value)}` };
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return {
        valid: false,
        error: `Array length must be >= ${schema.minLength}`,
      };
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return {
        valid: false,
        error: `Array length must be <= ${schema.maxLength}`,
      };
    }

    return { valid: true, value: [...value] };
  }

  private validateArrayOf(
    value: any,
    schema: PropSchema,
    pathSegments: string[],
    mode: ValidationMode,
    errors: ValidationError[],
  ) {
    const base = this.validateArray(value, schema);
    if (!base.valid) {
      return base;
    }

    const itemValues: any[] = [];
    const itemType = schema.itemType;
    const itemOneOf = schema.itemOneOf;
    const beforeErrors = errors.length;

    base.value!.forEach((item, index) => {
      const itemPath = [...pathSegments, String(index)];

      if (itemType) {
        const result = this.validateType(item, { type: itemType } as PropSchema, itemPath, mode, errors);
        if (!result.valid) {
          errors.push({
            path: this.buildPath(itemPath),
            message: result.error ?? 'Invalid array item',
            value: item,
          });
        } else {
          itemValues.push(result.value);
        }
      } else {
        itemValues.push(item);
      }

      if (itemOneOf && !itemOneOf.includes(item)) {
        errors.push({
          path: this.buildPath(itemPath),
          message: `Array item must be one of: ${itemOneOf.join(', ')}`,
          value: item,
        });
      }
    });

    return { valid: errors.length === beforeErrors, value: itemValues };
  }

  private validatePlainObject(value: any) {
    if (!this.isPlainObject(value)) {
      return { valid: false, error: `Expected object, got ${this.describeType(value)}` };
    }

    return { valid: true, value: { ...value } };
  }

  private validateFunction(value: any) {
    if (typeof value !== 'function') {
      return { valid: false, error: `Expected function, got ${this.describeType(value)}` };
    }

    return { valid: true, value };
  }

  private validateShape(
    value: any,
    schema: PropSchema,
    pathSegments: string[],
    mode: ValidationMode,
    errors: ValidationError[],
  ) {
    if (!this.isPlainObject(value)) {
      return { valid: false, error: `Expected object, got ${this.describeType(value)}` };
    }

    const beforeErrors = errors.length;
    const nested = this.validateObject(
      value,
      schema.shape ?? {},
      mode,
      pathSegments,
      errors,
    );

    return { valid: errors.length === beforeErrors, value: nested };
  }

  private validateOneOfType(value: any, schema: PropSchema) {
    const types = schema.types ?? [];

    const matches = types.some(typeName => this.matchesType(value, typeName));

    if (!matches) {
      return {
        valid: false,
        error: `Value does not match any allowed type: ${types.join(', ')}`,
      };
    }

    return { valid: true, value };
  }

  private matchesType(value: any, typeName: string): boolean {
    switch (typeName) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value);
      case 'bool':
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return this.isPlainObject(value);
      case 'func':
      case 'function':
        return typeof value === 'function';
      case 'shape':
        return this.isPlainObject(value);
      case 'node':
        return value === null || value === undefined || typeof value !== 'symbol';
      default:
        return true;
    }
  }

  private applyDefaults(schema: Record<string, PropSchema>): Record<string, any> {
    const defaults: Record<string, any> = {};

    for (const [key, propSchema] of Object.entries(schema)) {
      if (propSchema.defaultValue !== undefined) {
        defaults[key] = this.cloneValue(propSchema.defaultValue);
        continue;
      }

      if (propSchema.type === 'shape' && propSchema.shape) {
        const nestedDefaults = this.applyDefaults(propSchema.shape);
        if (Object.keys(nestedDefaults).length > 0) {
          defaults[key] = nestedDefaults;
        }
      }
    }

    return defaults;
  }

  private cloneValue<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map(item => this.cloneValue(item)) as unknown as T;
    }

    if (this.isPlainObject(value)) {
      const cloned: Record<string, any> = {};
      for (const [key, nested] of Object.entries(value as Record<string, any>)) {
        cloned[key] = this.cloneValue(nested);
      }
      return cloned as T;
    }

    return value;
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNil(value: any): boolean {
    return value === null || value === undefined;
  }

  private buildPath(segments: string[]): string {
    return segments.join('.');
  }

  private describeType(value: any): string {
    if (Array.isArray(value)) {
      return 'array';
    }

    if (value === null) {
      return 'null';
    }

    return typeof value;
  }
}
