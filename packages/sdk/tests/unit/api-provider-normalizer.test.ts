import { describe, it, expect } from 'vitest';
import { normalizeAPIProviderConfig, getModePermissions } from '../../src/utils/api-provider-normalizer';
import type { APIProviderConfig } from '../../src/types/api-provider.types';

describe('normalizeAPIProviderConfig', () => {
  const baseConfig: APIProviderConfig = {
    provider: 'api/openai',
    model: 'gpt-4o-mini',
  };

  it('defaults to empty permissions when no tools are provided', () => {
    const normalized = normalizeAPIProviderConfig(baseConfig);

    expect(normalized.permissionsByMode.query.tools).toEqual([]);
    expect(normalized.permissionsByMode.query.mcp).toEqual([]);
    expect(normalized.permissionsByMode.execute.tools).toEqual([]);
    expect(normalized.permissionsByMode.execute.mcp).toEqual([]);

    // getModePermissions helper mirrors permissions map
    expect(getModePermissions(normalized, 'query')).toEqual({ tools: [], mcp: [] });
  });

  it('merges mode options and deduplicates entries', () => {
    const config: APIProviderConfig = {
      ...baseConfig,
      options: {
        query: {
          tools: ['read_file', 'read_file', 'grep', ''],
          mcp: ['filesystem'],
        },
        execute: {
          tools: ['write_file'],
          mcp: ['filesystem', 'git'],
        },
        custom: {
          tools: ['probe'],
        },
      },
    } as any;

    const normalized = normalizeAPIProviderConfig(config);

    expect(normalized.config.options?.query?.tools).toEqual(['read_file', 'grep']);
    expect(normalized.config.options?.execute?.mcp).toEqual(['filesystem', 'git']);
    expect(normalized.permissionsByMode.custom.tools).toEqual(['probe']);
  });

  it('converts legacy root-level tools into execute mode permissions', () => {
    const config: APIProviderConfig = {
      ...baseConfig,
      tools: ['write_file', 'run_shell_command'],
      mcp_servers: ['filesystem'],
    };

    const normalized = normalizeAPIProviderConfig(config);

    expect(normalized.permissionsByMode.execute.tools).toEqual([
      'write_file',
      'run_shell_command',
    ]);
    expect(normalized.permissionsByMode.execute.mcp).toEqual(['filesystem']);
  });
});
