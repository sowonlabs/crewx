/**
 * Unit tests for API Provider Normalizer
 *
 * Tests:
 * 1. normalizeAPIProviderConfig with modern options
 * 2. Legacy format auto-conversion
 * 3. Mode-specific permission filtering (getModePermissions)
 * 4. Error handling and validation
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeAPIProviderConfig,
  getModePermissions,
  isAPIProviderConfig,
  assertAPIProviderConfig,
  APIProviderNormalizationError,
  type NormalizedAPIProviderConfigResult,
} from '../../src/utils/api-provider-normalizer';
import type { APIProviderConfig } from '../../src/types/api-provider.types';

describe('api-provider-normalizer - Normalization Logic', () => {
  describe('normalizeAPIProviderConfig - Modern Format', () => {
    it('should normalize config with query and execute modes', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read', 'grep'],
            mcp: ['filesystem'],
          },
          execute: {
            tools: ['file_read', 'file_write'],
            mcp: ['filesystem', 'git'],
          },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.query?.tools).toEqual(['file_read', 'grep']);
      expect(result.config.options?.query?.mcp).toEqual(['filesystem']);
      expect(result.config.options?.execute?.tools).toEqual(['file_read', 'file_write']);
      expect(result.config.options?.execute?.mcp).toEqual(['filesystem', 'git']);

      expect(result.permissionsByMode.query).toEqual({
        tools: ['file_read', 'grep'],
        mcp: ['filesystem'],
      });
      expect(result.permissionsByMode.execute).toEqual({
        tools: ['file_read', 'file_write'],
        mcp: ['filesystem', 'git'],
      });
    });

    it('should normalize config with only query mode', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read'],
          },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.query?.tools).toEqual(['file_read']);
      expect(result.config.options?.execute?.tools).toEqual([]);
      expect(result.permissionsByMode.query.tools).toEqual(['file_read']);
      expect(result.permissionsByMode.execute.tools).toEqual([]);
    });

    it('should normalize config with empty options', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {},
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.query).toEqual({ tools: [], mcp: [] });
      expect(result.config.options?.execute).toEqual({ tools: [], mcp: [] });
      expect(result.permissionsByMode.query).toEqual({ tools: [], mcp: [] });
      expect(result.permissionsByMode.execute).toEqual({ tools: [], mcp: [] });
    });

    it('should deduplicate tools and mcp servers', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          execute: {
            tools: ['file_read', 'file_read', 'file_write'],
            mcp: ['filesystem', 'filesystem', 'git'],
          },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.execute?.tools).toEqual(['file_read', 'file_write']);
      expect(result.config.options?.execute?.mcp).toEqual(['filesystem', 'git']);
    });

    it('should trim and filter whitespace in tools and mcp', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          execute: {
            tools: ['file_read', '  ', 'file_write', ''],
            mcp: ['filesystem', '  ', 'git'],
          },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.execute?.tools).toEqual(['file_read', 'file_write']);
      expect(result.config.options?.execute?.mcp).toEqual(['filesystem', 'git']);
    });
  });

  describe('normalizeAPIProviderConfig - Legacy Format', () => {
    it('should convert legacy tools to execute mode', () => {
      const legacyConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_read', 'file_write'],
      };

      const result = normalizeAPIProviderConfig(legacyConfig);

      expect(result.config.options?.execute?.tools).toContain('file_read');
      expect(result.config.options?.execute?.tools).toContain('file_write');
      expect(result.permissionsByMode.execute.tools).toContain('file_read');
      expect(result.permissionsByMode.execute.tools).toContain('file_write');
    });

    it('should convert legacy mcp to execute mode', () => {
      const legacyConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        mcp: ['filesystem', 'git'],
      };

      const result = normalizeAPIProviderConfig(legacyConfig);

      expect(result.config.options?.execute?.mcp).toEqual(['filesystem', 'git']);
      expect(result.permissionsByMode.execute.mcp).toEqual(['filesystem', 'git']);
    });

    it('should convert legacy mcp_servers to execute mode', () => {
      const legacyConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        mcp_servers: ['filesystem'],
      };

      const result = normalizeAPIProviderConfig(legacyConfig);

      expect(result.config.options?.execute?.mcp).toContain('filesystem');
      expect(result.permissionsByMode.execute.mcp).toContain('filesystem');
    });

    it('should merge legacy and modern options', () => {
      const mixedConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_write'], // legacy
        options: {
          execute: {
            tools: ['file_read'], // modern
          },
        },
      };

      const result = normalizeAPIProviderConfig(mixedConfig);

      expect(result.config.options?.execute?.tools).toContain('file_read');
      expect(result.config.options?.execute?.tools).toContain('file_write');
    });

    it('should prefer mcp over mcp_servers when both exist', () => {
      const legacyConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        mcp: ['filesystem'],
        mcp_servers: ['git'], // should be ignored
      };

      const result = normalizeAPIProviderConfig(legacyConfig);

      expect(result.config.options?.execute?.mcp).toEqual(['filesystem']);
      expect(result.config.options?.execute?.mcp).not.toContain('git');
    });

    it('should handle legacy config with empty arrays', () => {
      const legacyConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: [],
        mcp: [],
      };

      const result = normalizeAPIProviderConfig(legacyConfig);

      expect(result.config.options?.execute?.tools).toEqual([]);
      expect(result.config.options?.execute?.mcp).toEqual([]);
    });
  });

  describe('getModePermissions - Mode Filtering', () => {
    it('should return query mode permissions', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read', 'grep'],
            mcp: ['filesystem'],
          },
          execute: {
            tools: ['file_read', 'file_write'],
            mcp: ['filesystem', 'git'],
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);
      const queryPerms = getModePermissions(normalized, 'query');

      expect(queryPerms.tools).toEqual(['file_read', 'grep']);
      expect(queryPerms.mcp).toEqual(['filesystem']);
    });

    it('should return execute mode permissions', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read'],
          },
          execute: {
            tools: ['file_read', 'file_write'],
            mcp: ['filesystem', 'git'],
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);
      const executePerms = getModePermissions(normalized, 'execute');

      expect(executePerms.tools).toEqual(['file_read', 'file_write']);
      expect(executePerms.mcp).toEqual(['filesystem', 'git']);
    });

    it('should return empty permissions for undefined mode', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {},
      };

      const normalized = normalizeAPIProviderConfig(config);
      const customPerms = getModePermissions(normalized, 'query');

      expect(customPerms.tools).toEqual([]);
      expect(customPerms.mcp).toEqual([]);
    });

    it('should filter tools for query mode (read-only)', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read', 'grep'], // no write tools
          },
          execute: {
            tools: ['file_read', 'file_write'], // includes write
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);
      const queryPerms = getModePermissions(normalized, 'query');
      const executePerms = getModePermissions(normalized, 'execute');

      expect(queryPerms.tools).not.toContain('file_write');
      expect(executePerms.tools).toContain('file_write');
    });

    it('should filter mcp servers per mode', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            mcp: ['filesystem'], // read-only access
          },
          execute: {
            mcp: ['filesystem', 'git', 'database'], // full access
          },
        },
      };

      const normalized = normalizeAPIProviderConfig(config);
      const queryPerms = getModePermissions(normalized, 'query');
      const executePerms = getModePermissions(normalized, 'execute');

      expect(queryPerms.mcp).toEqual(['filesystem']);
      expect(executePerms.mcp).toEqual(['filesystem', 'git', 'database']);
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate valid API provider config', () => {
      const validConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
      };
      expect(isAPIProviderConfig(validConfig)).toBe(true);
    });

    it('should reject invalid provider type', () => {
      const invalidConfig = {
        provider: 'invalid/provider',
        model: 'test-model',
      };
      expect(isAPIProviderConfig(invalidConfig)).toBe(false);
    });

    it('should reject config without model', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
      };
      expect(isAPIProviderConfig(invalidConfig)).toBe(false);
    });

    it('should assert valid config without throwing', () => {
      const validConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
      };
      expect(() => assertAPIProviderConfig(validConfig)).not.toThrow();
    });

    it('should throw APIProviderNormalizationError for invalid config', () => {
      const invalidConfig = {
        provider: 'invalid/provider',
        model: 'test-model',
      };
      expect(() => assertAPIProviderConfig(invalidConfig)).toThrow(
        APIProviderNormalizationError,
      );
      expect(() => assertAPIProviderConfig(invalidConfig)).toThrow(
        'Invalid API provider configuration',
      );
    });

    it('should throw error for invalid options structure', () => {
      const invalidConfig: any = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: 'not-an-object', // invalid
        },
      };

      expect(() => normalizeAPIProviderConfig(invalidConfig)).toThrow(
        APIProviderNormalizationError,
      );
    });

    it('should throw error for invalid mode options', () => {
      const invalidConfig: any = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          execute: {
            tools: 'not-an-array', // invalid
          },
        },
      };

      expect(() => normalizeAPIProviderConfig(invalidConfig)).toThrow(
        APIProviderNormalizationError,
      );
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle config with custom modes', () => {
      const config: any = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: { tools: ['file_read'] },
          execute: { tools: ['file_write'] },
          customMode: { tools: ['custom_tool'] },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.query).toBeDefined();
      expect(result.config.options?.execute).toBeDefined();
      expect(result.permissionsByMode.query).toBeDefined();
      expect(result.permissionsByMode.execute).toBeDefined();
    });

    it('should handle config with no permissions', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.query?.tools).toEqual([]);
      expect(result.config.options?.execute?.tools).toEqual([]);
    });

    it('should preserve original config properties', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        url: 'https://api.anthropic.com',
        apiKey: 'sk-test',
        temperature: 0.7,
        maxTokens: 4096,
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.url).toBe('https://api.anthropic.com');
      expect(result.config.apiKey).toBe('sk-test');
      expect(result.config.temperature).toBe(0.7);
      expect(result.config.maxTokens).toBe(4096);
    });

    it('should handle very long tool lists', () => {
      const tools = Array.from({ length: 100 }, (_, i) => `tool_${i}`);
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          execute: { tools },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      expect(result.config.options?.execute?.tools?.length).toBe(100);
    });

    it('should handle merging of overlapping permissions', () => {
      const config: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_read', 'file_write'],
        options: {
          execute: {
            tools: ['file_read', 'grep'], // overlapping file_read
          },
        },
      };

      const result = normalizeAPIProviderConfig(config);

      // Should deduplicate file_read
      expect(result.config.options?.execute?.tools).toContain('file_read');
      expect(result.config.options?.execute?.tools).toContain('file_write');
      expect(result.config.options?.execute?.tools).toContain('grep');
      // Check deduplication
      const fileReadCount = result.config.options?.execute?.tools?.filter(
        (t) => t === 'file_read',
      ).length;
      expect(fileReadCount).toBe(1);
    });
  });
});
