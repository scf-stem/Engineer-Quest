import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1265,height:950}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const review=()=>page.evaluate(()=>window.requirementHarness.work.getState().facts.requirements);
const stage=()=>page.locator('.eq-requirement-stage');
const dismiss=async()=>{const next=stage().locator('[data-scene-continue]');if(await next.isVisible()){await next.click();await page.waitForFunction(()=>window.requirementHarness.work.getState().storage.status==='saved');}};
const answer=async optionId=>{await dismiss();await page.locator(`[data-option-id="${optionId}"]`).click();await page.waitForFunction(()=>window.requirementHarness.work.getState().storage.status==='saved');};
// Preserve previous versioned evidence. This module harness is not a full game signoff.
const folder=resolve(process.env.EQ_REQUIREMENT_EVIDENCE_DIR??'/tmp/eq-requirement-practice-current');await mkdir(folder,{recursive:true});
try{
  await page.goto((process.env.EQ_STORAGE_URL??'http://127.0.0.1:5190')+'/tests/integration/requirement-practice.html');
  await page.getByRole('button',{name:'开始本机练习'}).click();await stage().getByRole('heading',{name:/1 \/ 6 \/ 窗边与阴影/}).waitFor();
  await answer('calendar');assert.equal((await review()).status,'needs-retry');
  await dismiss();
  await stage().getByRole('button',{name:'求助',exact:true}).click();await page.getByRole('button',{name:'林工，我需要一个小观察',exact:true}).click();await page.waitForFunction(()=>window.requirementHarness.work.getState().facts.requirements.status==='needs-help');
  await dismiss();await stage().getByRole('button',{name:'求助',exact:true}).click();await page.getByRole('textbox',{name:'告诉林工卡在哪里（选填）'}).fill('我完全不懂，随便选的。');await page.waitForFunction(()=>window.requirementHarness.work.getState().storage.status==='saved');await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
  await page.locator('[data-option-id="current-light"]').click();await page.waitForFunction(()=>window.requirementHarness.work.getState().storage.status==='saved');
  assert.equal((await review()).status,'needs-help');assert.equal((await review()).readyToAdvance,false);
  await dismiss();
  await page.screenshot({path:folder+'/help.png',fullPage:true});
  // Authored regression route; no private answer keys are included in rendered UI.
  for(const option of ['current-light','lamp-on','lamp-off','read-decide-repeat','lamp-off','trace-b'])await answer(option);
  await dismiss();assert.equal((await review()).readyToAdvance,true);
  const before=await page.evaluate(()=>window.requirementHarness.work.exportArchive());
  await page.reload();await stage().getByRole('button',{name:'继续当前作品 →',exact:true}).waitFor();
  const after=await page.evaluate(()=>window.requirementHarness.work.exportArchive());
  assert.equal(after.data.learner.id,before.data.learner.id);assert.deepEqual(after.data.attempts[0].reviews,before.data.attempts[0].reviews);
  assert.equal(after.data.attempts[0].reviews.base.responses.length,9);
  await page.screenshot({path:folder+'/restored.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:folder+'/mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
  await writeFile(folder+'/result.json',JSON.stringify({scope:'Actual public D challenge UI + E IndexedDB; authored regression, not novice signoff',readyAfterRefresh:(await review()).readyToAdvance,responses:after.data.attempts[0].reviews.base.responses.length,pageErrors:errors},null,2)+'\n');
  console.log('PASS: actual requirement UI wrong answer, help, explicit uncertainty, retry, six ordered scenes and refresh replay. No whole-game teaching signoff.');
}finally{await browser.close();}
