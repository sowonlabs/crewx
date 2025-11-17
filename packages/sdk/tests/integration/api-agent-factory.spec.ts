/**
 * Integration tests for API Provider Agent Creation
 * Tests WBS-23 Phase 5: End-to-end agent creation with YAML configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCrewxAgent, loadAgentConfigFromYaml } from '../../src/core/agent/agent-factory';
import { parseCrewXConfig } from '../../src/config/api-provider-parser';
import * as providerFactory from '../../src/core/providers/provider-factory';

// Mock MastraAPIProvider to avoid actual API calls in tests
vi.mock('../../src/core/providers/MastraAPIProvider', () => {
  return {
    MastraAPIProvider: vi.fn().mockImplementation((config: any) => ({
      name: config.provider,
      isAvailable: vi.fn().mockResolvedValue(true),
      query: vi.fn().mockImplementation(async (prompt: string, options: any) => ({
        content: `API query response: ${prompt}`,
        provider: config.provider,
        command: 'query',
        success: true,
        model: options?.model || config.model,
        metadata: {
          provider: config.provider,
          model: options?.model || config.model,
          timestamp: new Date().toISOString(),
        },
      })),
      execute: vi.fn().mockImplementation(async (prompt: string, options: any) => ({
        content: `API execute response: ${prompt}`,
        provider: config.provider,
        command: 'execute',
        success: true,
        model: options?.model || config.model,
        metadata: {
          provider: config.provider,
          model: options?.model || config.model,
          timestamp: new Date().toISOString(),
        },
      })),
      getToolPath: vi.fn().mockResolvedValue(null),
    })),
  };
});

describe('API Agent Factory Integration Tests', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('YAML Configuration Parsing and Agent Creation', () => {
    it('should parse YAML and create OpenAI API agent successfully', async () => {
      const yaml = `
agents:
  - id: my_openai_agent
    name: "My OpenAI Assistant"
    provider: api/openai
    model: gpt-4
    apiKey: sk-test123
    temperature: 0.7
    maxTokens: 2048
    tools: [github, slack]
    mcp: [filesystem]
`;

      const config = loadAgentConfigFromYaml(yaml);
      const { agent, provider, agentId, agentName } = await createCrewxAgent(config);

      expect(agent).toBeDefined();
      expect(typeof agent.query).toBe('function');
      expect(typeof agent.execute).toBe('function');
      expect(provider?.namespace).toBe('api');
      expect(provider?.id).toBe('openai');
      expect(provider?.model).toBe('gpt-4');
      expect(agentId).toBe('my_openai_agent');
      expect(agentName).toBe('My OpenAI Assistant');
    });

    it('should parse multi-provider YAML and create multiple agents', async () => {
      const yaml = `
agents:
  - id: research_assistant
    name: "Research Assistant"
    provider: api/openai
    model: gpt-4
    apiKey: sk-openai-123
    temperature: 0.8
  - id: analysis_assistant  
    name: "Analysis Assistant"
    provider: api/anthropic
    model: claude-3-5-sonnet
    apiKey: sk-anthropic-456
    temperature: 0.6
  - id: coding_assistant
    name: "Coding Assistant"  
    provider: api/google
    model: gemini-1.5-pro
    apiKey: google-key-789
`;

      const config = loadAgentConfigFromYaml(yaml);
      
      // Test first agent (OpenAI)
      const { agent: openaiAgent } = await createCrewxAgent({
        ...config,
        provider: { namespace: 'api', id: 'openai', model: 'gpt-4' },
      });
      expect(openaiAgent).toBeDefined();
      expect(typeof openaiAgent.query).toBe('function');

      // Test second agent (Anthropic)
      const { agent: anthropicAgent } = await createCrewxAgent({
        ...config,
        provider: { namespace: 'api', id: 'anthropic', model: 'claude-3-5-sonnet' },
      });
      expect(anthropicAgent).toBeDefined();
      expect(typeof anthropicAgent.execute).toBe('function');

      // Test third agent (Google)
      const { agent: googleAgent } = await createCrewxAgent({
        ...config,
        provider: { namespace: 'api', id: 'google', model: 'gemini-1.5-pro' },
      });
      expect(googleAgent).toBeDefined();
      expect(typeof googleAgent.query).toBe('function');
    });

    it('should handle inline configuration correctly', async () => {
      const yaml = `
agents:
  - id: inline_agent
    name: "Inline Config Agent"
    inline:
      provider: api/litellm
      model: gpt-4
      url: http://localhost:4000
      apiKey: litellm-key-123
      temperature: 0.9
      maxTokens: 4096
`;

      const config = loadAgentConfigFromYaml(yaml);
      const { agent, provider } = await createCrewxAgent(config);

      expect(agent).toBeDefined();
      expect(provider?.namespace).toBe('api');
      expect(provider?.id).toBe('litellm');
      expect(provider?.model).toBe('gpt-4');
      expect(provider?.url).toBe('http://localhost:4000');
      expect(provider?.temperature).toBe(0.9);
      expect(provider?.maxTokens).toBe(4096);
    });
  });

  describe('Environment Variable Substitution Integration', () => {
    it('should substitute environment variables throughout configuration', async () => {
      process.env.OPENAI_API_KEY = 'sk-env-substituted';
      process.env.OPENAI_MODEL = 'gpt-4-turbo';
      process.env.OPENAI_URL = 'https://api.openai.com/v1';
      
      const yaml = `
agents:
  - id: env_agent
    provider: api/openai
    model: "{{env.OPENAI_MODEL}}"
    apiKey: "{{env.OPENAI_API_KEY}}"
    url: "{{env.OPENAI_URL}}"
    temperature: 0.7
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      const parsedConfig = parseCrewXConfig(rawConfig);

      expect(parsedConfig.agents).toHaveLength(1);
      expect(parsedConfig.agents[0].model).toBe('gpt-4-turbo');
      expect(parsedConfig.agents[0].apiKey).toBe('sk-env-substituted');
      expect(parsedConfig.agents[0].url).toBe('https://api.openai.com/v1');

      const { agent, provider } = await createCrewxAgent({
        provider: parsedConfig.agents[0],
      });

      expect(agent).toBeDefined();
      expect(provider?.model).toBe('gpt-4-turbo');
      expect(provider?.apiKey).toBe('sk-env-substituted');
    });

    it('should handle missing environment variables gracefully', async () => {
      const yaml = `
agents:
  - id: agent_with_missing_env
    provider: api/openai
    model: gpt-4
    apiKey: "{{env.MISSING_API_KEY}}"
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      
      expect(() => parseCrewXConfig(rawConfig)).toThrow("Environment variable 'MISSING_API_KEY' is not defined");
    });

    it('should substitute environment variables in inline configuration', async () => {
      process.env.CUSTOM_PROVIDER = 'api/anthropic';
      process.env.CUSTOM_MODEL = 'claude-3-5-sonnet';
      process.env.CUSTOM_API_KEY = 'sk-custom-key';

      const yaml = `
agents:
  - id: dynamic_inline_agent
    name: "Dynamic Inline Agent"
    inline:
      provider: "{{env.CUSTOM_PROVIDER}}"
      model: "{{env.CUSTOM_MODEL}}"
      apiKey: "{{env.CUSTOM_API_KEY}}"
      temperature: 0.6
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      const parsedConfig = parseCrewXConfig(rawConfig);

      expect(parsedConfig.agents[0].provider).toBe('api/anthropic');
      expect(parsedConfig.agents[0].model).toBe('claude-3-5-sonnet');
      expect(parsedConfig.agents[0].apiKey).toBe('sk-custom-key');
    });
  });

  describe('Complete CrewX Configuration with MCP Servers', () => {
    it('should parse complete CrewX configuration including vars, mcp_servers, and agents', async () => {
      process.env.OPENAI_API_KEY = 'sk-openai-complete';
      process.env.ANTHROPIC_API_KEY = 'sk-anthropic-complete';
      process.env.GITHUB_TOKEN = 'ghp-github-complete';
      process.env.API_BASE_URL = 'https://api.example.com';

      const yaml = `
vars:
  company_name: "CompleteCorp"
  environment: "production"
  api_version: "v2"

mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]  
  sentry:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-sentry"]

agents:
  - id: complete_research_agent
    name: "Complete Research Agent"
    provider: api/openai
    model: gpt-4
    apiKey: "{{env.OPENAI_API_KEY}}"
    url: "{{env.API_BASE_URL}}/v1"
    temperature: 0.7
    maxTokens: 4096
    tools: [github, filesystem]
    mcp: [github, filesystem, sentry]
  - id: complete_analysis_agent
    name: "Complete Analysis Agent"
    provider: api/anthropic
    model: claude-3-5-sonnet
    apiKey: "{{env.ANTHROPIC_API_KEY}}"
    temperature: 0.6
    tools: [github]
    mcp: [sentry]
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      const parsedConfig = parseCrewXConfig(rawConfig);

      // Verify vars
      expect(parsedConfig.vars.company_name).toBe('CompleteCorp');
      expect(parsedConfig.vars.environment).toBe('production');
      expect(parsedConfig.vars.api_version).toBe('v2');

      // Verify MCP servers
      expect(Object.keys(parsedConfig.mcpServers)).toHaveLength(3);
      expect(parsedConfig.mcpServers.github.env?.GITHUB_TOKEN).toBe('ghp-github-complete');
      expect(parsedConfig.mcpServers.filesystem.command).toBe('npx');
      expect(parsedConfig.mcpServers.sentry.args).toEqual([
        '-y',
        '@modelcontextprotocol/server-sentry',
      ]);

      // Verify agents
      expect(parsedConfig.agents).toHaveLength(2);
      
      // First agent (Research)
      const researchAgentConfig = parsedConfig.agents[0];
      expect(researchAgentConfig.provider).toBe('api/openai');
      expect(researchAgentConfig.model).toBe('gpt-4');
      expect(researchAgentConfig.apiKey).toBe('sk-openai-complete');
      expect(researchAgentConfig.url).toBe('https://api.example.com/v1');
      expect(researchAgentConfig.tools).toEqual(['github', 'filesystem']);
      expect(researchAgentConfig.mcp).toEqual(['github', 'filesystem', 'sentry']);

      // Second agent (Analysis)
      const analysisAgentConfig = parsedConfig.agents[1];
      expect(analysisAgentConfig.provider).toBe('api/anthropic');
      expect(analysisAgentConfig.model).toBe('claude-3-5-sonnet');
      expect(analysisAgentConfig.apiKey).toBe('sk-anthropic-complete');
      expect(analysisAgentConfig.tools).toEqual(['github']);
      expect(analysisAgentConfig.mcp).toEqual(['sentry']);

      // Test agent creation from parsed config
      const { agent: researchAgent } = await createCrewxAgent({
        provider: researchAgentConfig,
      });
      
      expect(researchAgent).toBeDefined();
      expect(typeof researchAgent.query).toBe('function');
      expect(typeof researchAgent.execute).toBe('function');
    });
  });

  describe('Agent Functionality Testing', () => {
    it('should execute queries with created API agent', async () => {
      const yaml = `
agents:
  - id: query_test_agent
    provider: api/openai
    model: gpt-4
    apiKey: sk-test123
`;

      const config = loadAgentConfigFromYaml(yaml);
      const { agent } = await createCrewxAgent(config);

      const result = await agent.query({ prompt: 'What is 2+2?' });

      expect(result.success).toBe(true);
      expect(result.content).toBe('API query response: What is 2+2?');
      expect(result.provider).toBe('api/openai');
      expect(result.metadata?.provider).toBe('api/openai');
      expect(result.metadata?.model).toBe('gpt-4');
    });

    it('should execute execute commands with created API agent', async () => {
      const yaml = `
agents:
  - id: execute_test_agent
    provider: api/anthropic
    model: claude-3-5-sonnet
    apiKey: sk-ant-test123
    temperature: 0.7
`;

      const config = loadAgentConfigFromYaml(yaml);
      const { agent } = await createCrewxAgent(config);

      const result = await agent.execute({ 
        prompt: 'Create a simple function that calculates factorial',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('API execute response: Create a simple function that calculates factorial');
      expect(result.provider).toBe('api/anthropic');
      expect(result.metadata?.provider).toBe('api/anthropic');
      expect(result.metadata?.model).toBe('claude-3-5-sonnet');
    });

    it('should handle runtime model overrides', async () => {
      const yaml = `
agents:
  - id: model_override_agent
    provider: api/openai
    model: gpt-3.5-turbo
    apiKey: sk-test123
`;

      const config = loadAgentConfigFromYaml(yaml);
      const { agent } = await createCrewxAgent(config);

      const result = await agent.query({ 
        prompt: 'Test with runtime model override',
        model: 'gpt-4', // Runtime override
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.model).toBe('gpt-4');
    });

    it('should handle context parameters', async () => {
      const yaml = `
agents:
  - id: context_test_agent
    provider: api/google
    model: gemini-1.5-pro
    apiKey: google-test-key
    temperature: 0.8
`;

      const config = loadAgentConfigFromYaml(yaml);
      const { agent } = await createCrewxAgent(config);

      const result = await agent.query({ 
        prompt: 'Analyze this code quality',
        context: 'CrewX API Provider Testing',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.context).toBe('CrewX API Provider Testing');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid YAML configuration gracefully', async () => {
      const invalidYaml = `
agents:
  - id: invalid_agent
    provider: api/invalid-provider
    model: test-model
`;

      const rawConfig = loadAgentConfigFromYaml(invalidYaml);
      
      expect(() => parseCrewXConfig(rawConfig)).toThrow('Invalid API provider');
    });

    it('should handle missing required fields in configuration', async () => {
      const yaml = `
agents:
  - id: missing_model_agent
    provider: api/openai
    # Missing model field
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      
      expect(() => parseCrewXConfig(rawConfig)).toThrow('Model is required');
    });

    it('should handle temperature range validation', async () => {
      const yaml = `
agents:
  - id: invalid_temp_agent
    provider: api/openai
    model: gpt-4
    temperature: 3.0  # Invalid: > 2
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      
      expect(() => parseCrewXConfig(rawConfig)).toThrow('Temperature must be a number between 0 and 2');
    });

    it('should handle maxTokens validation', async () => {
      const yaml = `
agents:
  - id: invalid_tokens_agent
    provider: api/openai
    model: gpt-4
    maxTokens: -100  # Invalid: negative
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      
      expect(() => parseCrewXConfig(rawConfig)).toThrow('maxTokens must be a positive integer');
    });
  });

  describe('Provider Factory Integration', () => {
    it('should create all 7 supported API provider types through factory', async () => {
      const providerConfigs = [
        { namespace: 'api', id: 'openai', model: 'gpt-4' },
        { namespace: 'api', id: 'anthropic', model: 'claude-3-5-sonnet' },
        { namespace: 'api', id: 'google', model: 'gemini-1.5-pro' },
        { namespace: 'api', id: 'bedrock', model: 'anthropic.claude-v2' },
        { namespace: 'api', id: 'litellm', model: 'gpt-4' },
        { namespace: 'api', id: 'ollama', model: 'llama2' },
        { namespace: 'api', id: 'sowonai', model: 'custom-model' },
      ];

      for (const config of providerConfigs) {
        const provider = await providerFactory.createProviderFromConfig(config);
        expect(provider).toBeDefined();
        expect(provider.name).toBe(`${config.namespace}/${config.id}`);
      }
    });

    it('should reject invalid API provider types', async () => {
      const invalidConfig = {
        namespace: 'api',
        id: 'invalid-provider',
        model: 'test-model',
      };

      await expect(
        providerFactory.createProviderFromConfig(invalidConfig)
      ).rejects.toThrow("Invalid API provider type 'api/invalid-provider'");
    });

    it('should require model for API providers', async () => {
      const configWithoutModel = {
        namespace: 'api',
        id: 'openai',
        // Missing model
      };

      await expect(
        providerFactory.createProviderFromConfig(configWithoutModel)
      ).rejects.toThrow("Model is required for API provider 'api/openai'");
    });
  });

  describe('Real-world Configuration Scenarios', () => {
    it('should handle CrewX development configuration', async () => {
      process.env.OPENAI_API_KEY = 'development-key';
      process.env.ANTHROPIC_API_KEY = 'development-ant-key';

      const yaml = `
vars:
  project: "CrewX Development"
  environment: "development"

mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "{{env.GITHUB_TOKEN}}"
  filesystem:
    command: npx  
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."]

agents:
  - id: dev_researcher
    name: "Development Researcher"
    provider: api/openai
    model: gpt-4
    apiKey: "{{env.OPENAI_API_KEY}}"
    temperature: 0.7
    tools: [github, filesystem]
    mcp: [github, filesystem]
  - id: dev_coder
    name: "Development Coder"
    provider: api/anthropic
    model: claude-3-5-sonnet
    apiKey: "{{env.ANTHROPIC_API_KEY}}"
    tools: [github]
    mcp: [github]
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      const parsedConfig = parseCrewXConfig(rawConfig);

      // Test first agent
      const { agent: researcherAgent } = await createCrewxAgent({
        provider: parsedConfig.agents[0],
      });

      const researcherResult = await researcherAgent.query({ prompt: 'Research latest tools' });
      expect(researcherResult.success).toBe(true);
      expect(researcherResult.metadata?.provider).toBe('api/openai');

      // Test second agent
      const { agent: coderAgent } = await createCrewxAgent({
        provider: parsedConfig.agents[1],
      });

      const coderResult = await coderAgent.execute({ prompt: 'Code review' });
      expect(coderResult.success).toBe(true);
      expect(coderResult.metadata?.provider).toBe('api/anthropic');
    });

    it('should handle minimal production configuration', async () => {
      process.env.PRODUCTION_API_KEY = 'prod-key';

      const yaml = `
agents:
  - id: production_agent
    provider: api/openai
    model: gpt-4
    apiKey: "{{env.PRODUCTION_API_KEY}}"
`;

      const rawConfig = loadAgentConfigFromYaml(yaml);
      const parsedConfig = parseCrewXConfig(rawConfig);

      const { agent } = await createCrewxAgent({
        provider: parsedConfig.agents[0],
      });

      const result = await agent.query({ prompt: 'Production query' });
      expect(result.success).toBe(true);
      expect(result.metadata?.provider).toBe('api/openai');
    });
  });
});