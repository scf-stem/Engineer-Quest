import {test,expect} from '@playwright/test';
import {join,claim,requirements,read,finishStory} from './game-helpers.js';

const intro=page=>page.getByRole('region',{name:'图形化入门带教',exact:true});
const primary=page=>intro(page).locator('[data-intro-primary]');
async function phase(page,id){await expect(intro(page)).toHaveAttribute('data-phase',id);await expect.poll(async()=>!(await read(page)).controllerPending).toBe(true);}
async function startIntro(page,name='入门整合合成测试'){
  await join(page,name);await claim(page);await requirements(page);
  for(const [a,b] of [['uno:5V','sensor:VCC'],['uno:GND_1','sensor:GND'],['uno:A0','sensor:AO'],['uno:D9','resistor:1'],['resistor:2','led:A'],['led:K','uno:GND_2']]){
    for(const id of [a,b]){await page.locator(`[data-terminal="${id}"]`).focus();await page.keyboard.press('Enter');}
  }
  await page.getByRole('button',{name:'到程序台 →',exact:true}).click();await phase(page,'g0-start');
}
async function finishG0(page){
  await primary(page).click();await phase(page,'g0-demo');await primary(page).click();await phase(page,'g0-operation');
  await intro(page).getByRole('button',{name:'遮住光源',exact:true}).click();
  await intro(page).getByRole('button',{name:'当前光照读数',exact:true}).click();await intro(page).getByRole('button',{name:'灯的开关',exact:true}).click();
  await primary(page).click();await phase(page,'g0-success');await primary(page).click();await phase(page,'g1-start');
}
async function place(page,source,target){
  const editor=intro(page).getByRole('region',{name:'局部积木工作区',exact:true});
  if(!await editor.getByRole('combobox',{name:'选积木',exact:true}).isVisible())await editor.getByRole('button',{name:'点选放入',exact:true}).click();
  await editor.getByRole('combobox',{name:'选积木',exact:true}).selectOption(source);
  await editor.getByRole('combobox',{name:'选目标',exact:true}).selectOption(target);
  await editor.getByRole('button',{name:'3 预览放入',exact:true}).click();await editor.getByRole('button',{name:/^确认(放入|替换)$/,exact:true}).click();
  await expect.poll(async()=>!(await read(page)).controllerPending).toBe(true);
}
async function predict(page,on){await intro(page).getByRole('button',{name:on?'亮':'灭',exact:true}).click();}
async function booleanValue(page,on){
  const text=intro(page).locator('[data-teaching-block-id] .blocklyText').filter({hasText:on?'false · 关':'true · 开'}).first();
  await text.click();await page.locator('.blocklyMenuItem').filter({hasText:on?'true · 开':'false · 关'}).click();await expect.poll(async()=>!(await read(page)).controllerPending).toBe(true);
}
async function runStudent(page,on,to){await predict(page,on);await primary(page).click();await phase(page,to);}

