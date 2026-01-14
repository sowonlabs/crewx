import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import * as path from 'path';

// Known CLI options - used for unknown option detection
const KNOWN_OPTIONS = new Set([
  // Boolean flags
  'install', 'log', 'http', 'raw', 'force', 'f', 'enable-intelligent-compression',
  'list', 'l', 'clean', 'mention-only',
  // String options
  'protocol', 'host', 'port', 'key', 'params', 'config', 'c', 'template', 't',
  'template-version', 'allow-tool', 'thread', 'provider', 'provider-config',
  'agent', 'a', 'mode',
  // Yargs built-in
  'help', 'h', 'version', 'v',
]);

// Known commands - used to validate first positional argument
const KNOWN_COMMANDS = new Set([
  'query', 'q', 'execute', 'x', 'doctor', 'init', 'templates', 'template',
  'agent', 'mcp', 'slack', 'log', 'slack:files', 'help', 'chat', 'skill',
]);

/**
 * Detect unknown CLI options and show error message
 * @param argv - Raw process arguments (process.argv)
 * @param command - The detected command (if any)
 * @returns Array of unknown options, empty if all options are valid
 */
function detectUnknownOptions(argv: string[], command?: string): string[] {
  const unknownOptions: string[] = [];

  for (const arg of argv) {
    // Skip non-option arguments
    if (!arg.startsWith('-')) continue;

    // Handle --option=value format
    const optionName = arg.replace(/^-+/, '').split('=')[0];

    // Skip empty option names (edge case: just '--' or '-')
    if (!optionName) continue;

    // Skip if it's a known option
    if (KNOWN_OPTIONS.has(optionName)) continue;

    // Check for negated boolean options (--no-xxx)
    if (optionName.startsWith('no-')) {
      const baseOption = optionName.slice(3);
      if (KNOWN_OPTIONS.has(baseOption)) continue;
    }

    unknownOptions.push(arg);
  }

  return unknownOptions;
}

/**
 * Show error message for unknown options and exit
 * @param unknownOptions - Array of unknown option strings
 * @param command - The command being run (for help suggestion)
 */
function showUnknownOptionsError(unknownOptions: string[], command?: string): never {
  const optionList = unknownOptions.join(', ');
  console.error(`Error: Unknown option${unknownOptions.length > 1 ? 's' : ''}: ${optionList}`);

  if (command && KNOWN_COMMANDS.has(command)) {
    console.error(`Run 'crewx ${command} --help' to see available options.`);
  } else {
    console.error(`Run 'crewx --help' to see available commands and options.`);
  }

  process.exit(1);
}

export interface CliOptions {
  install: boolean;
  log: boolean;
  protocol: 'STDIO' | 'HTTP';
  host?: string;
  port: number;
  allowTool: string[]; // Support for --allow-tool=terminal,files,web
  raw: boolean; // Output only AI response (for piping)
  // Context enhancement options
  enableIntelligentCompression: boolean; // Use intelligent compression
  // Conversation thread options
  thread?: string; // Thread ID for conversation continuity
  // CLI commands
  command?: string;
  subcommand?: string;
  query?: string | string[];
  execute?: string | string[];
  doctor?: boolean;
  logCommand?: boolean;
  logAction?: string; // Action or task ID for log command
  config?: string;
  // Provider options (NEW)
  provider?: string; // --provider cli/claude, cli/gemini, etc.
  providerConfig?: string; // --provider-config path/to/config.yaml
  // Init options
  template?: string;
  templateVersion?: string;
  force?: boolean;
  // Template command options (crewx template)
  templateSubcommand?: string; // init, list, show
  templateProjectName?: string; // Project name for init
  templateName?: string; // Template name for show
  // Skill command options (crewx skill)
  skillAction?: string; // list, info, or skill name
  skillTarget?: string; // skill name (for info) or first arg
  skillParams?: string[]; // Arguments for skill execution
  // Slack options
  slackAgent?: string; // Default agent for Slack bot
  slackMode?: 'query' | 'execute'; // Slack bot execution mode
  slackMentionOnly?: boolean; // Require explicit @mention in threads (prevents auto-response)
  // MCP-specific options
  http?: boolean;
  key?: string;
  mcpToolName?: string;
  mcpParams?: string;
  // API keys removed for security - use environment variables or CLI tool authentication instead
  rawArgs?: string[];
}

