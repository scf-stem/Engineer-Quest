import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createWorkspacePolicies} from '../../src/integration/learning-policy-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createMemoryProgressStore} from '../../src/integration/local-progress-store.js';
import {currentStoryScene,pendingStoryResult} from '../../src/integration/first-order-story.js';
import {createExampleBlocks} from '../../src/program/examples.js';
import {createProgramLearningMap} from '../../src/program/index.js';
import {createAutoLightExample} from '../../src/hardware/index.js';

const answers={'req-light-input':'current-light','req-dark-action':'lamp-on','req-bright-action':'lamp-off','req-read-again':'read-decide-repeat','req-base-equality':'lamp-off','req-transfer-sequence':'trace-b','change-middle':'now-on','change-equality':'lamp-off','change-code-focus':'comparison','change-evidence':'new-current-suite'};
async function review(work,phase='blocks'){
  while(true){const r=phase==='blocks'?work.getState().facts.requirements:work.getState().facts.changeRequirements;if(r.readyToAdvance)return;await work.reviewRequirements({phase,attempt:{responseId:crypto.randomUUID(),checkpointId:r.checkpointId,optionId:answers[r.checkpointId],confidence:'ready-to-try'}});}
}
async function acknowledge(work){const r=pendingStoryResult(work.getState());await work.saveJourney({resultContinued:{[r.id]:r.key}});return r;}

test('actual results persist before dialogue; only their explicit matching continuation opens the next scene',async()=>{
  const context=await createProgramContext(await createHardwareContext()),policies=await createWorkspacePolicies(context),store=createMemoryProgressStore();
  let work=await openLocalWorkspace({programContext:context,policies,store});await work.start('结果停留合成检查');await work.claimOrder();await review(work);
  await work.editDraft({wiring:createAutoLightExample(context.hardware.profile),blockState:createExampleBlocks()});
  await work.saveJourney({seen:{welcome:true,client:true,wiring:true,lamp:true,reading:true}});
  await work.performLearningAction({actionId:'observe-output',inputs:{on:true}});
  await work.performLearningAction({actionId:'read-input',inputs:{light:150}});
  const first=pendingStoryResult(work.getState());assert.equal(first.id,'branch');assert.equal(currentStoryScene(work.getState()),null);
  const observations=work.getState().attempt.observations.length;await work.close();
  work=await openLocalWorkspace({programContext:context,policies,store});assert.equal(pendingStoryResult(work.getState()).key,first.key);
  await work.saveJourney({resultContinued:{branch:'another-result'}});assert.equal(pendingStoryResult(work.getState()).id,'branch');
  await acknowledge(work);assert.equal(currentStoryScene(work.getState()).id,'branch');assert.equal(work.getState().attempt.observations.length,observations);
  await work.saveJourney({seen:{branch:true}});
  for(const scene of ['dark','bright'])await work.performLearningAction({actionId:'branch-output',inputs:{scene}});
  assert.equal(pendingStoryResult(work.getState()).id,'repeat');assert.equal(currentStoryScene(work.getState()),null);
  await acknowledge(work);assert.equal(currentStoryScene(work.getState()).id,'repeat');await work.saveJourney({seen:{repeat:true}});
  await work.performLearningAction({actionId:'repeat-read',inputs:{}});await work.runTests('blocks');
  const base=pendingStoryResult(work.getState());assert.equal(base.id,'base');assert.equal(base.proof.report.passed,true);assert.equal(currentStoryScene(work.getState()),null);
  await acknowledge(work);assert.equal(currentStoryScene(work.getState()).id,'base');await work.saveJourney({seen:{base:true}});await work.prepareCodeChange();
  await review(work,'short-cpp');await work.saveJourney({seen:{change:true,code:true}});
  const blocks=work.getState().attempt.draft.blockState,map=createProgramLearningMap(context.fromBlocks(blocks).value,{blockState:blocks}).value;
  await work.performLearningAction({phase:'short-cpp',actionId:'code-mapping',inputs:{nodeId:map.links.find(l=>l.concept==='comparison').nodeId}});
  await work.editDraft({shortSource:work.getState().attempt.draft.shortSource.replace('450','600')});await work.runTests('short-cpp');
  const delivery=pendingStoryResult(work.getState());assert.equal(delivery.id,'delivery');assert.equal(work.getState().ledger.income,0);
  await acknowledge(work);assert.equal(currentStoryScene(work.getState()).id,'delivery');await work.runTests('short-cpp');
  assert.notEqual(pendingStoryResult(work.getState()).key,delivery.key);assert.equal(currentStoryScene(work.getState()),null);
  await work.close();
});

test('reading-position acknowledgements cannot manufacture any work or income and reject unrelated fields',async()=>{
  const context=await createProgramContext(await createHardwareContext()),work=await openLocalWorkspace({programContext:context,store:createMemoryProgressStore()});await work.start('阅读位置不是通过');
  await work.saveJourney({resultContinued:{branch:'invented',repeat:'invented',base:'invented',delivery:'invented'}});
  assert.equal(work.getState().facts.baseReady,false);assert.equal(work.getState().facts.codeReady,false);assert.equal(work.getState().ledger.income,0);assert.equal(pendingStoryResult(work.getState()),null);
  await assert.rejects(work.saveJourney({resultContinued:{customerPassed:'yes'}}),{code:'STORY_FIELD'});await assert.rejects(work.saveJourney({resultContinued:true}),{code:'STORY_FIELD'});
  await assert.rejects(work.settleSoftwareIncome(),{code:'SOFTWARE_NOT_READY'});await work.close();
});
