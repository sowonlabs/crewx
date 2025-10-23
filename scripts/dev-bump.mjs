#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import url from 'node:url';

const summary = 'dev bump';
const packages = [
  '@sowonai/crewx-sdk',
  '@sowonai/crewx-cli',
  'crewx'
];

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const changesetDir = path.join(repoRoot, '.changeset');

if (!existsSync(changesetDir)) {
  throw new Error('Missing .changeset directory. Run `npx changeset init` first.');
}

const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
const slug = `dev-bump-${timestamp}-${randomUUID().slice(0, 4)}`;
const filePath = path.join(changesetDir, `${slug}.md`);

const frontmatterLines = packages.map(pkg => `"${pkg}": patch`).join('\n');
const fileContents = `---\n${frontmatterLines}\n---\n${summary}\n`;

writeFileSync(filePath, fileContents, 'utf8');

console.log(`[dev-bump] Created ${path.relative(repoRoot, filePath)} targeting packages: ${packages.join(', ')}`);

const versionResult = spawnSync('pnpm', ['changeset', 'version'], { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' } });

if (versionResult.error) {
  console.error('[dev-bump] Failed to run `pnpm changeset version`:', versionResult.error);
  process.exit(versionResult.status ?? 1);
}

if (versionResult.status !== 0) {
  console.error(`[dev-bump] \`changeset version\` exited with code ${versionResult.status}`);
  process.exit(versionResult.status);
}

console.log('[dev-bump] Package versions updated via `changeset version`.');
