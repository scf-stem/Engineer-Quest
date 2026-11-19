import {expect} from '@playwright/test';
export const tool=(page,id)=>({click:async()=>{const visible=page.locator(`[data-game-tool="${id}"]`);if(await visible.isVisible())return visible.click();const locked=page.locator(`[data-locked-tool="${id}"]`);if(await locked.count()){if(!await locked.isVisible())await page.locator('.eq-story-tool-cabinet summary').click();await locked.click();await page.locator('.eq-story-tool-cabinet summary').click();return;}return visible.click();}});
export const read=async page=>{await page.waitForFunction(()=>typeof window.render_game_to_text==='function');return page.evaluate(()=>JSON.parse(window.render_game_to_text()));};
export async function finishStory(page){for(let i=0;i<30;i++){await expect.poll(async()=>!(await read(page)).pending).toBe(true);const panel=page.locator('.eq-cinematic');if(!await panel.isVisible())return;await panel.locator('.eq-cinematic-actions>button').first().click();}throw new Error('剧情未完成');}
export async function join(page,name='本机界面测试'){await page.goto('/sandbox.html');await page.getByPlaceholder('不需要真实姓名').fill(name);await page.getByRole('button',{name:'领取本机个人员工证 →',exact:true}).click();await expect(page.locator('[data-story-scene="welcome"]')).toBeVisible();await finishStory(page);await tool(page,'desk').click();await expect(page.getByRole('region',{name:'当前目标'})).toHaveAttribute('data-goal-id','claim-order');}
export async function claim(page){await tool(page,'mail').click();await page.getByRole('button',{name:'向林工领取订单 →',exact:true}).click();await expect.poll(async()=>(await read(page)).stage).toBe('requirements');await finishStory(page);}
// Explicit regression choices; production rules still replay each actual response.
export async function answerScene(page,optionId){
  const retry=page.getByRole('button',{name:'我再操作一下，重新试试',exact:true});if(await retry.isVisible())await retry.click();
  await page.locator(`.eq-requirement-practice [data-option-id="${optionId}"]`).click();
  const next=page.locator('[data-scene-continue]');await expect.poll(async()=>await next.isVisible()||await page.locator('.eq-cinematic').isVisible()).toBe(true);
  if(await page.locator('.eq-cinematic').isVisible())return finishStory(page);
  await expect(next).toBeEnabled();await next.click();
}
export async function requirements(page){
  for(const value of ['current-light','lamp-on','lamp-off','read-decide-repeat','lamp-off','trace-b'])await answerScene(page,value);
  await expect.poll(async()=>(await read(page)).stage).toBe('wiring');await expect(page.locator('[data-story-scene="wiring"]')).toBeVisible();await finishStory(page);
}
export async function setRequirementQuestion(page,text){
  await page.locator('.eq-requirement-stage').getByRole('button',{name:'求助',exact:true}).click();
  const help=page.getByRole('dialog',{name:'和林工一起看这一步',exact:true});
  await help.getByRole('textbox',{name:'告诉林工卡在哪里（选填）',exact:true}).fill(text);
  await help.getByRole('button',{name:'关闭对话框',exact:true}).click();
  await expect.poll(async()=>!(await read(page)).pending).toBe(true);
}
export async function expectRequirementQuestion(page,text){
  await page.locator('.eq-requirement-stage').getByRole('button',{name:'求助',exact:true}).click();
  const help=page.getByRole('dialog',{name:'和林工一起看这一步',exact:true});
  await expect(help.getByRole('textbox',{name:'告诉林工卡在哪里（选填）',exact:true})).toHaveValue(text);
  await help.getByRole('button',{name:'关闭对话框',exact:true}).click();
}
