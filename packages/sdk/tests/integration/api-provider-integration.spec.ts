/**
 * Integration tests for API Provider Configuration
 *
 * Tests end-to-end scenarios:
 * 1. Complete config flow (parse → normalize → filter)
 * 2. Legacy to modern migration scenarios
 * 3. Real-world use cases with multiple modes
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeAPIProviderConfig,
  getModePermissions,
  type NormalizedAPIProviderConfigResult,
} from '../../src/utils/api-provider-normalizer';
import type {
  APIProviderConfig,
  ProviderExecutionMode,
} from '../../src/types/api-provider.types';

describe('API Provider Integration Tests', () => {
  describe('Complete Configuration Flow', () => {
    it('should handle complete modern config from YAML to execution', () => {
      // Simulates YAML config parsed and ready for use
      const yamlConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        url: 'https://api.anthropic.com',
        apiKey: 'sk-test-key',
        temperature: 0.7,
        maxTokens: 4096,
        options: {
          query: {
            tools: ['file_read', 'grep', 'glob'],
            mcp: ['filesystem'],
          },
          execute: {
            tools: ['file_read', 'file_write', 'run_shell_command'],
            mcp: ['filesystem', 'git', 'database'],
          },
        },
      };

      // Normalize
      const normalized = normalizeAPIProviderConfig(yamlConfig);

      // Verify normalization
      expect(normalized.config.provider).toBe('api/anthropic');
      expect(normalized.config.model).toBe('claude-sonnet-4');

      // Get query mode permissions
      const queryPerms = getModePermissions(normalized, 'query');
      expect(queryPerms.tools).toEqual(['file_read', 'grep', 'glob']);
      expect(queryPerms.mcp).toEqual(['filesystem']);
      expect(queryPerms.tools).not.toContain('file_write'); // No write in query

      // Get execute mode permissions
      const executePerms = getModePermissions(normalized, 'execute');
      expect(executePerms.tools).toEqual(['file_read', 'file_write', 'run_shell_command']);
      expect(executePerms.mcp).toEqual(['filesystem', 'git', 'database']);
    });

    it('should handle legacy config migration scenario', () => {
      // Legacy config from SowonFlow-style YAML
      const legacyYamlConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_read', 'file_write', 'grep'],
        mcp_servers: ['filesystem', 'git'],
      };

      // Normalize (auto-converts to modern format)
      const normalized = normalizeAPIProviderConfig(legacyYamlConfig);

      // Verify conversion to execute mode
      expect(normalized.config.options?.execute?.tools).toContain('file_read');
      expect(normalized.config.options?.execute?.tools).toContain('file_write');
      expect(normalized.config.options?.execute?.tools).toContain('grep');
      expect(normalized.config.options?.execute?.mcp).toContain('filesystem');
      expect(normalized.config.options?.execute?.mcp).toContain('git');

      // Query mode should be empty (default)
      const queryPerms = getModePermissions(normalized, 'query');
      expect(queryPerms.tools).toEqual([]);
      expect(queryPerms.mcp).toEqual([]);

      // Execute mode should have all tools
      const executePerms = getModePermissions(normalized, 'execute');
      expect(executePerms.tools.length).toBe(3);
      expect(executePerms.mcp.length).toBe(2);
    });

    it('should handle progressive migration (mixed legacy and modern)', () => {
      // User is migrating from legacy to modern format
      const mixedConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_write', 'run_shell_command'], // legacy execute tools
        options: {
          query: {
            // modern query tools
            tools: ['file_read', 'grep'],
            mcp: ['filesystem'],
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(mixedConfig);

      // Query mode should have modern config
      const queryPerms = getModePermissions(normalized, 'query');
      expect(queryPerms.tools).toEqual(['file_read', 'grep']);
      expect(queryPerms.mcp).toEqual(['filesystem']);

      // Execute mode should merge legacy and any execute settings
      const executePerms = getModePermissions(normalized, 'execute');
      expect(executePerms.tools).toContain('file_write');
      expect(executePerms.tools).toContain('run_shell_command');
    });
  });

  describe('Real-World Use Cases', () => {
    it('should support read-only query mode and full-access execute mode', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            // Read-only tools for query mode
            tools: ['file_read', 'grep', 'glob', 'ls'],
            mcp: ['filesystem'], // Read-only MCP
          },
          execute: {
            // Full access tools for execute mode
            tools: ['file_read', 'file_write', 'run_shell_command', 'replace'],
            mcp: ['filesystem', 'git', 'database'],
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);
      const queryPerms = getModePermissions(normalized, 'query');
      const executePerms = getModePermissions(normalized, 'execute');

      // Query should not have write capabilities
      expect(queryPerms.tools).not.toContain('file_write');
      expect(queryPerms.tools).not.toContain('run_shell_command');
      expect(queryPerms.tools).not.toContain('replace');

      // Execute should have all capabilities
      expect(executePerms.tools).toContain('file_write');
      expect(executePerms.tools).toContain('run_shell_command');
      expect(executePerms.tools).toContain('replace');

      // Both should have file_read
      expect(queryPerms.tools).toContain('file_read');
      expect(executePerms.tools).toContain('file_read');
    });

    it('should support minimal config for simple use cases', () => {
      const minimalConfig: APIProviderConfig = {
        provider: 'api/ollama',
        model: 'llama2',
        // No tools, no MCP - just basic LLM
      };

      const normalized = normalizeAPIProviderConfig(minimalConfig);
      const queryPerms = getModePermissions(normalized, 'query');
      const executePerms = getModePermissions(normalized, 'execute');

      // Should have empty permissions
      expect(queryPerms.tools).toEqual([]);
      expect(queryPerms.mcp).toEqual([]);
      expect(executePerms.tools).toEqual([]);
      expect(executePerms.mcp).toEqual([]);
    });

    it('should support custom mode for specialized use cases', () => {
      const config: any = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: { tools: ['file_read'] },
          execute: { tools: ['file_write'] },
          analyze: {
            // Custom mode for code analysis
            tools: ['file_read', 'grep', 'glob'],
            mcp: ['filesystem'],
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);

      // Standard modes should work
      expect(getModePermissions(normalized, 'query').tools).toEqual(['file_read']);
      expect(getModePermissions(normalized, 'execute').tools).toEqual(['file_write']);

      // Custom mode should be accessible
      expect(normalized.permissionsByMode.analyze).toBeDefined();
      expect(normalized.permissionsByMode.analyze.tools).toEqual(['file_read', 'grep', 'glob']);
    });

    it('should handle multi-provider setup with different permissions', () => {
      // Scenario: Different providers with different tool access levels
      const configs: APIProviderConfig[] = [
        {
          // Development agent - full access
          provider: 'api/anthropic',
          model: 'claude-sonnet-4',
          options: {
            execute: {
              tools: ['file_read', 'file_write', 'run_shell_command'],
              mcp: ['filesystem', 'git', 'database'],
            },
          },
        },
        {
          // Review agent - read-only
          provider: 'api/openai',
          model: 'gpt-4',
          options: {
            query: {
              tools: ['file_read', 'grep'],
              mcp: ['filesystem'],
            },
          },
        },
        {
          // Documentation agent - limited write
          provider: 'api/google',
          model: 'gemini-pro',
          options: {
            execute: {
              tools: ['file_read', 'file_write'], // Only file operations
              mcp: ['filesystem'], // No git or database
            },
          },
        },
      ];

      const normalized = configs.map((config) => normalizeAPIProviderConfig(config));

      // Development agent has full access
      const devExecute = getModePermissions(normalized[0], 'execute');
      expect(devExecute.tools).toContain('run_shell_command');
      expect(devExecute.mcp).toContain('git');

      // Review agent is read-only
      const reviewQuery = getModePermissions(normalized[1], 'query');
      expect(reviewQuery.tools).not.toContain('file_write');
      expect(reviewQuery.tools).toContain('file_read');

      // Documentation agent has limited write
      const docsExecute = getModePermissions(normalized[2], 'execute');
      expect(docsExecute.tools).toContain('file_write');
      expect(docsExecute.tools).not.toContain('run_shell_command');
      expect(docsExecute.mcp).not.toContain('git');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain compatibility with SowonFlow tool definitions', () => {
      // SowonFlow style configuration
      const sowonFlowConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['readFile', 'writeFile', 'searchFiles'],
        mcp_servers: ['filesystem'],
      };

      const normalized = normalizeAPIProviderConfig(sowonFlowConfig);

      // Should convert to execute mode
      const executePerms = getModePermissions(normalized, 'execute');
      expect(executePerms.tools).toEqual(['readFile', 'writeFile', 'searchFiles']);
      expect(executePerms.mcp).toEqual(['filesystem']);
    });

    it('should handle empty legacy arrays without errors', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: [],
        mcp: [],
      };

      const normalized = normalizeAPIProviderConfig(config);
      const executePerms = getModePermissions(normalized, 'execute');

      expect(executePerms.tools).toEqual([]);
      expect(executePerms.mcp).toEqual([]);
    });

    it('should handle gradual migration path', () => {
      // Step 1: Legacy config
      const step1: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_read', 'file_write'],
      };

      // Step 2: Add query mode (keeping legacy)
      const step2: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_read', 'file_write'], // still here
        options: {
          query: {
            tools: ['file_read', 'grep'], // new
          },
        },
      };

      // Step 3: Full modern (remove legacy)
      const step3: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read', 'grep'],
          },
          execute: {
            tools: ['file_read', 'file_write'],
          },
        },
      };

      // All steps should work
      const norm1 = normalizeAPIProviderConfig(step1);
      const norm2 = normalizeAPIProviderConfig(step2);
      const norm3 = normalizeAPIProviderConfig(step3);

      expect(getModePermissions(norm1, 'execute').tools.length).toBeGreaterThan(0);
      expect(getModePermissions(norm2, 'query').tools.length).toBeGreaterThan(0);
      expect(getModePermissions(norm3, 'query').tools).toEqual(['file_read', 'grep']);
      expect(getModePermissions(norm3, 'execute').tools).toEqual(['file_read', 'file_write']);
    });
  });

  describe('Mode Switching Scenarios', () => {
    it('should correctly switch permissions between query and execute modes', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read', 'grep'],
          },
          execute: {
            tools: ['file_read', 'file_write', 'run_shell_command'],
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);

      // Simulate mode switching
      const modes: ProviderExecutionMode[] = ['query', 'execute', 'query', 'execute'];
      const results = modes.map((mode) => ({
        mode,
        permissions: getModePermissions(normalized, mode),
      }));

      // Query modes should not have write tools
      expect(results[0].permissions.tools).not.toContain('file_write');
      expect(results[2].permissions.tools).not.toContain('file_write');

      // Execute modes should have write tools
      expect(results[1].permissions.tools).toContain('file_write');
      expect(results[3].permissions.tools).toContain('file_write');
    });

    it('should handle dynamic permission updates', () => {
      const baseConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          execute: {
            tools: ['file_read'],
          },
        },
      };

      // Normalize base config
      let normalized = normalizeAPIProviderConfig(baseConfig);
      expect(getModePermissions(normalized, 'execute').tools).toEqual(['file_read']);

      // Update config with more tools
      const updatedConfig: APIProviderConfig = {
        ...baseConfig,
        options: {
          execute: {
            tools: ['file_read', 'file_write', 'grep'],
          },
        },
      };

      // Normalize updated config
      normalized = normalizeAPIProviderConfig(updatedConfig);
      expect(getModePermissions(normalized, 'execute').tools).toEqual([
        'file_read',
        'file_write',
        'grep',
      ]);
    });
  });
});
