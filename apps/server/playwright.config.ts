import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:25565',
    headless: true,
  },
  webServer: {
    command: 'cd ../.. && bun run build && node apps/server/dist/server.js',
    url: 'http://127.0.0.1:25565',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