test('new learner gets real G0 and mentor G1, with no whole-program replacement; pause/manual/refresh keep the operation',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:720});await startIntro(page);
  await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','unrun');
  await primary(page).click();await phase(page,'g0-demo');await expect(intro(page).locator('[data-intro-environment]')).toHaveText('170');
  await primary(page).click();await phase(page,'g0-operation');await intro(page).getByRole('button',{name:'遮住光源',exact:true}).click();
  await intro(page).getByRole('button',{name:'今天的日期',exact:true}).click();await primary(page).click();await phase(page,'g0-error');
  await expect(intro(page)).toHaveAttribute('data-focus','input');await primary(page).click();await phase(page,'g0-operation');
  await intro(page).getByRole('button',{name:'当前光照读数',exact:true}).click();await intro(page).getByRole('button',{name:'灯的开关',exact:true}).click();
  await primary(page).click();await phase(page,'g0-success');await primary(page).click();await phase(page,'g1-start');
  await intro(page).getByRole('button',{name:'灭',exact:true}).click();await primary(page).click();await phase(page,'g1-demo');
  await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','on');expect((await read(page)).practice.teachingId).toBe('observe-output');
  await primary(page).click();await phase(page,'g1-operation');await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','off');
  await intro(page).getByRole('button',{name:'亮',exact:true}).click();await primary(page).click();await phase(page,'g1-error');
  await expect(intro(page)).toContainText('还缺开或关');expect((await read(page)).baseReady).toBe(false);expect((await read(page)).income).toBe(0);
  await intro(page).getByRole('button',{name:'暂停',exact:true}).click();await expect(intro(page)).toHaveAttribute('data-paused','true');await page.reload();await phase(page,'g1-error');
  await expect(intro(page)).toHaveAttribute('data-paused','true');await page.getByRole('region',{name:'教学已暂停',exact:true}).getByRole('button',{name:'继续这一步',exact:true}).click();
  await intro(page).getByRole('button',{name:'本步图解',exact:true}).click();await expect(page.getByRole('article',{name:'当前入门操作图解'})).toContainText('P07');
  await page.getByRole('button',{name:'关闭对话框',exact:true}).click();await expect(intro(page)).toHaveAttribute('data-phase','g1-error');
  await page.screenshot({path:test.info().outputPath('g1-restored-error1280.png')});
  await page.setViewportSize({width:1024,height:768});const box=await primary(page).boundingBox();expect(box.y+box.height).toBeLessThan(700);
  await page.screenshot({path:test.info().outputPath('g1-restored-error1024.png')});expect(errors).toEqual([]);
});

