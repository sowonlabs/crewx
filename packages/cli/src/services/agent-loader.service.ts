/**
 * @file AgentLoaderService
 *
 * CRITICAL: These tests MUST pass (simple, essential functionality):
 * - tests/services/agent-loader-integration.test.ts (6 tests - document integration)
 * - tests/integration/cso-file-loading.test.ts (3 tests - full agent loading)
 *
 * Total: 9 essential tests that validate agent loading with document templates.
 */

import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { AgentInfo, RemoteAgentInfo, RemoteAgentConfigInput, getErrorMessage } from '@sowonai/crewx-sdk';
import * as yaml from 'js-yaml';
import { readFile } from 'fs/promises';
import type { TemplateContext } from '../utils/template-processor';
import { DocumentLoaderService } from './document-loader.service';
import { TemplateService } from './template.service';
import { ConfigValidatorService } from './config-validator.service';
import { AIProviderService } from '../ai-provider.service';
import { ConfigService } from './config.service';

/**
 * AgentLoaderService - Centralized agent configuration loading
 *
 * This service provides a single source of truth for loading agent configurations,
 * eliminating code duplication between ToolCallService and CrewXTool.
 *
 * Benefits:
 * - No circular dependencies
 * - Single responsibility (only loads agent data)
 * - Easy to test and maintain
 * - - Can be used by any service that needs agent information
 */
@Injectable()
export class AgentLoaderService {
  private readonly logger = new Logger('AgentLoaderService');

  constructor(
    @Optional() private readonly documentLoaderService?: DocumentLoaderService,
    @Optional() private readonly templateService?: TemplateService,
    @Optional() private readonly configValidatorService?: ConfigValidatorService,
    @Optional() @Inject(forwardRef(() => AIProviderService)) private readonly aiProviderService?: AIProviderService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Default CLI agents that are always available
   */
  private readonly defaultCliAgents: AgentInfo[] = [
    {
      id: 'claude',
      name: 'Claude AI',
      role: 'AI Assistant',
      team: 'AI Team',
      provider: 'claude',
      workingDirectory: './',
      capabilities: ['general_assistance', 'code_analysis', 'writing'],
      description: 'Claude AI assistant for general tasks, code analysis, and writing assistance.',
      specialties: ['General AI', 'Code Analysis', 'Writing', 'Problem Solving'],
    },
    {
      id: 'gemini',
      name: 'Gemini AI',
      role: 'AI Assistant',
      team: 'AI Team',
      provider: 'gemini',
      workingDirectory: './',
      capabilities: ['general_assistance', 'code_analysis', 'research'],
      description: 'Gemini AI assistant for general tasks, code analysis, and research assistance.',
      specialties: ['General AI', 'Code Analysis', 'Research', 'Data Analysis'],
    },
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      role: 'AI Assistant',
      team: 'AI Team',
      provider: 'copilot',
      workingDirectory: './',
      capabilities: ['code_generation', 'code_completion', 'debugging'],
      description: 'GitHub Copilot AI assistant for code generation, completion, and debugging.',
      specialties: ['Code Generation', 'Code Completion', 'Debugging', 'GitHub Integration'],
    },
  ];

  /**
   * Get all available agents (using loadAvailableAgents)
   * Simple wrapper for backward compatibility
   *
   * @returns Promise<AgentInfo[]> - Combined list of all agents
   */
  async getAllAgents(): Promise<AgentInfo[]> {
    // Just return agents from configuration
    // Plugin providers are already referenced by agents via their 'provider' field
    // No need to create synthetic agents for providers
    return this.loadAvailableAgents();
  }

  /**
   * Get default CLI agents only
   */
  getDefaultCliAgents(): AgentInfo[] {
    return [...this.defaultCliAgents];
  }

  /**
   * Get configuration source info
   */
  getConfigSource(): { source: string; path?: string } {
    const agentsConfigPath = process.env.AGENTS_CONFIG;
    return {
      source: agentsConfigPath ? 'External YAML file' : 'Default hardcoded values',
      path: agentsConfigPath,
    };
  }

