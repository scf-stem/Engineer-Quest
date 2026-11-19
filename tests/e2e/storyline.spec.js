import {test,expect} from '@playwright/test';
const read=async page=>{await page.waitForFunction(()=>typeof window.render_game_to_text==='function');return page.evaluate(()=>JSON.parse(window.render_game_to_text()));};
async function story(page){for(let i=0;i<30;i++){await expect.poll(async()=>!(await read(page)).pending).toBe(true);const panel=page.locator('.eq-cinematic');if(!await panel.isVisible())return;const next=panel.locator('.eq-cinematic-actions>button').first();await expect(next).toBeEnabled();await next.click();await expect.poll(async()=>!(await read(page)).pending).toBe(true);}throw new Error('剧情没有结束');}
async function start(page,name){await page.goto('/sandbox.html');await page.getByPlaceholder('不需要真实姓名').fill(name);await page.getByRole('button',{name:'领取本机个人员工证 →',exact:true}).click();await expect(page.locator('[data-story-scene="welcome"]')).toBeVisible();}

test('new employee is greeted automatically; line/pause restore; future tools do not redirect; profiles and replay retain own work',async({page})=>{
  await start(page,'主线甲');const id=(await read(page)).learnerId;
  await page.getByRole('button',{name:'下一句 ▷',exact:true}).click();await expect(page.locator('.eq-cinematic-speech>p')).toContainText('校园科技展台缺一盏灯');await page.reload();
  await expect(page.locator('.eq-cinematic-speech>p')).toContainText('校园科技展台缺一盏灯');
  await page.getByRole('button',{name:'暂停，稍后继续',exact:true}).click();
  await page.locator('.eq-story-tool-cabinet summary').click();await page.locator('[data-locked-tool="code"]').click();
  expect((await read(page)).view).toBe('desk');expect((await read(page)).stage).toBe('claim-order');
  await expect(page.locator('.eq-game-feedback')).toContainText('保留自己的基础积木');
  await page.locator('.eq-story-resume').click();await story(page);
  await expect(page.getByRole('button',{name:'向林工领取订单 →',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'向林工领取订单 →',exact:true}).click();await story(page);
  await page.getByRole('button',{name:'一起翻手册 §03.1 ↗',exact:true}).click();
  await expect(page.getByRole('article',{name:'当前任务图解'})).toContainText('灯怎样知道桌面暗了');
  await expect(page.locator('.eq-field-page')).not.toContainText('解析器');await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
  await expect(page.locator('[data-option-id="current-light"]')).toBeVisible();
  await page.getByRole('button',{name:'主线甲 · 员工菜单',exact:true}).click();await page.getByRole('button',{name:'重看入职培训',exact:true}).click();await story(page);
  expect((await read(page)).learnerId).toBe(id);expect((await read(page)).stage).toBe('requirements');
  await page.getByRole('button',{name:'主线甲 · 员工菜单',exact:true}).click();await page.getByRole('button',{name:'保存并返回员工选择',exact:true}).click();
  await page.getByRole('button',{name:'新员工报到 →',exact:true}).click();await page.getByPlaceholder('不需要真实姓名').fill('主线乙');await page.getByRole('button',{name:'领取本机个人员工证 →',exact:true}).click();await story(page);
  expect((await read(page)).learnerId).not.toBe(id);expect((await read(page)).stage).toBe('claim-order');
  await page.getByRole('button',{name:'主线乙 · 员工菜单',exact:true}).click();await page.getByRole('button',{name:'保存并返回员工选择',exact:true}).click();
  await page.getByRole('button',{name:/主线甲 本机工位 1.*继续这个工位/ }).click();expect((await read(page)).learnerId).toBe(id);expect((await read(page)).stage).toBe('requirements');
  await expect(page.getByRole('region',{name:'客户桌面 · 手动演示'})).toBeVisible();
  const desk=await page.getByRole('region',{name:'客户桌面 · 手动演示'}).boundingBox();expect(desk.y+desk.height).toBeLessThan(675);
  await page.screenshot({path:test.info().outputPath('restored-client-desk.png'),animations:'disabled'});
});

test('normal wiring is pending, wrong A1 is specific, and the new G0 entry retains pause and manual context',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await start(page,'主线接线');await story(page);await page.getByRole('button',{name:'向林工领取订单 →',exact:true}).click();await story(page);
  for(const value of ['current-light','lamp-on','lamp-off','read-decide-repeat','lamp-off','trace-b']){
    await page.locator(`[data-option-id="${value}"]`).click();
    await page.locator('[data-scene-continue]').click();if(value==='trace-b'){await expect(page.locator('[data-story-scene="wiring"]')).toBeVisible();await story(page);}
  }
  const wire=async(a,b)=>{await page.locator(`[data-terminal="${a}"]`).focus();await page.keyboard.press('Enter');await page.locator(`[data-terminal="${b}"]`).focus();await page.keyboard.press('Enter');};
  await wire('uno:5V','sensor:VCC');await expect(page.locator('.eq-hw-state')).toContainText('继续接线');await expect(page.locator('.eq-hw-state')).not.toContainText('待修复');
  await wire('uno:GND_1','sensor:GND');await wire('sensor:AO','uno:A1');await expect(page.locator('.eq-wire-current-goal')).toContainText('这份程序从 A0 读');
  await page.getByRole('button',{name:'↶ 撤销',exact:true}).click();await wire('sensor:AO','uno:A0');
  for(const [a,b]of [['uno:D9','resistor:1'],['resistor:2','led:A'],['led:K','uno:GND_2']])await wire(a,b);
  await page.getByRole('button',{name:'到程序台 →',exact:true}).click();const intro=page.getByRole('region',{name:'图形化入门带教',exact:true});await expect(intro).toHaveAttribute('data-phase','g0-start');
  await intro.getByRole('button',{name:'本步图解',exact:true}).click();await expect(page.getByRole('article',{name:'当前入门操作图解'})).toContainText('P07');
  await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
  await expect(intro).toHaveAttribute('data-phase','g0-start');await page.screenshot({path:test.info().outputPath('1280-first-g0.png'),animations:'disabled'});
  await intro.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('region',{name:'教学已暂停'}).getByRole('button',{name:'返回研发室',exact:true}).click();
  await page.locator('[data-game-tool="blocks"]').click();await expect(intro).toHaveAttribute('data-paused','true');await page.getByRole('region',{name:'教学已暂停'}).getByRole('button',{name:'继续这一步',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:test.info().outputPath('1440-first-g0.png'),animations:'disabled'});
  expect((await read(page)).practice.teachingId).toBe('observe-output');expect((await read(page)).income).toBe(0);
});

