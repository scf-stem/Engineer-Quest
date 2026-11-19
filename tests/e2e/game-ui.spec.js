import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join,claim,tool,read,setRequirementQuestion,expectRequirementQuestion} from './game-helpers.js';

test('mobile full manual retains current draft and exposes authored SVG and both source attachments',async({page})=>{
  await page.setViewportSize({width:390,height:844});await join(page);await claim(page);
  await setRequirementQuestion(page,'1234567 m f 不应触发工具');
  await page.getByRole('button',{name:'打开工程手册',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('article')).toContainText('§02.1');
  const close=dialog.getByRole('button',{name:'关闭对话框',exact:true});
  const bounds=await close.boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  await dialog.getByText('查更多工程资料',{exact:true}).click();await dialog.getByRole('button',{name:'打开完整资料库',exact:true}).click();
  await dialog.getByRole('button',{name:'首单手册',exact:true}).click();
  const diagram=dialog.getByRole('img',{name:/虚拟自动灯六线功能图/});
  await expect.poll(()=>diagram.evaluate(e=>e.naturalWidth)).toBeGreaterThan(0);
  await dialog.getByRole('button',{name:'参考实现',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'尝试后再查看完整实现',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'我需要核对完整参考实现',exact:true}).click();
  for(const name of ['基础自动灯.short.cpp','变更自动灯.short.cpp']){
    const downloading=page.waitForEvent('download');await dialog.getByRole('link',{name,exact:true}).click();
    expect(await readFile(await(await downloading).path(),'utf8')).toContain('void loop()');
  }
  await close.click();await expectRequirementQuestion(page,'1234567 m f 不应触发工具');
  await tool(page,'desk').click();await tool(page,'mail').click();await expectRequirementQuestion(page,'1234567 m f 不应触发工具');
  expect((await read(page)).requirementsReady).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'打开工程手册',exact:true}).click();
  await dialog.getByText('查更多工程资料',{exact:true}).click();await dialog.getByRole('button',{name:'打开完整资料库',exact:true}).click();
  const books=await dialog.locator('.eq-game-manual-index').boundingBox(),sections=await dialog.locator('.eq-full-manual-sections').boundingBox();
  expect(sections.y).toBeGreaterThanOrEqual(books.y+books.height-1);
  expect(sections.height).toBeGreaterThan(24);
  await page.screenshot({path:test.info().outputPath('mobile-full-manual.png')});
});
