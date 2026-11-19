import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createMemoryProgressStore} from '../../src/integration/local-progress-store.js';
import {freshJourney,currentStoryScene,introducedTools,FIRST_ORDER_SCENES} from '../../src/integration/first-order-story.js';
import {wiringJourney} from '../../src/integration/wiring-journey.js';
import {guidedOutputComplete,readingGuidance} from '../../src/integration/work-guidance.js';
import {mentorScene} from '../../src/integration/mentor-scenes.js';
import {performProgramLearningAction,registerProgramBlocks} from '../../src/program/index.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import * as Blockly from 'blockly';
const context=await createProgramContext(await createHardwareContext());

test('saved narrative line resumes; reading every scene never supplies work, testing or income authority',async()=>{
  const store=createMemoryProgressStore();let work=await openLocalWorkspace({programContext:context,store});await work.start('剧情测试');
  assert.equal(currentStoryScene(work.getState()).id,'welcome');assert.deepEqual(introducedTools(work.getState()),['desk']);
  await work.saveJourney({sceneId:'welcome',line:2,paused:true});const before=work.getState();await work.close();
  work=await openLocalWorkspace({programContext:context,store});assert.deepEqual(work.getState().attempt.presentation.journey,before.attempt.presentation.journey);
  await work.saveJourney({seen:Object.fromEntries(Object.keys(FIRST_ORDER_SCENES).map(id=>[id,true]))});
  assert.equal(work.getState().facts.requirements.readyToAdvance,false);assert.equal(work.getState().facts.claimed,false);assert.equal(work.getState().ledger.income,0);assert.deepEqual(work.getState().attempt.observations,[]);
  await assert.rejects(work.settleSoftwareIncome(),{code:'SOFTWARE_NOT_READY'});await assert.rejects(work.saveJourney({passed:true}),{code:'STORY_FIELD'});await work.close();
});
test('old archive stays a continuing workplace; replay and restart do not overwrite old attempt or learner',async()=>{
  let work=await openLocalWorkspace({programContext:context,store:createMemoryProgressStore()});await work.start('旧员工');const backup=structuredClone(work.exportArchive());await work.close();
  delete backup.data.attempts[0].presentation.journey;const store=createMemoryProgressStore();await store.commit(0,backup.data);work=await openLocalWorkspace({programContext:context,store});
  assert.equal(currentStoryScene(work.getState()),null);const old=work.getState(),id=old.activeAttemptId;
  await work.saveJourney({replay:true,replayLine:1});await work.saveJourney({replay:false});assert.equal(work.getState().activeAttemptId,id);
  await work.restartOrder();assert.equal(work.getState().learner.id,old.learner.id);assert.equal(work.getState().attempt.presentation.journey.seen.welcome,true);
  await work.resumeAttempt(id);assert.equal(work.getState().attempt.presentation.journey.replayLine,1);assert.equal(work.getState().attempts.length,2);await work.close();
});
test('a correct first wire is pending rather than four mistakes; actual A1 wiring remains a highlighted fault',()=>{
  const wiring=context.hardware.createDocument();wiring.connections.push({id:'one',from:'uno:5V',to:'sensor:VCC'});
  const incomplete=context.hardware.validate(wiring),first=wiringJourney(wiring,incomplete);assert.equal(incomplete.ok,false);assert.deepEqual(first.faults,[]);assert.equal(first.next.from,'sensor:GND');
  wiring.connections.push({id:'wrong',from:'sensor:AO',to:'uno:A1'});const wrong=wiringJourney(wiring,context.hardware.validate(wiring));assert.ok(wrong.faults.length);assert.match(wrong.message,/A1.*A0/);
  assert.equal(freshJourney().version,'eq.first-order-story/1');
});
test('guided chapter waits for both actual executor outputs; reading advice follows the real empty slots rather than full-lamp output',async()=>{
  const wiring=createAutoLightExample(context.hardware.profile),topology=await context.topologyFor(wiring),state={facts:{claimed:true,requirements:{readyToAdvance:true},wiringValid:true,practice:{blocks:{current:{id:'read-input'}}}},attempt:{presentation:{journey:{...freshJourney(),seen:{welcome:true,client:true,wiring:true,lamp:true}}},draft:{wiring},observations:[],tests:[],snapshots:[],learningActions:[]}};
  for(const on of [true,false]){const result=performProgramLearningAction({actionId:'observe-output',inputs:{on},topology:topology.value});assert.equal(result.ok,true);state.attempt.learningActions.push({kind:'program-action',request:{phase:'blocks',actionId:'observe-output',inputs:{on},wiring},result});assert.equal(guidedOutputComplete(state),on===false);assert.equal(currentStoryScene(state)?.id,on?undefined:'reading');if(on){const mentor=mentorScene({state,activityId:'observe-output'});assert.match(mentor.lines[0],/熄灭/);assert.doesNotMatch(mentor.lines[0],/程序入口/);assert.equal(mentor.manualSection,'03.1');}}
  const review=mentorScene({state,tool:'wiring',topology:{ok:true}});assert.match(review.lines[0],/不用重新.*点灯/);assert.match(review.help,/复核/);assert.equal(state.facts.baseReady,undefined);
  if(!Blockly.Blocks.eqp_program)registerProgramBlocks(Blockly,context.hardware.executionProfile);
  const work=new Blockly.Workspace();try{const root=work.newBlock('eqp_program');let advice=readingGuidance(Blockly.serialization.workspaces.save(work));assert.match(advice.nextAction,/变量.*声明/);assert.doesNotMatch(advice.nextAction,/数字输出/);
    const declaration=work.newBlock('eqp_declare');declaration.setFieldValue('light','NAME');root.getInput('VARIABLES').connection.connect(declaration.previousConnection);
    advice=readingGuidance(Blockly.serialization.workspaces.save(work));assert.match(advice.nextAction,/初值.*数字 0/);
  }finally{work.dispose();}
});
