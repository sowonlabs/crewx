import { describe, it, expect, vi } from 'vitest';
import { CopilotProvider } from '../../../src/core/providers/copilot.provider';
import type { Tool, ToolCallHandler } from '../../../src/core/providers/tool-call.types';

const shellTool: Tool = {
  name: 'run_shell',
  description: 'Run shell command',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string' },
    },
    required: ['command'],
  },
};

describe('CopilotProvider (SDK)', () => {
  it('falls back to standard query when tool handler is missing', async () => {
    const provider = new CopilotProvider();
    const querySpy = vi.spyOn(provider, 'query').mockResolvedValue({
      content: 'Base response',
      provider: provider.name,
      command: 'copilot query',
      success: true,
    });

    const response = await provider.queryWithTools('Hello');
    expect(response.content).toBe('Base response');
    expect(querySpy).toHaveBeenCalledOnce();
    querySpy.mockRestore();
  });

  it('executes tools when handler available', async () => {
    const handler: ToolCallHandler = {
      list: vi.fn(() => [shellTool]),
      execute: vi.fn(async () => ({ success: true, data: { stdout: 'done' } })),
    };

    const provider = new CopilotProvider({ toolCallHandler: handler });

    const querySpy = vi.spyOn(provider, 'query')
      .mockResolvedValueOnce({
        content: JSON.stringify({
          type: 'tool_use',
          name: 'run_shell',
          input: { command: 'pwd' },
        }),
        provider: provider.name,
        command: 'copilot query',
        success: true,
      })
      .mockResolvedValueOnce({
        content: 'Completed',
        provider: provider.name,
        command: 'copilot query',
        success: true,
      });

    const response = await provider.queryWithTools('Run command');
    querySpy.mockRestore();
    expect(response.content).toBe('Completed');
    expect(handler.execute).toHaveBeenCalledWith('run_shell', { command: 'pwd' });
  });
});
