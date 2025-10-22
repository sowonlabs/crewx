import { describe, expect, it, vi } from 'vitest';

import { AgentLoaderService } from '../../../src/services/agent-loader.service';

describe('AgentLoaderService - skills merging', () => {
  it('merges project and agent skills configuration with overrides', async () => {
    const documentLoader = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    const configValidator = {
      validateConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      formatErrorMessage: vi.fn(),
    };

    const layoutLoader = {
      registerLayouts: vi.fn().mockResolvedValue(undefined),
    };

    const configService = {
      getProjectConfig: vi.fn().mockReturnValue({
        skills: {
          include: ['formatter'],
          exclude: ['legacy-skill'],
          autoload: true,
        },
        agents: [
          {
            id: 'code-agent',
            name: 'Code Agent',
            provider: 'cli/claude',
            role: 'Engineer',
            working_directory: '.',
            skills: {
              include: ['git-helper'],
              exclude: ['legacy-skill'],
              autoload: false,
            },
            inline: {
              type: 'agent',
              system_prompt: 'You are a code agent.',
            },
            options: {},
          },
        ],
      }),
    };

    const service = new AgentLoaderService(
      documentLoader as any,
      undefined,
      configValidator as any,
      undefined,
      configService as any,
      layoutLoader as any,
    );

    const agents = await service.loadAgentsFromConfig('/tmp/crewx.yaml');

    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      id: 'code-agent',
      skills: {
        include: ['formatter', 'git-helper'],
        exclude: ['legacy-skill'],
        autoload: false,
      },
    });

    expect(documentLoader.initialize).toHaveBeenCalled();
  });
});
