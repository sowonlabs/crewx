import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { AgentConfig, AgentsConfig } from '../types/agent.types';

export interface MentionTask {
  agents: string[];
  task: string;
  type: 'shared' | 'individual';
  models?: Map<string, string>;
}

export interface ParsedMentions {
  tasks: MentionTask[];
  unmatchedText: string[];
  errors: string[];
}

export class MentionParser {
  private readonly agentPattern = /(@[a-zA-Z0-9_]+(?::[a-zA-Z0-9._-]+)?)/g;
  private readonly validAgents: Set<string>;

  constructor(validAgents: string[]) {
    this.validAgents = new Set(validAgents);
  }

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
      leadingText = parts.shift()?.trim() ?? '';
    }

    for (const part of parts) {
      if (!part) continue;

      if (part.startsWith('@')) {
        const mentionPart = part.substring(1);
        const [agentId, model] = mentionPart.split(':');

        if (!agentId) continue;

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
        tasks[0].task = `${leadingText} ${tasks[0].task ?? ''}`.trim();
      } else {
        unmatchedText.push(leadingText);
      }
    }

    return { tasks, unmatchedText, errors };
  }
}

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
