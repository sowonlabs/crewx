export interface AIQueryOptions {
  timeout?: number;
  workingDirectory?: string;
  additionalArgs?: string[];
  taskId?: string;
  model?: string; // Model to use for this query (e.g., "sonnet", "gemini-2.5-pro", "gpt-5")
  securityKey?: string; // Security key for prompt injection protection
}

export interface AIResponse {
  content: string;
  provider: 'claude' | 'gemini' | 'copilot';
  command: string;
  success: boolean;
  error?: string;
  taskId?: string;
  toolCall?: {
    toolName: string;
    toolInput: any;
    toolResult: any;
  };
}

export interface AIProvider {
  readonly name: 'claude' | 'gemini' | 'copilot';
  
  /**
   * Check if this AI provider is available on the system
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Execute a query using this AI provider
   */
  query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  
  /**
   * Get the CLI tool path for this provider
   */
  getToolPath(): Promise<string | null>;
}

export class ProviderNotAvailableError extends Error {
  constructor(providerName: string) {
    super(`AI Provider '${providerName}' is not available or not installed`);
    this.name = 'ProviderNotAvailableError';
  }
}