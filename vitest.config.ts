import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 90000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
