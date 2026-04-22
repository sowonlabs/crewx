/**
 * Shared path helpers for hook CLI commands.
 *
 * Project root = nearest ancestor containing crewx.yaml.
 * Claude settings path = <projectRoot>/.claude/settings.json
 * Codex hooks path     = <projectRoot>/.codex/hooks.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

export type HookProvider = 'claude' | 'codex';
export type HookProviderFilter = HookProvider | 'all';

export function parseProviderArg(args: string[]): HookProviderFilter {
  const idx = args.indexOf('--provider');
  if (idx === -1 || idx + 1 >= args.length) return 'all';
  const val = args[idx + 1];
  if (val === 'claude' || val === 'codex') return val;
  console.error(`[crewx] Invalid --provider value: "${val}". Expected: claude | codex`);
  process.exit(1);
}

export function providersFromFilter(filter: HookProviderFilter): HookProvider[] {
  return filter === 'all' ? ['claude', 'codex'] : [filter];
}

export function findProjectRoot(cwd: string): string | null {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(resolve(dir, 'crewx.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function getClaudeSettingsPath(projectRoot: string): string {
  return resolve(projectRoot, '.claude', 'settings.json');
}

export function getCodexHooksPath(projectRoot: string): string {
  return resolve(projectRoot, '.codex', 'hooks.json');
}

export function getProviderSettingsPath(projectRoot: string, provider: HookProvider): string {
  return provider === 'claude'
    ? getClaudeSettingsPath(projectRoot)
    : getCodexHooksPath(projectRoot);
}

export function readSettings(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

export function ensureClaudeSettings(projectRoot: string): string {
  const settingsPath = getClaudeSettingsPath(projectRoot);
  const settingsDir = dirname(settingsPath);
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }
  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, '{}\n', 'utf8');
  }
  return settingsPath;
}

export function ensureCodexHooks(projectRoot: string): string {
  const hooksPath = getCodexHooksPath(projectRoot);
  const hooksDir = dirname(hooksPath);
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }
  if (!existsSync(hooksPath)) {
    writeFileSync(hooksPath, '{}\n', 'utf8');
  }
  return hooksPath;
}

export function ensureProviderSettings(projectRoot: string, provider: HookProvider): string {
  return provider === 'claude'
    ? ensureClaudeSettings(projectRoot)
    : ensureCodexHooks(projectRoot);
}
