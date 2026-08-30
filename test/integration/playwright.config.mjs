import { chromium, defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.pwtest.mjs',
  use: {
    launchOptions: {
      executablePath: chromium.executablePath(),
    },
  },
});
