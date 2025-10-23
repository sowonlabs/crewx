#!/usr/bin/env node
import { chmodSync, existsSync } from 'fs';
import { join } from 'path';

const candidatePaths = [
  join(process.cwd(), 'dist', 'main.js'),
  join(process.cwd(), '..', '..', 'dist', 'main.js')
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
