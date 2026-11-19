import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir=process.env.DRAG_AUDIT_DIR??'/tmp/eq-workbench-drag-audit';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH??'/Users/limou/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const wait=()=>page.waitForTimeout(180);
const phase=label=>page.evaluate(label=>{window.dragAudit.phase=label;},label);
async function point(id,port,flyout=false){return page.evaluate(({id,port,flyout})=>{const w=window.workbenchTest.workspace(),block=flyout?w.getFlyout().getWorkspace().getTopBlocks(false).find(block=>block.type===id):w.getBlockById(id);const connection=port==='previous'?block.previousConnection:port==='next'?block.nextConnection:block.getInput(port).connection,p=connection.getOffsetInBlock(),tip=new DOMPoint(p.x,p.y).matrixTransform(block.getSvgRoot().getScreenCTM()),box=block.getSvgRoot().getBoundingClientRect();return {x:tip.x,y:tip.y,gx:box.x+(block.type==='controls_if'?55:18),gy:box.y+(block.type==='controls_if'?12:5)};},{id,port,flyout});}
async function movePort(grab,to){await page.mouse.move(to.x+grab.gx-grab.x,to.y+grab.gy-grab.y,{steps:20});await wait();}
async function snapshot(label){return page.evaluate(label=>{const w=window.workbenchTest.workspace();const item={label,phase:window.dragAudit.phase,nativeDragging:w.isDragging(),pointerDown:window.dragAudit.pointerDown,callbacks:window.dragAudit.calls.length,markers:w.getAllBlocks(false).filter(block=>block.isInsertionMarker()).map(block=>block.id),markerElements:document.querySelectorAll('.blocklyInsertionMarker').length,state:JSON.parse(window.render_game_to_text()).workspace,stored:JSON.parse(localStorage.getItem(window.workbenchTest.key)),baseline:window.dragAudit.baseline};window.dragAudit.snapshots.push(item);return item;},label);}
async function restore({shadow=false}={}){await page.evaluate(shadow=>{const next=window.workbenchTest.fixture({branches:true});if(shadow){const input=next.blocks.blocks[0].inputs.LOOP.block.next.block.inputs.MS;input.shadow=input.block;delete input.block;}window.workbenchTest.restore(next);},shadow);await wait();await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await wait();await page.evaluate(()=>{window.dragAudit.baseline=JSON.parse(window.render_game_to_text()).workspace;localStorage.setItem(window.workbenchTest.key,JSON.stringify(window.dragAudit.baseline));});}
async function editNumber(id,value){const p=await page.evaluate(id=>{const r=window.workbenchTest.workspace().getBlockById(id).getField('NUM').getSvgRoot().getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},id);await page.mouse.dblclick(p.x,p.y);await page.locator('input.blocklyHtmlInput').fill(String(value));await page.locator('input.blocklyHtmlInput').press('Enter');await wait();}
try{
  await page.goto(process.env.WORKBENCH_TEST_URL??'http://127.0.0.1:5242/tests/workbench-repair/harness.html');await page.waitForFunction(()=>window.workbenchTest?.workspace());await wait();
  await page.evaluate(()=>{
    window.dragAudit={phase:'idle',pointerDown:false,calls:[],snapshots:[],events:[]};
    document.addEventListener('pointerdown',()=>{window.dragAudit.pointerDown=true;},true);document.addEventListener('pointerup',()=>{window.dragAudit.pointerDown=false;},true);
    const push=window.workbenchTest.changes.push.bind(window.workbenchTest.changes);
    window.workbenchTest.changes.push=next=>{const w=window.workbenchTest.workspace();window.dragAudit.calls.push({phase:window.dragAudit.phase,at:performance.now(),nativeDragging:w.isDragging(),pointerDown:window.dragAudit.pointerDown,markers:w.getAllBlocks(false).filter(block=>block.isInsertionMarker()).map(block=>block.id),...structuredClone(next)});return push(next);};
    window.workbenchTest.workspace().addChangeListener(event=>window.dragAudit.events.push({phase:window.dragAudit.phase,at:performance.now(),type:event.type,recordUndo:event.recordUndo,isUiEvent:event.isUiEvent,isStart:event.isStart,nativeDragging:window.workbenchTest.workspace().isDragging()}));
  });
  // Lift an existing connected if, inspect a live insertion preview, then return it.
  await restore();await phase('existing:before-lift');const grab=await point('if','previous');
  await page.mouse.move(grab.gx,grab.gy);await page.mouse.down();await page.mouse.move(grab.gx+40,grab.gy+40,{steps:6});await wait();await snapshot('existing-lifted');
  await phase('existing:preview');await movePort(grab,await point('read','next'));await snapshot('existing-preview');await page.screenshot({path:`${dir}/existing-preview.png`});
  await phase('existing:returning');const canvas=await page.locator('.eq-live-blocks').boundingBox();await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.72,{steps:14});await wait();
  await movePort(grab,await point('wait','next'));await snapshot('existing-return-hover');await phase('existing:released');await page.mouse.up();await wait();await snapshot('existing-returned');
  // The same existing if, now committed at the new insertion boundary.
  await restore();await phase('existing-move:before-lift');const moved=await point('if','previous');await page.mouse.move(moved.gx,moved.gy);await page.mouse.down();await page.mouse.move(moved.gx+40,moved.gy+40,{steps:6});await wait();
  await phase('existing-move:preview');await movePort(moved,await point('read','next'));await snapshot('existing-move-preview');await phase('existing-move:released');await page.mouse.up();await wait();await snapshot('existing-moved');
  // A real Escape key during a drag is observed, rather than assumed to cancel.
  await restore();await phase('escape:before-lift');const cancelGrab=await point('if','previous');await page.mouse.move(cancelGrab.gx,cancelGrab.gy);await page.mouse.down();await page.mouse.move(cancelGrab.gx+45,cancelGrab.gy+35,{steps:6});await wait();
  await phase('escape:preview');await movePort(cancelGrab,await point('read','next'));await page.keyboard.press('Escape');await wait();await snapshot('existing-escape-key');await phase('escape:released');await page.mouse.up();await wait();await snapshot('existing-escape-release');
  // A newly dragged flyout block is a draft change only once it is dropped.
  await restore();await page.getByRole('button',{name:'找到等待积木',exact:true}).click();await wait();await phase('flyout:before-lift');const fresh=await point('eqp_wait','previous',true);
  await page.mouse.move(fresh.gx,fresh.gy);await page.mouse.down();await page.mouse.move(fresh.gx+45,fresh.gy+35,{steps:6});await wait();await snapshot('flyout-lifted');
  await phase('flyout:preview');await movePort(fresh,await point('read','next'));await snapshot('flyout-preview');await page.screenshot({path:`${dir}/flyout-preview.png`});await phase('flyout:released');await page.mouse.up();await wait();await snapshot('flyout-dropped');
  // Returning a new block to the toolbox is the native no-change cancellation.
  await restore();await page.getByRole('button',{name:'找到等待积木',exact:true}).click();await wait();await phase('flyout-cancel:before-lift');const undoGrab=await point('eqp_wait','previous',true);await page.mouse.move(undoGrab.gx,undoGrab.gy);await page.mouse.down();await page.mouse.move(undoGrab.gx+45,undoGrab.gy+35,{steps:6});await wait();
  await phase('flyout-cancel:preview');await movePort(undoGrab,await point('read','next'));await snapshot('flyout-cancel-preview');await phase('flyout-cancel:returning');const host=await page.locator('.eq-live-blocks').boundingBox();await page.mouse.move(host.x+25,host.y+55,{steps:20});await wait();await phase('flyout-cancel:released');await page.mouse.up();await wait();await snapshot('flyout-cancelled');
  // Ordinary and shadow field edits still publish; native menu undo has no
  // component refresh wrapper and therefore exercises recordUndo=false events.
  await restore();await phase('field:ordinary');await editNumber('threshold',451);await snapshot('ordinary-field-edited');
  await phase('field:native-undo');const blank=await page.locator('.eq-live-blocks').boundingBox();await page.mouse.click(blank.x+blank.width*.8,blank.y+blank.height*.85,{button:'right'});await page.locator('.blocklyMenuItem').filter({hasText:/^撤销$/}).click();await wait();await snapshot('ordinary-field-native-undo');
  await restore({shadow:true});await phase('field:shadow');await editNumber('duration',101);await snapshot('shadow-field-edited');await phase('field:shadow-undo');await page.getByRole('button',{name:'撤销一步',exact:true}).click();await wait();await snapshot('shadow-field-undo');
  const audit=await page.evaluate(()=>window.dragAudit);
  const edits=audit.calls.filter(call=>call.origin==='edit');
  const during=edits.filter(call=>call.nativeDragging||call.pointerDown);
  const summary={callbacks:edits.length,duringDrag:during.length,phases:edits.map(call=>({phase:call.phase,nativeDragging:call.nativeDragging,pointerDown:call.pointerDown,markers:call.markers.length,roots:call.workspace.blocks.blocks.map(block=>`${block.type}:${block.id}`),error:call.error})),errors};
  await writeFile(`${dir}/callbacks.json`,JSON.stringify(audit,null,2));await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
  if(process.env.DRAG_AUDIT_EXPECT_SAFE!=='0'){
    assert.equal(during.length,0,'no draft callback while a block is held or native dragging');
    assert.equal(edits.filter(call=>call.phase.startsWith('existing:')).length,0,'returning an existing block is a no-change operation');
    assert.equal(edits.filter(call=>call.phase.startsWith('existing-move:')).length,1,'moving an existing block publishes exactly one final drop');
    assert.equal(edits.filter(call=>call.phase.startsWith('flyout-cancel:')).length,0,'returning a flyout block to toolbox is a no-change cancellation');
    assert.equal(edits.filter(call=>call.phase.startsWith('flyout:')).length,1,'a new flyout block publishes exactly one final drop');
    assert.ok(audit.snapshots.some(item=>item.markerElements>0&&item.nativeDragging),'a real insertion-marker preview was exercised');
    for(const item of audit.snapshots.filter(item=>item.nativeDragging||item.pointerDown))assert.deepEqual(item.stored,item.baseline,`${item.label}: host draft unchanged while dragging`);
    for(const label of ['existing-returned','flyout-cancelled']){const item=audit.snapshots.find(item=>item.label===label);assert.deepEqual(item.state,item.baseline,`${label}: final real graph unchanged`);assert.deepEqual(item.stored,item.baseline,`${label}: host draft unchanged`);}
    const dropped=audit.snapshots.find(item=>item.label==='flyout-dropped');assert.deepEqual(edits.find(call=>call.phase==='flyout:released').workspace,dropped.state,'only the final real graph is published');
    const moved=audit.snapshots.find(item=>item.label==='existing-moved');assert.deepEqual(edits.find(call=>call.phase==='existing-move:released').workspace,moved.state,'existing move publishes exactly the final real graph');assert.equal(moved.state.blocks.blocks[0].inputs.LOOP.block.next.block.id,'if');assert.equal(moved.state.blocks.blocks[0].inputs.LOOP.block.next.block.next.block.id,'wait');
    for(const p of ['field:ordinary','field:native-undo','field:shadow','field:shadow-undo'])assert.equal(edits.filter(call=>call.phase===p).length,1,`${p}: one real field/undo callback`);
    assert.ok(audit.events.some(event=>event.phase==='field:native-undo'&&!event.isUiEvent&&event.recordUndo===false),'native undo traversed recordUndo=false events');
    for(const item of audit.snapshots.filter(item=>item.label.includes('field-')))assert.deepEqual(item.stored,item.state,`${item.label}: host matches committed field/undo`);
    assert.equal(audit.snapshots.find(item=>item.label==='ordinary-field-edited').state.blocks.blocks[0].inputs.LOOP.block.next.block.next.block.inputs.IF0.block.inputs.B.block.fields.NUM,451);
    assert.equal(audit.snapshots.find(item=>item.label==='shadow-field-edited').state.blocks.blocks[0].inputs.LOOP.block.next.block.inputs.MS.shadow.fields.NUM,101);
    assert.equal(audit.snapshots.find(item=>item.label==='shadow-field-undo').state.blocks.blocks[0].inputs.LOOP.block.next.block.inputs.MS.shadow.fields.NUM,100);
    assert.equal(errors.length,0);console.log('PASS drag publication boundary');
  }
}finally{await browser.close();}
