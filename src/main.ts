#!/usr/bin/env node
/**
 * CrewX CLI entry point.
 * Dispatches commands to the appropriate handler.
 *
 * Boot sequence:
 *   1. Inject CREWX_CLI / CREWX_WORKSPACE env defaults (must be first)
 *   2. Parse command
 *   3. Dispatch to handler
 */

// ─── P0-1: Env Bootstrap ─────────────────────────────────────────────────────
// Must run before any other code that might use process.env.CREWX_CLI.
import { resolveCrewxCli, resolveCrewxWorkspace } from './utils/env-defaults';

process.env.CREWX_CLI ??= resolveCrewxCli();
process.env.CREWX_WORKSPACE ??= resolveCrewxWorkspace();

// ─── Command Imports ──────────────────────────────────────────────────────────
import { handleQuery } from './commands/query';
import { handleExecute } from './commands/execute';
import { handleAgent } from './commands/agent';
import { handlePs } from './commands/ps';
import { handleKill } from './commands/kill';
import { handleResult } from './commands/result';
import { handleLog } from './commands/log';
import { handleDoctor } from './commands/doctor';
import { handleInit } from './commands/init';
import { handleBuiltin, BUILTIN_COMMANDS } from './builtin';
import { handleSlack } from './commands/slack';
import { handleHookInstall } from './commands/hook/install';
import { handleHookUninstall } from './commands/hook/uninstall';
import { handleHookStatus } from './commands/hook/status';
import { handleHookDispatch } from './commands/hook-dispatch';
import { CLI_VERSION } from './utils/version';

// Commands deferred to future rounds
const NOT_YET_MIGRATED = new Set([
  'template',
  'templates',
  'chat',
  'mcp',
]);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(0);
  }

  // Built-in tools: memory, search, doc, wbs, cron, workflow
  if (BUILTIN_COMMANDS.has(command)) {
    await handleBuiltin(command, args.slice(1));
    return;
  }

  // P2: skill routing — pass through to @crewx/skill binary
  if (command === 'skill') {
    await runSkill(args.slice(1));
    return;
  }

  // Core commands
  switch (command) {
    // P0-2: q/x aliases
    case 'q':
    case 'query':
      await handleQuery(args.slice(1));
      return;

    case 'x':
    case 'execute':
      await handleExecute(args.slice(1));
      return;

    case 'agent':
      await handleAgent(args.slice(1));
      return;

    // P0-4: ps
    case 'ps':
      await handlePs(args.slice(1));
      return;

    // P0-5: kill
    case 'kill':
      await handleKill(args.slice(1));
      return;

    // P0-6: result
    case 'result':
      await handleResult(args.slice(1));
      return;

    // P1-1: log
    case 'log':
      await handleLog(args.slice(1));
      return;

    // P1-1: doctor
    case 'doctor':
      await handleDoctor(args.slice(1));
      return;

    // P1-1: init
    case 'init': {
      const initArgs = args.slice(1);
      const force = initArgs.includes('--force') || initArgs.includes('-f');
      try {
        const r = await handleInit({ path: process.cwd(), force });
        if (r.skippedReason === 'yaml-exists') {
          console.log('✓ crewx.yaml already exists (use --force to overwrite)');
        } else {
          console.log(r.yamlCreated ? '✓ crewx.yaml created' : '✓ yaml skipped');
          console.log(r.hookInstalled ? '✓ hook installed' : '⚠ hook skipped');
          if (r.errors.length > 0) console.warn('Warnings:', r.errors.join('; '));
        }
        console.log('✓ done');
      } catch (e: any) {
        console.error('✗ init failed:', e.message);
        process.exit(1);
      }
      return;
    }

    // SDK-009: slack / slack:files
    case 'slack':
    case 'slack:files':
      await handleSlack(args.slice(1));
      return;

    // Hook Platform (Phase 0)
    case 'hook-dispatch':
      await handleHookDispatch(args.slice(1));
      return;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;

    case '--version':
    case '-v': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('../package.json') as { version: string };
      console.log(pkg.version);
      return;
    }
  }

  // Not yet migrated commands (SDK-009)
  if (NOT_YET_MIGRATED.has(command)) {
    console.error(
      `Command '${command}' is not yet migrated in SDK refactor round. ` +
      'See packages/cli-bak for reference.',
    );
    process.exit(1);
  }

  // Hook subcommands: crewx hook install/uninstall/status
  if (command === 'hook') {
    const subcommand = args[1];
    const subArgs = args.slice(2);
    switch (subcommand) {
      case 'install':
        await handleHookInstall(subArgs);
        return;
      case 'uninstall':
        await handleHookUninstall(subArgs);
        return;
      case 'status':
        await handleHookStatus(subArgs);
        return;
      default:
        console.error(`Unknown hook subcommand: ${subcommand ?? '(none)'}`);
        console.error('Usage: crewx hook install|uninstall|status');
        process.exit(1);
    }
  }

  // Unknown command
  console.error(`Unknown command: ${command}`);
  console.error('Run `crewx --help` for usage.');
  process.exit(1);
}

