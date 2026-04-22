import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Return the installed @crewx/cli package version.
 *
 * Resolution strategy (mirrors cli-bak version.ts):
 *   1. Read the package.json that is co-located with the compiled dist tree.
 *      At runtime __dirname resolves to dist/utils/, so ../../package.json
 *      reaches the package root — both in development and in an npm-installed
 *      deployment (node_modules/@crewx/cli/package.json).
 *   2. Fall back to '0.0.0' on any I/O or parse error.
 *
 * Result is cached in the module-level constant to avoid repeated disk reads.
 */
function readVersion(): string {
  try {
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const CLI_VERSION: string = readVersion();
