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
 * Render context for template rendering
 */
export interface RenderContext {
  agent: {
    id: string;
    name: string;
    inline: {
      prompt: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  documents: Record<string, { content: string; toc?: string; summary?: string }>;
  vars: TemplateVars;  // security_key, escaped user_input, etc.
  props: Record<string, any>; // Validated props
  platform?: string;
  messages?: Array<Record<string, any>>;
  tools?: {
    list?: Array<Record<string, any>>;
    json?: string;
    count?: number;
    [key: string]: any;
  } | null;
  session?: {
    mode?: string;
    platform?: string;
    options?: string[];
    env?: Record<string, any>;
    vars?: TemplateVars;
    tools?: any;
    [key: string]: any;
  };
  env?: Record<string, any>;
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