  /**
   * Load all available agents (built-in + user-defined)
   * This is the main entry point for loading agents
   */
  async loadAvailableAgents(): Promise<AgentInfo[]> {
    try {
      let allAgents: AgentInfo[] = [];

      // 1. Load built-in agents from template (cached or from GitHub)
      this.logger.log('Loading built-in agents from template...');
      try {
        const builtInAgents = await this.loadBuiltInAgents();
        allAgents = [...builtInAgents];
        this.logger.log(`Loaded ${builtInAgents.length} built-in agents`);
      } catch (error) {
        this.logger.warn('Failed to load built-in agents, using fallback defaults');
        // Fallback to hardcoded defaults if template loading fails
        allAgents = [...this.defaultCliAgents];
      }

      // 2. Load user-defined agents from crewx.yaml or agents.yaml (backward compatibility)
      const path = await import('path');
      const fs = await import('fs');

      // Get config path from ConfigService (respects --config option)
      let agentsConfigPath: string | null = null;

      if (this.configService) {
        agentsConfigPath = this.configService.getCurrentConfigPath();
      }

      if (!agentsConfigPath) {
        // Fallback if ConfigService is not available
        if (process.env.CREWX_CONFIG) {
          agentsConfigPath = process.env.CREWX_CONFIG;
        } else {
          const crewConfigPath = path.join(process.cwd(), 'crewx.yaml');
          const agentsYamlPath = path.join(process.cwd(), 'agents.yaml');

          if (fs.existsSync(crewConfigPath)) {
            agentsConfigPath = crewConfigPath;
          } else if (fs.existsSync(agentsYamlPath)) {
            agentsConfigPath = agentsYamlPath;
          } else {
            agentsConfigPath = crewConfigPath; // Default to crewx.yaml for error message
          }
        }
      }

      this.logger.log(`Loading agents from config: ${agentsConfigPath}`);

      try {
        const userAgents = await this.loadAgentsFromConfig(agentsConfigPath);
        this.logger.log(`Loaded ${userAgents.length} user-defined agents`);

        // 3. Merge: user agents can override built-in agents with same ID
        const builtInIds = new Set(allAgents.map((a) => a.id));
        const newUserAgents = userAgents.filter((a) => !builtInIds.has(a.id));
        const overrideUserAgents = userAgents.filter((a) => builtInIds.has(a.id));

        // Replace built-in agents with user overrides
        for (const userAgent of overrideUserAgents) {
          const index = allAgents.findIndex((a) => a.id === userAgent.id);
          if (index >= 0) {
            this.logger.log(`User config overrides built-in agent: ${userAgent.id}`);
            allAgents[index] = userAgent;
          }
        }

        // Add new user agents
        allAgents = [...allAgents, ...newUserAgents];
      } catch (error) {
        this.logger.log('No user agents.yaml found or failed to load, using built-in agents only');
      }

      this.logger.log(`Total agents loaded: ${allAgents.length}`);
      return allAgents;
    } catch (error) {
      this.logger.error('Failed to load agents:', getErrorMessage(error));
      return [...this.defaultCliAgents]; // Ultimate fallback
    }
  }

