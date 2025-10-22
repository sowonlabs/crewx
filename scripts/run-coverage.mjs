#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
let hasV8Plugin = true;
try {
  require.resolve('@vitest/coverage-v8');
} catch (error) {
  hasV8Plugin = false;
}

const targets = process.argv.slice(2);
if (!hasV8Plugin) {
  const scope = targets.length ? targets.join(', ') : 'workspace';
  console.warn(`[coverage] @vitest/coverage-v8 not installed locally; skipping coverage run for ${scope}.`);
  console.warn('[coverage] Install @vitest/coverage-v8 to enable coverage enforcement in CI.');
  process.exit(0);
}

const packages = targets.length ? targets : ['.'];

for (const pkg of packages) {
  const cwd = path.resolve(process.cwd(), pkg);
  const result = spawnSync('npx', ['vitest', 'run', '--config', './vitest.config.ts', '--coverage'], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
