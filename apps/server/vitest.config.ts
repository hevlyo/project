import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', '../../node_modules/**'],
    environment: 'node',
    globals: true,
  },
});
