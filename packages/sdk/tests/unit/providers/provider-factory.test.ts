/**
 * Tests for createProviderFromConfig factory function
 */

import { describe, it, expect } from 'vitest';
import { createProviderFromConfig } from '../../../src/core/providers/provider-factory';
import { ClaudeProvider } from '../../../src/core/providers/claude.provider';
import { GeminiProvider } from '../../../src/core/providers/gemini.provider';
import { CopilotProvider } from '../../../src/core/providers/copilot.provider';
import { CodexProvider } from '../../../src/core/providers/codex.provider';

describe('createProviderFromConfig', () => {
  describe('Built-in Providers', () => {
    it('should create ClaudeProvider for cli/claude', async () => {
      const provider = await createProviderFromConfig({
        namespace: 'cli',
        id: 'claude',
      });

      expect(provider).toBeInstanceOf(ClaudeProvider);
      expect(provider.name).toBe('cli/claude');
    });

    it('should create GeminiProvider for cli/gemini', async () => {
      const provider = await createProviderFromConfig({
        namespace: 'cli',
        id: 'gemini',
      });

      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.name).toBe('cli/gemini');
    });

    it('should create CopilotProvider for cli/copilot', async () => {
      const provider = await createProviderFromConfig({
        namespace: 'cli',
        id: 'copilot',
      });

      expect(provider).toBeInstanceOf(CopilotProvider);
      expect(provider.name).toBe('cli/copilot');
    });

    it('should create CodexProvider for cli/codex', async () => {
      const provider = await createProviderFromConfig({
        namespace: 'cli',
        id: 'codex',
      });

      expect(provider).toBeInstanceOf(CodexProvider);
      expect(provider.name).toBe('cli/codex');
    });

    it('should handle case-insensitive provider IDs', async () => {
      const provider1 = await createProviderFromConfig({
        namespace: 'CLI',
        id: 'CLAUDE',
      });

      const provider2 = await createProviderFromConfig({
        namespace: 'Cli',
        id: 'Claude',
      });

      expect(provider1).toBeInstanceOf(ClaudeProvider);
      expect(provider2).toBeInstanceOf(ClaudeProvider);
    });
  });

  describe('Unknown Providers', () => {
    it('should throw error for unknown provider namespace', async () => {
      await expect(async () => {
        await createProviderFromConfig({
          namespace: 'unknown',
          id: 'provider',
        });
      }).rejects.toThrow(/Unknown provider 'unknown\/provider'/);
    });

    it('should throw error for unknown provider ID in cli namespace', async () => {
      await expect(async () => {
        await createProviderFromConfig({
          namespace: 'cli',
          id: 'nonexistent',
        });
      }).rejects.toThrow(/Unknown provider 'cli\/nonexistent'/);
    });

    it('should include available providers in error message', async () => {
      try {
        await createProviderFromConfig({
          namespace: 'cli',
          id: 'invalid',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('cli/claude');
        expect((error as Error).message).toContain('cli/gemini');
        expect((error as Error).message).toContain('cli/copilot');
        expect((error as Error).message).toContain('cli/codex');
      }
    });
  });

  describe('Dynamic Providers (Plugin/Remote)', () => {
    it('should throw error for plugin providers (not implemented yet)', async () => {
      await expect(async () => {
        await createProviderFromConfig({
          namespace: 'plugin',
          id: 'custom-ai',
        });
      }).rejects.toThrow(/Dynamic provider 'plugin\/custom-ai' is not supported yet/);
    });

    it('should throw error for remote providers (not implemented yet)', async () => {
      await expect(async () => {
        await createProviderFromConfig({
          namespace: 'remote',
          id: 'api-provider',
        });
      }).rejects.toThrow(/Dynamic provider 'remote\/api-provider' is not supported yet/);
    });

    it('should suggest workaround in error message', async () => {
      try {
        await createProviderFromConfig({
          namespace: 'plugin',
          id: 'test',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Inject an AIProvider instance directly');
      }
    });
  });

  describe('Provider Configuration', () => {
    it('should accept additional config fields (apiKey, model)', async () => {
      // These fields are passed in ProviderConfig but not used by factory
      // They're meant for the provider instance itself
      const provider = await createProviderFromConfig({
        namespace: 'cli',
        id: 'claude',
        apiKey: 'test-key',
        model: 'claude-3-opus',
      });

      expect(provider).toBeInstanceOf(ClaudeProvider);
    });

    it('should create new instance for each call', async () => {
      const provider1 = await createProviderFromConfig({
        namespace: 'cli',
        id: 'claude',
      });

      const provider2 = await createProviderFromConfig({
        namespace: 'cli',
        id: 'claude',
      });

      // Should be different instances
      expect(provider1).not.toBe(provider2);
      expect(provider1).toBeInstanceOf(ClaudeProvider);
      expect(provider2).toBeInstanceOf(ClaudeProvider);
    });
  });
});
