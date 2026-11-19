import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createWorkspacePolicies} from '../../src/integration/learning-policy-adapter.js';
import {createMemoryProgressStore} from '../../src/integration/local-progress-store.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {GRAPHIC_INTRO_KEY,graphicIntroFor,mentorSeed} from '../../src/program-teaching/progression.js';
import {recoverTeachingDraft} from '../../src/program-teaching/useTeachingProgress.js';
import {guidedOutputComplete} from '../../src/integration/work-guidance.js';

const answers={'req-light-input':'current-light','req-dark-action':'lamp-on','req-bright-action':'lamp-off','req-read-again':'read-decide-repeat','req-base-equality':'lamp-off','req-transfer-sequence':'trace-b'};
async function setup(){
  const context=await createProgramContext(await createHardwareContext()),policies=await createWorkspacePolicies(context),store=createMemoryProgressStore();
  const work=await openLocalWorkspace({programContext:context,policies,store});await work.start('合成入门策略验证',{graphicIntro:true});await work.claimOrder();
  for(let i=0;i<6;i++){const {challenge}=work.getState().facts.requirements;await work.reviewRequirements({attempt:{responseId:crypto.randomUUID(),checkpointId:challenge.checkpointId,optionId:answers[challenge.checkpointId],confidence:'ready-to-try'}});}
  await work.editDraft({wiring:createAutoLightExample(context.hardware.profile)});return {work,context,policies,store};
}
const inputs=(kind='output',actor='learner')=>({kind,actor,runId:crypto.randomUUID(),blockState:mentorSeed(kind),light:170,initialLamp:false});

test('real lesson runs remain separate from own complete program, customer tests and mentor evidence',async()=>{
  const {work,context,policies,store}=await setup();
  assert.equal(graphicIntroFor(work.getState()).phase,'g0-start');
  const demo=await work.performLearningAction({actionId:'graphic-intro-run',inputs:inputs('output','mentor')});
  assert.equal(demo.ok,true);assert.deepEqual(demo.observations,[]);assert.equal(work.getState().facts.learning.currentMilestoneId,'observe-output');
  const on=inputs(),first=await work.performLearningAction({actionId:'graphic-intro-run',inputs:on});assert.equal(first.value.studentOutput,true);
  const off=inputs();off.blockState.blocks.blocks[0].inputs.VALUE.block.fields.BOOL='FALSE';await work.performLearningAction({actionId:'graphic-intro-run',inputs:off});
  assert.equal(guidedOutputComplete(work.getState()),true);assert.equal(work.getState().facts.learning.currentMilestoneId,'read-input');
  const reading=await work.performLearningAction({actionId:'graphic-intro-run',inputs:inputs('reading')});
  assert.equal(reading.ok,true);assert.deepEqual(reading.observations,[]);assert.equal(work.getState().attempt.draft.blockState,null);
  assert.equal(work.getState().facts.learning.currentMilestoneId,'read-input');await assert.rejects(work.runTests('blocks'),{code:'BASE_PRACTICE_NOT_READY'});
  const before=work.getState().attempt.learningActions.length;await work.performLearningAction({actionId:'graphic-intro-run',inputs:on});assert.equal(work.getState().attempt.learningActions.length,before);
  await assert.rejects(work.performLearningAction({actionId:'graphic-intro-run',inputs:{...on,light:820}}),{code:'TEACHING_RUN_CONFLICT'});
  const saved=work.getState().attempt.learningActions;await work.close();const restored=await openLocalWorkspace({programContext:context,policies,store});
  assert.deepEqual(restored.getState().attempt.learningActions,saved);assert.equal(guidedOutputComplete(restored.getState()),true);assert.equal(restored.getState().ledger.income,0);
});

test('unmarked existing orders stay on their route; presentation completion cannot fabricate program evidence',async()=>{
  const {work,context,policies}=await setup();await work.saveLearning({[GRAPHIC_INTRO_KEY]:{...graphicIntroFor(work.getState()),phase:'complete'}});
  assert.equal(work.getState().facts.learning.currentMilestoneId,'observe-output');assert.equal(guidedOutputComplete(work.getState()),false);
  const before=work.getState().activeAttemptId;await work.restartOrder();assert.equal(graphicIntroFor(work.getState()),null);
  assert.notEqual(work.getState().activeAttemptId,before);assert.equal(work.getState().attempts.length,2);
  await work.restartOrder({graphicIntro:true});assert.equal(graphicIntroFor(work.getState()).phase,'g0-start');
  const legacy=await openLocalWorkspace({programContext:context,policies,store:createMemoryProgressStore()});await legacy.start('旧路径合成身份');assert.equal(graphicIntroFor(legacy.getState()),null);
});

test('journal restores only the current learner and unchanged writer lineage',()=>{
  const saved={version:'eq.graphic-intro/1',learnerId:'a',attemptId:'one',editSequence:2,writerId:'writer-a'};
  const record={...saved,editSequence:3,phase:'g3-operation'};
  const journal={record,baseSequence:2,baseWriter:'writer-a'};assert.equal(recoverTeachingDraft(saved,journal),record);
  assert.equal(recoverTeachingDraft({...saved,learnerId:'b'},journal).learnerId,'b');
  const external={...saved,writerId:'writer-b',editSequence:3};assert.equal(recoverTeachingDraft(external,journal),external);
  assert.equal(recoverTeachingDraft(saved,{...journal,record:{...record,attemptId:'two'}}),saved);
  const rapid={...journal,record:{...record,writerId:'new-page',editSequence:5},lineage:[{writerId:'writer-a',throughSequence:4}]};
  assert.equal(recoverTeachingDraft(saved,rapid),rapid.record);
  assert.equal(recoverTeachingDraft(external,rapid),external);
});
