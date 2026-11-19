import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  workers: 1,
  globalSetup: './global-setup.ts',
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        detail: true,
        suiteTitle: true,
      },
    ],
    //['./utils/ai-summary-reporter.ts'],
  ],

  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on',
    video: 'retain-on-failure',
    actionTimeout: 30000,
  },

  timeout: 60000,
});