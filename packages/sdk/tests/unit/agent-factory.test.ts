/**
 * Unit tests for Agent Factory
 *
 * Tests createCrewxAgent with various provider configurations,
 * including APIProviderConfig routing and type guards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCrewxAgent } from '../../src/core/agent/agent-factory';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';
import { MockProvider } from '../../src/core/providers/mock.provider';
import type { APIProviderConfig } from '../../src/types/api-provider.types';
import type { ProviderConfig } from '../../src/types/provider.types';

// Mock MastraAPIProvider
vi.mock('../../src/core/providers/MastraAPIProvider', () => ({
  MastraAPIProvider: vi.fn().mockImplementation((config) => ({
    query: vi.fn().mockResolvedValue({
      success: true,
      content: `Mocked response from ${config.provider}`,
    }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      content: 'Mocked execute response',
    }),
    config,
  })),
}));

// Mock provider-factory (for CLI providers)
vi.mock('../../src/core/providers/provider-factory', () => ({
  createProviderFromConfig: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({
      success: true,
      content: 'Mocked CLI provider response',
    }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      content: 'Mocked CLI execute response',
    }),
  }),
}));

describe('Agent Factory - createCrewxAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Resolution', () => {
    it('should use MockProvider when no config provided', async () => {
      const result = await createCrewxAgent({});

      expect(result.agent).toBeDefined();
      expect(result.agent.query).toBeDefined();
      expect(result.agent.execute).toBeDefined();
    });

    it('should accept direct AIProvider instance', async () => {
      const customProvider = {
        query: vi.fn().mockResolvedValue({ success: true, content: 'custom' }),
        execute: vi.fn().mockResolvedValue({ success: true, content: 'custom' }),
      };

      const result = await createCrewxAgent({
        provider: customProvider,
      });

      expect(result.agent).toBeDefined();
      await result.agent.query({ prompt: 'test' });
      expect(customProvider.query).toHaveBeenCalled();
    });

    it('should route APIProviderConfig to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        apiKey: 'sk-test',
        temperature: 0.7,
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
      expect(result.agent).toBeDefined();
    });

    it('should route api/anthropic to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'sk-ant-test',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
    });

    it('should route api/google to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/google',
        model: 'gemini-1.5-pro',
        apiKey: 'google-key',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
    });

    it('should route api/litellm to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/litellm',
        model: 'gpt-4',
        url: 'http://localhost:4000',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
    });

    it('should route api/ollama to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/ollama',
        model: 'llama2',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
    });

    it('should route api/bedrock to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/bedrock',
        model: 'anthropic.claude-v2',
        url: 'https://bedrock-runtime.us-east-1.amazonaws.com',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
    });

    it('should route api/sowonai to MastraAPIProvider', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/sowonai',
        model: 'custom-model',
        url: 'https://api.sowonai.com/v1',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(apiConfig);
    });

    it('should handle ProviderConfig (namespace/id) format', async () => {
      const { createProviderFromConfig } = await import('../../src/core/providers/provider-factory');

      const cliConfig: ProviderConfig = {
        namespace: 'cli',
        id: 'claude',
        model: 'sonnet',
      };

      const result = await createCrewxAgent({
        provider: cliConfig,
      });

      expect(createProviderFromConfig).toHaveBeenCalledWith(cliConfig);
      expect(result.agent).toBeDefined();
    });
  });

  describe('Agent Interface', () => {
    it('should provide query method', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(result.agent.query).toBeDefined();
      expect(typeof result.agent.query).toBe('function');
    });

    it('should provide execute method', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(result.agent.execute).toBeDefined();
      expect(typeof result.agent.execute).toBe('function');
    });

    it('should provide getCallStack method when enabled', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
        enableCallStack: true,
      });

      expect(result.agent.getCallStack).toBeDefined();
      expect(typeof result.agent.getCallStack).toBe('function');
    });

    it('should provide event subscription', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
      });

      expect(result.onEvent).toBeDefined();
      expect(typeof result.onEvent).toBe('function');
      expect(result.eventBus).toBeDefined();
    });
  });

  describe('Configuration Handling', () => {
    it('should handle complete APIProviderConfig', async () => {
      const fullConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4o',
        url: 'https://custom.openai.com/v1',
        apiKey: 'sk-custom-key',
        temperature: 0.9,
        maxTokens: 4096,
        tools: ['github', 'slack'],
        mcp: ['filesystem', 'github'],
      };

      const result = await createCrewxAgent({
        provider: fullConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(fullConfig);
      expect(result.agent).toBeDefined();
    });

    it('should handle minimal APIProviderConfig', async () => {
      const minimalConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: minimalConfig,
      });

      expect(MastraAPIProvider).toHaveBeenCalledWith(minimalConfig);
    });

    it('should handle enableCallStack option', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
        enableCallStack: true,
      });

      expect(result.agent.getCallStack).toBeDefined();
    });

    it('should handle defaultAgentId option', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
        defaultAgentId: 'test-agent-123',
      });

      expect(result.agent).toBeDefined();
    });

    it('should handle validAgents option', async () => {
      const apiConfig: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({
        provider: apiConfig,
        validAgents: ['agent1', 'agent2', 'agent3'],
      });

      expect(result.agent).toBeDefined();
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify APIProviderConfig (api/openai)', async () => {
      const config: APIProviderConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = await createCrewxAgent({ provider: config });

      expect(MastraAPIProvider).toHaveBeenCalled();
    });

    it('should correctly identify ProviderConfig (cli/claude)', async () => {
      const { createProviderFromConfig } = await import('../../src/core/providers/provider-factory');

      const config: ProviderConfig = {
        namespace: 'cli',
        id: 'claude',
      };

      const result = await createCrewxAgent({ provider: config });

      expect(createProviderFromConfig).toHaveBeenCalled();
      expect(MastraAPIProvider).not.toHaveBeenCalled();
    });

    it('should correctly identify direct AIProvider', async () => {
      const directProvider = {
        query: vi.fn().mockResolvedValue({ success: true }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      };

      const result = await createCrewxAgent({ provider: directProvider });

      expect(MastraAPIProvider).not.toHaveBeenCalled();
    });
  });

  describe('Backwards Compatibility', () => {
    it('should support existing CLI provider configs', async () => {
      const { createProviderFromConfig } = await import('../../src/core/providers/provider-factory');

      const configs: ProviderConfig[] = [
        { namespace: 'cli', id: 'claude', model: 'sonnet' },
        { namespace: 'cli', id: 'gemini', model: 'gemini-1.5-pro' },
        { namespace: 'cli', id: 'copilot', model: 'gpt-4' },
      ];

      for (const config of configs) {
        const result = await createCrewxAgent({ provider: config });
        expect(createProviderFromConfig).toHaveBeenCalledWith(config);
        expect(result.agent).toBeDefined();
      }
    });

    it('should not break existing agent creation patterns', async () => {
      // Pattern 1: No config (MockProvider)
      const result1 = await createCrewxAgent({});
      expect(result1.agent).toBeDefined();

      // Pattern 2: Direct provider
      const directProvider = {
        query: vi.fn().mockResolvedValue({ success: true }),
        execute: vi.fn().mockResolvedValue({ success: true }),
      };
      const result2 = await createCrewxAgent({ provider: directProvider });
      expect(result2.agent).toBeDefined();

      // Pattern 3: ProviderConfig
      const result3 = await createCrewxAgent({
        provider: { namespace: 'cli', id: 'claude' },
      });
      expect(result3.agent).toBeDefined();

      // Pattern 4: New APIProviderConfig
      const result4 = await createCrewxAgent({
        provider: { provider: 'api/openai', model: 'gpt-4' },
      });
      expect(result4.agent).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it.skip('should handle invalid provider gracefully', async () => {
      // Note: This test is skipped because MastraAPIProvider is mocked
      // In real usage, MastraAPIProvider constructor validates provider type
      // and throws APIProviderParseError for invalid providers.
      // Error handling is tested in api-provider-parser.test.ts instead.
      const invalidConfig = {
        provider: 'api/invalid',
        model: 'test',
      } as any;

      await expect(async () => {
        await createCrewxAgent({ provider: invalidConfig });
      }).rejects.toThrow();
    });
  });
});
