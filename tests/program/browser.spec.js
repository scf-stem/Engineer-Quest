import {test,expect} from '@playwright/test';
test.use({viewport:{width:1450,height:1800}});
const source='int light = 0; void loop() { light = readAnalog(LIGHT); if(light < 450) { writeDigital(LAMP,true); } else { writeDigital(LAMP,false); } waitMs(100); }';
const hold='int light = 0; void loop() { light = readAnalog(LIGHT); if(light < 400) { writeDigital(LAMP,true); } if(light > 600) { writeDigital(LAMP,false); } waitMs(100); }';
const category=(page,text)=>page.locator('.blocklyToolboxCategory').filter({hasText:text});
const fly=(page,type)=>page.locator(`.blocklyFlyout g.${type}`).first();
const main=(page,type)=>page.locator(`#workspace g.${type}:not(.blocklyFlyout *)`).first();
async function drag(page,locator,x,y){const box=await locator.boundingBox();await page.mouse.move(box.x+25,box.y+15);await page.mouse.down();await page.mouse.move(x,y,{steps:20});await page.mouse.up();}
async function predictAndRun(page,on){await page.getByLabel(on?'我预测灯会亮':'我预测灯会灭',{exact:true}).check();await page.getByRole('button',{name:'记录当前版本预测'}).click();await expect(page.locator('#prediction-status')).toContainText('已记录当前版本预测');await page.getByRole('button',{name:'运行当前练习',exact:true}).click();}

test('from blank pointer construction to mapping, real failed stale read, inspected repair and stateful transfer',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/src/program/demo.html');
  await expect(page.locator('#guidance')).toContainText('从一块程序入口开始');await expect(page.getByRole('status')).not.toContainText('BLOCK_ROOT');
  await page.getByRole('button',{name:'运行当前练习',exact:true}).click();await expect(page.getByRole('status')).toContainText('不需要加载完整答案');
  await page.locator('#workspace').scrollIntoViewIfNeeded();await category(page,'变量与流程').click();
  const host=await page.locator('#workspace').boundingBox();await drag(page,fly(page,'eqp_program'),host.x+280,host.y+70);
  await expect(page.locator('#guidance')).toContainText('让入口里面有一个动作');
  let root=await main(page,'eqp_program').locator('path.blocklyPath').first().boundingBox();
  await category(page,'输出').click();await drag(page,fly(page,'eqp_write'),root.x+103,root.y+113);
  await expect(page.locator('#guidance')).toContainText('少了一块值积木');
  let write=await main(page,'eqp_write').boundingBox();await category(page,'输入与判断').click();await drag(page,fly(page,'logic_boolean'),write.x+write.width+10,write.y+18);
  await expect(page.locator('#guidance')).toContainText('结构可以运行');
  write=await main(page,'eqp_write').boundingBox();await category(page,'时间与循环').click();await drag(page,fly(page,'eqp_wait'),write.x+25,write.y+write.height+10);
  await expect(page.locator('#guidance')).toContainText('毫秒');
  const wait=await main(page,'eqp_wait').boundingBox();await category(page,'输入与判断').click();await drag(page,fly(page,'math_number'),wait.x+wait.width+10,wait.y+18);
  await main(page,'math_number').locator('.blocklyNumberField').dblclick();await page.locator('input.blocklyHtmlInput').fill('100');await page.locator('input.blocklyHtmlInput').press('Enter');
  await page.getByRole('button',{name:'保存积木快照并对照轻代码'}).click();
  const editor=page.getByLabel('教学代码（修改后需重新运行）');expect(await editor.inputValue()).toContain('waitMs(100)');
  const outputOption=await page.locator('#map-node option').filter({hasText:'设置 LAMP'}).getAttribute('value');await page.locator('#map-node').selectOption(outputOption);await expect(page.locator('#map-meaning')).toContainText('保持该状态');
  await predictAndRun(page,true);await expect(page.getByRole('status')).toContainText('行为符合固定场景');await expect(page.locator('#progress li').first()).toContainText('过程证据已记录');
  await page.screenshot({path:testInfo.outputPath('from-blank-first-output.png'),fullPage:true});
  await page.locator('#exercise').selectOption('follow-light');await editor.fill(source);await predictAndRun(page,false);await expect(page.getByRole('status')).toContainText('行为符合固定场景');
  await page.locator('#exercise').selectOption('repair-stale-read');await page.getByRole('button',{name:'打开含故障的练习代码'}).click();await predictAndRun(page,true);
  await expect(page.getByRole('status')).toContainText('不符合预期');await expect(page.locator('#counterexamples')).toContainText('最近一次读取在 0ms');
  await page.getByRole('button',{name:'查看最近一次读取',exact:true}).first().click();await expect(page.locator('#event')).toContainText('0ms · 读取输入');
  expect(await editor.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('readAnalog(LIGHT)');
  await page.screenshot({path:testInfo.outputPath('inspected-stale-read.png'),fullPage:true});
  await editor.fill(source);await predictAndRun(page,false);await expect(page.getByRole('status')).toContainText('行为符合固定场景');await expect(page.locator('#progress li').nth(2)).toContainText('过程证据已记录');
  await page.locator('#exercise').selectOption('hold-between-bounds');await predictAndRun(page,true);await expect(page.getByRole('status')).toContainText('不符合预期');
  await editor.fill(hold);await predictAndRun(page,true);await expect(page.getByRole('status')).toContainText('行为符合固定场景');await expect(page.locator('#review')).toContainText('不是理解或独立完成的证明');
  await expect(page.locator('#assertions tr')).toHaveCount(7);await expect(page.locator('#origin')).toContainText('未记录完整参考');await expect(page.locator('#attempt-history')).toContainText('"behaviorPassed": false');
  await page.getByRole('button',{name:'查看对应 Arduino 源码'}).click();await expect(page.locator('#toolchain')).toContainText('not_run');
  await page.setViewportSize({width:900,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('viewing the complete reference stays assisted and cannot complete all practice',async({page})=>{
  await page.goto('/src/program/demo.html');await page.locator('#exercise').selectOption('follow-light');await page.getByRole('button',{name:'查看完整参考（记录协助）'}).click();
  await expect(main(page,'eqp_program')).toBeVisible();await page.getByRole('button',{name:'保存积木快照并对照轻代码'}).click();await predictAndRun(page,false);
  await expect(page.getByRole('status')).toContainText('已使用完整参考');await expect(page.locator('#review')).toContainText('不会自动完成练习');await expect(page.locator('#progress li').nth(2)).toContainText('待预测与运行');
  const editor=page.getByLabel('教学代码（修改后需重新运行）');await editor.fill((await editor.inputValue()).replace('450','400'));await expect(page.locator('#origin')).toContainText('后续编辑仍保留协助记录');await expect(page.getByRole('button',{name:'查看对应 Arduino 源码'})).toBeDisabled();
});
