import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ConfigService } from '../../../src/services/config.service';

describe('ConfigService - CREWX_CONFIG environment variable', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'crewx-config-env-'));
  const configPath = path.join(tempDir, 'crewx.yaml');

  beforeAll(() => {
    const yamlContent = [
      'agents:',
      '  - id: env_agent',
      '    provider: claude',
      '    working_directory: ./',
      '    inline:',
      '      type: agent',
      '      provider: claude',
      '      system_prompt: |',
      '        You are env agent.',
      '',
    ].join('\n');

    writeFileSync(configPath, yamlContent, 'utf-8');
    process.env.CREWX_CONFIG = configPath;
  });

  afterAll(() => {
    delete process.env.CREWX_CONFIG;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads configuration from CREWX_CONFIG path', () => {
    const service = new ConfigService();
    expect(service.getCurrentConfigPath()).toBe(configPath);
    expect(service.getAllAgentIds()).toContain('env_agent');
  });
});
