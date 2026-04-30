import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: {
      '@agentflow/core': path.resolve(__dirname, 'packages/core/src'),
      '@agentflow/cli': path.resolve(__dirname, 'packages/cli/src'),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.{test,spec,property}.{js,ts}'],
    testTimeout: 30000,
  },
});
