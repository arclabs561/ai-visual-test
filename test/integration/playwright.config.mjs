import { chromium, defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'playwright-integration.pwtest.mjs',
  use: {
    launchOptions: {
      executablePath: chromium.executablePath(),
    },
  },
});
