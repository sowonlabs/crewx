/**
 * LayoutLoader Service
 *
 * Loads layout templates from templates/agents/*.yaml files.
 * Implements WBS-11 Phase 2 specification with simplified loading strategy.
 *
 * Key features:
 * - Loads CrewX builtin layouts from templates/agents/ directory
 * - Supports crewx/<name> namespace format
 * - Automatic fallback to crewx/default
 * - Props override from agent config
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import * as path from 'path';
import { load as loadYaml } from 'js-yaml';
import {
  CustomLayoutDefinition,
  LayoutDefinition,
  LoaderOptions,
  LayoutLoadError,
  RawLayoutYaml,
  PropSchema,
} from '../types/layout.types';

/**
 * Default loader options
 */
const DEFAULT_OPTIONS: Required<LoaderOptions> = {
  templatesPath: path.join(__dirname, '../../../templates/agents'),
  validationMode: 'lenient',
  fallbackLayoutId: 'crewx/default',
};

/**
 * Layout loader service
 *
 * Loads and caches layout definitions from YAML files.
 * Provides fallback mechanism and prop override support.
 *
 * @example
 * ```typescript
 * const loader = new LayoutLoader({ templatesPath: './templates/agents' });
 * const layout = loader.load('crewx/dashboard', { theme: 'dark' });
 * ```
 */
export class LayoutLoader {
  private layouts: Map<string, LayoutDefinition> = new Map();
  private options: Required<LoaderOptions>;

  constructor(options?: Partial<LoaderOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadAllLayouts();
  }

  /**
   * Load a layout by ID with optional props override
   *
   * @param layoutId - Layout ID (e.g., "crewx/dashboard", "dashboard", "my_custom_layout")
   * @param propsOverride - Props to override default values
   * @returns Layout definition with merged props
   *
   * @example
   * ```typescript
   * // Load with defaults
   * const layout = loader.load('crewx/default');
   *
   * // Load with props override
   * const layout = loader.load('crewx/dashboard', { theme: 'dark', maxDocs: 20 });
   * ```
   */
  load(layoutId: string, propsOverride?: Record<string, any>): LayoutDefinition {
    // Try exact match first, then try normalized ID for backward compatibility
    let layout = this.layouts.get(layoutId);

    if (!layout) {
      const normalizedId = this.normalizeLayoutId(layoutId);
      layout = this.layouts.get(normalizedId);
    }

    if (!layout) {
      console.warn(`Layout not found: ${layoutId}, falling back to ${this.options.fallbackLayoutId}`);
      layout = this.layouts.get(this.options.fallbackLayoutId);

      if (!layout) {
        throw new LayoutLoadError(
          `Fallback layout not found: ${this.options.fallbackLayoutId}`,
          this.options.fallbackLayoutId
        );
      }
    }

    // Apply props override
    if (propsOverride && Object.keys(propsOverride).length > 0) {
      return {
        ...layout,
        defaultProps: { ...layout.defaultProps, ...propsOverride },
      };
    }

    return layout;
  }

  /**
   * Get all loaded layout IDs
   *
   * @returns Array of layout IDs
   */
  getLayoutIds(): string[] {
    return Array.from(this.layouts.keys());
  }

  /**
   * Check if a layout exists
   *
   * @param layoutId - Layout ID to check
   * @returns true if layout exists
   */
  hasLayout(layoutId: string): boolean {
    // Try exact match first, then try normalized ID for backward compatibility
    if (this.layouts.has(layoutId)) {
      return true;
    }
    const normalizedId = this.normalizeLayoutId(layoutId);
    return this.layouts.has(normalizedId);
  }

  /**
   * Reload all layouts from disk
   * Useful for development/testing
   */
  reload(): void {
    this.layouts.clear();
    this.loadAllLayouts();
  }

