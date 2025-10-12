import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import * as path from 'path';

export interface CliOptions {
  install: boolean;
  log: boolean;
  protocol: 'STDIO' | 'HTTP';
  port: number;
  host: string;
  apiKey?: string;
  allowTool: string[]; // Support for --allow-tool=terminal,files,web
  raw: boolean; // Output only AI response (for piping)
  // Context enhancement options
  loadProjectContext: boolean; // Load CLAUDE.md files
  projectContextMaxLength: number; // Max length for project context
  enableIntelligentCompression: boolean; // Use intelligent compression
  // Conversation thread options
  thread?: string; // Thread ID for conversation continuity
  // CLI commands
  command?: string;
  query?: string | string[];
  execute?: string | string[];
  doctor?: boolean;
  config?: string;
  // Init options
  template?: string;
  templateVersion?: string;
  force?: boolean;
  // Slack options
  slackAgent?: string; // Default agent for Slack bot
  // MCP utility commands
  mcpSubcommand?: string;
  mcpToolName?: string;
  mcpToolInput?: string;
  // API keys removed for security - use environment variables or CLI tool authentication instead
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
    .command('init', 'Initialize CodeCrew project', (yargs) => {
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
    .command('mcp', 'Start MCP server for IDE integration or run MCP utilities', () => {})
    .command('slack', 'Start Slack Bot server', (yargs) => {
      yargs.option('agent', {
        alias: 'a',
        type: 'string',
        default: 'claude',
        description: 'Default agent to use for Slack conversations (claude, copilot, gemini, or custom agent ID)'
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
      description: 'Shortcut for --protocol HTTP when running MCP server'
    })
    .option('port', {
      type: 'number',
      default: 3000,
      description: 'Port for HTTP protocol (if used)'
    })
    .option('host', {
      type: 'string',
      default: '127.0.0.1',
      description: 'Host for MCP HTTP server'
    })
    .option('key', {
      type: 'string',
      description: 'Bearer token required for MCP HTTP requests (also read from CREWX_MCP_KEY)'
    })
    .option('tool', {
      type: 'string',
      description: 'Tool name when using "crewx mcp call_tool"'
    })
    .option('input', {
      type: 'string',
      description: 'JSON string payload passed to "crewx mcp call_tool"'
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
    .option('load-project-context', {
      type: 'boolean',
      default: true,
      description: 'Load project context from CLAUDE.md files'
    })
    .option('project-context-max-length', {
      type: 'number',
      default: 2000,
      description: 'Maximum length for project context'
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
    // API key options removed for security
    // Use environment variables or CLI tool authentication instead
    .help(false)
    .parseSync();

  const positional = (parsed._ as (string | number)[]).map(value => value.toString());
  const command = positional[0] as string;
  const mcpArgs = positional.slice(1);
  const protocol = parsed.http ? 'HTTP' : (parsed.protocol as 'STDIO' | 'HTTP');
  const mcpSubcommand = mcpArgs[0];
  const resolvedToolName = (parsed.tool as string | undefined) ?? (mcpSubcommand === 'call_tool' ? mcpArgs[1] : undefined);
  const resolvedToolInput = (parsed.input as string | undefined) ?? (mcpSubcommand === 'call_tool' ? (mcpArgs.slice(2).join(' ') || undefined) : undefined);

  return {
    install: parsed.install,
    log: parsed.log,
    protocol,
    port: parsed.port,
    host: parsed.host as string,
    apiKey: (parsed.key as string | undefined) ?? process.env.CREWX_MCP_KEY ?? undefined,
    allowTool: (parsed['allow-tool'] as string[]) || [],
    raw: parsed.raw,
    // Context enhancement options
    loadProjectContext: parsed['load-project-context'] as boolean,
    projectContextMaxLength: parsed['project-context-max-length'] as number,
    enableIntelligentCompression: parsed['enable-intelligent-compression'] as boolean,
    // Conversation thread options
    thread: parsed.thread as string,
    command,
    // Keep query as array for parallel processing support
    query: Array.isArray(parsed.message) ? parsed.message : (parsed.message ? [parsed.message as string] : undefined),
    // Keep execute as array for parallel processing support
    execute: Array.isArray(parsed.task) ? parsed.task : (parsed.task ? [parsed.task as string] : undefined),
    doctor: command === 'doctor',
    config: parsed.config,
    // Init options
    template: parsed.template as string,
    templateVersion: parsed['template-version'] as string,
    force: parsed.force as boolean,
    // Slack options
    slackAgent: parsed.agent as string,
    // MCP utilities
    mcpSubcommand,
    mcpToolName: resolvedToolName,
    mcpToolInput: resolvedToolInput,
  };
}