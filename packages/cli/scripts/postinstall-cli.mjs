#!/usr/bin/env node
/**
 * postinstall hook used after npm install to ensure the CrewX CLI binary is executable.
 * Works in both workspace and published package contexts.
 */
import { chmodSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDir);

const candidatePaths = [
  join(packageRoot, 'dist', 'main.js'),
  join(packageRoot, '..', '..', 'dist', 'main.js')
];

const targetPath = candidatePaths.find(p => existsSync(p));

if (!targetPath) {
  console.warn('⚠️ postinstall skipped: dist/main.js not found (expected during migration)');
  process.exit(0);
}

try {
  chmodSync(targetPath, 0o755);
  console.log(`✅ Execute permission set for crewx binary (${targetPath})`);
} catch (err) {
  console.warn('⚠️ postinstall could not set execute permission:', err.message);
}