/**
 * P2: Route `crewx skill ...` to the @crewx/skill CLI.
 * Uses `node <skill-cli-path>` to avoid symlink exec permission issues.
 * Falls back to spawning 'skill' on PATH if the local binary is not found.
 */
async function runSkill(skillArgs: string[]): Promise<void> {
  const { spawn } = await import('child_process');
  const { resolve } = await import('path');
  const { existsSync } = await import('fs');

  // Resolve the @crewx/skill CLI entry point directly (monorepo root)
  const skillCliJs = resolve(__dirname, '../../../node_modules/@crewx/skill/dist/cli.js');

  await new Promise<void>((res, rej) => {
    // Prefer: node <skill-cli.js> (avoids symlink exec issues on macOS)
    const [cmd, args] = existsSync(skillCliJs)
      ? ['node', [skillCliJs, ...skillArgs]]
      : ['skill', skillArgs];

    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      process.exitCode = code ?? 0;
      res();
    });
    proc.on('error', (spawnErr) => {
      if (cmd === 'node') {
        // Fallback: try 'skill' on PATH
        const fallback = spawn('skill', skillArgs, { stdio: 'inherit' });
        fallback.on('close', (c) => { process.exitCode = c ?? 0; res(); });
        fallback.on('error', rej);
      } else {
        rej(spawnErr);
      }
    });
  });
}

function printHelp(): void {
  console.log(`
CrewX CLI v${CLI_VERSION}

Usage:
  crewx <command> [options]

Query / Execute:
  q|query [@agent] <message>     Query an agent (read-only)
  x|execute [@agent] <task>      Execute a task with an agent (write-capable)

  @agent is optional — defaults to @crewx when omitted.

  Common flags:
    --thread <name>              Conversation thread
    --provider <cli/xxx>         Provider override
    --metadata <json>            Extra metadata (JSON object, double-quoted). Propagated to events/hooks/tracing.
                                 Invalid JSON aborts with exit code 2.
                                 e.g. --metadata='{"workflow_id":"wf-1"}'
    --verbose                    Debug output mode (default: raw response only)
    --config/-c <path>           Config file path (default: CREWX_CONFIG or crewx.yaml)
    --output-format <fmt>        Output format (json|text|stream-json)
    --effort <level>             Model effort (high|medium|low)

Agent Management:
  agent ls [options]             List configured agents
    --role <value>               Filter by role (comma-separated for OR match)
    --team <value>               Filter by team (comma-separated for OR match)
    --provider <value>           Filter by provider (comma-separated for OR match)
  agent prompt <@id>             Show rendered system prompt for an agent

Task Management:
  ps                             List running tasks
  kill <task-id>                 Kill a running task
  kill --all                     Kill all running tasks
  result [task-id]               Get task result (or list recent tasks)

Logs & Diagnostics:
  log [ls|<task-id>]             View task logs
  doctor [--config <path>]       Run system diagnosis
  init [--force] [--config <p>]  Initialize crewx.yaml

Built-in Tools:
  memory <args>                  Memory tool
  search <args>                  Search tool
  doc <args>                     Doc tool
  wbs <args>                     WBS tool
  cron <args>                    Cron tool
  workflow <args>                Workflow tool
  skill <args>                   Skill tool

Hook Platform:
  hook install [--yes]           Install PreToolUse hook in .claude/settings.json
  hook uninstall                 Remove crewx hook from .claude/settings.json
  hook status                    Show hook installation status and plugins
  hook-dispatch                  Internal: IPC router called by Claude (stdin→stdout)

Global Options:
  --help, -h                     Show this help
  --version, -v                  Show version
`.trim());
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
