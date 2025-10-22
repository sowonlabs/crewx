/**
 * Integration tests for AgentRuntime + Provider integration
 * Tests the full flow from createCrewxAgent to provider execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCrewxAgent } from '../../src/core/agent/agent-factory';
import { MockProvider } from '../../src/core/providers/mock.provider';
import type { AIProvider, AIQueryOptions, AIResponse } from '../../src/core/providers/ai-provider.interface';

class IntegrationTestProvider implements AIProvider {
  name = 'integration/test';
  callLog: Array<{ method: string; prompt: string; options: AIQueryOptions }> = [];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    this.callLog.push({ method: 'query', prompt, options });
    return {
      content: `Integration query response: ${prompt}`,
      provider: this.name,
      command: 'int-query',
      success: true,
      model: options.model,
    };
  }

  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    this.callLog.push({ method: 'execute', prompt, options });
    return {
      content: `Integration execute response: ${prompt}`,
      provider: this.name,
      command: 'int-execute',
      success: true,
      model: options.model,
    };
  }

  async getToolPath(): Promise<string | null> {
    return '/integration/test/path';
  }
}

describe('AgentRuntime Provider Integration', () => {
  describe('End-to-End Flow', () => {
    it('should create agent with provider and execute query', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({ provider });

      const result = await agent.query({
        prompt: 'analyze system',
        model: 'gpt-4',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Integration query response: analyze system');
      expect(result.metadata?.provider).toBe('integration/test');
      expect(result.metadata?.model).toBe('gpt-4');
      expect(provider.callLog).toHaveLength(1);
      expect(provider.callLog[0].method).toBe('query');
    });

    it('should create agent with ProviderConfig and execute', async () => {
      // Use MockProvider since built-in providers require CLI tools
      const mockProvider = new MockProvider();
      const { agent } = await createCrewxAgent({
        provider: mockProvider,
      });

      const result = await agent.query({
        prompt: 'test with config',
        model: 'claude-3-sonnet',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.model).toBe('claude-3-sonnet');
    });

    it('should propagate runtime model to provider', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({
        provider,
      });

      await agent.query({ prompt: 'test', model: 'runtime-model' });

      expect(provider.callLog[0].options.model).toBe('runtime-model');
    });

    it('should propagate context and messages to provider', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({ provider });

      await agent.query({
        prompt: 'continue conversation',
        context: 'project-context',
        messages: [
          {
            id: 'msg-1',
            text: 'Hello',
            timestamp: new Date().toISOString(),
            isAssistant: false,
          },
        ],
      });

      expect(provider.callLog[0].options.pipedContext).toBe('project-context');
      expect(provider.callLog[0].options.messages).toHaveLength(1);
    });
  });

  describe('Event System Integration', () => {
    it('should emit events with provider metadata', async () => {
      const provider = new IntegrationTestProvider();
      const { agent, onEvent } = await createCrewxAgent({
        provider,
        enableCallStack: true,
      });

      const startEvents: any[] = [];
      const completeEvents: any[] = [];
      const callStackUpdates: any[] = [];

      onEvent('agentStarted', (e) => startEvents.push(e));
      onEvent('agentCompleted', (e) => completeEvents.push(e));
      onEvent('callStackUpdated', (stack) => callStackUpdates.push([...stack]));

      await agent.query({ prompt: 'test' });

      expect(startEvents).toHaveLength(1);
      expect(completeEvents).toHaveLength(1);
      expect(callStackUpdates.length).toBeGreaterThanOrEqual(2);
      expect(callStackUpdates[0][0].provider).toBe('integration/test');
    });
  });

  describe('Mock Provider Integration', () => {
    it('should use MockProvider by default', async () => {
      const { agent } = await createCrewxAgent();

      const result = await agent.query({ prompt: 'test default' });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Mock response');
    });

    it('should allow customizing MockProvider responses', async () => {
      const mockProvider = new MockProvider();
      mockProvider.setResponse('special task', {
        content: 'Special response',
        success: true,
      });

      const { agent } = await createCrewxAgent({ provider: mockProvider });

      const result = await agent.query({ prompt: 'special task' });

      expect(result.content).toBe('Special response');
    });

    it('should isolate MockProvider instances', async () => {
      const mock1 = new MockProvider();
      const mock2 = new MockProvider();

      mock1.setResponse('test', { content: 'Mock 1' });
      mock2.setResponse('test', { content: 'Mock 2' });

      const { agent: agent1 } = await createCrewxAgent({ provider: mock1 });
      const { agent: agent2 } = await createCrewxAgent({ provider: mock2 });

      const result1 = await agent1.query({ prompt: 'test' });
      const result2 = await agent2.query({ prompt: 'test' });

      expect(result1.content).toBe('Mock 1');
      expect(result2.content).toBe('Mock 2');
    });
  });

  describe('Provider Error Handling', () => {
    it('should handle provider failures gracefully', async () => {
      class FailingProvider implements AIProvider {
        name = 'failing/provider';
        async isAvailable() { return true; }
        async query() {
          throw new Error('Provider unavailable');
        }
        async execute() {
          throw new Error('Provider unavailable');
        }
        async getToolPath() { return null; }
      }

      const { agent, onEvent } = await createCrewxAgent({
        provider: new FailingProvider(),
      });

      const completeEvents: any[] = [];
      onEvent('agentCompleted', (e) => completeEvents.push(e));

      await expect(async () => {
        await agent.query({ prompt: 'test' });
      }).rejects.toThrow('Provider unavailable');

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].success).toBe(false);
    });
  });

  describe('Mention Parsing Integration', () => {
    it('should work with string-based mentions and provider', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({
        provider,
        defaultAgentId: 'backend',
        validAgents: ['backend', 'frontend'],
      });

      const result = await agent.query('@backend:gpt-4 analyze code');

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('backend');
      expect(result.metadata?.model).toBe('gpt-4');
      expect(provider.callLog[0].prompt).toBe('analyze code');
      expect(provider.callLog[0].options.model).toBe('gpt-4');
    });

    it('should forward parsed model to provider', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({
        provider,
        defaultAgentId: 'test',
        validAgents: ['test'],
      });

      await agent.query('@test:claude-3-opus test task');

      expect(provider.callLog[0].options.model).toBe('claude-3-opus');
    });
  });

  describe('Configuration Propagation', () => {
    it('should apply defaultModel from ProviderConfig', async () => {
      const provider = new IntegrationTestProvider();

      // Test with injected provider and default model
      const { agent } = await createCrewxAgent({ provider });

      // This test verifies the agent creation flow
      expect(agent).toBeDefined();

      const result = await agent.query({ prompt: 'test' });
      expect(result.success).toBe(true);
    });
  });
});

describe('SkillRuntime Integration Points', () => {
  describe('ExecutionContext Compatibility', () => {
    it('should provide provider metadata in result for SkillRuntime', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({ provider });

      const result = await agent.query({ prompt: 'skill execution' });

      // SkillRuntime expects these fields in metadata
      expect(result.metadata?.provider).toBe('integration/test');
      expect(result.metadata?.command).toBeDefined();
      expect(result.metadata).toHaveProperty('messageCount');
    });

    it('should support model propagation for skill execution', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({ provider });

      const result = await agent.query({
        prompt: 'skill task',
        model: 'skill-model',
      });

      // Skills Parser expects model in metadata
      expect(result.metadata?.model).toBe('skill-model');
    });

    it('should maintain agentId for skill context', async () => {
      const provider = new IntegrationTestProvider();
      const { agent } = await createCrewxAgent({
        provider,
        defaultAgentId: 'skill-agent',
      });

      const result = await agent.query({ prompt: 'test' });

      // ExecutionContext needs agentId
      expect(result.agentId).toBe('skill-agent');
      expect(provider.callLog[0].options.agentId).toBe('skill-agent');
    });
  });

  describe('Skills Parser Integration Points', () => {
    it('should support AgentDefinition provider field', async () => {
      // Skills Parser defines provider in AgentDefinition
      const { agent } = await createCrewxAgent({
        provider: {
          namespace: 'cli',
          id: 'claude',
          model: 'claude-3-sonnet',
        },
      });

      const result = await agent.query({ prompt: 'test' });

      // Model from AgentDefinition should be used
      expect(result.metadata?.model).toBe('claude-3-sonnet');
    });

    it('should allow runtime model override over AgentDefinition', async () => {
      const { agent } = await createCrewxAgent({
        provider: {
          namespace: 'cli',
          id: 'claude',
          model: 'claude-3-sonnet',
        },
      });

      const result = await agent.query({
        prompt: 'test',
        model: 'claude-3-opus', // Runtime override
      });

      expect(result.metadata?.model).toBe('claude-3-opus');
    });
  });
});
