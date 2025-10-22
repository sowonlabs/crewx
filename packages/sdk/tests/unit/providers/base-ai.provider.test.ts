import { describe, it, expect } from 'vitest';
import { BaseAIProvider } from '../../../src/core/providers/base-ai.provider';
import type { BaseAIProviderOptions } from '../../../src/core/providers/base-ai.types';
import type { AIQueryOptions } from '../../../src/core/providers/ai-provider.interface';
import type { ToolCallHandler } from '../../../src/core/providers/tool-call.types';

class TestProvider extends BaseAIProvider {
  readonly name: string;

  constructor(name = 'cli/test', options: BaseAIProviderOptions = {}) {
    super('TestProvider', options);
    this.name = name;
  }

  protected getCliCommand(): string {
    return 'test-cli';
  }

  protected getDefaultArgs(): string[] {
    return [];
  }

  protected getExecuteArgs(): string[] {
    return [];
  }

  protected getNotInstalledMessage(): string {
    return 'Test CLI not installed';
  }

  public filter(content: string): string {
    return this.filterToolUseFromResponse(content);
  }

  public buildPayload(prompt: string, context: string | null, options?: AIQueryOptions): string {
    return this.createStructuredPayload(prompt, context, options);
  }

  public withToolHandler(handler: ToolCallHandler) {
    this.setToolCallHandler(handler);
    return this;
  }

  public getToolHandler(): ToolCallHandler | undefined {
    return (this as any).toolCallHandler;
  }
}

describe('BaseAIProvider (SDK)', () => {
  it('filters out tool_use JSON blocks from responses', () => {
    const provider = new TestProvider();
    const content = 'Intro text\n{"type":"tool_use","name":"run_shell","input":{}}\nOutro text';
    const result = provider.filter(content);
    expect(result).toContain('Intro text');
    expect(result).toContain('Outro text');
    expect(result).not.toContain('tool_use');
  });

  it('creates structured payload when messages are present', () => {
    const provider = new TestProvider();
    const payloadRaw = provider.buildPayload('Prompt', null, {
      agentId: 'cli/tester',
      model: 'test-model',
      messages: [
        { text: 'Hi', isAssistant: false },
        { text: 'Hello!', isAssistant: true },
      ],
    });

    const payload = JSON.parse(payloadRaw);
    expect(payload.prompt).toBe('Prompt');
    expect(payload.messages).toHaveLength(2);
    expect(payload.agent.provider).toBe('cli/test');
    expect(payload.metadata.messageCount).toBe(2);
  });

  it('resolves provider-specific default timeouts using provider name', () => {
    const claudeProvider = new TestProvider('cli/claude');
    const claudeTimeout = (claudeProvider as any).getDefaultQueryTimeout();
    expect(claudeTimeout).toBeGreaterThan(0);

    const copilotProvider = new TestProvider('cli/copilot');
    const copilotTimeout = (copilotProvider as any).getDefaultExecuteTimeout();
    expect(copilotTimeout).toBeGreaterThan(0);
  });

  it('stores injected tool handler for downstream consumers', () => {
    const handler: ToolCallHandler = {
      list: () => [],
      execute: async () => ({ success: true }),
    };

    const provider = new TestProvider().withToolHandler(handler);
    expect(provider.getToolHandler()).toBe(handler);
  });
});
