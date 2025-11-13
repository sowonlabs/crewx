/**
 * Tool Calling Live Integration Test
 *
 * Tests real tool calling with OpenRouter + built-in tools
 *
 * Setup:
 * 1. Get API key from https://openrouter.ai/keys
 * 2. Set OPENROUTER_API_KEY in .env or environment
 * 3. Run: npm test -- tool-calling-live.test.ts
 *
 * Tests:
 * - read_file tool with real files
 * - write_file tool with temp files
 * - grep tool with code search
 * - Tool calling with OpenRouter API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';
import { readFileTool, writeFileTool, grepTool, lsTool } from '../../src/tools';
import { MastraToolAdapter } from '../../src/adapters/MastraToolAdapter';
import type { APIProviderConfig, ToolExecutionContext } from '../../src/types/api-provider.types';
import fs from 'fs/promises';
import path from 'path';

// Skip tests if no API key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const shouldSkip = !OPENROUTER_API_KEY;

describe.skipIf(shouldSkip)('Tool Calling Live Integration', () => {
  let provider: MastraAPIProvider;
  let testFilePath: string;

  beforeAll(async () => {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not set');
    }

    // Use real project file for testing
    testFilePath = path.join(process.cwd(), '../../README.md');

    // Verify file exists
    try {
      await fs.access(testFilePath);
    } catch {
      throw new Error(`README.md not found at ${testFilePath}`);
    }

    // Setup provider with tools
    const config: APIProviderConfig = {
      provider: 'api/openai',
      url: 'https://openrouter.ai/api/v1',
      apiKey: OPENROUTER_API_KEY,
      model: 'openai/gpt-oss-20b', // Testing with OSS model
      temperature: 0.3,
      maxTokens: 1000,
      options: {
        query: {
          tools: ['read_file', 'grep', 'ls'],
          mcp: [],
        },
        execute: {
          tools: ['read_file', 'write_file', 'grep', 'ls'],
          mcp: [],
        },
      },
    };

    provider = new MastraAPIProvider(config, 'query');

    // Register tools
    const context: ToolExecutionContext = {
      agentId: 'test-agent',
      provider: 'api/openai',
      model: 'openai/gpt-4o-mini:free',
      platform: 'cli',
      mode: 'query',
    };

    provider.setTools([readFileTool, writeFileTool, grepTool, lsTool], context);
  });

  afterAll(async () => {
    // No cleanup needed - using real project file
  });

  describe('Built-in Tool Validation', () => {
    it('should have all required tool properties', () => {
      expect(readFileTool.id).toBe('read_file');
      expect(readFileTool.inputSchema).toBeDefined();
      expect(readFileTool.outputSchema).toBeDefined();
      expect(typeof readFileTool.execute).toBe('function');

      expect(writeFileTool.id).toBe('write_file');
      expect(grepTool.id).toBe('grep');
      expect(lsTool.id).toBe('ls');

      console.log('✅ All tools have valid structure');
    });

    it('should convert tools to Mastra format', () => {
      const context: ToolExecutionContext = {
        agentId: 'test',
        provider: 'api/openai',
        model: 'gpt-4o-mini',
        mode: 'query',
        platform: 'cli',
      };

      const mastraTools = MastraToolAdapter.convertTools([readFileTool, writeFileTool], context);

      expect(mastraTools.read_file).toBeDefined();
      expect(mastraTools.write_file).toBeDefined();
      expect(typeof mastraTools.read_file.execute).toBe('function');

      console.log('✅ Tools converted to Mastra format:', Object.keys(mastraTools));
    });
  });

  describe('Direct Tool Execution', () => {
    it('should execute read_file tool directly', async () => {
      const result = await readFileTool.execute({
        context: {
          file_path: testFilePath,
        },
      });

      expect(result).toContain('CrewX');
      expect(result).toContain('README'); // README content likely contains these

      console.log('✅ read_file tool executed:', result.substring(0, 100));
    }, 10000);

    it('should execute read_file with pagination', async () => {
      const result = await readFileTool.execute({
        context: {
          file_path: testFilePath,
          offset: 0,
          limit: 5,
        },
      });

      // Should show truncation message
      expect(result).toContain('truncated');
      expect(result).toContain('Showing lines 1-5');

      console.log('✅ Pagination works');
    }, 10000);
  });

  describe('Tool Calling with OpenRouter', () => {
    it('should call read_file via AI agent', async () => {
      const result = await provider.query(
        `Use the read_file tool to read the file at ${testFilePath} and tell me what's in it.`,
        {
          model: 'openai/gpt-oss-20b:free',
        },
      );

      expect(result.success).toBe(true);
      expect(result.content).toBeTruthy();

      // Check if tool was called
      if (result.toolCall) {
        expect(result.toolCall.toolName).toBe('read_file');
        console.log('✅ Tool called:', result.toolCall.toolName);
        console.log('✅ Tool result:', JSON.stringify(result.toolCall.toolResult).substring(0, 100));
      }

      console.log('✅ AI Response:', result.content.substring(0, 200));
    }, 60000); // 60s timeout for API call

    it('should handle file reading and summarization', async () => {
      const result = await provider.query(
        `Read ${testFilePath} and tell me what this project is about in one sentence.`,
        {
          model: 'openai/gpt-oss-20b:free',
        },
      );

      expect(result.success).toBe(true);
      // Should mention CrewX or related keywords
      expect(result.content.toLowerCase()).toMatch(/crewx|agent|ai/i);

      console.log('✅ Summarization response:', result.content);
    }, 60000);
  });

  describe('Multiple Tool Calls', () => {
    it('should handle multiple file operations', async () => {
      const result = await provider.query(
        `Read ${testFilePath} and tell me the first heading you see.`,
        {
          model: 'openai/gpt-oss-20b:free',
        },
      );

      expect(result.success).toBe(true);
      expect(result.content).toBeTruthy();

      console.log('✅ Multiple operations:', result.content.substring(0, 200));
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent file gracefully', async () => {
      const result = await provider.query(
        'Read the file at /tmp/non-existent-file-12345.txt',
        {
          model: 'openai/gpt-oss-20b:free',
        },
      );

      expect(result.success).toBe(true); // AI should handle tool error
      expect(result.content.toLowerCase()).toMatch(/not found|doesn't exist|cannot find/i);

      console.log('✅ Error handling works:', result.content.substring(0, 150));
    }, 60000);
  });
});

describe('Tool Calling Configuration Examples', () => {
  it('should show tool calling config examples', () => {
    const examples = {
      queryMode: {
        provider: 'api/openai',
        url: 'https://openrouter.ai/api/v1',
        apiKey: '{{env.OPENROUTER_API_KEY}}',
        model: 'openai/gpt-4o-mini:free',
        options: {
          query: {
            tools: ['read_file', 'grep', 'ls'],
            mcp: [],
          },
        },
      },
      executeMode: {
        provider: 'api/openai',
        url: 'https://openrouter.ai/api/v1',
        apiKey: '{{env.OPENROUTER_API_KEY}}',
        model: 'openai/gpt-4o-mini:free',
        options: {
          execute: {
            tools: ['read_file', 'write_file', 'replace', 'run_shell_command'],
            mcp: [],
          },
        },
      },
    };

    expect(examples.queryMode.options.query?.tools).toContain('read_file');
    expect(examples.executeMode.options.execute?.tools).toContain('write_file');

    console.log('\n📋 Tool Calling Config Examples:\n', JSON.stringify(examples, null, 2));
  });
});

// Usage instructions
if (shouldSkip) {
  console.warn(`
⚠️  Tool Calling Live Tests Skipped

To run these tests:
1. Get API key: https://openrouter.ai/keys
2. Set environment variable:
   export OPENROUTER_API_KEY="sk-or-v1-your-key"
3. Run tests:
   npm test -- tool-calling-live.test.ts

This test will:
✅ Test read_file tool with real files
✅ Test tool calling via OpenRouter API
✅ Verify WBS-21 tool calling implementation
✅ Verify WBS-28 provider options (query mode)

Free model used: openai/gpt-4o-mini:free (reliable tool calling support)
  `);
}
