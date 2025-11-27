import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import * as path from 'path';
import {
  PluginProviderConfig,
  RemoteProviderConfig,
  SkillLoadError,
  parseCrewxConfigFromFile,
  parseAPIProviderConfig,
  parseMCPServers,
  APIProviderParseError,
  type AgentDefinition,
  type CrewxProjectConfig,
  type APIProviderConfig,
  type MCPServerConfig,
  type RawYAMLConfig,
} from '@sowonai/crewx-sdk';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private agents: Map<string, AgentDefinition> = new Map();
  private providerConfigs: Array<PluginProviderConfig | RemoteProviderConfig> = [];
  private projectConfig: CrewxProjectConfig | null = null;
  private customConfigPath: string | null = null;
  private currentConfigPath: string | null = null;
  private slackSettings: { logConversations: boolean } = {
    logConversations: false,
  };
  // API Provider support (WBS-24 Phase 1)
  private apiProviderConfigs: Map<string, APIProviderConfig> = new Map();
  private mcpServers: Record<string, MCPServerConfig> = {};
  private environmentVariables: Record<string, string | undefined> = {};

  constructor() {
    // Load environment variables from .env file (WBS-24 Phase 1)
    this.loadEnvironmentVariables();

    // Load config in constructor to ensure it's available before other services
    // This ensures AIProviderService can access plugin providers in its onModuleInit
    this.loadAgentConfigs();
  }

  /**
   * Set custom config path from CLI --config option
   * Must be called before loadAgentConfigs()
   */
  setConfigPath(configPath: string) {
    this.customConfigPath = configPath;
  }

  onModuleInit() {
    // Config already loaded in constructor
  }

  loadAgentConfigs() {
    // Clear existing configurations when reloading
    this.agents.clear();
    this.providerConfigs = [];
    this.projectConfig = null;
    this.currentConfigPath = null;
    this.slackSettings = { logConversations: false };
    // Clear API provider configs (WBS-24 Phase 1)
    this.apiProviderConfigs.clear();
    this.mcpServers = {};

    const { path: configPath, name: configName } = this.resolveConfigPath();

    if (!configPath || !configName) {
      this.logger.warn('No configuration file found (crewx.yaml or agents.yaml). No agent configurations loaded.');
      return;
    }

    this.currentConfigPath = configPath;
    this.logger.log(`Loading agent configurations from: ${configPath}`);

    try {
      const config = parseCrewxConfigFromFile(configPath);
      this.projectConfig = config;

      if (Array.isArray(config.agents)) {
        for (const agent of config.agents) {
          if (agent && agent.id) {
            this.agents.set(agent.id, agent);
          }
        }
        this.logger.log(`Loaded ${this.agents.size} agent configurations from ${configName}.`);
      }

      const providers = Array.isArray((config as { providers?: unknown }).providers)
        ? ((config as { providers?: unknown }).providers as Array<PluginProviderConfig | RemoteProviderConfig>)
        : [];

      this.providerConfigs = providers.filter(
        (provider): provider is PluginProviderConfig | RemoteProviderConfig =>
          Boolean(provider && (provider.type === 'plugin' || provider.type === 'remote')),
      );

      if (this.providerConfigs.length > 0) {
        const pluginCount = this.providerConfigs.filter(
          (p): p is PluginProviderConfig => p.type === 'plugin',
        ).length;
        const remoteCount = this.providerConfigs.length - pluginCount;
        this.logger.log(`Loaded ${pluginCount} plugin provider configurations.`);
        if (remoteCount > 0) {
          this.logger.log(`Loaded ${remoteCount} remote provider configurations.`);
        }
      }

      if (config.settings?.slack?.log_conversations !== undefined) {
        this.slackSettings.logConversations = Boolean(config.settings.slack.log_conversations);
        if (this.slackSettings.logConversations) {
          this.logger.log('Slack conversation logging enabled via configuration.');
        }
      }

      const envSlackLogging = process.env.CREWX_SLACK_LOG_CONVERSATIONS;
      if (envSlackLogging !== undefined) {
        this.slackSettings.logConversations = ['1', 'true', 'yes', 'on'].includes(
          envSlackLogging.toLowerCase(),
        );
        this.logger.log(
          `Slack conversation logging ${
            this.slackSettings.logConversations ? 'enabled' : 'disabled'
          } via CREWX_SLACK_LOG_CONVERSATIONS.`,
        );
      }

      // Parse API provider configurations (WBS-24 Phase 1)
      this.parseAPIProviderConfigs(config);

      // Parse MCP server configurations (WBS-24 Phase 1)
      this.parseMCPServerConfigs(config);
    } catch (error) {
      if (error instanceof SkillLoadError) {
        this.logger.error(`Failed to parse ${configName}: ${error.message}`);
        if (error.cause) {
          this.logger.debug(`Parse error stack: ${error.cause.stack ?? error.cause.message}`);
        }
      } else if (error instanceof Error) {
        this.logger.error(`Failed to load or parse ${configName}`, error);
      } else {
        this.logger.error(`Failed to load or parse ${configName}: ${String(error)}`);
      }
    }
  }

  getAgentConfig(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  getAllAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  getPluginProviders(): PluginProviderConfig[] {
    return this.providerConfigs.filter(
      (provider): provider is PluginProviderConfig => provider.type === 'plugin',
    );
  }

  getRemoteProviders(): RemoteProviderConfig[] {
    return this.providerConfigs.filter(
      (provider): provider is RemoteProviderConfig => provider.type === 'remote',
    );
  }

  getDynamicProviders(): Array<PluginProviderConfig | RemoteProviderConfig> {
    return [...this.providerConfigs];
  }

  shouldLogSlackConversations(): boolean {
    return this.slackSettings.logConversations;
  }

  getProjectConfig(): CrewxProjectConfig | null {
    return this.projectConfig;
  }

  getSkillsPaths(): string[] {
    // Support both new skills.paths and legacy skills_paths (deprecated)
    const paths = this.projectConfig?.skills?.paths
      || this.projectConfig?.skills_paths
      || [];
    return [...paths];
  }

  /**
   * Get the currently loaded config file path
   * Used by AgentLoaderService to load from the same config
   */
  getCurrentConfigPath(): string | null {
    if (this.currentConfigPath) {
      return this.currentConfigPath;
    }

    if (this.customConfigPath) {
      return path.isAbsolute(this.customConfigPath)
        ? this.customConfigPath
        : path.join(process.cwd(), this.customConfigPath);
    }

    const envConfigPath = process.env.CREWX_CONFIG?.trim();
    if (envConfigPath) {
      const resolvedEnvPath = path.isAbsolute(envConfigPath)
        ? envConfigPath
        : path.join(process.cwd(), envConfigPath);

      if (existsSync(resolvedEnvPath)) {
        return resolvedEnvPath;
      }
    }

    // Default paths
    const crewxPath = path.join(process.cwd(), 'crewx.yaml');
    const agentsPath = path.join(process.cwd(), 'agents.yaml');

    if (existsSync(crewxPath)) {
      return crewxPath;
    } else if (existsSync(agentsPath)) {
      return agentsPath;
    }

    return null;
  }

  private resolveConfigPath(): { path: string | null; name: string | null } {
    if (this.customConfigPath) {
      const customPath = path.isAbsolute(this.customConfigPath)
        ? this.customConfigPath
        : path.join(process.cwd(), this.customConfigPath);

      if (existsSync(customPath)) {
        return { path: customPath, name: path.basename(customPath) };
      }

      this.logger.error(`Custom config file not found: ${customPath}`);
      return { path: null, name: null };
    }

    const envConfigPath = process.env.CREWX_CONFIG?.trim();
    if (envConfigPath) {
      const resolvedEnvPath = path.isAbsolute(envConfigPath)
        ? envConfigPath
        : path.join(process.cwd(), envConfigPath);

      if (existsSync(resolvedEnvPath)) {
        return { path: resolvedEnvPath, name: path.basename(resolvedEnvPath) };
      }

      this.logger.warn(`CREWX_CONFIG file not found: ${resolvedEnvPath}`);
    }

    const defaultCandidates = [
      { path: path.join(process.cwd(), 'crewx.yaml'), name: 'crewx.yaml' },
      { path: path.join(process.cwd(), 'agents.yaml'), name: 'agents.yaml' },
    ];

    for (const candidate of defaultCandidates) {
      if (existsSync(candidate.path)) {
        return candidate;
      }
    }

    return { path: null, name: null };
  }

  /**
   * Load environment variables from .env file (WBS-24 Phase 1)
   * Supports multiple .env file patterns (.env, .env.local, .env.{NODE_ENV})
   */
  private loadEnvironmentVariables() {
    const cwd = process.cwd();
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Load .env files in priority order
    const envFiles = [
      path.join(cwd, `.env.${nodeEnv}.local`),
      path.join(cwd, `.env.${nodeEnv}`),
      path.join(cwd, '.env.local'),
      path.join(cwd, '.env'),
    ];

    for (const envFile of envFiles) {
      if (existsSync(envFile)) {
        this.logger.log(`Loading environment variables from: ${path.basename(envFile)}`);
        dotenvConfig({ path: envFile });
      }
    }

    // Store merged environment variables
    this.environmentVariables = { ...process.env };
  }

  /**
   * Parse API provider configurations from YAML config (WBS-24 Phase 1)
   */
  private parseAPIProviderConfigs(config: CrewxProjectConfig) {
    if (!Array.isArray(config.agents)) {
      return;
    }

    let apiProviderCount = 0;

    for (const agent of config.agents) {
      if (!agent || !agent.id) {
        continue;
      }

      // Check if this is an API provider agent
      const providerStr = (agent as any).provider || (agent as any).inline?.provider;
      if (!providerStr || !String(providerStr).startsWith('api/')) {
        continue;
      }


      try {
        // Parse API provider config using SDK parser
        const apiConfig = parseAPIProviderConfig(
          agent as any,
          this.environmentVariables,
        );

        this.apiProviderConfigs.set(agent.id, apiConfig);
        apiProviderCount++;
      } catch (error) {
        if (error instanceof APIProviderParseError) {
          this.logger.error(
            `Failed to parse API provider config for agent '${agent.id}': ${error.message}`,
          );
          if (error.cause) {
            this.logger.debug(`Parse error details: ${error.cause.message}`);
          }
        } else {
          this.logger.error(
            `Unexpected error parsing API provider for agent '${agent.id}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    if (apiProviderCount > 0) {
      this.logger.log(`Loaded ${apiProviderCount} API provider configurations.`);
    }
  }

  /**
   * Parse MCP server configurations from YAML config (WBS-24 Phase 1)
   */
  private parseMCPServerConfigs(config: CrewxProjectConfig) {
    const rawMCPServers = (config as any).mcp_servers;
    if (!rawMCPServers || typeof rawMCPServers !== 'object') {
      return;
    }

    try {
      this.mcpServers = parseMCPServers(rawMCPServers, this.environmentVariables);
      const mcpCount = Object.keys(this.mcpServers).length;
      if (mcpCount > 0) {
        this.logger.log(`Loaded ${mcpCount} MCP server configurations.`);
      }
    } catch (error) {
      if (error instanceof APIProviderParseError) {
        this.logger.error(`Failed to parse MCP server configs: ${error.message}`);
        if (error.cause) {
          this.logger.debug(`Parse error details: ${error.cause.message}`);
        }
      } else {
        this.logger.error(
          `Unexpected error parsing MCP servers: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Get API provider configuration by agent ID (WBS-24 Phase 1)
   */
  getAPIProviderConfig(agentId: string): APIProviderConfig | undefined {
    return this.apiProviderConfigs.get(agentId);
  }

  /**
   * Get all API provider configurations (WBS-24 Phase 1)
   */
  getAllAPIProviderConfigs(): Map<string, APIProviderConfig> {
    return new Map(this.apiProviderConfigs);
  }

  /**
   * Get MCP server configuration by name (WBS-24 Phase 1)
   */
  getMCPServerConfig(name: string): MCPServerConfig | undefined {
    return this.mcpServers[name];
  }

  /**
   * Get all MCP server configurations (WBS-24 Phase 1)
   */
  getAllMCPServerConfigs(): Record<string, MCPServerConfig> {
    return { ...this.mcpServers };
  }

  /**
   * Get loaded environment variables (WBS-24 Phase 1)
   */
  getEnvironmentVariables(): Record<string, string | undefined> {
    return { ...this.environmentVariables };
  }

  /**
   * Check if an agent is configured as an API provider (WBS-24 Phase 1)
   */
  isAPIProvider(agentId: string): boolean {
    return this.apiProviderConfigs.has(agentId);
  }

  /**
   * Get Slack file download directory (WBS-35 Phase 4)
   * Default: .crewx/slack-files
   */
  getSlackFileDownloadDir(): string {
    return process.env.CREWX_SLACK_FILE_DIR ||
           path.join(process.cwd(), '.crewx', 'slack-files');
  }

  /**
   * Check if Slack file download is enabled (WBS-35 Phase 4)
   * Default: true
   */
  isSlackFileDownloadEnabled(): boolean {
    return process.env.CREWX_SLACK_FILE_DOWNLOAD !== 'false';
  }

  /**
   * Get maximum file size for Slack file downloads (WBS-35 Phase 4)
   * Default: 10MB (10 * 1024 * 1024 bytes)
   */
  getSlackMaxFileSize(): number {
    const envValue = process.env.CREWX_SLACK_MAX_FILE_SIZE;
    return envValue ? parseInt(envValue, 10) : 10 * 1024 * 1024; // 10MB default
  }

  /**
   * Get allowed MIME types for Slack file downloads (WBS-35 Phase 4)
   * Default: [] (empty array = all types allowed)
   * Format: Comma-separated string in env var (e.g., "application/pdf,image/png")
   */
  getSlackAllowedMimeTypes(): string[] {
    const envValue = process.env.CREWX_SLACK_ALLOWED_MIME_TYPES;
    if (!envValue || envValue.trim() === '') {
      return []; // Empty = allow all types
    }

    return envValue.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
}
