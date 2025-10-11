import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { PluginProviderConfig } from '../providers/dynamic-provider.factory';

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
    provider: 'claude' | 'gemini' | 'copilot';
    system_prompt: string;
  };
}

export interface CrewXConfig {
  agents: AgentConfig[];
  providers?: PluginProviderConfig[];
}

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private agents: Map<string, AgentConfig> = new Map();
  private pluginProviders: PluginProviderConfig[] = [];
  private customConfigPath: string | null = null;

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
    this.pluginProviders = [];

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
        this.pluginProviders = config.providers.filter(
          (p: any) => p.type === 'plugin'
        );
        this.logger.log(`Loaded ${this.pluginProviders.length} plugin provider configurations.`);
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
    return this.pluginProviders;
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
