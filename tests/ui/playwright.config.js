import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
const preview=!!process.env.EQ_UI_PREVIEW,port=preview?5197:5195;
export default defineConfig({testDir:'.',testMatch:'*.spec.js',outputDir:'../../test-results-ui-workspace',use:{baseURL:`http://127.0.0.1:${port}`,reducedMotion:'reduce',launchOptions:{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH},trace:'retain-on-failure'},webServer:{cwd:resolve(import.meta.dirname,'../..'),command:`${preview?'npx vite build --config tests/ui/preview.vite.config.js && ':''}npx vite ${preview?'preview ':''}--config tests/ui/preview.vite.config.js --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false}});
