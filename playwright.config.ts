import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  workers: 1,
  globalSetup: './global-setup.ts',
  reporter: [
    ['list'],
    /*
    [
      "html",
      {
        outputFolder: "playwright-report",
        open: "never",
      },
    ],
    */
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        detail: true,
        suiteTitle: true,
      },
    ],
    ['./utils/ai-summary-reporter.ts'],
  ],

  use: {
    headless: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 45000,
  },

  timeout: 60000,
});