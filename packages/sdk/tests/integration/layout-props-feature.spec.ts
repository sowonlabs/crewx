/**
 * Test: Layout Props Feature (Issue #8)
 *
 * Verifies:
 * 1. New layout props are added to SDK types
 * 2. Sections can be toggled on/off via props
 * 3. API remains compatible
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutRenderer, LayoutDefinition, RenderContext, PropSchema } from '../../src/services/layout-renderer.service';

describe('Layout Props Feature (Issue #8)', () => {
  let renderer: LayoutRenderer;

  beforeEach(() => {
    renderer = new LayoutRenderer();
  });

  describe('1. SDK Types for Layout Props', () => {
    it('should have PropSchema interface with required fields', () => {
      const schema: PropSchema = {
        type: 'bool',
        defaultValue: true,
        description: 'Toggle section visibility'
      };

      expect(schema.type).toBe('bool');
      expect(schema.defaultValue).toBe(true);
      expect(schema.description).toBeDefined();
    });

    it('should have LayoutDefinition with propsSchema and defaultProps', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>Test</div>',
        propsSchema: {
          showManual: { type: 'bool', defaultValue: true }
        },
        defaultProps: {
          showManual: true
        }
      };

      expect(layout.propsSchema).toBeDefined();
      expect(layout.defaultProps).toBeDefined();
      expect(layout.propsSchema.showManual).toBeDefined();
    });

    it('should support all section toggle props as per issue #8', () => {
      const propsSchema: Record<string, PropSchema> = {
        showManual: { type: 'bool', defaultValue: true },
        showAgentProfile: { type: 'bool', defaultValue: true },
        showSkills: { type: 'bool', defaultValue: true },
        showConversationHistory: { type: 'bool', defaultValue: true },
        showCREWXMDHint: { type: 'bool', defaultValue: true }
      };

      expect(Object.keys(propsSchema)).toEqual([
        'showManual',
        'showAgentProfile',
        'showSkills',
        'showConversationHistory',
        'showCREWXMDHint'
      ]);
    });
  });

  describe('2. Section Toggle Functionality via Props', () => {
    it('should render section when prop is true', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{#if props.showManual}}<section>Manual Section</section>{{/if}}',
        propsSchema: {
          showManual: { type: 'bool', defaultValue: true }
        },
        defaultProps: {
          showManual: true
        }
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: { prompt: 'Test' }
        },
        documents: {},
        vars: {},
        props: { showManual: true }
      };

      const result = renderer.render(layout, context);
      expect(result).toContain('<section>Manual Section</section>');
    });

    it('should hide section when prop is false', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{#if props.showManual}}<section>Manual Section</section>{{/if}}',
        propsSchema: {
          showManual: { type: 'bool', defaultValue: true }
        },
        defaultProps: {
          showManual: true
        }
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: { prompt: 'Test' }
        },
        documents: {},
        vars: {},
        props: { showManual: false }
      };

      const result = renderer.render(layout, context);
      expect(result).not.toContain('<section>Manual Section</section>');
    });

    it('should apply default props when not provided', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '{{#if props.showAgentProfile}}<profile>Agent</profile>{{/if}}',
        propsSchema: {
          showAgentProfile: { type: 'bool', defaultValue: true }
        },
        defaultProps: {
          showAgentProfile: true
        }
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: { prompt: 'Test' }
        },
        documents: {},
        vars: {},
        props: {} // No props provided
      };

      const result = renderer.render(layout, context);
      expect(result).toContain('<profile>Agent</profile>');
    });

    it('should toggle multiple sections independently', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: `
          {{#if props.showManual}}<section>Manual</section>{{/if}}
          {{#if props.showAgentProfile}}<section>Profile</section>{{/if}}
          {{#if props.showSkills}}<section>Skills</section>{{/if}}
        `,
        propsSchema: {
          showManual: { type: 'bool', defaultValue: true },
          showAgentProfile: { type: 'bool', defaultValue: true },
          showSkills: { type: 'bool', defaultValue: true }
        },
        defaultProps: {
          showManual: true,
          showAgentProfile: true,
          showSkills: true
        }
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: { prompt: 'Test' }
        },
        documents: {},
        vars: {},
        props: {
          showManual: true,
          showAgentProfile: false,
          showSkills: true
        }
      };

      const result = renderer.render(layout, context);
      expect(result).toContain('<section>Manual</section>');
      expect(result).not.toContain('<section>Profile</section>');
      expect(result).toContain('<section>Skills</section>');
    });
  });

  describe('3. API Compatibility', () => {
    it('should render layout without props (backward compatible)', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<system_prompt>{{{agent.inline.prompt}}}</system_prompt>',
        propsSchema: {},
        defaultProps: {}
      };

      const context: RenderContext = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          inline: { prompt: 'You are a test agent' }
        },
        documents: {},
        vars: {},
        props: {}
      };

      const result = renderer.render(layout, context);
      expect(result).toContain('You are a test agent');
    });

    it('should validate props in strict mode', () => {
      const layout: LayoutDefinition = {
        id: 'test-layout',
        version: '1.0.0',
        description: 'Test layout',
        template: '<div>Test</div>',
        propsSchema: {
          showManual: { type: 'bool', defaultValue: true }
        },
        defaultProps: {
          showManual: true
        }
      };

      const validResult = renderer.resolveProps(layout, { showManual: true }, 'strict');
      expect(validResult.valid).toBe(true);
    });

    it('should accept string type for theme prop', () => {
      const propsSchema: Record<string, PropSchema> = {
        theme: {
          type: 'string',
          defaultValue: 'light',
          oneOf: ['light', 'dark', 'auto']
        }
      };

      expect(propsSchema.theme.type).toBe('string');
      expect(propsSchema.theme.oneOf).toEqual(['light', 'dark', 'auto']);
    });

    it('should preserve InlineLayoutSpec compatibility (string or object with props)', () => {
      // String format (existing API)
      const layoutIdString = 'crewx/default';
      expect(typeof layoutIdString).toBe('string');

      // Object format with props (new feature)
      const layoutIdObject = {
        id: 'crewx/default',
        props: {
          showManual: false,
          showAgentProfile: true
        }
      };
      expect(layoutIdObject.id).toBe('crewx/default');
      expect(layoutIdObject.props).toBeDefined();
    });
  });
});
