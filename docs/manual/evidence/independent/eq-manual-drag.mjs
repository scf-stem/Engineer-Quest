import {chromium} from '/Users/limou/Desktop/Engineer-Quest/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage({viewport:{width:1600,height:1200}});await page.goto('http://127.0.0.1:5194');
await page.getByPlaceholder('不需要真实姓名').fill('手册独立审查');await page.getByRole('button',{name:'领取个人员工证 →',exact:true}).click();await page.getByRole('button',{name:'向林工领取订单 →',exact:true}).click();
for(const [label,value] of Object.entries({'装置读取什么':'light-sensor','按什么规则判断':'below-customer-threshold','明暗分别怎样做':'dark-on-bright-off','演示过程中怎样工作':'repeat-read-decide'}))await page.getByLabel(label,{exact:true}).selectOption(value);
await page.getByLabel('用自己的话说明一次从暗到亮、再变暗的过程').fill('持续读取光照，小于450开灯，否则关灯，光照变化时重新判断。');await page.getByRole('button',{name:'保存方案卡，查看静态问题',exact:true}).click();await page.getByRole('button',{name:'进入虚拟实验 →',exact:true}).click();
for(const [a,b] of [['uno:5V','sensor:VCC'],['uno:GND_1','sensor:GND'],['sensor:AO','uno:A0'],['uno:D9','resistor:1'],['resistor:2','led:A'],['led:K','uno:GND_2']]){await page.locator(`[data-terminal="${a}"]`).click();await page.locator(`[data-terminal="${b}"]`).click();}
console.log('wiring:',await page.locator('.eq-hw-state').innerText());await page.getByRole('button',{name:'进入积木编程 →',exact:true}).click();await page.locator('.blocklyToolboxCategory').filter({hasText:'变量与流程'}).click();
console.log(await page.locator('.blocklyFlyout .blocklyDraggable').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,bounds:JSON.stringify(n.getBoundingClientRect().toJSON())}))));
await page.screenshot({path:'/tmp/eq-manual-before-drag.png',fullPage:true});
const blocks=page.locator('.blocklyFlyout .blocklyDraggable');const root=blocks.filter({hasText:'持续执行'}).first();const box=await root.boundingBox();const canvas=await page.locator('.blocklySvg').first().boundingBox();console.log({box,canvas});await page.mouse.move(box.x+50,box.y+20);await page.mouse.down();await page.mouse.move(canvas.x+500,box.y+20,{steps:20});await page.mouse.up();await page.waitForTimeout(300);await page.screenshot({path:'/tmp/eq-manual-after-root.png',fullPage:true});
console.log('root placed:',await page.locator('.blocklyMainBackground').count());console.log('main blocks',await page.locator('.blocklyWorkspace .blocklyBlockCanvas').first().innerText().catch(()=>''));

const mainBounds=await page.locator('.blocklyDraggable').evaluateAll(ns=>ns.filter(n=>!n.closest('.blocklyFlyout')&&n.textContent.includes('持续执行')).map(n=>n.getBoundingClientRect().toJSON()));console.log('mainBounds',mainBounds);
await page.locator('.blocklyToolboxCategory').filter({hasText:'变量与流程'}).click();
const decl=page.locator('.blocklyFlyout .blocklyDraggable').filter({hasText:'声明'}).first();const db=await decl.boundingBox();const rb=mainBounds[0];await page.mouse.move(db.x+20,db.y+10);await page.mouse.down();await page.mouse.move(rb.x+100,rb.y+22,{steps:30});await page.mouse.up();await page.waitForTimeout(300);await page.screenshot({path:'/tmp/eq-manual-declaration.png',fullPage:true});
console.log('notes',await page.locator('.eq-fine-print').allInnerTexts());

await page.locator('.blocklyToolboxCategory').filter({hasText:'变量与流程'}).click();
const assign=page.locator('.blocklyFlyout .blocklyDraggable').filter({hasText:'变量light设为'}).first();const ab=await assign.boundingBox();await page.mouse.move(ab.x+20,ab.y+10);await page.mouse.down();await page.mouse.move(rb.x+100,rb.y+100,{steps:30});await page.mouse.up();await page.waitForTimeout(300);await page.screenshot({path:'/tmp/eq-manual-assignment.png',fullPage:true});console.log('assignment notes',await page.locator('.eq-fine-print').allInnerTexts());await browser.close();
