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
  /** Phase 3b: Trace ID for call chain tracking */
  traceId?: string;
  /** Phase 4: Callback invoked when the CLI process starts */
  onProcessStart?: (pid: number) => void;
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
  /** Phase 4: Process ID of the spawned CLI process */
  pid?: number;
  /** Exit code reported by the CLI process (null if unavailable). */
  exitCode?: number | null;
  /** Total duration from spawn to completion in milliseconds. */
  durationMs?: number;
  /** Time from spawn to first stdout/stderr output in milliseconds. */
  timeToFirstOutputMs?: number;
  /** Length of the prompt in characters. */
  promptLength?: number;
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
