import { describe, it, expect, vi } from 'vitest';
import { ClaudeProvider } from '../../../src/core/providers/claude.provider';
import type { Tool, ToolExecutionResult, ToolCallHandler } from '../../../src/core/providers/tool-call.types';

const mockTools: Tool[] = [
  {
    name: 'run_shell',
    description: 'Execute shell command',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
  },
];

describe('ClaudeProvider (SDK)', () => {
  it('delegates to tool handler when tool use is detected', async () => {
    const executeResult: ToolExecutionResult = {
      success: true,
      data: { stdout: 'ok' },
    };

    const handler: ToolCallHandler = {
      list: vi.fn(() => mockTools),
      execute: vi.fn(async () => executeResult),
    };

    const provider = new ClaudeProvider({ toolCallHandler: handler });

    const querySpy = vi
      .spyOn(provider, 'query')
      .mockResolvedValueOnce({
        content: JSON.stringify({
          type: 'tool_use',
          name: 'run_shell',
          input: { command: 'echo test' },
        }),
        provider: provider.name,
        command: 'claude query',
        success: true,
      })
      .mockResolvedValueOnce({
        content: 'Final answer',
        provider: provider.name,
        command: 'claude query',
        success: true,
      });

    const result = await provider.queryWithTools('Run command');

    expect(result.success).toBe(true);
    expect(result.content).toBe('Final answer');
    expect(handler.execute).toHaveBeenCalledWith('run_shell', { command: 'echo test' });
    expect(querySpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to base query when handler is missing', async () => {
    const provider = new ClaudeProvider();
    const querySpy = vi
      .spyOn(provider, 'query')
      .mockResolvedValue({
        content: 'Plain response',
        provider: provider.name,
        command: 'claude query',
        success: true,
      });

    const result = await provider.queryWithTools('No handler');
    expect(result.content).toBe('Plain response');
    expect(querySpy).toHaveBeenCalledOnce();
  });
});
