/**
 * LayoutRenderer Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayoutRenderer, LayoutDefinition, RenderContext, PropSchema } from '../../src/services/layout-renderer.service';

describe('LayoutRenderer', () => {
  let renderer: LayoutRenderer;

  beforeEach(() => {
    renderer = new LayoutRenderer();
    // 콘솔 경고를 무시하도록 mock
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('render', () => {
    it('should render basic template with context', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<system_prompt key="{{vars.security_key}}">{{{agent.inline.prompt}}}</system_prompt>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'You are a test agent'
          }
        },
        documents: {},
        vars: {
          security_key: 'test-key-123'
        },
        props: {}
      };

      const result = renderer.render(layout, context);
      
      expect(result).toContain('<system_prompt key="test-key-123">');
      expect(result).toContain('You are a test agent');
      expect(result).toContain('</system_prompt>');
    });

    it('should render template with props', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>Theme: {{props.theme}}, Count: {{props.count}}</div>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          theme: 'dark',
          count: 42
        }
      };

      const result = renderer.render(layout, context);
      
      expect(result).toContain('Theme: dark');
      expect(result).toContain('Count: 42');
    });

    it('should render template with each helper', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{#each props.items}}{{this}}, {{/each}}',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          items: ['item1', 'item2', 'item3']
        }
      };

      const result = renderer.render(layout, context);
      
      expect(result).toContain('item1, item2, item3,');
    });

    it('should render template with conditional rendering', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{#if props.enabled}}Enabled{{else}}Disabled{{/if}}',
        propsSchema: {},
        defaultProps: {}
      };

      // Test enabled true
      const contextEnabled: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          enabled: true
        }
      };

      const resultEnabled = renderer.render(layout, contextEnabled);
      expect(resultEnabled).toContain('Enabled');

      // Test enabled false
      const contextDisabled: RenderContext = {
        ...contextEnabled,
        props: {
          enabled: false
        }
      };

      const resultDisabled = renderer.render(layout, contextDisabled);
      expect(resultDisabled).toContain('Disabled');
    });

    it('should escape HTML in double braces', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>{{props.content}}</div>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          content: '<script>alert("xss")</script>'
        }
      };

      const result = renderer.render(layout, context);
      
      expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result).not.toContain('<script>alert("xss")</script>');
    });

    it('should allow raw HTML with triple braces', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>{{{props.rawHtml}}}</div>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          rawHtml: '<strong>Bold text</strong>'
        }
      };

      const result = renderer.render(layout, context);
      
      expect(result).toContain('<strong>Bold text</strong>');
    });

    it('should throw error for dangerous content', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>{{{props.content}}}</div>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          content: '<script>alert("xss")</script>'
        }
      };

      expect(() => renderer.render(layout, context)).toThrow('Security constraint violation');
    });
  });

  describe('validate', () => {
    it('should validate string props correctly', () => {
      const schema: Record<string, PropSchema> = {
        theme: {
          type: 'string',
          oneOf: ['light', 'dark', 'auto'],
          defaultValue: 'auto'
        }
      };

      // Valid string
      const result1 = renderer.validate({ theme: 'dark' }, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.theme).toBe('dark');

      // Invalid string (lenient mode)
      const result2 = renderer.validate({ theme: 'invalid' }, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.props.theme).toBe('auto'); // fallback to default
      expect(result2.errors).toHaveLength(1);

      // Invalid string (strict mode)
      expect(() => renderer.validate({ theme: 'invalid' }, schema, 'strict'))
        .toThrow('Expected one of: light, dark, auto');
    });

    it('should validate number props correctly', () => {
      const schema: Record<string, PropSchema> = {
        count: {
          type: 'number',
          min: 1,
          max: 100,
          defaultValue: 10
        }
      };

      // Valid number
      const result1 = renderer.validate({ count: 50 }, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.count).toBe(50);

      // Invalid number (lenient mode)
      const result2 = renderer.validate({ count: 'not-a-number' } as any, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.props.count).toBe(10); // fallback to default

      // Out of range (strict mode)
      expect(() => renderer.validate({ count: 150 }, schema, 'strict'))
        .toThrow('Number must be <= 100');
    });

    it('should validate boolean props correctly', () => {
      const schema: Record<string, PropSchema> = {
        enabled: {
          type: 'bool',
          defaultValue: false
        }
      };

      // Valid boolean
      const result1 = renderer.validate({ enabled: true }, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.enabled).toBe(true);

      // Invalid boolean (lenient mode)
      const result2 = renderer.validate({ enabled: 'true' } as any, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.props.enabled).toBe(false); // fallback to default
    });

    it('should validate array props correctly', () => {
      const schema: Record<string, PropSchema> = {
        tags: {
          type: 'arrayOf',
          itemType: 'string',
          itemOneOf: ['tag1', 'tag2', 'tag3'],
          defaultValue: []
        }
      };

      // Valid array
      const result1 = renderer.validate({ tags: ['tag1', 'tag2'] }, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.tags).toEqual(['tag1', 'tag2']);

      // Invalid array item (lenient mode)
      const result2 = renderer.validate({ tags: ['invalid'] }, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.props.tags).toEqual([]); // fallback to default

      // Not an array (strict mode)
      expect(() => renderer.validate({ tags: 'not-an-array' } as any, schema, 'strict'))
        .toThrow('Expected array, got string');
    });

    it('should validate required props', () => {
      const schema: Record<string, PropSchema> = {
        apiKey: {
          type: 'string',
          isRequired: true
        },
        optional: {
          type: 'string',
          defaultValue: 'default-value'
        }
      };

      // Missing required prop (lenient mode)
      const result1 = renderer.validate({ optional: 'value' }, schema, 'lenient');
      expect(result1.valid).toBe(false);
      expect(result1.errors).toHaveLength(1);

      // Missing required prop (strict mode)
      expect(() => renderer.validate({ optional: 'value' }, schema, 'strict'))
        .toThrow('Required prop \'apiKey\' is missing');
    });

    it('should apply defaults for missing props', () => {
      const schema: Record<string, PropSchema> = {
        theme: {
          type: 'string',
          defaultValue: 'light'
        },
        count: {
          type: 'number',
          defaultValue: 10
        },
        enabled: {
          type: 'bool',
          defaultValue: false
        }
      };

      // No props provided
      const result = renderer.validate(undefined, schema);
      expect(result.valid).toBe(true);
      expect(result.props).toEqual({
        theme: 'light',
        count: 10,
        enabled: false
      });

      // Partial props provided
      const result2 = renderer.validate({ theme: 'dark' }, schema);
      expect(result2.valid).toBe(true);
      expect(result2.props).toEqual({
        theme: 'dark',
        count: 10,
        enabled: false
      });
    });

    it('should validate shape props', () => {
      const schema: Record<string, PropSchema> = {
        style: {
          type: 'shape',
          shape: {
            color: {
              type: 'string',
              defaultValue: 'black'
            },
            fontSize: {
              type: 'number',
              defaultValue: 14
            }
          }
        }
      };

      // Valid shape
      const result1 = renderer.validate({ 
        style: { color: 'red', fontSize: 16 } 
      }, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.style).toEqual({ color: 'red', fontSize: 16 });

      // Invalid shape property (lenient mode)
      const result2 = renderer.validate({ 
        style: { color: 'red', fontSize: 'not-a-number' } as any 
      }, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.errors).toHaveLength(1);
    });

    it('should handle missing props schema gracefully', () => {
      // Empty schema
      const result = renderer.validate({ theme: 'dark' }, {});
      expect(result.valid).toBe(true);
      expect(result.props).toEqual({});

      // Undefined schema
      const result2 = renderer.validate({ theme: 'dark' }, {});
      expect(result2.valid).toBe(true);
      expect(result2.props).toEqual({});
    });

    it('should handle deep nested shapes', () => {
      const schema: Record<string, PropSchema> = {
        config: {
          type: 'shape',
          shape: {
            ui: {
              type: 'shape',
              shape: {
                theme: {
                  type: 'string',
                  oneOf: ['light', 'dark'],
                  defaultValue: 'light'
                },
                layout: {
                  type: 'shape',
                  shape: {
                    header: {
                      type: 'bool',
                      defaultValue: true
                    },
                    sidebar: {
                      type: 'bool',
                      defaultValue: true
                    }
                  }
                }
              }
            },
            api: {
              type: 'shape',
              shape: {
                endpoint: {
                  type: 'string',
                  isRequired: true
                },
                timeout: {
                  type: 'number',
                  defaultValue: 5000
                }
              }
            }
          }
        }
      };

      // Valid deep nested object
      const validConfig = {
        config: {
          ui: {
            theme: 'dark',
            layout: {
              header: false,
              sidebar: true
            }
          },
          api: {
            endpoint: 'https://api.example.com',
            timeout: 10000
          }
        }
      };

      const result1 = renderer.validate(validConfig, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.config.ui.theme).toBe('dark');
      expect(result1.props.config.ui.layout.header).toBe(false);

      // Missing required deep nested property
      const invalidConfig = {
        config: {
          ui: {
            theme: 'dark',
            layout: {
              header: false,
              sidebar: true
            }
          },
          api: {
            // missing endpoint
            timeout: 10000
          }
        }
      };

      const result2 = renderer.validate(invalidConfig, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.message.includes('Required prop'))).toBe(true);

      // Strict mode should throw
      expect(() => renderer.validate(invalidConfig, schema, 'strict'))
        .toThrow(/Required prop/);
    });

    it('should handle type mismatches gracefully', () => {
      const schema: Record<string, PropSchema> = {
        numberField: {
          type: 'number',
          defaultValue: 42
        },
        stringField: {
          type: 'string',
          defaultValue: 'default'
        },
        boolField: {
          type: 'bool',
          defaultValue: false
        },
        arrayField: {
          type: 'arrayOf',
          itemType: 'string',
          defaultValue: []
        }
      };

      // All wrong types (lenient mode)
      const wrongTypes = {
        numberField: 'not-a-number',
        stringField: 123,
        boolField: 'true',
        arrayField: 'not-an-array'
      };

      const result = renderer.validate(wrongTypes, schema, 'lenient');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.props).toEqual({
        numberField: 42,
        stringField: 'default',
        boolField: false,
        arrayField: []
      });

      // Strict mode should throw on first error
      expect(() => renderer.validate(wrongTypes, schema, 'strict'))
        .toThrow(/Expected number/);
    });

    it('should handle PropsValidator integration correctly', () => {
      // Test that LayoutRenderer properly delegates to PropsValidator
      const schema: Record<string, PropSchema> = {
        tags: {
          type: 'arrayOf',
          itemType: 'string',
          itemOneOf: ['urgent', 'normal', 'low'],
          minLength: 1,
          maxLength: 5,
          defaultValue: ['normal']
        },
        priority: {
          type: 'string',
          oneOf: ['high', 'medium', 'low'],
          isRequired: true
        },
        metadata: {
          type: 'shape',
          shape: {
            created: {
              type: 'number',
              min: 0
            },
            author: {
              type: 'string',
              pattern: '^[a-zA-Z]+$'
            }
          }
        }
      };

      // Valid complex props
      const validProps = {
        tags: ['urgent', 'normal'],
        priority: 'high',
        metadata: {
          created: Date.now(),
          author: 'JohnDoe'
        }
      };

      const result1 = renderer.validate(validProps, schema);
      expect(result1.valid).toBe(true);
      expect(result1.props.tags).toEqual(['urgent', 'normal']);
      expect(result1.props.priority).toBe('high');
      expect(result1.props.metadata.created).toBe(validProps.metadata.created);
      expect(result1.props.metadata.author).toBe('JohnDoe');

      // Invalid array item
      const invalidProps = {
        tags: ['urgent', 'invalid-priority'],
        priority: 'high'
      };

      const result2 = renderer.validate(invalidProps, schema, 'lenient');
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.message.includes('Array item must be one of'))).toBe(true);
      expect(result2.props.tags).toEqual(['normal']); // fallback to default

      // Pattern mismatch
      const patternMismatch = {
        tags: ['normal'],
        priority: 'medium',
        metadata: {
          created: 123,
          author: 'John123' // invalid pattern
        }
      };

      const result3 = renderer.validate(patternMismatch, schema, 'lenient');
      expect(result3.valid).toBe(false);
      expect(result3.errors.some(e => e.message.includes('does not match pattern'))).toBe(true);
    });

    it('should maintain error message consistency', () => {
      const schema: Record<string, PropSchema> = {
        name: {
          type: 'string',
          isRequired: true
        },
        age: {
          type: 'number',
          min: 0,
          max: 150
        },
        email: {
          type: 'string',
          pattern: '^[^@]+@[^@]+\\.[^@]+$'
        }
      };

      // Test error message format consistency
      const invalidProps = {
        // name missing
        age: -5, // below min
        email: 'invalid-email' // pattern mismatch
      };

      const result = renderer.validate(invalidProps, schema, 'lenient');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);

      // Check that error messages are descriptive
      const missingError = result.errors.find(e => e.message.includes('missing'));
      const minError = result.errors.find(e => e.message.includes('>='));
      const patternError = result.errors.find(e => e.message.includes('pattern'));

      expect(missingError).toBeDefined();
      expect(minError).toBeDefined();
      expect(patternError).toBeDefined();

      // Check error paths are correct
      expect(missingError?.path).toBe('props.name');
      expect(minError?.path).toBe('props.age');
      expect(patternError?.path).toBe('props.email');
    });
  });

  describe('security validation', () => {
    it('should warn about missing security containers', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>No security containers</div>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {}
      };

      renderer.render(layout, context);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Warning: Layout does not contain required security containers'
      );
    });

    it('should allow safe security containers', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: `
          <crewx_system_prompt>
          System content
          </crewx_system_prompt>
          <system_prompt key="{{vars.security_key}}">
          {{{agent.inline.prompt}}}
          </system_prompt>
        `,
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {
          security_key: 'test-key'
        },
        props: {}
      };

      const result = renderer.render(layout, context);
      
      expect(result).toContain('<crewx_system_prompt>');
      expect(result).toContain('<system_prompt key="test-key">');
      expect(result).toContain('Test prompt');
    });
  });

  describe('custom helpers', () => {
    it('should support eq helper', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{#if (eq props.theme "dark")}}Dark mode{{else}}Light mode{{/if}}',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          theme: 'dark'
        }
      };

      const result = renderer.render(layout, context);
      expect(result).toContain('Dark mode');
    });

    it('should support json helper', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{json props.config}}',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: {
            prompt: 'Test prompt'
          }
        },
        documents: {},
        vars: {},
        props: {
          config: {
            theme: 'dark',
            count: 42
          }
        }
      };

      const result = renderer.render(layout, context);
      expect(result).toBe('{"theme":"dark","count":42}');
    });
  });
});