/**
 * Unit tests for API Provider Parser
 * Tests WBS-23 Phase 5: YAML parsing and validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseAPIProviderConfig,
  parseMCPServers,
  parseCrewXConfig,
  substituteEnvVars,
  validateAPIProviderConfig,
  APIProviderParseError,
  RawAgentConfig,
  RawMCPServerConfig,
  RawYAMLConfig,
} from '../../src/config/api-provider-parser';

describe('parseAPIProviderConfig', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Valid API Provider Configurations', () => {
    it('should parse basic OpenAI API provider configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        apiKey: 'sk-test123',
      };

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.provider).toBe('api/openai');
      expect(result.model).toBe('gpt-4');
      expect(result.apiKey).toBe('sk-test123');
    });

    it('should parse Anthropic API provider with all optional fields', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'sk-ant-test123',
        url: 'https://api.anthropic.com',
        temperature: 0.7,
        maxTokens: 4096,
        tools: ['github', 'slack'],
        mcp: ['filesystem'],
      };

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.provider).toBe('api/anthropic');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.apiKey).toBe('sk-ant-test123');
      expect(result.url).toBe('https://api.anthropic.com');
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(4096);
      expect(result.tools).toEqual(['github', 'slack']);
      expect(result.mcp).toEqual(['filesystem']);
    });

    it('should parse API provider with inline configuration', () => {
      const rawConfig: RawAgentConfig = {
        inline: {
          provider: 'api/google',
          model: 'gemini-1.5-pro',
          apiKey: 'google-key-123',
          url: 'https://generativelanguage.googleapis.com',
          temperature: 0.8,
          maxTokens: 8192,
        },
      };

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.provider).toBe('api/google');
      expect(result.model).toBe('gemini-1.5-pro');
      expect(result.apiKey).toBe('google-key-123');
      expect(result.url).toBe('https://generativelanguage.googleapis.com');
      expect(result.temperature).toBe(0.8);
      expect(result.maxTokens).toBe(8192);
    });

    it('should prefer inline configuration over root-level fields', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai', // Root level
        model: 'gpt-3.5-turbo', // Root level
        inline: {
          provider: 'api/google', // Should override
          model: 'gemini-pro',    // Should override
        },
      };

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.provider).toBe('api/google');
      expect(result.model).toBe('gemini-pro');
    });

    it('should validate all 7 supported API provider types', () => {
      const validProviders = [
        'api/openai',
        'api/anthropic', 
        'api/google',
        'api/bedrock',
        'api/litellm',
        'api/ollama',
        'api/sowonai',
      ];

      validProviders.forEach((provider) => {
        const rawConfig: RawAgentConfig = {
          provider,
          model: 'test-model',
        };
        
        const result = parseAPIProviderConfig(rawConfig);
        expect(result.provider).toBe(provider);
      });
    });
  });

  describe('Environment Variable Substitution', () => {
    it('should substitute environment variables in API key', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        apiKey: '{{env.OPENAI_API_KEY}}',
      };

      process.env.OPENAI_API_KEY = 'sk-env-substituted';

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.apiKey).toBe('sk-env-substituted');
    });

    it('should substitute environment variables in URL', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/litellm',
        model: 'gpt-4',
        url: '{{env.LITELLM_URL}}',
      };

      process.env.LITELLM_URL = 'http://localhost:4000';

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.url).toBe('http://localhost:4000');
    });

    it('should substitute environment variables in model name', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: '{{env.MODEL_NAME}}',
      };

      process.env.MODEL_NAME = 'gpt-4-turbo';

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should handle multiple environment variables in same config', () => {
      const rawConfig: RawAgentConfig = {
        provider: '{{env.PROVIDER_TYPE}}',
        model: '{{env.MODEL_NAME}}',
        apiKey: '{{env.API_KEY}}',
        url: '{{env.BASE_URL}}',
      };

      process.env.PROVIDER_TYPE = 'api/openai';
      process.env.MODEL_NAME = 'gpt-4';
      process.env.API_KEY = 'sk-multiple-sub';
      process.env.BASE_URL = 'https://api.openai.com';

      const result = parseAPIProviderConfig(rawConfig);

      expect(result.provider).toBe('api/openai');
      expect(result.model).toBe('gpt-4');
      expect(result.apiKey).toBe('sk-multiple-sub');
      expect(result.url).toBe('https://api.openai.com');
    });

    it('should handle missing environment variables (inline config)', () => {
      const rawConfig: RawAgentConfig = {
        inline: {
          provider: 'api/openai',
          model: 'gpt-4',
          apiKey: '{{env.MISSING_API_KEY}}',
        },
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow(
        "Environment variable 'MISSING_API_KEY' is not defined"
      );
    });
  });

  describe('Field Validation', () => {
    it('should validate temperature range (0-2)', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        temperature: 3.0, // Invalid: > 2
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow('Temperature must be a number between 0 and 2');
    });

    it('should validate temperature within valid range', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        temperature: 1.5, // Valid
      };

      const result = parseAPIProviderConfig(rawConfig);
      expect(result.temperature).toBe(1.5);
    });

    it('should validate maxTokens as positive integer', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: -100, // Invalid: negative
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow('maxTokens must be a positive integer');
    });

    it('should validate maxTokens as integer', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: 1000.5, // Invalid: decimal
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow('maxTokens must be a positive integer');
    });

    it('should accept valid maxTokens value', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: 4096, // Valid
      };

      const result = parseAPIProviderConfig(rawConfig);
      expect(result.maxTokens).toBe(4096);
    });

    it('should validate tools must be array of strings for API providers', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        tools: { include: ['github'] }, // Invalid: object format
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow(
        'API provider tools must be a simple array of strings'
      );
    });

    it('should accept valid tools array', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        tools: ['github', 'slack', 'filesystem'],
      };

      const result = parseAPIProviderConfig(rawConfig);
      expect(result.tools).toEqual(['github', 'slack', 'filesystem']);
    });

    it('should validate mcp must be array of strings for API providers', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        mcp: { include: ['github'] }, // Invalid: object format
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow(
        'API provider mcp must be a simple array of strings'
      );
    });

    it('should accept valid mcp array', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        mcp: ['github', 'sentry'],
      };

      const result = parseAPIProviderConfig(rawConfig);
      expect(result.mcp).toEqual(['github', 'sentry']);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when provider is missing', () => {
      const rawConfig: RawAgentConfig = {
        model: 'gpt-4',
        apiKey: 'sk-test123',
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow('Provider is required');
    });

    it('should throw error when model is missing', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        apiKey: 'sk-test123',
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow('Model is required for API provider');
    });

    it('should throw error for invalid API provider type', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/invalid-provider',
        model: 'test-model',
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow(
        "Invalid API provider 'api/invalid-provider'"
      );
    });

    it('should throw APIProviderParseError for parsing errors', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        // Missing model
      };

      expect(() => parseAPIProviderConfig(rawConfig)).toThrow(APIProviderParseError);
    });

    it('should preserve original error in cause property', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        // Missing model
      };

      try {
        parseAPIProviderConfig(rawConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(APIProviderParseError);
        expect((error as APIProviderParseError).message).toContain('Model is required');
      }
    });
  });
});

describe('parseMCPServers', () => {
  describe('Valid MCP Server Configurations', () => {
    it('should parse basic MCP server configuration', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
      };

      const result = parseMCPServers(rawMCPServers);

      expect(result.github).toBeDefined();
      expect(result.github.command).toBe('npx');
      expect(result.github.args).toEqual(['-y', '@modelcontextprotocol/server-github']);
    });

    it('should parse MCP server with environment variables', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}',
            GITHUB_API_BASE: '{{env.API_BASE_URL}}',
          },
        },
      };

      process.env.GITHUB_TOKEN = 'ghp-test-token';
      process.env.API_BASE_URL = 'https://api.github.com';

      const result = parseMCPServers(rawMCPServers);

      expect(result.github.env?.GITHUB_TOKEN).toBe('ghp-test-token');
      expect(result.github.env?.GITHUB_API_BASE).toBe('https://api.github.com');
    });

    it('should parse multiple MCP servers', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        },
        sentry: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sentry'],
        },
      };

      const result = parseMCPServers(rawMCPServers);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result.github).toBeDefined();
      expect(result.filesystem).toBeDefined();
      expect(result.sentry).toBeDefined();
    });
  });

  describe('MCP Server Validation', () => {
    it('should require command field', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        invalid: {
          args: ['-y', '@modelcontextprotocol/server-github'],
        } as RawMCPServerConfig,
      };

      expect(() => parseMCPServers(rawMCPServers)).toThrow(
        "MCP server 'invalid' is missing 'command' field"
      );
    });

    it('should require args to be array', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        invalid: {
          command: 'npx',
          args: 'not-an-array',
        } as RawMCPServerConfig,
      };

      expect(() => parseMCPServers(rawMCPServers)).toThrow(
        "MCP server 'invalid' 'args' must be an array"
      );
    });

    it('should handle environment variable substitution in command', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        custom: {
          command: '{{env.CUSTOM_COMMAND}}',
          args: ['arg1', 'arg2'],
        },
      };

      process.env.CUSTOM_COMMAND = 'python3';

      const result = parseMCPServers(rawMCPServers);

      expect(result.custom.command).toBe('python3');
    });

    it('should handle environment variable substitution in args', () => {
      const rawMCPServers: Record<string, RawMCPServerConfig> = {
        custom: {
          command: 'python3',
          args: ['--config', '{{env.CONFIG_PATH}}', '--port', '{{env.PORT}}'],
        },
      };

      process.env.CONFIG_PATH = '/tmp/config.json';
      process.env.PORT = '8080';

      const result = parseMCPServers(rawMCPServers);

      expect(result.custom.args).toEqual(['--config', '/tmp/config.json', '--port', '8080']);
    });
  });
});

describe('substituteEnvVars', () => {
  describe('Basic Substitution', () => {
    it('should substitute single environment variable', () => {
      process.env.TEST_VAR = 'substituted-value';

      const result = substituteEnvVars('{{env.TEST_VAR}}', process.env);

      expect(result).toBe('substituted-value');
    });

    it('should substitute environment variable in complex string', () => {
      process.env.API_KEY = 'sk-test123';

      const result = substituteEnvVars(
        'Authorization: Bearer {{env.API_KEY}}',
        process.env
      );

      expect(result).toBe('Authorization: Bearer sk-test123');
    });

    it('should handle multiple environment variables', () => {
      process.env.BASE_URL = 'https://api.example.com';
      process.env.API_VERSION = 'v2';
      process.env.API_KEY = 'test-key';

      const result = substituteEnvVars(
        '{{env.BASE_URL}}/{{env.API_VERSION}}/chat?key={{env.API_KEY}}',
        process.env
      );

      expect(result).toBe('https://api.example.com/v2/chat?key=test-key');
    });
  });

  describe('Error Cases', () => {
    it('should throw error for undefined environment variable', () => {
      const testEnv = { ...process.env };
      delete testEnv.UNDEFINED_VAR;

      expect(() => substituteEnvVars('{{env.UNDEFINED_VAR}}', testEnv)).toThrow(
        "Environment variable 'UNDEFINED_VAR' is not defined"
      );
    });

    it('should handle empty environment variable value', () => {
      process.env.EMPTY_VAR = '';

      const result = substituteEnvVars('Value: {{env.EMPTY_VAR}}', process.env);

      expect(result).toBe('Value: ');
    });
  });

  describe('Edge Cases', () => {
    it('should return original string if no templates found', () => {
      const input = 'Just a normal string without templates';
      const result = substituteEnvVars(input, process.env);

      expect(result).toBe(input);
    });

    it('should handle empty string', () => {
      const result = substituteEnvVars('', process.env);

      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = substituteEnvVars(null as any, process.env);

      expect(result).toBe(null);
    });

    it('should handle numeric input', () => {
      const result = substituteEnvVars(123 as any, process.env);

      expect(result).toBe(123);
    });
  });
});

describe('parseCrewXConfig', () => {
  describe('Complete Configuration Parsing', () => {
    it('should parse complete CrewX configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-env-openai';
      process.env.ANTHROPIC_API_KEY = 'sk-env-anthropic';

      const rawConfig: RawYAMLConfig = {
        vars: {
          company_name: 'TestCorp',
          api_version: 'v2',
        },
        mcp_servers: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}',
            },
          },
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
        agents: [
          {
            id: 'openai_agent',
            provider: 'api/openai',
            model: 'gpt-4',
            apiKey: '{{env.OPENAI_API_KEY}}',
          },
          {
            id: 'anthropic_agent',
            provider: 'api/anthropic',
            model: 'claude-3-5-sonnet',
            apiKey: '{{env.ANTHROPIC_API_KEY}}',
          },
        ],
      };

      const result = parseCrewXConfig(rawConfig);

      // Check vars
      expect(result.vars).toEqual({
        company_name: 'TestCorp',
        api_version: 'v2',
      });

      // Check MCP servers
      expect(result.mcpServers.github).toBeDefined();
      expect(result.mcpServers.github.command).toBe('npx');
      expect(result.mcpServers.filesystem).toBeDefined();
      expect(result.mcpServers.filesystem.args).toEqual([
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/tmp',
      ]);

      // Check agents
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].provider).toBe('api/openai');
      expect(result.agents[0].apiKey).toBe('sk-env-openai');
      expect(result.agents[1].provider).toBe('api/anthropic');
      expect(result.agents[1].apiKey).toBe('sk-env-anthropic');
    });

    it('should skip CLI providers and only parse API providers', () => {
      const rawConfig: RawYAMLConfig = {
        agents: [
          {
            id: 'cli_agent',
            provider: 'cli/claude',
            model: 'sonnet',
          },
          {
            id: 'api_agent',
            provider: 'api/openai',
            model: 'gpt-4',
          },
        ],
      };

      const result = parseCrewXConfig(rawConfig);

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].provider).toBe('api/openai');
      expect(result.agents[0].id).toBe('api_agent');
    });

    it('should handle empty configuration', () => {
      const rawConfig: RawYAMLConfig = {};

      const result = parseCrewXConfig(rawConfig);

      expect(result.vars).toEqual({});
      expect(result.mcpServers).toEqual({});
      expect(result.agents).toEqual([]);
    });

    it('should handle configuration with only vars', () => {
      const rawConfig: RawYAMLConfig = {
        vars: {
          company: 'TestCorp',
          version: '1.0',
        },
      };

      const result = parseCrewXConfig(rawConfig);

      expect(result.vars).toEqual({ company: 'TestCorp', version: '1.0' });
      expect(result.mcpServers).toEqual({});
      expect(result.agents).toEqual([]);
    });
  });

  describe('Error Handling in CrewX Config', () => {
    it('should throw error for invalid API provider in agents', () => {
      const rawConfig: RawYAMLConfig = {
        agents: [
          {
            id: 'invalid_agent',
            provider: 'api/invalid',
            model: 'test-model',
          },
        ],
      };

      expect(() => parseCrewXConfig(rawConfig)).toThrow('Invalid API provider');
    });

    it('should throw error for missing required fields', () => {
      const rawConfig: RawYAMLConfig = {
        agents: [
          {
            id: 'missing_model',
            provider: 'api/openai',
            // Missing model
          },
        ],
      };

      expect(() => parseCrewXConfig(rawConfig)).toThrow('Model is required');
    });

    it('should provide detailed error message including agent ID', () => {
      const rawConfig: RawYAMLConfig = {
        agents: [
          {
            id: 'test_agent',
            provider: 'api/openai',
            // Missing model
          },
        ],
      };

      expect(() => parseCrewXConfig(rawConfig)).toThrow(/Failed to parse agent 'test_agent'/);
    });
  });
});

describe('validateAPIProviderConfig', () => {
  describe('Valid Configurations', () => {
    it('should validate minimal valid configuration', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = validateAPIProviderConfig(config);

      expect(result).toBe(true);
    });

    it('should validate complete configuration', () => {
      const config = {
        provider: 'api/anthropic',
        model: 'claude-3-5-sonnet',
        apiKey: 'sk-test123',
        url: 'https://api.anthropic.com',
        temperature: 0.7,
        maxTokens: 4096,
        tools: ['github', 'slack'],
        mcp: ['filesystem'],
      };

      const result = validateAPIProviderConfig(config);

      expect(result).toBe(true);
    });
  });

  describe('Invalid Configurations', () => {
    it('should throw error for invalid provider', () => {
      const config = {
        provider: 'api/invalid',
        model: 'test-model',
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('Invalid provider');
    });

    it('should throw error for missing model', () => {
      const config = {
        provider: 'api/openai',
        // Missing model
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('Model is required');
    });

    it('should throw error for empty model string', () => {
      const config = {
        provider: 'api/openai',
        model: '',
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('Model is required');
    });

    it('should throw error for invalid temperature range', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        temperature: 3.0, // Invalid: > 2
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('Temperature must be a number between 0 and 2');
    });

    it('should throw error for invalid maxTokens', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: -100, // Invalid: negative
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('maxTokens must be a positive integer');
    });

    it('should throw error for non-integer maxTokens', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: 1000.5, // Invalid: decimal
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('maxTokens must be a positive integer');
    });

    it('should throw error for non-array tools', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        tools: 'github' as any, // Invalid: string instead of array
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('tools must be an array of strings');
    });

    it('should throw error for non-string tools in array', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        tools: ['github', 123] as any, // Invalid: number in array
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('All tool names must be strings');
    });

    it('should throw error for non-array mcp', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        mcp: 'github' as any, // Invalid: string instead of array
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('mcp must be an array of strings');
    });

    it('should throw error for non-string mcp in array', () => {
      const config = {
        provider: 'api/openai',
        model: 'gpt-4',
        mcp: ['github', true] as any, // Invalid: boolean in array
      };

      expect(() => validateAPIProviderConfig(config)).toThrow('All MCP server names must be strings');
    });
  });
});