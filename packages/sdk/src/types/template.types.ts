/**
 * Template Context Types for CrewX SDK
 *
 * These types define the structure for template processing context
 * across different platforms (CLI, Slack, MCP, etc.).
 */

import type { BaseMessage } from '../conversation/conversation-history.interface';

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
 * Template variables for custom extensions.
 *
 * Use `vars` for security tokens and custom layout variables.
 * Core data like `user_input` and `messages` should be at context top-level.
 */
export interface TemplateVars {
  /** Authentication token used to validate <user_query> and <system_prompt> containers */
  security_key?: string;
  /** Allow custom variables for layout extensions */
  [key: string]: unknown;
}

/**
 * Base context shared across all template rendering.
 *
 * Contains core fields that are common to both TemplateContext and RenderContext.
 * Use this for functions that accept either context type.
 */
export interface BaseContext {
  /** Current user input (HTML-escaped by renderer for security) */
  user_input?: string;

  /** Conversation message history */
  messages?: BaseMessage[];

  /** Execution mode (query or execute) */
  mode?: 'query' | 'execute';

  /** Platform identifier (cli, slack, mcp, etc.) */
  platform?: string;

  /** Environment variables */
  env?: Record<string, string | undefined>;

  /** Available tools metadata */
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

  /** Template variables (security_key, custom extensions) */
  vars?: TemplateVars;
}

/**
 * Template context for general-purpose YAML/Handlebars template rendering.
 *
 * **Used by:**
 * - `template-processor.ts` - Document template processing
 * - YAML config file rendering (agents.yaml, etc.)
 * - Handlebars-based template substitution
 *
 * **Characteristics:**
 * - Agent is optional (can render documents without agent context)
 * - Simpler agent structure (no inline/documents/props)
 * - General-purpose template processing
 *
 * For layout-specific rendering, use `RenderContext` instead.
 *
 * @see RenderContext - Layout rendering context (agent required, more structured)
 * @see BaseContext - Shared fields between TemplateContext and RenderContext
 */
export interface TemplateContext extends BaseContext {
  /** Agent metadata and configuration (optional for document-only rendering) */
  agent?: {
    id: string;
    name: string;
    provider?: string; // Optional for flexibility
    model?: string;
    workingDirectory?: string;
  };

  /** Extended agent metadata (capabilities, specialties, etc.) */
  agentMetadata?: AgentMetadata;
}
