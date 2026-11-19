import {test,expect} from '@playwright/test';
import {restoreRecordedWorkspace} from './recorded-workspace.js';
import {tool,read,answerScene} from './game-helpers.js';

async function dragValue(page,locator,point){
  const box=await locator.boundingBox();await page.mouse.move(box.x+10,box.y+box.height/2);await page.mouse.down();await page.mouse.move(point.x+10,point.y,{steps:20});await page.mouse.up();
}

test('3440 by1157 keeps flyout and core practice actions inside one fitted work area',async({page})=>{
  await page.setViewportSize({width:3440,height:1157});await restoreRecordedWorkspace(page,{atBranches:true});
  await expect(page.locator('.blocklySvg').first()).toBeVisible();
  const canvas=await page.locator('.eq-live-blocks').boundingBox(),window=await page.locator('.eq-game-window').boundingBox();
  expect(canvas.height).toBeGreaterThan(540);expect(canvas.y+canvas.height).toBeLessThanOrEqual(window.y+window.height+1);
  const actions=page.getByRole('region',{name:'当前编程练习',exact:true});
  for(const name of ['观察暗场景 · 光照 150','观察亮场景 · 光照 850']){const box=await actions.getByRole('button',{name,exact:true}).boundingBox();expect(box.y+box.height).toBeLessThan(window.y+window.height);}
  await page.getByRole('button',{name:'找到等待积木',exact:true}).click();
  const wait=page.locator('.blocklyFlyout .blocklyText').filter({hasText:/^等待毫秒$/});await expect(wait).toBeVisible();const box=await wait.boundingBox();expect(box.y).toBeGreaterThan(canvas.y);expect(box.y+box.height).toBeLessThan(canvas.y+canvas.height);
  await page.locator('.blocklyToolboxCategory').filter({hasText:'变量与流程'}).click();
  const flyout=await page.locator('.blocklyFlyout:visible').first().boundingBox();await page.mouse.move(flyout.x+80,flyout.y+120);await page.mouse.wheel(0,700);
  const after=await wait.boundingBox();expect(after.y+after.height).toBeLessThanOrEqual(canvas.y+canvas.height+1);
  expect(await page.locator('.eq-game-window-content').evaluate(el=>el.scrollHeight<=el.clientHeight+2)).toBe(true);
  await page.screenshot({path:test.info().outputPath('3440-workspace-fit.png')});
  await page.setViewportSize({width:1440,height:900});await expect(page.getByRole('button',{name:'观察亮场景 · 光照 850',exact:true})).toBeVisible();
  const resized=await page.locator('.eq-live-blocks').boundingBox();expect(resized.y+resized.height).toBeLessThan(810);
  await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'找到等待积木',exact:true}).click();
  const shortCanvas=await page.locator('.eq-live-blocks').boundingBox(),shortWait=await wait.boundingBox();expect(shortWait.y+shortWait.height).toBeLessThan(shortCanvas.y+shortCanvas.height+1);
  await page.screenshot({path:test.info().outputPath('1280-core-actions-fit.png')});
});

