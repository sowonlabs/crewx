import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { CrewXTool } from '../crewx.tool';
import { AgentInfo } from '@sowonai/crewx-sdk';

const logger = new Logger('AgentHandler');

/**
 * Handle agent command: crewx agent <subcommand>
 */
export async function handleAgent(app: any, args: CliOptions) {
  logger.log('Agent command received');

  try {
    const crewXTool = app.get(CrewXTool);
    const raw = Boolean(args.raw);
    
    // Robust subcommand detection
    let resolvedSubcommand = (args.subcommand || '').toLowerCase();
    
    // If subcommand is not recognized but 'prompt' exists in argv, use it
    const promptIndex = process.argv.indexOf('prompt');
    if (promptIndex !== -1) {
      resolvedSubcommand = 'prompt';
    } else if (!resolvedSubcommand && process.argv[3]) {
      resolvedSubcommand = process.argv[3].toLowerCase();
    }

    switch (resolvedSubcommand) {
      case 'ls':
      case 'list':
      case '':
        // Default to list when no subcommand (crewx agent → crewx agent ls)
        await handleAgentList(crewXTool, raw);
        break;

      case 'prompt':
      case 'p':
        // Get agent ID from the argument after 'prompt'
        const agentIdRaw = promptIndex !== -1 ? process.argv[promptIndex + 1] : process.argv[4];
        if (!agentIdRaw) {
          console.error('❌ Missing agent ID. Usage: crewx agent prompt @agent_name');
          process.exit(1);
        }
        // Remove leading '@' if present
        const agentId = agentIdRaw.startsWith('@') ? agentIdRaw.slice(1) : agentIdRaw;
        await handleAgentPrompt(crewXTool, agentId, raw);
        break;

      default:
        logger.error(`Unknown agent subcommand: ${resolvedSubcommand}`);
        console.error(`❌ Unknown agent subcommand: ${resolvedSubcommand}`);
        printAgentHelp();
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Agent command failed: ${message}`);
    console.error(`❌ Agent command failed: ${message}`);
    process.exit(1);
  }
}

async function handleAgentList(crewXTool: CrewXTool, raw: boolean) {
  logger.log('Listing configured agents');
  console.log('[CrewX] Loading configured agents...\n');

  try {
    const result = await crewXTool.listAgents();

    if (!result?.success) {
      const errorMessage = result?.error || 'Unknown error';
      logger.error(`Failed to list agents: ${errorMessage}`);
      console.error(`❌ Failed to load agents: ${errorMessage}`);
      process.exit(1);
    }

    const agents: AgentInfo[] = Array.isArray(result.availableAgents) ? result.availableAgents : [];
    const totalCount = result.totalCount ?? agents.length;
    const configPath = process.env.CREWX_CONFIG ?? null;

    if (raw) {
      const payload = {
        totalCount,
        configurationSource: result.configurationSource ?? (configPath ? 'External YAML file' : 'Default hardcoded values'),
        configPath,
        agents,
      };
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    if (agents.length === 0) {
      console.log('WARNING: No agents configured.');
      if (!configPath) {
        console.log('Set CREWX_CONFIG to point to your crewx.yaml configuration file.');
      }
      return;
    }

    console.log(`Available Agents (${totalCount})\n`);

    agents.forEach((agent, index) => {
      const headerParts = [`@${agent.id}`];
      if (agent.name && agent.name !== agent.id) {
        headerParts.push(agent.name);
      }

      console.log(`${index + 1}. ${headerParts.join(' - ')}`);
      console.log(`   Provider: ${formatProvider(agent.provider)}`);
      console.log(`   Working Dir: ${agent.workingDirectory}`);

      if (agent.role) {
        console.log(`   Role: ${agent.role}`);
      }

      if (agent.team) {
        console.log(`   Team: ${agent.team}`);
      }

      if (agent.description) {
        console.log(`   Description: ${agent.description}`);
      }

      if (agent.inline?.model) {
        console.log(`   Default Model: ${agent.inline.model}`);
      }

      if (agent.specialties && agent.specialties.length > 0) {
        console.log(`   Specialties: ${agent.specialties.join(', ')}`);
      }

      if (agent.capabilities && agent.capabilities.length > 0) {
        console.log(`   Capabilities: ${agent.capabilities.join(', ')}`);
      }

      if (agent.remote) {
        const remoteDetails = agent.remote.url ? ` ${agent.remote.url}` : '';
        console.log(`   Remote: ${agent.remote.type || 'remote'}${remoteDetails}`);
        if (agent.remote.agentId) {
          console.log(`   Remote Agent ID: ${agent.remote.agentId}`);
        }
      }

      if (index < agents.length - 1) {
        console.log('');
      }
    });

    console.log('\nConfiguration Source:', result.configurationSource ?? (configPath ? 'External YAML file' : 'Default hardcoded values'));
    if (configPath) {
      console.log(`Config Path: ${configPath}`);
    } else {
      console.log('Tip: Set CREWX_CONFIG to point to your crewx.yaml file to customize agents.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to list agents: ${message}`);
    console.error(`❌ Failed to list agents: ${message}`);
    process.exit(1);
  }
}

async function handleAgentPrompt(crewXTool: CrewXTool, agentId: string, raw: boolean) {
  if (!agentId) {
    console.error('❌ Error: Agent ID is required for prompt command.');
    console.log('Usage: crewx agent prompt <agentId>');
    process.exit(1);
  }

  logger.log(`Inspecting prompt for agent: ${agentId}`);

  try {
    const renderedPrompt = await crewXTool.getRenderedAgentPrompt(agentId);
    
    if (raw) {
      console.log(renderedPrompt);
    } else {
      console.log(`\n🤖 **Rendered Prompt for Agent: ${agentId}**\n`);
      console.log('--- BEGIN PROMPT ---');
      console.log(renderedPrompt);
      console.log('--- END PROMPT ---');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get agent prompt: ${message}`);
    console.error(`❌ Failed to get agent prompt: ${message}`);
    process.exit(1);
  }
}

function formatProvider(provider: AgentInfo['provider']): string {
  if (Array.isArray(provider)) {
    return provider.join(', ');
  }
  return provider;
}

function printAgentHelp() {
  console.log(`
CrewX Agent Management

Usage:
  crewx agent             # List configured agents (default)
  crewx agent ls          # List configured agents
  crewx agent list        # Alias for ls
  crewx agent prompt <id> # Inspect rendered agent prompt

Examples:
  crewx agent
  crewx agent ls
  CREWX_CONFIG=./crewx.yaml crewx agent list

Tips:
  - Use --raw to print JSON output suitable for scripting.
  - Set CREWX_CONFIG to point to your custom crewx.yaml file.
`);
}
