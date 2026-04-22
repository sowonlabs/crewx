/**
 * crewx hook-dispatch — CLI subcommand invoked by Claude/Codex PreToolUse hook.
 *
 * Reads stdin JSON from the provider, loads HookPlugins from crewx.yaml,
 * evaluates them, and writes stdout JSON response back.
 *
 * Protocol:
 *   stdin  → ClaudeHookInput JSON
 *   stdout → ClaudeHookOutput JSON
 *   exit 0 → allow, exit 2 → deny
 *
 * Security (M1):
 *   --provider argument is REQUIRED. Missing → process.exit(1) fail-closed.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { loadYamlFile } from '@crewx/sdk';
import {
  evaluateHook,
  isPathSafe,
  YamlHookPlugin,
  validateHooksSchema,
  type ClaudeHookInput,
} from '@crewx/sdk/hooks';
import type { HookPlugin } from '@crewx/sdk/hooks';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function loadPlugin(pluginPath: string): HookPlugin {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(pluginPath);
  const PluginClass = mod.default ?? mod;
  if (typeof PluginClass !== 'function') {
    throw new Error(`Plugin module does not export a class: ${pluginPath}`);
  }
  const instance = new PluginClass();
  if (typeof instance.run !== 'function') {
    throw new Error(`Plugin does not have a run() method: ${pluginPath}`);
  }
  return instance as HookPlugin;
}

function findConfigPath(cwd: string): string | null {
  let dir = cwd;
  for (let i = 0; i < 20; i++) {
    const candidate = resolve(dir, 'crewx.yaml');
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

function parseProviderFromArgs(args: string[]): 'claude' | 'codex' {
  const idx = args.indexOf('--provider');
  if (idx === -1 || idx + 1 >= args.length) {
    console.error('[crewx] Missing required --provider argument. Usage: hook-dispatch --provider <claude|codex>');
    process.exit(1);
  }
  const val = args[idx + 1];
  if (val !== 'claude' && val !== 'codex') {
    console.error(`[crewx] Invalid --provider value: "${val}". Expected: claude | codex`);
    process.exit(1);
  }
  return val;
}

export async function handleHookDispatch(args: string[]): Promise<void> {
  const provider = parseProviderFromArgs(args);

  const stdinData = await readStdin();

  let input: ClaudeHookInput;
  try {
    input = JSON.parse(stdinData);
  } catch {
    console.error('[crewx] Failed to parse stdin JSON');
    process.exit(1);
  }

  const configPath = findConfigPath(input.cwd || process.cwd());
  if (!configPath) {
    const output = {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'allow' as const,
      },
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  const configRoot = dirname(configPath);
  let config: any;
  try {
    config = loadYamlFile(configPath);
  } catch {
    console.error(`[crewx] Failed to load crewx.yaml: ${configPath}`);
    process.exit(1);
  }

  const hookDefs: any[] = Array.isArray(config.hooks) ? config.hooks : [];
  const matchingDefs = hookDefs.filter(
    (h: any) => {
      const prov = h.provider;
      if (prov === undefined) return true;
      if (typeof prov === 'string') return prov === provider;
      if (Array.isArray(prov)) return prov.includes(provider);
      return false;
    },
  ).filter(
    (h: any) => h.event === 'PreToolUse' || !h.event,
  );

  if (matchingDefs.length === 0) {
    const output = {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'allow' as const,
      },
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  const guideDefs = matchingDefs.filter((h: any) => h.guide && typeof h.guide === 'object');
  const pluginDefs = matchingDefs.filter((h: any) => h.plugin && typeof h.plugin === 'string');

  if (guideDefs.length > 0) {
    const { valid, warnings } = validateHooksSchema(guideDefs);
    for (const w of warnings) {
      process.stderr.write(`[crewx] ${w}\n`);
    }
    if (valid.length > 0) {
      const agents = Array.isArray(config.agents) ? config.agents : [];
      const yamlPlugin = new YamlHookPlugin({ hooks: valid, agents });
      const result = await evaluateHook(yamlPlugin, input, configRoot, provider);
      if (result.exitCode !== 0) {
        process.stdout.write(JSON.stringify(result.stdout));
        process.exit(result.exitCode);
      }
      if (result.injected) {
        process.stdout.write(JSON.stringify(result.stdout));
        process.exit(0);
      }
    }
  }

  for (const hookDef of pluginDefs) {
    const pluginRelPath = hookDef.plugin as string;
    if (!pluginRelPath) {
      console.error(`[crewx] Hook definition missing 'plugin' field`);
      continue;
    }

    const pluginPath = resolve(configRoot, pluginRelPath);

    if (!isPathSafe(pluginPath, configRoot)) {
      console.error(`[crewx] Hook plugin path rejected (path traversal): ${pluginRelPath}`);
      process.exit(1);
    }

    let plugin: HookPlugin;
    try {
      plugin = loadPlugin(pluginPath);
    } catch (err) {
      console.error(`[crewx] Failed to load hook plugin: ${pluginRelPath} — ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }

    const result = await evaluateHook(plugin, input, configRoot, provider);

    if (result.exitCode !== 0) {
      process.stdout.write(JSON.stringify(result.stdout));
      process.exit(result.exitCode);
    }
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: input.hook_event_name,
      permissionDecision: 'allow' as const,
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}
