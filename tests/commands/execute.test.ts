import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crewxSdk from '@crewx/sdk';
import type { ExecuteResult } from '@crewx/sdk';

// Mock @crewx/sdk Crewx class
const mockExecute = vi.fn();
const mockCrewx = {
  execute: mockExecute,
  query: vi.fn(),
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

describe('commands/execute', () => {
  let handleExecute: (args: string[]) => Promise<void>;
  let originalEnv: NodeJS.ProcessEnv;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(crewxSdk.Crewx.loadYaml).mockResolvedValue(mockCrewx as unknown as crewxSdk.Crewx);

    // Default: execute succeeds
    mockExecute.mockResolvedValue({
      ok: true,
      data: '작업 완료!',
      meta: { agentId: 'claude', provider: 'cli/claude', durationMs: 100 },
    } satisfies ExecuteResult);

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    originalEnv = { ...process.env };
    process.env.CREWX_CONFIG = '/fake/crewx.yaml';

    const mod = await import('../../src/commands/execute');
    handleExecute = mod.handleExecute;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('calls Crewx.loadYaml with CREWX_CONFIG env var', async () => {
    await handleExecute(['@claude', '파일 목록을 보여줘']);
    expect(crewxSdk.Crewx.loadYaml).toHaveBeenCalledWith('/fake/crewx.yaml', expect.any(Object));
  });

  it('calls crewx.execute with parsed agentRef and message', async () => {
    await handleExecute(['@claude', '파일 목록을 보여줘']);
    expect(mockExecute).toHaveBeenCalledWith('@claude', '파일 목록을 보여줘', expect.any(Object));
  });

  it('handles single-chunk arg form: "@claude 파일 목록"', async () => {
    await handleExecute(['@claude 파일 목록을 보여줘']);
    expect(mockExecute).toHaveBeenCalledWith('@claude', '파일 목록을 보여줘', expect.any(Object));
  });

  it('joins multi-word message from args array', async () => {
    await handleExecute(['@claude', 'implement', 'login', 'page']);
    expect(mockExecute).toHaveBeenCalledWith('@claude', 'implement login page', expect.any(Object));
  });

  it('prints response to stdout on success', async () => {
    await handleExecute(['@claude', '작업']);
    expect(consoleLogSpy).toHaveBeenCalledWith('작업 완료!');
  });

  it('exits with code 1 on execute failure', async () => {
    mockExecute.mockResolvedValue({
      ok: false,
      data: '',
      error: { code: 'EXECUTE_FAILED', message: 'provider error' },
      meta: { agentId: 'claude', provider: 'cli/claude', durationMs: 10 },
    } satisfies ExecuteResult);

    await expect(handleExecute(['@claude', '작업'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('provider error'));
  });

  it('exits with code 1 when no agent ref provided', async () => {
    await expect(handleExecute([])).rejects.toThrow('process.exit(1)');
  });

  it('exits with code 1 when no message provided', async () => {
    await expect(handleExecute(['@claude'])).rejects.toThrow('process.exit(1)');
  });

  it('uses crewx.yaml as default when CREWX_CONFIG is not set', async () => {
    delete process.env.CREWX_CONFIG;
    await handleExecute(['@claude', '작업']);
    expect(crewxSdk.Crewx.loadYaml).toHaveBeenCalledWith(expect.stringContaining('crewx.yaml'), expect.any(Object));
  });

  it('calls crewx.close() after successful execute', async () => {
    await handleExecute(['@claude', '작업']);
    expect(mockCrewx.close).toHaveBeenCalledOnce();
  });

  it('calls crewx.close() even when execute fails', async () => {
    mockExecute.mockResolvedValue({
      ok: false,
      data: '',
      error: { code: 'EXECUTE_FAILED', message: 'provider error' },
      meta: { agentId: 'claude', provider: 'cli/claude', durationMs: 10 },
    } satisfies ExecuteResult);
    await expect(handleExecute(['@claude', '작업'])).rejects.toThrow('process.exit(1)');
    expect(mockCrewx.close).toHaveBeenCalledOnce();
  });

  // Edge cases: exception throw, stderr routing
  it('exits with code 1 when execute throws an exception', async () => {
    mockExecute.mockRejectedValue(new Error('network timeout'));
    await expect(handleExecute(['@claude', '작업'])).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('network timeout'));
    expect(mockCrewx.close).toHaveBeenCalledOnce();
  });

  it('writes verbose debug info to stderr when --verbose flag is set', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await handleExecute(['--verbose', '@claude', '작업']);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('작업'));
    stderrSpy.mockRestore();
  });

  it('exits with code 2 on invalid --metadata JSON', async () => {
    await expect(handleExecute(['@claude', '작업', '--metadata', "{'h':'1'}"])).rejects.toThrow('process.exit(2)');
  });

  describe.skip('file:// remote agent swap', () => {
    // file:// swap is now handled inside the SDK via remoteFactory — not testable at CLI layer
    it('swaps Crewx instance when agent uses file:// remote provider', async () => {
      // Use independent close mocks so shared mockCrewx.close doesn't interfere
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
      const targetExecute = vi.fn().mockResolvedValue({
        ok: true,
        data: '완료!',
        meta: { agentId: 'cpo', provider: 'cli/claude', durationMs: 50 },
      });
      const targetCrewx = {
        ...mockCrewx,
        close: targetClose,
        execute: targetExecute,
        getAgent: vi.fn((ref: string) => {
          const id = ref.startsWith('@') ? ref.slice(1) : ref;
          return id === 'cpo' ? { id: 'cpo', provider: 'cli/claude' } : undefined;
        }),
        getRemoteProviderConfig: vi.fn(() => undefined),
      };

      vi.mocked(crewxSdk.Crewx.loadYaml)
        .mockResolvedValueOnce(callerCrewx as unknown as crewxSdk.Crewx)
        .mockResolvedValueOnce(targetCrewx as unknown as crewxSdk.Crewx);

      await handleExecute(['@remote_cpo', '작업']);

      // Caller crewx should have been closed during swap
      expect(callerClose).toHaveBeenCalledOnce();
      // Target crewx.execute should have been called with the target agent id
      expect(targetExecute).toHaveBeenCalledWith('@cpo', '작업', expect.any(Object));
      // Target crewx should have been closed after execution
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
        execute: vi.fn(),
        getAgent: vi.fn((ref: string) => {
          const id = ref.startsWith('@') ? ref.slice(1) : ref;
          return id === 'cpo' ? { id: 'cpo', provider: 'remote/another' } : undefined;
        }),
        getRemoteProviderConfig: vi.fn(() => undefined),
      };

      vi.mocked(crewxSdk.Crewx.loadYaml)
        .mockResolvedValueOnce(callerCrewx as unknown as crewxSdk.Crewx)
        .mockResolvedValueOnce(targetCrewx as unknown as crewxSdk.Crewx);

      await expect(handleExecute(['@remote_cpo', '작업'])).rejects.toThrow(
        /Chained remotes not allowed/,
      );
      // Target crewx should be closed on error
      expect(targetClose).toHaveBeenCalledOnce();
    });
  });
});
