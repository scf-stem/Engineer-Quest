import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const evidence = fileURLToPath(new URL('../../docs/hardware/evidence', import.meta.url));
const server = await createServer({root, server: {host: '127.0.0.1', port: 5187, strictPort: true}});
let browser;
try {
  await mkdir(evidence, {recursive: true});
  await server.listen();
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {});
  const page = await browser.newPage({viewport: {width: 1500, height: 1100}, deviceScaleFactor: 1});
  await page.goto('http://127.0.0.1:5187/src/hardware/demo.html');
  await page.getByRole('button', {name: '载入参考接线', exact: true}).click();
  await page.locator('.eq-hw-success').waitFor();
  await page.screenshot({path: `${evidence}/workbench-reference.png`, fullPage: true});
  await page.getByRole('button', {name: '空白接线', exact: true}).click();
  await page.locator('.eq-hw-pending').waitFor();
  await page.screenshot({path: `${evidence}/workbench-empty.png`, fullPage: true});
  await page.locator('[data-terminal="uno:5V"]').focus(); await page.keyboard.press('Enter');
  await page.locator('[data-terminal="uno:GND_1"]').focus(); await page.keyboard.press('Enter');
  await page.locator('[data-diagnostic-code="POWER_SHORT"]').waitFor();
  await page.screenshot({path: `${evidence}/workbench-errors.png`, fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:5187/src/hardware/demo.html');
  await page.locator('.eq-hw-pending').waitFor();
  await page.screenshot({path: `${evidence}/workbench-mobile.png`, fullPage: true});
  await page.setViewportSize({width: 1265, height: 950});
  await page.goto('http://127.0.0.1:5187/tests/hardware/props.html?nested');
  await page.getByRole('button', {name: 'Blank document', exact: true}).click();
  await page.locator('.eq-hw-pending').waitFor();
  await page.screenshot({path: `${evidence}/workbench-nested-1265.png`, fullPage: true});
  await page.getByRole('button', {name: '放大接线', exact: true}).click();
  await page.getByRole('button', {name: '向右查看 →', exact: true}).click();
  await page.screenshot({path: `${evidence}/workbench-nested-detail.png`, fullPage: true});
  console.log('Captured reference, neutral, short-circuit, mobile and nested-container views. No program or hardware execution.');
} finally {
  await browser?.close();
  await server.close();
}
