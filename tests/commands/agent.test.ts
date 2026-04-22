import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as bootstrapCrewx from '../../src/bootstrap/crewx-cli';
import type { AgentConfig } from '@crewx/sdk';

// Sample agent configs for tests
const pm: AgentConfig = {
  id: 'crewx_pm',
  name: 'CrewX PM',
  role: 'PM',
  team: 'CrewX',
  provider: 'cli/claude',
  description: 'Product Manager',
  inline: { model: 'claude-opus-4-6', prompt: 'You are a PM.' },
};
const dev: AgentConfig = {
  id: 'core_dev',
  name: 'Core Dev',
  role: 'Dev',
  team: 'CrewX Core 개발팀',
  provider: ['cli/claude', 'cli/gemini'],
  description: 'Senior Developer',
  inline: { system_prompt: 'You are a senior dev.' },
};
const gen: AgentConfig = {
  id: 'claude',
  name: 'Claude',
  role: 'general',
  team: 'External',
  provider: 'cli/claude',
  description: 'General AI',
};

const mockAgents = new Map<string, AgentConfig>([
  ['crewx_pm', pm],
  ['core_dev', dev],
  ['claude', gen],
]);

const mockFilterAgents = vi.fn();
const mockRenderAgentPrompt = vi.fn();
const mockRenderAgentPromptFull = vi.fn();

const mockCrewx = {
  agents: mockAgents,
  filterAgents: mockFilterAgents,
  renderAgentPrompt: mockRenderAgentPrompt,
  renderAgentPromptFull: mockRenderAgentPromptFull,
};

vi.mock('../../src/bootstrap/crewx-cli', () => ({
  createCliCrewx: vi.fn(),
}));

describe('commands/agent', () => {
  let handleAgent: (args: string[]) => Promise<void>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(bootstrapCrewx.createCliCrewx).mockResolvedValue(mockCrewx as any);

    // Default: filterAgents returns all
    mockFilterAgents.mockImplementation(
      (filters: { role?: string; team?: string; provider?: string }) => {
        let result = Array.from(mockAgents.values());
        if (filters.role) {
          result = result.filter(a => a.role?.toLowerCase() === filters.role!.toLowerCase());
        }
        if (filters.team) {
          result = result.filter(a => a.team?.toLowerCase().includes(filters.team!.toLowerCase()));
        }
        return result;
      },
    );

    mockRenderAgentPrompt.mockImplementation((agentId: string) => {
      const id = agentId.startsWith('@') ? agentId.slice(1) : agentId;
      const agent = mockAgents.get(id);
      if (!agent) throw new Error(`Agent '${id}' not found`);
      return agent.inline?.prompt ?? agent.inline?.system_prompt ?? agent.description ?? '';
    });

    mockRenderAgentPromptFull.mockImplementation(async (agentId: string) => {
      const id = agentId.startsWith('@') ? agentId.slice(1) : agentId;
      const agent = mockAgents.get(id);
      if (!agent) throw new Error(`Agent '${id}' not found`);
      return agent.inline?.prompt ?? agent.inline?.system_prompt ?? agent.description ?? '';
    });

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    originalEnv = { ...process.env };
    process.env.CREWX_CONFIG = '/fake/crewx.yaml';

    // Always import fresh module
    const mod = await import('../../src/commands/agent?t=' + Date.now());
    handleAgent = mod.handleAgent;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ── agent ls ─────────────────────────────────────────────────────────────

  describe('agent ls (no subcommand → default ls)', () => {
    it('lists all agents when no args given', async () => {
      await handleAgent([]);
      expect(mockFilterAgents).toHaveBeenCalledWith({ role: undefined, team: undefined, provider: undefined });
      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('@crewx_pm');
      expect(output).toContain('@core_dev');
    });

    it('lists all agents for "ls" subcommand', async () => {
      await handleAgent(['ls']);
      expect(mockFilterAgents).toHaveBeenCalled();
    });

    it('lists all agents for "list" alias', async () => {
      await handleAgent(['list']);
      expect(mockFilterAgents).toHaveBeenCalled();
    });
  });

  describe('agent ls --role filter', () => {
    it('passes role filter to filterAgents', async () => {
      await handleAgent(['ls', '--role=PM']);
      expect(mockFilterAgents).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'PM' }),
      );
    });

    it('supports --role with space separator', async () => {
      await handleAgent(['ls', '--role', 'Dev']);
      expect(mockFilterAgents).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Dev' }),
      );
    });
  });

  describe('agent ls --team filter', () => {
    it('passes team filter to filterAgents', async () => {
      await handleAgent(['ls', '--team=CrewX']);
      expect(mockFilterAgents).toHaveBeenCalledWith(
        expect.objectContaining({ team: 'CrewX' }),
      );
    });

    it('passes comma-separated team values for OR matching', async () => {
      await handleAgent(['ls', '--team=CrewX,External']);
      expect(mockFilterAgents).toHaveBeenCalledWith(
        expect.objectContaining({ team: 'CrewX,External' }),
      );
    });
  });

  describe('agent ls --provider filter', () => {
    it('passes provider filter to filterAgents', async () => {
      await handleAgent(['ls', '--provider=cli/claude']);
      expect(mockFilterAgents).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'cli/claude' }),
      );
    });

    it('passes comma-separated provider values for OR matching', async () => {
      await handleAgent(['ls', '--provider=cli/claude,cli/gemini']);
      expect(mockFilterAgents).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'cli/claude,cli/gemini' }),
      );
    });
  });

  // ── agent prompt ──────────────────────────────────────────────────────────

  describe('agent prompt', () => {
    it('renders system prompt for @crewx_pm via renderAgentPromptFull', async () => {
      await handleAgent(['prompt', '@crewx_pm']);
      expect(mockRenderAgentPromptFull).toHaveBeenCalledWith(
        '@crewx_pm',
        expect.objectContaining({ env: expect.any(Object) }),
      );
      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('You are a PM.');
    });

    it('renders system prompt without @ prefix', async () => {
      await handleAgent(['prompt', 'core_dev']);
      expect(mockRenderAgentPromptFull).toHaveBeenCalledWith(
        'core_dev',
        expect.objectContaining({ env: expect.any(Object) }),
      );
    });

    it('exits with error when agent id is missing', async () => {
      await expect(handleAgent(['prompt'])).rejects.toThrow('process.exit');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('exits with error for unknown agent', async () => {
      mockRenderAgentPromptFull.mockImplementationOnce(async () => {
        throw new Error("Agent 'unknown' not found");
      });
      await expect(handleAgent(['prompt', 'unknown'])).rejects.toThrow('process.exit');
    });
  });

  // ── unknown subcommand ────────────────────────────────────────────────────

  describe('unknown subcommand', () => {
    it('exits with error for unknown subcommand', async () => {
      await expect(handleAgent(['delete'])).rejects.toThrow('process.exit');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
