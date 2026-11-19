import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createWorkspacePolicies} from '../../src/integration/learning-policy-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createMemoryProgressStore} from '../../src/integration/local-progress-store.js';
import {createExampleBlocks} from '../../src/program/examples.js';
import {createProgramLearningMap} from '../../src/program/index.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
const answers={'req-light-input':'current-light','req-dark-action':'lamp-on','req-bright-action':'lamp-off','req-read-again':'read-decide-repeat','req-base-equality':'lamp-off','req-transfer-sequence':'trace-b','change-middle':'now-on','change-equality':'lamp-off','change-code-focus':'comparison','change-evidence':'new-current-suite'};
async function requirements(work,phase){
  while(true){const summary=phase==='blocks'?work.getState().facts.requirements:work.getState().facts.changeRequirements;if(summary.readyToAdvance)return;
    await work.reviewRequirements({phase,attempt:{responseId:crypto.randomUUID(),checkpointId:summary.checkpointId,optionId:answers[summary.checkpointId],confidence:'ready-to-try'}});
  }
}

test('real D + A + B learning path records only explicit actual actions and restores current evidence',async()=>{
  const context=await createProgramContext(await createHardwareContext()),policies=await createWorkspacePolicies(context),store=createMemoryProgressStore();
  const work=await openLocalWorkspace({programContext:context,policies,store});await work.start('真实模块合成回归');await work.claimOrder();
  const first=work.getState().facts.requirements;
  await work.reviewRequirements({attempt:{responseId:crypto.randomUUID(),checkpointId:first.checkpointId,optionId:'current-light',confidence:'ready-to-try',explanation:'我完全不懂，随便选的。'}});
  assert.equal(work.getState().facts.requirements.status,'needs-help');await requirements(work,'blocks');
  await work.editDraft({wiring:createAutoLightExample(context.hardware.profile)});
  assert.equal(work.getState().facts.programReady,false);assert.equal(work.getState().facts.programError,'');
  const output=await work.performLearningAction({actionId:'observe-output',inputs:{on:true}});assert.equal(output.ok,true);
  assert.deepEqual(output.value.factCodes,['guided_output_observed']);assert.equal(work.getState().attempt.draft.blockState,null);
  assert.equal(work.getState().facts.learning.currentMilestoneId,'read-input');
  const blocks=createExampleBlocks();await work.editDraft({blockState:blocks});
  await assert.rejects(work.runTests('blocks'),{code:'BASE_PRACTICE_NOT_READY'});
  for(const [actionId,inputs]of [['read-input',{light:150}],['branch-output',{scene:'dark'}],['branch-output',{scene:'bright'}],['repeat-read',{}]]){
    const result=await work.performLearningAction({actionId,inputs});assert.equal(result.ok,true);assert.equal(result.observations.length,1);
  }
  assert.equal(work.getState().facts.learning.readyForBaseTests,true);assert.equal(work.getState().facts.baseReady,false);
  await work.runTests('blocks');assert.equal(work.getState().facts.baseReady,true);await work.prepareCodeChange();
  const snapshotObservation=work.getState().attempt.observations.at(-1);assert.equal(snapshotObservation.binding.requirementRef.version,'1.0.0');
  await requirements(work,'short-cpp');
  const map=createProgramLearningMap(context.fromBlocks(blocks).value,{blockState:blocks}).value;
  await work.performLearningAction({phase:'short-cpp',actionId:'code-mapping',inputs:{nodeId:map.links.find(l=>l.concept==='comparison').nodeId}});
  assert.equal(work.getState().facts.learning.readyForChangeTests,true);
  assert.equal((await work.runTests('short-cpp')).proof.report.passed,false);
  await work.editDraft({shortSource:work.getState().attempt.draft.shortSource.replace('450','600')});
  assert.equal(work.getState().facts.learning.readyForChangeTests,true);
  assert.equal((await work.runTests('short-cpp')).proof.report.passed,true);assert.equal(work.getState().facts.codeReady,true);
  await work.settleSoftwareIncome();await work.close();
  const restored=await openLocalWorkspace({programContext:context,policies,store});
  assert.equal(restored.getState().stage,'software-complete');assert.equal(restored.getState().ledger.income,100);
  assert.equal(restored.getState().attempt.observationInvalidations.length,0);
  const proof=restored.getState().attempt.snapshots.at(-1);
  assert.match(proof.binding.reviewEvidence.responsesDigest,/^sha256:/);assert.match(proof.binding.reviewEvidence.lessonRef.digest,/^sha256:/);
  assert.equal(restored.getState().attempt.tests[1].report.passed,false);
  // A fresh base report cannot silently leave a new change report stale on arrival.
  const exactSource=restored.getState().attempt.draft.shortSource;
  await restored.runTests('blocks');
  assert.equal(restored.getState().facts.baseReady,true);assert.equal(restored.getState().facts.codeBaseCurrent,false);
  assert.equal(restored.getState().facts.canKeepCodeOnBaseRefresh,true);
  assert.equal(restored.getState().facts.guidance.diagnostic.code,'CODE_BASE_CHANGED');
  const count=restored.getState().attempt.tests.length;
  await assert.rejects(restored.runTests('short-cpp'),{code:'CODE_BASE_CHANGED'});
  assert.equal(restored.getState().attempt.tests.length,count);
  await restored.prepareCodeChange();
  assert.equal(restored.getState().attempt.draft.shortSource,exactSource);assert.equal(restored.getState().facts.codeBaseCurrent,true);
  assert.equal(restored.getState().facts.codeCurrent,false);
  await restored.runTests('short-cpp');assert.equal(restored.getState().facts.codeReady,true);
  await restored.settleSoftwareIncome();assert.equal(restored.getState().ledger.income,100);assert.equal(restored.getState().ledger.events.length,1);
  await restored.close();
  const again=await openLocalWorkspace({programContext:context,policies,store});
  assert.equal(again.getState().facts.codeReady,true);assert.equal(again.getState().attempt.draft.shortSource,exactSource);assert.equal(again.getState().ledger.income,100);
  const changedBlocks=structuredClone(again.getState().attempt.draft.blockState);
  const changeWait=value=>{if(!value||typeof value!=='object')return;if(value.type==='eqp_wait')value.inputs.MS.block.fields.NUM=50;else for(const child of Object.values(value))changeWait(child);};
  changeWait(changedBlocks);await again.editDraft({blockState:changedBlocks});
  for(const [actionId,inputs]of [['read-input',{light:150}],['branch-output',{scene:'dark'}],['branch-output',{scene:'bright'}],['repeat-read',{}]])await again.performLearningAction({actionId,inputs});
  await again.runTests('blocks');assert.equal(again.getState().facts.baseReady,true);assert.equal(again.getState().facts.canKeepCodeOnBaseRefresh,false);
  await assert.rejects(again.prepareCodeChange(),{code:'CODE_REBASE_REQUIRED'});assert.equal(again.getState().attempt.draft.shortSource,exactSource);
  await again.prepareCodeChange({replaceCode:true});assert.match(again.getState().attempt.draft.shortSource,/waitMs\(50\)/);assert.equal(again.getState().attempt.textHistory.at(-1).source,exactSource);
  assert.equal(again.getState().facts.codeCurrent,false);assert.equal(again.getState().ledger.income,100);await again.close();
});
