import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
    testTimeout: 30000,
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/worktree/**',
      '**/.git/**',
      '**/*.d.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/config/**',
        '**/*.config.*',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'tests'),
      '@sowonai/crewx-sdk': resolve(__dirname, '../sdk/dist'),
      '@sowonai/crewx-sdk/internal': resolve(__dirname, '../sdk/dist/internal'),
    },
  },
  esbuild: {
    target: 'node18',
  },
});