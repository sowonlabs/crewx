import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DynamicProviderFactory, PluginProviderConfig } from '../src/providers/dynamic-provider.factory';

describe('DynamicProviderFactory', () => {
  let factory: DynamicProviderFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicProviderFactory],
    }).compile();

    factory = module.get<DynamicProviderFactory>(DynamicProviderFactory);
  });

  describe('Security Validation', () => {
    describe('CLI Command Validation', () => {
      it('should reject dangerous shell commands', () => {
        const dangerousCommands = [
          'bash', 'sh', 'zsh', 'fish',
          'cmd', 'powershell', 'pwsh',
          'python', 'node', 'ruby', 'perl',
          'rm', 'del', 'chmod', 'sudo',
          'curl', 'wget', 'nc',
        ];

        for (const command of dangerousCommands) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: command,
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
          };

          expect(() => factory.createProvider(config)).toThrow(/Security: CLI command/);
        }
      });

      it('should reject CLI commands with path separators', () => {
        const pathConfigs = [
          '../aider',
          './aider',
          '/usr/bin/aider',
          'C:\\Program Files\\aider',
        ];

        for (const cmd of pathConfigs) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: cmd,
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
          };

          expect(() => factory.createProvider(config)).toThrow(/cannot contain path separators/);
        }
      });

      it('should reject CLI commands with shell metacharacters', () => {
        const metacharConfigs = [
          'aider;ls',
          'aider && ls',
          'aider | grep',
          'aider`whoami`',
          'aider$(whoami)',
        ];

        for (const cmd of metacharConfigs) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: cmd,
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
          };

          expect(() => factory.createProvider(config)).toThrow(/shell metacharacters/);
        }
      });

      it('should reject CLI commands with null bytes', () => {
        const config: PluginProviderConfig = {
          id: 'test',
          type: 'plugin',
          cli_command: 'aider\0malicious',
          query_args: ['--help'],
          execute_args: ['--help'],
          prompt_in_args: false,
        };

        expect(() => factory.createProvider(config)).toThrow(/null bytes/);
      });

      it('should accept valid CLI command names', () => {
        const validCommands = ['aider', 'cursor-cli', 'my-ai-tool', 'ai_assistant'];

        for (const cmd of validCommands) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: cmd,
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
          };

          expect(() => factory.createProvider(config)).not.toThrow();
        }
      });
    });

    describe('CLI Arguments Validation', () => {
      it('should reject arguments with dangerous shell metacharacters', () => {
        const dangerousArgs = [
          '; rm -rf /',
          '&& malicious',
          '| grep password',
          '`whoami`',
          '$(whoami)',
          '!malicious',
        ];

        for (const arg of dangerousArgs) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: 'aider',
            query_args: ['--help', arg],
            execute_args: ['--help'],
            prompt_in_args: false,
          };

          expect(() => factory.createProvider(config)).toThrow(/dangerous shell metacharacters/);
        }
      });

      it('should reject arguments with command substitution', () => {
        const substitutionArgs = [
          '$(malicious)',
          '`malicious`',
        ];

        for (const arg of substitutionArgs) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: 'aider',
            query_args: ['--help', arg],
            execute_args: ['--help'],
            prompt_in_args: false,
          };

          // Should throw either "command substitution" or "dangerous shell metacharacters"
          expect(() => factory.createProvider(config)).toThrow(/dangerous shell metacharacters|command substitution/);
        }
      });

      it('should reject arguments with null bytes', () => {
        const config: PluginProviderConfig = {
          id: 'test',
          type: 'plugin',
          cli_command: 'aider',
          query_args: ['--help', 'arg\0malicious'],
          execute_args: ['--help'],
          prompt_in_args: false,
        };

        expect(() => factory.createProvider(config)).toThrow(/null bytes/);
      });

      it('should accept valid CLI arguments', () => {
        const validArgs = [
          '--yes',
          '--no-auto-commits',
          '--message',
          '-p',
          '--timeout=600',
          '/path/to/file.txt',
        ];

        const config: PluginProviderConfig = {
          id: 'test',
          type: 'plugin',
          cli_command: 'aider',
          query_args: validArgs,
          execute_args: validArgs,
          prompt_in_args: false,
        };

        expect(() => factory.createProvider(config)).not.toThrow();
      });
    });

    describe('Error Pattern Validation (ReDoS Prevention)', () => {
      it('should reject patterns with catastrophic backtracking', () => {
        const redosPatterns = [
          '(a+)+',
          '(a*)*',
          '(a+)*',
          '(a*)+',
        ];

        for (const pattern of redosPatterns) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: 'aider',
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
            error_patterns: [
              {
                pattern,
                type: 'test_error',
                message: 'Test error',
              },
            ],
          };

          expect(() => factory.createProvider(config)).toThrow(/ReDoS/);
        }
      });

      it('should reject invalid regex patterns', () => {
        const invalidPatterns = [
          '[invalid',
          '(unclosed',
          '*invalid',
        ];

        for (const pattern of invalidPatterns) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: 'aider',
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
            error_patterns: [
              {
                pattern,
                type: 'test_error',
                message: 'Test error',
              },
            ],
          };

          expect(() => factory.createProvider(config)).toThrow(/Invalid regex pattern/);
        }
      });

      it('should accept valid regex patterns', () => {
        const validPatterns = [
          'session limit',
          'authentication.*required',
          'error: [0-9]+',
          '^ERROR:',
        ];

        for (const pattern of validPatterns) {
          const config: PluginProviderConfig = {
            id: 'test',
            type: 'plugin',
            cli_command: 'aider',
            query_args: ['--help'],
            execute_args: ['--help'],
            prompt_in_args: false,
            error_patterns: [
              {
                pattern,
                type: 'test_error',
                message: 'Test error',
              },
            ],
          };

          expect(() => factory.createProvider(config)).not.toThrow();
        }
      });
    });
  });

  describe('Provider Creation', () => {
    it('should create a valid dynamic provider', () => {
      const config: PluginProviderConfig = {
        id: 'aider',
        type: 'plugin',
        cli_command: 'aider',
        display_name: 'Aider AI',
        description: 'AI coding assistant',
        query_args: ['--yes', '--no-auto-commits', '--message'],
        execute_args: ['--yes', '--auto-commits', '--message'],
        prompt_in_args: true,
        timeout: {
          query: 600000,
          execute: 1200000,
        },
        not_installed_message: 'Aider is not installed',
      };

      const provider = factory.createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('aider');
    });

    it('should validate config correctly', () => {
      const validConfig = {
        id: 'test',
        cli_command: 'test-cli',
        query_args: ['--query'],
        execute_args: ['--execute'],
        prompt_in_args: true,
      };

      expect(factory.validateConfig(validConfig)).toBe(true);

      const invalidConfigs = [
        { id: 'test' },  // missing cli_command
        { cli_command: 'test' },  // missing id
        { id: 'test', cli_command: 'test', query_args: 'not-array' },  // wrong type
        { id: 'test', cli_command: 'test', query_args: [], execute_args: [], prompt_in_args: 'not-boolean' },
      ];

      for (const config of invalidConfigs) {
        const result = factory.validateConfig(config);
        expect(result).toBeFalsy();
      }
    });
  });
});
