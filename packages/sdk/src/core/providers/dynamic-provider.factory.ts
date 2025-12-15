import { BaseAIProvider } from './base-ai.provider';
import {
  ProviderNamespace,
  type AIQueryOptions,
  type AIResponse,
} from './ai-provider.interface';
import { getTimeoutConfig } from '../../config/timeout.config';
import type { LoggerLike } from './base-ai.types';
import { APIProviderConfig, API_PROVIDER_TYPES, APIProviderType } from '../../types/api-provider.types';

class ConsoleLogger implements LoggerLike {
  constructor(private readonly context: string) {}

  log(message: string, ...optionalParams: any[]): void {
    console.log(`[${this.context}]`, message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: any[]): void {
    console.warn(`[${this.context}]`, message, ...optionalParams);
  }

  error(message: string | Error, ...optionalParams: any[]): void {
    const resolved = message instanceof Error ? message.message : message;
    console.error(`[${this.context}]`, resolved, ...optionalParams);
  }
}

export interface PluginProviderConfig {
  id: string;
  type: 'plugin';
  cli_command: string;
  display_name?: string;
  description?: string;
  default_model?: string;
  query_args: string[];
  execute_args: string[];
  prompt_in_args: boolean;
  timeout?: {
    query: number;
    execute: number;
  };
  error_patterns?: Array<{
    pattern: string;
    type: string;
    message: string;
  }>;
  not_installed_message?: string;
  env?: Record<string, string>;
}

export interface RemoteProviderConfig {
  id: string;
  type: 'remote';
  location: string;
  external_agent_id: string;
  display_name?: string;
  description?: string;
  default_model?: string;
  auth?: {
    type: 'bearer' | 'api_key' | 'none';
    token?: string;
  };
  timeout?: {
    query: number;
    execute: number;
  };
  headers?: Record<string, string>;
}

/**
 * API provider configuration for dynamic provider factory.
 * Maps to api/* providers (e.g., api/openai, api/anthropic).
 */
export interface APIProviderFactoryConfig extends APIProviderConfig {
  type: 'api';
}

export type DynamicProviderConfig = PluginProviderConfig | RemoteProviderConfig | APIProviderFactoryConfig;

export interface DynamicProviderFactoryOptions {
  logger?: LoggerLike;
}

/**
 * Base dynamic provider factory
 * Contains reusable logic shared across different runtimes (CLI, server, etc.)
 * Runtime-specific factories should extend this class and override validation methods.
 */
export class BaseDynamicProviderFactory {
  protected readonly logger: LoggerLike;
  protected readonly timeoutConfig = getTimeoutConfig();

  constructor(options: DynamicProviderFactoryOptions = {}) {
    this.logger = options.logger ?? new ConsoleLogger('DynamicProviderFactory');
  }

  /**
   * Create a dynamic provider instance from configuration
   */
  createProvider(config: DynamicProviderConfig): BaseAIProvider {
    const providerId = config.type === 'api' ? config.provider : config.id;
    this.logger.log(`Creating dynamic provider: ${providerId}`);

    if (config.type === 'plugin') {
      return this.createPluginProvider(config);
    }

    if (config.type === 'remote') {
      return this.createRemoteProvider(config);
    }

    if (config.type === 'api') {
      return this.createAPIProvider(config);
    }

    throw new Error(`Unknown provider type: ${(config as any).type}`);
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config: unknown): config is DynamicProviderConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const base = config as any;

    if (base.type === 'plugin') {
      if (!base.id || typeof base.id !== 'string') {
        return false;
      }
      return (
        typeof base.cli_command === 'string' &&
        Array.isArray(base.query_args) &&
        Array.isArray(base.execute_args) &&
        typeof base.prompt_in_args === 'boolean'
      );
    }

    if (base.type === 'remote') {
      if (!base.id || typeof base.id !== 'string') {
        return false;
      }
      return (
        typeof base.location === 'string' &&
        typeof base.external_agent_id === 'string'
      );
    }

    if (base.type === 'api') {
      // API providers use 'provider' field as identifier (e.g., 'api/openai')
      return (
        typeof base.provider === 'string' &&
        (API_PROVIDER_TYPES as readonly string[]).includes(base.provider) &&
        typeof base.model === 'string'
      );
    }

    return false;
  }