export function parseCliOptions(): CliOptions {
  // Read version from package.json
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
  );
  
  const parsed = yargs(hideBin(process.argv))
    .version(packageJson.version)
    .command('query [message...]', 'Query agents with a message', (yargs) => {
      yargs.positional('message', {
        description: 'Message to send to agents (supports @agent mentions). Multiple arguments will be joined.',
        type: 'string',
        array: true
      });
    })
    .command('q [message...]', 'Shorthand for query', (yargs) => {
      yargs.positional('message', {
        description: 'Message to send to agents (supports @agent mentions). Multiple arguments will be joined.',
        type: 'string',
        array: true
      });
    })
    .command('execute [task...]', 'Execute a task with agents', (yargs) => {
      yargs.positional('task', {
        description: 'Task to execute with agents (supports @agent mentions). Multiple arguments will be joined.',
        type: 'string',
        array: true
      });
    })
    .command('x [task...]', 'Shorthand for execute', (yargs) => {
      yargs.positional('task', {
        description: 'Task to execute with agents (supports @agent mentions). Multiple arguments will be joined.',
        type: 'string',
        array: true
      });
    })
    .command('doctor', 'Check AI provider status', () => {})
    .command('init', 'Initialize CrewX project', (yargs) => {
      yargs.option('template', {
        alias: 't',
        type: 'string',
        default: 'default',
        description: 'Template to use (default, minimal, development, production)'
      });
      yargs.option('template-version', {
        type: 'string',
        default: 'main',
        description: 'Template version to download (main, v0.1.8, etc.)'
      });
      yargs.option('force', {
        alias: 'f',
        type: 'boolean',
        default: false,
        description: 'Overwrite existing configuration file'
      });
    })
    .command('templates', 'Manage agent templates', (yargs) => {
      yargs.command('list', 'List available templates');
      yargs.command('update', 'Clear cache and re-download templates');
    })
    .command('template [subcommand] [name]', 'Project scaffolding system', (yargs) => {
      yargs.positional('subcommand', {
        description: 'Subcommand (init, list, show)',
        type: 'string',
        choices: ['init', 'list', 'show']
      });
      yargs.positional('name', {
        description: 'Project name (for init) or template name (for show)',
        type: 'string'
      });
      yargs.option('template', {
        alias: 't',
        type: 'string',
        default: 'wbs-automation',
        description: 'Template to use for init (wbs-automation, docusaurus-admin, dev-team)'
      });
    })
    .command('skill [action] [target] [params...]', 'Manage and execute skills', (yargs) => {
      yargs.positional('action', {
        description: 'Action (list, info) or skill name to execute',
        type: 'string'
      });
      yargs.positional('target', {
        description: 'Skill name (for info) or first argument for skill',
        type: 'string'
      });
      yargs.positional('params', {
        description: 'Additional arguments for skill execution',
        type: 'string',
        array: true
      });
    })
    .command('agent [action]', 'Manage configured agents', (yargs) => {
      yargs.command(['ls', 'list'], 'List available agents');
    })
    .command('mcp', 'Start MCP server for IDE integration', () => {})
    .command('slack', 'Start Slack Bot server', (yargs) => {
      yargs.option('agent', {
        alias: 'a',
        type: 'string',
        default: 'claude',
        description: 'Default agent to use for Slack conversations (claude, copilot, gemini, or custom agent ID)'
      });
      yargs.option('mode', {
        choices: ['query', 'execute'] as const,
        default: 'query' as const,
        description: 'Slack bot mode: query (read-only) or execute (allow file changes)',
      });
      yargs.option('mention-only', {
        type: 'boolean',
        default: false,
        description: 'Require explicit @mention in threads (prevents auto-response to thread messages)',
      });
    })
    .command('log [action]', 'Manage task logs', (yargs) => {
      yargs.command(['ls', 'list'], 'List all task logs');
      yargs.positional('action', {
        description: 'Action or task ID (ls/list or task_id)',
        type: 'string'
      });
    })
    .command('slack:files', 'Download and manage Slack thread files', (yargs) => {
      yargs.option('thread', {
        alias: 't',
        type: 'string',
        description: 'Slack thread timestamp (e.g., 1234567890.123456)'
      });
      yargs.option('list', {
        alias: 'l',
        type: 'boolean',
        default: false,
        description: 'List downloaded files'
      });
      yargs.option('clean', {
        type: 'boolean',
        default: false,
        description: 'Clean/delete downloaded files'
      });
    })
    .command('help', 'Show help', () => {})
    .option('install', {
      type: 'boolean',
      default: false,
      description: 'Run installation and setup process'
    })
    .option('log', {
      type: 'boolean',
      default: false,
      description: 'Enable detailed logging'
    })
    .option('protocol', {
      choices: ['STDIO', 'HTTP'] as const,
      default: 'STDIO' as const,
      description: 'MCP protocol to use'
    })
    .option('http', {
      type: 'boolean',
      default: false,
      description: 'Shortcut to run MCP server over HTTP (equivalent to --protocol=HTTP)'
    })
    .option('host', {
      type: 'string',
      default: '127.0.0.1',
      description: 'Host/IP address to bind the MCP HTTP server'
    })
    .option('port', {
      type: 'number',
      default: 3000,
      description: 'Port for HTTP protocol (if used)'
    })
    .option('key', {
      type: 'string',
      description: 'Security key for MCP HTTP server authentication (defaults to CREWX_MCP_KEY env if available)'
    })
    .option('params', {
      type: 'string',
      description: 'JSON string with parameters for MCP tool invocation'
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to agents configuration file (default: crewx.yaml or agents.yaml)'
    })
    .option('allow-tool', {
      type: 'array',
      default: [],
      description: 'Allowed tools for Copilot agent (e.g., terminal,files,web)',
      coerce: (value: string | string[]) => {
        if (typeof value === 'string') {
          return value.split(',').map(tool => tool.trim());
        }
        return value || [];
      }
    })
    .option('raw', {
      type: 'boolean',
      default: false,
      description: 'Output only AI response without formatting (useful for piping)'
    })
    .option('enable-intelligent-compression', {
      type: 'boolean',
      default: true,
      description: 'Use intelligent conversation compression'
    })
    .option('thread', {
      alias: 't',
      type: 'string',
      description: 'Thread ID for conversation continuity'
    })
    .option('provider', {
      type: 'string',
      description: 'AI provider to use (e.g., cli/claude, cli/gemini, cli/copilot, cli/codex)'
    })
    .option('provider-config', {
      type: 'string',
      description: 'Path to provider configuration file'
    })
    // API key options removed for security
    // Use environment variables or CLI tool authentication instead
    .help(false)
    .parseSync();

  const positionalArgs = (parsed._ || []) as Array<string | number>;
  const primaryCommand = positionalArgs.length > 0 ? String(positionalArgs[0]) : undefined;
  const secondaryCommand = positionalArgs.length > 1 ? String(positionalArgs[1]) : undefined;
  const tertiaryValue = positionalArgs.length > 2 ? String(positionalArgs[2]) : undefined;

  // Check for unknown options (skip if --help or -h is present)
  const rawArgs = hideBin(process.argv);
  if (!rawArgs.includes('--help') && !rawArgs.includes('-h')) {
    const unknownOptions = detectUnknownOptions(rawArgs, primaryCommand);
    if (unknownOptions.length > 0) {
      showUnknownOptionsError(unknownOptions, primaryCommand);
    }
  }

  const resolvedProtocol =
    parsed.http === true ? 'HTTP' : (parsed.protocol as 'STDIO' | 'HTTP');

  const resolvedKey =
    (parsed.key as string | undefined) ?? process.env.CREWX_MCP_KEY ?? undefined;

  return {
    install: parsed.install,
    log: parsed.log,
    protocol: resolvedProtocol,
    host: parsed.host as string,
    port: parsed.port,
    allowTool: parsed['allow-tool'] as string[] || [],
    raw: parsed.raw,
    // Context enhancement options
    enableIntelligentCompression: parsed['enable-intelligent-compression'] as boolean,
    // Conversation thread options
    thread: parsed.thread as string,
    // Provider options
    provider: parsed.provider as string || process.env.CREWX_PROVIDER,
    providerConfig: parsed['provider-config'] as string,
    command: primaryCommand,
    subcommand: secondaryCommand,
    // Keep query as array for parallel processing support
    query: Array.isArray(parsed.message) ? parsed.message : (parsed.message ? [parsed.message as string] : undefined),
    // Keep execute as array for parallel processing support
    execute: Array.isArray(parsed.task) ? parsed.task : (parsed.task ? [parsed.task as string] : undefined),
    doctor: primaryCommand === 'doctor',
    logCommand: primaryCommand === 'log',
    logAction: parsed.action as string,
    config: parsed.config,
    // Init options
    template: parsed.template as string,
    templateVersion: parsed['template-version'] as string,
    force: parsed.force as boolean,
    // Template command options
    templateSubcommand: parsed.subcommand as string,
    templateProjectName: parsed.name as string,
    templateName: parsed.name as string,
    // Skill options
    skillAction: parsed.action as string,
    skillTarget: parsed.target as string,
    skillParams: parsed.params as unknown as string[],
    // Slack options
    slackAgent: parsed.agent as string,
    slackMode: (parsed.mode as 'query' | 'execute' | undefined) || 'query',
    slackMentionOnly: parsed['mention-only'] as boolean || false,
    // MCP options
    http: parsed.http as boolean,
    key: resolvedKey,
    mcpToolName: secondaryCommand === 'call_tool' ? tertiaryValue : undefined,
    mcpParams: typeof parsed.params === 'string' ? parsed.params : undefined,
    rawArgs: process.argv.slice(2),
  };
}
