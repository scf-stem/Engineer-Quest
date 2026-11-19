import {defineConfig} from '@playwright/test';
const port=Number(process.env.EQ_PORT)||(process.env.EQ_PREVIEW?5189:5180);
const baseURL=`http://127.0.0.1:${port}`;
const outArg=process.env.EQ_DIST?` --outDir '${process.env.EQ_DIST.replaceAll("'","'\\''")}'`:'';
export default defineConfig({
  testDir:'tests/e2e',
  use:{baseURL,launchOptions:process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{},trace:'retain-on-failure'},
  webServer:{command:`npm run ${process.env.EQ_PREVIEW?'preview':'dev'} -- --port ${port} --strictPort${outArg}`,url:baseURL,reuseExistingServer:!process.env.EQ_PREVIEW},
});
