import { describe, it, expect, vi } from 'vitest';
import type { AIProvider, AIQueryOptions, AIResponse } from '@sowonai/crewx-sdk';
import { MockProvider } from '@sowonai/crewx-sdk';
import { ProviderBridgeService } from '../../src/services/provider-bridge.service';

class StubAIProviderService {
  constructor(private readonly provider: AIProvider) {}

  getProvider(name: string): AIProvider | undefined {
    if (name === this.provider.name) {
      return this.provider;
    }

    const shortName = this.provider.name.includes('/')
      ? this.provider.name.split('/').pop()
      : this.provider.name;

    if (name === shortName) {
      return this.provider;
    }

    return undefined;
  }

  getAvailableProviders(): string[] {
    return [this.provider.name];
  }

  // Methods used in other parts of the service but not required for these tests
  checkAvailableProviders(): string[] {
    return [this.provider.name];
  }
}

describe('ProviderBridgeService', () => {
  it('creates runtime that forwards provider options to the SDK agent', async () => {
    const querySpy = vi.fn<[
      string,
      AIQueryOptions | undefined,
    ], Promise<AIResponse>>().mockResolvedValue({
      content: 'ok',
      provider: 'cli/claude',
      command: 'query',
      success: true,
    });

    const executeSpy = vi.fn<[
      string,
      AIQueryOptions | undefined,
    ], Promise<AIResponse>>().mockResolvedValue({
      content: 'exec',
      provider: 'cli/claude',
      command: 'execute',
      success: true,
    });

    const provider: AIProvider = {
      name: 'cli/claude',
      isAvailable: vi.fn().mockResolvedValue(true),
      query: querySpy,
      execute: executeSpy,
      getToolPath: vi.fn().mockResolvedValue(null),
    };

    const service = new ProviderBridgeService(
      new StubAIProviderService(provider) as any,
      undefined,
    );

    const { runtime, resolution } = await service.createAgentRuntime({
      provider: 'claude',
      defaultAgentId: 'test-agent',
    });

    expect(resolution.provider.name).toBe('cli/claude');

    await runtime.agent.query({
      agentId: 'test-agent',
      prompt: 'Ping',
      context: 'ctx',
      messages: [
        {
          id: 'm1',
          userId: 'user',
          text: 'hello',
          timestamp: new Date(),
          isAssistant: false,
        },
      ],
      options: {
        timeout: 123,
        workingDirectory: '/tmp/project',
        pipedContext: 'structured',
        taskId: 'task-1',
      },
    });

    const [, queryOptions] = querySpy.mock.calls[0];
    // Provider options should include runtime overrides and request metadata
    expect(queryOptions).toMatchObject({
      timeout: 123,
      workingDirectory: '/tmp/project',
      pipedContext: 'structured',
      taskId: 'task-1',
      agentId: 'test-agent',
    });

    await runtime.agent.execute({
      agentId: 'test-agent',
      prompt: 'Do work',
      context: 'ctx',
      options: {
        timeout: 456,
        pipedContext: 'structured-exec',
        taskId: 'task-2',
      },
    });

    const [, executeOptions] = executeSpy.mock.calls[0];
    expect(executeOptions).toMatchObject({
      timeout: 456,
      pipedContext: 'structured-exec',
      taskId: 'task-2',
      agentId: 'test-agent',
    });
  });

  it('falls back to MockProvider when no providers are registered', async () => {
    const emptyService = new ProviderBridgeService(
      {
        getProvider: () => undefined,
        getAvailableProviders: () => [],
        checkAvailableProviders: () => [],
      } as any,
      undefined,
    );

    const { resolution } = await emptyService.createAgentRuntime();
    expect(resolution.provider).toBeInstanceOf(MockProvider);
  });
});
