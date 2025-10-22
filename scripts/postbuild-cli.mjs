#!/usr/bin/env node
/**
 * Adjust CLI build artifact to be executable during the monorepo transition.
 * Falls back to the legacy root dist until WBS-3 migrates the sources.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const candidatePaths = [
  join(process.cwd(), 'dist', 'main.js'),
  join(process.cwd(), '..', '..', 'dist', 'main.js')
];

const targetPath = candidatePaths.find(p => existsSync(p));

if (!targetPath) {
  console.warn('⚠️ postbuild skipped: dist/main.js not found (expected during migration)');
  process.exit(0);
}

let content = readFileSync(targetPath, 'utf8');
const lines = content.split('\n');
if (lines[0] === '#!/usr/bin/env node' && lines[1] === '#!/usr/bin/env node') {
  lines.shift();
  content = lines.join('\n');
  writeFileSync(targetPath, content);
  console.log('✅ Removed duplicate shebang');
} else if (!content.startsWith('#!/usr/bin/env node')) {
  writeFileSync(targetPath, '#!/usr/bin/env node\n' + content);
  console.log('✅ Added shebang to dist/main.js');
} else {
  console.log('✅ Shebang already present');
}

chmodSync(targetPath, 0o755);
console.log(`✅ Execute permission set (${targetPath})`);
