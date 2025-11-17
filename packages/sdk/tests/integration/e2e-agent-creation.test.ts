/**
 * WBS-20 Phase 5 Integration Tests
 *
 * Focus:
 * - MastraAPIProvider + MastraToolAdapter end-to-end behaviour
 *   (7 providers, tool calling, CLI/Slack compatibility)
 * - Regression: YAML parsing → Agent factory integration (WBS-23 readiness)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  parseAPIProviderConfig,
  parseCrewXConfig,
  type RawAgentConfig,
  type RawYAMLConfig,
} from '../../src/config/api-provider-parser';
import { createCrewxAgent, resolveProvider } from '../../src/core/agent/agent-factory';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';
import { MastraToolAdapter } from '../../src/adapters/MastraToolAdapter';
import type {
  APIProviderConfig,
  FrameworkToolDefinition,
  ToolExecutionContext,
} from '../../src/types/api-provider.types';

// Shared mocks for Mastra integrations (Phase 5 tests)
const {
  agentInstances,
  agentGenerateSpy,
  AgentMock,
  openaiFactoryMock,
  anthropicFactoryMock,
  googleFactoryMock,
  openaiEnvSnapshots,
  anthropicEnvSnapshots,
} = vi.hoisted(() => {
  const instances: Array<Record<string, any>> = [];
  const generateSpy = vi.fn<
    (prompt: string, config: Record<string, any>) => Promise<any>
  >();

  const agentFactory = vi.fn((config: Record<string, any>) => {
    const instance = {
      ...config,
      generate: (prompt: string) => generateSpy(prompt, config),
    };
    instances.push(instance);
    return instance;
  });

  const openaiSnapshots: Array<{ apiKey?: string; baseUrl?: string }> = [];
  const anthropicSnapshots: Array<{ apiKey?: string; baseUrl?: string }> = [];

  const openaiMock = vi.fn((model: string) => {
    openaiSnapshots.push({
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
    });
    return {
      provider: 'openai',
      model,
    };
  });

  const anthropicMock = vi.fn((model: string) => {
    anthropicSnapshots.push({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: process.env.ANTHROPIC_BASE_URL,
    });
    return {
      provider: 'anthropic',
      model,
    };
  });

  const googleMock = vi.fn((model: string) => ({
    provider: 'google',
    model,
  }));

  return {
    agentInstances: instances,
    agentGenerateSpy: generateSpy,
    AgentMock: agentFactory,
    openaiFactoryMock: openaiMock,
    anthropicFactoryMock: anthropicMock,
    googleFactoryMock: googleMock,
    openaiEnvSnapshots: openaiSnapshots,
    anthropicEnvSnapshots: anthropicSnapshots,
  };
});

vi.mock('@mastra/core', () => ({
  Agent: AgentMock,
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: openaiFactoryMock,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: anthropicFactoryMock,
}));

vi.mock('@ai-sdk/google', () => ({
  google: googleFactoryMock,
}));

const resetMastraMocks = () => {
  agentInstances.length = 0;
  AgentMock.mockClear();
  agentGenerateSpy.mockReset();
  agentGenerateSpy.mockImplementation(async (prompt, config) => ({
    text: `[${config.name}] ${prompt}`,
    toolCalls: [],
  }));
  AgentMock.mockImplementation((config: Record<string, any>) => {
    const instance = {
      ...config,
      generate: (prompt: string) => agentGenerateSpy(prompt, config),
    };
    agentInstances.push(instance);
    return instance;
  });
  openaiFactoryMock.mockClear();
  anthropicFactoryMock.mockClear();
  googleFactoryMock.mockClear();
  openaiEnvSnapshots.length = 0;
  anthropicEnvSnapshots.length = 0;
};

const originalSowonApiKey = process.env.SOWONAI_API_KEY;

describe('WBS-20 Phase 5 - Mastra Integration', () => {
  const baseOpenAIConfig: APIProviderConfig = {
    provider: 'api/openai',
    model: 'gpt-4o-mini',
    apiKey: 'sk-test-openai',
    options: {
      query: {
        tools: ['weather', 'alpha', 'beta', 'context_probe', 'unstable'],
      },
      execute: {
        tools: ['weather', 'alpha', 'beta', 'context_probe', 'unstable'],
      },
    },
  };

  beforeEach(() => {
    resetMastraMocks();
    process.env.SOWONAI_API_KEY = 'sk-sowon-test';
  });

  afterAll(() => {
    if (originalSowonApiKey) {
      process.env.SOWONAI_API_KEY = originalSowonApiKey;
    } else {
      delete process.env.SOWONAI_API_KEY;
    }
  });

  describe('Provider instantiation coverage', () => {
    it.each([
      { provider: 'api/openai', model: 'gpt-4o', spy: openaiFactoryMock, apiKey: 'sk-openai', url: 'https://api.openai.com/v1' },
      { provider: 'api/anthropic', model: 'claude-3-5-sonnet', spy: anthropicFactoryMock, apiKey: 'sk-ant', url: 'https://api.anthropic.com' },
      { provider: 'api/google', model: 'gemini-1.5-pro', spy: googleFactoryMock, apiKey: 'sk-google' },
      { provider: 'api/bedrock', model: 'anthropic.claude-v2', spy: anthropicFactoryMock, apiKey: 'aws-bedrock', url: 'https://bedrock-runtime.us-east-1.amazonaws.com' },
      { provider: 'api/litellm', model: 'gpt-4o-mini', spy: openaiFactoryMock, apiKey: 'gateway-key', url: 'http://localhost:4000' },
      { provider: 'api/ollama', model: 'llama3', spy: openaiFactoryMock, url: 'http://localhost:11434/v1' },
      { provider: 'api/sowonai', model: 'crew-v1', spy: openaiFactoryMock, url: 'https://api.sowon.ai/v1' },
    ])('instantiates %s providers through MastraAPIProvider', ({ provider, model, spy, apiKey, url }) => {
      const config: APIProviderConfig = {
        provider: provider as APIProviderConfig['provider'],
        model,
      };
      if (apiKey) config.apiKey = apiKey;
      if (url) config.url = url;

      const instance = new MastraAPIProvider(config);

      expect(instance).toBeInstanceOf(MastraAPIProvider);
      expect(instance.name).toBe(provider);
      expect(spy).toHaveBeenCalledWith(model);
    });

    it('resolves MastraAPIProvider via agent factory for every API provider config', async () => {
      const configs: APIProviderConfig[] = [
        { provider: 'api/openai', model: 'gpt-4o', apiKey: 'sk-openai' },
        { provider: 'api/anthropic', model: 'claude-3-5-sonnet', apiKey: 'sk-ant' },
        { provider: 'api/google', model: 'gemini-1.5-pro', apiKey: 'sk-google' },
        { provider: 'api/bedrock', model: 'anthropic.claude-v2', apiKey: 'aws-bedrock' },
        { provider: 'api/litellm', model: 'gpt-4o-mini', url: 'http://localhost:4000', apiKey: 'gateway-key' },
        { provider: 'api/ollama', model: 'llama3' },
        { provider: 'api/sowonai', model: 'crew-v1', apiKey: 'sowon-key' },
      ];

      for (const cfg of configs) {
        const { provider } = await resolveProvider(cfg);
        expect(provider).toBeInstanceOf(MastraAPIProvider);
      }
    });

    it('applies provider defaults for LiteLLM and Ollama without polluting env state', () => {
      const originalOpenAIKey = process.env.OPENAI_API_KEY;
      const originalOpenAIBase = process.env.OPENAI_BASE_URL;

      try {
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;

        new MastraAPIProvider({
          provider: 'api/litellm',
          model: 'gpt-4o-mini',
        });
        new MastraAPIProvider({
          provider: 'api/ollama',
          model: 'llama3',
        });

        expect(openaiEnvSnapshots).toEqual([
          { apiKey: 'dummy', baseUrl: 'http://localhost:4000' },
          { apiKey: 'ollama', baseUrl: 'http://localhost:11434/v1' },
        ]);
      } finally {
        if (originalOpenAIKey !== undefined) {
          process.env.OPENAI_API_KEY = originalOpenAIKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }

        if (originalOpenAIBase !== undefined) {
          process.env.OPENAI_BASE_URL = originalOpenAIBase;
        } else {
          delete process.env.OPENAI_BASE_URL;
        }
      }
    });

    it('falls back to SOWONAI_API_KEY env var when config omits apiKey', () => {
      const originalOpenAIKey = process.env.OPENAI_API_KEY;
      const originalOpenAIBase = process.env.OPENAI_BASE_URL;
      const originalSowonKey = process.env.SOWONAI_API_KEY;

      try {
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;
        process.env.SOWONAI_API_KEY = 'sk-sowon-env-fallback';

        new MastraAPIProvider({
          provider: 'api/sowonai',
          model: 'crew-v1',
        });

        expect(openaiEnvSnapshots).toEqual([
          {
            apiKey: 'sk-sowon-env-fallback',
            baseUrl: 'https://api.sowon.ai/v1',
          },
        ]);
      } finally {
        if (originalOpenAIKey !== undefined) {
          process.env.OPENAI_API_KEY = originalOpenAIKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }

        if (originalOpenAIBase !== undefined) {
          process.env.OPENAI_BASE_URL = originalOpenAIBase;
        } else {
          delete process.env.OPENAI_BASE_URL;
        }

        if (originalSowonKey !== undefined) {
          process.env.SOWONAI_API_KEY = originalSowonKey;
        } else {
          delete process.env.SOWONAI_API_KEY;
        }
      }
    });

    it('normalizes Bedrock provider credentials through Anthropic shim', () => {
      const originalAntKey = process.env.ANTHROPIC_API_KEY;
      const originalAntBase = process.env.ANTHROPIC_BASE_URL;

      try {
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.ANTHROPIC_BASE_URL;

        new MastraAPIProvider({
          provider: 'api/bedrock',
          model: 'anthropic.claude-v2',
          apiKey: 'aws-bedrock-key',
        });

        expect(anthropicEnvSnapshots).toEqual([
          {
            apiKey: 'aws-bedrock-key',
            baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
          },
        ]);
      } finally {
        if (originalAntKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalAntKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }

        if (originalAntBase !== undefined) {
          process.env.ANTHROPIC_BASE_URL = originalAntBase;
        } else {
          delete process.env.ANTHROPIC_BASE_URL;
        }
      }
    });
  });

  describe('Tool calling via MastraToolAdapter', () => {
    it('executes MastraToolAdapter tools and surfaces tool call metadata', async () => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);
      const toolExecute = vi.fn(async (args: { location: string }, context: ToolExecutionContext) => ({
        summary: `Weather for ${args.location}`,
        platform: context.platform,
      }));

      const weatherTool: FrameworkToolDefinition = {
        name: 'weather',
        description: 'Look up current weather',
        parameters: z.object({ location: z.string() }),
        execute: toolExecute,
      };

      const context: ToolExecutionContext = {
        ...MastraToolAdapter.createMinimalContext('agent.researcher', 'api/openai', 'gpt-4o-mini'),
        vars: { locale: 'APAC' },
        platform: 'cli',
        mode: 'query',
      };

      provider.setTools([weatherTool], context);

      agentGenerateSpy.mockImplementationOnce(async (prompt, agentConfig) => {
        const toolResult = await agentConfig.tools.weather.execute({ location: 'Seoul' });
        return {
          text: `${prompt} :: ${toolResult.summary}`,
          toolCalls: [
            {
              name: 'weather',
              input: { location: 'Seoul' },
              result: toolResult,
            },
          ],
        };
      });

      const response = await provider.query('Need forecast', { taskId: 'task-weather' });

      expect(response.success).toBe(true);
      expect(response.toolCall?.toolName).toBe('weather');
      expect(response.toolCall?.toolResult).toEqual({ summary: 'Weather for Seoul', platform: 'cli' });
      expect(toolExecute).toHaveBeenCalledWith(
        { location: 'Seoul' },
        expect.objectContaining({ platform: 'cli', vars: { locale: 'APAC' } })
      );
    });

    it('supports multiple tools with independent context injection', async () => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);
      const callOrder: string[] = [];

      const context: ToolExecutionContext = {
        ...MastraToolAdapter.createMinimalContext('agent.multi', 'api/openai', 'gpt-4o-mini'),
        platform: 'slack',
        mode: 'query',
        vars: { thread: 'multi-thread' },
      };

      const alphaTool: FrameworkToolDefinition = {
        name: 'alpha',
        description: 'Alpha test tool',
        parameters: z.object({ value: z.number() }),
        execute: async (args: { value: number }, injectedContext: ToolExecutionContext) => {
          callOrder.push(`alpha:${injectedContext.platform}:${args.value}`);
          return {
            channel: injectedContext.platform,
            value: args.value,
            vars: injectedContext.vars,
          };
        },
      };

      const betaTool: FrameworkToolDefinition = {
        name: 'beta',
        description: 'Beta test tool',
        parameters: z.object({ value: z.number() }),
        execute: async (args: { value: number }, injectedContext: ToolExecutionContext) => {
          callOrder.push(`beta:${injectedContext.platform}:${args.value}`);
          return {
            channel: injectedContext.platform,
            value: args.value,
          };
        },
      };

      provider.setTools([alphaTool, betaTool], context);

      agentGenerateSpy.mockImplementationOnce(async (_prompt, agentConfig) => {
        const alphaResult = await agentConfig.tools.alpha.execute({ value: 1 });
        const betaResult = await agentConfig.tools.beta.execute({ value: 2 });
        return {
          text: `alpha=${alphaResult.value}, beta=${betaResult.value}`,
          toolCalls: [
            { name: 'alpha', input: { value: 1 }, result: alphaResult },
            { name: 'beta', input: { value: 2 }, result: betaResult },
          ],
        };
      });

      const response = await provider.query('Use all tools');

      expect(callOrder).toEqual(['alpha:slack:1', 'beta:slack:2']);
      expect(response.success).toBe(true);
      expect(response.toolCall?.toolName).toBe('alpha');
      expect(response.toolCall?.toolResult).toEqual({
        channel: 'slack',
        value: 1,
        vars: { thread: 'multi-thread' },
      });
    });
  });

  describe('Interface compatibility (CLI & Slack)', () => {
    it.each([
      { platform: 'cli', mode: 'execute' as const },
      { platform: 'slack', mode: 'query' as const },
    ])('propagates %s context into MastraToolAdapter', async ({ platform, mode }) => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);
      const executeSpy = vi.fn(async () => `${platform}:${mode}`);

      const probeTool: FrameworkToolDefinition = {
        name: 'context_probe',
        description: 'Ensures correct platform/mode reach the tool layer',
        parameters: z.object({ target: z.string() }),
        execute: executeSpy,
      };

      const context: ToolExecutionContext = {
        ...MastraToolAdapter.createMinimalContext('agent.ctx', 'api/openai', 'gpt-4o-mini'),
        platform,
        mode,
        vars: { thread: 'demo' },
      };

      provider.setTools([probeTool], context);

      agentGenerateSpy.mockImplementationOnce(async (_prompt, agentConfig) => {
        await agentConfig.tools.context_probe.execute({ target: 'context' });
        return { text: `ok:${platform}`, toolCalls: [] };
      });

      const result = await provider.query('Check context');

      expect(result.success).toBe(true);
      expect(executeSpy).toHaveBeenCalledWith(
        { target: 'context' },
        expect.objectContaining({ platform, mode, vars: { thread: 'demo' } })
      );
    });

    it('treats execute mode as alias of query for CLI compatibility', async () => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);
      const querySpy = vi
        .spyOn(provider, 'query')
        .mockResolvedValue({ success: true, content: 'ok' } as any);

      await provider.execute('Write spec', { taskId: 'exec-1' });

      expect(querySpy).toHaveBeenCalledWith('Write spec', { taskId: 'exec-1' });

      querySpy.mockRestore();
    });

    it('emits consistent response metadata for CLI and Slack consumers', async () => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);

      const cliResponse = await provider.query('CLI prompt', { taskId: 'cli-task' });
      const slackResponse = await provider.query('Slack prompt', { taskId: 'slack-task' });

      [cliResponse, slackResponse].forEach((response) => {
        expect(response.success).toBe(true);
        expect(response.command).toBe('api/openai (Mastra)');
        expect(response.provider).toBe('api/openai');
      });
      expect(cliResponse.taskId).toBe('cli-task');
      expect(slackResponse.taskId).toBe('slack-task');
    });
  });

  describe('Error handling and availability', () => {
    it('converts tool execution failures into readable provider errors', async () => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);
      const failingTool: FrameworkToolDefinition = {
        name: 'unstable',
        description: 'Always throws',
        parameters: z.object({}),
        execute: vi.fn(async () => {
          throw new Error('Network down');
        }),
      };

      provider.setTools(
        [failingTool],
        {
          ...MastraToolAdapter.createMinimalContext('agent.error', 'api/openai', 'gpt-4o-mini'),
          platform: 'cli',
        }
      );

      agentGenerateSpy.mockImplementationOnce(async (_prompt, agentConfig) => {
        await agentConfig.tools.unstable.execute({});
        return { text: 'should not reach', toolCalls: [] };
      });

      const response = await provider.query('Trigger tool error');

      expect(response.success).toBe(false);
      expect(response.error).toContain("Tool 'unstable' execution failed: Network down");
    });

    it('returns failure responses when Mastra agent throws', async () => {
      const provider = new MastraAPIProvider(baseOpenAIConfig);
      agentGenerateSpy.mockImplementationOnce(async () => {
        throw new Error('rate limited');
      });

      const response = await provider.query('Should fail');

      expect(response.success).toBe(false);
      expect(response.error).toBe('rate limited');
    });

    it('rejects unsupported provider types early', () => {
      expect(
        () =>
          new MastraAPIProvider({
            provider: 'api/unsupported' as APIProviderConfig['provider'],
            model: 'test-model',
          })
      ).toThrow('Unsupported provider: api/unsupported');
    });

    it('reports availability based on API key requirements', async () => {
      const originalOpenAIKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const providerWithoutKey = new MastraAPIProvider({
        provider: 'api/openai',
        model: 'gpt-4o',
      });

      expect(await providerWithoutKey.isAvailable()).toBe(false);

      process.env.OPENAI_API_KEY = 'sk-env-openai';
      expect(await providerWithoutKey.isAvailable()).toBe(true);

      if (originalOpenAIKey) {
        process.env.OPENAI_API_KEY = originalOpenAIKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }

      const ollamaProvider = new MastraAPIProvider({
        provider: 'api/ollama',
        model: 'llama3',
      });

      expect(await ollamaProvider.isAvailable()).toBe(true);
    });
  });
});

describe('E2E: YAML to Agent Creation', () => {
  let mockEnv: Record<string, string>;

  beforeEach(() => {
    mockEnv = {
      OPENAI_API_KEY: 'sk-test-openai-key',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
      GOOGLE_API_KEY: 'google-test-key',
      GITHUB_TOKEN: 'ghp-test-token',
    };
  });

  describe('Complete Flow: YAML → Parser → Factory → Agent', () => {
    it('should parse YAML and create OpenAI agent', async () => {
      // Step 1: Raw YAML config (as if loaded from crewx.yaml)
      const rawConfig: RawAgentConfig = {
        id: 'researcher',
        name: 'Research Agent',
        provider: 'api/openai',
        model: 'gpt-4o',
        apiKey: '{{env.OPENAI_API_KEY}}',
        temperature: 0.7,
        tools: ['github', 'slack'],
      };

      // Step 2: Parse YAML to APIProviderConfig
      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(parsedConfig.provider).toBe('api/openai');
      expect(parsedConfig.model).toBe('gpt-4o');
      expect(parsedConfig.apiKey).toBe('sk-test-openai-key');
      expect(parsedConfig.temperature).toBe(0.7);
      expect(parsedConfig.tools).toEqual(['github', 'slack']);

      // Step 3: Create agent from parsed config
      const { agent } = await createCrewxAgent({
        provider: parsedConfig,
      });

      // Step 4: Verify agent interface
      expect(agent).toBeDefined();
      expect(agent.query).toBeDefined();
      expect(agent.execute).toBeDefined();
      expect(typeof agent.query).toBe('function');
      expect(typeof agent.execute).toBe('function');
    });

    it('should parse YAML and create Anthropic agent', async () => {
      const rawConfig: RawAgentConfig = {
        id: 'analyst',
        provider: 'api/anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: '{{env.ANTHROPIC_API_KEY}}',
        maxTokens: 4096,
      };

      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);
      const { agent } = await createCrewxAgent({ provider: parsedConfig });

      expect(agent).toBeDefined();
      expect(parsedConfig.provider).toBe('api/anthropic');
      expect(parsedConfig.apiKey).toBe('sk-ant-test-key');
    });

    it('should parse YAML and create Google agent', async () => {
      const rawConfig: RawAgentConfig = {
        id: 'optimizer',
        provider: 'api/google',
        model: 'gemini-1.5-pro',
        apiKey: '{{env.GOOGLE_API_KEY}}',
        temperature: 0.5,
      };

      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);
      const { agent } = await createCrewxAgent({ provider: parsedConfig });

      expect(agent).toBeDefined();
      expect(parsedConfig.provider).toBe('api/google');
      expect(parsedConfig.apiKey).toBe('google-test-key');
    });

    it('should handle inline provider configuration', async () => {
      const rawConfig: RawAgentConfig = {
        id: 'custom',
        inline: {
          provider: 'api/openai',
          model: 'gpt-4',
          apiKey: '{{env.OPENAI_API_KEY}}',
          temperature: 0.9,
          maxTokens: 2048,
        },
      };

      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);
      const { agent } = await createCrewxAgent({ provider: parsedConfig });

      expect(agent).toBeDefined();
      expect(parsedConfig.provider).toBe('api/openai');
      expect(parsedConfig.temperature).toBe(0.9);
      expect(parsedConfig.maxTokens).toBe(2048);
    });
  });

  describe('Complete CrewX Config: vars + mcp_servers + agents', () => {
    it('should parse complete YAML and create multiple agents', async () => {
      // Simulate complete crewx.yaml file
      const fullConfig: RawYAMLConfig = {
        vars: {
          company_name: 'Acme Corp',
          api_version: 'v1',
        },
        mcp_servers: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}',
            },
          },
        },
        agents: [
          {
            id: 'researcher',
            provider: 'api/openai',
            model: 'gpt-4o',
            apiKey: '{{env.OPENAI_API_KEY}}',
            tools: ['github'],
            mcp: ['github'],
          },
          {
            id: 'analyst',
            provider: 'api/anthropic',
            model: 'claude-3-5-sonnet-20241022',
            apiKey: '{{env.ANTHROPIC_API_KEY}}',
            temperature: 0.7,
          },
          {
            id: 'optimizer',
            provider: 'api/google',
            model: 'gemini-1.5-pro',
            apiKey: '{{env.GOOGLE_API_KEY}}',
          },
        ],
      };

      // Parse complete config
      const parsed = parseCrewXConfig(fullConfig, mockEnv);

      // Verify vars
      expect(parsed.vars).toEqual({
        company_name: 'Acme Corp',
        api_version: 'v1',
      });

      // Verify MCP servers
      expect(parsed.mcpServers.github).toBeDefined();
      expect(parsed.mcpServers.github.command).toBe('npx');
      expect(parsed.mcpServers.github.env?.GITHUB_TOKEN).toBe('ghp-test-token');

      // Verify agents parsed
      expect(parsed.agents).toHaveLength(3);
      expect(parsed.agents[0].provider).toBe('api/openai');
      expect(parsed.agents[1].provider).toBe('api/anthropic');
      expect(parsed.agents[2].provider).toBe('api/google');

      // Create agents from parsed config
      const agents = [];
      for (const agentConfig of parsed.agents) {
        const { agent } = await createCrewxAgent({ provider: agentConfig });
        agents.push(agent);
      }

      expect(agents).toHaveLength(3);
      agents.forEach((agent) => {
        expect(agent.query).toBeDefined();
        expect(agent.execute).toBeDefined();
      });
    });

    it('should skip CLI providers during API provider parsing', async () => {
      const mixedConfig: RawYAMLConfig = {
        agents: [
          {
            id: 'cli_agent',
            provider: 'cli/claude',
            model: 'sonnet',
          },
          {
            id: 'api_agent',
            provider: 'api/openai',
            model: 'gpt-4',
            apiKey: '{{env.OPENAI_API_KEY}}',
          },
        ],
      };

      const parsed = parseCrewXConfig(mixedConfig, mockEnv);

      // Only API provider should be parsed
      expect(parsed.agents).toHaveLength(1);
      expect(parsed.agents[0].provider).toBe('api/openai');

      // Create agent from parsed API config
      const { agent } = await createCrewxAgent({ provider: parsed.agents[0] });
      expect(agent).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle research agent with tools and MCP', async () => {
      const rawConfig: RawAgentConfig = {
        id: 'research_assistant',
        name: 'Research Assistant',
        provider: 'api/openai',
        model: 'gpt-4o',
        apiKey: '{{env.OPENAI_API_KEY}}',
        temperature: 0.7,
        maxTokens: 8192,
        tools: ['company_search', 'web_search', 'document_reader'],
        mcp: ['github', 'filesystem'],
      };

      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);
      const { agent, eventBus } = await createCrewxAgent({
        provider: parsedConfig,
        enableCallStack: true,
      });

      expect(agent).toBeDefined();
      expect(agent.getCallStack).toBeDefined();
      expect(eventBus).toBeDefined();
      expect(parsedConfig.tools).toEqual(['company_search', 'web_search', 'document_reader']);
      expect(parsedConfig.mcp).toEqual(['github', 'filesystem']);
    });

    it('should handle multi-agent configuration', async () => {
      const agents = [
        {
          id: 'researcher',
          provider: 'api/openai',
          model: 'gpt-4o',
          apiKey: '{{env.OPENAI_API_KEY}}',
        },
        {
          id: 'analyst',
          provider: 'api/anthropic',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: '{{env.ANTHROPIC_API_KEY}}',
        },
        {
          id: 'coder',
          provider: 'api/google',
          model: 'gemini-1.5-pro',
          apiKey: '{{env.GOOGLE_API_KEY}}',
        },
      ];

      const createdAgents = [];
      for (const rawAgent of agents) {
        const parsedConfig = parseAPIProviderConfig(rawAgent, mockEnv);
        const { agent } = await createCrewxAgent({ provider: parsedConfig });
        createdAgents.push({ id: rawAgent.id, agent });
      }

      expect(createdAgents).toHaveLength(3);
      expect(createdAgents[0].id).toBe('researcher');
      expect(createdAgents[1].id).toBe('analyst');
      expect(createdAgents[2].id).toBe('coder');

      createdAgents.forEach(({ agent }) => {
        expect(agent.query).toBeDefined();
        expect(agent.execute).toBeDefined();
      });
    });

    it('should handle LiteLLM gateway configuration', async () => {
      const rawConfig: RawAgentConfig = {
        id: 'litellm_agent',
        provider: 'api/litellm',
        url: 'http://localhost:4000',
        model: 'gpt-4',
        apiKey: 'test-key',
      };

      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);
      const { agent } = await createCrewxAgent({ provider: parsedConfig });

      expect(agent).toBeDefined();
      expect(parsedConfig.provider).toBe('api/litellm');
      expect(parsedConfig.url).toBe('http://localhost:4000');
    });

    it('should handle Ollama local configuration', async () => {
      const rawConfig: RawAgentConfig = {
        id: 'ollama_agent',
        provider: 'api/ollama',
        model: 'llama2',
      };

      const parsedConfig = parseAPIProviderConfig(rawConfig, mockEnv);
      const { agent } = await createCrewxAgent({ provider: parsedConfig });

      expect(agent).toBeDefined();
      expect(parsedConfig.provider).toBe('api/ollama');
      expect(parsedConfig.model).toBe('llama2');
    });
  });

  describe('Error Propagation', () => {
    it('should propagate parser errors to agent creation', async () => {
      const invalidConfig: RawAgentConfig = {
        provider: 'api/openai',
        // Missing model field
      };

      expect(() => {
        parseAPIProviderConfig(invalidConfig, mockEnv);
      }).toThrow('Model is required');
    });

    it('should propagate validation errors', async () => {
      const invalidConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        temperature: 5.0, // Invalid: > 2
      };

      expect(() => {
        parseAPIProviderConfig(invalidConfig, mockEnv);
      }).toThrow('Temperature must be a number between 0 and 2');
    });

    it('should handle missing environment variables', async () => {
      const configWithMissingEnv: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        apiKey: '{{env.MISSING_KEY}}',
      };

      expect(() => {
        parseAPIProviderConfig(configWithMissingEnv, mockEnv);
      }).toThrow("Environment variable 'MISSING_KEY' is not defined");
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety through the pipeline', async () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        apiKey: '{{env.OPENAI_API_KEY}}',
        temperature: 0.7,
        maxTokens: 4096,
      };

      // Parse should return APIProviderConfig
      const parsed: APIProviderConfig = parseAPIProviderConfig(rawConfig, mockEnv);

      // Type checks
      expect(parsed.provider).toBe('api/openai');
      expect(typeof parsed.model).toBe('string');
      expect(typeof parsed.temperature).toBe('number');
      expect(typeof parsed.maxTokens).toBe('number');

      // Agent creation should accept APIProviderConfig
      const { agent } = await createCrewxAgent({
        provider: parsed, // Type-safe: APIProviderConfig
      });

      expect(agent).toBeDefined();
    });

    it('should support all 7 API provider types', async () => {
      const providers: Array<{ provider: any; model: string }> = [
        { provider: 'api/openai', model: 'gpt-4' },
        { provider: 'api/anthropic', model: 'claude-3-5-sonnet-20241022' },
        { provider: 'api/google', model: 'gemini-1.5-pro' },
        { provider: 'api/bedrock', model: 'anthropic.claude-v2' },
        { provider: 'api/litellm', model: 'gpt-4' },
        { provider: 'api/ollama', model: 'llama2' },
        { provider: 'api/sowonai', model: 'custom-model' },
      ];

      for (const config of providers) {
        const parsedConfig = parseAPIProviderConfig(config, mockEnv);
        const { agent } = await createCrewxAgent({ provider: parsedConfig });

        expect(agent).toBeDefined();
        expect(parsedConfig.provider).toBe(config.provider);
      }
    });
  });
});
