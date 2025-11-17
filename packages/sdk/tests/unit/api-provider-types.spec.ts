/**
 * Unit tests for API Provider Types and Type Guards
 *
 * Tests:
 * 1. Type guard validation (isProviderModeOptions, isProviderOptions)
 * 2. Legacy permission detection (isLegacyProviderPermissionConfig)
 * 3. Legacy to modern conversion (convertLegacyPermissionsToProviderOptions)
 * 4. Edge cases and error handling
 */

import { describe, it, expect } from 'vitest';
import {
  isProviderModeOptions,
  isProviderOptions,
  isLegacyProviderPermissionConfig,
  convertLegacyPermissionsToProviderOptions,
  type ProviderModeOptions,
  type ProviderOptions,
  type LegacyProviderPermissionConfig,
} from '../../src/types/api-provider.types';

describe('api-provider.types - Type Guards', () => {
  describe('isProviderModeOptions', () => {
    it('should validate valid mode options with tools', () => {
      const validModeOptions: ProviderModeOptions = {
        tools: ['file_read', 'grep'],
        mcp: ['filesystem'],
      };
      expect(isProviderModeOptions(validModeOptions)).toBe(true);
    });

    it('should validate mode options with only tools', () => {
      const modeOptions: ProviderModeOptions = {
        tools: ['file_read'],
      };
      expect(isProviderModeOptions(modeOptions)).toBe(true);
    });

    it('should validate mode options with only mcp', () => {
      const modeOptions: ProviderModeOptions = {
        mcp: ['filesystem'],
      };
      expect(isProviderModeOptions(modeOptions)).toBe(true);
    });

    it('should validate empty mode options', () => {
      const emptyOptions: ProviderModeOptions = {};
      expect(isProviderModeOptions(emptyOptions)).toBe(true);
    });

    it('should reject invalid mode options with non-array tools', () => {
      const invalidOptions = {
        tools: 'file_read', // string instead of array
        mcp: ['filesystem'],
      };
      expect(isProviderModeOptions(invalidOptions)).toBe(false);
    });

    it('should reject invalid mode options with non-string array elements', () => {
      const invalidOptions = {
        tools: ['file_read', 123], // number in array
        mcp: ['filesystem'],
      };
      expect(isProviderModeOptions(invalidOptions)).toBe(false);
    });

    it('should reject mode options with extra fields', () => {
      const invalidOptions = {
        tools: ['file_read'],
        extraField: 'invalid',
      };
      expect(isProviderModeOptions(invalidOptions)).toBe(false);
    });
  });

  describe('isProviderOptions', () => {
    it('should validate valid provider options with query and execute', () => {
      const validOptions: ProviderOptions = {
        query: {
          tools: ['file_read', 'grep'],
          mcp: ['filesystem'],
        },
        execute: {
          tools: ['file_read', 'file_write'],
          mcp: ['filesystem', 'git'],
        },
      };
      expect(isProviderOptions(validOptions)).toBe(true);
    });

    it('should validate provider options with only query mode', () => {
      const options: ProviderOptions = {
        query: {
          tools: ['file_read'],
        },
      };
      expect(isProviderOptions(options)).toBe(true);
    });

    it('should validate provider options with custom mode', () => {
      const options: ProviderOptions = {
        query: { tools: ['file_read'] },
        execute: { tools: ['file_write'] },
        customMode: { tools: ['custom_tool'] },
      };
      expect(isProviderOptions(options)).toBe(true);
    });

    it('should validate empty provider options', () => {
      const emptyOptions: ProviderOptions = {};
      expect(isProviderOptions(emptyOptions)).toBe(true);
    });

    it('should reject provider options with invalid mode structure', () => {
      const invalidOptions = {
        query: 'invalid', // string instead of object
      };
      expect(isProviderOptions(invalidOptions)).toBe(false);
    });

    it('should reject provider options with invalid nested mode options', () => {
      const invalidOptions = {
        query: {
          tools: 'not-an-array', // invalid tools
        },
      };
      expect(isProviderOptions(invalidOptions)).toBe(false);
    });
  });

  describe('isLegacyProviderPermissionConfig', () => {
    it('should detect legacy config with tools array', () => {
      const legacyConfig: LegacyProviderPermissionConfig = {
        tools: ['file_read', 'file_write'],
      };
      expect(isLegacyProviderPermissionConfig(legacyConfig)).toBe(true);
    });

    it('should detect legacy config with mcp array', () => {
      const legacyConfig: LegacyProviderPermissionConfig = {
        mcp: ['filesystem', 'git'],
      };
      expect(isLegacyProviderPermissionConfig(legacyConfig)).toBe(true);
    });

    it('should detect legacy config with mcp_servers array (snake_case)', () => {
      const legacyConfig: LegacyProviderPermissionConfig = {
        mcp_servers: ['filesystem'],
      };
      expect(isLegacyProviderPermissionConfig(legacyConfig)).toBe(true);
    });

    it('should detect legacy config with both tools and mcp', () => {
      const legacyConfig: LegacyProviderPermissionConfig = {
        tools: ['file_read'],
        mcp: ['filesystem'],
      };
      expect(isLegacyProviderPermissionConfig(legacyConfig)).toBe(true);
    });

    it('should reject config without legacy fields', () => {
      const modernConfig = {
        provider: 'api/anthropic',
        model: 'claude-sonnet-4',
      };
      expect(isLegacyProviderPermissionConfig(modernConfig)).toBe(false);
    });

    it('should reject config with invalid tools type', () => {
      const invalidConfig = {
        tools: 'not-an-array',
      };
      expect(isLegacyProviderPermissionConfig(invalidConfig)).toBe(false);
    });

    it('should reject non-object candidates', () => {
      expect(isLegacyProviderPermissionConfig(null)).toBe(false);
      expect(isLegacyProviderPermissionConfig(undefined)).toBe(false);
      expect(isLegacyProviderPermissionConfig('string')).toBe(false);
      expect(isLegacyProviderPermissionConfig(123)).toBe(false);
    });
  });

  describe('convertLegacyPermissionsToProviderOptions', () => {
    it('should convert legacy tools to execute mode by default', () => {
      const legacy: LegacyProviderPermissionConfig = {
        tools: ['file_read', 'file_write'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({
        execute: {
          tools: ['file_read', 'file_write'],
        },
      });
    });

    it('should convert legacy mcp to execute mode by default', () => {
      const legacy: LegacyProviderPermissionConfig = {
        mcp: ['filesystem', 'git'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({
        execute: {
          mcp: ['filesystem', 'git'],
        },
      });
    });

    it('should convert legacy mcp_servers to execute mode', () => {
      const legacy: LegacyProviderPermissionConfig = {
        mcp_servers: ['filesystem'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({
        execute: {
          mcp: ['filesystem'],
        },
      });
    });

    it('should convert both tools and mcp to execute mode', () => {
      const legacy: LegacyProviderPermissionConfig = {
        tools: ['file_read'],
        mcp: ['filesystem'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({
        execute: {
          tools: ['file_read'],
          mcp: ['filesystem'],
        },
      });
    });

    it('should convert to query mode when specified', () => {
      const legacy: LegacyProviderPermissionConfig = {
        tools: ['file_read', 'grep'],
        mcp: ['filesystem'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy, 'query');
      expect(result).toEqual({
        query: {
          tools: ['file_read', 'grep'],
          mcp: ['filesystem'],
        },
      });
    });

    it('should prefer mcp over mcp_servers when both exist', () => {
      const legacy: LegacyProviderPermissionConfig = {
        mcp: ['filesystem'],
        mcp_servers: ['git'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({
        execute: {
          mcp: ['filesystem'],
        },
      });
    });

    it('should return empty object for legacy config with empty arrays', () => {
      const legacy: LegacyProviderPermissionConfig = {
        tools: [],
        mcp: [],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({});
    });

    it('should return empty object for legacy config with undefined values', () => {
      const legacy: LegacyProviderPermissionConfig = {};
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle mode options with empty arrays', () => {
      const options: ProviderModeOptions = {
        tools: [],
        mcp: [],
      };
      expect(isProviderModeOptions(options)).toBe(true);
    });

    it('should handle provider options with undefined modes', () => {
      const options: ProviderOptions = {
        query: undefined,
        execute: { tools: ['file_read'] },
      };
      expect(isProviderOptions(options)).toBe(true);
    });

    it('should handle legacy config with whitespace in arrays', () => {
      const legacy: LegacyProviderPermissionConfig = {
        tools: ['file_read', '  ', 'file_write'],
      };
      expect(isLegacyProviderPermissionConfig(legacy)).toBe(true);
    });

    it('should convert legacy config with single tool', () => {
      const legacy: LegacyProviderPermissionConfig = {
        tools: ['file_read'],
      };
      const result = convertLegacyPermissionsToProviderOptions(legacy);
      expect(result.execute?.tools).toHaveLength(1);
    });

    it('should validate mode options without optional fields', () => {
      const options: ProviderModeOptions = {};
      expect(isProviderModeOptions(options)).toBe(true);
    });
  });
});
