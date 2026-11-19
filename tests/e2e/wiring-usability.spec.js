import {test,expect} from '@playwright/test';
import {join,claim,tool,read,requirements,finishStory} from './game-helpers.js';

test('uncompleted scenarios block shortcuts; six keyboard wires open the G0 entry without a prefilled complete program',async({page})=>{
  await page.setViewportSize({width:1265,height:950});await join(page);await claim(page);
  await tool(page,'wiring').click();await expect(page.locator('.eq-hardware')).toHaveCount(0);
  await expect(page.locator('.eq-stage-heading')).toContainText('1 / 6 / 窗边与阴影');
  await requirements(page);await expect(page.locator('.eq-hardware')).toBeVisible();
  await expect(page.locator('.eq-hw-state')).toContainText('待连接');
  for(const [a,b]of [['uno:5V','sensor:VCC'],['uno:GND_1','sensor:GND'],['uno:A0','sensor:AO'],['uno:D9','resistor:1'],['resistor:2','led:A'],['led:K','uno:GND_2']]){
    await page.locator(`[data-terminal="${a}"]`).focus();await page.keyboard.press('Enter');
    await page.locator(`[data-terminal="${b}"]`).focus();await page.keyboard.press('Enter');
  }
  await expect.poll(async()=>(await read(page)).wiring.valid).toBe(true);await finishStory(page);await page.getByRole('button',{name:'到程序台 →',exact:true}).click();
  await expect(page.getByRole('region',{name:'图形化入门带教',exact:true})).toHaveAttribute('data-phase','g0-start');
  await expect(page.getByRole('button',{name:'加载教学示例（记录协助）',exact:true})).toHaveCount(0);
  await expect(page.locator('.blocklySvg')).toHaveCount(0);
  await expect(page.getByText('BLOCK_ROOT',{exact:false})).toHaveCount(0);
  expect((await read(page)).practice.teachingId).toBe('observe-output');
  expect((await read(page)).baseReady).toBe(false);expect((await read(page)).income).toBe(0);
  await page.screenshot({path:test.info().outputPath('new-g0-no-autofilled-program.png')});
});
