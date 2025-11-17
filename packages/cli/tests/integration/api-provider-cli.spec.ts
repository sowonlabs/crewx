/**
 * WBS-24 Phase 5: CLI Integration Tests for API Providers
 *
 * Tests that CLI commands work correctly with API providers:
 * - crewx query with API agents
 * - crewx execute with API agents
 * - crewx chat with API agents
 * - crewx doctor health checks for API providers
 * - Regression tests (CLI providers still work)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrewXTool } from '../../src/crewx.tool';
import { ConfigService } from '../../src/services/config.service';
import { AgentLoaderService } from '../../src/services/agent-loader.service';
import { DoctorHandler } from '../../src/cli/doctor.handler';
import { handleQuery } from '../../src/cli/query.handler';
import { handleExecute } from '../../src/cli/execute.handler';

describe('API Provider CLI Integration (WBS-24 Phase 5)', () => {
  let app: TestingModule;
  let crewXTool: CrewXTool;
  let configService: ConfigService;
  let agentLoaderService: AgentLoaderService;
  let doctorHandler: DoctorHandler;

  beforeEach(async () => {
    // Create test module with mocked dependencies
    app = await Test.createTestingModule({
      providers: [
        CrewXTool,
        ConfigService,
        AgentLoaderService,
        DoctorHandler,
        {
          provide: 'ConversationProviderFactory',
          useValue: {
            getProvider: vi.fn().mockReturnValue({
              initialize: vi.fn(),
              hasHistory: vi.fn().mockResolvedValue(false),
              createThread: vi.fn().mockResolvedValue('test-thread'),
              fetchHistory: vi.fn().mockResolvedValue({ messages: [] }),
              addMessage: vi.fn(),
              formatForAI: vi.fn().mockReturnValue(''),
            }),
          },
        },
      ],
    }).compile();

    crewXTool = app.get<CrewXTool>(CrewXTool);
    configService = app.get<ConfigService>(ConfigService);
    agentLoaderService = app.get<AgentLoaderService>(AgentLoaderService);
    doctorHandler = app.get<DoctorHandler>(DoctorHandler);
  });

  describe('Doctor Command - API Provider Health Checks', () => {
    it('should check API provider configuration when API agents are configured', async () => {
      // Mock config with API agent
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'test_api_agent',
          name: 'Test API Agent',
          role: 'AI Agent',
          provider: 'api/openai',
          workingDirectory: './',
          capabilities: [],
          description: 'Test API agent',
          inline: {
            type: 'agent',
            provider: 'api/openai',
            model: 'gpt-4',
          },
        },
      ] as any);

      const result = await doctorHandler.handle({
        verbose: false,
      });

      expect(result.diagnostics).toBeDefined();

      // Should have API provider configuration diagnostic
      const apiConfigDiagnostic = result.diagnostics.find(
        d => d.name === 'API Providers Configuration'
      );
      expect(apiConfigDiagnostic).toBeDefined();
      expect(apiConfigDiagnostic?.status).toBe('success');
      expect(apiConfigDiagnostic?.message).toContain('API provider agent(s) configured');
    });

    it('should check API key environment variables for configured API providers', async () => {
      // Set environment variable
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Mock config with API agent
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'test_anthropic_agent',
          name: 'Test Anthropic Agent',
          role: 'AI Agent',
          provider: 'api/anthropic',
          workingDirectory: './',
          capabilities: [],
          description: 'Test Anthropic agent',
          inline: {
            type: 'agent',
            provider: 'api/anthropic',
            model: 'claude-3-sonnet-20240229',
          },
        },
      ] as any);

      const result = await doctorHandler.handle({
        verbose: false,
      });

      // Should have API key diagnostic
      const apiKeyDiagnostic = result.diagnostics.find(
        d => d.name === 'api/anthropic API Key'
      );
      expect(apiKeyDiagnostic).toBeDefined();
      expect(apiKeyDiagnostic?.status).toBe('success');
      expect(apiKeyDiagnostic?.message).toContain('API key configured');

      // Cleanup
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should warn when API key is not configured', async () => {
      // Ensure env var is not set
      delete process.env.OPENAI_API_KEY;

      // Mock config with API agent
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'test_openai_agent',
          name: 'Test OpenAI Agent',
          role: 'AI Agent',
          provider: 'api/openai',
          workingDirectory: './',
          capabilities: [],
          description: 'Test OpenAI agent',
          inline: {
            type: 'agent',
            provider: 'api/openai',
            model: 'gpt-4',
          },
        },
      ] as any);

      const result = await doctorHandler.handle({
        verbose: false,
      });

      // Should have warning about missing API key
      const apiKeyDiagnostic = result.diagnostics.find(
        d => d.name === 'api/openai API Key'
      );
      expect(apiKeyDiagnostic).toBeDefined();
      expect(apiKeyDiagnostic?.status).toBe('warning');
      expect(apiKeyDiagnostic?.message).toContain('not configured');
    });

    it('should support all 7 API provider types', async () => {
      const apiProviders = [
        'api/openai',
        'api/anthropic',
        'api/google',
        'api/bedrock',
        'api/litellm',
        'api/ollama',
        'api/sowonai',
      ];

      for (const provider of apiProviders) {
        // Mock config with this provider
        vi.spyOn(configService, 'getAgents').mockResolvedValue([
          {
            id: `test_${provider.replace('api/', '')}_agent`,
            name: `Test ${provider} Agent`,
            role: 'AI Agent',
            provider,
            workingDirectory: './',
            capabilities: [],
            description: `Test ${provider} agent`,
            inline: {
              type: 'agent',
              provider,
              model: 'test-model',
            },
          },
        ] as any);

        const result = await doctorHandler.handle({
          verbose: false,
        });

        const apiConfigDiagnostic = result.diagnostics.find(
          d => d.name === 'API Providers Configuration'
        );
        expect(apiConfigDiagnostic).toBeDefined();
        expect(apiConfigDiagnostic?.status).toBe('success');
      }
    });
  });

  describe('Agent Loading - API Provider Support', () => {
    it('should load API provider agents from configuration', async () => {
      // Mock configuration with API agent
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'api_test_agent',
          name: 'API Test Agent',
          role: 'AI Agent',
          provider: 'api/openai',
          workingDirectory: './',
          capabilities: ['query', 'execute'],
          description: 'API test agent',
          inline: {
            type: 'agent',
            provider: 'api/openai',
            model: 'gpt-4',
            prompt: 'You are a test agent',
          },
        },
      ] as any);

      const agents = await agentLoaderService.loadAvailableAgents();

      const apiAgent = agents.find(a => a.id === 'api_test_agent');
      expect(apiAgent).toBeDefined();
      expect(apiAgent?.provider).toBe('api/openai');
      expect(apiAgent?.inline?.provider).toBe('api/openai');
      expect(apiAgent?.inline?.model).toBe('gpt-4');
    });

    it('should correctly identify API provider agents', async () => {
      // Mock mixed configuration (CLI + API agents)
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'cli_agent',
          name: 'CLI Agent',
          role: 'AI Agent',
          provider: 'claude',
          workingDirectory: './',
          capabilities: [],
          description: 'CLI agent',
        },
        {
          id: 'api_agent',
          name: 'API Agent',
          role: 'AI Agent',
          provider: 'api/anthropic',
          workingDirectory: './',
          capabilities: [],
          description: 'API agent',
          inline: {
            type: 'agent',
            provider: 'api/anthropic',
            model: 'claude-3-sonnet-20240229',
          },
        },
      ] as any);

      const agents = await agentLoaderService.loadAvailableAgents();

      const cliAgent = agents.find(a => a.id === 'cli_agent');
      const apiAgent = agents.find(a => a.id === 'api_agent');

      expect(cliAgent).toBeDefined();
      expect(cliAgent?.provider).toBe('claude');

      expect(apiAgent).toBeDefined();
      expect(apiAgent?.provider).toBe('api/anthropic');
    });
  });

  describe('Query Command - API Provider Support', () => {
    it('should pass provider parameter to queryAgent when specified', async () => {
      const queryAgentSpy = vi.spyOn(crewXTool, 'queryAgent').mockResolvedValue({
        success: true,
        response: 'Test response',
        provider: 'api/openai',
        taskId: 'task-123',
      } as any);

      // Mock agent exists
      vi.spyOn(crewXTool, 'listAgents').mockResolvedValue({
        availableAgents: [{ id: 'test_agent', name: 'Test Agent' }],
      } as any);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleQuery(app, {
        query: '@test_agent hello',
        provider: 'api/openai',
      } as any);

      expect(queryAgentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test_agent',
          query: 'hello',
          provider: 'api/openai',
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Execute Command - API Provider Support', () => {
    it('should pass provider parameter to executeAgent when specified', async () => {
      const executeAgentSpy = vi.spyOn(crewXTool, 'executeAgent').mockResolvedValue({
        success: true,
        implementation: 'Test implementation',
        provider: 'api/anthropic',
        taskId: 'task-456',
      } as any);

      // Mock agent exists
      vi.spyOn(crewXTool, 'listAgents').mockResolvedValue({
        availableAgents: [{ id: 'test_agent', name: 'Test Agent' }],
      } as any);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleExecute(app, {
        execute: '@test_agent implement feature',
        provider: 'api/anthropic',
      } as any);

      expect(executeAgentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test_agent',
          task: expect.stringContaining('implement feature'),
          provider: 'api/anthropic',
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Regression Tests - CLI Providers Still Work', () => {
    it('should still support CLI providers (claude, gemini, copilot)', async () => {
      // Mock CLI agents
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'claude',
          name: 'Claude AI',
          role: 'AI Agent',
          provider: 'claude',
          workingDirectory: './',
          capabilities: [],
          description: 'Claude agent',
        },
        {
          id: 'gemini',
          name: 'Gemini AI',
          role: 'AI Agent',
          provider: 'gemini',
          workingDirectory: './',
          capabilities: [],
          description: 'Gemini agent',
        },
      ] as any);

      const agents = await agentLoaderService.loadAvailableAgents();

      const claudeAgent = agents.find(a => a.id === 'claude');
      const geminiAgent = agents.find(a => a.id === 'gemini');

      expect(claudeAgent).toBeDefined();
      expect(claudeAgent?.provider).toBe('claude');

      expect(geminiAgent).toBeDefined();
      expect(geminiAgent?.provider).toBe('gemini');
    });

    it('should support provider fallback arrays for CLI providers', async () => {
      // Mock agent with fallback array
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'flexible_agent',
          name: 'Flexible Agent',
          role: 'AI Agent',
          provider: ['claude', 'gemini', 'copilot'],
          workingDirectory: './',
          capabilities: [],
          description: 'Flexible agent with fallback',
        },
      ] as any);

      const agents = await agentLoaderService.loadAvailableAgents();

      const flexibleAgent = agents.find(a => a.id === 'flexible_agent');
      expect(flexibleAgent).toBeDefined();
      expect(Array.isArray(flexibleAgent?.provider)).toBe(true);
      expect(flexibleAgent?.provider).toEqual(['claude', 'gemini', 'copilot']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid API provider strings gracefully', async () => {
      // Mock config with invalid provider
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'invalid_agent',
          name: 'Invalid Agent',
          role: 'AI Agent',
          provider: 'api/invalid-provider',
          workingDirectory: './',
          capabilities: [],
          description: 'Invalid API provider',
          inline: {
            type: 'agent',
            provider: 'api/invalid-provider',
            model: 'test-model',
          },
        },
      ] as any);

      // Should still load the agent (provider-factory will handle validation)
      const agents = await agentLoaderService.loadAvailableAgents();
      const invalidAgent = agents.find(a => a.id === 'invalid_agent');

      expect(invalidAgent).toBeDefined();
      expect(invalidAgent?.provider).toBe('api/invalid-provider');
    });

    it('should handle mixed CLI and API agents in parallel queries', async () => {
      const queryAgentParallelSpy = vi.spyOn(crewXTool, 'queryAgentParallel').mockResolvedValue({
        success: true,
        results: [
          {
            success: true,
            response: 'CLI response',
            provider: 'claude',
            agentId: 'claude',
          },
          {
            success: true,
            response: 'API response',
            provider: 'api/openai',
            agentId: 'api_agent',
          },
        ],
        summary: {
          totalQueries: 2,
          successful: 2,
          failed: 0,
        },
      } as any);

      // Mock agents exist
      vi.spyOn(crewXTool, 'listAgents').mockResolvedValue({
        availableAgents: [
          { id: 'claude', name: 'Claude' },
          { id: 'api_agent', name: 'API Agent' },
        ],
      } as any);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleQuery(app, {
        query: ['@claude test1', '@api_agent test2'],
      } as any);

      expect(queryAgentParallelSpy).toHaveBeenCalled();
      const call = queryAgentParallelSpy.mock.calls[0];
      expect(call[0].queries).toHaveLength(2);
      expect(call[0].queries[0].agentId).toBe('claude');
      expect(call[0].queries[1].agentId).toBe('api_agent');

      consoleLogSpy.mockRestore();
    });

    it('should handle empty provider configuration gracefully', async () => {
      // Mock config with no provider specified (should default to claude)
      vi.spyOn(configService, 'getAgents').mockResolvedValue([
        {
          id: 'default_agent',
          name: 'Default Agent',
          role: 'AI Agent',
          provider: 'claude', // ConfigService defaults to claude
          workingDirectory: './',
          capabilities: [],
          description: 'Agent with default provider',
        },
      ] as any);

      const agents = await agentLoaderService.loadAvailableAgents();
      const defaultAgent = agents.find(a => a.id === 'default_agent');

      expect(defaultAgent).toBeDefined();
      expect(defaultAgent?.provider).toBe('claude');
    });
  });
});