  /**
   * Create a plugin provider instance
   */
  protected createPluginProvider(config: PluginProviderConfig): BaseAIProvider {
    this.validateCliCommand(config.cli_command);
    this.validateCliArgs(config.query_args);
    this.validateCliArgs(config.execute_args);
    this.validateErrorPatterns(config.error_patterns);
    this.validateEnv(config.env);

    const factory = this;

    class DynamicAIProvider extends BaseAIProvider {
      readonly name = `${ProviderNamespace.PLUGIN}/${config.id}`;

      constructor() {
        super(`DynamicProvider:${ProviderNamespace.PLUGIN}/${config.id}`);
      }

      protected getCliCommand(): string {
        return config.cli_command;
      }

      protected getDefaultArgs(): string[] {
        return config.query_args || [];
      }

      protected getExecuteArgs(): string[] {
        return config.execute_args || [];
      }

      protected getDefaultModel(): string {
        return config.default_model || 'default';
      }

      protected getPromptInArgs(): boolean {
        return config.prompt_in_args ?? false;
      }

      protected shouldPipeContext(): boolean {
        if (this.getPromptInArgs()) {
          return false;
        }
        return super.shouldPipeContext();
      }

      protected getNotInstalledMessage(): string {
        return (
          config.not_installed_message ||
          `${config.display_name || config.id} CLI is not installed.`
        );
      }

      protected getDefaultQueryTimeout(): number {
        return config.timeout?.query ?? 600000;
      }

      protected getDefaultExecuteTimeout(): number {
        return config.timeout?.execute ?? factory.timeoutConfig.parallel;
      }

      protected getEnv(): Record<string, string> {
        return config.env || {};
      }

      async isAvailable(): Promise<boolean> {
        const cliCommand = this.getCliCommand();

        if (cliCommand.includes('/') || cliCommand.includes('\\')) {
          try {
            const { access } = await import('fs/promises');
            const { constants } = await import('fs');
            const { resolve } = await import('path');
            const absolutePath = resolve(process.cwd(), cliCommand);
            await access(absolutePath, constants.X_OK);
            return true;
          } catch {
            return false;
          }
        }

        return super.isAvailable();
      }

      public parseProviderError(
        stderr: string,
        stdout: string,
      ): { error: boolean; message: string } {
        if (!config.error_patterns) {
          return super.parseProviderError(stderr, stdout);
        }

        const combinedOutput = stderr || stdout;

        for (const errorPattern of config.error_patterns) {
          if (combinedOutput.includes(errorPattern.pattern)) {
            return {
              error: true,
              message: errorPattern.message,
            };
          }
        }

        return super.parseProviderError(stderr, stdout);
      }
    }

    return new DynamicAIProvider();
  }

  /**
   * Create a remote provider instance
   */
  protected createRemoteProvider(config: RemoteProviderConfig): BaseAIProvider {
    this.logger.log(`Creating remote provider: ${config.id}`);
    this.validateRemoteConfig(config);

    const factory = this;

    class RemoteAIProvider extends BaseAIProvider {
      readonly name = `${ProviderNamespace.REMOTE}/${config.id}`;

      constructor() {
        super(`RemoteProvider:${ProviderNamespace.REMOTE}/${config.id}`);
      }

      protected getCliCommand(): string {
        if (config.location.startsWith('file://')) {
          return 'crewx';
        }
        return 'curl';
      }

      protected getDefaultArgs(): string[] {
        if (config.location.startsWith('file://')) {
          const configPath = config.location.replace('file://', '');
          return [
            'query',
            '--raw',
            `--config=${configPath}`,
          ];
        }

        const args = [
          '-X', 'POST',
          `${config.location}/mcp/query`,
          '-H', 'Content-Type: application/json',
        ];

        const authHeader = this.getAuthHeader();
        if (authHeader) {
          args.push('-H', `Authorization: ${authHeader}`);
        }

        return args;
      }

      protected getExecuteArgs(): string[] {
        if (config.location.startsWith('file://')) {
          const configPath = config.location.replace('file://', '');
          return [
            'execute',
            '--raw',
            `--config=${configPath}`,
          ];
        }

        const args = [
          '-X', 'POST',
          `${config.location}/mcp/execute`,
          '-H', 'Content-Type: application/json',
        ];

        const authHeader = this.getAuthHeader();
        if (authHeader) {
          args.push('-H', `Authorization: ${authHeader}`);
        }

        return args;
      }

      protected getDefaultModel(): string {
        return config.default_model || 'default';
      }

      protected getPromptInArgs(): boolean {
        return true;
      }

      protected getNotInstalledMessage(): string {
        if (config.location.startsWith('file://')) {
          const configPath = config.location.replace('file://', '');
          return `Remote CrewX configuration not found: ${configPath}`;
        }
        return `Remote CrewX server not accessible: ${config.location}`;
      }

      protected getDefaultQueryTimeout(): number {
        return config.timeout?.query ?? 300000;
      }

      protected getDefaultExecuteTimeout(): number {
        return config.timeout?.execute ?? 600000;
      }

      private getAuthHeader(): string {
        if (!config.auth || config.auth.type === 'none') {
          return '';
        }

        if (config.auth.type === 'bearer' && config.auth.token) {
          return `Bearer ${config.auth.token}`;
        }

        if (config.auth.type === 'api_key' && config.auth.token) {
          return `Api-Key ${config.auth.token}`;
        }

        return '';
      }

      private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};

        if (!config.auth || config.auth.type === 'none') {
          return headers;
        }

        if (config.auth.token) {
          if (config.auth.type === 'bearer') {
            headers['Authorization'] = `Bearer ${config.auth.token}`;
          } else if (config.auth.type === 'api_key') {
            headers['Api-Key'] = config.auth.token;
          }
        }

        return headers;
      }

