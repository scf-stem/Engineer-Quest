import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const url = process.env.EQ_ADVENTURE_PREVIEW_URL || 'http://127.0.0.1:4175/src/ui/adventure-preview.html';
const output = new URL('../../docs/design/', import.meta.url);
const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
const page = await browser.newPage({viewport: {width: 1440, height: 1100}});
const errors = [];
let mainNavigations = 0;
page.on('framenavigated', frame => {if (frame === page.mainFrame()) mainNavigations++;});
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
const scene = () => page.getByRole('group', {name: '场景互动'});
const list = () => page.getByRole('navigation', {name: '互动入口'});
const goal = () => page.getByRole('region', {name: '当前目标'}).innerText();
async function shot(file) {await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({path: new URL(file, output).pathname, fullPage: (await page.getByRole('dialog').count()) === 0});}
async function noOverflow() {assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);}
try {
  await page.goto(url);
  await page.getByRole('heading', {name: '每个想法，都从一次好奇开始。'}).waitFor();
  await page.locator('.eq-exploration-background').evaluate(image => image.decode());
  await noOverflow();
  const initialGoal = await goal();
  assert.match(initialGoal, /视觉小样/);
  assert.match(await page.locator('.eq-world-caption').innerText(), /原创场景 \/ 视觉小样/);
  await page.getByRole('checkbox', {name: '减少动效'}).check();
  assert.equal(await page.locator('.eq-hotspot-ring').first().evaluate(node => getComputedStyle(node).animationName), 'none');
  await shot('preview-adventure-desktop.png');

  await scene().getByRole('button', {name: '和林工聊一聊', exact: true}).click();
  await page.getByRole('dialog', {name: '和林工聊一聊'}).waitFor();
  await page.getByRole('button', {name: '接着聊'}).click();
  assert.match(await page.getByRole('dialog').innerText(), /灯已经亮着，周围又变亮了/);
  assert.match(await page.getByRole('dialog').innerText(), /静态剧情对话/);
  await page.getByRole('dialog').locator('img').evaluate(image => image.decode());
  await shot('preview-adventure-dialogue.png');
  await page.getByRole('button', {name: '查看客户委托'}).click();
  assert.match(await page.getByRole('dialog').innerText(), /校园自动灯委托/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '和林工聊一聊');
  assert.equal(await goal(), initialGoal, 'Dialogue and mail must not advance the controlled objective');

  await page.getByRole('checkbox', {name: '显示互动标记'}).uncheck();
  assert.equal(await scene().isVisible(), false);
  await list().getByRole('button', {name: /首单工具箱/}).click();
  await page.getByRole('button', {name: 'LED', exact: true}).click();
  assert.match(await page.locator('.eq-inspection-info').innerText(), /限流元件/);
  await page.getByRole('dialog').locator('img').evaluate(image => image.decode());
  await shot('preview-adventure-kit.png');
  await page.getByRole('button', {name: '查工程手册'}).click();
  assert.match(await page.getByRole('dialog').innerText(), /课程实际节号/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.innerText.includes('首单工具箱'));
  assert.equal(await goal(), initialGoal);

  await page.getByText('直接打开工程工具', {exact: true}).click();
  assert.equal(await page.getByRole('button', {name: '简写 C++', exact: true}).isEnabled(), false);
  assert.match(await page.locator('.eq-direct-tools').innerText(), /示例前置条件尚未满足/);
  await page.getByRole('button', {name: '客户测试', exact: true}).click();
  assert.match(await page.getByRole('dialog').innerText(), /没有运行测试/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '需要时，找老师'}).click();
  assert.match(await page.getByRole('dialog').innerText(), /尚未发送求助/);
  await page.keyboard.press('Escape');
  assert.equal(await goal(), initialGoal);

  await page.getByRole('checkbox', {name: '显示互动标记'}).check();
  await page.setViewportSize({width: 390, height: 844});
  await noOverflow();
  await shot('preview-adventure-mobile.png');
  await list().getByRole('button', {name: /公司邮箱/}).focus();
  await page.keyboard.press('Enter');
  assert.match(await page.getByRole('dialog').innerText(), /校园自动灯委托/);
  await page.keyboard.press('Escape');
  await list().getByRole('button', {name: /和林工聊一聊/}).click();
  await noOverflow();
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', {name: '减少动效'}).uncheck();
  await page.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await page.locator('.eq-hotspot-ring').first().evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.addStyleTag({url: '/src/style.css'});
  await noOverflow();
  assert.equal(await page.locator('.eq-adventure-header').evaluate(node => getComputedStyle(node).marginBottom), '0px');
  assert.equal(await page.locator('.eq-adventure-main').evaluate(node => getComputedStyle(node).marginLeft), '0px');
  await page.setViewportSize({width: 1440, height: 1100});
  await noOverflow();
  assert.equal(await page.locator('.eq-adventure-main').evaluate(node => Math.round(node.getBoundingClientRect().width)), 1440);
  // A real brand click must call onHome while retaining this document and its state.
  await page.getByRole('checkbox', {name: '显示互动标记'}).uncheck();
  await page.evaluate(() => {window.__eqHomeMemoryProbe = 'retained';});
  const previousURL = page.url();
  const previousNavigations = mainNavigations;
  await page.locator('.eq-adventure-brand').click();
  assert.match(await page.getByRole('status').innerText(), /已回到个人工位/);
  assert.equal(page.url(), previousURL);
  assert.equal(mainNavigations, previousNavigations);
  assert.equal(await page.evaluate(() => window.__eqHomeMemoryProbe), 'retained');
  assert.equal(await page.getByRole('checkbox', {name: '显示互动标记'}).isChecked(), false);
  assert.equal(await goal(), initialGoal);
  assert.deepEqual(errors, []);
  console.log('PASS: hotspots/list, dialogue/focus, inspection, controlled goal, disabled actions, mobile/reduced motion, CSS isolation, and actual onHome click without navigation or loss of in-memory state; four screenshots saved.');
} finally {await browser.close();}
