import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';
import {
  PluginProviderConfig,
  RemoteProviderConfig,
  SkillLoadError,
  parseCrewxConfigFromFile,
  type AgentDefinition,
  type CrewxProjectConfig,
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

  constructor() {
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
    return this.projectConfig?.skillsPaths ? [...this.projectConfig.skillsPaths] : [];
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
}

