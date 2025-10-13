import { readFileSync } from 'fs';
import { join } from 'path';

let version = 'unknown';

try {
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson?.version) {
    version = String(packageJson.version);
  }
} catch {
  // Ignore errors and keep default version
}

export const CREWX_VERSION = version;
