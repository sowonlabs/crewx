import { vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

// Mock console methods to reduce noise in tests
// global.console = {
//   ...console,
//   log: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies (wrap real js-yaml so parsing still works in tests)
vi.mock('js-yaml', async () => {
  const actual = await vi.importActual<typeof import('js-yaml')>('js-yaml');

  return {
    ...actual,
    load: vi.fn((...args: Parameters<typeof actual.load>) => actual.load(...args)),
    dump: vi.fn((...args: Parameters<typeof actual.dump>) => actual.dump(...args)),
  };
});

// Mock fs with all required methods
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Global test utilities
global.testUtils = {
  createMockAgent: (id: string, provider: string) => ({
    id,
    name: `Test Agent ${id}`,
    provider,
    description: `Mock test agent ${id}`,
    options: [],
  }),
  
  createMockConfig: () => ({
    agents: [],
    mcp: {},
    slack: {},
    logging: { level: 'error' },
  }),
};
