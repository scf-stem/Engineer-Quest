import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.EQ_STORAGE_URL??'http://127.0.0.1:5190';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const context=await browser.newContext({viewport:{width:1280,height:1100}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const evidence='docs/integration/evidence/local-progress';await mkdir(evidence,{recursive:true});
try{
  await page.goto(base+'/tests/integration/local-progress-harness.html');await page.locator('#state').filter({hasText:'onboarding'}).waitFor();
  await page.locator('#run').click();await page.waitForFunction(()=>window.harness?.work.getState().stage==='software-complete');
  const saved=await state(page);assert.equal(saved.income,100);assert.deepEqual(saved.tests.map(t=>t.passed),[true,false,true]);
  await page.reload();await page.waitForFunction(()=>window.harness?.work.getState().storage.status==='restored');
  const restored=await state(page);assert.equal(restored.learnerId,saved.learnerId);assert.equal(restored.attemptId,saved.attemptId);
  assert.equal(restored.stage,'software-complete');assert.equal(restored.income,100);assert.deepEqual(restored.tests,saved.tests);assert.equal(restored.source,saved.source);
  await page.screenshot({path:evidence+'/restored.png',fullPage:true});
  const other=await context.newPage();await other.goto(base+'/tests/integration/local-progress-harness.html');await other.waitForFunction(()=>!!window.harness);
  await other.evaluate(()=>window.harness.work.savePresentation({tool:'manual'}));
  await page.waitForFunction(()=>window.harness.work.getState().storage.status==='external-change');
  assert.equal(await page.evaluate(()=>window.harness.work.restartOrder().then(()=>null,e=>e.code)),'SAVE_BLOCKED');
  await page.evaluate(()=>window.harness.work.reload());await other.close();
  await page.locator('#restart').click();await page.waitForFunction(()=>window.harness.work.getState().stage==='claim-order'&&window.harness.work.getState().storage.status==='saved');
  await page.reload();await page.waitForFunction(()=>window.harness?.work.getState().attempts.length===2);
  assert.equal((await state(page)).income,100);assert.equal((await state(page)).stage,'claim-order');
  await page.locator('#resume').click();await page.waitForFunction(()=>window.harness.work.getState().stage==='software-complete');
  assert.equal((await state(page)).attemptId,saved.attemptId);
  const atomic=await page.evaluate(async()=>{
    const {createIndexedDbProgressStore}=await import('/src/integration/local-progress-store.js');
    const a=createIndexedDbProgressStore({databaseName:'eq-idb-atomic-test'}),b=createIndexedDbProgressStore({databaseName:'eq-idb-atomic-test'});
    await a.commit(0,{amount:100,failedRun:{passed:false}});
    const commits=await Promise.allSettled([a.commit(1,{amount:100,source:'a'}),b.commit(1,{amount:100,source:'b'})]);
    const result={fulfilled:commits.filter(c=>c.status==='fulfilled').length,rejections:commits.filter(c=>c.status==='rejected').map(c=>c.reason.code),revision:(await a.read()).revision};
    await a.close();await b.close();return result;
  });
  assert.deepEqual(atomic,{fulfilled:1,rejections:['REVISION_CONFLICT'],revision:2});assert.deepEqual(errors,[]);
  await writeFile(evidence+'/result.json',JSON.stringify({scope:'Real IndexedDB persistence only; teaching policy is a test double, objective software runs are real.',saved,restored,atomic,pageErrors:errors},null,2)+'\n');
  console.log('PASS: real IndexedDB refresh, history, 100 EC retention, multi-page guard, restart/resume and atomic conflict. Teaching acceptance not assessed.');
}finally{await browser.close();}
