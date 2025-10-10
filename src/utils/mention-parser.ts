import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { AgentConfig, AgentsConfig } from '../agent.types';

/**
 * Represents a task assigned to one or more agents.
 */
export interface MentionTask {
  agents: string[];
  task: string;
  type: 'shared' | 'individual';
  models?: Map<string, string>; // Map of agentId -> model (e.g., "claude" -> "sonnet")
}

/**
 * The result of parsing a command string for agent mentions and tasks.
 */
export interface ParsedMentions {
  tasks: MentionTask[];
  unmatchedText: string[];
  errors: string[];
}

/**
 * Parses command strings that include agent mentions (e.g., "@agent1 task A").
 * It identifies agents, distinguishes between shared and individual tasks,
 * and validates agent IDs.
 *
 * - Shared task: "@agent1 @agent2 do something together"
 * - Individual tasks: "@agent1 do task A @agent2 do task B"
 * - With model: "@agent1:model task A" or "@claude:sonnet explain this code"
 */
export class MentionParser {
  private readonly agentPattern = /(@[a-zA-Z0-9_]+(?::[a-zA-Z0-9._-]+)?)/g;
  private readonly validAgents: Set<string>;

  constructor(validAgents: string[]) {
    this.validAgents = new Set(validAgents);
  }

  /**
   * Parses the input text to extract agent tasks.
   * @param text The command string to parse.
   * @returns A ParsedMentions object containing tasks, errors, and any unmatched text.
   */
  parse(text: string): ParsedMentions {
    const tasks: MentionTask[] = [];
    const errors: string[] = [];
    const unmatchedText: string[] = [];

    const parts = text.split(this.agentPattern);

    let agentGroup: string[] = [];
    let modelMap = new Map<string, string>();
    let taskText = '';
    let leadingText = '';

    if (parts.length > 0 && parts[0] && !parts[0].startsWith('@')) {
        leadingText = parts.shift()?.trim() || '';
    }

    for (const part of parts) {
        if (!part) continue;

        if (part.startsWith('@')) {
            // Parse @agent:model format
            const mentionPart = part.substring(1); // Remove @
            const [agentId, model] = mentionPart.split(':');
            
            if (!agentId) continue; // Skip if no agent ID
            
            if (this.validAgents.has(agentId)) {
                if (taskText.trim() && agentGroup.length > 0) {
                    tasks.push({
                        agents: agentGroup,
                        task: taskText.trim(),
                        type: agentGroup.length > 1 ? 'shared' : 'individual',
                        models: modelMap.size > 0 ? modelMap : undefined,
                    });
                    agentGroup = [agentId];
                    modelMap = new Map<string, string>();
                    if (model) {
                        modelMap.set(agentId, model);
                    }
                    taskText = '';
                } else {
                    agentGroup.push(agentId);
                    if (model) {
                        modelMap.set(agentId, model);
                    }
                }
            } else {
                errors.push(`Unknown agent: @${agentId}`);
            }
        } else {
            taskText += part;
        }
    }

    if (agentGroup.length > 0) {
        const trimmedTask = taskText.trim();
        if (trimmedTask) {
            tasks.push({
                agents: agentGroup,
                task: trimmedTask,
                type: agentGroup.length > 1 ? 'shared' : 'individual',
                models: modelMap.size > 0 ? modelMap : undefined,
            });
        }
    } else if (taskText.trim()) {
        unmatchedText.push(taskText.trim());
    }

    if (leadingText) {
        if (tasks.length > 0 && tasks[0]) {
            tasks[0].task = leadingText + ' ' + (tasks[0].task || '');
        } else {
            unmatchedText.push(leadingText);
        }
    }

    return { tasks, unmatchedText, errors };
  }
}

/**
 * Loads agent configurations from a YAML file and returns their IDs.
 * @param configPath The path to the agents.yaml configuration file.
 * @returns A promise that resolves to an array of agent IDs.
 */
export async function loadAvailableAgents(configPath: string = 'agents.yaml'): Promise<string[]> {
  try {
    const fileContents = await fs.promises.readFile(configPath, 'utf8');
    const config = yaml.load(fileContents) as AgentsConfig;
    
    if (config && Array.isArray(config.agents)) {
      return config.agents.map((agent: AgentConfig) => agent.id);
    }
    
    console.warn(`Warning: Could not find agents in ${configPath}.`);
    return [];
  } catch (error) {
    console.error(`Error loading or parsing ${configPath}:`, error);
    return [];
  }
}