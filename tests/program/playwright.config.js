import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'browser.spec.js', timeout: 30000,
  outputDir: '../../test-results/program',
  use: {baseURL: 'http://127.0.0.1:5186', launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {}},
  webServer: {command: 'npm run dev -- --port 5186 --strictPort', url: 'http://127.0.0.1:5186/src/program/demo.html', reuseExistingServer: !process.env.CI},
});
