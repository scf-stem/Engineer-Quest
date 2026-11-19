import {test, expect} from '@playwright/test';
import {join, claim, finishStory, read} from './game-helpers.js';
import {restoreRecordedWorkspace} from './recorded-workspace.js';

const browserErrors=new WeakMap();
test.beforeEach(async({page})=>{const errors=[];browserErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});});
test.afterEach(async({page})=>{expect(browserErrors.get(page)).toEqual([]);});

const stage = page => page.locator('.eq-requirement-stage');
const option = (page, id) => stage(page).locator(`[data-option-id="${id}"]`);
const next = page => stage(page).locator('[data-scene-continue]');
const settle = async page => expect.poll(async () => !(await read(page)).pending).toBe(true);
const capture = (page, name) => page.screenshot({path:test.info().outputPath(`${name}.png`), animations:'disabled'});
async function scene(page, id) { await option(page,id).click(); await expect(next(page)).toBeVisible(); await settle(page); }
async function savedHandoff(page) {
  return page.evaluate(async()=>{
    const record=await new Promise((resolve,reject)=>{
      const open=indexedDB.open('engineer-quest-local-progress-v1',1);
      open.onsuccess=()=>{const db=open.result,request=db.transaction('records').objectStore('records').get('workspace');request.onsuccess=()=>{db.close();resolve(request.result);};request.onerror=()=>reject(request.error);};open.onerror=()=>reject(open.error);
    });
    const data=record.data,attempt=data.attempts.find(a=>a.id===data.activeAttemptId);
    return {pending:JSON.parse(window.render_game_to_text()).requirementsScene?.handoffPending??false,count:attempt.reviews.base.responses.length};
  });
}

