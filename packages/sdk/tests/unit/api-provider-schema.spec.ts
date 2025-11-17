/**
 * Unit tests for API Provider Zod Schema Validation
 *
 * Tests:
 * 1. ProviderModeOptionsSchema validation
 * 2. ProviderOptionsSchema validation (with custom modes)
 * 3. APIProviderConfigSchema validation (full config with legacy fields)
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderModeOptionsSchema,
  ProviderOptionsSchema,
  APIProviderConfigSchema,
} from '../../src/schemas/api-provider.schema';

describe('api-provider.schema - Zod Validation', () => {
  describe('ProviderModeOptionsSchema', () => {
    it('should validate valid mode options', () => {
      const validInput = {
        tools: ['file_read', 'grep', 'glob'],
        mcp: ['filesystem', 'git'],
      };
      const result = ProviderModeOptionsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should validate mode options with only tools', () => {
      const input = {
        tools: ['file_read'],
      };
      const result = ProviderModeOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate mode options with only mcp', () => {
      const input = {
        mcp: ['filesystem'],
      };
      const result = ProviderModeOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate empty mode options', () => {
      const input = {};
      const result = ProviderModeOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject mode options with non-array tools', () => {
      const invalidInput = {
        tools: 'not-an-array',
      };
      const result = ProviderModeOptionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject mode options with non-string array elements', () => {
      const invalidInput = {
        tools: ['file_read', 123, null],
      };
      const result = ProviderModeOptionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject mode options with extra fields (strict mode)', () => {
      const invalidInput = {
        tools: ['file_read'],
        extraField: 'invalid',
      };
      const result = ProviderModeOptionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('unrecognized_keys');
      }
    });

    it('should validate empty arrays', () => {
      const input = {
        tools: [],
        mcp: [],
      };
      const result = ProviderModeOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('ProviderOptionsSchema', () => {
    it('should validate provider options with query and execute modes', () => {
      const validInput = {
        query: {
          tools: ['file_read', 'grep'],
          mcp: ['filesystem'],
        },
        execute: {
          tools: ['file_read', 'file_write'],
          mcp: ['filesystem', 'git'],
        },
      };
      const result = ProviderOptionsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should validate provider options with only query mode', () => {
      const input = {
        query: {
          tools: ['file_read'],
        },
      };
      const result = ProviderOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate provider options with custom mode (catchall)', () => {
      const input = {
        query: { tools: ['file_read'] },
        execute: { tools: ['file_write'] },
        customMode: { tools: ['custom_tool'], mcp: ['custom_mcp'] },
      };
      const result = ProviderOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.customMode).toEqual({
          tools: ['custom_tool'],
          mcp: ['custom_mcp'],
        });
      }
    });

    it('should validate empty provider options', () => {
      const input = {};
      const result = ProviderOptionsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate undefined provider options', () => {
      const result = ProviderOptionsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('should reject provider options with invalid mode structure', () => {
      const invalidInput = {
        query: 'not-an-object',
      };
      const result = ProviderOptionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject provider options with invalid nested mode options', () => {
      const invalidInput = {
        query: {
          tools: 'not-an-array',
        },
      };
      const result = ProviderOptionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject provider options with custom mode having invalid structure', () => {
      const invalidInput = {
        customMode: {
          tools: 123, // invalid
        },
      };
      const result = ProviderOptionsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('APIProviderConfigSchema', () => {
    it('should validate complete API provider config', () => {
      const validConfig = {
        provider: 'api/anthropic',
        url: 'https://api.anthropic.com',
        apiKey: 'sk-test-123',
        model: 'claude-sonnet-4',
        temperature: 0.7,
        maxTokens: 4096,
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
      const result = APIProviderConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('api/anthropic');
        expect(result.data.model).toBe('claude-sonnet-4');
      }
    });

    it('should validate minimal API provider config', () => {
      const minimalConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };
      const result = APIProviderConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
    });

    it('should validate config with legacy fields (tools, mcp, mcp_servers)', () => {
      const legacyConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        tools: ['file_read', 'file_write'],
        mcp: ['filesystem'],
        mcp_servers: ['git'],
      };
      const result = APIProviderConfigSchema.safeParse(legacyConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toEqual(['file_read', 'file_write']);
        expect(result.data.mcp).toEqual(['filesystem']);
        expect(result.data.mcp_servers).toEqual(['git']);
      }
    });

    it('should validate config with both options and legacy fields', () => {
      const mixedConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: { tools: ['file_read'] },
        },
        tools: ['file_write'], // legacy
      };
      const result = APIProviderConfigSchema.safeParse(mixedConfig);
      expect(result.success).toBe(true);
    });

    it('should validate all supported provider types', () => {
      const providers = [
        'api/openai',
        'api/anthropic',
        'api/google',
        'api/bedrock',
        'api/litellm',
        'api/ollama',
        'api/sowonai',
      ];

      providers.forEach((provider) => {
        const config = {
          provider,
          model: 'test-model',
        };
        const result = APIProviderConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid provider type', () => {
      const invalidConfig = {
        provider: 'invalid/provider',
        model: 'test-model',
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config without model', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
        // model missing
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const invalidConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        url: 'not-a-valid-url',
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject temperature out of range', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        temperature: 3.0, // out of range (0-2)
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject negative temperature', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        temperature: -0.5,
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject non-positive maxTokens', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        maxTokens: 0, // must be positive
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer maxTokens', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        maxTokens: 123.45, // must be integer
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate config with valid temperature range', () => {
      const validTemps = [0, 0.5, 1.0, 1.5, 2.0];
      validTemps.forEach((temp) => {
        const config = {
          provider: 'api/anthropic',
          model: 'claude-sonnet-4',
          temperature: temp,
        };
        const result = APIProviderConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should validate config with custom MCP server options', () => {
      const config = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          execute: {
            mcp: ['filesystem', 'git', 'database'],
          },
        },
      };
      const result = APIProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Integration', () => {
    it('should validate nested options with multiple modes', () => {
      const config = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        options: {
          query: {
            tools: ['file_read', 'grep', 'glob'],
          },
          execute: {
            tools: ['file_read', 'file_write', 'run_shell'],
            mcp: ['filesystem', 'git'],
          },
          analyze: {
            tools: ['file_read', 'grep'],
          },
        },
      };
      const result = APIProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate config with optional fields omitted', () => {
      const config = {
        provider: 'api/ollama',
        model: 'llama2',
        // url, apiKey, temperature, maxTokens omitted
      };
      const result = APIProviderConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should provide detailed error messages for invalid configs', () => {
      const invalidConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
        temperature: 5.0, // invalid
        options: {
          query: {
            tools: 'not-an-array', // invalid
          },
        },
      };
      const result = APIProviderConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
