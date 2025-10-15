import { Injectable, Logger } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';
import { AIQueryOptions, AIResponse, ProviderNamespace } from './ai-provider.interface';
import { getTimeoutConfig } from '../config/timeout.config';

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
  location: string; // file:// path or http:// URL
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
 * Dynamic Provider Factory
 * Creates AI provider instances from YAML configuration at runtime
 *
 * Security Features:
 * - CLI command validation (blacklist dangerous commands)
 * - Shell metacharacter filtering
 * - Argument sanitization
 * - Regex DoS prevention
 */
@Injectable()
export class DynamicProviderFactory {
  private logger = new Logger(DynamicProviderFactory.name);
  private readonly timeoutConfig = getTimeoutConfig();

  // Blacklist of dangerous CLI commands
  private readonly BLOCKED_CLI_COMMANDS = [
    'bash', 'sh', 'zsh', 'fish', 'ksh', 'tcsh', 'csh',  // Unix shells
    'cmd', 'powershell', 'pwsh', 'command',  // Windows shells
    'python', 'python3', 'node', 'ruby', 'perl', 'php',  // Interpreters
    'rm', 'del', 'rmdir', 'mv', 'cp', 'dd',  // File operations
    'chmod', 'chown', 'sudo', 'su', 'doas',  // Permission changes
    'curl', 'wget', 'nc', 'netcat', 'telnet', 'ssh',  // Network tools
    'eval', 'exec', 'source',  // Code execution
  ];

  /**
   * Create a dynamic provider instance from YAML configuration
   */
  createProvider(config: PluginProviderConfig | RemoteProviderConfig): BaseAIProvider {
    this.logger.log(`Creating dynamic provider: ${config.id}`);

    if (config.type === 'plugin') {
      return this.createPluginProvider(config as PluginProviderConfig);
    } else if (config.type === 'remote') {
      return this.createRemoteProvider(config as RemoteProviderConfig);
    } else {
      throw new Error(`Unknown provider type: ${(config as any).type}`);
    }
  }

  /**
   * Create a plugin provider instance
   */
  private createPluginProvider(config: PluginProviderConfig): BaseAIProvider {

    this.validateCliCommand(config.cli_command);
    this.validateCliArgs(config.query_args);
    this.validateCliArgs(config.execute_args);
    this.validateErrorPatterns(config.error_patterns);
    this.validateEnv(config.env);

    // Create dynamic provider class
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
        return config.timeout?.execute ?? this.timeoutConfig.parallel;
      }

      protected getEnv(): Record<string, string> {
        return config.env || {};
      }

      // Override isAvailable for relative path support
      async isAvailable(): Promise<boolean> {
        const cliCommand = this.getCliCommand();

        // If it's a relative path, check file existence
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

        // Otherwise use default PATH-based check
        return super.isAvailable();
      }

