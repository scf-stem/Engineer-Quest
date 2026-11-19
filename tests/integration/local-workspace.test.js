import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createMemoryProgressStore,ProgressStoreError} from '../../src/integration/local-progress-store.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {createExampleBlocks} from '../../src/program/examples.js';
import {fixturePolicies,fixtureAnswer} from './local-workspace.fixture.js';
const context=await createProgramContext(await createHardwareContext());
async function setup({policies=fixturePolicies,store=createMemoryProgressStore()}={}){
  const work=await openLocalWorkspace({programContext:context,store,policies});
  await work.start('本机合成测试');await work.claimOrder();
  return {work,store};
}
async function baseReady(work){
  await work.reviewRequirements({attempt:fixtureAnswer()});
  await work.editDraft({wiring:createAutoLightExample(context.hardware.profile),blockState:createExampleBlocks()});
  await work.performLearningAction({actionId:'fixture-practice'});
  const result=await work.runTests('blocks');assert.equal(result.proof.report.passed,true);
}
async function codeReady(work){
  await baseReady(work);await work.prepareCodeChange();
  await work.reviewRequirements({phase:'short-cpp',attempt:fixtureAnswer()});
  await work.performLearningAction({phase:'short-cpp',actionId:'fixture-mapping'});
  // Wrong customer change remains a genuine failing independent run.
  assert.equal((await work.runTests('short-cpp')).proof.report.passed,false);
  await work.editDraft({shortSource:work.getState().attempt.draft.shortSource.replace('450','600')});
  assert.equal((await work.runTests('short-cpp')).proof.report.passed,true);
}

test('refresh restores identity, source, replayed learning, failed/successful evidence and one synthetic income',async()=>{
  const {work,store}=await setup();await codeReady(work);
  const event=await work.settleSoftwareIncome(),before=work.getState();
  assert.equal(before.stage,'software-complete');assert.equal(before.ledger.income,100);
  assert.equal(before.attempt.tests.length,3);assert.equal(before.attempt.tests[1].report.passed,false);
  assert.equal((await work.settleSoftwareIncome()).id,event.id);
  await work.close();
  const restored=await openLocalWorkspace({programContext:context,store,policies:fixturePolicies});
  const state=restored.getState();assert.equal(state.storage.status,'restored');
  assert.equal(state.learner.id,before.learner.id);assert.equal(state.activeAttemptId,before.activeAttemptId);
  assert.equal(state.stage,'software-complete');assert.equal(state.ledger.income,100);
  assert.equal(state.attempt.draft.shortSource,before.attempt.draft.shortSource);
  assert.deepEqual(state.attempt.tests,before.attempt.tests);assert.equal(state.attempt.observationInvalidations.length,0);
  assert.equal((await restored.settleSoftwareIncome()).id,event.id);
  await assert.rejects(restored.start('覆盖旧员工'),{code:'LOCAL_WORK_EXISTS'});
  await restored.restartOrder();assert.equal(restored.getState().ledger.income,100);assert.equal(restored.getState().stage,'claim-order');
  await restored.claimOrder();await codeReady(restored);assert.equal((await restored.settleSoftwareIncome()).id,event.id);
  assert.equal(restored.getState().ledger.events.length,1);
  await restored.resumeAttempt(before.activeAttemptId);assert.equal(restored.getState().stage,'software-complete');
  assert.equal(restored.exportArchive().data.attempts.length,2);await restored.close();
});

test('navigation, raw input, and a complete example cannot grant teaching evidence',async()=>{
  const {work}=await setup({policies:{}});
  await work.editDraft({requirementCard:{input:'light-sensor',condition:'below-customer-threshold',output:'dark-on-bright-off',continuous:'repeat-read-decide',explanation:'我完全不懂，随便选的。'},wiring:createAutoLightExample(context.hardware.profile),blockState:createExampleBlocks()});
  await work.savePresentation({view:'income',tool:'code'});await work.saveLearning({passed:true});
  assert.equal(work.getState().stage,'requirements');
  await assert.rejects(work.runTests('blocks'),{code:'REQUIREMENTS_NOT_READY'});
  await assert.rejects(work.settleSoftwareIncome(),{code:'SOFTWARE_NOT_READY'});await work.close();
  const configured=await setup();await configured.work.reviewRequirements({attempt:fixtureAnswer()});
  await configured.work.editDraft({wiring:createAutoLightExample(context.hardware.profile),blockState:createExampleBlocks()});
  await assert.rejects(configured.work.runTests('blocks'),{code:'BASE_PRACTICE_NOT_READY'});await configured.work.close();
});

