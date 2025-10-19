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
  
  /** Additional custom variables */
  vars?: Record<string, any>;
}