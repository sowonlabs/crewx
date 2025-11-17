/**
 * Shared provider namespace/type definitions used by CrewX SDK consumers.
 */
export const ProviderNamespace = {
  CLI: 'cli',
  PLUGIN: 'plugin',
  API: 'api',
  REMOTE: 'remote',
} as const;

export type ProviderNamespaceType = typeof ProviderNamespace[keyof typeof ProviderNamespace];

export const BuiltInProviders = {
  CLAUDE: 'cli/claude',
  GEMINI: 'cli/gemini',
  COPILOT: 'cli/copilot',
  CODEX: 'cli/codex',
} as const;

export interface AIQueryOptions {
  timeout?: number;
  workingDirectory?: string;
  additionalArgs?: string[];
  taskId?: string;
  model?: string;
  securityKey?: string;
  agentId?: string;
  messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
  pipedContext?: string;
}

export interface AIResponse {
  content: string;
  provider: string;
  command: string;
  success: boolean;
  error?: string;
  taskId?: string;
  model?: string;
  toolCall?: {
    toolName: string;
    toolInput: any;
    toolResult: any;
  };
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  getToolPath(): Promise<string | null>;
}

export class ProviderNotAvailableError extends Error {
  constructor(providerName: string) {
    super(`AI Provider '${providerName}' is not available or not installed`);
    this.name = 'ProviderNotAvailableError';
  }
}
