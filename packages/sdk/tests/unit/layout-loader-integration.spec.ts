/**
 * Integration tests for LayoutLoader with actual template files
 * Tests WBS-12 Phase 1 against real templates/agents/*.yaml files
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';

// Unmock fs and js-yaml for these tests since LayoutLoader needs real file system access
vi.unmock('fs');
vi.unmock('js-yaml');

import { LayoutLoader } from '../../src/services/layout-loader.service';

describe('LayoutLoader Integration (Real Templates)', () => {
  // Resolve path from SDK package to project root templates directory
  // process.cwd() = /Users/doha/git/crewx/packages/sdk
  const realTemplatesPath = path.resolve(process.cwd(), '../../templates/agents');
  let loader: LayoutLoader;

  beforeEach(() => {
    loader = new LayoutLoader({ templatesPath: realTemplatesPath });
  });

  describe('Loading Real Templates', () => {
    it('should load default.yaml from templates/agents/', () => {
      const layout = loader.load('crewx/default');

      expect(layout).toBeDefined();
      expect(layout.id).toBe('crewx/default');
      expect(layout.template).toContain('<crewx_system_prompt key="{{vars.security_key}}">');
      expect(layout.template).toContain('You are a built-in AI agent');
    });

    it('should handle layouts map format in default.yaml', () => {
      const layout = loader.load('default');

      expect(layout.template).toBeDefined();
      expect(typeof layout.template).toBe('string');
      expect(layout.template.length).toBeGreaterThan(0);
    });

    it('should list all available real layouts', () => {
      const layoutIds = loader.getLayoutIds();

      expect(layoutIds).toBeInstanceOf(Array);
      expect(layoutIds.length).toBeGreaterThan(0);

      // Check that IDs follow crewx/<name> convention
      for (const id of layoutIds) {
        expect(id).toMatch(/^crewx\//);
      }
    });
  });

  describe('Real Template Content Validation', () => {
    it('should have proper Handlebars template syntax', () => {
      const layout = loader.load('crewx/default');

      // Check for Handlebars syntax
      expect(layout.template).toMatch(/\{\{.*?\}\}/); // {{ }} syntax
      expect(layout.template).toMatch(/\{\{\{.*?\}\}\}/); // {{{ }}} syntax
    });

    it('should include security key variable reference', () => {
      const layout = loader.load('crewx/default');

      expect(layout.template).toContain('{{vars.security_key}}');
    });

    it('should include agent prompt injection point', () => {
      const layout = loader.load('crewx/default');

      // Should have a place to inject agent's system prompt
      expect(layout.template).toMatch(/\{\{\{.*?system_prompt.*?\}\}\}/);
    });
  });

  describe('Template File Formats', () => {
    it('should support .yaml extension', () => {
      const yamlLayouts = loader.getLayoutIds();
      expect(yamlLayouts.length).toBeGreaterThan(0);
    });

    it('should handle missing optional fields gracefully', () => {
      const layout = loader.load('crewx/default');

      // These fields might be missing in simple layouts
      expect(layout.version).toBeDefined(); // Should have default
      expect(layout.description).toBeDefined(); // Should have default
      expect(layout.propsSchema).toBeDefined(); // Should exist (even if empty)
      expect(layout.defaultProps).toBeDefined(); // Should exist (even if empty)
    });
  });

  describe('Fallback with Real Templates', () => {
    it('should fallback to crewx/default for unknown layouts', () => {
      const layout = loader.load('crewx/unknown-layout-xyz');

      expect(layout.id).toBe('crewx/default');
    });
  });

  describe('Props Override with Real Templates', () => {
    it('should apply props override even to layouts without propsSchema', () => {
      const layout = loader.load('crewx/default', {
        customProp: 'customValue',
      });

      expect(layout.defaultProps.customProp).toBe('customValue');
    });
  });

  describe('Reload Functionality', () => {
    it('should reload real templates successfully', () => {
      const beforeIds = loader.getLayoutIds();

      loader.reload();

      const afterIds = loader.getLayoutIds();
      expect(afterIds.length).toBe(beforeIds.length);
    });
  });
});