  /**
   * Load built-in agents from template service
   */
  private async loadBuiltInAgents(): Promise<AgentInfo[]> {
    try {
      let templateContent: string;

      // Try local template first
      try {
        const path = await import('path');
        const fs = await import('fs/promises');
        const templatePath = path.join(__dirname, '..', '..', 'templates', 'agents', 'default.yaml');
        templateContent = await fs.readFile(templatePath, 'utf-8');
        this.logger.log('Loaded built-in agents from local template');
      } catch (localError) {
        // Fallback to GitHub download
        if (!this.templateService) {
          throw new Error('TemplateService not available for GitHub download');
        }
        this.logger.log('Local template not found, trying GitHub...');
        templateContent = await this.templateService.downloadTemplate('default', 'main');
        this.logger.log('Loaded built-in agents from GitHub template');
      }

      const config = yaml.load(templateContent) as any;

      if (!config.agents || !Array.isArray(config.agents)) {
        throw new Error('Invalid template: missing agents array');
      }

      // Initialize DocumentLoaderService with built-in documents
      if (this.documentLoaderService) {
        await this.documentLoaderService.initialize(config.documents);
      }

      // Process templates
      const processedAgents = await Promise.all(
        config.agents.map(async (agent: any) => {
          let systemPrompt = agent.inline?.system_prompt;

          // Do NOT process system_prompt template here
          // It will be processed at execution time in crewx.tool.ts
          // This allows formatConversation and other runtime helpers to work correctly

          return {
            id: agent.id,
            name: agent.name || agent.id,
            role: agent.role || 'AI Agent',
            team: agent.team,
            provider: this.parseProviderConfig(agent),
            workingDirectory: agent.working_directory || './',
            capabilities: agent.capabilities || [],
            description: systemPrompt ? this.extractDescription(systemPrompt) : `${agent.name || agent.id} agent`,
            specialties: agent.specialties || [],
            systemPrompt: systemPrompt,
            options: agent.options || [],
            inline: agent.inline,
            remote: this.parseRemoteConfig(agent),
          };
        })
      );

      return processedAgents;
    } catch (error) {
      this.logger.error('Failed to load built-in agents from template:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Load agent configuration from YAML/JSON config file
   * Enhanced version that handles templates and documents
   */
  async loadAgentsFromConfig(configPath: string): Promise<AgentInfo[]> {
    try {
      const path = await import('path');

      this.logger.log(`Loading agents from config: ${configPath}`);

      const configContent = await readFile(configPath, 'utf-8');
      let config;

      if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
        config = yaml.load(configContent) as any;
      } else {
        config = JSON.parse(configContent);
      }

      if (!config.agents || !Array.isArray(config.agents)) {
        throw new Error('Invalid config: missing agents array');
      }

      // Validate configuration if validator is available
      if (this.configValidatorService) {
        const validationResult = this.configValidatorService.validateConfig(config, configPath);
        if (!validationResult.valid) {
          const errorMessage = this.configValidatorService.formatErrorMessage(validationResult.errors);
          this.logger.error(errorMessage);
          throw new Error(`Configuration validation failed:\n${errorMessage}`);
        }
        this.logger.log('Configuration validation passed');
      }

      // Initialize DocumentLoaderService with documents from agents.yaml
      if (this.documentLoaderService) {
        const projectPath = path.dirname(configPath);
        this.logger.log(`Initializing DocumentLoaderService, has documents: ${!!config.documents}`);
        await this.documentLoaderService.initialize(config.documents, projectPath);
      } else {
        this.logger.warn('DocumentLoaderService not injected - documents will not be loaded');
      }

      // Process templates using the template-processor utility
      const agents = await Promise.all(
        config.agents.map(async (agent: any) => {
          let systemPrompt = agent.inline?.system_prompt;

          // Do NOT process system_prompt template here
          // It will be processed at execution time in crewx.tool.ts
          // This allows formatConversation and other runtime helpers to work correctly

          return {
            id: agent.id,
            name: agent.name || agent.id,
            role: agent.role || 'AI Agent',
            team: agent.team,
            provider: this.parseProviderConfig(agent),
            workingDirectory: agent.working_directory || './',
            capabilities: agent.capabilities || [],
            description: systemPrompt ? this.extractDescription(systemPrompt) : `${agent.name || agent.id} agent`,
            specialties: agent.specialties || [],
            systemPrompt: systemPrompt,
            options: agent.options || [],
            inline: agent.inline ? {
              ...agent.inline,
              system_prompt: systemPrompt, // Use the original (unprocessed) system_prompt
            } : undefined,
            remote: this.parseRemoteConfig(agent),
          };
        })
      );

      return agents;
    } catch (error) {
      this.logger.error(`Failed to load agents config from ${configPath}:`, getErrorMessage(error));
      // Return empty array if config loading fails
      return [];
    }
  }

  /**
   * Parse provider from agent configuration
   * Supports both single string and array formats
   */
  private parseProviderConfig(agent: any): 'claude' | 'gemini' | 'copilot' | 'remote' | ('claude' | 'gemini' | 'copilot')[] {
    if (this.parseRemoteConfig(agent)) {
      return 'remote';
    }

    // Priority: agent.provider > agent.inline.provider > default 'claude'
    const configProvider = agent.provider || agent.inline?.provider;

    if (Array.isArray(configProvider)) {
      // Already an array: use as-is
      return configProvider as ('claude' | 'gemini' | 'copilot')[];
    } else if (typeof configProvider === 'string') {
      // Single string: use as-is
      return configProvider as 'claude' | 'gemini' | 'copilot';
    } else {
      // No provider specified: default to 'claude'
      return 'claude';
    }
  }

  private parseRemoteConfig(agent: any): RemoteAgentInfo | undefined {
    const remoteConfig = agent.remote as RemoteAgentConfigInput | undefined;

    if (!remoteConfig || typeof remoteConfig !== 'object') {
      return undefined;
    }

    if (remoteConfig.type !== 'mcp-http') {
      this.logger.warn(`Unsupported remote agent type for ${agent.id}: ${remoteConfig.type}`);
      return undefined;
    }

    const url = remoteConfig.url;

    if (!url || typeof url !== 'string') {
      this.logger.error(`Remote agent ${agent.id} is missing a valid url property`);
      return undefined;
    }

    const tools = remoteConfig.tools && typeof remoteConfig.tools === 'object'
      ? {
          query: remoteConfig.tools.query,
          execute: remoteConfig.tools.execute,
        }
      : undefined;

    return {
      type: 'mcp-http',
      url: this.normalizeRemoteUrl(url),
      apiKey: remoteConfig.apiKey ?? remoteConfig.api_key,
      agentId: remoteConfig.agentId ?? remoteConfig.agent_id,
      timeoutMs: remoteConfig.timeoutMs ?? remoteConfig.timeout_ms,
      tools,
    };
  }

  private normalizeRemoteUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
      return trimmed;
    }

    // Remove duplicate /mcp suffix to avoid /mcp/mcp when constructing requests
    const lower = trimmed.toLowerCase();
    if (lower.endsWith('/mcp')) {
      return trimmed.slice(0, -4);
    }
    return trimmed.replace(/\/+$/, '');
  }

  /**
   * Extract description from system prompt
   */
  private extractDescription(systemPrompt: string): string {
    if (!systemPrompt) return 'AI Agent';

    // Use the first line or first sentence as description
    const lines = systemPrompt.split('\n');
    const firstLine = lines[0]?.trim();

    if (firstLine && firstLine.length > 10) {
      return firstLine.length > 150 ? firstLine.substring(0, 150) + '...' : firstLine;
    }

    return 'AI Agent';
  }
}
