import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createWorkspacePolicies} from '../../src/integration/learning-policy-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createMemoryProgressStore} from '../../src/integration/local-progress-store.js';
import {previousPracticeActions} from '../../src/integration/practice-presentation.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {createExampleBlocks} from '../../src/program/examples.js';

test('editing at branches retains the teaching position while real current prerequisites must be rerun in order',async()=>{
  const context=await createProgramContext(await createHardwareContext()),policies=await createWorkspacePolicies(context),store=createMemoryProgressStore();
  let work=await openLocalWorkspace({programContext:context,policies,store});
  await work.start('教学位置回归');await work.claimOrder();
  for(const optionId of ['current-light','lamp-on','lamp-off','read-decide-repeat','lamp-off','trace-b'])await work.reviewRequirements({attempt:{responseId:crypto.randomUUID(),checkpointId:work.getState().facts.requirements.checkpointId,optionId,confidence:'ready-to-try'}});
  await work.editDraft({wiring:createAutoLightExample(context.hardware.profile),blockState:createExampleBlocks()});
  await work.performLearningAction({actionId:'observe-output',inputs:{on:true}});
  await work.performLearningAction({actionId:'read-input',inputs:{light:150}});
  const original=work.getState();assert.equal(original.facts.practice.blocks.current.id,'branch-output');
  const changed=structuredClone(original.attempt.draft.blockState);
  changed.blocks.blocks[0].inputs.VARIABLES.block.inputs.INITIAL.block.fields.NUM=449;
  await work.editDraft({blockState:changed});
  let state=work.getState();assert.equal(state.facts.learning.current.id,'read-input');assert.equal(state.facts.practice.blocks.current.id,'branch-output');
  assert.deepEqual(state.facts.practice.blocks.rechecks.map(r=>r.id),['read-input']);
  await assert.rejects(work.runTests('blocks'),{code:'BASE_PRACTICE_NOT_READY'});
  await work.close();work=await openLocalWorkspace({programContext:context,policies,store});
  assert.equal(work.getState().facts.practice.blocks.current.id,'branch-output');
  for(const request of previousPracticeActions(work.getState().attempt,'read-input'))await work.performLearningAction(request);
  for(const scene of ['dark','bright'])await work.performLearningAction({actionId:'branch-output',inputs:{scene}});
  assert.equal(work.getState().facts.practice.blocks.current.id,'repeat-read');
  await work.performLearningAction({actionId:'repeat-read',inputs:{}});
  assert.equal(work.getState().facts.learning.readyForBaseTests,true);
  assert.equal((await work.runTests('blocks')).proof.report.passed,false); // 449 is still the wrong customer boundary.
  assert.equal(work.getState().facts.baseReady,false);
  await work.saveLearning({passed:true,current:'software-income'});assert.equal(work.getState().facts.baseReady,false);
  await work.close();
});