test('own output, independent repeat, wait hold replay and two active reads restore before the legacy complete workbench',async({page})=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:900});await startIntro(page,'入门真实整段合成测试');await finishG0(page);
  await predict(page,false);await primary(page).click();await phase(page,'g1-demo');await primary(page).click();await phase(page,'g1-operation');
  await place(page,'tool:true','g1-lamp|VALUE');await runStudent(page,true,'g1-success-on');await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','on');
  await primary(page).click();await phase(page,'g1-try-off');await booleanValue(page,false);await runStudent(page,false,'g1-success-off');
  await primary(page).click();await phase(page,'g1-independent-on');await booleanValue(page,true);await runStudent(page,true,'g1-independent-on-done');
  await primary(page).click();await phase(page,'g1-independent-off');await booleanValue(page,false);await runStudent(page,false,'g1-independent-success');
  await primary(page).click();await phase(page,'g2-start');await predict(page,true);await primary(page).click();await phase(page,'g2-demo');
  await expect(intro(page)).toContainText('0ms 开灯');await expect(intro(page)).toContainText('0ms 关灯');await primary(page).click();await phase(page,'g2-operation');
  // A learner can recover a real wait accidentally placed before the first
  // output. Moving that same statement heals its old chain; no re-created answer.
  await place(page,'tool:wait','g2-on|previous');
  const misplacedWaitSource=await intro(page).getByRole('combobox',{name:'选积木'}).locator('optgroup[label="移动工作区已有积木"] option').filter({hasText:/^等待 ·/}).getAttribute('value');
  await place(page,misplacedWaitSource,'g2-on|next');
  const waitTarget=await intro(page).getByRole('combobox',{name:'选目标'}).locator('option').filter({hasText:/等待.*等多久/}).first().getAttribute('value');
  await place(page,'tool:number',waitTarget);await runStudent(page,false,'g2-success-hold');
  await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','on');await expect(intro(page)).toContainText('真实运行轨迹回放 · 300 ms');
  await page.screenshot({path:test.info().outputPath('g2-real-wait-hold.png')});
  await intro(page).getByRole('button',{name:'暂停',exact:true}).click();await page.reload();await phase(page,'g2-success-hold');await expect(intro(page)).toHaveAttribute('data-paused','true');
  await page.getByRole('region',{name:'教学已暂停'}).getByRole('button',{name:'返回研发室',exact:true}).click();await expect(page.getByRole('region',{name:'当前目标',exact:true})).toContainText('回放到等待中');await page.locator('[data-game-tool="blocks"]').click();await phase(page,'g2-success-hold');
  await page.getByRole('region',{name:'教学已暂停'}).getByRole('button',{name:'继续这一步',exact:true}).click();await intro(page).getByRole('button',{name:'回看下一时刻',exact:true}).click();await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','off');await expect(intro(page)).toContainText('回放到关灯以后');
  await intro(page).getByRole('button',{name:'0ms 等待600ms',exact:true}).click();await expect(intro(page)).toHaveAttribute('data-focus','primary');await primary(page).click();await phase(page,'g2-success-end');
  await expect(intro(page).locator('[data-intro-lamp]')).toHaveAttribute('data-intro-lamp','off');await primary(page).click();await phase(page,'g2-independent-operation');
  // Existing real statements are selected and placed; no workspace/state injection.
  await place(page,'block:g2-off','g2-on|previous');
  const waitSource=await intro(page).getByRole('combobox',{name:'选积木'}).locator('optgroup[label="移动工作区已有积木"] option').filter({hasText:/^等待 ·/}).getAttribute('value');
  await place(page,waitSource,'g2-off|next');
  await runStudent(page,true,'g2-independent-success');await primary(page).click();await phase(page,'g3-start');await primary(page).click();await phase(page,'g3-demo');
  await expect(intro(page).locator('[data-intro-sample]')).toHaveText('170');await primary(page).click();await phase(page,'g3-operation');
  await place(page,'tool:read','my-reading|VALUE');await intro(page).getByRole('button',{name:'移开遮挡',exact:true}).click();await expect(intro(page).locator('[data-intro-sample]')).toHaveText('170');
  await intro(page).getByRole('button',{name:/上次实际读到/}).click();await phase(page,'g3-error');await expect(intro(page)).toContainText('还没有新的读取事件');
  await primary(page).click();await phase(page,'g3-success');await expect(intro(page).locator('[data-intro-sample]')).toHaveText('820');
  await intro(page).getByRole('button',{name:/本次实际读取/}).click();await primary(page).click();await phase(page,'g3-transfer');
  await intro(page).getByRole('spinbutton',{name:'环境光照数值',exact:true}).fill('360');await expect(intro(page).locator('[data-intro-sample]')).toHaveText('820');
  await intro(page).getByRole('button',{name:'本步图解',exact:true}).click();await expect(page.getByRole('article',{name:'当前入门操作图解'})).toContainText('P09');await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
  await page.reload();await phase(page,'g3-transfer');await expect(intro(page).getByRole('spinbutton',{name:'环境光照数值',exact:true})).toHaveValue('360');await expect(intro(page).locator('[data-intro-sample]')).toHaveText('820');
  await primary(page).click();await phase(page,'g3-transfer-success');await expect(intro(page).locator('[data-intro-sample]')).toHaveText('360');
  for(const [width,height]of [[1280,720],[1024,768]]){await page.setViewportSize({width,height});await page.screenshot({path:test.info().outputPath(`g3-own-second-read-${width}.png`)});const r=await primary(page).boundingBox();expect(r.y+r.height).toBeLessThan(height-55);}
  await primary(page).click();await expect(page.locator('[data-story-scene="reading"]')).toBeVisible();
  // The actual legacy complete-program learning gate remains pending after prepared-frame reads.
  expect((await read(page)).practice.teachingId).toBe('read-input');expect((await read(page)).baseReady).toBe(false);expect((await read(page)).income).toBe(0);expect(errors).toEqual([]);
  await finishStory(page);await expect(page.locator('.eq-game-block-editor .blocklySvg')).toBeVisible();await expect(page.locator('.eq-game-block-editor .blocklyWorkspace .blocklyBlockCanvas > g[data-id]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'运行一次，查看实际读取',exact:true})).toBeDisabled();await expect(page.getByText('BLOCK_ROOT',{exact:false})).toHaveCount(0);
  await page.locator('[data-game-tool="wiring"]').click();await expect(page.locator('.eq-wire-current-goal')).toContainText('这里是回看');await page.getByRole('button',{name:'继续当前积木工作 →',exact:true}).click();
  await expect(page.getByRole('button',{name:'回看开关与读取练习',exact:true})).toBeVisible();await page.getByRole('button',{name:'回看开关与读取练习',exact:true}).click();await phase(page,'complete');
  await expect(intro(page).getByRole('combobox',{name:'回看入门运行记录'})).toBeVisible();await primary(page).click();await expect(page.locator('.eq-game-block-editor .blocklySvg')).toBeVisible();
});

