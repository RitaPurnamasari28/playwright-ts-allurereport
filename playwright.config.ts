import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  workers: 1,
  globalSetup: './global-setup.ts',
  reporter: [
  ["list"],
  
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
    "allure-playwright",
    {
      resultsDir: "allure-results",
      detail: true,
      suiteTitle: true,
    },
  ],
  ['./utils/ai-summary-reporter.ts'],
],

  use:{

    headless:true,

    screenshot: 'only-on-failure',

    trace:"on",

    video:"retain-on-failure", //video:"on" kalo mau record saat pass juga. skrng cuma muncul saat fail
    actionTimeout: 30000,

    

  },
  timeout: 120000

});