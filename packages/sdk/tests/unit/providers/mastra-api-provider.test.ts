/**
 * Unit tests for MastraAPIProvider multi-step tool calling (#114)
 *
 * Tests:
 * - maxSteps configuration and default values
 * - convertResponse handles multi-step tool calls from steps[]
 * - convertResponse backward-compatible with single tool call
 * - AIResponse.toolCalls contains all tool calls across steps
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_MAX_STEPS, MAX_STEPS_LIMIT } from '../../../src/types/api-provider.types';

// We test MastraAPIProvider by intercepting the Agent class.
// Since the real Agent constructor does complex setup, we mock the entire
// module and capture the generate() arguments.
let capturedAgentConfig: any = null;
let capturedGenerateArgs: any[] = [];
let mockGenerateReturn: any = { text: 'mock response', steps: [] };

vi.mock('@mastra/core', () => {
  return {
    Agent: class MockAgent {
      constructor(config: any) {
        capturedAgentConfig = config;
      }
      async generate(...args: any[]) {
        capturedGenerateArgs = args;
        return mockGenerateReturn;
      }
    },
  };
});

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-openai-model'),
  createOpenAI: vi.fn(() => () => 'mock-openai-model'),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mock-anthropic-model'),
  createAnthropic: vi.fn(() => () => 'mock-anthropic-model'),
}));
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'mock-google-model'),
  createGoogleGenerativeAI: vi.fn(() => () => 'mock-google-model'),
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => () => 'mock-openrouter-model'),
}));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => () => 'mock-compatible-model'),
}));

// Import after mocks are defined
import { MastraAPIProvider } from '../../../src/core/providers/MastraAPIProvider';
import type { APIProviderConfig } from '../../../src/types/api-provider.types';

describe('MastraAPIProvider - Multi-step Tool Calling (#114)', () => {
  let provider: MastraAPIProvider;

  const baseConfig: APIProviderConfig = {
    provider: 'api/openai',
    model: 'gpt-4o',
    apiKey: 'test-key',
  };

  beforeEach(() => {
    capturedAgentConfig = null;
    capturedGenerateArgs = [];
    mockGenerateReturn = { text: 'mock response', steps: [] };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('maxSteps Configuration', () => {
    it('should pass DEFAULT_MAX_STEPS when not configured', async () => {
      provider = new MastraAPIProvider(baseConfig);
      await provider.query('test');

      expect(capturedGenerateArgs[0]).toBe('test');
      expect(capturedGenerateArgs[1]).toEqual({ maxSteps: DEFAULT_MAX_STEPS });
    });

    it('should pass configured maxSteps from config', async () => {
      provider = new MastraAPIProvider({ ...baseConfig, maxSteps: 20 });
      await provider.query('test');

      expect(capturedGenerateArgs[1]).toEqual({ maxSteps: 20 });
    });

    it('should cap maxSteps at MAX_STEPS_LIMIT', async () => {
      provider = new MastraAPIProvider({ ...baseConfig, maxSteps: 100 });
      await provider.query('test');

      expect(capturedGenerateArgs[1]).toEqual({ maxSteps: MAX_STEPS_LIMIT });
    });

    it('should NOT pass toolChoice: required (was the bug root cause)', async () => {
      provider = new MastraAPIProvider(baseConfig);
      await provider.query('test');

      const generateOptions = capturedGenerateArgs[1];
      expect(generateOptions.toolChoice).toBeUndefined();
    });
  });

  describe('convertResponse - Multi-step', () => {
    beforeEach(() => {
      provider = new MastraAPIProvider(baseConfig);
    });

    it('should collect tool calls from all steps', async () => {
      mockGenerateReturn = {
        text: 'Final answer after reading files',
        steps: [
          {
            toolCalls: [{ toolName: 'read_file', args: { file_path: '/a.txt' } }],
            toolResults: [{ result: 'content of a' }],
          },
          {
            toolCalls: [{ toolName: 'grep', args: { pattern: 'foo' } }],
            toolResults: [{ result: 'line 5: foo' }],
          },
          {
            toolCalls: [{ toolName: 'run_shell_command', args: { command: 'ls' } }],
            toolResults: [{ result: 'file1.ts\nfile2.ts' }],
          },
        ],
        toolCalls: [{ toolName: 'run_shell_command', args: { command: 'ls' } }],
        toolResults: [{ result: 'file1.ts\nfile2.ts' }],
      };

      const result = await provider.query('test multi-step');

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(3);
      expect(result.toolCalls![0].toolName).toBe('read_file');
      expect(result.toolCalls![1].toolName).toBe('grep');
      expect(result.toolCalls![2].toolName).toBe('run_shell_command');
      expect(result.steps).toBe(3);

      // Backward-compatible: first tool call
      expect(result.toolCall!.toolName).toBe('read_file');
    });

    it('should handle single-step with fallback to top-level toolCalls', async () => {
      mockGenerateReturn = {
        text: 'Result',
        steps: [],
        toolCalls: [{ toolName: 'read_file', args: { file_path: '/b.txt' } }],
        toolResults: [{ result: 'content of b' }],
      };

      const result = await provider.query('test single');

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].toolName).toBe('read_file');
      expect(result.toolCall!.toolName).toBe('read_file');
    });

    it('should handle response with no tool calls', async () => {
      mockGenerateReturn = {
        text: 'Simple text answer',
        steps: [],
      };

      const result = await provider.query('test no tools');

      expect(result.success).toBe(true);
      expect(result.content).toBe('Simple text answer');
      expect(result.toolCalls).toBeUndefined();
      expect(result.toolCall).toBeUndefined();
      expect(result.steps).toBeUndefined();
    });

    it('should handle Mastra payload format (nested payload)', async () => {
      mockGenerateReturn = {
        text: 'Answer',
        steps: [
          {
            toolCalls: [{ payload: { toolName: 'read_file', args: { file_path: '/c.txt' } } }],
            toolResults: [{ payload: { result: 'content of c' } }],
          },
        ],
      };

      const result = await provider.query('test payload format');

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].toolName).toBe('read_file');
      expect(result.toolCalls![0].toolResult).toBe('content of c');
    });

    it('should synthesize content from last tool result when text is empty', async () => {
      mockGenerateReturn = {
        text: '',
        steps: [
          {
            toolCalls: [{ toolName: 'read_file', args: { file_path: '/d.txt' } }],
            toolResults: [{ result: 'content of d' }],
          },
          {
            toolCalls: [{ toolName: 'grep', args: { pattern: 'bar' } }],
            toolResults: [{ result: 'line 10: bar' }],
          },
        ],
      };

      const result = await provider.query('test empty content');

      expect(result.content).toContain('grep');
      expect(result.content).toContain('line 10: bar');
    });

    it('should handle multiple tool calls within a single step', async () => {
      mockGenerateReturn = {
        text: 'Parallel results',
        steps: [
          {
            toolCalls: [
              { toolName: 'read_file', args: { file_path: '/x.txt' } },
              { toolName: 'read_file', args: { file_path: '/y.txt' } },
            ],
            toolResults: [
              { result: 'content of x' },
              { result: 'content of y' },
            ],
          },
        ],
      };

      const result = await provider.query('test parallel');

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls![0].toolInput.file_path).toBe('/x.txt');
      expect(result.toolCalls![1].toolInput.file_path).toBe('/y.txt');
    });
  });

  describe('Constants', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_MAX_STEPS).toBe(10);
      expect(MAX_STEPS_LIMIT).toBe(50);
      expect(MAX_STEPS_LIMIT).toBeGreaterThan(DEFAULT_MAX_STEPS);
    });
  });
});
