import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createIndexedDbProgressStore} from '../../src/integration/local-progress-store.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {createExampleBlocks} from '../../src/program/examples.js';
import {fixturePolicies,fixtureAnswer} from './local-workspace.fixture.js';
const context=await createProgramContext(await createHardwareContext());
const work=await openLocalWorkspace({programContext:context,policies:fixturePolicies,store:createIndexedDbProgressStore({databaseName:'eq-local-progress-harness-only'})});
window.harness={work,context};
function state(){const s=work.getState();return {notice:'仅存储验证，教学策略为测试替身',storage:s.storage,revision:s.revision,learnerId:s.learner?.id??null,attemptId:s.activeAttemptId,stage:s.stage,income:s.ledger.income,incomeEvents:s.ledger.events.length,attempts:s.attempts.length,tests:s.attempt?.tests.map(t=>({id:t.id,passed:t.report.passed,invalidReason:t.invalidReason}))??[],source:s.attempt?.draft.shortSource??'',baseCurrent:s.facts.baseCurrent??false,codeCurrent:s.facts.codeCurrent??false};}
const render=()=>document.querySelector('#state').textContent=JSON.stringify(state(),null,2);
work.subscribe(render);render();window.render_game_to_text=()=>JSON.stringify(state());window.advanceTime=()=>{};
const button=(id,fn)=>document.querySelector(id).onclick=async()=>{try{document.querySelector('#error').textContent='';await fn();render();}catch(e){document.querySelector('#error').textContent=`${e.code??e.name}: ${e.message}`;}};
button('#run',async()=>{
  if(work.getState().learner)throw new Error('测试库已有记录，请继续、重开或使用新浏览器上下文。');
  await work.start('存储回归合成人物');await work.claimOrder();await work.reviewRequirements({attempt:fixtureAnswer()});
  await work.editDraft({wiring:createAutoLightExample(context.hardware.profile),blockState:createExampleBlocks()});
  await work.performLearningAction({actionId:'fixture-practice'});await work.runTests('blocks');await work.prepareCodeChange();
  await work.reviewRequirements({phase:'short-cpp',attempt:fixtureAnswer()});await work.performLearningAction({phase:'short-cpp',actionId:'fixture-mapping'});
  await work.runTests('short-cpp');await work.editDraft({shortSource:work.getState().attempt.draft.shortSource.replace('450','600')});
  await work.runTests('short-cpp');await work.settleSoftwareIncome();
});
button('#reload',()=>location.reload());button('#restart',()=>work.restartOrder());button('#resume',()=>work.resumeAttempt(work.getState().attempts[0].id));
