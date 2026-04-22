import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as cp from 'child_process';

import { handleHookInstall, resolveCrewxBinary } from '../../../src/commands/hook/install';
import { handleHookUninstall } from '../../../src/commands/hook/uninstall';
import { handleHookStatus } from '../../../src/commands/hook/status';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, execSync: vi.fn(actual.execSync) };
});

const CREWX_HOOK_MARKER = 'crewx hook-dispatch';

function createTmpProject(): string {
  const dir = join(tmpdir(), `crewx-hook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'crewx.yaml'), 'agents: []\n', 'utf8');
  return dir;
}

function getClaudeSettings(tmpDir: string): any {
  return JSON.parse(readFileSync(join(tmpDir, '.claude', 'settings.json'), 'utf8'));
}

function getCodexHooks(tmpDir: string): any {
  return JSON.parse(readFileSync(join(tmpDir, '.codex', 'hooks.json'), 'utf8'));
}

// ─── Claude install (regression) ─────────────────────────────────────────

describe('hook install — claude', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .claude/settings.json with PreToolUse hook when file does not exist', async () => {
    const settingsPath = join(tmpDir, '.claude', 'settings.json');
    expect(existsSync(settingsPath)).toBe(false);

    await handleHookInstall(['--yes', '--provider', 'claude']);

    expect(existsSync(settingsPath)).toBe(true);
    const settings = getClaudeSettings(tmpDir);
    expect(settings.hooks.PreToolUse).toBeDefined();
    expect(settings.hooks.PreToolUse.length).toBeGreaterThanOrEqual(1);
    const entry = settings.hooks.PreToolUse[0];
    expect(entry.hooks[0].command).toContain(CREWX_HOOK_MARKER);
    expect(entry.hooks[0].command).toContain('--provider claude');
    expect(entry.matcher).toBe('');
  });

  it('is idempotent — does not duplicate hook entries', async () => {
    await handleHookInstall(['--yes', '--provider', 'claude']);
    await handleHookInstall(['--yes', '--provider', 'claude']);

    const settings = getClaudeSettings(tmpDir);
    const crewxEntries = settings.hooks.PreToolUse.filter(
      (entry: any) => entry.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_MARKER)),
    );
    expect(crewxEntries.length).toBe(1);
  });

  it('creates backup of existing settings.json', async () => {
    const settingsDir = join(tmpDir, '.claude');
    mkdirSync(settingsDir, { recursive: true });
    const settingsPath = join(settingsDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ customKey: 'value' }, null, 2));

    await handleHookInstall(['--yes', '--provider', 'claude']);

    const backupPath = settingsPath + '.crewx-backup';
    expect(existsSync(backupPath)).toBe(true);
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    expect(backup.customKey).toBe('value');
  });

  it('preserves existing user hooks', async () => {
    const settingsDir = join(tmpDir, '.claude');
    mkdirSync(settingsDir, { recursive: true });
    const settingsPath = join(settingsDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-custom-hook' }] },
        ],
      },
    }, null, 2));

    await handleHookInstall(['--yes', '--provider', 'claude']);

    const settings = getClaudeSettings(tmpDir);
    expect(settings.hooks.PreToolUse.length).toBe(2);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('my-custom-hook');
    expect(settings.hooks.PreToolUse[1].hooks[0].command).toContain(CREWX_HOOK_MARKER);
  });
});

// ─── Codex install ────────────────────────────────────────────────────────

describe('hook install — codex', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .codex/hooks.json with PreToolUse hook with Bash matcher', async () => {
    const hooksPath = join(tmpDir, '.codex', 'hooks.json');
    expect(existsSync(hooksPath)).toBe(false);

    await handleHookInstall(['--yes', '--provider', 'codex']);

    expect(existsSync(hooksPath)).toBe(true);
    const hooks = getCodexHooks(tmpDir);
    expect(hooks.hooks.PreToolUse).toBeDefined();
    expect(hooks.hooks.PreToolUse.length).toBeGreaterThanOrEqual(1);
    const entry = hooks.hooks.PreToolUse[0];
    expect(entry.hooks[0].command).toContain(CREWX_HOOK_MARKER);
    expect(entry.hooks[0].command).toContain('--provider codex');
    expect(entry.matcher).toBe('Bash');
  });

  it('is idempotent — does not duplicate codex hook entries', async () => {
    await handleHookInstall(['--yes', '--provider', 'codex']);
    await handleHookInstall(['--yes', '--provider', 'codex']);

    const hooks = getCodexHooks(tmpDir);
    const crewxEntries = hooks.hooks.PreToolUse.filter(
      (entry: any) => entry.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_MARKER)),
    );
    expect(crewxEntries.length).toBe(1);
  });

  it('creates backup of existing hooks.json', async () => {
    const hooksDir = join(tmpDir, '.codex');
    mkdirSync(hooksDir, { recursive: true });
    const hooksPath = join(hooksDir, 'hooks.json');
    writeFileSync(hooksPath, JSON.stringify({ customKey: 'codex' }, null, 2));

    await handleHookInstall(['--yes', '--provider', 'codex']);

    const backupPath = hooksPath + '.crewx-backup';
    expect(existsSync(backupPath)).toBe(true);
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    expect(backup.customKey).toBe('codex');
  });

  it('preserves existing user hooks in .codex/hooks.json', async () => {
    const hooksDir = join(tmpDir, '.codex');
    mkdirSync(hooksDir, { recursive: true });
    const hooksPath = join(hooksDir, 'hooks.json');
    writeFileSync(hooksPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'other-hook' }] },
        ],
      },
    }, null, 2));

    await handleHookInstall(['--yes', '--provider', 'codex']);

    const hooks = getCodexHooks(tmpDir);
    expect(hooks.hooks.PreToolUse.length).toBe(2);
    expect(hooks.hooks.PreToolUse[0].hooks[0].command).toBe('other-hook');
    expect(hooks.hooks.PreToolUse[1].hooks[0].command).toContain(CREWX_HOOK_MARKER);
  });

  it('does not touch .claude/settings.json when --provider codex', async () => {
    await handleHookInstall(['--yes', '--provider', 'codex']);

    const claudePath = join(tmpDir, '.claude', 'settings.json');
    expect(existsSync(claudePath)).toBe(false);
  });
});

// ─── All providers install ────────────────────────────────────────────────

describe('hook install — all providers', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('installs both claude and codex hooks with default (all)', async () => {
    await handleHookInstall(['--yes']);

    const claudeSettings = getClaudeSettings(tmpDir);
    const crewxClaude = claudeSettings.hooks?.PreToolUse?.find(
      (e: any) => e.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_MARKER)),
    );
    expect(crewxClaude).toBeDefined();
    expect(crewxClaude.hooks[0].command).toContain('--provider claude');

    const codexHooks = getCodexHooks(tmpDir);
    const crewxCodex = codexHooks.hooks?.PreToolUse?.find(
      (e: any) => e.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_MARKER)),
    );
    expect(crewxCodex).toBeDefined();
    expect(crewxCodex.hooks[0].command).toContain('--provider codex');
    expect(crewxCodex.matcher).toBe('Bash');
  });
});

// ─── Uninstall ────────────────────────────────────────────────────────────

describe('hook uninstall', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes crewx hook from claude settings.json', async () => {
    await handleHookInstall(['--yes', '--provider', 'claude']);
    await handleHookUninstall(['--provider', 'claude']);

    const settings = getClaudeSettings(tmpDir);
    const crewxEntries = (settings.hooks?.PreToolUse ?? []).filter(
      (entry: any) => entry.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_MARKER)),
    );
    expect(crewxEntries.length).toBe(0);
  });

  it('removes crewx hook from codex hooks.json', async () => {
    await handleHookInstall(['--yes', '--provider', 'codex']);
    await handleHookUninstall(['--provider', 'codex']);

    const hooks = getCodexHooks(tmpDir);
    const crewxEntries = (hooks.hooks?.PreToolUse ?? []).filter(
      (entry: any) => entry.hooks?.some((h: any) => h.command?.includes(CREWX_HOOK_MARKER)),
    );
    expect(crewxEntries.length).toBe(0);
  });

  it('removes both providers with default (all)', async () => {
    await handleHookInstall(['--yes']);
    await handleHookUninstall([]);

    const claudeSettings = getClaudeSettings(tmpDir);
    expect(claudeSettings.hooks).toBeUndefined();

    const codexHooks = getCodexHooks(tmpDir);
    expect(codexHooks.hooks).toBeUndefined();
  });

  it('preserves other hooks when removing crewx hook (claude)', async () => {
    const settingsDir = join(tmpDir, '.claude');
    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(join(settingsDir, 'settings.json'), JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-custom-hook' }] },
        ],
      },
    }, null, 2));
    await handleHookInstall(['--yes', '--provider', 'claude']);
    await handleHookUninstall(['--provider', 'claude']);

    const settings = getClaudeSettings(tmpDir);
    expect(settings.hooks.PreToolUse.length).toBe(1);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('my-custom-hook');
  });

  it('preserves other hooks when removing crewx hook (codex)', async () => {
    const hooksDir = join(tmpDir, '.codex');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'hooks.json'), JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'other-hook' }] },
        ],
      },
    }, null, 2));
    await handleHookInstall(['--yes', '--provider', 'codex']);
    await handleHookUninstall(['--provider', 'codex']);

    const hooks = getCodexHooks(tmpDir);
    expect(hooks.hooks.PreToolUse.length).toBe(1);
    expect(hooks.hooks.PreToolUse[0].hooks[0].command).toBe('other-hook');
  });

  it('cleans up empty hooks/PreToolUse fields after uninstall (claude)', async () => {
    await handleHookInstall(['--yes', '--provider', 'claude']);
    await handleHookUninstall(['--provider', 'claude']);

    const settings = getClaudeSettings(tmpDir);
    expect(settings.hooks).toBeUndefined();
    expect(existsSync(join(tmpDir, '.claude', 'settings.json'))).toBe(true);
  });
});

// ─── Status ───────────────────────────────────────────────────────────────

describe('hook status', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('shows NOT INSTALLED for both providers when no settings', async () => {
    await handleHookStatus([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('NOT INSTALLED'));
  });

  it('shows INSTALLED for claude after install', async () => {
    await handleHookInstall(['--yes', '--provider', 'claude']);
    await handleHookStatus([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('INSTALLED'));
  });

  it('shows INSTALLED for codex after install', async () => {
    await handleHookInstall(['--yes', '--provider', 'codex']);
    await handleHookStatus([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('INSTALLED'));
  });

  it('shows CLAUDE section', async () => {
    await handleHookStatus([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CLAUDE'));
  });

  it('shows CODEX section', async () => {
    await handleHookStatus([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CODEX'));
  });
});

// ─── resolveCrewxBinary ───────────────────────────────────────────────────

describe('resolveCrewxBinary', () => {
  const origEnv = { ...process.env };
  const origArgv = [...process.argv];

  afterEach(() => {
    process.env = { ...origEnv };
    process.argv = [...origArgv];
    vi.mocked(cp.execSync).mockRestore();
  });

  it('rejects tmp proxy paths from npx and falls back to argv[1]', () => {
    delete process.env.CREWX_CLI;

    vi.mocked(cp.execSync).mockReturnValue(
      '/var/folders/xx/T/crewx-proxy-abc123/crewx\n',
    );

    process.argv[1] = __filename;

    const result = resolveCrewxBinary();

    expect(result).not.toContain('crewx-proxy-');
    expect(result).toContain(process.execPath);
    expect(result).toContain(__filename);
  });

  it('uses CREWX_CLI env var when set (highest priority)', () => {
    process.env.CREWX_CLI = '/custom/path/crewx';
    expect(resolveCrewxBinary()).toBe('/custom/path/crewx');
  });

  it('uses stable which result when not a tmp proxy', () => {
    delete process.env.CREWX_CLI;

    vi.mocked(cp.execSync).mockReturnValue('/usr/local/bin/crewx\n');

    const result = resolveCrewxBinary();
    expect(result).toBe('/usr/local/bin/crewx');
  });
});

// ─── Path isolation ───────────────────────────────────────────────────────

describe('hook path isolation', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('errors when no crewx.yaml exists (no project root)', async () => {
    const noProjectDir = join(tmpDir, 'sub', 'deep');
    mkdirSync(noProjectDir, { recursive: true });
    rmSync(join(tmpDir, 'crewx.yaml'));
    process.chdir(noProjectDir);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleHookInstall(['--yes']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No crewx.yaml'));
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;

    await handleHookUninstall([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No crewx.yaml'));

    errorSpy.mockRestore();
  });

  it('does not traverse parent directories — uses project root only', async () => {
    const parentSettingsDir = join(tmpDir, '.claude');
    mkdirSync(parentSettingsDir, { recursive: true });
    writeFileSync(
      join(parentSettingsDir, 'settings.json'),
      JSON.stringify({ parentMarker: true }, null, 2),
    );

    const childProject = join(tmpDir, 'projects', 'myapp');
    mkdirSync(childProject, { recursive: true });
    writeFileSync(join(childProject, 'crewx.yaml'), 'agents: []\n', 'utf8');
    process.chdir(childProject);

    await handleHookInstall(['--yes']);

    const childSettingsPath = join(childProject, '.claude', 'settings.json');
    expect(existsSync(childSettingsPath)).toBe(true);
    const childSettings = JSON.parse(readFileSync(childSettingsPath, 'utf8'));
    expect(childSettings.hooks.PreToolUse).toBeDefined();

    const parentSettings = JSON.parse(readFileSync(join(parentSettingsDir, 'settings.json'), 'utf8'));
    expect(parentSettings.parentMarker).toBe(true);
    expect(parentSettings.hooks).toBeUndefined();
  });
});
