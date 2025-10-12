import { Injectable, Logger } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';
import { AIQueryOptions, AIResponse, ProviderNamespace } from './ai-provider.interface';

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
  createProvider(config: PluginProviderConfig): BaseAIProvider {
    this.logger.log(`Creating dynamic provider: ${config.id}`);

    // Security validation
    this.validateCliCommand(config.cli_command);
    this.validateCliArgs(config.query_args);
    this.validateCliArgs(config.execute_args);
    this.validateErrorPatterns(config.error_patterns);

    // Create dynamic provider class
    class DynamicAIProvider extends BaseAIProvider {
      readonly name = config.id;
      readonly namespacedName = `${ProviderNamespace.PLUGIN}/${config.id}`;

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
        return config.timeout?.execute ?? 1200000;
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

    // Prevent path separators or traversal attempts
    if (normalized.includes('/') || normalized.includes('\\')) {
      throw new Error(
        `Security: CLI command cannot contain path separators ('/' or '\\'). ` +
        `Use command names available in PATH or simple relative names without directories.`
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
        `Security: Path traversal (..) is not allowed. CLI command cannot contain path separators or traversal tokens. ` +
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
   * Validate plugin provider configuration
   */
  validateConfig(config: any): config is PluginProviderConfig {
    return (
      config.id &&
      typeof config.id === 'string' &&
      config.cli_command &&
      typeof config.cli_command === 'string' &&
      Array.isArray(config.query_args) &&
      Array.isArray(config.execute_args) &&
      typeof config.prompt_in_args === 'boolean'
    );
  }
}
