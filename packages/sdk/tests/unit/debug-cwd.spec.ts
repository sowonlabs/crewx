/**
 * Debug test to check process.cwd() during vitest execution
 */

import { describe, it } from 'vitest';
import * as path from 'path';
import { existsSync } from 'fs';

describe('Debug CWD', () => {
  it('should print process.cwd()', () => {
    console.log('=== DEBUG INFO ===');
    console.log('process.cwd():', process.cwd());
    console.log('__dirname:', __dirname);
    console.log('__filename:', __filename);

    const fixturesPath = path.resolve(process.cwd(), 'tests/fixtures/layouts');
    console.log('Fixtures path:', fixturesPath);
    console.log('Fixtures exists:', existsSync(fixturesPath));

    const templatesPath = path.resolve(process.cwd(), '../../templates/agents');
    console.log('Templates path:', templatesPath);
    console.log('Templates exists:', existsSync(templatesPath));
    console.log('=== END DEBUG ===');
  });
});
