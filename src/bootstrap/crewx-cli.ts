import { existsSync } from 'fs';
import { resolve } from 'path';
import { Crewx } from '@crewx/sdk';
import { FileLoggerPlugin, SqliteTracingPlugin } from '@crewx/sdk/plugins';
import { registerBuiltinToolsIfNeeded } from '../register-builtin-tools';
import { CLI_VERSION } from '../utils/version';

/**
 * Build a Crewx instance with CLI-standard plugins (FileLogger + SqliteTracing)
 * and built-in tools registered. Use this from any CLI command that needs a
 * Crewx instance — keeps environment consistent across query / execute / slack / agent.
 *
 * workspaceRoot is always process.cwd()-based so that per-workspace logs land
 * in {cwd}/.crewx/logs/. Critical for file:// remote agent delegation.
 *
 * Behavior:
 *   - If configPath resolves to an existing file → load it (with built-ins merged)
 *   - If configPath is NOT set via CREWX_CONFIG env AND the file doesn't exist →
 *     fall back to built-in-only mode (no user yaml required)
 *   - If CREWX_CONFIG is explicitly set AND the file doesn't exist → throw
 */
export async function createCliCrewx(
  configPath: string = process.env.CREWX_CONFIG ?? 'crewx.yaml',
): Promise<Crewx> {
  const absConfigPath = resolve(configPath);
  // workspaceRoot is always cwd-based, never package-internal
  const workspaceRoot = process.cwd();

  const isExplicitConfig = Boolean(process.env.CREWX_CONFIG);
  const fileExists = existsSync(absConfigPath);

  let yamlPath: string | undefined;
  if (fileExists) {
    yamlPath = absConfigPath;
  } else if (isExplicitConfig) {
    // Explicit config was set but file doesn't exist — throw
    throw new Error(`[crewx] Config file not found: ${absConfigPath} (set via CREWX_CONFIG)`);
  } else {
    // No explicit config and file doesn't exist — built-in-only mode
    yamlPath = undefined;
  }

  // Pass ourselves back to the SDK: when this Crewx encounters a file:// remote
  // agent, the SDK uses this factory to bootstrap the target Crewx instance
  // with the same plugin set (FileLogger + SqliteTracing + built-in tools).
  const crewx = await Crewx.loadYaml(yamlPath, {
    remoteFactory: createCliCrewx,
  });
  registerBuiltinToolsIfNeeded(crewx);
  await crewx.use(new FileLoggerPlugin({ version: CLI_VERSION, workspaceRoot }));
  await crewx.use(new SqliteTracingPlugin({ version: CLI_VERSION }));
  return crewx;
}
