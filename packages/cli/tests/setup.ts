import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock NestJS common dependencies
vi.mock('@nestjs/common', () => ({
  Injectable: () => (target: any) => target, // Decorator that returns the class unchanged
  Inject: () => (target: any, propertyKey: string | symbol, parameterIndex: number) => {}, // Parameter decorator
  Optional: () => (target: any, propertyKey: string | symbol, parameterIndex: number) => {}, // Parameter decorator
  forwardRef: (factory: () => any) => ({ forwardRef: factory }), // Minimal forwardRef shim
  Logger: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  OnModuleInit: vi.fn(), // Interface/type, not used at runtime
}));

vi.mock('@nestjs/config', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    getOrThrow: vi.fn(),
  })),
}));

// Mock external dependencies
vi.mock('js-yaml', () => ({
  load: vi.fn(),
  dump: vi.fn(),
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
  
  createMockExecutionContext: () => ({
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn(),
      getResponse: vi.fn(),
    }),
  }),
};
