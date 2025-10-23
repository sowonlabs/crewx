import { describe, expect, it } from 'vitest';
import { PropsValidator } from '../../src/services/props-validator.service';
import { PropsValidationError } from '../../src/types/layout.types';
import type { PropSchema } from '../../src/types/layout.types';

describe('PropsValidator', () => {
  const validator = new PropsValidator();

  it('validates primitive props and applies defaults', () => {
    const schema: Record<string, PropSchema> = {
      title: { type: 'string', isRequired: true },
      maxDocuments: { type: 'number', min: 1, max: 50, defaultValue: 10 },
      showTimeline: { type: 'bool', defaultValue: true },
    };

    const result = validator.validate(
      { title: 'Dashboard', maxDocuments: 20 },
      schema,
    );

    expect(result.valid).toBe(true);
    expect(result.props).toStrictEqual({
      title: 'Dashboard',
      maxDocuments: 20,
      showTimeline: true,
    });
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required props with path information', () => {
    const schema: Record<string, PropSchema> = {
      title: { type: 'string', isRequired: true },
      theme: { type: 'string', defaultValue: 'light' },
    };

    const result = validator.validate({}, schema, 'lenient');

    expect(result.valid).toBe(false);
    expect(result.props).toStrictEqual({ theme: 'light' });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'props.title',
        message: "Required prop 'title' is missing",
      }),
    );
  });

  it('enforces oneOf constraints and falls back to defaults in lenient mode', () => {
    const schema: Record<string, PropSchema> = {
      theme: {
        type: 'string',
        oneOf: ['light', 'dark', 'auto'],
        defaultValue: 'auto',
      },
    };

    const result = validator.validate({ theme: 'blue' }, schema, 'lenient');

    expect(result.valid).toBe(false);
    expect(result.props).toStrictEqual({ theme: 'auto' });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe('props.theme');
  });

  it('throws in strict mode when validation fails', () => {
    const schema: Record<string, PropSchema> = {
      theme: {
        type: 'string',
        oneOf: ['light', 'dark'],
        defaultValue: 'light',
      },
    };

    expect(() => validator.validate({ theme: 'blue' }, schema, 'strict')).toThrow(
      PropsValidationError,
    );
  });

  it('ignores unknown props in lenient mode but rejects them in strict mode', () => {
    const schema: Record<string, PropSchema> = {
      theme: { type: 'string', defaultValue: 'light' },
    };

    const lenientResult = validator.validate({ theme: 'dark', extra: true }, schema, 'lenient');
    expect(lenientResult.valid).toBe(true);
    expect(lenientResult.props).toStrictEqual({ theme: 'dark' });

    expect(() => validator.validate({ extra: true }, schema, 'strict')).toThrow(
      PropsValidationError,
    );
  });

  it('validates nested shape props and provides precise error paths', () => {
    const schema: Record<string, PropSchema> = {
      header: {
        type: 'shape',
        shape: {
          title: { type: 'string', isRequired: true },
          width: { type: 'number', defaultValue: 1024 },
        },
      },
    };

    const result = validator.validate(
      { header: { title: 'CrewX Layout', width: 'wide' } },
      schema,
      'lenient',
    );

    expect(result.valid).toBe(false);
    expect(result.props.header).toStrictEqual({ title: 'CrewX Layout', width: 1024 });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'props.header.width' }),
    );
  });

  it('supports oneOfType definitions', () => {
    const schema: Record<string, PropSchema> = {
      identifier: {
        type: 'oneOfType',
        types: ['string', 'number'],
      },
    };

    const numeric = validator.validate({ identifier: 42 }, schema);
    expect(numeric.valid).toBe(true);

    const invalid = validator.validate({ identifier: false }, schema, 'lenient');
    expect(invalid.valid).toBe(false);
    expect(invalid.errors[0].path).toBe('props.identifier');
  });
});
