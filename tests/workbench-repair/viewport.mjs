import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const evidence=process.env.VIEWPORT_EVIDENCE_DIR??'/tmp/eq-workbench-viewport';await mkdir(evidence,{recursive:true});
const archive=JSON.parse(gunzipSync(await readFile(new URL('../../docs/integration/evidence/ongoing-dialogue/local-backup.json.gz',import.meta.url)))).archive.data;
const draft=archive.attempts.find(attempt=>attempt.id===archive.activeAttemptId).draft.blockState;
const original=draft.workspace??draft,rootId=original.blocks.blocks[0].id,key='eq-statement-repair-synthetic-draft',raw=JSON.stringify(original);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH??'/Users/limou/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const checks=[],errors=[],snapshots=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log(`PASS ${name}`);};
const settle=page=>page.waitForTimeout(250);
const coords=state=>{const out=[];function visit(block){if('x'in block||'y'in block)out.push([block.id,block.x,block.y]);for(const input of Object.values(block.inputs??{}))if(input.block??input.shadow)visit(input.block??input.shadow);if(block.next?.block)visit(block.next.block);}for(const block of state.blocks.blocks)visit(block);return JSON.stringify(out);};
function find(state,type){let result;function visit(block){if(result)return;if(block.type===type){result=block;return;}for(const input of Object.values(block.inputs??{}))if(input.block??input.shadow)visit(input.block??input.shadow);if(block.next?.block)visit(block.next.block);}for(const block of state.blocks.blocks)visit(block);return result;}
async function boot(hidden=false){const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(({key,raw})=>{try{localStorage.setItem(key,raw);}catch{}},{key,raw});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await page.goto(`${process.env.WORKBENCH_TEST_URL??'http://127.0.0.1:5242/tests/workbench-repair/harness.html'}?compact=1${hidden?'&hidden=1':''}`);await page.waitForFunction(()=>window.workbenchTest?.workspace());await settle(page);return {page,context};}
async function inspect(page,label){const result=await page.evaluate(({rootId,label})=>{const w=window.workbenchTest.workspace(),host=document.querySelector('.eq-live-blocks').getBoundingClientRect(),root=w.getBlockById(rootId).getSvgRoot().getBoundingClientRect(),plain=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});return {label,host:plain(host),root:plain(root),available:{left:host.left+w.getToolbox().getWidth()+(w.getFlyout().isVisible()?w.getFlyout().getWidth():0)+16,right:host.right-22,top:host.top+16,bottom:host.bottom-22},scale:w.scale,scrollX:w.scrollX,scrollY:w.scrollY,undo:w.getUndoStack().length,edits:window.workbenchTest.changes.filter(change=>change.origin==='edit').length,state:JSON.parse(window.render_game_to_text()).workspace,callbackState:window.workbenchTest.changes.at(-1).workspace,stored:localStorage.getItem(window.workbenchTest.key)};},{rootId,label});snapshots.push(result);return result;}
function fits(s){return s.root.left>=s.available.left-1&&s.root.right<=s.available.right+1&&s.root.top>=s.available.top-1&&s.root.bottom<=s.available.bottom+1;}
async function targetPoint(page,id,input){return page.evaluate(({id,input})=>{const w=window.workbenchTest.workspace(),c=w.getBlockById(id).getInput(input).connection,p=c.getOffsetInBlock(),q=new DOMPoint(p.x,p.y).matrixTransform(c.getSourceBlock().getSvgRoot().getScreenCTM()),h=document.querySelector('.eq-live-blocks').getBoundingClientRect();return {x:q.x,y:q.y,left:h.left+w.getToolbox().getWidth()+(w.getFlyout().isVisible()?w.getFlyout().getWidth():0)+16,right:h.right-22,top:h.top+16,bottom:h.bottom-22};},{id,input});}
const mouthFits=p=>p.x>=p.left&&p.x<=p.right&&p.y>=p.top&&p.y<=p.bottom;
async function restore(page,state){await page.evaluate(({state,key})=>{localStorage.setItem(key,JSON.stringify(state));window.workbenchTest.restore(state);},{state,key});await settle(page);}
const targetSelect=page=>page.getByRole('combobox',{name:'准备接入的精确槽位',exact:true});
try{
  let {page,context}=await boot();
  let s=await inspect(page,'real-archive-initial');
  check('real archived coordinates are 554/68',original.blocks.blocks[0].x===554&&original.blocks.blocks[0].y===68);
  check('1280 initial restore shows the full real old program without a manual fit',fits(s));
  check('automatic framing stays within the readable 0.75 to 1 scale',s.scale>=.75&&s.scale<=1);
  check('initial framing changes neither coordinate bytes nor the raw saved draft',coords(s.state)===coords(original)&&s.stored===raw);
  check('initial framing has zero edit callbacks, no undo entries and identical callback data',s.edits===0&&s.undo===0&&JSON.stringify(s.state)===JSON.stringify(s.callbackState));
  await page.screenshot({path:`${evidence}/01-real-old-initial-1280.png`});await context.close();

  ({page,context}=await boot(true));s=await inspect(page,'hidden-initial');const zeroCamera={scale:s.scale,scrollX:s.scrollX,scrollY:s.scrollY};
  check('hidden restored editor has a real zero-size surface',s.host.width===0&&s.host.height===0);
  await settle(page);s=await inspect(page,'hidden-waiting');
  check('zero-size restoration waits without camera movement or edits',s.edits===0&&s.scale===zeroCamera.scale&&s.scrollX===zeroCamera.scrollX&&s.scrollY===zeroCamera.scrollY&&s.stored===raw);
  await page.getByRole('button',{name:'显示工位',exact:true}).click();await settle(page);s=await inspect(page,'shown-after-zero');
  check('zero-to-visible restore automatically frames the real old program',fits(s));
  check('showing the editor preserves raw draft, coordinate bytes and undo',s.edits===0&&s.undo===0&&s.stored===raw&&coords(s.state)===coords(original));
  await page.screenshot({path:`${evidence}/02-zero-to-visible-1280.png`});

  const variant=structuredClone(original);variant.blocks.blocks[0].x=700;variant.blocks.blocks[0].y=350;
  await restore(page,variant);s=await inspect(page,'external-700-variant');
  check('external x700/y350 variant is framed without a manual fit',fits(s));
  check('external framing has zero edits and preserves variant coordinate and draft bytes',s.edits===0&&coords(s.state)===coords(variant)&&s.stored===JSON.stringify(variant)&&JSON.stringify(s.state)===JSON.stringify(s.callbackState));
  await page.screenshot({path:`${evidence}/03-external-700-variant-1280.png`});
  const number=find(variant,'logic_compare').inputs.B.block;
  const field=await page.evaluate(id=>{const r=window.workbenchTest.workspace().getBlockById(id).getField('NUM').getSvgRoot().getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},number.id);
  await page.mouse.dblclick(field.x,field.y);await page.locator('input.blocklyHtmlInput').fill('451');await page.locator('input.blocklyHtmlInput').press('Enter');await settle(page);
  const beforeCamera=await inspect(page,'before-target-camera');check('real field edit created a nonempty native undo history',beforeCamera.edits===1&&beforeCamera.undo>0);
  const declaration=find(variant,'eqp_declare');await targetSelect(page).selectOption(`${declaration.id}|INITIAL`);await settle(page);await page.locator('.blocklyToolboxCategory').filter({hasText:'变量与流程'}).click();await settle(page);
  check('real old declaration mouth remains visible after opening its tray',mouthFits(await targetPoint(page,declaration.id,'INITIAL')));
  await page.screenshot({path:`${evidence}/04-real-target-tray-1280.png`});
  await page.getByRole('button',{name:'隐藏工位',exact:true}).click();await settle(page);await page.getByRole('button',{name:'显示工位',exact:true}).click();await settle(page);
  s=await inspect(page,'target-after-hide-show');
  check('target camera and hide/show preserve a nonempty undo history and complete draft bytes',s.undo===beforeCamera.undo&&s.edits===beforeCamera.edits&&s.stored===beforeCamera.stored&&JSON.stringify(s.state)===JSON.stringify(beforeCamera.state));
  check('selected real mouth is still visible after returning to the editor',mouthFits(await targetPoint(page,declaration.id,'INITIAL')));

  const deep=structuredClone(original),comparison=find(deep,'logic_compare');let expression=number;
  for(let i=0;i<10;i++)expression={type:'math_arithmetic',id:`viewport-deep-${i}`,fields:{OP:'ADD'},inputs:{A:{block:{type:'math_number',id:`viewport-zero-${i}`,fields:{NUM:0}}},B:{block:expression}}};
  comparison.inputs.B={block:expression};await restore(page,deep);
  await targetSelect(page).selectOption('viewport-deep-0|B');await settle(page);
  await page.getByRole('button',{name:'找到等待积木',exact:true}).click();await settle(page);await page.locator('.blocklyToolboxCategory').filter({hasText:'变量与流程'}).click();await settle(page);
  const deepPoint=await targetPoint(page,'viewport-deep-0','B');s=await inspect(page,'deep-target-over-root');
  check('deep target mouth stays in the available canvas with a large tray open',mouthFits(deepPoint));
  check('deep target wins over root anchoring when the whole program is too wide',s.root.left<s.available.left&&s.scale>=.75);
  check('deep targeting is viewport only: zero new edits or coordinate changes',s.edits===1&&coords(s.state)===coords(deep)&&s.stored===JSON.stringify(deep));
  await page.screenshot({path:`${evidence}/05-deep-target-priority-1280.png`});

  const long=structuredClone(original);let tail=long.blocks.blocks[0].inputs.LOOP.block;while(tail.next?.block)tail=tail.next.block;
  for(let i=0;i<20;i++){tail.next={block:{type:'eqp_wait',id:`viewport-long-${i}`,inputs:{MS:{block:{type:'math_number',id:`viewport-long-ms-${i}`,fields:{NUM:100}}}}}};tail=tail.next.block;}
  await restore(page,long);s=await inspect(page,'long-readable-floor');
  check('overlong program respects automatic readable scale floor',Math.abs(s.scale-.75)<.001);
  await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle(page);s=await inspect(page,'long-manual-overview');
  check('explicit manual overview can zoom below the automatic readable floor',s.scale<.75);
  check('manual overview still changes no edit, draft or coordinate bytes',s.edits===1&&s.stored===JSON.stringify(long)&&coords(s.state)===coords(long));
  await page.screenshot({path:`${evidence}/06-manual-long-overview-1280.png`});

  await restore(page,original);await page.keyboard.press('Escape');await settle(page);await page.getByRole('button',{name:'查看完整积木',exact:true}).click();await settle(page);
  const ifId=find(original,'controls_if').id,readId=find(original,'eqp_set').id;
  const grab=await page.evaluate(id=>{const b=window.workbenchTest.workspace().getBlockById(id),m=b.getSvgRoot().getScreenCTM(),o=b.previousConnection.getOffsetInBlock(),p=new DOMPoint(o.x,o.y).matrixTransform(m),g=new DOMPoint(55,12).matrixTransform(m);return {x:p.x,y:p.y,gx:g.x,gy:g.y};},ifId);
  await page.mouse.move(grab.gx,grab.gy);await page.mouse.down();await page.mouse.move(grab.gx+40,grab.gy+30,{steps:7});await settle(page);
  const held=await inspect(page,'holding-before-resize');check('real existing-block drag started',await page.evaluate(()=>window.workbenchTest.workspace().isDragging()));
  await page.setViewportSize({width:1240,height:720});await settle(page);s=await inspect(page,'holding-after-resize');
  check('resize requests never move scale or scroll while native block drag is active',s.scale===held.scale&&s.scrollX===held.scrollX&&s.scrollY===held.scrollY&&s.edits===held.edits);
  const port=await page.evaluate(id=>{const c=window.workbenchTest.workspace().getBlockById(id).nextConnection,p=c.getOffsetInBlock(),v=new DOMPoint(p.x,p.y).matrixTransform(c.getSourceBlock().getSvgRoot().getScreenCTM());return {x:v.x,y:v.y};},readId);
  await page.mouse.move(port.x+grab.gx-grab.x,port.y+grab.gy-grab.y,{steps:16});await page.mouse.up();await settle(page);await page.setViewportSize({width:1280,height:720});await settle(page);
  check('returning the held block after resize creates no edit',await page.evaluate(()=>window.workbenchTest.changes.filter(change=>change.origin==='edit').length)===1);
  check('viewport verification has no browser errors',errors.length===0);
  await writeFile(`${evidence}/result.json`,JSON.stringify({source:'docs/integration/evidence/ongoing-dialogue/local-backup.json.gz',sourceBlockStateSha256:createHash('sha256').update(raw).digest('hex'),originalRoot:{id:rootId,x:original.blocks.blocks[0].x,y:original.blocks.blocks[0].y},checks,errors,snapshots},null,2));
  await context.close();
}catch(error){await writeFile(`${evidence}/failure.json`,JSON.stringify({checks,errors,snapshots},null,2));throw error;}
finally{await browser.close();}
