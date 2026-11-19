import test from 'node:test';
import assert from 'node:assert/strict';
import {observationFrames,observationIsCurrent} from '../../src/integration/observation-model.js';
import {performProgramLearningAction,blocksToProgram} from '../../src/program/index.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {createExampleBlocks} from '../../src/program/examples.js';

test('display frames show actual sampled inputs, executed decisions and writes; editing marks the record historical',async()=>{
  const context=await createProgramContext(await createHardwareContext()),wiring=createAutoLightExample(context.hardware.profile),blocks=createExampleBlocks(),program=blocksToProgram(blocks);
  const topology=await context.topologyFor(wiring);
  const result=performProgramLearningAction({actionId:'repeat-read',inputs:{},program:program.value,blockState:blocks,topology:topology.value});
  const action={request:{phase:'blocks',actionId:'repeat-read',program,wiring},result};
  assert.deepEqual(observationFrames(action).slice(0,3).map(f=>[f.atMs,f.light,f.branch,f.lamp]),[[0,150,true,true],[100,850,false,false],[200,180,true,true]]);
  assert.equal(observationFrames(action)[0].branchKind,'if');
  assert.equal(observationIsCurrent(action,{program,wiring}),true);
  const changed=structuredClone(program);changed.value.loop[1].condition.op='>';
  assert.equal(observationIsCurrent(action,{program:changed,wiring}),false);
  assert.deepEqual(observationFrames(null),[]);
  const output=performProgramLearningAction({actionId:'observe-output',inputs:{on:false},topology:topology.value});
  assert.equal(observationFrames({result:output})[0].light,null);
  assert.equal(observationFrames({result:output})[0].lamp,false);
});
