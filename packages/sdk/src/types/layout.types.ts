/**
 * Layout system type definitions for CrewX
 * Based on WBS-11 specification (React PropTypes style)
 */

import type { TemplateVars } from './template.types';

/**
 * Prop schema definition (React PropTypes style)
 * Used to define and validate layout props
 */
export interface PropSchema {
  type:
    | 'string'
    | 'number'
    | 'bool'
    | 'array'
    | 'arrayOf'
    | 'object'
    | 'shape'
    | 'oneOfType'
    | 'func'
    | 'node';
  isRequired?: boolean;           // React: .isRequired
  defaultValue?: any;             // React: defaultProps
  oneOf?: any[];                  // React: PropTypes.oneOf([...])
  min?: number;                   // Number minimum value
  max?: number;                   // Number maximum value
  minLength?: number;             // String/array minimum length
  maxLength?: number;             // String/array maximum length
  itemType?: string;              // arrayOf item type
  itemOneOf?: any[];              // arrayOf item oneOf constraint
  shape?: Record<string, PropSchema>;  // React: PropTypes.shape({...})
  types?: string[];               // oneOfType allowed types
  pattern?: string;               // Regex pattern for string validation
  description?: string;           // Documentation
}

/**
 * Layout definition loaded from YAML
 */
export interface LayoutDefinition {
  id: string;
  version: string;
  description: string;
  template: string;                         // Handlebars template
  propsSchema: Record<string, PropSchema>;  // React PropTypes style schema
  defaultProps: Record<string, any>;        // Default prop values
}

/**
 * Custom layout configuration for runtime registration
 */
export interface CustomLayoutDefinition {
  template: string;
  description?: string;
  version?: string;
  propsSchema?: Record<string, any>;
  defaultProps?: Record<string, any>;
}

/**
 * Inline layout specification from agent config
 * Can be either:
 * - string: layout ID (e.g., "crewx/default")
 * - object: { id: string, props?: Record<string, any> }
 */
export type InlineLayoutSpec = string | {
  id: string;
  props?: Record<string, any>;
};

/**
 * Validation result from PropValidator
 */
export interface ValidationResult {
  valid: boolean;
  props: Record<string, any>;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

/**
 * Layout loader options
 */
export interface LoaderOptions {
  templatesPath: string;              // Path to templates/agents directory
  validationMode?: 'strict' | 'lenient';  // Default: 'lenient'
  fallbackLayoutId?: string;          // Default: 'crewx/default'
}

/**
 * Render context for layout-specific template rendering.
 *
 * **Used by:**
 * - `LayoutRenderer.render()` - Layout rendering with validation
 * - `crewx.tool.ts` - MCP tool server prompt assembly
 * - Layout-aware prompt orchestration
 *
 * **Characteristics:**
 * - Agent is required (layouts always need agent context)
 * - Rich agent structure (inline prompt, capabilities, specialties)
 * - Documents and props for layout rendering
 * - Strict typing for layout validation
 *
 * For general template processing, use `TemplateContext` instead.
 *
 * @see TemplateContext - General-purpose template rendering (agent optional)
 * @see BaseContext - Shared fields (defined in template.types.ts)
 */
export interface RenderContext {
  // Core data: shared with BaseContext (inline for layout.types.ts isolation)
  /** Current user input (HTML-escaped by renderer for security) */
  user_input?: string;
  /** Conversation message history */
  messages?: Array<{
    text: string;
    isAssistant: boolean;
    metadata?: Record<string, any>;
  }>;
  /** Execution mode (query or execute) */
  mode?: 'query' | 'execute';
  /** Platform identifier (cli, slack, mcp, etc.) */
  platform?: string;
  /** Environment variables */
  env?: Record<string, any>;
  /** Available tools metadata */
  tools?: {
    list?: Array<Record<string, any>>;
    json?: string;
    count?: number;
    [key: string]: any;
  } | null;
  /** Template variables (security_key, custom extensions) */
  vars: TemplateVars;

  // Layout-specific required fields
  /** Agent configuration and metadata (required for layout rendering) */
  agent: {
    id: string;
    name: string;
    provider?: string; // Optional for backward compatibility
    model?: string;
    workingDirectory?: string;
    inline: {
      prompt: string;
      [key: string]: any;
    };
    specialties?: string[];
    capabilities?: string[];
    description?: string;
    [key: string]: any;
  };

  /** Project documents (e.g., CREWX.md, manuals) */
  documents: Record<string, { content: string; toc?: string; summary?: string }>;

  /** Validated layout props */
  props: Record<string, any>;

  // Additional metadata fields
  /** Session-specific options (CLI flags, etc.) */
  session?: {
    options?: string[];
    [key: string]: any;
  };
  /** Additional context data */
  context?: Record<string, any>;
}

/**
 * Raw layout YAML structure
 */
export interface RawLayoutYaml {
  id?: string;
  version?: string;
  description?: string;
  propsSchema?: Record<string, any>;
  template?: string;
  layouts?: Record<string, string>;  // For templates/agents/default.yaml format
}

/**
 * Error thrown when layout loading fails
 */
export class LayoutLoadError extends Error {
  constructor(message: string, public readonly layoutId?: string, public readonly cause?: Error) {
    super(message);
    this.name = 'LayoutLoadError';
  }
}

/**
 * Error thrown when props validation fails (strict mode)
 */
export class PropsValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: ValidationError[] = [],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PropsValidationError';
  }
}
