import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import {inspectProgramWorkspace,explainProgramDiagnostic,createProgramLearningMap,parseShortCpp,generateShortCpp,blocksToProgram,registerProgramBlocks,
  getLearningStarter,runLearningExercise,createLearningRecord,recordLearningSupport,recordLearningPrediction,recordLearningAttempt,observeLearningEvidence,assessLearningRecord,performProgramLearningAction} from '../../src/program/index.js';
import {SYNTHETIC_DEVICE as device,SYNTHETIC_TOPOLOGY as topology,AUTO_LIGHT_SOURCE,createExampleBlocks} from '../../src/program/examples.js';
const good=r=>{assert.equal(r.ok,true,JSON.stringify(r.diagnostics));return r.value;};
const parse=s=>good(parseShortCpp(s));
const repaired='int light = 0; void loop() { light = readAnalog(LIGHT); if(light < 450) { writeDigital(LAMP,true); } else { writeDigital(LAMP,false); } waitMs(100); }';
const hold='int light = 0; void loop() { light = readAnalog(LIGHT); if(light < 400) { writeDigital(LAMP,true); } if(light > 600) { writeDigital(LAMP,false); } waitMs(100); }';

test('empty/entry/holes/orphans have concrete neutral next actions without silently changing the workspace',()=>{
  const empty={};assert.equal(inspectProgramWorkspace(empty).state,'empty');assert.deepEqual(empty,{});
  assert.match(inspectProgramWorkspace(empty).guidance.nextAction,/程序入口/);
  const root={blocks:{blocks:[{id:'root',type:'eqp_program'}]}};
  assert.equal(inspectProgramWorkspace(root).state,'needs_structure');assert.equal(inspectProgramWorkspace(root).guidance.focus.inputName,'LOOP');
  const missing=structuredClone(root);missing.blocks.blocks[0].inputs={LOOP:{block:{id:'wait',type:'eqp_wait'}}};
  const inspected=inspectProgramWorkspace(missing);assert.equal(inspected.state,'invalid');assert.equal(inspected.guidance.focus.blockId,'wait');assert.equal(inspected.guidance.focus.inputName,'MS');assert.match(inspected.guidance.observation,/毫秒/);
  assert.equal(inspectProgramWorkspace({blocks:{blocks:[{type:'eqp_write',id:'orphan'}]}}).state,'needs_structure');
  assert.equal(inspectProgramWorkspace({blocks:{blocks:{}}}).state,'invalid');
  assert.match(explainProgramDiagnostic({code:'TYPE_MISMATCH',message:'int/bool'}).nextAction,/比较/);
});

test('real Blockly can be built from no blocks into a runnable first program without loading reference state',()=>{
  registerProgramBlocks(Blockly,device);const w=new Blockly.Workspace();
  try{
    const initial=Blockly.serialization.workspaces.save(w);assert.equal(inspectProgramWorkspace(initial).state,'empty');
    const root=w.newBlock('eqp_program'),write=w.newBlock('eqp_write'),on=w.newBlock('logic_boolean'),wait=w.newBlock('eqp_wait'),duration=w.newBlock('math_number');
    on.setFieldValue('TRUE','BOOL');duration.setFieldValue(100,'NUM');
    root.getInput('LOOP').connection.connect(write.previousConnection);write.getInput('VALUE').connection.connect(on.outputConnection);write.nextConnection.connect(wait.previousConnection);wait.getInput('MS').connection.connect(duration.outputConnection);
    const saved=Blockly.serialization.workspaces.save(w),inspected=inspectProgramWorkspace(saved);
    assert.equal(inspected.canRun,true);assert.equal(inspected.observations.find(o=>o.id==='output').observed,true);
    assert.match(inspected.guidance.nextAction,/读取 LIGHT/);
    assert.match(inspectProgramWorkspace(saved,{activityId:'branch-output'}).guidance.nextAction,/比较/);
    assert.match(inspectProgramWorkspace(saved,{activityId:'observe-output'}).guidance.nextAction,/先预测/);
    assert.equal(good(runLearningExercise({exerciseId:'first-output',blockState:saved,topology})).behaviorPassed,true);
  }finally{w.dispose();}
});

