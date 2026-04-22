import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crewxSdk from '@crewx/sdk';
import type { QueryResult } from '@crewx/sdk';

// Mock @crewx/sdk Crewx class
const mockQuery = vi.fn();
const mockCrewx = {
  query: mockQuery,
  on: vi.fn(() => () => {}),
  use: vi.fn().mockResolvedValue(undefined),  // stub for crewx.use(plugin)
  close: vi.fn().mockResolvedValue(undefined),
  agents: new Map([
    ['claude', { id: 'claude', provider: 'cli/claude' }],
  ]),
  getAgent: vi.fn((ref: string) => {
    const id = ref.startsWith('@') ? ref.slice(1) : ref;
    return id === 'claude' ? { id: 'claude', provider: 'cli/claude' } : undefined;
  }),
  getRemoteProviderConfig: vi.fn(() => undefined),
};

vi.mock('@crewx/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@crewx/sdk')>();
  return {
    ...actual,
    Crewx: {
      loadYaml: vi.fn(),
    },
  };
});

describe('commands/query', () => {
  let handleQuery: (args: string[]) => Promise<void>;
  let originalEnv: NodeJS.ProcessEnv;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(crewxSdk.Crewx.loadYaml).mockResolvedValue(mockCrewx as unknown as crewxSdk.Crewx);

    mockQuery.mockResolvedValue({
      ok: true,
      data: '안녕하세요!',
      meta: { agentId: 'claude', provider: 'cli/claude', durationMs: 100 },
    } satisfies QueryResult);

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    originalEnv = { ...process.env };
    process.env.CREWX_CONFIG = '/fake/crewx.yaml';

    const mod = await import('../../src/commands/query');
    handleQuery = mod.handleQuery;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('calls Crewx.loadYaml with CREWX_CONFIG env var', async () => {
    await handleQuery(['@claude', '안녕']);
    expect(crewxSdk.Crewx.loadYaml).toHaveBeenCalledWith('/fake/crewx.yaml', expect.any(Object));
  });

  it('calls crewx.query with parsed agentRef and message', async () => {
    await handleQuery(['@claude', '안녕']);
    expect(mockQuery).toHaveBeenCalledWith('@claude', '안녕', expect.any(Object));
  });

  it('joins multi-word message from args array', async () => {
    await handleQuery(['@claude', 'hello', 'world']);
    expect(mockQuery).toHaveBeenCalledWith('@claude', 'hello world', expect.any(Object));
  });

  it('prints raw response to stdout on success (default mode)', async () => {
    await handleQuery(['@claude', '안녕']);
    expect(consoleLogSpy).toHaveBeenCalledWith('안녕하세요!');
  });

  it('exits with code 1 on query failure', async () => {
    mockQuery.mockResolvedValue({
      ok: false,
      data: '',
      error: { code: 'QUERY_FAILED', message: 'provider error' },
      meta: { agentId: 'claude', provider: 'cli/claude', durationMs: 10 },
    } satisfies QueryResult);

    await expect(handleQuery(['@claude', '안녕'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('provider error'));
  });

  it('exits with code 1 when no agent ref provided', async () => {
    await expect(handleQuery([])).rejects.toThrow('process.exit(1)');
  });

  it('calls crewx.close() after successful query', async () => {
    await handleQuery(['@claude', '안녕']);
    expect(mockCrewx.close).toHaveBeenCalledOnce();
  });

  it('calls crewx.close() even when query fails', async () => {
    mockQuery.mockResolvedValue({
      ok: false,
      data: '',
      error: { code: 'QUERY_FAILED', message: 'provider error' },
      meta: { agentId: 'claude', provider: 'cli/claude', durationMs: 10 },
    });
    await expect(handleQuery(['@claude', '안녕'])).rejects.toThrow('process.exit(1)');
    expect(mockCrewx.close).toHaveBeenCalledOnce();
  });

  it('uses crewx.yaml as default when CREWX_CONFIG is not set', async () => {
    delete process.env.CREWX_CONFIG;
    await handleQuery(['@claude', '안녕']);
    expect(crewxSdk.Crewx.loadYaml).toHaveBeenCalledWith(expect.stringContaining('crewx.yaml'), expect.any(Object));
  });

  it('passes --provider flag to crewx.query', async () => {
    await handleQuery(['@claude', '안녕', '--provider', 'cli/gemini']);
    expect(mockQuery).toHaveBeenCalledWith('@claude', '안녕', expect.objectContaining({ provider: 'cli/gemini' }));
  });

  it('uses --config flag instead of CREWX_CONFIG', async () => {
    await handleQuery(['@claude', '안녕', '--config', '/custom/crewx.yaml']);
    expect(crewxSdk.Crewx.loadYaml).toHaveBeenCalledWith('/custom/crewx.yaml', expect.any(Object));
  });

  it('uses -c short flag for config', async () => {
    await handleQuery(['@claude', '안녕', '-c', '/custom/crewx.yaml']);
    expect(crewxSdk.Crewx.loadYaml).toHaveBeenCalledWith('/custom/crewx.yaml', expect.any(Object));
  });

  it('ignores flag args in agent/message parsing', async () => {
    await handleQuery(['@claude', '안녕', '--thread', 'my-thread']);
    expect(mockQuery).toHaveBeenCalledWith('@claude', '안녕', expect.any(Object));
  });

  it('exits with code 2 on invalid --metadata JSON', async () => {
    await expect(handleQuery(['@claude', 'hi', '--metadata', "{'h':'1'}"])).rejects.toThrow('process.exit(2)');
  });

  describe.skip('file:// remote agent swap', () => {
    // file:// swap is now handled inside the SDK via remoteFactory — not testable at CLI layer
    it('swaps Crewx instance when agent uses file:// remote provider', async () => {
      const callerClose = vi.fn().mockResolvedValue(undefined);
      const callerCrewx = {
        ...mockCrewx,
        close: callerClose,
        getAgent: vi.fn((ref: string) => {
          const id = ref.startsWith('@') ? ref.slice(1) : ref;
          return id === 'remote_cpo'
            ? { id: 'remote_cpo', provider: 'remote/sowonlabs_cpo' }
            : undefined;
        }),
        getRemoteProviderConfig: vi.fn((id: string) =>
          id === 'sowonlabs_cpo'
            ? { id: 'sowonlabs_cpo', type: 'remote', location: 'file:///target/crewx.yaml', external_agent_id: 'cpo' }
            : undefined,
        ),
      };

      const targetClose = vi.fn().mockResolvedValue(undefined);
      const targetQuery = vi.fn().mockResolvedValue({
        ok: true,
        data: '답변!',
        meta: { agentId: 'cpo', provider: 'cli/claude', durationMs: 50 },
      });
      const targetCrewx = {
        ...mockCrewx,
        close: targetClose,
        query: targetQuery,
        getAgent: vi.fn((ref: string) => {
          const id = ref.startsWith('@') ? ref.slice(1) : ref;
          return id === 'cpo' ? { id: 'cpo', provider: 'cli/claude' } : undefined;
        }),
        getRemoteProviderConfig: vi.fn(() => undefined),
      };

      vi.mocked(crewxSdk.Crewx.loadYaml)
        .mockResolvedValueOnce(callerCrewx as unknown as crewxSdk.Crewx)
        .mockResolvedValueOnce(targetCrewx as unknown as crewxSdk.Crewx);

      await handleQuery(['@remote_cpo', '안녕']);

      expect(callerClose).toHaveBeenCalledOnce();
      expect(targetQuery).toHaveBeenCalledWith('@cpo', '안녕', expect.any(Object));
      expect(targetClose).toHaveBeenCalledOnce();
    });

    it('throws for chained file:// → remote/ (chained remote)', async () => {
      const callerClose = vi.fn().mockResolvedValue(undefined);
      const callerCrewx = {
        ...mockCrewx,
        close: callerClose,
        getAgent: vi.fn((ref: string) => {
          const id = ref.startsWith('@') ? ref.slice(1) : ref;
          return id === 'remote_cpo'
            ? { id: 'remote_cpo', provider: 'remote/sowonlabs_cpo' }
            : undefined;
        }),
        getRemoteProviderConfig: vi.fn(() => ({
          id: 'sowonlabs_cpo',
          type: 'remote',
          location: 'file:///target/crewx.yaml',
          external_agent_id: 'cpo',
        })),
      };

      const targetClose = vi.fn().mockResolvedValue(undefined);
      const targetCrewx = {
        ...mockCrewx,
        close: targetClose,
        query: vi.fn(),
        getAgent: vi.fn((ref: string) => {
          const id = ref.startsWith('@') ? ref.slice(1) : ref;
          return id === 'cpo' ? { id: 'cpo', provider: 'remote/another' } : undefined;
        }),
        getRemoteProviderConfig: vi.fn(() => undefined),
      };

      vi.mocked(crewxSdk.Crewx.loadYaml)
        .mockResolvedValueOnce(callerCrewx as unknown as crewxSdk.Crewx)
        .mockResolvedValueOnce(targetCrewx as unknown as crewxSdk.Crewx);

      await expect(handleQuery(['@remote_cpo', '안녕'])).rejects.toThrow(
        /Chained remotes not allowed/,
      );
      expect(targetClose).toHaveBeenCalledOnce();
    });
  });
});