test('integer drop cannot replace a whole if; selected left slot highlights and accepts the same value',async({page})=>{
  await page.setViewportSize({width:1920,height:1080});const ids=await restoreRecordedWorkspace(page,{atBranches:true,forSlotDrag:true});
  await page.getByRole('button',{name:'查看完整积木',exact:true}).click();
  const loose=page.locator(`.blocklyWorkspace g[data-id="${ids.variableId}"]`),compare=page.locator(`.blocklyWorkspace g[data-id="${ids.compareId}"]`);
  const before=await compare.locator(':scope>.blocklyPath').boundingBox(),original=await loose.boundingBox();await dragValue(page,loose,{x:before.x+4,y:before.y+before.height/2});
  await expect(page.locator(`.blocklyWorkspace g[data-id="${ids.ifId}"] g[data-id="${ids.compareId}"]`)).toHaveCount(1);
  const moved=await loose.boundingBox();expect(Math.hypot(moved.x-original.x,moved.y-original.y)).toBeGreaterThan(10);
  // Blockly may safely find the adjacent empty operand. Undo that real move
  // before demonstrating an explicitly locked empty left slot.
  await page.getByRole('button',{name:'撤销一步',exact:true}).click();
  await expect(page.locator(`.blocklyWorkspace .blocklyBlockCanvas>g[data-id="${ids.variableId}"]`)).toHaveCount(1);
  await expect(page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true}).locator(`option[value="${ids.compareId}|A"]`)).toHaveText('比较 1 · 左边值（空）');
  await expect.poll(async()=>{const state=await read(page);return !state.bufferPending&&!state.controllerPending&&!state.pending;}).toBe(true);
  await page.reload();
  await expect(page.locator(`.blocklyWorkspace .blocklyBlockCanvas>g[data-id="${ids.variableId}"]`)).toHaveCount(1);
  await expect(page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true}).locator(`option[value="${ids.compareId}|A"]`)).toHaveText('比较 1 · 左边值（空）');
  await page.screenshot({path:test.info().outputPath('whole-condition-protected.png')});
  await page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true}).selectOption(ids.compareId+'|A');
  const target=page.locator('[data-eq-exact-target]');await expect(target).toBeVisible();const mark=await target.boundingBox();
  await expect(page.getByRole('button',{name:'允许本次替换这个槽',exact:true})).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('precise-left-slot-highlight.png')});
  await dragValue(page,loose,{x:mark.x+mark.width/2,y:mark.y+mark.height/2});
  await expect(page.locator('[data-block-snap]')).toContainText('已经吸附到比较 · 左边值');
  await expect(page.locator(`.blocklyWorkspace g[data-id="${ids.compareId}"] g[data-id="${ids.variableId}"]`)).toHaveCount(1);
  expect((await read(page)).baseReady).toBe(false);await page.screenshot({path:test.info().outputPath('precise-left-slot-connected.png')});
});

test('change coaching moves from numeric prediction into own code and an actual old customer letter',async({page})=>{
  await page.setViewportSize({width:1920,height:1080});await restoreRecordedWorkspace(page);await tool(page,'mail').click();
  await page.getByText('回看约定与记录',{exact:true}).click();await page.getByRole('button',{name:'保留旧回答，重新核对本版',exact:true}).click();
  const story=page.getByRole('region',{name:'客户变更情境练习',exact:true}),lines=[];
  for(const id of ['now-on','lamp-off']){await story.locator(`[data-option-id="${id}"]`).click();await expect(story).toHaveAttribute('data-stage-response','accepted');lines.push(await story.locator('.eq-mentor-current-line').innerText());await story.locator('[data-scene-continue]').click();}
  const own=story.getByRole('region',{name:'在自己的作品中找修改位置',exact:true});await expect(own).toBeVisible();
  const choose=story.locator('[data-option-id="comparison"]');await expect(choose).toBeDisabled();
  await story.locator('[data-change-node="comparison"]').click();await expect(own).toContainText('(light < 450)');expect((await read(page)).codeReady).toBe(false);
  await page.screenshot({path:test.info().outputPath('change-inspect-own-comparison.png')});
  await choose.click();await expect(story).toHaveAttribute('data-stage-response','accepted');lines.push(await story.locator('.eq-mentor-current-line').innerText());await story.locator('[data-scene-continue]').click();
  await expect(story.getByRole('region',{name:'带着作品回客户桌前',exact:true})).toContainText('26 条采样符合');
  await story.locator('[data-option-id="old-report"]').click();await expect(story).toContainText('旧证据');await story.getByRole('button',{name:'我再操作一下，重新试试',exact:true}).click();
  await story.locator('[data-option-id="new-current-suite"]').click();await expect(story).toHaveAttribute('data-stage-response','accepted');lines.push(await story.locator('.eq-mentor-current-line').innerText());expect(new Set(lines).size).toBe(4);
  await page.screenshot({path:test.info().outputPath('change-specific-proof-dialogue.png')});
  await story.locator('[data-scene-continue]').click();expect((await read(page)).codeReady).toBe(false);
});
