#!/usr/bin/env node

/**
 * Prepare packages for publishing by replacing workspace: protocol with actual versions
 * This script should be run before npm publish in CI/CD or release process
 */

const fs = require('fs');
const path = require('path');

function preparePackageForPublish(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  let modified = false;

  // Check dependencies
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
    if (packageJson[depType]) {
      Object.keys(packageJson[depType]).forEach(dep => {
        const version = packageJson[depType][dep];

        // Replace workspace: protocol with actual version
        if (version.startsWith('workspace:')) {
          const actualVersion = version.replace('workspace:', '');

          // Handle workspace:* or workspace:^ or workspace:~
          if (actualVersion === '*') {
            // Get the actual version from the workspace package
            const workspacePackagePath = path.join(__dirname, '..', 'packages',
              dep.replace('@sowonai/crewx-', ''), 'package.json');

            if (fs.existsSync(workspacePackagePath)) {
              const workspacePackage = JSON.parse(fs.readFileSync(workspacePackagePath, 'utf-8'));
              packageJson[depType][dep] = `^${workspacePackage.version}`;
              console.log(`  ✓ Replaced ${dep}: "${version}" → "^${workspacePackage.version}"`);
              modified = true;
            }
          } else {
            // Already has version specified (e.g., workspace:^0.1.0)
            packageJson[depType][dep] = actualVersion;
            console.log(`  ✓ Replaced ${dep}: "${version}" → "${actualVersion}"`);
            modified = true;
          }
        }
      });
    }
  });

  if (modified) {
    // Create backup
    const backupPath = packageJsonPath + '.backup';
    fs.copyFileSync(packageJsonPath, backupPath);
    console.log(`  📋 Created backup: ${backupPath}`);

    // Write modified package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`  ✅ Updated ${packageJsonPath}`);
  } else {
    console.log(`  ℹ️ No workspace: dependencies found`);
  }

  return modified;
}

// Main execution
console.log('🔧 Preparing packages for publishing...\n');

const packages = [
  path.join(__dirname, '..', 'packages', 'sdk'),
  path.join(__dirname, '..', 'packages', 'cli')
];

packages.forEach(packagePath => {
  const packageName = path.basename(packagePath);
  console.log(`📦 Processing ${packageName}:`);
  preparePackageForPublish(packagePath);
  console.log('');
});

console.log('✨ Done! Packages are ready for publishing.');
console.log('💡 To restore original package.json files, use: npm run restore-packages');