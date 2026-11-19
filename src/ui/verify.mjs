import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.EQ_UI_PREVIEW_URL || 'http://127.0.0.1:4175/src/ui/preview.html';
const output = new URL('../../docs/design/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
const page = await browser.newPage({viewport: {width: 1440, height: 1080}, reducedMotion: 'reduce'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
async function screenshot(name) {
  // Capture fixed elements at the top of the page, including the hidden skip link.
  await page.evaluate(() => window.scrollTo({top: 0, left: 0, behavior: 'instant'}));
  await page.screenshot({path: new URL(name, output).pathname, fullPage: true});
}
const nav = name => page.getByRole('navigation', {name: '主要导航'}).getByRole('button', {name});
async function imagesLoaded() {
  await page.locator('.eq-ui img').evaluateAll(async images => {
    await Promise.all(images.map(async image => { image.loading = 'eager'; await image.decode(); }));
    if (images.some(image => image.naturalWidth === 0)) throw new Error('An illustration failed to load');
    for (const image of images) {
      if (image.hasAttribute('width') && image.naturalWidth !== Number(image.getAttribute('width'))) throw new Error('Illustration width differs from its registry');
      if (image.hasAttribute('height') && image.naturalHeight !== Number(image.getAttribute('height'))) throw new Error('Illustration height differs from its registry');
    }
  });
}
async function noHorizontalOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'The page must not overflow horizontally');
}
try {
  await page.goto(baseURL);
  await page.getByRole('heading', {name: '早上好，见习工程师。'}).waitFor();
  await imagesLoaded();
  await noHorizontalOverflow();
  await screenshot('preview-desktop.png');

  await page.getByRole('button', {name: '查看我的第一份委托'}).click();
  await page.getByRole('heading', {name: '先把需求，聊明白。'}).waitFor();
  await imagesLoaded();
  assert.match(await page.locator('.eq-task-mail figure').innerText(), /剧情示意/);
  const selects = page.locator('.eq-requirement-form select');
  await selects.nth(0).selectOption({label: '环境光照的读数'});
  await selects.nth(1).selectOption({label: '环境变暗时'});
  await selects.nth(2).selectOption({label: '关闭 LED'});
  await selects.nth(3).selectOption({label: '持续重复检查'});
  await page.getByRole('textbox').fill('先读取光照。暗时亮灯，亮时灭灯，并持续检查。');
  await page.getByRole('button', {name: '保存演示草稿'}).click();
  assert.match(await page.getByRole('status').innerText(), /未评判答案，未授予通关/);
  await screenshot('preview-mail.png');
  await nav('我的工位').click();
  await nav('公司邮箱').click();
  assert.match(await page.getByRole('textbox').inputValue(), /先读取光照/);

  await nav('电子工作台').click();
  await page.getByRole('button', {name: '查看 A0 · 模拟输入候选'}).click();
  assert.match(await page.locator('.eq-workbench-detail').innerText(), /A0 \/ 端子说明/);
  await page.getByRole('button', {name: '查看连线构图'}).click();
  assert.equal(await page.getByRole('button', {name: '隐藏连线构图'}).getAttribute('aria-pressed'), 'true');
  await screenshot('preview-workbench.png');
  await page.getByRole('tab', {name: '01 硬件接线'}).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', {name: '02 积木 Demo'}).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.getByRole('tab', {name: '04 客户测试'}).getAttribute('aria-selected'), 'true');
  assert.match(await page.getByRole('tabpanel').innerText(), /尚未运行/);

  await page.getByRole('button', {name: '工程手册 随时翻一翻'}).click();
  await page.getByRole('dialog', {name: '工位上的工程手册'}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.match(await page.locator(':focus').innerText(), /工程手册/);

  await page.getByRole('button', {name: '真机与教师验收，之后在现场完成'}).click();
  assert.match(await page.getByRole('dialog').innerText(), /当前没有烧录/);
  await page.keyboard.press('Escape');
  await nav('收入榜').click();
  assert.equal(await page.getByRole('row').count(), 5);
  assert.match(await page.locator('.eq-income-board').innerText(), /合成展示/);

  await page.setViewportSize({width: 390, height: 844});
  await nav('我的工位').click();
  await noHorizontalOverflow();
  await screenshot('preview-mobile.png');
  await page.getByRole('button', {name: '向老师求助', exact: true}).click();
  assert.match(await page.getByRole('dialog').innerText(), /尚未发送请求/);
  await page.keyboard.press('Escape');
  for (const view of ['公司邮箱', '电子工作台', '收入榜']) {await nav(view).click(); await noHorizontalOverflow();}

  // Existing global stylesheet must not reshape the shell when E imports it.
  await page.addStyleTag({url: '/src/style.css'});
  await nav('我的工位').click();
  await noHorizontalOverflow();
  assert.equal(await page.locator('.eq-sidebar').evaluate(node => getComputedStyle(node).position), 'static');
  assert.equal(await page.locator('.eq-main').evaluate(node => getComputedStyle(node).marginLeft), '0px');
  await page.setViewportSize({width: 1440, height: 1080});
  await noHorizontalOverflow();
  assert.equal(await page.locator('.eq-sidebar').evaluate(node => getComputedStyle(node).position), 'static');
  await page.goto(new URL('art-preview.html', baseURL).href);
  await page.getByRole('heading', {name: '第一份委托，发生在这里。'}).waitFor();
  await imagesLoaded();
  assert.equal(await page.locator('.eq-art-gallery img').count(), 5);
  await noHorizontalOverflow();
  await screenshot('preview-art.png');
  await page.setViewportSize({width: 390, height: 844});
  await noHorizontalOverflow();
  assert.deepEqual(errors, [], 'No runtime errors or failed asset requests');
  console.log('PASS: desktop/mobile navigation, synthetic draft, pin selection, keyboard tabs, dialog focus, real-hardware status, income fixture, global CSS isolation, all 5 art assets and desktop/mobile gallery; screenshots saved in docs/design/.');
} finally { await browser.close(); }
