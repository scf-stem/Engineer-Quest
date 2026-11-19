import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Zh from 'blockly/msg/zh-hans';
Blockly.setLocale(Zh);
Blockly.defineBlocksWithJsonArray([
 {type:'eq_loop',message0:'持续检查 %1 %2',args0:[{type:'input_dummy'},{type:'input_statement',name:'BODY'}],colour:180},
 {type:'eq_light',message0:'读取光照 A0',output:'Number',colour:210},
 {type:'eq_output',message0:'将 LED D9 %1',args0:[{type:'field_dropdown',name:'ON',options:[['打开','HIGH'],['关闭','LOW']]}],previousStatement:null,nextStatement:null,colour:30},
 {type:'eq_wait',message0:'等待 %1 毫秒',args0:[{type:'field_number',name:'MS',value:100,min:10,max:2000,precision:1}],previousStatement:null,nextStatement:null,colour:180}
]);
export function createWorkspace(element,onChange) {
 const workspace=Blockly.inject(element,{toolbox:{kind:'categoryToolbox',contents:[{kind:'category',name:'流程',colour:180,contents:[{kind:'block',type:'eq_loop'},{kind:'block',type:'controls_if',extraState:{hasElse:true}},{kind:'block',type:'eq_wait'}]},{kind:'category',name:'输入与判断',colour:210,contents:[{kind:'block',type:'eq_light'},{kind:'block',type:'logic_compare'},{kind:'block',type:'math_number'}]},{kind:'category',name:'输出',colour:30,contents:[{kind:'block',type:'eq_output'}]}]},trashcan:true,scrollbars:true});
 workspace.addChangeListener(e=>{if(!e.isUiEvent)onChange(workspace)});return workspace;
}
export function sample(workspace) {
 Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{type:'eq_loop',x:25,y:30,inputs:{BODY:{block:{type:'controls_if',extraState:{hasElse:true},inputs:{IF0:{block:{type:'logic_compare',fields:{OP:'LT'},inputs:{A:{block:{type:'eq_light'}},B:{block:{type:'math_number',fields:{NUM:450}}}}}},DO0:{block:{type:'eq_output',fields:{ON:'HIGH'}}},ELSE:{block:{type:'eq_output',fields:{ON:'LOW'}}}},next:{block:{type:'eq_wait',fields:{MS:100}}}}}}}]}},workspace);
}
export function blocksToAst(workspace) {
 const tops=workspace.getTopBlocks(false);if(tops.length!==1||tops[0].type!=='eq_loop')throw Error('请将积木连接为一个「持续检查」程序，不要遗留散落积木。');
 const condition=tops[0].getInputTargetBlock('BODY');if(condition?.type!=='controls_if')throw Error('持续检查中需要一个如果／否则。');
 if(condition.getInput('IF1'))throw Error('首期暂只支持单个如果／否则。');
 const compare=condition.getInputTargetBlock('IF0');if(compare?.type!=='logic_compare'||compare.getFieldValue('OP')!=='LT')throw Error('本任务使用「读取光照 < 阈值」。');
 if(compare.getInputTargetBlock('A')?.type!=='eq_light'||compare.getInputTargetBlock('B')?.type!=='math_number')throw Error('比较左边放读取光照，右边放数值阈值。');
 const yes=condition.getInputTargetBlock('DO0'),no=condition.getInputTargetBlock('ELSE'),wait=condition.getNextBlock();
 if(yes?.type!=='eq_output'||no?.type!=='eq_output'||yes.getNextBlock()||no.getNextBlock())throw Error('如果与否则各放一个 LED 输出。');
 if(yes.getFieldValue('ON')===no.getFieldValue('ON'))throw Error('两个分支不能使用相同的输出动作。');
 if(wait?.type!=='eq_wait'||wait.getNextBlock())throw Error('判断后放一个等待积木，暂不支持其他尾随指令。');
 return {version:1,sensorThreshold:Number(compare.getInputTargetBlock('B').getFieldValue('NUM')),lampOnWhenDark:yes.getFieldValue('ON')==='HIGH',delayMs:Number(wait.getFieldValue('MS'))};
}
export const saveBlocks=w=>Blockly.serialization.workspaces.save(w);
export const loadBlocks=(data,w)=>Blockly.serialization.workspaces.load(data,w);
