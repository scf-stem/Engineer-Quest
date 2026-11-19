import {test,expect} from '@playwright/test';
import {restoreRecordedWorkspace} from './recorded-workspace.js';
import {finishStory,read} from './game-helpers.js';

test('continuous observation discloses its windows before running and explains actual delayed writes without claiming customer timeout',async({page})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width:1280,height:720});await restoreRecordedWorkspace(page,{beforeStoryRead:true});
  await expect(page.getByRole('region',{name:'当前编程练习',exact:true})).toBeVisible();
  const output=page.getByRole('button',{name:'让虚拟 LED 亮起来',exact:true});
  if(await output.isVisible()){await output.click();await expect.poll(async()=>!(await read(page)).pending).toBe(true);await page.getByRole('button',{name:'让虚拟 LED 熄灭',exact:true}).click();}
  await page.getByRole('button',{name:'运行一次，查看实际读取',exact:true}).click();await page.getByRole('button',{name:'看清了，继续明暗判断 →',exact:true}).click();await finishStory(page);
  await page.getByRole('button',{name:'观察暗场景 · 光照 150',exact:true}).click();await page.getByRole('button',{name:'观察亮场景 · 光照 850',exact:true}).click();
  await page.getByRole('button',{name:'看清了，继续连续变化 →',exact:true}).click();await finishStory(page);
  // Invalidate already observed work through a real visible single-statement edit.
  // This also exercises the crowded recheck + criterion + failure layout.
  await moveDecision(/^等待 1 · 后面/);
  await page.getByRole('button',{name:'点选移动 / 插入',exact:true}).click();
  const criterion=page.getByRole('complementary',{name:'本次连续观察口径',exact:true});await expect(criterion).toContainText('99、199、299');await expect(criterion).toContainText('200ms');
  await page.getByRole('button',{name:'运行暗 → 亮 → 暗，查看三次读取',exact:true}).click();
  const diagnosis=page.getByRole('region',{name:'连续变化实际诊断',exact:true});await expect(diagnosis).toHaveAttribute('data-diagnostic-status','available');
  await expect(diagnosis).toContainText('有3个窗口');await expect(diagnosis).toContainText('不能据此断定客户超时');
  await expect(diagnosis.locator('[data-window-at="99"]')).toContainText('尚未写出，显示初始灯态');
  await expect(diagnosis.locator('[data-window-at="99"]')).toBeInViewport();
  expect(await page.locator('.eq-practice-story').evaluate(el=>el.clientHeight)).toBeGreaterThan(0);
  await page.screenshot({path:test.info().outputPath('failure-visible-with-current-rechecks.png'),animations:'disabled'});
  await diagnosis.locator('[data-window-at="199"] summary').click();
  await expect(diagnosis.locator('[data-window-at="199"]')).toContainText('100ms 读到850');await expect(diagnosis.locator('[data-window-at="199"]')).toContainText('100ms 明确开灯');
  await expect(diagnosis.locator('[data-window-at="199"]')).toContainText('最近一次读取是0ms的150');
  await expect(page.getByRole('region',{name:'和林工一起做',exact:true})).toContainText('写出晚于观察点');expect((await read(page)).baseReady).toBe(false);
  await diagnosis.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('actual-window-diagnosis.png'),animations:'disabled'});
  await page.reload();await expect(diagnosis).toContainText('最近一次读取是0ms的150');
  // Repair the same existing if through visible statement placement. No setter
  // or replacement program is used; all branch children and the wait stay owned.
  async function moveDecision(destinationPattern=/^变量赋值 1 · 后面/){
    const toggle=page.getByRole('button',{name:'点选移动 / 插入',exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    const source=page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}),target=page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true});
    const selected=await source.locator('optgroup[label="工作区已有积木"] option').filter({hasText:/^如果 ·/}).first().getAttribute('value');await source.selectOption(selected);
    const destination=await target.locator('option').filter({hasText:destinationPattern}).getAttribute('value');await target.selectOption(destination);
    await page.getByRole('button',{name:'2 预览连接',exact:true}).click();await expect(page.locator('.eq-program-placement-preview')).toContainText('分支随行');
    await page.getByRole('button',{name:'确认连接',exact:true}).click();await expect.poll(async()=>!(await read(page)).pending).toBe(true);
  }
  await moveDecision();await page.getByRole('button',{name:'撤销一步',exact:true}).click();await expect.poll(async()=>!(await read(page)).pending).toBe(true);
  await page.getByRole('button',{name:'运行暗 → 亮 → 暗，查看三次读取',exact:true}).click();await expect(diagnosis).toContainText('有3个窗口');
  await moveDecision();await page.getByRole('button',{name:'点选移动 / 插入',exact:true}).click();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();
  await page.getByRole('button',{name:'运行暗 → 亮 → 暗，查看三次读取',exact:true}).click();await expect(diagnosis.locator('[data-window-matched="true"]')).toHaveCount(3);
  await page.locator('.eq-practice-repeat-again summary').click();
  await expect(page.getByRole('complementary',{name:'本次连续观察口径',exact:true})).toContainText('99、199、299');
  await page.getByRole('button',{name:'重新运行暗 → 亮 → 暗（当前作品）',exact:true}).click();
  await expect(diagnosis).toHaveAttribute('data-current','true');await expect(diagnosis.locator('[data-window-matched="true"]')).toHaveCount(3);
  for(let i=0;i<5;i++){
    await expect(page.getByRole('region',{name:'当前编程练习',exact:true})).toHaveAttribute('aria-busy','false');const buttons=page.getByRole('button',{name:/^用当前作品复核：/});if(!await buttons.count())break;await buttons.first().click();
  }
  await page.getByRole('button',{name:'运行当前基础客户测试',exact:true}).click();await expect(page.getByRole('region',{name:'先查看这次结果',exact:true})).toContainText('26/26');
  await page.screenshot({path:test.info().outputPath('same-statement-repaired-and-tested.png'),animations:'disabled'});
});
