import {test,expect} from '@playwright/test';
import {restoreRecordedWorkspace} from './recorded-workspace.js';
import {finishStory,read} from './game-helpers.js';

// Regression from a truncated real archive, not an independent blank learner run.
test('actual read, both branches and customer report stay visible until explicit continue, including refresh and review',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await restoreRecordedWorkspace(page,{beforeStoryRead:true});
  await expect(page.getByRole('region',{name:'当前编程练习',exact:true})).toBeVisible();
  const output=page.getByRole('button',{name:'让虚拟 LED 亮起来',exact:true});
  if(await output.isVisible()){await output.click();await expect.poll(async()=>!(await read(page)).pending).toBe(true);await page.getByRole('button',{name:'让虚拟 LED 熄灭',exact:true}).click();await expect.poll(async()=>!(await read(page)).pending).toBe(true);}
  await page.getByRole('button',{name:'运行一次，查看实际读取',exact:true}).click();
  const result=page.getByRole('region',{name:'先查看这次结果',exact:true});
  await expect(result).toContainText('读到 150');await expect(page.locator('[data-story-scene="branch"]')).toHaveCount(0);await expect(page.getByRole('region',{name:'程序实际观察'})).toBeVisible();
  await page.reload();await expect(result).toContainText('读到 150');await expect(page.locator('[data-story-scene="branch"]')).toHaveCount(0);
  await expect(page.locator('.eq-game-block-editor .blocklySvg')).toBeVisible();
  const canvas=await page.locator('.eq-game-block-editor .eq-live-blocks').boundingBox();
  await expect.poll(async()=>{const root=await page.locator('.eq-game-block-editor .blocklyWorkspace .blocklyBlockCanvas > g[data-id]').first().boundingBox();return root&&root.x>=canvas.x-2&&root.x+root.width<=canvas.x+canvas.width+2&&root.y>=canvas.y-2&&root.y+root.height<=canvas.y+canvas.height+2;}).toBe(true);
  await page.screenshot({path:test.info().outputPath('read-result-stays-before-dialogue.png'),animations:'disabled'});
  await result.getByRole('button',{name:'看清了，继续明暗判断 →',exact:true}).click();await expect(page.locator('[data-story-scene="branch"]')).toBeVisible();await finishStory(page);
  await page.getByRole('button',{name:'观察暗场景 · 光照 150',exact:true}).click();await page.getByRole('button',{name:'观察亮场景 · 光照 850',exact:true}).click();
  await expect(result).toContainText('暗场景');await expect(result).toContainText('亮场景');await expect(page.locator('[data-story-scene="repeat"]')).toHaveCount(0);
  await result.getByRole('button',{name:'看清了，继续连续变化 →',exact:true}).click();await finishStory(page);
  await page.getByRole('button',{name:'运行暗 → 亮 → 暗，查看三次读取',exact:true}).click();
  await expect.poll(async()=>!(await read(page)).pending).toBe(true);await page.getByRole('button',{name:'运行当前基础客户测试',exact:true}).click();
  await expect(result).toContainText('26/26');await expect(page.locator('[data-story-scene="base"]')).toHaveCount(0);
  await expect(page.locator('.eq-game-program > .eq-game-tool-actions button').filter({hasText:'保留基础作品，查看代码变更'})).toBeDisabled();
  await result.getByRole('button',{name:'打开完整客户测试结果 ↗',exact:true}).click();await expect(page.getByRole('region',{name:'独立客户测试结果',exact:true})).toContainText('26/26');
  await page.reload();await expect(result).toContainText('26/26');await expect(page.locator('[data-story-scene="base"]')).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('customer-result-stays-and-reviews.png')});
  await result.getByRole('button',{name:'看完结果，继续客户来信 →',exact:true}).click();await expect(page.locator('[data-story-scene="base"]')).toBeVisible();
});
