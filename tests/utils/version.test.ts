// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CLI_VERSION', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns version string from package.json', async () => {
    vi.doMock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>();
      return { ...actual, readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '1.2.3' })) };
    });
    const { CLI_VERSION } = await import('../../src/utils/version');
    expect(CLI_VERSION).toBe('1.2.3');
  });

  it('returns 0.0.0 when package.json is missing', async () => {
    vi.doMock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>();
      return {
        ...actual,
        readFileSync: vi.fn().mockImplementation(() => {
          throw new Error('ENOENT');
        }),
      };
    });
    const { CLI_VERSION } = await import('../../src/utils/version');
    expect(CLI_VERSION).toBe('0.0.0');
  });

  it('returns 0.0.0 when version field is absent', async () => {
    vi.doMock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>();
      return { ...actual, readFileSync: vi.fn().mockReturnValue(JSON.stringify({ name: '@crewx/cli' })) };
    });
    const { CLI_VERSION } = await import('../../src/utils/version');
    expect(CLI_VERSION).toBe('0.0.0');
  });
});
