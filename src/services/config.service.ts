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

  constructor() {
    // Load config in constructor to ensure it's available before other services' onModuleInit()
    this.loadAgentConfigs();
  }

  onModuleInit() {
    // Config already loaded in constructor
  }

  private loadAgentConfigs() {
    // Priority: crewx.yaml > agents.yaml (backward compatibility)
    const configPaths = [
      { path: path.join(process.cwd(), 'crewx.yaml'), name: 'crewx.yaml' },
      { path: path.join(process.cwd(), 'agents.yaml'), name: 'agents.yaml' },
    ];

    let configPath: string | null = null;
    let configName: string | null = null;

    // Find first existing config file
    for (const config of configPaths) {
      if (existsSync(config.path)) {
        configPath = config.path;
        configName = config.name;
        break;
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
}
