/**
 * Tests for AgentRuntime - provider integration and execution logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from '../../../../src/core/agent/agent-runtime';
import { MockProvider } from '../../../../src/core/providers/mock.provider';
import type { AIProvider, AIQueryOptions, AIResponse } from '../../../../src/core/providers/ai-provider.interface';
import { EventBus } from '../../../../src/core/agent/event-bus';

class TestProvider implements AIProvider {
  name = 'test/provider';
  queryCallCount = 0;
  executeCallCount = 0;
  lastQueryPrompt?: string;
  lastQueryOptions?: AIQueryOptions;
  lastExecutePrompt?: string;
  lastExecuteOptions?: AIQueryOptions;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    this.queryCallCount++;
    this.lastQueryPrompt = prompt;
    this.lastQueryOptions = options;
    return {
      content: `Test query result: ${prompt}`,
      provider: this.name,
      command: 'test-query',
      success: true,
      taskId: options.taskId,
      toolCall: options.model ? { model: options.model } : undefined,
    };
  }

  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    this.executeCallCount++;
    this.lastExecutePrompt = prompt;
    this.lastExecuteOptions = options;
    return {
      content: `Test execute result: ${prompt}`,
      provider: this.name,
      command: 'test-execute',
      success: true,
      taskId: options.taskId,
    };
  }

  async getToolPath(): Promise<string | null> {
    return '/test/tool/path';
  }
}

describe('AgentRuntime', () => {
  describe('Provider Injection', () => {
    it('should use MockProvider by default when no provider specified', () => {
      const runtime = new AgentRuntime();

      // Can't directly access private provider, but can verify through execution
      expect(runtime).toBeDefined();
    });

    it('should accept custom provider via options', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      await runtime.query({ prompt: 'test' });

      expect(testProvider.queryCallCount).toBe(1);
      expect(testProvider.lastQueryPrompt).toBe('test');
    });

    it('should use injected provider for both query and execute', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      await runtime.query({ prompt: 'query test' });
      await runtime.execute({ prompt: 'execute test' });

      expect(testProvider.queryCallCount).toBe(1);
      expect(testProvider.executeCallCount).toBe(1);
      expect(testProvider.lastQueryPrompt).toBe('query test');
      expect(testProvider.lastExecutePrompt).toBe('execute test');
    });
  });

  describe('Provider Options Forwarding', () => {
    it('should forward agentId to provider', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({
        provider: testProvider,
        defaultAgentId: 'test-agent',
      });

      await runtime.query({ prompt: 'test', agentId: 'custom-agent' });

      expect(testProvider.lastQueryOptions?.agentId).toBe('custom-agent');
    });

    it('should forward model to provider', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      await runtime.query({ prompt: 'test', model: 'gpt-4' });

      expect(testProvider.lastQueryOptions?.model).toBe('gpt-4');
    });

    it('should forward context as pipedContext to provider', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      await runtime.query({
        prompt: 'test',
        context: 'project context here'
      });

      expect(testProvider.lastQueryOptions?.pipedContext).toBe('project context here');
    });

    it('should forward conversation messages to provider', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      const messages = [
        {
          id: 'msg-1',
          text: 'Hello',
          timestamp: new Date().toISOString(),
          isAssistant: false,
        },
        {
          id: 'msg-2',
          text: 'Hi there',
          timestamp: new Date().toISOString(),
          isAssistant: true,
        },
      ];

      await runtime.query({ prompt: 'continue', messages });

      expect(testProvider.lastQueryOptions?.messages).toBeDefined();
      expect(testProvider.lastQueryOptions?.messages).toHaveLength(2);
      expect(testProvider.lastQueryOptions?.messages?.[0].text).toBe('Hello');
    });

    it('should use defaultModel when runtime model is not specified', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({
        provider: testProvider,
        defaultModel: 'claude-3-sonnet',
      });

      await runtime.query({ prompt: 'test' });

      expect(testProvider.lastQueryOptions?.model).toBe('claude-3-sonnet');
    });

    it('should override defaultModel with runtime model', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({
        provider: testProvider,
        defaultModel: 'claude-3-sonnet',
      });

      await runtime.query({ prompt: 'test', model: 'claude-3-opus' });

      expect(testProvider.lastQueryOptions?.model).toBe('claude-3-opus');
    });
  });

  describe('Response Conversion', () => {
    it('should convert AIResponse to AgentResult correctly', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      const result = await runtime.query({ prompt: 'test query' });

      expect(result.content).toBe('Test query result: test query');
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('default');
      expect(result.metadata?.provider).toBe('test/provider');
      expect(result.metadata?.command).toBe('test-query');
    });

    it('should include model in result metadata', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      const result = await runtime.query({
        prompt: 'test',
        model: 'gpt-4-turbo'
      });

      expect(result.metadata?.model).toBe('gpt-4-turbo');
    });

    it('should include context in result metadata', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      const result = await runtime.query({
        prompt: 'test',
        context: 'project-xyz'
      });

      expect(result.metadata?.context).toBe('project-xyz');
    });

    it('should include message count in result metadata', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      const result = await runtime.query({
        prompt: 'test',
        messages: [
          {
            id: 'm1',
            text: 'msg1',
            timestamp: new Date().toISOString(),
            isAssistant: false,
          },
          {
            id: 'm2',
            text: 'msg2',
            timestamp: new Date().toISOString(),
            isAssistant: true,
          },
        ],
      });

      expect(result.metadata?.messageCount).toBe(2);
    });

    it('should preserve toolCall from AIResponse', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({ provider: testProvider });

      const result = await runtime.query({
        prompt: 'test',
        model: 'gpt-4',
      });

      expect(result.metadata?.toolCall).toBeDefined();
      expect(result.metadata?.toolCall).toMatchObject({ model: 'gpt-4' });
    });
  });

  describe('Event Emission', () => {
    it('should emit agentStarted event before execution', async () => {
      const testProvider = new TestProvider();
      const eventBus = new EventBus();
      const runtime = new AgentRuntime({
        provider: testProvider,
        eventBus,
        defaultAgentId: 'test-agent',
      });

      const startEvents: any[] = [];
      eventBus.on('agentStarted', (payload) => {
        startEvents.push(payload);
      });

      await runtime.query({ prompt: 'test' });

      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]).toMatchObject({
        agentId: 'test-agent',
        mode: 'query',
      });
    });

    it('should emit agentCompleted event after execution', async () => {
      const testProvider = new TestProvider();
      const eventBus = new EventBus();
      const runtime = new AgentRuntime({
        provider: testProvider,
        eventBus,
      });

      const completeEvents: any[] = [];
      eventBus.on('agentCompleted', (payload) => {
        completeEvents.push(payload);
      });

      await runtime.query({ prompt: 'test' });

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]).toMatchObject({
        success: true,
      });
    });

    it('should emit agentCompleted with success:false on error', async () => {
      class FailingProvider implements AIProvider {
        name = 'failing';
        async isAvailable() { return true; }
        async query() { throw new Error('Provider error'); }
        async execute() { throw new Error('Provider error'); }
        async getToolPath() { return null; }
      }

      const eventBus = new EventBus();
      const runtime = new AgentRuntime({
        provider: new FailingProvider(),
        eventBus,
      });

      const completeEvents: any[] = [];
      eventBus.on('agentCompleted', (payload) => {
        completeEvents.push(payload);
      });

      await expect(async () => {
        await runtime.query({ prompt: 'test' });
      }).rejects.toThrow('Provider error');

      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].success).toBe(false);
    });
  });

  describe('Call Stack Tracking', () => {
    it('should include provider name in call stack frame', async () => {
      const testProvider = new TestProvider();
      const eventBus = new EventBus();
      const runtime = new AgentRuntime({
        provider: testProvider,
        eventBus,
        enableCallStack: true,
      });

      const callStackUpdates: any[] = [];
      eventBus.on('callStackUpdated', (stack) => {
        callStackUpdates.push([...stack]);
      });

      await runtime.query({ prompt: 'test' });

      expect(callStackUpdates.length).toBeGreaterThan(0);
      const firstStack = callStackUpdates[0];
      expect(firstStack[0]).toMatchObject({
        provider: 'test/provider',
        mode: 'query',
      });
    });

    it('should track call stack depth correctly', async () => {
      const testProvider = new TestProvider();
      const runtime = new AgentRuntime({
        provider: testProvider,
        enableCallStack: true,
      });

      await runtime.query({ prompt: 'test' });

      const stack = runtime.getCallStack();
      // Stack should be empty after query completes
      expect(stack).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should propagate provider errors', async () => {
      class ErrorProvider implements AIProvider {
        name = 'error';
        async isAvailable() { return true; }
        async query() { throw new Error('Query failed'); }
        async execute() { throw new Error('Execute failed'); }
        async getToolPath() { return null; }
      }

      const runtime = new AgentRuntime({ provider: new ErrorProvider() });

      await expect(async () => {
        await runtime.query({ prompt: 'test' });
      }).rejects.toThrow('Query failed');

      await expect(async () => {
        await runtime.execute({ prompt: 'test' });
      }).rejects.toThrow('Execute failed');
    });

    it('should clean up call stack on error', async () => {
      class ErrorProvider implements AIProvider {
        name = 'error';
        async isAvailable() { return true; }
        async query() { throw new Error('Error'); }
        async execute() { throw new Error('Error'); }
        async getToolPath() { return null; }
      }

      const runtime = new AgentRuntime({
        provider: new ErrorProvider(),
        enableCallStack: true,
      });

      try {
        await runtime.query({ prompt: 'test' });
      } catch (error) {
        // Expected
      }

      const stack = runtime.getCallStack();
      expect(stack).toHaveLength(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without provider (uses MockProvider)', async () => {
      const runtime = new AgentRuntime();

      const result = await runtime.query({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Mock response');
    });

    it('should work with existing event bus', async () => {
      const eventBus = new EventBus();
      const runtime = new AgentRuntime({ eventBus });

      const events: string[] = [];
      eventBus.on('agentStarted', () => events.push('started'));
      eventBus.on('agentCompleted', () => events.push('completed'));

      await runtime.query({ prompt: 'test' });

      expect(events).toEqual(['started', 'completed']);
    });
  });
});
