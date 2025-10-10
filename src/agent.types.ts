export interface AgentConfig {
  id: string;
  working_directory: string;
  inline: {
    type: 'agent';
    provider: 'claude' | 'gemini' | 'copilot';
    system_prompt: string;
    model?: string; // Optional model specification (e.g., "sonnet", "gemini-2.5-pro")
    documents?: Record<string, string>; // Agent-specific documents
  };
  
  // Legacy single options array (for backward compatibility)
  // options?: string[];
  
  // New, simpler mode-specific options structure
  options?: {
    query?: string[];    // Read-only analysis mode
    execute?: string[];  // File modification/execution mode
  };
  
  tools?: string[]; // Available tools
  capabilities?: {
    autonomous_work?: boolean; // Whether autonomous work is possible
    file_operations?: boolean; // File manipulation permissions
    tool_access?: string[]; // List of accessible tools
  };
}

// Security Level Enum
export enum SecurityLevel {
  SAFE = 'safe',           // Fully safe options
  MODERATE = 'moderate',   // Options that require caution
  DANGEROUS = 'dangerous', // Dangerous options
  CRITICAL = 'critical'    // Critical options
}

// Execution Mode Enum
export enum ExecutionMode {
  QUERY = 'query',     // Read-only analysis
  EXECUTE = 'execute'  // File modification/execution
}

export interface AgentsConfig {
  documents?: Record<string, string>; // Project-level documents
  agents: AgentConfig[];
}

export interface AgentQueryOptions {
  workingDirectory?: string;
  context?: string; // Additional context
  timeout?: number;
  readOnlyMode?: boolean; // Read-only mode (no modification operations)
  executionMode?: ExecutionMode; // Specify execution mode
  securityLevel?: SecurityLevel; // Specify security level
  additionalArgs?: string[]; // Additional CLI arguments
  model?: string; // Model to use for this query (e.g., "sonnet", "gemini-2.5-pro", "gpt-5")
}

export interface AgentResponse {
  content: string;
  agent: string;
  provider: string;
  command: string;
  success: boolean;
  error?: string;
  actions?: AgentAction[]; // Executed actions
  readOnly?: boolean; // Whether executed in read-only mode
  taskId?: string; // Task ID for tracking
}

export interface AgentAction {
  type: 'file_read' | 'file_write' | 'tool_call' | 'analysis';
  target: string;
  result: string;
  timestamp: Date;
}

export interface AgentInfo {
  id: string;
  name?: string;
  role?: string;
  team?: string;
  provider: 'claude' | 'gemini' | 'copilot' | ('claude' | 'gemini' | 'copilot')[]; // Single provider or array for fallback
  workingDirectory: string;
  capabilities: string[];
  description: string;
  specialties?: string[];
  systemPrompt?: string;
  options?: string[] | {
    query?: string[] | { claude?: string[], gemini?: string[], copilot?: string[] };    // Read-only analysis mode options
    execute?: string[] | { claude?: string[], gemini?: string[], copilot?: string[] };  // File modification/execution mode options
  }; // Flexible CLI options - legacy array, mode-specific array, or provider-specific object
  inline?: {
    type: 'agent';
    provider: 'claude' | 'gemini' | 'copilot';
    system_prompt: string;
    model?: string; // Default model for this agent
  };
}