      // Custom error pattern matching
      public parseProviderError(
        stderr: string,
        stdout: string,
      ): { error: boolean; message: string } {
        if (!config.error_patterns) {
          return super.parseProviderError(stderr, stdout);
        }

        const combinedOutput = stderr || stdout;

        // Check configured error patterns
        for (const errorPattern of config.error_patterns) {
          if (combinedOutput.includes(errorPattern.pattern)) {
            return {
              error: true,
              message: errorPattern.message,
            };
          }
        }

        // Fallback to base error parsing
        return super.parseProviderError(stderr, stdout);
      }
    }

    return new DynamicAIProvider();
  }

  /**
   * Create a remote provider instance
   */
  private createRemoteProvider(config: RemoteProviderConfig): BaseAIProvider {
    this.logger.log(`Creating remote provider: ${config.id}`);

    // Validate remote configuration
    this.validateRemoteConfig(config);

    // Create remote provider class
    class RemoteAIProvider extends BaseAIProvider {
      readonly name = `${ProviderNamespace.REMOTE}/${config.id}`;

      constructor() {
        super(`RemoteProvider:${ProviderNamespace.REMOTE}/${config.id}`);
      }

      protected getCliCommand(): string {
        // For file:// protocol, use local crewx instance
        if (config.location.startsWith('file://')) {
          return 'crewx';
        }
        // For http:// protocol, use curl or http client
        return 'curl';
      }

      protected getDefaultArgs(): string[] {
        if (config.location.startsWith('file://')) {
          const configPath = config.location.replace('file://', '');
          return [
            'query',
            '--raw',
            `--config=${configPath}`
          ];
        }
        // HTTP implementation
        const args = [
          '-X', 'POST',
          config.location + '/mcp/query',
          '-H', 'Content-Type: application/json'
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
            `--config=${configPath}`
          ];
        }
        // HTTP implementation
        const args = [
          '-X', 'POST',
          config.location + '/mcp/execute',
          '-H', 'Content-Type: application/json'
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
        // For file-based remotes we pass the query as CLI argument.
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
        
        // HTTP health check
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const healthHeaders = {
            ...(config.headers || {}),
            ...this.getAuthHeaders(),
          };

          const response = await fetch(config.location + '/health', {
            method: 'GET',
            signal: controller.signal,
            headers: healthHeaders
          });
          
          clearTimeout(timeoutId);
          return response.ok;
        } catch {
          return false;
        }
      }

      // Override query method for HTTP POST requests
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
        const url = options?.taskId 
          ? `${config.location}/mcp/query`
          : `${config.location}/mcp/query`;

        const structuredPayload = this.normalizeStructuredPayload(prompt, options);
        const requestBody: Record<string, any> = {
          prompt,
          agent_id: config.external_agent_id,
          task_id: options?.taskId,
          model: options?.model || this.getDefaultModel(),
          working_directory: options?.workingDirectory,
        };
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

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.getAuthHeaders(),
              ...(config.headers || {})
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
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
            toolCall: result.tool_call
          };
        } catch (error: any) {
          return {
            content: '',
            provider: this.name,
            command: `remote query to ${config.location}`,
            success: false,
            error: error.message,
            taskId: options?.taskId
          };
        }
      }

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
    }

    return new RemoteAIProvider();
  }

  /**
   * Validate CLI command name for security
   */
  private validateCliCommand(cliCommand: string): void {
    const normalized = cliCommand.toLowerCase().trim();

    // Check blacklist (only for simple command names, not paths)
    const commandName = normalized.split('/').pop() || normalized;
    if (this.BLOCKED_CLI_COMMANDS.includes(commandName)) {
      throw new Error(
        `Security: CLI command '${cliCommand}' is blocked for security reasons. ` +
        `This command is considered dangerous and cannot be used as a plugin provider.`
      );
    }

    // Prevent absolute paths and path traversal
    if (normalized.startsWith('/') || normalized.startsWith('\\')) {
      throw new Error(
        `Security: Absolute paths are not allowed. ` +
        `Use relative paths from project root (e.g., 'test-tools/howling') or command names in PATH (e.g., 'aider').`
      );
    }

    if (normalized.includes('..')) {
      throw new Error(
        `Security: Path traversal (..) is not allowed. ` +
        `Use relative paths within the project directory only.`
      );
    }

    // Check for shell metacharacters
    const shellMetaChars = /[;&|<>`$(){}[\]!]/;
    if (shellMetaChars.test(cliCommand)) {
      throw new Error(
        `Security: CLI command '${cliCommand}' contains shell metacharacters. ` +
        `Only alphanumeric characters, hyphens, underscores, dots, and forward slashes are allowed.`
      );
    }

    // Check for null bytes (path injection)
    if (cliCommand.includes('\0')) {
      throw new Error(
        `Security: CLI command contains null bytes (potential path injection).`
      );
    }
  }

  /**
   * Validate CLI arguments for security
   */
  private validateCliArgs(args: string[]): void {
    for (const arg of args) {
      // Check for dangerous shell metacharacters
      const dangerousChars = /[;&|<>`$()!]/;
      if (dangerousChars.test(arg)) {
        throw new Error(
          `Security: CLI argument '${arg}' contains dangerous shell metacharacters. ` +
          `Arguments with ;, &, |, <, >, \`, $, (), ! are not allowed.`
        );
      }

      // Check for command substitution patterns
      if (arg.includes('$(') || arg.includes('`')) {
        throw new Error(
          `Security: CLI argument '${arg}' contains command substitution pattern. ` +
          `$() and backticks are not allowed.`
        );
      }

      // Check for null bytes
      if (arg.includes('\0')) {
        throw new Error(
          `Security: CLI argument contains null bytes (potential injection).`
        );
      }
    }
  }

  /**
   * Validate error patterns to prevent ReDoS attacks
   */
  private validateErrorPatterns(
    patterns?: Array<{ pattern: string; type: string; message: string }>
  ): void {
    if (!patterns) return;

    for (const { pattern } of patterns) {
      // Check for known ReDoS patterns
      const redosPatterns = [
        /\(.*\+.*\)\+/,  // (a+)+
        /\(.*\*.*\)\*/,  // (a*)*
        /\(.*\+.*\)\*/,  // (a+)*
        /\(.*\*.*\)\+/,  // (a*)+
      ];

      for (const redosPattern of redosPatterns) {
        if (redosPattern.test(pattern)) {
          throw new Error(
            `Security: Error pattern '${pattern}' may cause ReDoS (catastrophic backtracking). ` +
            `Avoid nested quantifiers like (a+)+, (a*)*, etc.`
          );
        }
      }

      // Try to compile regex to ensure it's valid
      try {
        new RegExp(pattern);
      } catch (error: any) {
        throw new Error(
          `Invalid regex pattern '${pattern}': ${error.message}`
        );
      }
    }
  }

  /**
   * Validate environment variables for security
   */
  private validateEnv(env?: Record<string, string>): void {
    if (!env) return;

    for (const [key, value] of Object.entries(env)) {
      // Check for dangerous environment variable names
      const dangerousEnvVars = [
        'PATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH',
        'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES',
        'IFS', 'BASH_ENV', 'ENV',
      ];

      if (dangerousEnvVars.includes(key.toUpperCase())) {
        throw new Error(
          `Security: Environment variable '${key}' is blocked for security reasons. ` +
          `Modifying system paths or library loading variables is not allowed.`
        );
      }

      // Check for null bytes in key or value
      if (key.includes('\0') || value.includes('\0')) {
        throw new Error(
          `Security: Environment variable contains null bytes (potential injection).`
        );
      }

      // Check for shell metacharacters in values (warn but don't block)
      const dangerousChars = /[;&|<>`$()]/;
      if (dangerousChars.test(value)) {
        this.logger.warn(
          `Warning: Environment variable '${key}' contains shell metacharacters. ` +
          `Value: ${value}`
        );
      }
    }
  }

  /**
   * Validate remote provider configuration
   */
  private validateRemoteConfig(config: RemoteProviderConfig): void {
    if (!config.location) {
      throw new Error('Remote provider requires a location (file:// or http:// URL)');
    }

    if (!config.external_agent_id) {
      throw new Error('Remote provider requires an external_agent_id');
    }

    // Validate location format
    if (!config.location.startsWith('file://') && !config.location.startsWith('http://') && !config.location.startsWith('https://')) {
      throw new Error('Remote location must start with file://, http://, or https://');
    }

    // Validate file:// path
    if (config.location.startsWith('file://')) {
      const filePath = config.location.replace('file://', '');
      if (filePath.includes('..')) {
        throw new Error('Path traversal (..) is not allowed in remote file locations');
      }
    }

    // Validate auth configuration
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

  /**
   * Validate plugin provider configuration
   */
  validateConfig(config: any): config is PluginProviderConfig | RemoteProviderConfig {
    if (!config.id || typeof config.id !== 'string') {
      return false;
    }

    if (config.type === 'plugin') {
      return (
        config.cli_command &&
        typeof config.cli_command === 'string' &&
        Array.isArray(config.query_args) &&
        Array.isArray(config.execute_args) &&
        typeof config.prompt_in_args === 'boolean'
      );
    }

    if (config.type === 'remote') {
      return (
        config.location &&
        typeof config.location === 'string' &&
        config.external_agent_id &&
        typeof config.external_agent_id === 'string'
      );
    }

    return false;
  }
}
