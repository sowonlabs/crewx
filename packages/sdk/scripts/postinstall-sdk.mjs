#!/usr/bin/env node
/**
 * postinstall hook to fix @sindresorhus/slugify ESM-only issue.
 * Forces installation of CommonJS-compatible version 1.1.2.
 *
 * Issue: @mastra/core depends on @sindresorhus/slugify@^2.x which is ESM-only,
 * but our package is CommonJS. This causes ERR_REQUIRE_ESM errors on npm install.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDir);

// Find node_modules - could be at package level or hoisted to root
const findSlugifyPath = () => {
  const candidates = [
    join(packageRoot, 'node_modules', '@sindresorhus', 'slugify'),
    join(packageRoot, '..', '..', 'node_modules', '@sindresorhus', 'slugify'),
    join(packageRoot, '..', 'node_modules', '@sindresorhus', 'slugify'),
  ];
  return candidates.find(p => existsSync(p));
};

const slugifyPath = findSlugifyPath();

if (!slugifyPath) {
  console.log('ℹ️ @sindresorhus/slugify not found, skipping postinstall fix');
  process.exit(0);
}

// Check current version
try {
  const pkgPath = join(slugifyPath, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  if (pkg.version === '1.1.2') {
    console.log('✅ @sindresorhus/slugify@1.1.2 already installed');
    process.exit(0);
  }

  console.log(`⚠️ Found @sindresorhus/slugify@${pkg.version} (ESM-only), replacing with 1.1.2...`);

  // Remove the ESM-only version
  rmSync(slugifyPath, { recursive: true, force: true });

  // Install CommonJS-compatible version
  const parentDir = dirname(dirname(slugifyPath)); // node_modules
  execSync(`npm pack @sindresorhus/slugify@1.1.2 --pack-destination="${parentDir}"`, {
    cwd: parentDir,
    stdio: 'pipe'
  });

  // Extract the package
  const tarball = join(parentDir, 'sindresorhus-slugify-1.1.2.tgz');
  execSync(`tar -xzf "${tarball}" -C "${parentDir}"`, { stdio: 'pipe' });

  // Move package to correct location
  const extractedDir = join(parentDir, 'package');
  mkdirSync(dirname(slugifyPath), { recursive: true });
  cpSync(extractedDir, slugifyPath, { recursive: true });

  // Cleanup
  rmSync(tarball, { force: true });
  rmSync(extractedDir, { recursive: true, force: true });

  console.log('✅ Replaced with @sindresorhus/slugify@1.1.2 (CommonJS compatible)');

} catch (err) {
  console.warn('⚠️ postinstall slugify fix failed:', err.message);
  // Don't fail the install
}
