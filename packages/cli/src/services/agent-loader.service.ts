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
import {
  AgentInfo,
  RemoteAgentInfo,
  RemoteAgentConfigInput,
  CustomLayoutDefinition,
  LayoutLoader,
  getErrorMessage,
  parseCrewxConfig,
  parseCrewxConfigFromFile,
  SkillLoadError,
  type SkillsConfig,
} from '@sowonai/crewx-sdk';
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
    @Optional() @Inject('LAYOUT_LOADER') private readonly layoutLoader?: LayoutLoader,
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

  private registeredLayoutSources: Set<string> = new Set<string>();

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
    const envConfigPath = process.env.CREWX_CONFIG?.trim();
    const configPath = this.configService?.getCurrentConfigPath() ?? (envConfigPath ? envConfigPath : undefined);

    if (configPath) {
      return {
        source: 'External YAML file',
        path: configPath,
      };
    }

    return {
      source: 'Default hardcoded values',
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
        this.logger.error(`Failed to load user agents: ${getErrorMessage(error)}`);
        this.logger.log('Using built-in agents only');
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
      let templateDir: string | undefined;

      // Try local template first
      try {
        const path = await import('path');
        const fs = await import('fs/promises');
        const templatePath = path.join(__dirname, '..', '..', 'templates', 'agents', 'default.yaml');
        templateContent = await fs.readFile(templatePath, 'utf-8');
        templateDir = path.dirname(templatePath);
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

      const config = parseCrewxConfig(templateContent, { validationMode: 'lenient' });

      if (!config.agents || !Array.isArray(config.agents)) {
        throw new Error('Invalid template: missing agents array');
      }

      // Initialize DocumentLoaderService with built-in documents
      if (this.documentLoaderService) {
        await this.documentLoaderService.initialize(
          config.documents as Record<string, string | { path: string; name?: string }>,
          templateDir,
        );
      }

      // Register layouts bundled with built-in template so CLI remains zero-config
      this.registerCustomLayoutsFromConfig(config, 'built-in template');

      const projectSkills = config.skills;

      // Process templates
      const processedAgents = await Promise.all(
        config.agents.map(async (agent) => {
          let systemPrompt = agent.inline?.system_prompt;

          // Do NOT process system_prompt template here
          // It will be processed at execution time in crewx.tool.ts
          // This allows formatConversation and other runtime helpers to work correctly

          const mergedSkills = this.mergeSkillsConfig(projectSkills, agent.skills);

          const parsedProvider = this.parseProviderConfig(agent);
          const providerValue = typeof parsedProvider === 'string' ? parsedProvider : parsedProvider[0];

          return {
            id: agent.id,
            name: agent.name || agent.id,
            role: agent.role || 'AI Agent',
            team: agent.team,
            provider: parsedProvider as AgentInfo['provider'], // WBS-24: Type cast to support api/* providers
            workingDirectory: agent.working_directory || './',
            capabilities: agent.capabilities || [],
            description: systemPrompt ? this.extractDescription(systemPrompt) : `${agent.name || agent.id} agent`,
            specialties: agent.specialties || [],
            systemPrompt: systemPrompt,
            options: agent.options || [],
            inline: agent.inline ? {
              ...agent.inline,
              type: 'agent' as const,
              provider: providerValue,
            } : undefined,
            remote: this.parseRemoteConfig(agent),
            ...(mergedSkills ? { skills: mergedSkills } : {}),
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
    const isDebug = process.env.CREWX_DEBUG === 'true';

    try {
      const path = await import('path');

      this.logger.log(`Loading agents from config: ${configPath}`);
      if (isDebug) {
        console.log(`\n[CREWX_DEBUG] Starting agent loading from ${configPath}`);
      }

      const parsedConfig =
        this.configService?.getProjectConfig() ??
        parseCrewxConfigFromFile(configPath, { validationMode: 'lenient' });

      if (isDebug) {
        console.log(`[CREWX_DEBUG] Parsed config:`, JSON.stringify(parsedConfig, null, 2));
        console.log(`[CREWX_DEBUG] Config has ${parsedConfig.agents?.length || 0} agents`);
      }

      if (!parsedConfig.agents || !Array.isArray(parsedConfig.agents)) {
        throw new Error('Invalid config: missing agents array');
      }

      // Validate configuration if validator is available
      if (this.configValidatorService) {
        if (isDebug) {
          console.log(`[CREWX_DEBUG] Starting configuration validation`);
        }
        const validationResult = this.configValidatorService.validateConfig(parsedConfig, configPath);
        if (!validationResult.valid) {
          const errorMessage = this.configValidatorService.formatErrorMessage(validationResult.errors);
          this.logger.error(errorMessage);
          if (isDebug) {
            console.log(`[CREWX_DEBUG] Validation errors:`, JSON.stringify(validationResult.errors, null, 2));
          }
          throw new Error(`Configuration validation failed:\n${errorMessage}`);
        }
        this.logger.log('Configuration validation passed');
        if (isDebug) {
          console.log(`[CREWX_DEBUG] Configuration validation passed`);
        }
      }

      // Register any custom layouts defined in the project configuration
      this.registerCustomLayoutsFromConfig(parsedConfig, configPath);

      // Initialize DocumentLoaderService with documents from agents.yaml
      if (this.documentLoaderService) {
        const projectPath = path.dirname(configPath);
        this.logger.log(`Initializing DocumentLoaderService, has documents: ${!!parsedConfig.documents}`);
        await this.documentLoaderService.initialize(
          parsedConfig.documents as Record<string, string | { path: string; name?: string }>,
          projectPath,
        );
      } else {
        this.logger.warn('DocumentLoaderService not injected - documents will not be loaded');
      }

      const projectSkills = parsedConfig.skills;

      if (isDebug) {
        console.log(`[CREWX_DEBUG] Processing ${parsedConfig.agents.length} agents`);
      }

      // Process templates using the template-processor utility
      const agents = await Promise.all(
        parsedConfig.agents.map(async (agent, index) => {
          if (isDebug) {
            console.log(`[CREWX_DEBUG] Processing agent ${index + 1}: ${agent.id}`);
            console.log(`[CREWX_DEBUG] Agent config:`, JSON.stringify(agent, null, 2));
          }

          let systemPrompt = agent.inline?.system_prompt;

          // Do NOT process system_prompt template here
          // It will be processed at execution time in crewx.tool.ts
          // This allows formatConversation and other runtime helpers to work correctly

          const mergedSkills = this.mergeSkillsConfig(projectSkills, agent.skills);

          if (isDebug) {
            console.log(`[CREWX_DEBUG] Parsing provider config for agent ${agent.id}`);
            console.log(`[CREWX_DEBUG] Agent provider field: ${agent.provider}`);
            console.log(`[CREWX_DEBUG] Agent inline.provider field: ${agent.inline?.provider}`);
          }

          const parsedProvider = this.parseProviderConfig(agent);

          if (isDebug) {
            console.log(`[CREWX_DEBUG] Parsed provider result: ${JSON.stringify(parsedProvider)}`);
          }

          const providerValue = typeof parsedProvider === 'string' ? parsedProvider : parsedProvider[0];

          if (isDebug) {
            console.log(`[CREWX_DEBUG] Provider value: ${providerValue}`);
          }

          return {
            id: agent.id,
            name: agent.name || agent.id,
            role: agent.role || 'AI Agent',
            team: agent.team,
            provider: parsedProvider as AgentInfo['provider'], // WBS-24: Type cast to support api/* providers
            workingDirectory: agent.working_directory || './',
            capabilities: agent.capabilities || [],
            description: systemPrompt ? this.extractDescription(systemPrompt) : `${agent.name || agent.id} agent`,
            specialties: agent.specialties || [],
            systemPrompt: systemPrompt,
            options: agent.options || [],
            inline: agent.inline ? {
              ...agent.inline,
              type: 'agent' as const,
              system_prompt: systemPrompt, // Use the original (unprocessed) system_prompt
              provider: providerValue,
            } : undefined,
            remote: this.parseRemoteConfig(agent),
            ...(mergedSkills ? { skills: mergedSkills } : {}),
          };
        })
      );

      if (isDebug) {
        console.log(`[CREWX_DEBUG] Successfully processed ${agents.length} agents`);
        console.log(`[CREWX_DEBUG] Agent IDs: ${agents.map(a => a.id).join(', ')}`);
      }

      return agents;
    } catch (error) {
      if (isDebug) {
        console.log(`[CREWX_DEBUG] Error occurred during agent loading`);
        console.log(`[CREWX_DEBUG] Error type: ${error?.constructor?.name}`);
        console.log(`[CREWX_DEBUG] Error message: ${getErrorMessage(error)}`);
        if (error instanceof Error && error.stack) {
          console.log(`[CREWX_DEBUG] Error stack trace:\n${error.stack}`);
        }
      }

      if (error instanceof SkillLoadError) {
        this.logger.error(
          `Failed to parse CrewX configuration at ${configPath}: ${error.message}`,
        );
      } else {
        this.logger.error(`Failed to load agents config from ${configPath}:`, getErrorMessage(error));
      }
      // Return empty array if config loading fails
      return [];
    }
  }

  /**
   * Register custom layouts defined within agent configuration files
   */
  private registerCustomLayoutsFromConfig(config: any, source: string): void {
    if (!this.layoutLoader) {
      return;
    }

    if (!config || typeof config !== 'object') {
      return;
    }

    const layouts = config.layouts;
    if (!layouts || typeof layouts !== 'object') {
      return;
    }

    if (this.registeredLayoutSources.has(source)) {
      return;
    }

    const layoutEntries: Record<string, string | CustomLayoutDefinition> = {};
    const seenLayoutIds = new Set<string>();
    const shouldSkipLayout = (layoutId: string) =>
      source === 'built-in template' && (layoutId === 'crewx/minimal' || layoutId === 'minimal');

    for (const [layoutId, layoutValue] of Object.entries(layouts)) {
      if (layoutValue === null || layoutValue === undefined) {
        continue;
      }

      // Use layout ID as-is, no forced namespace
      if (typeof layoutValue === 'string') {
        if (shouldSkipLayout(layoutId) || seenLayoutIds.has(layoutId)) {
          continue;
        }
        seenLayoutIds.add(layoutId);
        layoutEntries[layoutId] = layoutValue;
        continue;
      }

      if (typeof layoutValue === 'object') {
        const template = typeof (layoutValue as any).template === 'string' ? (layoutValue as any).template : undefined;
        const nestedLayouts = (layoutValue as any).layouts;

        if (template) {
          const propsSchema =
            (layoutValue as any).propsSchema ??
            (layoutValue as any).props_schema ??
            {};
          const defaultProps =
            (layoutValue as any).defaultProps ??
            (layoutValue as any).default_props ??
            {};

          if (shouldSkipLayout(layoutId) || seenLayoutIds.has(layoutId)) {
            continue;
          }
          seenLayoutIds.add(layoutId);
          layoutEntries[layoutId] = {
            template,
            description: (layoutValue as any).description,
            version: (layoutValue as any).version,
            propsSchema: typeof propsSchema === 'object' ? (propsSchema as Record<string, any>) : undefined,
            defaultProps: typeof defaultProps === 'object' ? (defaultProps as Record<string, any>) : undefined,
          };
          continue;
        }

        if (nestedLayouts && typeof nestedLayouts === 'object') {
          for (const [nestedId, nestedTemplate] of Object.entries(nestedLayouts)) {
            if (typeof nestedTemplate !== 'string') {
              continue;
            }
            // Use nested ID as-is or combine with parent
            const resolvedId =
              nestedId === 'default'
                ? layoutId
                : nestedId.includes('/')
                  ? nestedId
                  : `${layoutId}/${nestedId}`;

            if (shouldSkipLayout(resolvedId) || seenLayoutIds.has(resolvedId)) {
              continue;
            }

            seenLayoutIds.add(resolvedId);
            layoutEntries[resolvedId] = nestedTemplate;
          }
          continue;
        }

        // Object with direct string variants (e.g., { default: '...', minimal: '...' })
        let registeredVariant = false;
        for (const [variantId, variantTemplate] of Object.entries(layoutValue)) {
          if (typeof variantTemplate !== 'string') {
            continue;
          }
          // Use variant ID as-is or combine with parent
          const resolvedId =
            variantId === 'default'
              ? layoutId
              : variantId.includes('/')
                ? variantId
                : `${layoutId}/${variantId}`;

          if (shouldSkipLayout(resolvedId) || seenLayoutIds.has(resolvedId)) {
            continue;
          }

          seenLayoutIds.add(resolvedId);
          layoutEntries[resolvedId] = variantTemplate;
          registeredVariant = true;
        }

        if (!registeredVariant) {
          this.logger.warn(`Skipping custom layout "${layoutId}" from ${source}: unsupported format`);
        }

        continue;
      }

      this.logger.warn(`Skipping custom layout "${layoutId}" from ${source}: expected string or object`);
    }

    const entryCount = Object.keys(layoutEntries).length;
    if (entryCount > 0) {
      if (typeof (this.layoutLoader as any)?.registerLayouts === 'function') {
        this.layoutLoader.registerLayouts(layoutEntries);
        this.logger.log(`Registered ${entryCount} custom layout(s) from ${source}`);
        this.registeredLayoutSources.add(source);
      } else {
        this.logger.warn(
          `LayoutLoader.registerLayouts not available (source: ${source}). ` +
          'Consider upgrading @sowonai/crewx-sdk to the latest dev version.'
        );
      }
    }
  }

  private mergeSkillsConfig(
    projectSkills?: SkillsConfig,
    agentSkills?: SkillsConfig,
  ): SkillsConfig | undefined {
    if (!projectSkills && !agentSkills) {
      return undefined;
    }

    const merged: SkillsConfig = {};

    const includeSet = new Set<string>();
    if (projectSkills?.include) {
      for (const skill of projectSkills.include) {
        if (typeof skill === 'string' && skill.trim()) {
          includeSet.add(skill);
        }
      }
    }
    if (agentSkills?.include) {
      for (const skill of agentSkills.include) {
        if (typeof skill === 'string' && skill.trim()) {
          includeSet.add(skill);
        }
      }
    }
    if (includeSet.size > 0) {
      merged.include = Array.from(includeSet);
    }

    const excludeSet = new Set<string>();
    if (projectSkills?.exclude) {
      for (const skill of projectSkills.exclude) {
        if (typeof skill === 'string' && skill.trim()) {
          excludeSet.add(skill);
        }
      }
    }
    if (agentSkills?.exclude) {
      for (const skill of agentSkills.exclude) {
        if (typeof skill === 'string' && skill.trim()) {
          excludeSet.add(skill);
        }
      }
    }
    if (excludeSet.size > 0) {
      merged.exclude = Array.from(excludeSet);
    }

    if (agentSkills?.autoload !== undefined) {
      merged.autoload = agentSkills.autoload;
    } else if (projectSkills?.autoload !== undefined) {
      merged.autoload = projectSkills.autoload;
    }

    return Object.keys(merged).length === 0 ? undefined : merged;
  }

  /**
   * Parse provider from agent configuration
   * Supports both single string and array formats
   * Now supports API providers (api/openai, api/anthropic, etc.) - WBS-24 Phase 2
   */
  private parseProviderConfig(agent: any): AgentInfo['provider'] {
    if (this.parseRemoteConfig(agent)) {
      return 'remote';
    }

    // Priority: agent.provider > agent.inline.provider > default 'claude'
    const configProvider = agent.provider || agent.inline?.provider;

    if (Array.isArray(configProvider)) {
      // Already an array: use as-is
      return configProvider as ('claude' | 'gemini' | 'copilot')[];
    } else if (typeof configProvider === 'string') {
      // WBS-24 Phase 2: Support API providers (api/*)
      // Return as-is for both CLI providers (claude, gemini, copilot) and API providers (api/*)
      return configProvider as AgentInfo['provider'];
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

  /**
   * Check if an agent is configured as an API provider (WBS-24 Phase 2)
   * @param agentId - Agent ID to check
   * @returns true if agent uses API provider (api/*), false otherwise
   */
  isAPIProvider(agentId: string): boolean {
    if (!this.configService) {
      return false;
    }
    return this.configService.isAPIProvider(agentId);
  }

  /**
   * Check if a provider string is an API provider (WBS-24 Phase 2)
   * @param provider - Provider string to check
   * @returns true if provider starts with 'api/', false otherwise
   */
  private isAPIProviderString(provider: string | string[] | undefined): boolean {
    if (typeof provider === 'string') {
      return provider.startsWith('api/');
    }
    if (Array.isArray(provider) && provider.length > 0) {
      const firstProvider = provider[0];
      return firstProvider ? firstProvider.startsWith('api/') : false;
    }
    return false;
  }
}