test('wiring layout changes keep evidence; semantic edit and revert require a new run',async()=>{
  const {work}=await setup();await codeReady(work);
  const state=work.getState(),original=structuredClone(state.attempt.draft.wiring),moved=structuredClone(original);
  const wrappedBlocks={workspace:structuredClone(state.attempt.draft.blockState)};wrappedBlocks.workspace.blocks.blocks[0].x=123;
  await work.editDraft({blockState:wrappedBlocks});assert.equal(work.getState().facts.baseCurrent,true);assert.equal(work.getState().facts.codeCurrent,true);
  moved.components[0].position.x+=10;await work.editDraft({wiring:moved});
  assert.equal(work.getState().facts.codeCurrent,true);
  const incomplete={...moved,connections:moved.connections.slice(1)};await work.editDraft({wiring:incomplete});
  assert.equal(work.getState().facts.baseCurrent,false);assert.equal(work.getState().stage,'wiring');
  await work.editDraft({wiring:original});assert.equal(work.getState().facts.baseCurrent,false);
  assert.equal(work.getState().attempt.tests.length,3);
  await work.runTests('blocks');assert.equal(work.getState().facts.baseReady,true);assert.equal(work.getState().facts.codeCurrent,false);
  await work.prepareCodeChange();assert.equal(work.getState().attempt.draft.shortSource,state.attempt.draft.shortSource);
  await work.runTests('short-cpp');assert.equal(work.getState().facts.codeReady,true);await work.close();
});

test('unsaved input remains exportable and blocks rewards; save retry and conflict reload are explicit',async()=>{
  const memory=createMemoryProgressStore();let unavailable=false;
  const store={...memory,commit:(version,data)=>unavailable?Promise.reject(new ProgressStoreError('STORAGE_QUOTA','磁盘空间不足')):memory.commit(version,data)};
  const {work}=await setup({store});unavailable=true;
  await assert.rejects(work.editDraft({shortSource:'我的修改还在页面'}),{code:'STORAGE_QUOTA'});
  assert.equal(work.getState().storage.status,'unsaved');assert.equal(work.exportArchive().data.attempts[0].draft.shortSource,'我的修改还在页面');
  await assert.rejects(work.restartOrder(),{code:'SAVE_BLOCKED'});
  unavailable=false;await work.retrySave();assert.equal(work.getState().storage.status,'saved');
  const other=await openLocalWorkspace({programContext:context,store:memory,policies:fixturePolicies});
  await other.savePresentation({tool:'manual'});
  await assert.rejects(work.savePresentation({tool:'code'}),{code:'REVISION_CONFLICT'});
  assert.equal(work.getState().attempt.presentation.tool,'code');await work.reload();
  assert.equal(work.getState().attempt.presentation.tool,'manual');assert.equal(work.getState().attempt.draft.shortSource,'我的修改还在页面');
  await work.close();await other.close();
});

test('restore reruns actual reports and teaching actions; new executor cannot reuse stale approvals',async()=>{
  const {work,store}=await setup();await codeReady(work);await work.settleSoftwareIncome();await work.close();
  const changedContext={...context,evaluateSoftware:async()=>({passed:false,cases:[{name:'新执行器规则',passed:false}]})};
  const changed=await openLocalWorkspace({programContext:changedContext,store,policies:fixturePolicies});
  assert.equal(changed.getState().facts.baseCurrent,false);assert.equal(changed.getState().facts.codeReady,false);
  assert.equal(changed.getState().attempt.tests.length,3);assert.equal(changed.getState().ledger.income,100);
  assert.ok(changed.getState().attempt.tests.every(t=>t.invalidReason));
  await assert.rejects(changed.settleSoftwareIncome(),{code:'SOFTWARE_NOT_READY'});await changed.close();
});

test('resetting change review keeps base evidence and archives the original change responses',async()=>{
  const {work}=await setup();await codeReady(work);
  const original=structuredClone(work.getState().attempt.reviews.change);
  await work.resetRequirementReview('short-cpp');
  assert.equal(work.getState().facts.requirements.readyToAdvance,true);
  assert.equal(work.getState().facts.baseCurrent,true);assert.equal(work.getState().facts.codeCurrent,false);
  assert.deepEqual(work.getState().attempt.reviewHistory.at(-1).review,original);
  assert.equal(work.getState().facts.changeRequirements.readyToAdvance,false);await work.close();
});
