/**
 * crewx hook uninstall — Remove crewx-hook-dispatch from provider settings files.
 *
 * Only removes entries whose command contains the crewx hook-dispatch marker.
 * Preserves all other user hooks. Cleans up empty PreToolUse/hooks fields.
 * Never traverses parent directories — project root determined by crewx.yaml.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

import {
  findProjectRoot,
  getClaudeSettingsPath,
  getCodexHooksPath,
  parseProviderArg,
  providersFromFilter,
  type HookProvider,
} from './paths';

const CREWX_HOOK_COMMAND_MARKER = 'crewx hook-dispatch';

interface PreToolUseEntry {
  matcher?: string;
  hooks?: Array<{ type: string; command: string }>;
}

interface SettingsFile {
  hooks?: {
    PreToolUse?: PreToolUseEntry[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

function getSettingsPath(projectRoot: string, provider: HookProvider): string {
  return provider === 'claude'
    ? getClaudeSettingsPath(projectRoot)
    : getCodexHooksPath(projectRoot);
}

function uninstallFromProvider(projectRoot: string, provider: HookProvider): void {
  const settingsPath = getSettingsPath(projectRoot, provider);

  if (!existsSync(settingsPath)) {
    console.log(`[crewx] No settings file found for ${provider} (${settingsPath})`);
    return;
  }

  let settings: SettingsFile;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    console.error(`[crewx] Failed to parse ${settingsPath}`);
    return;
  }

  if (!settings.hooks?.PreToolUse?.length) {
    console.log(`[crewx] No PreToolUse hooks found for ${provider}`);
    return;
  }

  const before = settings.hooks.PreToolUse.length;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
    (entry) => !entry.hooks?.some((h) => h.command?.includes(CREWX_HOOK_COMMAND_MARKER)),
  );

  const removed = settings.hooks.PreToolUse.length < before;

  if (settings.hooks.PreToolUse.length === 0) {
    delete settings.hooks.PreToolUse;
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  if (!removed) {
    console.log(`[crewx] crewx hook not found for ${provider}`);
    return;
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log(`[crewx] Hook uninstalled (${provider})`);

  const backupPath = settingsPath + '.crewx-backup';
  if (existsSync(backupPath)) {
    console.log(`[crewx] Backup available: ${backupPath}`);
  }
}

export async function handleHookUninstall(args: string[]): Promise<void> {
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

  for (const provider of providers) {
    uninstallFromProvider(projectRoot, provider);
  }
}