test('every IR node maps to an exact code slice, including nested comparison and literals',()=>{
  const p=good(blocksToProgram(createExampleBlocks())),mapped=good(createProgramLearningMap(p,{blockState:createExampleBlocks()}));
  for(const link of mapped.links)assert.equal(mapped.source.slice(link.generatedRange.start,link.generatedRange.end),link.code);
  assert.equal(mapped.links.find(l=>l.concept==='comparison').code,'(light < threshold)');
  assert.ok(mapped.links.some(l=>l.concept==='value'&&l.code==='450'));
  assert.ok(mapped.links.some(l=>l.label.includes('LIGHT')&&l.code==='readAnalog(LIGHT)'));
  assert.equal(mapped.links.find(l=>l.path==='loop').blockId,createExampleBlocks().blocks.blocks[0].id);
  const parsed=parse(mapped.source),again=good(createProgramLearningMap(parsed));
  const read=again.links.find(l=>l.concept==='input');assert.equal(mapped.source.slice(read.originalRange.start,read.originalRange.end),'readAnalog(LIGHT)');
  assert.equal(good(generateShortCpp(parsed)).source,mapped.source);
});

test('a stale startup read produces a real counterexample and can be inspected before repair',()=>{
  const source=good(getLearningStarter('repair-stale-read')).source;
  const failed=good(runLearningExercise({exerciseId:'repair-stale-read',source,topology}));
  assert.equal(failed.behaviorPassed,false);const counter=failed.runs[0].feedback.counterexamples[0];
  assert.equal(counter.atMs,100);assert.equal(counter.expected,false);assert.equal(counter.actual,true);assert.equal(counter.inputs.LIGHT,850);assert.equal(counter.lastRead.atMs,0);assert.equal(counter.lastRead.value,150);
  assert.equal(source.slice(failed.mapping.links.find(l=>l.nodeId===counter.lastRead.nodeId).originalRange.start,failed.mapping.links.find(l=>l.nodeId===counter.lastRead.nodeId).originalRange.end),'readAnalog(LIGHT)');
  assert.equal(good(runLearningExercise({exerciseId:'repair-stale-read',source:repaired,topology})).behaviorPassed,true);
});

test('copying the full reference remains assisted and cannot complete the learning record',()=>{
  let record=createLearningRecord();record=good(recordLearningSupport(record,{kind:'example'}));
  const input={exerciseId:'follow-light',source:AUTO_LIGHT_SOURCE,topology};record=good(recordLearningPrediction(record,{...input,predicted:false}));record=good(recordLearningAttempt(record,input)).record;
  const result=assessLearningRecord(record);assert.equal(result.hasExampleSupport,true);assert.equal(result.status,'collecting_evidence');assert.equal(result.understanding,'not_assessed');assert.equal(result.independentCompletion,'not_established');
  assert.equal(record.attempts[0].behaviorPassed,true);assert.equal(result.steps.find(s=>s.id==='repair-stale-read').evidenceRecorded,false);
});

test('a prediction bound to old code cannot be reused; viewing only initial/stop is not debugging',()=>{
  let record=createLearningRecord();record=good(recordLearningPrediction(record,{exerciseId:'first-output',source:'void loop(){writeDigital(LAMP,true);waitMs(100);}',predicted:true}));
  const execution=good(recordLearningAttempt(record,{exerciseId:'first-output',source:'void loop(){writeDigital(LAMP,true);waitMs(50);}',topology}));
  assert.equal(execution.attempt.prediction,null);
  assert.equal(observeLearningEvidence(execution.record,{attemptId:execution.attempt.id,testId:execution.attempt.runs[0].testId,eventIndex:0}).ok,false);
});

