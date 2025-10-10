// Vitest setup file
import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Mock process.env
  process.env.NODE_ENV = 'test';
});

// Mock child_process for testing
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));