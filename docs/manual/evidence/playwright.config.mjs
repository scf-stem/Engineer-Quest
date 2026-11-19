import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../../../tests/e2e',outputDir:'./browser-results',use:{baseURL:'http://127.0.0.1:5194',launchOptions:{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}}});
