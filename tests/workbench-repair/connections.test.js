import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import {registerProgramBlocks} from '../../src/program/index.js';
import {SYNTHETIC_DEVICE} from '../../src/program/examples.js';
import {listConnectionTargets,placementDecision,placeBlock,describeConnection,nativeDropFeedback} from '../../src/integration/block-connections.js';
import {workbenchFixture} from './fixtures.js';
registerProgramBlocks(Blockly,SYNTHETIC_DEVICE);
const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
const chain=w=>{const ids=[];let block=w.getBlockById('root').getInputTargetBlock('LOOP');while(block){ids.push(block.id);block=block.getNextBlock();}return ids;};
function setup(options){const w=new Blockly.Workspace();Blockly.Events.disable();try{Blockly.serialization.workspaces.load(workbenchFixture(options),w);}finally{Blockly.Events.enable();}w.clearUndo();return w;}
const target=(w,id)=>listConnectionTargets(w,Blockly).find(target=>target.id===id);
async function move(w,id,destination,mode='single'){Blockly.Events.setGroup(true);try{placeBlock(w,Blockly,w.getBlockById(id),target(w,destination),{mode});}finally{Blockly.Events.setGroup(false);}await pause();}

test('all statement inputs and before/after targets exist alongside unchanged value IDs',()=>{
  const w=setup();try{const targets=listConnectionTargets(w,Blockly);for(const id of ['root|LOOP','root|SETUP','root|VARIABLES','if|DO0','if|ELSE','read|@before','read|@after','if|IF0'])assert.ok(targets.some(target=>target.id===id),id);assert.equal(target(w,'if|DO0').kind,'statement');assert.equal(target(w,'if|IF0').kind,'value');}finally{w.dispose();}
});
test('moving one if preserves both branch subtrees and original wait; real grouped undo restores graph',async()=>{
  const w=setup({branches:true});try{
    const before=Blockly.serialization.workspaces.save(w);
    await move(w,'if','read|@after');assert.deepEqual(chain(w),['read','if','wait']);
    assert.equal(w.getBlockById('if').getInputTargetBlock('DO0').id,'on');assert.equal(w.getBlockById('if').getInputTargetBlock('ELSE').id,'off');
    w.undo(false);await pause();assert.deepEqual(Blockly.serialization.workspaces.save(w),before);
  }finally{w.dispose();}
});
test('single move can target its old next chain but cannot target itself or its own branch',async()=>{
  const w=setup({branches:true,correct:true});try{
    assert.equal(placementDecision(w,w.getBlockById('if'),target(w,'wait|@after')).allowed,true);
    assert.equal(placementDecision(w,w.getBlockById('if'),target(w,'wait|@after'),{mode:'chain'}).allowed,false);
    assert.equal(placementDecision(w,w.getBlockById('if'),target(w,'on|@after')).allowed,false);
    assert.equal(placementDecision(w,w.getBlockById('if'),target(w,'if|DO0')).allowed,false);
    await move(w,'if','wait|@after');assert.deepEqual(chain(w),['read','wait','if']);
    await move(w,'if','wait|@before');assert.deepEqual(chain(w),['read','if','wait']);
  }finally{w.dispose();}
});
test('branch insertion preserves previous branch contents; value/statement mistakes are rejected',async()=>{
  const w=setup({loose:true});try{
    assert.equal(placementDecision(w,w.getBlockById('threshold'),target(w,'if|DO0')).allowed,false);
    assert.equal(placementDecision(w,w.getBlockById('on'),target(w,'if|IF0')).allowed,false);
    await move(w,'on','if|DO0');await move(w,'off','if|ELSE');
    assert.equal(w.getBlockById('if').getInputTargetBlock('DO0').id,'on');assert.equal(w.getBlockById('if').getInputTargetBlock('ELSE').id,'off');
    const extra=w.newBlock('eqp_wait');await pause();await move(w,extra.id,'if|DO0');
    assert.equal(w.getBlockById('if').getInputTargetBlock('DO0'),extra);assert.equal(extra.getNextBlock().id,'on');
    assert.deepEqual(chain(w),['read','wait','if']);
  }finally{w.dispose();}
});
test('native feedback distinguishes a detached internally-connected stack from its chosen input',()=>{
  const w=setup({branches:true,correct:true});try{
    const moving=w.getBlockById('if'),carriedIds=new Set(moving.getDescendants(false).map(block=>block.id)),tail=target(w,'wait|@after');
    moving.unplug(false);
    assert.equal(describeConnection(moving),null);
    const report=nativeDropFeedback(moving,{target:tail,carriedIds});
    assert.equal(report.inProgram,false);assert.equal(report.matched,false);assert.equal(report.conflict,true);assert.match(report.message,/尚未接入程序入口/);assert.match(report.message,/整串.*自己.*尾块/);
    const unchanged=nativeDropFeedback(moving,{target:tail,carriedIds,undoable:false});
    assert.match(unchanged.message,/请改用单句点选/);assert.doesNotMatch(unchanged.message,/请撤销/);
    const input=nativeDropFeedback(moving,{target:target(w,'root|SETUP'),carriedIds});
    assert.equal(input.matched,false);assert.match(input.message,/尚未接入程序入口/);assert.doesNotMatch(input.message,/已经接在|已经吸附/);
  }finally{w.dispose();}
});
