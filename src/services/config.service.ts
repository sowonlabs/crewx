import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { PluginProviderConfig, RemoteProviderConfig } from '../providers/dynamic-provider.factory';

export interface AgentConfig {
  id: string;
  name?: string;
  role?: string;
  team?: string;
  working_directory?: string;
  options?: {
    query?: string[];
    execute?: string[];
  };
  inline?: {
    type: 'agent';
    provider: 'claude' | 'gemini' | 'copilot' | 'codex';
    system_prompt: string;
  };
}

export interface CrewXConfig {
  agents: AgentConfig[];
  providers?: PluginProviderConfig[];
  settings?: {
    slack?: {
      log_conversations?: boolean;
    };
  };
}

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private agents: Map<string, AgentConfig> = new Map();
  private providerConfigs: Array<PluginProviderConfig | RemoteProviderConfig> = [];
  private customConfigPath: string | null = null;
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
    this.slackSettings = { logConversations: false };

    let configPath: string | null = null;
    let configName: string | null = null;

    // Priority: CLI --config option > crewx.yaml > agents.yaml
    if (this.customConfigPath) {
      const customPath = path.isAbsolute(this.customConfigPath)
        ? this.customConfigPath
        : path.join(process.cwd(), this.customConfigPath);

      if (existsSync(customPath)) {
        configPath = customPath;
        configName = path.basename(customPath);
      } else {
        this.logger.error(`Custom config file not found: ${customPath}`);
        return;
      }
    } else {
      // Default: search for crewx.yaml or agents.yaml
      const configPaths = [
        { path: path.join(process.cwd(), 'crewx.yaml'), name: 'crewx.yaml' },
        { path: path.join(process.cwd(), 'agents.yaml'), name: 'agents.yaml' },
      ];

      // Find first existing config file
      for (const config of configPaths) {
        if (existsSync(config.path)) {
          configPath = config.path;
          configName = config.name;
          break;
        }
      }
    }

    if (!configPath) {
      this.logger.warn('No configuration file found (crewx.yaml or agents.yaml). No agent configurations loaded.');
      return;
    }

    this.logger.log(`Loading agent configurations from: ${configPath}`);

    try {
      const configContent = readFileSync(configPath, 'utf8');

      // Use default (JSON) schema for proper type conversion
      // FAILSAFE_SCHEMA was too restrictive - it treats all values as strings
      const config = yaml.load(configContent) as any;

      // Load agents
      if (config.agents && Array.isArray(config.agents)) {
        for (const agent of config.agents) {
          if (agent.id) {
            this.agents.set(agent.id, agent);
          }
        }
        this.logger.log(`Loaded ${this.agents.size} agent configurations from ${configName}.`);
      }

      // Load plugin providers
      if (config.providers && Array.isArray(config.providers)) {
        this.providerConfigs = config.providers.filter(
          (p: any) => p && (p.type === 'plugin' || p.type === 'remote')
        );

        const pluginCount = this.providerConfigs.filter(
          (p): p is PluginProviderConfig => p.type === 'plugin'
        ).length;
        const remoteCount = this.providerConfigs.filter(
          (p): p is RemoteProviderConfig => p.type === 'remote'
        ).length;

        this.logger.log(`Loaded ${pluginCount} plugin provider configurations.`);
        if (remoteCount > 0) {
          this.logger.log(`Loaded ${remoteCount} remote provider configurations.`);
        }
      }

      // Load Slack settings
      if (config.settings?.slack?.log_conversations !== undefined) {
        this.slackSettings.logConversations = Boolean(
          config.settings.slack.log_conversations,
        );
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
          `Slack conversation logging ${this.slackSettings.logConversations ? 'enabled' : 'disabled'} via CREWX_SLACK_LOG_CONVERSATIONS.`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to load or parse ${configName}`, error);
    }
  }

  getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId);
  }

  getAllAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  getPluginProviders(): PluginProviderConfig[] {
    return this.providerConfigs.filter(
      (provider): provider is PluginProviderConfig => provider.type === 'plugin'
    );
  }

  getRemoteProviders(): RemoteProviderConfig[] {
    return this.providerConfigs.filter(
      (provider): provider is RemoteProviderConfig => provider.type === 'remote'
    );
  }

  getDynamicProviders(): Array<PluginProviderConfig | RemoteProviderConfig> {
    return [...this.providerConfigs];
  }

  shouldLogSlackConversations(): boolean {
    return this.slackSettings.logConversations;
  }

  /**
   * Get the currently loaded config file path
   * Used by AgentLoaderService to load from the same config
   */
  getCurrentConfigPath(): string | null {
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
}
