import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@crewx/sdk/plugins': path.resolve(__dirname, '../sdk/src/plugins/index.ts'),
      '@crewx/sdk': path.resolve(__dirname, '../sdk/src/index.ts'),
    },
  },
});
