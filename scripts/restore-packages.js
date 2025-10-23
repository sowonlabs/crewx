#!/usr/bin/env node

/**
 * Restore package.json files from backup after publishing
 */

const fs = require('fs');
const path = require('path');

function restorePackage(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const backupPath = packageJsonPath + '.backup';

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, packageJsonPath);
    fs.unlinkSync(backupPath);
    console.log(`  ✓ Restored ${packageJsonPath}`);
    console.log(`  ✓ Removed backup file`);
    return true;
  } else {
    console.log(`  ℹ️ No backup found`);
    return false;
  }
}

// Main execution
console.log('🔄 Restoring package.json files from backup...\n');

const packages = [
  path.join(__dirname, '..', 'packages', 'sdk'),
  path.join(__dirname, '..', 'packages', 'cli')
];

packages.forEach(packagePath => {
  const packageName = path.basename(packagePath);
  console.log(`📦 Restoring ${packageName}:`);
  restorePackage(packagePath);
  console.log('');
});

console.log('✨ Done!');