test('unregistered entry returns after refresh and same-named workstations stay distinguishable without replacing original work',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await start(page,'同名本机工位');const firstId=(await read(page)).learnerId;
  await page.getByRole('button',{name:'下一句 ▷',exact:true}).click();
  await page.getByRole('button',{name:'暂停，稍后继续',exact:true}).click();
  await page.getByRole('button',{name:'同名本机工位 · 员工菜单',exact:true}).click();
  await page.getByRole('button',{name:'保存并返回员工选择',exact:true}).click();
  await page.getByRole('button',{name:'新员工报到 →',exact:true}).click();
  await expect(page.getByPlaceholder('不需要真实姓名')).toBeVisible();
  await page.reload();
  const back=page.getByRole('button',{name:'返回员工选择，继续原作品',exact:true});
  await expect(back).toBeInViewport();await expect(page.locator('.eq-game-entry')).toContainText('输入相同昵称也不会找回旧作品');
  await back.click();
  await page.getByRole('button',{name:/同名本机工位 本机工位 1.*继续这个工位/}).click();
  expect((await read(page)).learnerId).toBe(firstId);await expect(page.locator('.eq-story-resume')).toBeVisible();
  await page.getByRole('button',{name:'同名本机工位 · 员工菜单',exact:true}).click();await page.getByRole('button',{name:'保存并返回员工选择',exact:true}).click();
  await page.getByRole('button',{name:/新员工 · 待报到 本机工位 2.*继续领取员工证/}).click();
  await page.getByPlaceholder('不需要真实姓名').fill('同名本机工位');await page.getByRole('button',{name:'领取本机个人员工证 →',exact:true}).click();
  await expect(page.locator('.eq-cinematic')).toBeVisible();expect((await read(page)).learnerId).not.toBe(firstId);
  await page.getByRole('button',{name:'暂停，稍后继续',exact:true}).click();await page.getByRole('button',{name:'同名本机工位 · 员工菜单',exact:true}).click();await page.getByRole('button',{name:'保存并返回员工选择',exact:true}).click();
  await expect(page.getByRole('button',{name:/同名本机工位 本机工位 1.*领证.*继续这个工位/})).toBeVisible();
  await expect(page.getByRole('button',{name:/同名本机工位 本机工位 2.*领证.*继续这个工位/})).toBeVisible();
  await page.screenshot({path:test.info().outputPath('same-named-distinct-workstations.png'),animations:'disabled'});
  await page.getByRole('button',{name:/同名本机工位 本机工位 1.*继续这个工位/}).click();expect((await read(page)).learnerId).toBe(firstId);
  await page.locator('.eq-story-resume').click();await expect(page.locator('.eq-cinematic-speech>p')).toContainText('校园科技展台缺一盏灯');
});
