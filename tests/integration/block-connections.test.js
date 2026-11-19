import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {registerProgramBlocks} from '../../src/program/index.js';
import {valueDropDecision,describeConnection} from '../../src/integration/block-connections.js';
import {requirementReply} from '../../src/integration/requirement-dialogue.js';

registerProgramBlocks(Blockly,(await createHardwareContext()).executionProfile);
test('an integer variable cannot displace the whole if condition; occupied values require a specific explicit replacement',()=>{
  const work=new Blockly.Workspace();try{
    const declaration=work.newBlock('eqp_declare');declaration.setFieldValue('int','TYPE');
    const variable=work.newBlock('eqp_get'),condition=work.newBlock('controls_if'),compare=work.newBlock('logic_compare');
    condition.getInput('IF0').connection.connect(compare.outputConnection);
    assert.equal(valueDropDecision({moving:variable,parent:condition,input:condition.getInput('IF0'),occupied:compare}).allowed,false);
    assert.equal(condition.getInputTargetBlock('IF0'),compare);
    assert.equal(valueDropDecision({moving:variable,parent:compare,input:compare.getInput('A')}).allowed,true);
    compare.getInput('A').connection.connect(variable.outputConnection);
    assert.equal(describeConnection(variable),'已经吸附到比较 · 左边值。');
    const number=work.newBlock('math_number'),slot=compare.getInput('A'),key=compare.id+'|A';
    assert.equal(valueDropDecision({moving:number,parent:compare,input:slot,occupied:variable}).allowed,false);
    assert.equal(valueDropDecision({moving:number,parent:compare,input:slot,occupied:variable,selected:key,replaceTarget:key}).allowed,true);
    assert.equal(valueDropDecision({moving:number,parent:compare,input:slot,selected:compare.id+'|B'}).allowed,false);
  }finally{work.dispose();}
});
test('change replies explain the specific distinguishing input, equality, own comparison and current proof',()=>{
  const replies=['change-middle','change-equality','change-code-focus','change-evidence'].map(requirementReply);
  assert.equal(new Set(replies.map(lines=>lines[0])).size,4);
  assert.match(replies[0][0],/500.*450.*600/);assert.match(replies[1][0],/600.*等于/);
  assert.match(replies[2][0],/自己作品里的比较/);assert.match(replies[3][0],/旧回信.*旧约定/);
});
