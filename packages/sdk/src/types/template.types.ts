/**
 * Template Context Types for CrewX SDK
 * 
 * These types define the structure for template processing context
 * across different platforms (CLI, Slack, MCP, etc.).
 */

/**
 * Agent metadata for template context
 */
export interface AgentMetadata {
  /** Agent specialties */
  specialties?: string[];
  /** Agent capabilities */
  capabilities?: string[];
  /** Agent description */
  description?: string;
}

/**
 * Template variables shared across layouts.
 *
 * These keys are intentionally typed so security critical values
 * (like `security_key` and `user_input`) stay consistent across
 * CLI/SDK integrations while still allowing custom extensions.
 */
export interface TemplateVars {
  /** Authentication token used to validate <user_query> containers */
  security_key?: string;
  /**
   * Current user input rendered into layouts.
   * Always HTML-escaped by the renderer to guard against injection.
   */
  user_input?: string;
  /** Original (unsanitised) user input – provided for audit/logging only. */
  user_input_raw?: string;
  /** Allow custom variables without losing backwards compatibility. */
  [key: string]: unknown;
}

/**
 * Template context for document processing
 * Cross-platform compatible (CLI, Slack, MCP, etc.)
 */
export interface TemplateContext {
  /** Environment variables */
  env?: Record<string, string | undefined>;
  
  /** Agent metadata and configuration */
  agent?: {
    id: string;
    name: string;
    provider: string;
    model?: string;
    workingDirectory?: string;
  };
  
  /** Extended agent metadata (capabilities, specialties, etc.) */
  agentMetadata?: AgentMetadata;
  
  /** Query/execution mode */
  mode?: 'query' | 'execute';
  
  /** Conversation messages for history */
  messages?: Array<{
    text: string;
    isAssistant: boolean;
    metadata?: Record<string, any>; // Platform-specific metadata (e.g., Slack user info)
  }>;
  
  /** Platform identifier (string for extensibility) */
  platform?: string;
  
  /** Available tools */
  tools?: {
    list: Array<{
      name: string;
      description: string;
      input_schema: any;
      output_schema?: any;
    }>;
    json: string;
    count: number;
  };
  
  /**
   * Additional variables passed to layouts.
   * Includes security helpers and escaped user input for safe rendering.
   */
  vars?: TemplateVars;
}