      async isAvailable(): Promise<boolean> {
        if (config.location.startsWith('file://')) {
          try {
            const { access } = await import('fs/promises');
            const { constants } = await import('fs');
            const configPath = config.location.replace('file://', '');
            await access(configPath, constants.R_OK);
            const cliAvailable = await super.isAvailable();
            return cliAvailable;
          } catch {
            return false;
          }
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const healthHeaders = {
            ...(config.headers || {}),
            ...this.getAuthHeaders(),
          };

          const response = await fetch(`${config.location}/health`, {
            method: 'GET',
            signal: controller.signal,
            headers: healthHeaders,
          });

          clearTimeout(timeoutId);
          return response.ok;
        } catch {
          return false;
        }
      }

      async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
        if (config.location.startsWith('http')) {
          return this.httpQuery(prompt, options);
        }

        const validated = await this.ensureFileConfigExists(options);
        if (!validated.ok) {
          return validated.response;
        }

        const userQuery = this.parseUserQueryForRemote(prompt);
        const formattedPrompt = userQuery
          ? `@${config.external_agent_id} ${userQuery}`
          : `@${config.external_agent_id}`;

        const structuredPayload = this.normalizeStructuredPayload(prompt, options);
        const extendedOptions: AIQueryOptions = {
          ...options,
        };

        if (structuredPayload) {
          extendedOptions.pipedContext = structuredPayload;
        } else {
          delete extendedOptions.pipedContext;
        }

