import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.{test,spec,property}.js', 'agentflow/tests/**/*.{test,spec,property}.js', 'ui/src/**/*.{test,spec}.ts'],
    testTimeout: 30000,
  },
});
