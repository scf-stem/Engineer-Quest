import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const evidence=process.env.WORKBENCH_EVIDENCE_DIR??'/tmp/eq-workbench-repair';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH??'/Users/limou/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const settle=()=>page.waitForTimeout(180),shot=name=>page.screenshot({path:`${evidence}/${name}.png`});
const check=(name,result)=>{assert.ok(result,name);checks.push(name);console.log(`PASS ${name}`);};
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const chain=()=>page.evaluate(()=>{const ids=[];let b=window.workbenchTest.workspace().getBlockById('root').getInputTargetBlock('LOOP');while(b){ids.push(b.id);b=b.getNextBlock();}return ids;});
async function restore(options){await page.evaluate(options=>window.workbenchTest.restore(window.workbenchTest.fixture(options)),options);await settle();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle();}
const targetSelect=()=>page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true});
async function selectTarget(id){await targetSelect().selectOption(id);await settle();}
async function step(source,target,{confirm=true,mode='single'}={}){
  if(!await page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}).isVisible())await page.getByRole('button',{name:'点选移动 / 插入',exact:true}).click();
  await page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}).selectOption(source);
  await page.getByRole('combobox',{name:'移动语句的范围',exact:true}).selectOption(mode);
  await selectTarget(target);await page.getByRole('button',{name:'2 预览连接',exact:true}).click();await settle();
  if(confirm){await page.getByRole('button',{name:/^确认(连接|替换)$/}).click();await settle();}
}
async function point(id,port){return page.evaluate(({id,port})=>{const block=window.workbenchTest.workspace().getBlockById(id),connection=port==='previous'?block.previousConnection:port==='next'?block.nextConnection:port==='output'?block.outputConnection:block.getInput(port).connection;const p=connection.getOffsetInBlock(),tip=new DOMPoint(p.x,p.y).matrixTransform(block.getSvgRoot().getScreenCTM()),box=block.getSvgRoot().getBoundingClientRect();return {x:tip.x,y:tip.y,grabX:box.x+(block.type==='controls_if'?55:18),grabY:box.y+(block.type==='controls_if'?12:5)};},{id,port});}
async function drag(fromId,fromPort,toId,toPort,name){
  const from=await point(fromId,fromPort),to=await point(toId,toPort);
  await page.mouse.move(from.grabX,from.grabY);await page.mouse.down();await page.mouse.move(from.grabX+9,from.grabY+9,{steps:3});await page.waitForTimeout(80);
  await page.mouse.move(from.grabX+to.x-from.x,from.grabY+to.y-from.y,{steps:25});await page.waitForTimeout(160);
  const markers=await page.locator('.blocklyInsertionMarker').count();if(name)await shot(name);
  await page.mouse.up();await settle();return markers;
}
try{
  await page.goto(process.env.WORKBENCH_TEST_URL??'http://127.0.0.1:5242/tests/workbench-repair/harness.html');await page.waitForFunction(()=>window.workbenchTest?.workspace());await settle();
  check('initialization is never reported as a student edit',(await state()).edits===0);
  const workspaceId=await page.evaluate(()=>window.workbenchTest.workspace().id);
  const options=await targetSelect().locator('option').evaluateAll(options=>options.map(option=>option.value));
  check('LOOP DO0 ELSE and both insertion boundaries are discoverable',['root|LOOP','if|DO0','if|ELSE','read|@after','wait|@before'].every(id=>options.includes(id)));
  await selectTarget('read|@after');await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle();
  check('selected statement target has a visible native exact highlight',await page.locator('[data-eq-exact-target=true]').count()===1);
  const markers=await drag('if','previous','read','next','01-native-if-insertion-preview');
  check('native drag displays a real Blockly insertion marker',markers>0);
  check('native if insertion changes read wait if to read if wait',JSON.stringify(await chain())===JSON.stringify(['read','if','wait']));
  check('controlled draft echo preserves the same workspace',workspaceId===await page.evaluate(()=>window.workbenchTest.workspace().id));
  await shot('02-native-if-inserted-1280');
  await selectTarget('if|DO0');await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle();
  await drag('on','previous','if','DO0','03-native-upper-branch-preview');
  check('native output attaches to the DO0 statement input',await page.evaluate(()=>window.workbenchTest.workspace().getBlockById('if').getInputTargetBlock('DO0')?.id==='on'));
  await selectTarget('if|ELSE');await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle();
  await drag('off','previous','if','ELSE','04-native-else-preview');
  check('native output attaches to ELSE and preserves upper branch',await page.evaluate(()=>{const b=window.workbenchTest.workspace().getBlockById('if');return b.getInputTargetBlock('ELSE')?.id==='off'&&b.getInputTargetBlock('DO0')?.id==='on';}));
  await shot('05-two-branches-connected');
  const completed=(await state()).workspace;
  await page.getByRole('button',{name:'撤销一步',exact:true}).click();await settle();
  check('native branch undo restores the loose output and leaves the other branch',await page.evaluate(()=>{const w=window.workbenchTest.workspace(),b=w.getBlockById('if');return !b.getInputTargetBlock('ELSE')&&b.getInputTargetBlock('DO0').id==='on'&&!w.getBlockById('off').getParent();}));
  await step('block:off','if|ELSE');
  check('point selection attaches the same existing output to ELSE',await page.evaluate(()=>window.workbenchTest.workspace().getBlockById('off').getParent().id==='if'));
  await step('block:if','wait|@after');
  check('single-statement move can target its original next chain',JSON.stringify(await chain())===JSON.stringify(['read','wait','if']));
  check('single move retains both branch trees',await page.evaluate(()=>{const b=window.workbenchTest.workspace().getBlockById('if');return b.getInputTargetBlock('DO0').id==='on'&&b.getInputTargetBlock('ELSE').id==='off';}));
  await step('block:if','read|@after');
  check('point selection repairs read wait if without losing wait100',JSON.stringify(await chain())===JSON.stringify(['read','if','wait'])&&await page.evaluate(()=>window.workbenchTest.workspace().getBlockById('duration').getFieldValue('NUM')===100));
  await shot('06-point-repair-with-branches');
  await page.getByRole('button',{name:'撤销一步',exact:true}).click();await settle();
  check('one real undo restores the entire previous statement graph',JSON.stringify(await chain())===JSON.stringify(['read','wait','if']));
  check('undo reports origin edit for the existing host save contract',await page.evaluate(()=>window.workbenchTest.changes.at(-1).origin==='edit'));
  await step('block:if','wait|@before');
  check('before target also inserts between read and wait',JSON.stringify(await chain())===JSON.stringify(['read','if','wait']));
  await step('block:if','on|@after',{confirm:false});
  check('a genuine self cycle through a branch is rejected',await page.locator('[data-block-snap]').textContent().then(text=>text.includes('自己')));
  await step('block:threshold','if|DO0',{confirm:false});
  check('value-to-statement mistake is explained without changing graph',await page.locator('[data-block-snap]').textContent().then(text=>text.includes('下一句动作'))&&JSON.stringify(await chain())===JSON.stringify(['read','if','wait']));
  const beforeReplace=(await state()).workspace;
  await step('tool:math_number','wait|MS',{confirm:false});
  check('occupied value preview preserves the original 100',await page.evaluate(()=>window.workbenchTest.workspace().getBlockById('wait').getInputTargetBlock('MS').id==='duration'));
  await shot('07-value-replacement-preview');await page.getByRole('button',{name:'取消预览',exact:true}).click();await settle();
  check('replacement cancel leaves the exact serialized work untouched',JSON.stringify((await state()).workspace)===JSON.stringify(beforeReplace));
  await step('tool:math_number','wait|MS');
  check('replacement retains the old value loose and uses the chosen new block',await page.evaluate(()=>{const w=window.workbenchTest.workspace();return w.getBlockById('wait').getInputTargetBlock('MS').getFieldValue('NUM')===0&&!w.getBlockById('duration').getParent();}));
  await page.getByRole('button',{name:'撤销一步',exact:true}).click();await settle();
  check('native grouped undo restores replaced value and removes new block',JSON.stringify((await state()).workspace)===JSON.stringify(beforeReplace));
  const editCount=(await state()).edits;
  await page.evaluate(next=>window.workbenchTest.restore(next),completed);await settle();
  check('external restore preserves exact graph and creates no student edit',(await state()).edits===editCount&&JSON.stringify((await state()).workspace)===JSON.stringify(completed));
  check('external restore keeps the existing workspace object',workspaceId===await page.evaluate(()=>window.workbenchTest.workspace().id));
  await step('block:if','wait|@after');
  await page.getByRole('button',{name:'撤销一步',exact:true}).focus();await page.keyboard.press('Control+z');await settle();
  check('keyboard undo also synchronizes the native graph',JSON.stringify(await chain())===JSON.stringify(['read','if','wait']));
  const undoCount=await page.evaluate(()=>window.workbenchTest.workspace().getUndoStack().length);
  await page.evaluate(()=>window.workbenchTest.readOnly(true));await settle();await page.evaluate(()=>window.workbenchTest.readOnly(false));await settle();
  check('read-only view toggles preserve workspace and same-session native undo',workspaceId===await page.evaluate(()=>window.workbenchTest.workspace().id)&&undoCount===await page.evaluate(()=>window.workbenchTest.workspace().getUndoStack().length));
  await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle();
  const field=await page.evaluate(()=>{const r=window.workbenchTest.workspace().getBlockById('threshold').getField('NUM').getSvgRoot().getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.dblclick(field.x,field.y);await page.locator('input.blocklyHtmlInput').fill('451');await page.locator('input.blocklyHtmlInput').press('Enter');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem(window.workbenchTest.key)).blocks.blocks[0].inputs.LOOP.block.next.block.inputs.IF0.block.inputs.B.block.fields.NUM===451);
  await page.reload();await page.waitForFunction(()=>window.workbenchTest?.workspace());await settle();
  check('native refresh immediately after draft echo restores latest field edit',await page.evaluate(()=>window.workbenchTest.workspace().getBlockById('threshold').getFieldValue('NUM')===451));
  check('refresh restores the repaired statement sequence',JSON.stringify(await chain())===JSON.stringify(['read','if','wait']));
  await page.setViewportSize({width:3440,height:1157});await settle();await page.getByRole('button',{name:'点选移动 / 插入',exact:true}).click();await settle();
  const bounds=await page.evaluate(()=>{const a=document.querySelector('.eq-game-block-viewport-tools').getBoundingClientRect(),b=document.querySelector('.eq-program-connection-controls').getBoundingClientRect(),c=document.querySelector('.eq-live-blocks').getBoundingClientRect();return {a:{x:a.x,right:a.right},b:{x:b.x,right:b.right},c:{top:c.top,bottom:c.bottom},width:document.documentElement.scrollWidth};});
  check('3440 tools stay grouped near the editor instead of spanning the screen',bounds.a.right-bounds.a.x<=1121&&bounds.b.right-bounds.b.x<=1121&&bounds.width<=3440);
  check('3440 placement controls remain visible with the workspace',await page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}).isVisible()&&bounds.c.bottom>bounds.c.top+300);
  await page.getByRole('button',{name:'找到等待积木',exact:true}).click();await settle();await shot('08-tools-3440');
  check('opening the tray keeps the program body clear of its overlay at 3440',await page.evaluate(()=>{const w=window.workbenchTest.workspace(),host=document.querySelector('.eq-live-blocks').getBoundingClientRect();return w.getBlockById('root').getSvgRoot().getBoundingClientRect().left>=host.left+w.getToolbox().getWidth()+w.getFlyout().getWidth();}));
  await page.setViewportSize({width:1280,height:720});await settle();await shot('09-tools-1280');
  check('opening the tray keeps the program body clear of its overlay at 1280',await page.evaluate(()=>{const w=window.workbenchTest.workspace(),host=document.querySelector('.eq-live-blocks').getBoundingClientRect();return w.getBlockById('root').getSvgRoot().getBoundingClientRect().left>=host.left+w.getToolbox().getWidth()+w.getFlyout().getWidth();}));
  check('1280 has no horizontal document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=1280));
  check('no browser console or page errors',errors.length===0);
  await writeFile(`${evidence}/result.json`,JSON.stringify({checks,errors,state:await state()},null,2));
}catch(error){await shot('failure');await writeFile(`${evidence}/failure.json`,JSON.stringify({checks,errors,state:await state()},null,2));throw error;}
finally{await browser.close();}
