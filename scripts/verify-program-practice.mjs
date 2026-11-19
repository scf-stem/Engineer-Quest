import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1265,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=(process.env.EQ_STORAGE_URL??'http://127.0.0.1:5190')+'/tests/integration/requirement-practice.html?program=1';
const saved=()=>page.waitForFunction(()=>window.requirementHarness?.work.getState().storage.status==='saved');
const folder='docs/integration/evidence/program-practice';await mkdir(folder,{recursive:true});
try{
  await page.goto(url);await page.waitForFunction(()=>!!window.requirementHarness);
  await page.evaluate(async()=>{
    const work=window.requirementHarness.work;await work.start('程序界面合成回归');await work.claimOrder();
    const route=['current-light','lamp-on','lamp-off','read-decide-repeat','lamp-off','trace-b'];
    for(const optionId of route){const c=work.getState().facts.requirements.challenge;await work.reviewRequirements({attempt:{responseId:crypto.randomUUID(),checkpointId:c.checkpointId,optionId,confidence:'ready-to-try'}});}
    const {createHardwareContext}=await import('/src/integration/hardware-adapter.js');const {createAutoLightExample}=await import('/src/hardware/index.js');
    await work.editDraft({wiring:createAutoLightExample((await createHardwareContext()).profile)});
  });
  await page.getByRole('button',{name:'让虚拟 LED 亮起来',exact:true}).click();await saved();
  await page.locator('summary').filter({hasText:'上一次实际操作'}).click();
  await page.getByText('引导程序输出；未替换学生积木。 LED 实际亮。').waitFor();
  assert.equal(await page.getByRole('button',{name:'运行一次，查看实际读取'}).isDisabled(),true);
  assert.equal(await page.locator('body').innerText().then(t=>t.includes('BLOCK_ROOT')),false);
  await page.screenshot({path:folder+'/blank-guidance.png',fullPage:true});
  // Explicit assisted fixture for rendering/runtime regression; not novice completion.
  await page.evaluate(async()=>{const {createExampleBlocks}=await import('/src/program/examples.js');await window.requirementHarness.work.editDraft({blockState:createExampleBlocks(),support:{kind:'test-fixture'}});});
  await page.getByRole('button',{name:'运行一次，查看实际读取'}).click();await saved();
  await page.getByRole('button',{name:'观察暗场景 · 光照 150'}).click();await saved();
  await page.getByRole('button',{name:'观察亮场景 · 光照 850'}).click();await saved();
  await page.getByRole('button',{name:'运行暗 → 亮 → 暗，查看三次读取'}).click();await saved();
  await page.getByRole('button',{name:'运行当前基础客户测试'}).click();await saved();
  assert.equal(await page.evaluate(()=>window.requirementHarness.work.getState().facts.baseReady),true);
  await page.evaluate(async()=>{
    const work=window.requirementHarness.work;await work.prepareCodeChange();
    for(const optionId of ['now-on','lamp-off','comparison','new-current-suite']){const c=work.getState().facts.changeRequirements.challenge;await work.reviewRequirements({phase:'short-cpp',attempt:{responseId:crypto.randomUUID(),checkpointId:c.checkpointId,optionId,confidence:'ready-to-try'}});}
  });
  await page.goto(url+'&phase=short-cpp');await page.getByRole('button',{name:'运算 <',exact:true}).click();await saved();
  await page.getByText('比较两个值，结果是 true 或 false；它决定分支。').waitFor();
  await page.screenshot({path:folder+'/own-mapping.png',fullPage:true});
  await page.getByRole('button',{name:'运行当前变更客户测试'}).click();await saved();
  assert.equal(await page.evaluate(()=>window.requirementHarness.work.getState().facts.codeReport.passed),false);
  await page.evaluate(()=>window.requirementHarness.work.editDraft({shortSource:window.requirementHarness.work.getState().attempt.draft.shortSource.replace('450','600')}));
  await page.getByRole('button',{name:'运行当前变更客户测试'}).click();await saved();
  const final=await page.evaluate(()=>({ready:window.requirementHarness.work.getState().facts.codeReady,tests:window.requirementHarness.work.getState().attempt.tests.map(t=>t.report.passed)}));
  assert.equal(final.ready,true);assert.deepEqual(final.tests,[true,false,true]);assert.deepEqual(errors,[]);
  await writeFile(folder+'/result.json',JSON.stringify({scope:'Actual runtime/UI module regression with explicit assisted fixture; not novice or complete game signoff',final,pageErrors:errors},null,2)+'\n');
  console.log('PASS: guided output, neutral blank guidance, actual read/branches/repeat, own mapping, failed/corrected customer tests. Assisted fixture used; no novice signoff.');
}finally{await browser.close();}
