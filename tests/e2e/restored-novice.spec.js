import {test,expect} from '@playwright/test';
import {tool,read} from './game-helpers.js';
import {restoreRecordedWorkspace} from './recorded-workspace.js';

test('main root replays actual blank walkthrough record and preserves current facts through all tools',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1280,height:900});await restoreRecordedWorkspace(page);await expect(page.getByRole('heading',{name:'回看本机作品与测试证据',exact:true})).toBeVisible();
  const original=await read(page);expect(original.income).toBe(100);expect(original.codeReady).toBe(true);expect(original.stage).toBe('software-complete');
  expect(original.tests.map(t=>t.passed)).toContain(false);expect(original.tests.length).toBeGreaterThanOrEqual(3);
  await tool(page,'blocks').click();
  await expect(page.getByRole('heading',{name:'基础版已完成',exact:true})).toBeVisible();
  await expect(page.locator('.eq-program-practice')).not.toContainText('评审与当前个人');
  await page.getByRole('button',{name:'查看完整积木',exact:true}).click();
  await page.screenshot({path:test.info().outputPath('actual-own-blocks-restored.png')});
  await tool(page,'tests').click();await page.getByText('全部本机测试历史（含失败）',{exact:true}).click();
  const failed=page.getByRole('region',{name:'独立客户测试结果',exact:true}).filter({hasText:'12/20'});
  await failed.scrollIntoViewIfNeeded();await expect(failed).toContainText('证据已失效');
  await page.screenshot({path:test.info().outputPath('actual-failure-retained.png')});
  await tool(page,'code').click();await expect(page.getByRole('textbox',{name:'当前简写 C++',exact:true})).toHaveValue(original.source);
  await expect(page.getByRole('button',{name:'导出当前候选 .ino',exact:true})).toBeEnabled();
  await tool(page,'income').click();await expect(page.getByRole('button',{name:'再次请求本机入账（验证去重）',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByTestId('personal-income')).toHaveText('100 EC');
  expect((await read(page)).attemptId).toBe(original.attemptId);expect((await read(page)).codeReady).toBe(true);
  expect(errors).toEqual([]);
});