  /**
   * Load all layout files from templates/agents/ directory
   * @private
   */
  private loadAllLayouts(): void {
    const layoutsDir = this.options.templatesPath;

    if (!existsSync(layoutsDir)) {
      throw new LayoutLoadError(
        `Templates directory not found: ${layoutsDir}`,
        undefined,
        new Error(`Directory does not exist: ${layoutsDir}`)
      );
    }

    try {
      const files = readdirSync(layoutsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (files.length === 0) {
        console.warn(`No layout files found in ${layoutsDir}`);
      }

      for (const file of files) {
        const layoutName = file.replace(/\.(yaml|yml)$/, '');
        const layoutPath = path.join(layoutsDir, file);

        try {
          const layout = this.loadLayoutFile(layoutPath, layoutName);
          const layoutId = `crewx/${layoutName}`;
          this.layouts.set(layoutId, layout);
          if (layoutId !== 'crewx/minimal') {
            console.log(`Loaded layout: ${layoutId} from ${file}`);
          }
        } catch (error) {
          console.error(`Failed to load layout file ${file}:`, error);
          // Continue loading other layouts
        }
      }

      console.log(`Loaded ${this.layouts.size} layouts from ${layoutsDir}`);
    } catch (error) {
      throw new LayoutLoadError(
        `Failed to read layouts directory: ${layoutsDir}`,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Load and parse a single layout file
   * @private
   */
  private loadLayoutFile(filePath: string, layoutName: string): LayoutDefinition {
    try {
      const content = readFileSync(filePath, 'utf-8');

      // Handle empty files
      if (!content || content.trim().length === 0) {
        console.warn(`Empty YAML file: ${filePath}, will use fallback`);
        throw new LayoutLoadError(
          `Empty YAML file: ${filePath}`,
          layoutName,
          new Error('File content is empty')
        );
      }

      const parsed = loadYaml(content) as RawLayoutYaml;

      // Handle null/undefined parsed result (empty YAML documents)
      if (!parsed || typeof parsed !== 'object') {
        console.warn(`Invalid YAML content in ${filePath} (parsed as ${typeof parsed}), will use fallback`);
        throw new LayoutLoadError(
          `Invalid or empty YAML in ${filePath}`,
          layoutName,
          new Error('YAML parsing returned null/undefined or non-object')
        );
      }

      // Handle two formats:
      // 1. Direct layout definition (id, version, propsSchema, template)
      // 2. Layouts map format (layouts: { default: "template...", ... })

      if (parsed.layouts && typeof parsed.layouts === 'object') {
        // Format 2: layouts map (e.g., templates/agents/default.yaml)
        const layoutTemplate = this.resolveLayoutTemplate(parsed.layouts, layoutName);

        if (!layoutTemplate || (typeof layoutTemplate === 'string' && layoutTemplate.trim().length === 0)) {
          console.warn(`Empty or missing layout template in ${filePath} for ${layoutName}`);
          throw new LayoutLoadError(
            `Layout template not found or empty in layouts map: ${layoutName}`,
            layoutName
          );
        }

        return {
          id: `crewx/${layoutName}`,
          version: parsed.version || '1.0.0',
          description: parsed.description || `CrewX ${layoutName} layout`,
          template: layoutTemplate,
          propsSchema: this.parsePropsSchema(parsed.propsSchema || {}),
          defaultProps: this.extractDefaultProps(parsed.propsSchema || {}),
        };
      } else {
        // Format 1: direct layout definition
        if (!parsed.template || (typeof parsed.template === 'string' && parsed.template.trim().length === 0)) {
          console.warn(`Empty or missing template field in ${filePath}`);
          throw new LayoutLoadError(
            `Layout template is missing or empty in ${filePath}`,
            layoutName
          );
        }

        return {
          id: parsed.id || `crewx/${layoutName}`,
          version: parsed.version || '1.0.0',
          description: parsed.description || '',
          template: parsed.template,
          propsSchema: this.parsePropsSchema(parsed.propsSchema || {}),
          defaultProps: this.extractDefaultProps(parsed.propsSchema || {}),
        };
      }
    } catch (error) {
      throw new LayoutLoadError(
        `Failed to load layout file: ${filePath}`,
        layoutName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Parse and validate props schema
   * @private
   */
  private parsePropsSchema(raw: Record<string, any>): Record<string, PropSchema> {
    const schema: Record<string, PropSchema> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'object' && value !== null) {
        schema[key] = value as PropSchema;
      }
    }

    return schema;
  }

  /**
   * Extract default prop values from schema
   * @private
   */
  private extractDefaultProps(propsSchema: Record<string, any>): Record<string, any> {
    const defaults: Record<string, any> = {};

    for (const [key, schema] of Object.entries(propsSchema)) {
      if (schema && typeof schema === 'object' && 'defaultValue' in schema) {
        defaults[key] = schema.defaultValue;
      }
    }

    return defaults;
  }

  /**
   * Normalize layout ID to crewx/<name> format
   * @private
   */
  private normalizeLayoutId(layoutId: string): string {
    if (!layoutId) {
      return this.options.fallbackLayoutId;
    }

    // Already has namespace
    if (layoutId.includes('/')) {
      return layoutId;
    }

    // Add crewx namespace
    return `crewx/${layoutId}`;
  }

  /**
   * Register or override a layout at runtime (e.g., from project configuration)
   *
   * @param layoutId Layout identifier (used as-is, without forced namespace)
   * @param layoutConfig Template string or configuration object
   */
  registerLayout(layoutId: string, layoutConfig: string | CustomLayoutDefinition): void {
    if (!layoutId || typeof layoutId !== 'string') {
      throw new LayoutLoadError('Layout ID must be a non-empty string', layoutId);
    }

    // Use the layoutId as-is (no forced namespace)
    const config: CustomLayoutDefinition =
      typeof layoutConfig === 'string'
        ? { template: layoutConfig }
        : layoutConfig;

    const template = typeof config.template === 'string' ? config.template : '';

    if (!template || template.trim().length === 0) {
      throw new LayoutLoadError(`Custom layout template is empty for ${layoutId}`, layoutId);
    }

    const propsSchemaRaw = config.propsSchema || {};
    const defaultPropsFromSchema = this.extractDefaultProps(propsSchemaRaw);
    const explicitDefaults = config.defaultProps || {};

    const layoutDefinition: LayoutDefinition = {
      id: layoutId,
      version: config.version || '1.0.0',
      description: config.description || `Custom layout ${layoutId}`,
      template,
      propsSchema: this.parsePropsSchema(propsSchemaRaw),
      defaultProps: { ...defaultPropsFromSchema, ...explicitDefaults },
    };

    const existingLayout = this.layouts.get(layoutId);

    const templatesEqual =
      existingLayout?.template === template &&
      JSON.stringify(existingLayout?.defaultProps ?? {}) === JSON.stringify(layoutDefinition.defaultProps ?? {}) &&
      JSON.stringify(existingLayout?.propsSchema ?? {}) === JSON.stringify(layoutDefinition.propsSchema ?? {});

    this.layouts.set(layoutId, layoutDefinition);

    if (!existingLayout) {
      console.log(`Registered custom layout: ${layoutId}`);
    } else if (!templatesEqual) {
      console.log(`Updated custom layout: ${layoutId}`);
    }
  }

  /**
   * Register multiple layouts from a map of layoutId -> configuration
   */
  registerLayouts(layoutsMap: Record<string, string | CustomLayoutDefinition>): void {
    for (const [id, config] of Object.entries(layoutsMap)) {
      try {
        this.registerLayout(id, config);
      } catch (error) {
        console.warn(`Failed to register custom layout ${id}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  /**
   * Resolve layout template from layouts map using common key variants
   * @private
   */
  private resolveLayoutTemplate(layoutsMap: Record<string, any>, layoutName: string): string | undefined {
    const candidates = new Set<string>();

    if (layoutName) {
      candidates.add(layoutName);

      if (layoutName.includes('/')) {
        const parts = layoutName.split('/');
        const last = parts[parts.length - 1];
        if (last) {
          candidates.add(last);
        }
      } else {
        candidates.add(`crewx/${layoutName}`);
      }
    }

    candidates.add('default');

    for (const key of candidates) {
      const value = layoutsMap[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    // Fall back to the first non-empty string template
    for (const value of Object.values(layoutsMap)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }
}
