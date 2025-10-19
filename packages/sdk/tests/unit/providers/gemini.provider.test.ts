import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider } from '../../../src/core/providers/gemini.provider';
import { BaseAIProvider } from '../../../src/core/providers/base-ai.provider';
import type { Tool, ToolExecutionResult, ToolCallHandler } from '../../../src/core/providers/tool-call.types';

const toolDefinition: Tool = {
  name: 'inspect',
  description: 'Inspect a resource',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string' },
    },
    required: ['target'],
  },
};

describe('GeminiProvider (SDK)', () => {
  it('runs multi-turn flow with tool handler', async () => {
    const handler: ToolCallHandler = {
      list: vi.fn(() => [toolDefinition]),
      execute: vi.fn(async () => ({ success: true, data: { status: 'ok' } })),
    };

    const provider = new GeminiProvider({ toolCallHandler: handler });

    const querySpy = vi
      .spyOn(BaseAIProvider.prototype, 'query')
      .mockResolvedValueOnce({
        content: JSON.stringify({
          type: 'tool_use',
          name: 'inspect',
          input: { target: 'sample' },
        }),
        provider: provider.name,
        command: 'gemini query',
        success: true,
      })
      .mockResolvedValueOnce({
        content: 'Inspection complete',
        provider: provider.name,
        command: 'gemini query',
        success: true,
      });

    const response = await provider.queryWithTools('Inspect');
    querySpy.mockRestore();
    expect(response.content).toBe('Inspection complete');
    expect(handler.execute).toHaveBeenCalledWith('inspect', { target: 'sample' });
  });

  it('execute delegates to queryWithTools when tool handler is provided', async () => {
    const handler: ToolCallHandler = {
      list: vi.fn(() => [toolDefinition]),
      execute: vi.fn(async () => ({ success: true } as ToolExecutionResult)),
    };

    const provider = new GeminiProvider({ toolCallHandler: handler });
    const spy = vi.spyOn(provider, 'queryWithTools').mockResolvedValue({
      content: 'ok',
      provider: provider.name,
      command: 'gemini query',
      success: true,
    });

    const result = await provider.execute('prompt');
    expect(result.content).toBe('ok');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
