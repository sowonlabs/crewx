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

  public filterRuntime(content: string): string {
    return this.filterRuntimeLogs(content);
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

  it('extracts agent_message text from JSONL responses', () => {
    const provider = new TestProvider();
    const content = [
      '{"type":"thread.started","thread_id":"thread_1"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"Final response"}}',
      '{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":2}}',
    ].join('\n');

    const result = provider.filter(content);
    expect(result).toBe('Final response');
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

  it('filters out [AgentRuntime] log lines from responses', () => {
    const provider = new TestProvider();
    const content = [
      'Loaded layout: crewx/default from default.yaml',
      '',
      '[AgentRuntime] Starting query for agent: crewx_claude_dev',
      'Here is the actual AI response text.',
      '[AgentRuntime] Query completed for agent: crewx_claude_dev (provider: cli/claude, success: true)',
    ].join('\n');

    const result = provider.filterRuntime(content);
    expect(result).toBe('Here is the actual AI response text.');
    expect(result).not.toContain('[AgentRuntime]');
    expect(result).not.toContain('Loaded layout');
  });

  it('returns original content when no runtime logs are present', () => {
    const provider = new TestProvider();
    const content = 'Normal AI response without any runtime logs.';
    const result = provider.filterRuntime(content);
    expect(result).toBe(content);
  });

  it('handles empty and falsy input in filterRuntimeLogs', () => {
    const provider = new TestProvider();
    expect(provider.filterRuntime('')).toBe('');
  });

  it('filters mixed runtime logs and preserves multi-line responses', () => {
    const provider = new TestProvider();
    const content = [
      '[AgentRuntime] Starting query for agent: test_agent',
      'Line 1 of response.',
      'Loaded layout: crewx/custom from custom.yaml',
      'Line 2 of response.',
      '[AgentRuntime] Query completed for agent: test_agent (provider: cli/claude, success: true)',
    ].join('\n');

    const result = provider.filterRuntime(content);
    expect(result).toContain('Line 1 of response.');
    expect(result).toContain('Line 2 of response.');
    expect(result).not.toContain('[AgentRuntime]');
    expect(result).not.toContain('Loaded layout');
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