        return super.query(formattedPrompt, extendedOptions);
      }

      async execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
        if (config.location.startsWith('http')) {
          return super.execute(prompt, options);
        }

        const validated = await this.ensureFileConfigExists(options);
        if (!validated.ok) {
          return validated.response;
        }

        const userQuery = this.parseUserQueryForRemote(prompt);
        const formattedPrompt = userQuery
          ? `@${config.external_agent_id} ${userQuery}`
          : `@${config.external_agent_id}`;

        const structuredPayload = this.normalizeStructuredPayload(prompt, options);
        const extendedOptions: AIQueryOptions = {
          ...options,
        };

        if (structuredPayload) {
          extendedOptions.pipedContext = structuredPayload;
        } else {
          delete extendedOptions.pipedContext;
        }

        return super.execute(formattedPrompt, extendedOptions);
      }

      private async httpQuery(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
        const requestBody: Record<string, any> = {
          prompt,
          agent_id: config.external_agent_id,
          task_id: options?.taskId,
          model: options?.model || this.getDefaultModel(),
          working_directory: options?.workingDirectory,
        };

        const structuredPayload = this.normalizeStructuredPayload(prompt, options);
        if (structuredPayload) {
          requestBody.structured_payload = structuredPayload;
        }

        if (options?.messages && options.messages.length > 0) {
          requestBody.messages = options.messages;
        }

        if (options?.pipedContext) {
          const trimmed = options.pipedContext.trim();
          if (!this.isStructuredPayload(trimmed)) {
            requestBody.context = trimmed;
          }
        }

        try {
          const controller = new AbortController();
          const timeoutMs = options?.timeout || this.getDefaultQueryTimeout();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(`${config.location}/mcp/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.getAuthHeaders(),
              ...(config.headers || {}),
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();

          return {
            content: result.content,
            provider: this.name,
            command: `remote query to ${config.location}`,
            success: result.success !== false,
            error: result.error,
            taskId: result.task_id,
            toolCall: result.tool_call,
          };
        } catch (error: any) {
          return {
            content: '',
            provider: this.name,
            command: `remote query to ${config.location}`,
            success: false,
            error: error.message,
            taskId: options?.taskId,
          };
        }
      }

      /**
       * Parse user query from layout-rendered prompt for remote providers.
       *
       * Extracts content from <user_query> tags if present, otherwise returns full prompt.
       * Used for backward compatibility with remote agents that expect raw user input.
       */
      private parseUserQueryForRemote(prompt: string): string {
        if (!prompt) {
          return '';
        }

        const match = prompt.match(/<user_query key="[^"]+">\s*([\s\S]*?)\s*<\/user_query>/i);
        if (match && match[1]) {
          return match[1].trim();
        }

        return prompt.trim();
      }

      private normalizeStructuredPayload(prompt: string, options?: AIQueryOptions): string | null {
        const existing = options?.pipedContext?.trim();
        if (existing) {
          if (this.isStructuredPayload(existing)) {
            return existing;
          }
          return this.createStructuredPayload(prompt, existing, options);
        }

        if (options?.messages && options.messages.length > 0) {
          return this.createStructuredPayload(prompt, null, options);
        }

        return null;
      }

      private async ensureFileConfigExists(
        options?: AIQueryOptions,
      ): Promise<
        | { ok: true }
        | {
            ok: false;
            response: AIResponse;
          }
      > {
        if (!config.location.startsWith('file://')) {
          return { ok: true };
        }

        const configPath = config.location.replace('file://', '');
        try {
          const { access } = await import('fs/promises');
          const { constants } = await import('fs');
          await access(configPath, constants.R_OK);
          return { ok: true };
        } catch {
          return {
            ok: false,
            response: {
              content: `Remote CrewX configuration not found: ${configPath}`,
              provider: this.name,
              command: `crewx --config=${configPath}`,
              success: false,
              error: `Remote CrewX configuration not found: ${configPath}`,
              taskId: options?.taskId,
            },
          };
        }
      }
    }

    return new RemoteAIProvider();
  }

  /**
   * Create an API provider instance (api/openai, api/anthropic, etc.)
   *
   * Note: This is a placeholder implementation that creates a BaseAIProvider wrapper.
   * The actual LLM API calls should be implemented by a runtime-specific provider
   * that uses libraries like Vercel AI SDK, LangChain, or direct HTTP calls.
   *
   * This factory method provides the structure for:
   * - Provider validation
   * - Configuration parsing
   * - BaseAIProvider-compatible interface
   *
   * The actual implementation should be extended in subclasses or through
   * dependency injection with a proper API provider implementation.
   */
  protected createAPIProvider(config: APIProviderFactoryConfig): BaseAIProvider {
    this.logger.log(`Creating API provider: ${config.provider}`);
    this.validateAPIProviderConfig(config);

    const factory = this;

    class DynamicAPIProvider extends BaseAIProvider {
      readonly name = config.provider;

      constructor() {
        super(`APIProvider:${config.provider}`);
      }

      protected getCliCommand(): string {
        // API providers don't use CLI commands - they make HTTP API calls
        // This is a placeholder; actual implementation should override query/execute
        return 'echo';
      }

      protected getDefaultArgs(): string[] {
        return [];
      }

      protected getExecuteArgs(): string[] {
        return [];
      }

      protected getDefaultModel(): string {
        return config.model;
      }

      protected getPromptInArgs(): boolean {
        return false;
      }

      protected getNotInstalledMessage(): string {
        return `API provider ${config.provider} requires API key configuration`;
      }

      protected getDefaultQueryTimeout(): number {
        return 60000; // 60 seconds default for API calls
      }

      protected getDefaultExecuteTimeout(): number {
        return factory.timeoutConfig.parallel;
      }

      async isAvailable(): Promise<boolean> {
        // API providers are available if we have the required configuration
        return !!config.model;
      }

      /**
       * Placeholder query implementation.
       * Override this in a subclass to implement actual API calls.
       */
      async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
        factory.logger.warn(
          `API provider ${config.provider} query() called but not implemented. ` +
          'Extend this factory to provide actual API implementation.',
        );

        return {
          content: `[API Provider ${config.provider}] Implementation required. Model: ${config.model}`,
          provider: this.name,
          command: `API call to ${config.provider}`,
          success: false,
          error: 'API provider not implemented - extend BaseDynamicProviderFactory',
          taskId: options?.taskId,
        };
      }

      /**
       * Placeholder execute implementation.
       * Override this in a subclass to implement actual API calls.
       */
      async execute(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
        factory.logger.warn(
          `API provider ${config.provider} execute() called but not implemented. ` +
          'Extend this factory to provide actual API implementation.',
        );

        return {
          content: `[API Provider ${config.provider}] Implementation required. Model: ${config.model}`,
          provider: this.name,
          command: `API call to ${config.provider}`,
          success: false,
          error: 'API provider not implemented - extend BaseDynamicProviderFactory',
          taskId: options?.taskId,
        };
      }

      /**
       * Get the API provider configuration for use in subclass implementations
       */
      getAPIConfig(): APIProviderFactoryConfig {
        return config;
      }
    }

    return new DynamicAPIProvider();
  }

  /**
   * Validate API provider configuration
   */
  protected validateAPIProviderConfig(config: APIProviderFactoryConfig): void {
    if (!config.provider || typeof config.provider !== 'string') {
      throw new Error('API provider requires a provider field (e.g., api/openai)');
    }

    if (!(API_PROVIDER_TYPES as readonly string[]).includes(config.provider)) {
      throw new Error(
        `Invalid API provider '${config.provider}'. Valid providers: ${API_PROVIDER_TYPES.join(', ')}`,
      );
    }

    if (!config.model || typeof config.model !== 'string') {
      throw new Error('API provider requires a model field');
    }

    // Validate temperature if provided
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        throw new Error(`Temperature must be a number between 0 and 2, got: ${config.temperature}`);
      }
    }

    // Validate maxTokens if provided
    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens < 1 || !Number.isInteger(config.maxTokens)) {
        throw new Error(`maxTokens must be a positive integer, got: ${config.maxTokens}`);
      }
    }
  }

  /**
   * Validate CLI command format
   * Subclasses can extend this to enforce additional restrictions.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected validateCliCommand(cliCommand: string): void {
    if (!cliCommand || typeof cliCommand !== 'string') {
      throw new Error('Plugin provider requires a CLI command');
    }
  }

  /**
   * Validate CLI arguments (basic checks)
   * Subclasses can extend this to enforce additional restrictions.
   */
  protected validateCliArgs(args: string[]): void {
    if (!Array.isArray(args)) {
      throw new Error('CLI arguments must be an array');
    }

    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new Error('CLI argument must be a string');
      }
    }
  }

  /**
   * Validate regex patterns to ensure they compile.
   * Subclasses may add additional safeguards.
   */
  protected validateErrorPatterns(
    patterns?: Array<{ pattern: string; type: string; message: string }>
  ): void {
    if (!patterns) {
      return;
    }

    for (const { pattern } of patterns) {
      try {
        new RegExp(pattern);
      } catch (error: any) {
        throw new Error(`Invalid regex pattern '${pattern}': ${error.message}`);
      }
    }
  }

  /**
   * Validate environment variables (basic type checks).
   * Subclasses can add stricter policies.
   */
  protected validateEnv(env?: Record<string, string>): void {
    if (!env) {
      return;
    }

    for (const [key, value] of Object.entries(env)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('Environment variables must be string key/value pairs');
      }
    }
  }

  /**
   * Validate remote provider configuration (shared logic)
   */
  protected validateRemoteConfig(config: RemoteProviderConfig): void {
    if (!config.location) {
      throw new Error('Remote provider requires a location (file:// or http(s):// URL)');
    }

    if (!config.external_agent_id) {
      throw new Error('Remote provider requires an external_agent_id');
    }

    if (
      !config.location.startsWith('file://') &&
      !config.location.startsWith('http://') &&
      !config.location.startsWith('https://')
    ) {
      throw new Error('Remote location must start with file://, http://, or https://');
    }

    if (config.location.startsWith('file://')) {
      const filePath = config.location.replace('file://', '');
      if (filePath.includes('..')) {
        throw new Error('Path traversal (..) is not allowed in remote file locations');
      }
    }

    if (config.auth) {
      const validAuthTypes = ['bearer', 'api_key', 'none'];
      if (!validAuthTypes.includes(config.auth.type)) {
        throw new Error(`Invalid auth type: ${config.auth.type}. Must be one of: ${validAuthTypes.join(', ')}`);
      }

      if (config.auth.type !== 'none' && !config.auth.token) {
        throw new Error(`Auth type '${config.auth.type}' requires a token`);
      }
    }
  }
}
