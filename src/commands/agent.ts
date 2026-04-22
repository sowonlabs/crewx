/**
 * crewx agent handler.
 * Dispatches `crewx agent ls` and `crewx agent prompt` subcommands.
 */

import * as path from 'path';
import { existsSync } from 'fs';
import { createCliCrewx } from '../bootstrap/crewx-cli';
import type { Crewx, AgentConfig, SkillEntry } from '@crewx/sdk';
import { ConfigLoadError } from '@crewx/sdk';
import { SkillEngine } from '@crewx/skill';

/**
 * Parse a flag from args array.
 * Supports both `--flag=value` and `--flag value` forms.
 * Returns undefined if flag is not present.
 */
function parseFlag(args: string[], flag: string): string | undefined {
  const prefix = `--${flag}=`;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(prefix)) {
      return args[i].slice(prefix.length);
    }
    if (args[i] === `--${flag}` && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

/**
 * Format provider field for display.
 */
function formatProvider(provider: AgentConfig['provider']): string {
  return Array.isArray(provider) ? provider.join(', ') : provider;
}

/**
 * Print the agent list.
 */
function printAgentList(agents: AgentConfig[], total: number, isFiltered: boolean): void {
  const configPath = process.env.CREWX_CONFIG ?? null;

  if (agents.length === 0) {
    console.log('WARNING: No agents configured.');
    if (!configPath) {
      console.log('Set CREWX_CONFIG to point to your crewx.yaml configuration file.');
    }
    return;
  }

  const headerCount = isFiltered ? `${agents.length} / ${total}` : `${total}`;
  console.log(`Available Agents (${headerCount})\n`);

  agents.forEach((agent, index) => {
    const headerParts = [`@${agent.id}`];
    if (agent.name && agent.name !== agent.id) {
      headerParts.push(agent.name);
    }

    console.log(`${index + 1}. ${headerParts.join(' - ')}`);
    console.log(`   Provider: ${formatProvider(agent.provider)}`);

    const workDir = (agent as Record<string, unknown>).working_directory ?? (agent as Record<string, unknown>).workingDirectory ?? '.';
    console.log(`   Working Dir: ${workDir}`);

    if (agent.role) {
      console.log(`   Role: ${agent.role}`);
    }
    if (agent.team) {
      console.log(`   Team: ${agent.team}`);
    }
    if (agent.description) {
      console.log(`   Description: ${agent.description}`);
    }

    if (index < agents.length - 1) {
      console.log('');
    }
  });

  const configSource = configPath ? 'External YAML file' : 'Default hardcoded values';
  console.log(`\nConfiguration Source: ${configSource}`);
  if (configPath) {
    console.log(`Config Path: ${configPath}`);
  } else {
    console.log('Tip: Set CREWX_CONFIG to point to your crewx.yaml file to customize agents.');
  }
}

/**
 * Handle `crewx agent ls` — list agents with optional filters.
 */
async function handleAgentList(crewx: Crewx, args: string[]): Promise<void> {
  const role = parseFlag(args, 'role');
  const team = parseFlag(args, 'team');
  const provider = parseFlag(args, 'provider');

  const isFiltered = !!(role || team || provider);
  const total = crewx.agents.size;
  const filtered = crewx.filterAgents({ role, team, provider });

  printAgentList(filtered, total, isFiltered);
}

/**
 * Handle `crewx agent prompt <agentId>` — print fully rendered system prompt.
 * Renders Handlebars template variables via Crewx.renderAgentPromptFull().
 */
async function handleAgentPrompt(crewx: Crewx, args: string[]): Promise<void> {
  // Find the agent id argument (first non-flag arg after 'prompt')
  const agentIdRaw = args.find(a => !a.startsWith('--'));
  if (!agentIdRaw) {
    console.error('Missing agent ID. Usage: crewx agent prompt @agent_name');
    process.exit(1);
  }

  try {
    const skills = loadAgentSkills();
    const rendered = await crewx.renderAgentPromptFull(agentIdRaw, {
      env: process.env as Record<string, string>,
      session: { mode: 'query', platform: 'cli' },
      skills,
    });
    const displayId = agentIdRaw.startsWith('@') ? agentIdRaw.slice(1) : agentIdRaw;
    console.log(`\n🤖 **Rendered Prompt for Agent: ${displayId}**\n`);
    console.log('--- BEGIN PROMPT ---');
    console.log(rendered);
    console.log('--- END PROMPT ---');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to get agent prompt: ${message}`);
    process.exit(1);
  }
}

/**
 * Handle `crewx agent [subcommand] [options]`.
 *
 * Subcommands:
 *   ls | list | (none) — list agents (default)
 *   prompt <agentId>   — print rendered system prompt
 */
export async function handleAgent(args: string[]): Promise<void> {
  const configPath = process.env.CREWX_CONFIG ?? 'crewx.yaml';
  let crewx: Crewx;
  try {
    crewx = await createCliCrewx(configPath);
  } catch (err) {
    if (err instanceof ConfigLoadError && !existsSync(configPath)) {
      const subcommand = (args[0] ?? '').toLowerCase();
      if (!subcommand || subcommand === 'ls' || subcommand === 'list') {
        console.log('WARNING: No agents configured.');
        console.log(`No crewx.yaml found. Run 'crewx init' to create one.`);
        return;
      }
    }
    throw err;
  }

  const subcommand = (args[0] ?? '').toLowerCase();

  switch (subcommand) {
    case 'ls':
    case 'list':
      await handleAgentList(crewx, args.slice(1));
      return;

    case '':
      // Default: no subcommand → ls
      await handleAgentList(crewx, args.slice(1));
      return;

    case 'prompt':
    case 'p':
      await handleAgentPrompt(crewx, args.slice(1));
      return;

    default:
      console.error(`Unknown agent subcommand: ${subcommand}`);
      printAgentHelp();
      process.exit(1);
  }
}

/**
 * Discover available skills and convert to SkillEntry format for template rendering.
 * Searches skills/ and node_modules/@crewx directories.
 */
function loadAgentSkills(): SkillEntry[] {
  try {
    const engine = new SkillEngine(process.cwd());
    const discovered = engine.discover();

    return discovered.map(s => ({
      metadata: {
        name: s.name,
        version: s.version ?? '0.0.0',
        description: s.description ?? '',
      },
      filePath: s.skillMdPath ?? path.join(s.dir, 'SKILL.md'),
    }));
  } catch {
    return [];
  }
}

function printAgentHelp(): void {
  console.log(`
CrewX Agent Management

Usage:
  crewx agent             # List configured agents (default)
  crewx agent ls          # List configured agents
  crewx agent list        # Alias for ls
  crewx agent prompt <id> # Inspect rendered agent prompt

Filter Options (for agent ls):
  --role <value>      Filter by agent role (comma-separated for multiple: PM,Dev)
  --team <value>      Filter by agent team (comma-separated for multiple)
  --provider <value>  Filter by provider (comma-separated, partial match: claude)

Examples:
  crewx agent
  crewx agent ls
  crewx agent ls --role=PM
  crewx agent ls --team="CrewX Core 개발팀"
  crewx agent ls --provider=claude
  crewx agent ls --role=PM --provider=claude
  crewx agent ls --role=PM,general
  CREWX_CONFIG=./crewx.yaml crewx agent list
`.trim());
}
