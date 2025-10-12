/**
 * Provider Namespace Constants
 *
 * Provider names follow the format: {namespace}/{id}
 * - cli/*: CLI-based providers (claude, gemini, copilot)
 * - plugin/*: User-defined external CLI tools
 * - api/*: API-based providers (future: openai, anthropic, ollama)
 */
export const ProviderNamespace = {
  CLI: 'cli',
  PLUGIN: 'plugin',
  API: 'api',
} as const;

export type ProviderNamespaceType = typeof ProviderNamespace[keyof typeof ProviderNamespace];

/**
 * Built-in CLI provider IDs
 */
export const BuiltInProviders = {
  CLAUDE: 'cli/claude',
  GEMINI: 'cli/gemini',
  COPILOT: 'cli/copilot',
} as const;

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
  provider: string; // Format: {namespace}/{id} (e.g., "cli/claude", "plugin/mock")
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
  readonly name: string;
  readonly namespacedName?: string;

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