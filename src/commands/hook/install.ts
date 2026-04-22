/**
 * crewx hook install — Register crewx-hook-dispatch as a PreToolUse hook
 * in <projectRoot>/.claude/settings.json and/or <projectRoot>/.codex/hooks.json.
 *
 * Security:
 *   - Prompts user before modifying settings (R1)
 *   - Uses absolute path for crewx binary (PATH manipulation prevention)
 *   - Backs up original settings files
 *   - Preserves existing user hooks
 *   - Never traverses parent directories — project root determined by crewx.yaml
 */

import { existsSync, copyFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as cp from 'child_process';

import {
  findProjectRoot,
  getClaudeSettingsPath,
  getCodexHooksPath,
  readSettings,
  ensureClaudeSettings,
  ensureCodexHooks,
  parseProviderArg,
  providersFromFilter,
  type HookProvider,
} from './paths';

export const CREWX_HOOK_COMMAND_MARKER = 'crewx hook-dispatch';

interface PreToolUseEntry {
  matcher?: string;
  hooks?: Array<{ type: string; command: string }>;
}

interface ProviderConfig {
  settingsPath: string;
  provider: HookProvider;
  matcher: string;
  commandArg: string;
}

function getProviderConfigs(projectRoot: string, providers: HookProvider[], crewxBin: string): ProviderConfig[] {
  return providers.map((provider) => ({
    settingsPath: provider === 'claude'
      ? getClaudeSettingsPath(projectRoot)
      : getCodexHooksPath(projectRoot),
    provider,
    matcher: provider === 'claude' ? '' : 'Bash',
    commandArg: `--provider ${provider}`,
  }));
}

export function resolveCrewxBinary(): string {
  if (process.env.CREWX_CLI) return process.env.CREWX_CLI;

  try {
    const which = cp.execSync('which crewx 2>/dev/null', { encoding: 'utf8' }).trim();
    const isTmpProxy =
      which.includes('/T/crewx-proxy-') ||
      which.includes('/tmp/crewx-proxy-') ||
      /\/[Tt]e?mp\//.test(which);
    if (which && !isTmpProxy) return which;
  } catch {}

  if (process.argv[1]) {
    const scriptPath = resolve(process.argv[1]);
    if (existsSync(scriptPath)) {
      return `${process.execPath} ${scriptPath}`;
    }
  }

  return 'crewx';
}

function readSettingsTyped(settingsPath: string): { hooks?: { PreToolUse?: PreToolUseEntry[] }; [k: string]: unknown } {
  return readSettings(settingsPath) as any;
}

function findCrewxEntry(preToolUse: PreToolUseEntry[] | undefined): number {
  if (!preToolUse) return -1;
  return preToolUse.findIndex(
    (entry) => entry.hooks?.some((h) => h.command?.includes(CREWX_HOOK_COMMAND_MARKER)),
  );
}

function installForProvider(
  projectRoot: string,
  config: ProviderConfig,
  crewxBin: string,
  yes: boolean,
): boolean {
  const { settingsPath, provider, matcher, commandArg } = config;

  const settings = readSettingsTyped(settingsPath);
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

  const existingIdx = findCrewxEntry(settings.hooks.PreToolUse);

  if (existingIdx >= 0) {
    console.log(`[crewx] Hook already installed in ${settingsPath} (${provider})`);
    return false;
  }

  if (!yes) {
    console.log(
      `⚠️  crewx hook install will register crewx-hook-dispatch as a PreToolUse hook.\n` +
      `   This gives crewx authority to allow/deny ALL ${provider} tool calls.\n` +
      `   ${settingsPath} will be patched (backup at ${settingsPath}.crewx-backup).\n`,
    );
    return false;
  }

  if (existsSync(settingsPath)) {
    const backupPath = settingsPath + '.crewx-backup';
    copyFileSync(settingsPath, backupPath);
    console.log(`[crewx] Backup created: ${backupPath}`);
  }

  if (provider === 'claude') {
    ensureClaudeSettings(projectRoot);
  } else {
    ensureCodexHooks(projectRoot);
  }

  const command = `${crewxBin} hook-dispatch ${commandArg}`;

  (settings.hooks as any).PreToolUse.push({
    matcher,
    hooks: [{ type: 'command', command }],
  });

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log(`[crewx] Hook installed (${provider}): ${command}`);
  console.log(`[crewx] Settings: ${settingsPath}`);
  return true;
}

export interface HookInstallOpts {
  projectRoot: string;
  yes: boolean;
  provider?: HookProvider;
}

export async function handleHookInstall(opts: HookInstallOpts): Promise<void>;
export async function handleHookInstall(args: string[]): Promise<void>;
export async function handleHookInstall(argsOrOpts: string[] | HookInstallOpts): Promise<void> {
  if (!Array.isArray(argsOrOpts)) {
    const { projectRoot, yes, provider } = argsOrOpts;
    const providers = providersFromFilter(provider ?? 'all');
    const crewxBin = resolveCrewxBinary();
    const configs = getProviderConfigs(projectRoot, providers, crewxBin);
    for (const config of configs) {
      installForProvider(projectRoot, config, crewxBin, yes);
    }
    return;
  }

  const args = argsOrOpts;
  const yes = args.includes('--yes') || args.includes('-y');
  const cwd = process.cwd();

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    console.error('[crewx] No crewx.yaml found in current or ancestor directories.');
    console.error('[crewx] Run this command from within a CrewX project.');
    process.exitCode = 1;
    return;
  }

  const providerFilter = parseProviderArg(args);
  const providers = providersFromFilter(providerFilter);
  const crewxBin = resolveCrewxBinary();

  const configs = getProviderConfigs(projectRoot, providers, crewxBin);

  if (!yes) {
    const targets = configs.map((c) => `   - ${c.provider}: ${c.settingsPath}`).join('\n');
    console.log(
      `⚠️  crewx hook install will register crewx-hook-dispatch as a PreToolUse hook.\n` +
      `   This gives crewx authority to allow/deny ALL tool calls.\n` +
      `   Target providers: ${providers.join(', ')}\n` +
      `${targets}\n`,
    );
    process.stdout.write('Continue? [y/N] ');
    const answer = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => resolve(data.toString().trim().toLowerCase()));
    });
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted.');
      return;
    }
  }

  for (const config of configs) {
    installForProvider(projectRoot, config, crewxBin, true);
  }
}