test('only a failed prediction/run, relevant inspection, changed successful repair and transfer produce review evidence',()=>{
  let record=createLearningRecord();
  function attempt(exerciseId,source,predicted){const input={exerciseId,source,topology};record=good(recordLearningPrediction(record,{...input,predicted}));const execution=good(recordLearningAttempt(record,input));record=execution.record;return execution.attempt;}
  attempt('first-output','void loop(){writeDigital(LAMP,true);waitMs(100);}',true);attempt('follow-light',repaired,false);
  const failed=attempt('repair-stale-read',good(getLearningStarter('repair-stale-read')).source,true);
  attempt('repair-stale-read',repaired,false);
  assert.equal(assessLearningRecord(record).steps.find(s=>s.id==='repair-stale-read').evidenceRecorded,false);
  const run=failed.runs[0],readIndex=run.simulation.events.findIndex(e=>e.kind==='read');
  record=good(observeLearningEvidence(record,{attemptId:failed.id,testId:run.testId,eventIndex:readIndex}));
  assert.equal(assessLearningRecord(record).steps.find(s=>s.id==='repair-stale-read').evidenceRecorded,false);
  attempt('repair-stale-read',repaired,false);
  assert.equal(assessLearningRecord(record).steps.find(s=>s.id==='repair-stale-read').evidenceRecorded,true);
  for(const threshold of [100,400,450,600,700])assert.equal(good(runLearningExercise({exerciseId:'hold-between-bounds',source:AUTO_LIGHT_SOURCE.replace('450',String(threshold)),topology})).behaviorPassed,false);
  attempt('hold-between-bounds',hold,true);assert.equal(assessLearningRecord(record).status,'ready_for_review');assert.equal(assessLearningRecord(record).understanding,'not_assessed');
});

test('E action interface produces one operation worth of source-specific facts, never all milestone flags',()=>{
  const p=parse(AUTO_LIGHT_SOURCE);
  for(const [actionId,inputs,expected]of [['observe-output',{on:true},['guided_output_observed']],['read-input',{light:700},['current_input_read_observed']],['branch-output',{scene:'dark'},['dark_branch_observed']],['branch-output',{scene:'bright'},['bright_branch_observed']],['repeat-read',{},['repeated_current_read_observed']]]){
    const observed=good(performProgramLearningAction({actionId,inputs,program:p,topology}));assert.deepEqual(observed.factCodes,expected);assert.equal(observed.facts[0].source,'program-runtime');assert.equal(observed.simulation.status,'completed');
  }
  const source=good(getLearningStarter('repair-stale-read')).source;
  assert.deepEqual(good(performProgramLearningAction({actionId:'repeat-read',inputs:{},program:parse(source),topology})).factCodes,[]);
  assert.deepEqual(good(performProgramLearningAction({actionId:'repeat-read',inputs:{},program:parse(AUTO_LIGHT_SOURCE.replace('waitMs(100)','waitMs(30)')),topology})).factCodes,['repeated_current_read_observed']);
  const override=parse('void loop(){ if(readAnalog(LIGHT)<450){writeDigital(LAMP,true);} writeDigital(LAMP,false); waitMs(100); }');
  assert.deepEqual(good(performProgramLearningAction({actionId:'branch-output',inputs:{scene:'dark'},program:override,topology})).factCodes,[]);
  const held=parse('int n=0; void loop(){ if(n==0){writeDigital(LAMP,readAnalog(LIGHT)<450);} n=n+1; waitMs(100); }');
  const fact=good(performProgramLearningAction({actionId:'branch-output',inputs:{scene:'dark'},program:held,topology})).facts[0];
  assert.equal(fact.payload.branch.branch,true);assert.ok(fact.payload.branch.step<fact.payload.event.step);
  assert.equal(performProgramLearningAction({actionId:'base-delivery',inputs:{passed:true},program:p,topology}).ok,false);
  assert.equal(performProgramLearningAction({actionId:'read-input',inputs:{light:150,passed:true},program:p,topology}).ok,false);
  const state=createExampleBlocks(),ir=good(blocksToProgram(state)),comparison=good(createProgramLearningMap(ir)).links.find(l=>l.concept==='comparison');
  const mapped=good(performProgramLearningAction({actionId:'code-mapping',inputs:{nodeId:comparison.nodeId},blockState:state}));assert.deepEqual(mapped.factCodes,['own_comparison_mapping_observed']);assert.equal(mapped.facts[0].source,'program-analysis');
  assert.equal(mapped.factCodes.includes('own_blocks_snapshot_preserved'),false);
  assert.equal(performProgramLearningAction({actionId:'code-mapping',inputs:{nodeId:'arbitrary'},blockState:state}).ok,false);
});
