import {test,expect} from '@playwright/test';
import {join,claim,tool,read,requirements} from './game-helpers.js';
import {restoreRecordedWorkspace} from './recorded-workspace.js';

test('a player can keep talking during actual wiring and program actions without dialogue awarding facts',async({page})=>{
  await page.setViewportSize({width:2560,height:1440});await join(page,'角色交流回归');await claim(page);
  const story=page.getByRole('region',{name:'客户需求情境练习',exact:true});
  await expect(story.locator('form,input[type=radio]')).toHaveCount(0);
  await story.getByRole('button',{name:'求助',exact:true}).click();await expect(page.getByRole('textbox',{name:'告诉林工卡在哪里（选填）',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'关闭对话框',exact:true}).click();expect((await read(page)).requirementsReady).toBe(false);
  const area=await story.boundingBox();expect(area.width).toBeGreaterThan(1300);
  await page.screenshot({path:test.info().outputPath('wide-dialogue.png')});
  await requirements(page);
  const wireCoach=page.locator('.eq-wire-current-goal');await expect(wireCoach).toContainText('给光照模块接电源');
  for(const terminal of ['uno:5V','sensor:VCC']){await page.locator(`[data-terminal="${terminal}"]`).focus();await page.keyboard.press('Enter');}
  await expect(wireCoach).toContainText('给光照模块接公共地');
  expect((await read(page)).wiring.wires).toBe(1);expect((await read(page)).baseReady).toBe(false);
  await page.screenshot({path:test.info().outputPath('wire-responds.png')});
  await restoreRecordedWorkspace(page,{atBranches:true});
  const practice=page.getByRole('region',{name:'当前编程练习',exact:true});
  await practice.getByRole('button',{name:'林工，我卡在这里',exact:true}).click();await expect(practice).toContainText('两个分支分别给动作');
  await page.getByRole('button',{name:'观察亮场景 · 光照 850',exact:true}).click();
  await expect(practice.locator('.eq-mentor-current-line')).toContainText('光照读到 850，LED 灭');
  await expect(page.locator('[data-block-snap]')).toContainText('插入预览');await expect(page.getByRole('button',{name:'点选移动 / 插入',exact:true})).toBeVisible();
  expect((await read(page)).baseReady).toBe(false);await page.screenshot({path:test.info().outputPath('program-responds.png')});
});

test('note input followed by reload before the async archive commit recovers the last characters',async({page})=>{
  await restoreRecordedWorkspace(page);await tool(page,'income').click();
  // Stall the main digest/IDB path. This checks the real synchronous recovery path,
  // not merely waiting for the normal saved indicator before reload.
  await page.evaluate(()=>{crypto.subtle.digest=()=>new Promise(()=>{});});
  const text='刚输入的最后几个字，也必须留住。';
  await page.getByRole('textbox',{name:'给自己的工程便签',exact:true}).fill(text);
  await page.reload();await expect(page.getByRole('textbox',{name:'给自己的工程便签',exact:true})).toHaveValue(text);
  await expect.poll(async()=>(await read(page)).storage).toBe('saved');await expect(page.getByTestId('personal-income')).toHaveText('100 EC');
  expect((await read(page)).codeReady).toBe(true);
});

test('frozen build identity agrees between HUD, text state and downloadable build record',async({page,request})=>{
  test.skip(!process.env.EQ_PREVIEW,'A development preview is deliberately not a frozen candidate');
  await page.goto('/sandbox.html');await page.getByRole('button',{name:'查看候选版本',exact:true}).waitFor();const build=(await read(page)).build,record=await(await request.get('/candidate-build.json')).json();
  expect(build).toEqual(record);expect(build.mode).toBe('frozen-candidate');expect(build.sourceDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  await page.getByRole('button',{name:'查看候选版本',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(build.id);await expect(page.getByRole('dialog')).toContainText(build.sourceRevision);
});
