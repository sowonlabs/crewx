/**
 * Unit tests for API Provider Configuration Parser
 *
 * Tests parseAPIProviderConfig, parseMCPServers, substituteEnvVars, and validation logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseAPIProviderConfig,
  parseMCPServers,
  substituteEnvVars,
  validateAPIProviderConfig,
  parseCrewXConfig,
  APIProviderParseError,
  type RawAgentConfig,
  type RawMCPServerConfig,
  type RawYAMLConfig,
} from '../../src/config/api-provider-parser';
import type { APIProviderConfig } from '../../src/types/api-provider.types';

describe('substituteEnvVars', () => {
  it('should substitute single environment variable', () => {
    const env = { API_KEY: 'sk-test123' };
    const result = substituteEnvVars('{{env.API_KEY}}', env);
    expect(result).toBe('sk-test123');
  });

  it('should substitute multiple environment variables', () => {
    const env = { HOST: 'api.openai.com', PORT: '443' };
    const result = substituteEnvVars('https://{{env.HOST}}:{{env.PORT}}/v1', env);
    expect(result).toBe('https://api.openai.com:443/v1');
  });

  it('should handle strings without environment variables', () => {
    const env = {};
    const result = substituteEnvVars('plain string', env);
    expect(result).toBe('plain string');
  });

  it('should throw error for undefined environment variable', () => {
    const env = {};
    expect(() => {
      substituteEnvVars('{{env.UNDEFINED_VAR}}', env);
    }).toThrow(APIProviderParseError);
    expect(() => {
      substituteEnvVars('{{env.UNDEFINED_VAR}}', env);
    }).toThrow("Environment variable 'UNDEFINED_VAR' is not defined");
  });

  it('should handle empty strings', () => {
    const result = substituteEnvVars('', {});
    expect(result).toBe('');
  });
});

describe('parseAPIProviderConfig', () => {
  let mockEnv: Record<string, string>;

  beforeEach(() => {
    mockEnv = {
      OPENAI_API_KEY: 'sk-test-openai',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      GOOGLE_API_KEY: 'google-test-key',
    };
  });

  describe('Valid Configurations', () => {
    it('should parse minimal OpenAI configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result).toEqual({
        provider: 'api/openai',
        model: 'gpt-4',
      });
    });

    it('should parse complete Anthropic configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/anthropic',
        url: 'https://api.anthropic.com/v1',
        apiKey: '{{env.ANTHROPIC_API_KEY}}',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
        tools: ['github', 'slack'],
        mcp: ['filesystem', 'github'],
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result).toEqual({
        provider: 'api/anthropic',
        url: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant-test',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
        tools: ['github', 'slack'],
        mcp: ['filesystem', 'github'],
      });
    });

    it('should parse Google provider configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/google',
        apiKey: '{{env.GOOGLE_API_KEY}}',
        model: 'gemini-1.5-pro',
        temperature: 0.5,
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.provider).toBe('api/google');
      expect(result.model).toBe('gemini-1.5-pro');
      expect(result.apiKey).toBe('google-test-key');
      expect(result.temperature).toBe(0.5);
    });

    it('should parse mode-specific tool permissions via options', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/anthropic',
        model: 'claude-3-sonnet',
        options: {
          query: {
            tools: ['read_file', 'grep'],
            mcp: ['filesystem'],
          },
          execute: {
            tools: ['write_file'],
          },
        } as any,
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.options?.query?.tools).toEqual(['read_file', 'grep']);
      expect(result.options?.query?.mcp).toEqual(['filesystem']);
      expect(result.options?.execute?.tools).toEqual(['write_file']);
    });

    it('should parse inline provider configuration', () => {
      const rawConfig: RawAgentConfig = {
        inline: {
          provider: 'api/openai',
          model: 'gpt-4',
          url: 'https://custom.openai.com/v1',
          apiKey: '{{env.OPENAI_API_KEY}}',
          temperature: 0.9,
          maxTokens: 2048,
        },
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.provider).toBe('api/openai');
      expect(result.model).toBe('gpt-4');
      expect(result.url).toBe('https://custom.openai.com/v1');
      expect(result.apiKey).toBe('sk-test-openai');
      expect(result.temperature).toBe(0.9);
      expect(result.maxTokens).toBe(2048);
    });

    it('should parse LiteLLM configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/litellm',
        url: 'http://localhost:4000',
        model: 'gpt-4',
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.provider).toBe('api/litellm');
      expect(result.url).toBe('http://localhost:4000');
      expect(result.model).toBe('gpt-4');
    });

    it('should parse Ollama configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/ollama',
        model: 'llama2',
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.provider).toBe('api/ollama');
      expect(result.model).toBe('llama2');
    });

    it('should parse Bedrock configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/bedrock',
        model: 'anthropic.claude-v2',
        url: 'https://bedrock-runtime.us-east-1.amazonaws.com',
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.provider).toBe('api/bedrock');
      expect(result.model).toBe('anthropic.claude-v2');
    });

    it('should parse SowonAI configuration', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/sowonai',
        model: 'custom-model',
        url: 'https://api.sowonai.com/v1',
      };

      const result = parseAPIProviderConfig(rawConfig, mockEnv);

      expect(result.provider).toBe('api/sowonai');
      expect(result.model).toBe('custom-model');
    });
  });

  describe('Invalid Configurations', () => {
    it('should throw error for missing provider', () => {
      const rawConfig: RawAgentConfig = {
        model: 'gpt-4',
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('Provider is required');
    });

    it('should throw error for invalid provider type', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/invalid',
        model: 'test',
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow("Invalid API provider 'api/invalid'");
    });

    it('should throw error for missing model', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow("Model is required for API provider 'api/openai'");
    });

    it('should throw error for invalid temperature', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        temperature: 3.0, // Invalid: > 2
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('Temperature must be a number between 0 and 2');
    });

    it('should throw error for negative temperature', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        temperature: -0.5,
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('Temperature must be a number between 0 and 2');
    });

    it('should throw error for invalid maxTokens', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: -100,
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('maxTokens must be a positive integer');
    });

    it('should throw error for non-integer maxTokens', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        maxTokens: 100.5,
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('maxTokens must be a positive integer');
    });

    it('should throw error for non-array tools', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        tools: { include: ['github'], exclude: ['slack'] } as any,
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('API provider tools must be a simple array of strings');
    });

    it('should throw error for non-array mcp', () => {
      const rawConfig: RawAgentConfig = {
        provider: 'api/openai',
        model: 'gpt-4',
        mcp: { include: ['github'] } as any,
      };

      expect(() => {
        parseAPIProviderConfig(rawConfig, mockEnv);
      }).toThrow('API provider mcp must be a simple array of strings');
    });
  });
});

describe('parseMCPServers', () => {
  let mockEnv: Record<string, string>;

  beforeEach(() => {
    mockEnv = {
      GITHUB_TOKEN: 'ghp_test123',
      SLACK_TOKEN: 'xoxb_test456',
    };
  });

  it('should parse single MCP server configuration', () => {
    const rawMCPServers: Record<string, RawMCPServerConfig> = {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}',
        },
      },
    };

    const result = parseMCPServers(rawMCPServers, mockEnv);

    expect(result).toEqual({
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_TOKEN: 'ghp_test123',
        },
      },
    });
  });

  it('should parse multiple MCP servers', () => {
    const rawMCPServers: Record<string, RawMCPServerConfig> = {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}',
        },
      },
      slack: {
        command: 'node',
        args: ['./mcp-servers/slack/index.js'],
        env: {
          SLACK_TOKEN: '{{env.SLACK_TOKEN}}',
        },
      },
    };

    const result = parseMCPServers(rawMCPServers, mockEnv);

    expect(result.github).toBeDefined();
    expect(result.slack).toBeDefined();
    expect(result.github.env?.GITHUB_TOKEN).toBe('ghp_test123');
    expect(result.slack.env?.SLACK_TOKEN).toBe('xoxb_test456');
  });

  it('should parse MCP server without env', () => {
    const rawMCPServers: Record<string, RawMCPServerConfig> = {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      },
    };

    const result = parseMCPServers(rawMCPServers, mockEnv);

    expect(result.filesystem).toEqual({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    });
  });

  it('should throw error for missing command', () => {
    const rawMCPServers: Record<string, RawMCPServerConfig> = {
      invalid: {
        command: '',
        args: [],
      },
    };

    expect(() => {
      parseMCPServers(rawMCPServers, mockEnv);
    }).toThrow("MCP server 'invalid' is missing 'command' field");
  });

  it('should throw error for non-array args', () => {
    const rawMCPServers: Record<string, RawMCPServerConfig> = {
      invalid: {
        command: 'npx',
        args: 'not-an-array' as any,
      },
    };

    expect(() => {
      parseMCPServers(rawMCPServers, mockEnv);
    }).toThrow("MCP server 'invalid' 'args' must be an array");
  });
});

describe('validateAPIProviderConfig', () => {
  it('should validate correct configuration', () => {
    const config: APIProviderConfig = {
      provider: 'api/openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2048,
      tools: ['github', 'slack'],
      mcp: ['filesystem'],
    };

    expect(validateAPIProviderConfig(config)).toBe(true);
  });

  it('should throw error for missing provider', () => {
    const config: any = {
      model: 'gpt-4',
    };

    expect(() => {
      validateAPIProviderConfig(config);
    }).toThrow("Invalid provider 'undefined'");
  });

  it('should throw error for invalid provider type', () => {
    const config: any = {
      provider: 'invalid/provider',
      model: 'gpt-4',
    };

    expect(() => {
      validateAPIProviderConfig(config);
    }).toThrow("Invalid provider 'invalid/provider'");
  });

  it('should throw error for missing model', () => {
    const config: any = {
      provider: 'api/openai',
    };

    expect(() => {
      validateAPIProviderConfig(config);
    }).toThrow('Model is required');
  });

  it('should throw error for non-array tools', () => {
    const config: any = {
      provider: 'api/openai',
      model: 'gpt-4',
      tools: 'not-an-array',
    };

    expect(() => {
      validateAPIProviderConfig(config);
    }).toThrow('tools must be an array of strings');
  });
});

describe('parseCrewXConfig', () => {
  let mockEnv: Record<string, string>;

  beforeEach(() => {
    mockEnv = {
      OPENAI_API_KEY: 'sk-test-openai',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      GITHUB_TOKEN: 'ghp_test123',
    };
  });

  it('should parse complete CrewX configuration', () => {
    const rawConfig: RawYAMLConfig = {
      vars: {
        company_name: 'Acme Corp',
        api_version: 'v1',
      },
      mcp_servers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_TOKEN: '{{env.GITHUB_TOKEN}}',
          },
        },
      },
      agents: [
        {
          id: 'researcher',
          provider: 'api/openai',
          model: 'gpt-4',
          apiKey: '{{env.OPENAI_API_KEY}}',
          tools: ['github'],
        },
        {
          id: 'analyst',
          provider: 'api/anthropic',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: '{{env.ANTHROPIC_API_KEY}}',
        },
      ],
    };

    const result = parseCrewXConfig(rawConfig, mockEnv);

    expect(result.vars).toEqual({
      company_name: 'Acme Corp',
      api_version: 'v1',
    });

    expect(result.mcpServers.github).toBeDefined();
    expect(result.mcpServers.github.env?.GITHUB_TOKEN).toBe('ghp_test123');

    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].provider).toBe('api/openai');
    expect(result.agents[0].apiKey).toBe('sk-test-openai');
    expect(result.agents[1].provider).toBe('api/anthropic');
    expect(result.agents[1].apiKey).toBe('sk-ant-test');
  });

  it('should skip CLI providers in agent parsing', () => {
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

    const result = parseCrewXConfig(rawConfig, mockEnv);

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].provider).toBe('api/openai');
  });

  it('should handle empty configuration', () => {
    const rawConfig: RawYAMLConfig = {};

    const result = parseCrewXConfig(rawConfig, mockEnv);

    expect(result.vars).toEqual({});
    expect(result.mcpServers).toEqual({});
    expect(result.agents).toEqual([]);
  });

  it('should throw error for invalid agent configuration', () => {
    const rawConfig: RawYAMLConfig = {
      agents: [
        {
          id: 'invalid',
          provider: 'api/openai',
          // Missing model field
        },
      ],
    };

    expect(() => {
      parseCrewXConfig(rawConfig, mockEnv);
    }).toThrow("Failed to parse agent 'invalid'");
  });
});