for (const [width,height] of [[1920,1080],[1280,720],[1024,768]]) {
  test(`real new employee observes, retries and keeps the scene at ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height}); await join(page,`舞台${width}`); await claim(page);
    await expect(stage(page)).toHaveAttribute('data-focus-target','observe');
    await expect(stage(page).locator('.eq-client-meter')).not.toHaveRole('button');
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','850');
    const positions = await Promise.all(['.eq-client-objects','.eq-client-shade','.eq-stage-choices'].map(s=>stage(page).locator(s).boundingBox()));
    for(const rect of positions) {expect(rect.y).toBeGreaterThan(70);expect(rect.y+rect.height).toBeLessThan(height-60);}
    await capture(page,`${width}-observe`);
    await stage(page).getByRole('button',{name:'遮住光源，再看读数',exact:true}).click(); await settle(page);
    await expect(stage(page)).toHaveAttribute('data-focus-target','reading');
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await page.reload();await expect(stage(page)).toHaveAttribute('data-focus-target','reading');
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await stage(page).getByRole('button',{name:'听林工接着说 ▷',exact:true}).click(); await settle(page);
    await expect(stage(page)).toHaveAttribute('data-focus-target','choices');
    const cards=stage(page).locator('.eq-stage-choices button'); await expect(cards).toHaveCount(3);
    for(const selector of ['.eq-mentor-current-line','.eq-stage-question','.eq-stage-choices button']) expect(await stage(page).locator(selector).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const styles=await cards.evaluateAll(elements=>elements.map(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderColor,el.getBoundingClientRect().width];}));
    expect(styles.map(s=>s.slice(0,2))).toEqual([styles[0].slice(0,2),styles[0].slice(0,2),styles[0].slice(0,2)]);
    for(const s of styles) expect(Math.abs(s[2]-styles[0][2])).toBeLessThan(1);
    await expect(stage(page).locator('[data-current-focus=true]')).toHaveCount(1);
    await capture(page,`${width}-equal-choices`);
    await scene(page,'calendar');await expect(stage(page)).toHaveAttribute('data-stage-response','retry');
    await expect(stage(page)).toContainText('日期和旧读数无法区分');await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await capture(page,`${width}-retry`);
    await next(page).click();await settle(page);await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await page.reload();await expect(stage(page)).toHaveAttribute('data-focus-target','choices');
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await stage(page).getByRole('button',{name:'求助',exact:true}).click();
    await expect(stage(page)).toHaveAttribute('data-focus-target','suspended');await expect(stage(page).locator('[data-current-focus=true]')).toHaveCount(0);
    await page.getByRole('button',{name:'关闭对话框',exact:true}).click();await expect(stage(page)).toHaveAttribute('data-focus-target','choices');
    await stage(page).getByRole('button',{name:'一起翻手册 §03.1 ↗',exact:true}).click();await expect(page.locator('dialog[open]')).toBeVisible();
    await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await page.getByRole('button',{name:'关闭工具，返回研发室',exact:true}).click();await page.locator('[data-game-tool="mail"]').click();
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await option(page,'current-light').dblclick({delay:30});await expect(next(page)).toBeVisible();await settle(page);
    await expect(stage(page)).toHaveAttribute('data-focus-target','continue');
    expect(await savedHandoff(page)).toEqual({pending:true,count:2});
    await expect(stage(page)).toHaveAttribute('data-checkpoint-id','req-light-input');await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await expect(stage(page).locator('.eq-stage-heading')).toContainText('1 / 6 / 窗边与阴影');
    await capture(page,`${width}-accepted-150`);await page.reload();await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
    await next(page).click();await settle(page);await expect(stage(page)).toHaveAttribute('data-checkpoint-id','req-dark-action');
    expect(await savedHandoff(page)).toEqual({pending:false,count:2});
    await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','160');
  });
}

test('real later scenes preserve no-action lamp, timing and equality; early answers remain valid',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await join(page,'后续焦点');await claim(page);
  await scene(page,'current-light');await next(page).click();await settle(page);
  await scene(page,'lamp-on');await expect(stage(page).locator('[data-lamp]')).toHaveAttribute('data-lamp','on');await next(page).click();await settle(page);
  await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','810');await expect(stage(page).locator('[data-lamp]')).toHaveAttribute('data-lamp','on');
  await scene(page,'keep-on');await expect(stage(page).locator('[data-lamp]')).toHaveAttribute('data-lamp','on');await capture(page,'1280-no-action-keeps-lamp');
  await next(page).click();await settle(page);await scene(page,'lamp-off');await expect(stage(page).locator('[data-lamp]')).toHaveAttribute('data-lamp','off');await next(page).click();await settle(page);
  await expect(stage(page)).toHaveAttribute('data-checkpoint-id','req-read-again');
  await stage(page).getByRole('button',{name:'看下一个时刻',exact:true}).click();await settle(page);await expect(stage(page)).toHaveAttribute('data-focus-target','reading');
  await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','850');await capture(page,'1280-timeline-reading');
  await scene(page,'read-decide-repeat');await next(page).click();await settle(page);
  await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','450');await stage(page).getByRole('button',{name:'听林工接着说 ▷',exact:true}).click();await settle(page);
  await expect(stage(page)).toHaveAttribute('data-focus-target','choices');await capture(page,'1280-equality-choices');await scene(page,'lamp-off');await next(page).click();await settle(page);
  await expect(stage(page)).toHaveAttribute('data-checkpoint-id','req-transfer-sequence');await expect(stage(page).locator('.eq-stage-timeline li')).toHaveCount(4);
  for(const [width,height] of [[1920,1080],[1280,720],[1024,768]]) {
    await page.setViewportSize({width,height});const world=await stage(page).locator('.eq-stage-scene').boundingBox();
    for(const selector of ['.eq-client-objects','.eq-stage-timeline','.eq-client-shade']) {const box=await stage(page).locator(selector).boundingBox();expect(box.y).toBeGreaterThanOrEqual(world.y);expect(box.y+box.height).toBeLessThanOrEqual(world.y+world.height+1);}
    await stage(page).locator('.eq-client-shade').click();await settle(page);await capture(page,`${width}-transfer-controls-fit`);
  }
});

test('keyboard, reduced motion and 200 percent text retain usable main actions',async({page})=>{
  await page.setViewportSize({width:1024,height:768});await page.emulateMedia({reducedMotion:'reduce'});await join(page,'键盘舞台');await claim(page);
  await stage(page).locator('.eq-client-shade').focus();await page.keyboard.press('Enter');await settle(page);await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
  await stage(page).getByRole('button',{name:'听林工接着说 ▷',exact:true}).focus();await page.keyboard.press('Enter');await settle(page);
  await option(page,'calendar').focus();await page.keyboard.press('Tab');await expect(option(page,'current-light')).toBeFocused();
  await page.addStyleTag({content:'html{font-size:200% !important}'});
  await option(page,'current-light').scrollIntoViewIfNeeded();await expect(option(page,'current-light')).toBeInViewport();await capture(page,'1024-text-200');
  await page.keyboard.press('Enter');await settle(page);await expect(stage(page)).toHaveAttribute('data-stage-response','accepted');
  await next(page).scrollIntoViewIfNeeded();await expect(next(page)).toBeInViewport();await next(page).focus();await page.keyboard.press('Enter');await settle(page);
  await expect(stage(page)).toHaveAttribute('data-checkpoint-id','req-dark-action');
});

test('recorded own-work regression keeps actual comparison mapping in the reused change stage',async({page})=>{
  // Explicit regression fixture from E's actual mouse-built archive; not a blank-learner acceptance run.
  await page.setViewportSize({width:1280,height:720});await restoreRecordedWorkspace(page,{beforeStoryChange:true});await page.getByRole('button',{name:'看完结果，继续客户来信 →',exact:true}).click();await finishStory(page);
  await expect(stage(page)).toHaveAttribute('data-checkpoint-id','change-middle');await scene(page,'now-on');await next(page).click();await settle(page);
  await scene(page,'lamp-off');await next(page).click();await settle(page);
  await expect(stage(page)).toHaveAttribute('data-checkpoint-id','change-code-focus');
  await stage(page).getByRole('button',{name:'听林工接着说 ▷',exact:true}).click();await settle(page);await expect(stage(page)).toHaveAttribute('data-focus-target','choices');
  await capture(page,'1280-own-code-choices');
  await page.setViewportSize({width:1024,height:768});await capture(page,'1024-own-code-choices');
  const codeActions=await stage(page).locator('.eq-change-own-nodes').boundingBox();expect(codeActions.y+codeActions.height).toBeLessThan(680);
  await page.setViewportSize({width:1280,height:720});
  await stage(page).locator('[data-change-node="comparison"]').click();await expect(next(page)).toBeVisible();await settle(page);await capture(page,'1280-own-comparison');
  await next(page).click();await settle(page);await expect(stage(page)).toHaveAttribute('data-checkpoint-id','change-evidence');
  await expect(stage(page)).toContainText('26 条采样符合');await expect(stage(page)).toContainText('我刚找到的比较');await expect(stage(page)).toContainText('代码还没改');
  for(const selector of ['.eq-old-client-note','.eq-stage-choices','.eq-mentor-current-line']) {const rect=await stage(page).locator(selector).boundingBox();expect(rect.y).toBeGreaterThan(100);expect(rect.y+rect.height).toBeLessThan(650);}
  await capture(page,'1280-own-evidence');
  await page.setViewportSize({width:1024,height:768});await capture(page,'1024-own-evidence');
});

test('an explicit legacy no-journey archive can reopen the real review and operate its stage',async({page})=>{
  // Recorded own-work regression setup, not an independent beginner run.
  await page.setViewportSize({width:1024,height:768});await restoreRecordedWorkspace(page,{atBranches:true});
  await page.locator('[data-game-tool="mail"]').click();await stage(page).getByText('回看约定与记录',{exact:true}).click();
  await stage(page).getByRole('button',{name:'保留旧回答，重新核对本版',exact:true}).click();await settle(page);
  await expect(stage(page)).toHaveAttribute('data-checkpoint-id','req-light-input');await expect(stage(page)).toHaveAttribute('data-focus-target','explain');
  await stage(page).locator('.eq-client-shade').click();await settle(page);await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
  await scene(page,'current-light');await expect(stage(page)).toHaveAttribute('data-stage-response','accepted');await capture(page,'1024-legacy-review');
});

test('a one-time real IndexedDB write failure retains the scene and retries one original response',async({page})=>{
  // Fault injection exercises the native storage path; it never inserts a passing review.
  await page.setViewportSize({width:1280,height:720});await join(page,'保存恢复');await claim(page);
  await stage(page).locator('.eq-client-shade').click();await settle(page);
  await page.evaluate(()=>{const native=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=native;throw new DOMException('需求舞台专项的一次性写入故障','QuotaExceededError');};});
  await option(page,'current-light').click();await expect(stage(page)).toHaveAttribute('data-focus-target','recovery');
  await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');expect((await savedHandoff(page)).count).toBe(0);
  await capture(page,'1280-save-recovery');await stage(page).getByRole('button',{name:'重试保存这一步',exact:true}).click();await settle(page);
  await expect(stage(page)).toHaveAttribute('data-stage-response','accepted');await expect(stage(page).locator('[data-reading]')).toHaveAttribute('data-reading','150');
  expect(await savedHandoff(page)).toEqual({pending:true,count:1});
  // Native write errors must reach the recoverable UI without an uncaught event error.
  expect(browserErrors.get(page)).toEqual([]);
});
