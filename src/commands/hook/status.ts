/**
 * crewx hook status — Show hook installation status and registered plugins.
 *
 * Displays status for both Claude (.claude/settings.json) and
 * Codex (.codex/hooks.json) provider settings.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadYamlFile } from '@crewx/sdk';

import { findProjectRoot, getClaudeSettingsPath, getCodexHooksPath } from './paths';

const CREWX_HOOK_COMMAND_MARKER = 'crewx hook-dispatch';

function showProviderStatus(projectRoot: string, provider: 'claude' | 'codex'): void {
  const settingsPath = provider === 'claude'
    ? getClaudeSettingsPath(projectRoot)
    : getCodexHooksPath(projectRoot);

  console.log(`  [${provider.toUpperCase()}]`);

  if (!existsSync(settingsPath)) {
    console.log(`    Settings: not found (${settingsPath})`);
    console.log(`    Status:   NOT INSTALLED`);
    return;
  }

  console.log(`    Settings: ${settingsPath}`);
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const preHooks = settings.hooks?.PreToolUse ?? [];
    const crewxEntry = preHooks.find(
      (entry: any) => entry.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_COMMAND_MARKER)),
    );

    if (crewxEntry) {
      const command = crewxEntry.hooks.find((h: any) => h.command?.includes(CREWX_HOOK_COMMAND_MARKER))?.command;
      console.log(`    Status:   INSTALLED`);
      console.log(`    Command:  ${command}`);
    } else {
      console.log(`    Status:   NOT INSTALLED`);
    }
  } catch {
    console.log(`    Status:   ERROR (failed to parse settings)`);
  }

  const backupPath = settingsPath + '.crewx-backup';
  if (existsSync(backupPath)) {
    console.log(`    Backup:   ${backupPath}`);
  }
}

export async function handleHookStatus(_args: string[]): Promise<void> {
  const cwd = process.cwd();

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    console.error('[crewx] No crewx.yaml found in current or ancestor directories.');
    console.error('[crewx] Run this command from within a CrewX project.');
    process.exitCode = 1;
    return;
  }

  console.log('Hook Installation Status');
  console.log('─'.repeat(40));

  showProviderStatus(projectRoot, 'claude');
  showProviderStatus(projectRoot, 'codex');

  const configPath = resolve(projectRoot, 'crewx.yaml');
  console.log('');
  console.log('Registered HookPlugins (crewx.yaml)');
  console.log('─'.repeat(40));
  console.log(`  Config: ${configPath}`);

  let config: any;
  try {
    config = loadYamlFile(configPath);
  } catch {
    console.log('  ERROR: failed to parse crewx.yaml');
    return;
  }

  const hookDefs: any[] = Array.isArray(config.hooks) ? config.hooks : [];
  if (hookDefs.length === 0) {
    console.log('  No hooks defined in crewx.yaml');
    return;
  }

  for (const hook of hookDefs) {
    console.log(`  - provider: ${hook.provider ?? '(any)'}`);
    console.log(`    event:    ${hook.event ?? 'PreToolUse'}`);
    console.log(`    plugin:   ${hook.plugin ?? '(undefined)'}`);
    if (hook.agents) {
      console.log(`    agents:   ${JSON.stringify(hook.agents)} (reserved — Phase 1)`);
    }
  }
}