test('root mouse drop, replacement and spare removal stay reversible; immediate refresh recovers the exact local value',async({page})=>{
  test.setTimeout(60000);await page.setViewportSize({width:1280,height:720});await startIntro(page,'实际拖放与快速恢复测试');await finishG0(page);
  await predict(page,true);await primary(page).click();await phase(page,'g1-demo');await primary(page).click();await phase(page,'g1-operation');
  const editor=intro(page).getByRole('region',{name:'局部积木工作区',exact:true});
  const tool=()=>editor.locator('.blocklyFlyout .blocklyBlockCanvas>g.blocklyDraggable').filter({hasText:'true · 开'}).first();
  const from=await tool().boundingBox(),canvas=await editor.locator('.eqt-editor-canvas').boundingBox();
  await page.mouse.move(from.x+35,from.y+15);await page.mouse.down();await page.mouse.move(from.x+45,from.y+25,{steps:4});await page.mouse.move(canvas.x+canvas.width-90,canvas.y+canvas.height-45,{steps:20});await page.mouse.up();
  await expect(editor.locator('[data-teaching-feedback]')).toContainText('尚未接上');await editor.getByRole('button',{name:'撤销一步',exact:true}).click();
  const source=await tool().boundingBox(),target=await editor.locator('[data-teaching-target]').boundingBox();
  await page.mouse.move(source.x+35,source.y+15);await page.mouse.down();await page.mouse.move(source.x+44,source.y+24,{steps:4});await page.mouse.move(target.x+target.width*.65+35,target.y+target.height/2+15-source.height/2,{steps:25});await page.mouse.up();
  await expect(editor.locator('[data-teaching-feedback]')).toContainText('已经接上');await runStudent(page,true,'g1-success-on');
  await primary(page).click();await phase(page,'g1-try-off');await place(page,'tool:false','g1-lamp|VALUE');await runStudent(page,false,'g1-error');await expect(intro(page)).toContainText('备用值');
  const spare=await editor.getByRole('combobox',{name:'选积木'}).locator('optgroup[label="移动工作区已有积木"] option').filter({hasText:'true · 开'}).getAttribute('value');
  await editor.getByRole('combobox',{name:'选积木'}).selectOption(spare);await editor.getByRole('button',{name:'移走未连接值',exact:true}).click();
  await editor.getByRole('button',{name:'撤销一步',exact:true}).click();await expect(editor.getByRole('combobox',{name:'选积木'}).locator(`option[value="${spare}"]`)).toHaveCount(1);
  await editor.getByRole('combobox',{name:'选积木'}).selectOption(spare);await editor.getByRole('button',{name:'移走未连接值',exact:true}).click();await runStudent(page,false,'g1-success-off');
  // Delay the native authoritative path; only the synchronous draft journal can bridge reload.
  await page.evaluate(()=>{crypto.subtle.digest=()=>new Promise(()=>{});});
  await editor.locator('[data-teaching-block-id] .blocklyText').filter({hasText:'false · 关'}).first().click();await page.locator('.blocklyMenuItem').filter({hasText:'true · 开'}).click();await page.reload();
  await phase(page,'g1-success-off');await expect(intro(page).locator('[data-teaching-block-id] .blocklyText').filter({hasText:'true · 开'})).toHaveCount(1);
  await expect(intro(page)).toContainText('修改前记录');expect((await read(page)).baseReady).toBe(false);expect((await read(page)).income).toBe(0);
  await page.screenshot({path:test.info().outputPath('own-drag-spare-and-immediate-refresh.png')});
});
