import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join,claim,read,tool,setRequirementQuestion,expectRequirementQuestion} from './game-helpers.js';
import {restoreRecordedWorkspace} from './recorded-workspace.js';

const proof=state=>({learnerId:state.learnerId,attemptId:state.attemptId,stage:state.stage,requirementsReady:state.requirementsReady,practice:state.practice,wiring:state.wiring,source:state.source,income:state.income,tests:state.tests,story:state.story});

test('integrated taskbook includes final revisions, real picture zoom and exact PDF; returning preserves current work and short page',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await join(page,'图文册接入回归');await claim(page);
  await setRequirementQuestion(page,'先保留我眼前这个问题。');
  await expect.poll(async()=>(await read(page)).pending).toBe(false);const before=proof(await read(page));
  await page.getByRole('button',{name:'打开工程手册',exact:true}).click();const modal=page.getByRole('dialog',{name:'工程手册',exact:true});
  await expect(modal.getByRole('article',{name:'当前任务图解'})).toBeVisible();
  await modal.getByRole('button',{name:'首单图文任务书',exact:true}).click();await expect(modal.getByLabel('任务书页码')).toHaveValue('2');
  const frame=page.frameLocator('iframe[title="首单图文任务书 · 12页"]');await expect(frame.locator('.page')).toHaveCount(12);
  await expect(frame.locator('#page-01 .foot')).toContainText('示例图来源：826e80d93cbd');
  await expect(frame.locator('body')).not.toContainText('当前候选真实游戏截图');
  await expect(frame.locator('#page-03')).toContainText('未做完不等于接错');
  await expect(frame.locator('#page-07')).toContainText('画布');await expect(frame.locator('#page-12')).toContainText('写完刷新页面');
  await modal.getByLabel('任务书页码').selectOption('8');const picture=frame.locator('#page-08 a[href*="novice-03-compare-empty.png"]');
  await expect(picture.locator('img')).toBeVisible();await expect.poll(()=>picture.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await picture.click();const zoom=frame.getByRole('dialog',{name:'任务书图片放大',exact:true});await expect(zoom).toBeVisible();
  await zoom.getByRole('button',{name:'按原图查看细节',exact:true}).click();await expect(zoom).toHaveAttribute('data-original','true');
  await zoom.getByRole('button',{name:'返回刚才这一页',exact:true}).click();await expect(zoom).not.toBeVisible();
  await expect(picture).toBeFocused();await page.screenshot({path:test.info().outputPath('integrated-page8-1280.png'),animations:'disabled'});
  const event=page.waitForEvent('download');await modal.getByRole('link',{name:'下载 PDF（12页）',exact:true}).click();const download=await event;
  expect(download.suggestedFilename()).toBe('首单图文任务书.pdf');expect(await readFile(await download.path())).toEqual(await readFile('public/manual/first-order-v1/首单图文任务书.pdf'));
  await modal.getByRole('button',{name:'回到本步图解',exact:true}).click();await expect(modal.getByRole('article',{name:'当前任务图解'})).toContainText('灯怎样知道桌面暗了');
  await modal.getByRole('button',{name:'关闭对话框',exact:true}).click();await expectRequirementQuestion(page,'先保留我眼前这个问题。');
  expect(proof(await read(page))).toEqual(before);await page.reload();await expectRequirementQuestion(page,'先保留我眼前这个问题。');expect(proof(await read(page))).toEqual(before);
});

test('taskbook remains readable on mobile and never alters restored software delivery or current code',async({page})=>{
  await page.setViewportSize({width:390,height:844});await restoreRecordedWorkspace(page);const before=proof(await read(page));
  await page.getByRole('button',{name:'打开工程手册',exact:true}).click();const modal=page.getByRole('dialog',{name:'工程手册',exact:true});
  await modal.getByRole('button',{name:'首单图文任务书',exact:true}).click();const frame=page.frameLocator('iframe[title="首单图文任务书 · 12页"]');
  await modal.getByLabel('任务书页码').selectOption('12');await expect(frame.locator('#page-12')).toContainText('写完刷新页面');
  const layout=await frame.locator('body').evaluate(body=>({width:innerWidth,scroll:body.scrollWidth,overflow:[...body.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,style:e.getAttribute('style'),right:e.getBoundingClientRect().right}))}));expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(layout.width+1);
  const close=await modal.getByRole('button',{name:'关闭对话框',exact:true}).boundingBox();expect(close.y+close.height).toBeLessThan(844);
  await page.screenshot({path:test.info().outputPath('integrated-page12-mobile.png'),animations:'disabled'});
  await modal.getByRole('button',{name:'关闭对话框',exact:true}).click();expect(proof(await read(page))).toEqual(before);
});

test('delivery short guide follows the current income view after wiring revisit without changing real archived proof',async({page})=>{
  await restoreRecordedWorkspace(page,{guidedCompletion:true});await tool(page,'wiring').click();await tool(page,'income').click();
  await expect(page.getByRole('heading',{name:'首单软件演示已交付',exact:true})).toBeVisible();const before=proof(await read(page));
  await page.getByRole('button',{name:'打开工程手册',exact:true}).click();const guide=page.getByRole('article',{name:'当前任务图解',exact:true});
  await expect(guide).toContainText('§10.1');await expect(guide).toContainText('留下自己的修正');await expect(guide).not.toContainText('先接好光照模块');
  await page.getByRole('button',{name:'关闭对话框',exact:true}).click();expect(proof(await read(page))).toEqual(before);expect((await read(page)).income).toBe(100);
});
