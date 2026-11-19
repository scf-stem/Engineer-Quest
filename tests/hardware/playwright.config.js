import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: '**/workbench.spec.js',
  outputDir: '/tmp/engineer-quest-hardware-test-results',
  use: {baseURL: 'http://127.0.0.1:5186', viewport: {width: 1500, height: 1100}, launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {}},
  webServer: {command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5186 --strictPort', cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:5186/src/hardware/demo.html', reuseExistingServer: false},
});
