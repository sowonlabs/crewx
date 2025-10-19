/**
 * Tests for YAML configuration loader
 */

import { describe, it, expect, vi } from 'vitest';
import {
  loadAgentConfigFromYaml,
  validateAgentConfig,
  YamlConfigError,
} from '../../../src/config/yaml-loader';
import type { CrewxAgentConfig } from '../../../src/core/agent/agent-factory';

// Unmock js-yaml for these tests since we need the real implementation
vi.unmock('js-yaml');

describe('YAML Loader', () => {
  describe('loadAgentConfigFromYaml', () => {
    it('should parse basic agent configuration', () => {
      // Use proper YAML formatting (no leading newline in test string)
      const yaml = `agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-opus`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.defaultAgentId).toBe('backend');
      expect(config.provider).toBeDefined();
      expect(config.provider?.namespace).toBe('cli');
      expect(config.provider?.id).toBe('claude');
      expect(config.provider?.model).toBe('claude-3-opus');
    });

    it('should parse agent with knowledge base path', () => {
      const yaml = `agents:
  backend:
    provider: mcp/custom
    knowledgeBase: ./docs`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.defaultAgentId).toBe('backend');
      expect(config.knowledgeBase).toBeDefined();
      expect(config.knowledgeBase?.path).toBe('./docs');
    });

    it('should parse agent with knowledge base sources array', () => {
      const yaml = `agents:
  backend:
    provider: cli/gemini
    knowledgeBase:
      - ./docs
      - ./README.md`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.knowledgeBase).toBeDefined();
      expect(config.knowledgeBase?.sources).toEqual(['./docs', './README.md']);
    });

    it('should parse agent with API key', () => {
      const yaml = `agents:
  backend:
    provider: cli/codex
    inline:
      apiKey: test-api-key
      model: gpt-4`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.provider?.apiKey).toBe('test-api-key');
      expect(config.provider?.model).toBe('gpt-4');
    });

    it('should use first agent as default when multiple agents', () => {
      const yaml = `agents:
  frontend:
    provider: cli/claude
  backend:
    provider: cli/gemini`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.defaultAgentId).toBe('frontend');
    });

    it('should throw error for empty YAML string', () => {
      expect(() => loadAgentConfigFromYaml('')).toThrow(YamlConfigError);
    });

    it('should throw error for invalid YAML', () => {
      const invalidYaml = `agents:
  backend:
    provider: [unclosed bracket`;

      expect(() => loadAgentConfigFromYaml(invalidYaml)).toThrow(YamlConfigError);
      expect(() => loadAgentConfigFromYaml(invalidYaml)).toThrow(/Failed to parse YAML/);
    });

    it('should throw error for non-object YAML', () => {
      const yaml = 'just a string';

      expect(() => loadAgentConfigFromYaml(yaml)).toThrow(YamlConfigError);
      expect(() => loadAgentConfigFromYaml(yaml)).toThrow(/must contain a valid object/);
    });

    it('should throw error for invalid provider format', () => {
      const yaml = `agents:
  backend:
    provider: invalid-no-slash`;

      expect(() => loadAgentConfigFromYaml(yaml)).toThrow(YamlConfigError);
      expect(() => loadAgentConfigFromYaml(yaml)).toThrow(/Invalid provider format/);
    });

    it('should throw error for empty provider namespace or id', () => {
      const yaml = `agents:
  backend:
    provider: /empty-namespace`;

      expect(() => loadAgentConfigFromYaml(yaml)).toThrow(YamlConfigError);
      expect(() => loadAgentConfigFromYaml(yaml)).toThrow(/cannot be empty/);
    });

    it('should handle YAML with defaults section', () => {
      const yaml = `defaults:
  provider: cli/claude
  model: claude-3-opus`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.provider).toBeDefined();
      expect(config.provider?.namespace).toBe('cli');
      expect(config.provider?.id).toBe('claude');
    });

    it('should prefer agent config over defaults', () => {
      const yaml = `defaults:
  provider: cli/claude
agents:
  backend:
    provider: cli/gemini`;

      const config = loadAgentConfigFromYaml(yaml);

      // Agent config should override defaults
      expect(config.provider?.id).toBe('gemini');
    });

    it('should handle empty configuration gracefully', () => {
      const yaml = '{}';

      const config = loadAgentConfigFromYaml(yaml);

      expect(config).toEqual({});
    });
  });

  describe('validateAgentConfig', () => {
    it('should validate correct configuration', () => {
      const config: CrewxAgentConfig = {
        provider: {
          namespace: 'cli',
          id: 'claude',
        },
        knowledgeBase: {
          path: './docs',
        },
      };

      expect(validateAgentConfig(config)).toBe(true);
    });

    it('should throw error for non-object config', () => {
      expect(() => validateAgentConfig(null as any)).toThrow(YamlConfigError);
      expect(() => validateAgentConfig(undefined as any)).toThrow(YamlConfigError);
    });

    it('should throw error for provider missing namespace', () => {
      const config: any = {
        provider: {
          id: 'claude',
          // missing namespace
        },
      };

      expect(() => validateAgentConfig(config)).toThrow(YamlConfigError);
      expect(() => validateAgentConfig(config)).toThrow(/namespace and id/);
    });

    it('should throw error for provider missing id', () => {
      const config: any = {
        provider: {
          namespace: 'cli',
          // missing id
        },
      };

      expect(() => validateAgentConfig(config)).toThrow(YamlConfigError);
    });

    it('should throw error for knowledge base without path or sources', () => {
      const config: any = {
        knowledgeBase: {
          // neither path nor sources
        },
      };

      expect(() => validateAgentConfig(config)).toThrow(YamlConfigError);
      expect(() => validateAgentConfig(config)).toThrow(/path or sources/);
    });

    it('should accept knowledge base with path', () => {
      const config: CrewxAgentConfig = {
        knowledgeBase: {
          path: './docs',
        },
      };

      expect(validateAgentConfig(config)).toBe(true);
    });

    it('should accept knowledge base with sources', () => {
      const config: CrewxAgentConfig = {
        knowledgeBase: {
          sources: ['./docs', './README.md'],
        },
      };

      expect(validateAgentConfig(config)).toBe(true);
    });

    it('should accept minimal valid configuration', () => {
      const config: CrewxAgentConfig = {};

      expect(validateAgentConfig(config)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should support requirements-monorepo.md example', () => {
      const yaml = `agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-opus`;

      const config = loadAgentConfigFromYaml(yaml);

      expect(config.defaultAgentId).toBe('backend');
      expect(config.provider?.namespace).toBe('cli');
      expect(config.provider?.id).toBe('claude');
      expect(config.provider?.model).toBe('claude-3-opus');

      // Should pass validation
      expect(validateAgentConfig(config)).toBe(true);
    });

    it('should handle complex multi-agent configuration', () => {
      const yaml = `agents:
  coordinator:
    provider: cli/codex
    inline:
      model: gpt-5-large
    knowledgeBase: ./project-docs
  backend:
    provider: cli/claude
    inline:
      model: claude-3-opus
      apiKey: test-key
    knowledgeBase:
      - ./backend-docs
      - ./api-specs`;

      const config = loadAgentConfigFromYaml(yaml);

      // Should use first agent (coordinator)
      expect(config.defaultAgentId).toBe('coordinator');
      expect(config.provider?.id).toBe('codex');
    });
  });
});
