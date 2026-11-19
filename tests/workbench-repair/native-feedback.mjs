import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {chromium} from 'playwright';
const directory=process.env.NATIVE_FEEDBACK_DIR??'/tmp/eq-native-feedback';await mkdir(directory,{recursive:true});
const archive=JSON.parse(gunzipSync(await readFile(new URL('../../docs/integration/evidence/ongoing-dialogue/local-backup.json.gz',import.meta.url)))).archive.data;
const draft=archive.attempts.find(attempt=>attempt.id===archive.activeAttemptId).draft.blockState,initial=draft.workspace??draft;
function find(type){let found;function walk(block){if(found)return;if(block.type===type){found=block;return;}for(const input of Object.values(block.inputs??{}))if(input.block??input.shadow)walk(input.block??input.shadow);if(block.next?.block)walk(block.next.block);}walk(initial.blocks.blocks[0]);return found;}
const ids={root:initial.blocks.blocks[0].id,read:find('eqp_set').id,if:find('controls_if').id,wait:find('eqp_wait').id,on:find('controls_if').inputs.DO0.block.id,off:find('controls_if').inputs.ELSE.block.id};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH??'/Users/limou/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(initial=>{try{localStorage.setItem('eq-statement-repair-synthetic-draft',JSON.stringify(initial));}catch{}},initial);
const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
const wait=()=>page.waitForTimeout(220),shot=name=>page.screenshot({path:`${directory}/${name}.png`});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log(`PASS ${name}`);};
const target=()=>page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true});
async function state(label){return page.evaluate(({label,ids})=>{const w=window.workbenchTest.workspace(),chain=[];let b=w.getBlockById(ids.root).getInputTargetBlock('LOOP');while(b){chain.push(b.id);b=b.getNextBlock();}const conditional=w.getBlockById(ids.if);return {label,phase:window.nativeFeedback.phase,dragging:w.isDragging(),chain,ifParent:conditional.getParent()?.id??null,ifNext:conditional.getNextBlock()?.id??null,branches:[conditional.getInputTargetBlock('DO0')?.id,conditional.getInputTargetBlock('ELSE')?.id],feedback:document.querySelector('[data-block-snap]').textContent,markers:document.querySelectorAll('.blocklyInsertionMarker').length,state:JSON.parse(window.render_game_to_text()).workspace,edits:window.nativeFeedback.calls.filter(call=>call.origin==='edit').length};},{label,ids});}
async function dragTo(id,input,empty=false){
  const points=await page.evaluate(({ids,id,input,empty})=>{const w=window.workbenchTest.workspace(),block=w.getBlockById(ids.if),matrix=block.getSvgRoot().getScreenCTM(),offset=block.previousConnection.getOffsetInBlock(),from=new DOMPoint(offset.x,offset.y).matrixTransform(matrix),grab=new DOMPoint(55,12).matrixTransform(matrix),connection=input==='next'?w.getBlockById(id).nextConnection:w.getBlockById(id).getInput(input).connection,p=connection.getOffsetInBlock(),to=new DOMPoint(p.x,p.y).matrixTransform(connection.getSourceBlock().getSvgRoot().getScreenCTM()),host=document.querySelector('.eq-live-blocks').getBoundingClientRect();return {from:{x:from.x,y:from.y},grab:{x:grab.x,y:grab.y},to:empty?{x:host.right-85,y:host.top+80}:{x:to.x,y:to.y}};},{ids,id,input,empty});
  await page.mouse.move(points.grab.x,points.grab.y);await page.mouse.down();await page.mouse.move(points.grab.x+35,points.grab.y+30,{steps:6});await wait();
  await page.mouse.move(points.to.x+points.grab.x-points.from.x,points.to.y+points.grab.y-points.from.y,{steps:20});await wait();return points;
}
try{
  await page.goto(process.env.WORKBENCH_TEST_URL??'http://127.0.0.1:5242/tests/workbench-repair/harness.html?compact=1');await page.waitForFunction(()=>window.workbenchTest?.workspace());await wait();
  await page.evaluate(()=>{window.nativeFeedback={phase:'self-tail',calls:[],events:[]};const push=window.workbenchTest.changes.push.bind(window.workbenchTest.changes);window.workbenchTest.changes.push=next=>{window.nativeFeedback.calls.push({...structuredClone(next),phase:window.nativeFeedback.phase,dragging:window.workbenchTest.workspace().isDragging(),at:performance.now()});return push(next);};window.workbenchTest.workspace().addChangeListener(event=>window.nativeFeedback.events.push({phase:window.nativeFeedback.phase,type:event.type,isUiEvent:event.isUiEvent,recordUndo:event.recordUndo,isStart:event.isStart,dragging:window.workbenchTest.workspace().isDragging()}));});
  const baseline=await state('baseline');await target().selectOption(`${ids.wait}|@after`);await wait();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await wait();await shot('01-self-tail-target');
  await dragTo(ids.wait,'next');const held=await state('held-self-tail');await shot('02-self-tail-held');await page.mouse.up();await wait();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await wait();const dropped=await state('self-tail-dropped');await shot('03-self-tail-dropped');
  check('real native drag keeps if branches and its original wait as a detached group',dropped.chain.length===1&&dropped.chain[0]===ids.read&&dropped.ifParent===null&&dropped.ifNext===ids.wait&&dropped.branches[0]===ids.on&&dropped.branches[1]===ids.off);
  const callbacks=await page.evaluate(()=>window.nativeFeedback.calls.filter(call=>call.origin==='edit'));
  check('no callback is emitted during drag and one final actual orphan graph is published',held.edits===0&&callbacks.length===1&&!callbacks[0].dragging&&JSON.stringify(callbacks[0].workspace)===JSON.stringify(dropped.state));
  if(process.env.NATIVE_FEEDBACK_EXPECT_FIXED!=='0'){
    check('while held the self-tail conflict is explained instead of promising a snap',/整串/.test(held.feedback)&&/自己|尾块/.test(held.feedback)&&!/对准黄色目标/.test(held.feedback));
    check('a detached stack is never described as a successful attachment',/尚未接入程序入口/.test(dropped.feedback)&&!/已经接在|已经吸附|已接入程序入口/.test(dropped.feedback));
    await page.evaluate(()=>{window.nativeFeedback.phase='fallback-undo';});await page.getByRole('button',{name:'撤销并改用单句点选',exact:true}).click();await wait();
    check('visible fallback restores the original actual graph before single-statement selection',JSON.stringify((await state('fallback-restored')).state)===JSON.stringify(baseline.state));
    check('fallback selects the same if and explicit single-statement mode',await page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}).inputValue()===`block:${ids.if}`&&await page.getByRole('combobox',{name:'移动语句的范围',exact:true}).inputValue()==='single');
  }else{await page.getByRole('button',{name:'撤销一步',exact:true}).click();await wait();await page.getByRole('button',{name:'点选移动 / 插入',exact:true}).click();}
  await page.evaluate(()=>{window.nativeFeedback.phase='single-preview';});await page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}).selectOption(`block:${ids.if}`);await page.getByRole('combobox',{name:'移动语句的范围',exact:true}).selectOption('single');await target().selectOption(`${ids.wait}|@after`);await page.getByRole('button',{name:'2 预览连接',exact:true}).click();await wait();await shot('04-single-preview');await page.getByRole('button',{name:'取消预览',exact:true}).click();await wait();
  check('single-move preview cancellation leaves the restored graph unchanged',JSON.stringify((await state('preview-cancelled')).state)===JSON.stringify(baseline.state));
  await page.evaluate(()=>{window.nativeFeedback.phase='single-confirm';});await page.getByRole('button',{name:'2 预览连接',exact:true}).click();await wait();await page.getByRole('button',{name:'确认连接',exact:true}).click();await wait();const point=await state('single-confirmed');
  check('same-if single point move produces read wait if with both branches preserved',JSON.stringify(point.chain)===JSON.stringify([ids.read,ids.wait,ids.if])&&point.branches[0]===ids.on&&point.branches[1]===ids.off);await shot('05-single-confirmed');
  await page.getByRole('button',{name:'撤销一步',exact:true}).click();await wait();check('single move native undo restores read if wait',JSON.stringify((await state('single-undone')).state)===JSON.stringify(baseline.state));
  await page.evaluate(()=>{window.nativeFeedback.phase='input-miss';});await target().selectOption(`${ids.root}|SETUP`);await wait();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await wait();await dragTo(ids.root,'SETUP',true);await page.mouse.up();await wait();const inputMiss=await state('input-miss');await shot('06-input-miss');
  if(process.env.NATIVE_FEEDBACK_EXPECT_FIXED!=='0'){
    check('a failed selected statement input cannot reuse a prior success message',/尚未接入程序入口/.test(inputMiss.feedback)&&/启动时/.test(inputMiss.feedback)&&!/已经接在|已经吸附|已接入程序入口/.test(inputMiss.feedback));
    await page.evaluate(()=>{window.nativeFeedback.phase='input-native-undo';});const host=await page.locator('.eq-live-blocks').boundingBox();await page.mouse.click(host.x+host.width*.65,host.y+host.height*.85,{button:'right'});await page.locator('.blocklyMenuItem').filter({hasText:/^撤销$/}).click();await wait();const nativeUndo=await state('native-undo-restored');
    check('native context undo restores the graph and removes stale disconnected feedback',JSON.stringify(nativeUndo.state)===JSON.stringify(baseline.state)&&!/尚未接入程序入口/.test(nativeUndo.feedback));
  }
  await page.evaluate(()=>{window.nativeFeedback.phase='no-change-setup';});await target().selectOption(`${ids.wait}|@after`);await wait();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await wait();await dragTo(ids.wait,'next');await page.mouse.up();await wait();
  const noChangeBefore=await state('loose-before-no-change'),undoBefore=await page.evaluate(()=>{const w=window.workbenchTest.workspace();window.nativeFeedback.priorUndo=w.getUndoStack().slice();return w.getUndoStack().length;});
  await page.evaluate(()=>{window.nativeFeedback.phase='no-change-drag';});
  const grab=await page.evaluate(id=>{const point=new DOMPoint(55,12).matrixTransform(window.workbenchTest.workspace().getBlockById(id).getSvgRoot().getScreenCTM());return {x:point.x,y:point.y};},ids.if);
  await page.mouse.move(grab.x,grab.y);await page.mouse.down();await page.mouse.move(grab.x+45,grab.y+30,{steps:8});await wait();await page.mouse.move(grab.x,grab.y,{steps:8});await page.mouse.up();await wait();
  const noChangeAfter=await state('loose-returned-unchanged');await shot('07-loose-no-change');
  check('returning an already loose stack leaves exact state and callbacks unchanged despite older undo history',undoBefore>0&&JSON.stringify(noChangeAfter.state)===JSON.stringify(noChangeBefore.state)&&noChangeAfter.edits===noChangeBefore.edits);
  const noChangeAction=await page.locator('.eq-program-native-help').textContent();
  if(process.env.NATIVE_NOOP_EXPECT_FIXED!=='0'){
    check('no-change conflict offers point selection without an undo action',await page.getByRole('button',{name:'撤销并改用单句点选',exact:true}).count()===0&&await page.getByRole('button',{name:'改用单句点选',exact:true}).count()===1&&!/请撤销/.test(noChangeAfter.feedback));
    await page.getByRole('button',{name:'改用单句点选',exact:true}).click();await wait();
    check('point-only fallback preserves the prior undo records and actual loose graph',JSON.stringify((await state('point-only-opened')).state)===JSON.stringify(noChangeBefore.state)&&await page.evaluate(()=>{const before=window.nativeFeedback.priorUndo,after=window.workbenchTest.workspace().getUndoStack();return before.length===after.length&&before.every((item,i)=>item===after[i]);})&&await page.getByRole('combobox',{name:'选择要移动或插入的积木',exact:true}).inputValue()===`block:${ids.if}`);
  }
  check('no browser errors',errors.length===0);
  const events=await page.evaluate(()=>{const {priorUndo,...data}=window.nativeFeedback;return data;});await writeFile(`${directory}/result.json`,JSON.stringify({ids,checks,errors,baseline,held,dropped,point,inputMiss,noChangeBefore,noChangeAfter,noChangeAction,...events},null,2));
  console.log(JSON.stringify({heldFeedback:held.feedback,dropFeedback:dropped.feedback,inputMissFeedback:inputMiss.feedback},null,2));
}finally{await browser.close();}
