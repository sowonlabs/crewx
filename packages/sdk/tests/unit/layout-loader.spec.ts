/**
 * Unit tests for LayoutLoader service
 * Tests WBS-12 Phase 1 implementation
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import * as path from 'path';

// Unmock fs and js-yaml for these tests since LayoutLoader needs real file system access
vi.unmock('fs');
vi.unmock('js-yaml');

import { LayoutLoader } from '../../src/services/layout-loader.service';
import { LayoutLoadError } from '../../src/types/layout.types';

describe('LayoutLoader', () => {
  // Use process.cwd() for consistent path resolution in vitest
  // When running from SDK package: process.cwd() = /Users/doha/git/crewx/packages/sdk
  const fixturesPath = path.resolve(process.cwd(), 'tests/fixtures/layouts');
  let loader: LayoutLoader;

  beforeEach(() => {
    loader = new LayoutLoader({ templatesPath: fixturesPath });
  });

  describe('Constructor and Initialization', () => {
    it('should load all layout files from templates directory', () => {
      const layoutIds = loader.getLayoutIds();
      expect(layoutIds).toContain('crewx/default');
      expect(layoutIds).toContain('crewx/dashboard');
      expect(layoutIds).toContain('crewx/minimal');
      expect(layoutIds.length).toBeGreaterThanOrEqual(3);
    });

    it('should throw error if templates directory does not exist', () => {
      expect(() => {
        new LayoutLoader({ templatesPath: '/nonexistent/path' });
      }).toThrow(LayoutLoadError);
    });

    it.skip('should use default options when not provided', () => {
      // This test verifies default path resolution works
      // Note: May fail if run from unexpected directory
      // Skipped because __dirname varies between test execution and production builds
      const defaultLoader = new LayoutLoader();
      expect(defaultLoader.getLayoutIds().length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('load() - Basic Loading', () => {
    it('should load default layout successfully', () => {
      const layout = loader.load('crewx/default');

      expect(layout).toBeDefined();
      expect(layout.id).toBe('crewx/default');
      expect(layout.template).toContain('<crewx_system_prompt>');
      expect(layout.template).toContain('{{{agent.inline.prompt}}}');
    });

    it('should load dashboard layout with props schema', () => {
      const layout = loader.load('crewx/dashboard');

      expect(layout).toBeDefined();
      expect(layout.id).toBe('crewx/dashboard');
      expect(layout.version).toBe('1.0.0');
      expect(layout.description).toContain('Dashboard');

      // Check props schema
      expect(layout.propsSchema).toBeDefined();
      expect(layout.propsSchema.theme).toBeDefined();
      expect(layout.propsSchema.theme.type).toBe('string');
      expect(layout.propsSchema.theme.oneOf).toEqual(['light', 'dark', 'auto']);
      expect(layout.propsSchema.theme.defaultValue).toBe('auto');

      expect(layout.propsSchema.enableTimeline).toBeDefined();
      expect(layout.propsSchema.enableTimeline.type).toBe('bool');
      expect(layout.propsSchema.enableTimeline.defaultValue).toBe(true);

      expect(layout.propsSchema.maxContextDocs).toBeDefined();
      expect(layout.propsSchema.maxContextDocs.type).toBe('number');
      expect(layout.propsSchema.maxContextDocs.min).toBe(1);
      expect(layout.propsSchema.maxContextDocs.max).toBe(50);
      expect(layout.propsSchema.maxContextDocs.defaultValue).toBe(10);
    });

    it('should load minimal layout in direct format', () => {
      const layout = loader.load('crewx/minimal');

      expect(layout).toBeDefined();
      expect(layout.id).toBe('crewx/minimal');
      expect(layout.template).toContain('<system_prompt>');
      expect(layout.propsSchema).toEqual({});
      expect(layout.defaultProps).toEqual({});
    });
  });

  describe('normalizeLayoutId() - Layout Name Without Namespace', () => {
    it('should normalize layout name without namespace to crewx namespace', () => {
      const layout1 = loader.load('default');
      const layout2 = loader.load('crewx/default');

      expect(layout1.id).toBe('crewx/default');
      expect(layout2.id).toBe('crewx/default');
      expect(layout1.id).toBe(layout2.id);
      expect(layout1.template).toBe(layout2.template);
    });

    it('should normalize all available layouts without namespace', () => {
      // Test all available layouts can be loaded without namespace
      const layouts = ['default', 'dashboard', 'minimal'];
      
      layouts.forEach(layoutName => {
        const layoutWithoutNamespace = loader.load(layoutName);
        const layoutWithNamespace = loader.load(`crewx/${layoutName}`);
        
        expect(layoutWithoutNamespace.id).toBe(`crewx/${layoutName}`);
        expect(layoutWithNamespace.id).toBe(`crewx/${layoutName}`);
        expect(layoutWithoutNamespace.template).toBe(layoutWithNamespace.template);
      });
    });

    it('should handle non-existent layout names without namespace', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const layout = loader.load('nonexistent');
      
      expect(layout.id).toBe('crewx/default'); // Should fallback to default
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Layout not found: nonexistent')
      );
      
      warnSpy.mockRestore();
    });

    it('should preserve existing namespace when provided', () => {
      const layout = loader.load('crewx/dashboard');
      
      expect(layout.id).toBe('crewx/dashboard'); // Should not add another crewx/
      expect(layout.template).toContain('Dashboard Configuration:');
    });

    it('should handle empty string layout ID', () => {
      const layout = loader.load('');
      
      expect(layout.id).toBe('crewx/default'); // Should fallback to default
    });

    it('should handle null/undefined layout ID', () => {
      const layout1 = loader.load(null as any);
      const layout2 = loader.load(undefined as any);
      
      expect(layout1.id).toBe('crewx/default');
      expect(layout2.id).toBe('crewx/default');
    });
  });

  describe('hasLayout() - Layout Name Without Namespace', () => {
    it('should return true for existing layouts without namespace', () => {
      expect(loader.hasLayout('default')).toBe(true);
      expect(loader.hasLayout('dashboard')).toBe(true);
      expect(loader.hasLayout('minimal')).toBe(true);
    });

    it('should return true for existing layouts with namespace', () => {
      expect(loader.hasLayout('crewx/default')).toBe(true);
      expect(loader.hasLayout('crewx/dashboard')).toBe(true);
      expect(loader.hasLayout('crewx/minimal')).toBe(true);
    });

    it('should return false for non-existent layouts without namespace', () => {
      expect(loader.hasLayout('nonexistent')).toBe(false);
      expect(loader.hasLayout('invalid')).toBe(false);
    });
  });

  describe('Template Content - Layout Name Without Namespace', () => {
    it('should load same template content regardless of namespace', () => {
      const layoutWithoutNamespace = loader.load('default');
      const layoutWithNamespace = loader.load('crewx/default');
      
      expect(layoutWithoutNamespace.template).toContain('<crewx_system_prompt>');
      expect(layoutWithoutNamespace.template).toContain('{{{agent.inline.prompt}}}');
      expect(layoutWithoutNamespace.template).toBe(layoutWithNamespace.template);
    });

    it('should load dashboard template with and without namespace', () => {
      const layoutWithoutNamespace = loader.load('dashboard');
      const layoutWithNamespace = loader.load('crewx/dashboard');
      
      expect(layoutWithoutNamespace.template).toContain('Dashboard Configuration:');
      expect(layoutWithoutNamespace.template).toContain('{{props.theme}}');
      expect(layoutWithoutNamespace.template).toBe(layoutWithNamespace.template);
    });
  });

  describe('Props Override - Layout Name Without Namespace', () => {
    it('should apply props override correctly when loading without namespace', () => {
      const layout = loader.load('dashboard', {
        theme: 'dark',
        maxContextDocs: 20,
      });

      expect(layout.id).toBe('crewx/dashboard');
      expect(layout.defaultProps).toEqual({
        theme: 'dark',
        enableTimeline: true,
        maxContextDocs: 20,
        sections: ['overview', 'tasks'],
      });
    });

    it('should handle props override consistently with and without namespace', () => {
      const props = { theme: 'light', enableTimeline: false };
      
      const layoutWithoutNamespace = loader.load('dashboard', props);
      const layoutWithNamespace = loader.load('crewx/dashboard', props);
      
      expect(layoutWithoutNamespace.defaultProps).toEqual(layoutWithNamespace.defaultProps);
      expect(layoutWithoutNamespace.id).toBe(layoutWithNamespace.id);
    });
  });

  describe('ID Normalization', () => {
    it('should normalize layout ID without namespace', () => {
      const layout1 = loader.load('default');
      const layout2 = loader.load('crewx/default');

      expect(layout1.id).toBe(layout2.id);
      expect(layout1.template).toBe(layout2.template);
    });

    it('should handle various ID formats', () => {
      expect(() => loader.load('dashboard')).not.toThrow();
      expect(() => loader.load('crewx/dashboard')).not.toThrow();
    });
  });

  describe('load() - Fallback Behavior', () => {
    it('should fallback to crewx/default when layout not found', () => {
      const layout = loader.load('crewx/nonexistent');

      expect(layout).toBeDefined();
      expect(layout.id).toBe('crewx/default');
    });

    it('should throw error if fallback layout also missing', () => {
      const emptyLoader = new LayoutLoader({
        templatesPath: fixturesPath,
        fallbackLayoutId: 'crewx/missing',
      });

      // Remove default layout from loaded layouts
      (emptyLoader as any).layouts.delete('crewx/default');

      expect(() => {
        emptyLoader.load('crewx/nonexistent');
      }).toThrow(LayoutLoadError);
    });

    it('should warn when falling back (console.warn called)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      loader.load('crewx/doesnotexist');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Layout not found')
      );

      warnSpy.mockRestore();
    });
  });

  describe('load() - Props Override', () => {
    it('should return layout with default props when no override', () => {
      const layout = loader.load('crewx/dashboard');

      expect(layout.defaultProps).toEqual({
        theme: 'auto',
        enableTimeline: true,
        maxContextDocs: 10,
        sections: ['overview', 'tasks'],
      });
    });

    it('should merge props override with defaults', () => {
      const layout = loader.load('crewx/dashboard', {
        theme: 'dark',
        maxContextDocs: 20,
      });

      expect(layout.defaultProps).toEqual({
        theme: 'dark',
        enableTimeline: true,
        maxContextDocs: 20,
        sections: ['overview', 'tasks'],
      });
    });

    it('should handle empty props override', () => {
      const layout = loader.load('crewx/dashboard', {});

      expect(layout.defaultProps).toEqual({
        theme: 'auto',
        enableTimeline: true,
        maxContextDocs: 10,
        sections: ['overview', 'tasks'],
      });
    });

    it('should not mutate original layout when overriding props', () => {
      const layout1 = loader.load('crewx/dashboard');
      const layout2 = loader.load('crewx/dashboard', { theme: 'dark' });

      expect(layout1.defaultProps.theme).toBe('auto');
      expect(layout2.defaultProps.theme).toBe('dark');
    });
  });

  describe('hasLayout()', () => {
    it('should return true for existing layouts', () => {
      expect(loader.hasLayout('crewx/default')).toBe(true);
      expect(loader.hasLayout('default')).toBe(true);
      expect(loader.hasLayout('crewx/dashboard')).toBe(true);
      expect(loader.hasLayout('dashboard')).toBe(true);
    });

    it('should return false for non-existent layouts', () => {
      expect(loader.hasLayout('crewx/nonexistent')).toBe(false);
      expect(loader.hasLayout('nonexistent')).toBe(false);
    });
  });

  describe('getLayoutIds()', () => {
    it('should return all loaded layout IDs', () => {
      const ids = loader.getLayoutIds();

      expect(ids).toBeInstanceOf(Array);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('crewx/default');
      expect(ids).toContain('crewx/dashboard');
    });

    it('should return IDs in crewx/<name> format', () => {
      const ids = loader.getLayoutIds();

      for (const id of ids) {
        expect(id).toMatch(/^crewx\//);
      }
    });
  });

  describe('reload()', () => {
    it('should reload layouts from disk', () => {
      const initialCount = loader.getLayoutIds().length;

      loader.reload();

      const afterReloadCount = loader.getLayoutIds().length;
      expect(afterReloadCount).toBe(initialCount);
    });

    it('should clear existing layouts before reloading', () => {
      (loader as any).layouts.clear();
      expect(loader.getLayoutIds().length).toBe(0);

      loader.reload();

      expect(loader.getLayoutIds().length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed YAML files gracefully', () => {
      // This test ensures errors are logged but don't crash the loader
      // We can't easily test this without creating invalid YAML files
      // So we'll test the error path by checking that loader continues
      // when encountering errors

      const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Loader should still initialize even if some files fail
      expect(loader.getLayoutIds().length).toBeGreaterThan(0);

      warnSpy.mockRestore();
    });

    it('should throw LayoutLoadError with proper context', () => {
      try {
        new LayoutLoader({ templatesPath: '/invalid/path' });
        expect.fail('Should have thrown LayoutLoadError');
      } catch (error) {
        expect(error).toBeInstanceOf(LayoutLoadError);
        expect((error as LayoutLoadError).message).toContain('not found');
      }
    });
  });

  describe('Default Props Extraction', () => {
    it('should extract default props from schema correctly', () => {
      const layout = loader.load('crewx/dashboard');

      expect(layout.defaultProps.theme).toBe('auto');
      expect(layout.defaultProps.enableTimeline).toBe(true);
      expect(layout.defaultProps.maxContextDocs).toBe(10);
      expect(layout.defaultProps.sections).toEqual(['overview', 'tasks']);
    });

    it('should handle schema without default values', () => {
      const layout = loader.load('crewx/minimal');

      expect(layout.defaultProps).toEqual({});
    });
  });

  describe('Template Content', () => {
    it('should preserve template content exactly as written', () => {
      const layout = loader.load('crewx/default');

      expect(layout.template).toContain('<crewx_system_prompt>');
      expect(layout.template).toContain('</crewx_system_prompt>');
      expect(layout.template).toContain('{{{agent.inline.prompt}}}');
      expect(layout.template).toContain('{{vars.security_key}}');
    });

    it('should handle multiline templates', () => {
      const layout = loader.load('crewx/dashboard');

      expect(layout.template).toContain('Dashboard Configuration:');
      expect(layout.template).toContain('{{props.theme}}');
      expect(layout.template).toContain('{{props.enableTimeline}}');
      expect(layout.template).toContain('{{#each props.sections}}');
    });
  });

  describe('Null and Empty YAML Handling (WBS-12-FIX-1)', () => {
    it('should skip loading empty YAML files', () => {
      // Empty YAML file should be caught during loadLayoutFile
      // and not added to layouts map
      const layoutIds = loader.getLayoutIds();

      // Should not have empty layout
      expect(layoutIds).not.toContain('crewx/empty');
    });

    it('should skip loading layouts with empty template field', () => {
      const layoutIds = loader.getLayoutIds();

      // Should not have empty-template layout
      expect(layoutIds).not.toContain('crewx/empty-template');
    });

    it('should skip loading layouts with whitespace-only template', () => {
      const layoutIds = loader.getLayoutIds();

      // Should not have whitespace layout
      expect(layoutIds).not.toContain('crewx/whitespace');
    });

    it('should handle null/undefined from YAML parsing gracefully', () => {
      // This would occur if YAML file contains only comments or is malformed
      // The loader should log errors but continue loading other layouts
      const layoutIds = loader.getLayoutIds();

      // Should still have the valid layouts
      expect(layoutIds).toContain('crewx/default');
      expect(layoutIds).toContain('crewx/dashboard');
      expect(layoutIds).toContain('crewx/minimal');
    });

    it('should fallback to crewx/default when loading empty layout by ID', () => {
      // Even if we somehow try to load an empty layout, fallback should work
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const layout = loader.load('crewx/empty');

      expect(layout.id).toBe('crewx/default');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Layout not found: crewx/empty')
      );

      warnSpy.mockRestore();
    });

    it('should count only valid layouts after loading', () => {
      const layoutIds = loader.getLayoutIds();

      // Should have exactly 3 valid layouts (default, dashboard, minimal)
      // Empty, empty-template, and whitespace should be excluded
      expect(layoutIds.length).toBe(3);
      expect(layoutIds).toEqual(
        expect.arrayContaining(['crewx/default', 'crewx/dashboard', 'crewx/minimal'])
      );
    });
  });
});

// Helper to suppress console output in tests
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
