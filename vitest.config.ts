import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/worktree/**',  // Exclude git worktree directories
      '**/.git/**',
      '**/*.d.ts',
    ],
  },
});