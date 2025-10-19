import { Injectable } from '@nestjs/common';
import { BaseDynamicProviderFactory } from '@sowonai/crewx-sdk';
import { createLoggerAdapter } from './logger.adapter';

/**
 * CLI-specific DynamicProviderFactory
 * Extends the SDK base implementation with additional security validations.
 */
@Injectable()
export class DynamicProviderFactory extends BaseDynamicProviderFactory {
  private readonly blockedCommands = [
    'bash', 'sh', 'zsh', 'fish', 'ksh', 'tcsh', 'csh',
    'cmd', 'powershell', 'pwsh', 'command',
    'python', 'python3', 'node', 'ruby', 'perl', 'php',
    'rm', 'del', 'rmdir', 'mv', 'cp', 'dd',
    'chmod', 'chown', 'sudo', 'su', 'doas',
    'curl', 'wget', 'nc', 'netcat', 'telnet', 'ssh',
    'eval', 'exec', 'source',
  ];

  constructor() {
    super({
      logger: createLoggerAdapter(DynamicProviderFactory.name),
    });
  }

  protected override validateCliCommand(cliCommand: string): void {
    super.validateCliCommand(cliCommand);

    const normalized = cliCommand.toLowerCase().trim();
    const commandName = normalized.split('/').pop() || normalized;
    if (this.blockedCommands.includes(commandName)) {
      throw new Error(
        `Security: CLI command '${cliCommand}' is blocked for security reasons. ` +
        `This command is considered dangerous and cannot be used as a plugin provider.`,
      );
    }

    if (normalized.startsWith('/') || normalized.startsWith('\\')) {
      throw new Error(
        'Security: Absolute paths are not allowed. ' +
        "Use relative paths from project root (e.g., 'test-tools/howling') or command names in PATH (e.g., 'aider').",
      );
    }

    if (normalized.includes('..')) {
      throw new Error(
        'Security: Path traversal (..) is not allowed. ' +
        'Use relative paths within the project directory only.',
      );
    }

    const shellMetaChars = /[;&|<>`$(){}[\]!]/;
    if (shellMetaChars.test(cliCommand)) {
      throw new Error(
        `Security: CLI command '${cliCommand}' contains shell metacharacters. ` +
        'Only alphanumeric characters, hyphens, underscores, dots, and forward slashes are allowed.',
      );
    }

    if (cliCommand.includes('\0')) {
      throw new Error('Security: CLI command contains null bytes (potential path injection).');
    }
  }

  protected override validateCliArgs(args: string[]): void {
    super.validateCliArgs(args);

    for (const arg of args) {
      const dangerousChars = /[;&|<>`$()!]/;
      if (dangerousChars.test(arg)) {
        throw new Error(
          `Security: CLI argument '${arg}' contains dangerous shell metacharacters. ` +
          'Arguments with ;, &, |, <, >, `, $, (), ! are not allowed.',
        );
      }

      if (arg.includes('$(') || arg.includes('`')) {
        throw new Error(
          `Security: CLI argument '${arg}' contains command substitution pattern. ` +
          '$() and backticks are not allowed.',
        );
      }

      if (arg.includes('\0')) {
        throw new Error('Security: CLI argument contains null bytes (potential injection).');
      }
    }
  }

  protected override validateErrorPatterns(
    patterns?: Array<{ pattern: string; type: string; message: string }>,
  ): void {
    if (!patterns) {
      return;
    }

    const redosPatterns = [
      /\(.*\+.*\)\+/,
      /\(.*\*.*\)\*/,
      /\(.*\+.*\)\*/,
      /\(.*\*.*\)\+/,
    ];

    for (const { pattern } of patterns) {
      for (const redosPattern of redosPatterns) {
        if (redosPattern.test(pattern)) {
          throw new Error(
            `Security: Error pattern '${pattern}' may cause ReDoS (catastrophic backtracking). ` +
            'Avoid nested quantifiers like (a+)+, (a*)*, etc.',
          );
        }
      }
    }

    super.validateErrorPatterns(patterns);
  }

  protected override validateEnv(env?: Record<string, string>): void {
    super.validateEnv(env);

    if (!env) {
      return;
    }

    const dangerousEnvVars = [
      'PATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH',
      'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES',
      'IFS', 'BASH_ENV', 'ENV',
    ];

    for (const [key, value] of Object.entries(env)) {
      if (dangerousEnvVars.includes(key.toUpperCase())) {
        throw new Error(
          `Security: Environment variable '${key}' is blocked for security reasons. ` +
          'Modifying system paths or library loading variables is not allowed.',
        );
      }

      if (key.includes('\0') || value.includes('\0')) {
        throw new Error('Security: Environment variable contains null bytes (potential injection).');
      }

      const dangerousChars = /[;&|<>`$()]/;
      if (dangerousChars.test(value)) {
        this.logger.warn(
          `Warning: Environment variable '${key}' contains shell metacharacters. Value: ${value}`,
        );
      }
    }
  }
}
