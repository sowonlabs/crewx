/**
 * OpenRouter Live Integration Test
 *
 * Tests MastraAPIProvider with real OpenRouter API calls
 * OpenRouter is OpenAI-compatible, so we use api/openai provider
 *
 * Setup:
 * 1. Get API key from https://openrouter.ai/keys
 * 2. Set OPENROUTER_API_KEY in .env or environment
 * 3. Run: npm test -- openrouter-live.test.ts
 *
 * Note: This test makes real API calls and will incur costs
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MastraAPIProvider } from '../../src/core/providers/MastraAPIProvider';
import type { APIProviderConfig } from '../../src/types/api-provider.types';

// Skip tests if no API key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const shouldSkip = !OPENROUTER_API_KEY;

describe.skipIf(shouldSkip)('OpenRouter Live Integration', () => {
  let provider: MastraAPIProvider;

  beforeAll(() => {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not set');
    }

    const config: APIProviderConfig = {
      provider: 'api/openai', // OpenRouter is OpenAI-compatible
      url: 'https://openrouter.ai/api/v1',
      apiKey: OPENROUTER_API_KEY,
      model: 'z-ai/glm-4.5-air:free', // Free model for testing
      temperature: 0.7,
      maxTokens: 500,
    };

    provider = new MastraAPIProvider(config);
  });

  describe('Basic Query', () => {
    it('should successfully query OpenRouter API', async () => {
      const result = await provider.query('Say "Hello from OpenRouter!"', {
        model: 'z-ai/glm-4.5-air:free',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeTruthy();
      expect(result.provider).toBe('api/openai');
      expect(result.model).toBe('z-ai/glm-4.5-air:free');

      console.log('✅ OpenRouter Response:', result.content);
    }, 30000); // 30s timeout

    it('should handle simple math question', async () => {
      const result = await provider.query('What is 7 + 5? Answer with only the number.', {
        model: 'z-ai/glm-4.5-air:free',
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('12');

      console.log('✅ Math Response:', result.content);
    }, 30000);
  });

  describe('Different Models', () => {
    it('should work with different free models', async () => {
      const models = [
        'z-ai/glm-4.5-air:free',
        'z-ai/glm-4.5-air:free',
      ];

      for (const model of models) {
        const result = await provider.query(`Say "Testing ${model}"`, {
          model,
        });

        expect(result.success).toBe(true);
        expect(result.content).toBeTruthy();
        expect(result.model).toBe(model);

        console.log(`✅ ${model}:`, result.content.substring(0, 100));
      }
    }, 60000); // 60s for multiple calls
  });

  describe('Context and Messages', () => {
    it('should handle conversation context', async () => {
      const result = await provider.query('What did I just say?', {
        model: 'z-ai/glm-4.5-air:free',
        messages: [
          {
            id: 'msg-1',
            text: 'My name is Alice',
            timestamp: new Date().toISOString(),
            isAssistant: false,
          },
          {
            id: 'msg-2',
            text: 'Nice to meet you, Alice!',
            timestamp: new Date().toISOString(),
            isAssistant: true,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.content.toLowerCase()).toMatch(/alice|name/);

      console.log('✅ Context Response:', result.content);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid model gracefully', async () => {
      await expect(async () => {
        await provider.query('test', {
          model: 'invalid/model/name',
        });
      }).rejects.toThrow();
    }, 30000);

    it('should handle empty prompt', async () => {
      const result = await provider.query('', {
        model: 'z-ai/glm-4.5-air:free',
      });

      // Should either succeed with minimal response or fail gracefully
      expect(result).toBeDefined();
    }, 30000);
  });

  describe('Provider Info', () => {
    it('should return correct provider name', () => {
      expect(provider.name).toBe('api/openai');
    });

    it('should be available', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should not have tool path (API provider)', async () => {
      const toolPath = await provider.getToolPath();
      expect(toolPath).toBeNull();
    });
  });
});

describe('OpenRouter Configuration Examples', () => {
  it('should show example configurations', () => {
    const examples = {
      basic: {
        provider: 'api/openai',
        url: 'https://openrouter.ai/api/v1',
        apiKey: '{{env.OPENROUTER_API_KEY}}',
        model: 'z-ai/glm-4.5-air:free',
      },
      advanced: {
        provider: 'api/openai',
        url: 'https://openrouter.ai/api/v1',
        apiKey: '{{env.OPENROUTER_API_KEY}}',
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        maxTokens: 4000,
      },
    };

    expect(examples.basic.provider).toBe('api/openai');
    expect(examples.advanced.model).toBe('anthropic/claude-3.5-sonnet');

    console.log('\n📋 OpenRouter Config Examples:\n', JSON.stringify(examples, null, 2));
  });
});

// Usage instructions
if (shouldSkip) {
  console.warn(`
⚠️  OpenRouter Live Tests Skipped

To run these tests:
1. Get API key: https://openrouter.ai/keys
2. Set environment variable:
   export OPENROUTER_API_KEY="your-key-here"
3. Run tests:
   npm test -- openrouter-live.test.ts

Free models available:
- z-ai/glm-4.5-air:free (recommended)
- z-ai/glm-4.5-air:free
- qwen/qwen-2-7b-instruct:free
  `);
}
