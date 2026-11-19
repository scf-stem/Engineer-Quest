import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Zh from 'blockly/msg/zh-hans';
import {registerProgramBlocks, workspaceToProgram, generateShortCpp, generateArduino,
  inspectProgramWorkspace, explainProgramDiagnostic, createProgramLearningMap, getLearningExercises, getLearningStarter,
  createLearningRecord, recordLearningSupport, recordLearningPrediction, recordLearningAttempt, observeLearningEvidence, assessLearningRecord} from './index.js';
import {SYNTHETIC_DEVICE as device, SYNTHETIC_TOPOLOGY as topology, createExampleBlocks} from './examples.js';

Blockly.setLocale(Zh); registerProgramBlocks(Blockly, device);
const $=id=>document.getElementById(id),saved=()=>Blockly.serialization.workspaces.save(workspace);
const contents=types=>types.map(type=>({kind:'block',type,...(type==='controls_if'?{extraState:{hasElse:true}}:{})}));
const workspace=Blockly.inject($('workspace'),{trashcan:true,scrollbars:true,toolbox:{kind:'categoryToolbox',contents:[
  {kind:'category',name:'变量与流程',colour:180,contents:contents(['eqp_program','eqp_declare','eqp_get','eqp_set','controls_if'])},
  {kind:'category',name:'时间与循环',colour:180,contents:contents(['eqp_wait','eqp_while'])},
  {kind:'category',name:'输入与判断',colour:210,contents:contents(['eqp_read_analog','eqp_read_digital','math_number','logic_boolean','logic_compare','logic_operation','logic_negate','math_arithmetic'])},
  {kind:'category',name:'输出',colour:30,contents:contents(['eqp_write'])},
]}});
new ResizeObserver(()=>Blockly.svgResize(workspace)).observe($('workspace'));
let snapshot,events=[],program,mode='blocks',record=createLearningRecord(),attempt,mapping;
const previousSources=[];
const exercises=getLearningExercises();
for(const exercise of exercises){const option=document.createElement('option');option.value=exercise.id;option.textContent=exercise.title;$('exercise').append(option);}
const currentExercise=()=>exercises.find(e=>e.id===$('exercise').value);
const artifact=()=>({exerciseId:$('exercise').value,topology,...(mode==='code'?{source:$('source').value}:{blockState:saved()})});
function status(message,state=''){$('status').textContent=message;$('status').dataset.state=state;}
function updateRecord(){
  const assessment=assessLearningRecord(record);$('review').textContent=assessment.message;
  $('origin').textContent=assessment.hasExampleSupport?'已查看完整参考；后续编辑仍保留协助记录，软件通过不代表已理解。':'未记录完整参考协助；是否独立完成、是否理解仍待解释与回顾。';
  $('progress').replaceChildren();for(const step of assessment.steps){const item=document.createElement('li');item.textContent=`${step.title}：${step.evidenceRecorded?'过程证据已记录':step.behaviorVerified?'行为通过，调试过程仍待补充':'待预测与运行'}`;$('progress').append(item);}
  $('attempt-history').textContent=JSON.stringify(record.attempts.map(a=>({id:a.id,exerciseId:a.exerciseId,behaviorPassed:a.behaviorPassed,prediction:a.prediction,supportUsed:a.supportUsed,source:a.source??a.mapping.source,counterexamples:a.runs.flatMap(r=>r.feedback.counterexamples)})),null,2);
}
function showGuidance(){
  const insight=inspectProgramWorkspace(saved(),{activityId:currentExercise().id==='first-output'?'observe-output':'auto-light'});
  const g=mode==='code'?{title:'当前执行的是右侧简写 C++',observation:'左侧保留以前的积木，没有自动还原或覆盖当前文本。',nextAction:'先对照当前代码与真实运行。若选择从积木重新生成，原文本会保留在快照详情。'}:insight.guidance;$('guidance').replaceChildren();
  for(const text of [g.title,g.observation,g.nextAction]){const p=document.createElement('p');p.textContent=text;$('guidance').append(p);}
}
function explain(d){
  const card=explainProgramDiagnostic(d,{blockState:saved()});status(`${card.title}。${card.observation} ${card.nextAction}`,'fail');$('technical').textContent=JSON.stringify(d,null,2);
  if(card.focus.blockId&&workspace.getBlockById(card.focus.blockId))workspace.highlightBlock(card.focus.blockId);
  if(card.focus.sourceRange){$('source').focus();$('source').setSelectionRange(card.focus.sourceRange.start,card.focus.sourceRange.end);}
}
function value(result){if(result.ok)return result.value;explain(result.diagnostics[0]);return undefined;}
function invalidate(){
  program=undefined;attempt=undefined;events=[];$('generated').disabled=true;$('step').disabled=true;$('arduino').open=false;
  $('arduino-source').textContent='';$('toolchain').textContent='';$('assertions').replaceChildren();$('counterexamples').replaceChildren();
  $('technical').textContent='当前版本尚未检查；此前诊断保留在练习记录。';
  $('event').textContent='当前版本尚未运行；此前失败与修复仍保留在下方记录。';$('lamp').classList.remove('on');$('lamp-state').textContent='等待当前版本结果';
  $('mode').textContent=mode==='blocks'?'执行来源：当前积木。':'执行来源：当前简写 C++；积木仍保留为旧快照。';
  $('prediction-status').textContent='程序变动后，请为当前版本重新记录预测。';showGuidance();
}
function showEvent(){
  const event=events[Number($('step').value)];if(!event)return;
  const label={initial:'执行前初态',read:'读取输入',assign:'更新变量',write:'写入输出',wait:'开始等待',resume:'等待结束',branch:'判断分支',cycle:'开始本轮检查',stop:'观察结束'}[event.kind];
  $('event').textContent=`${event.atMs}ms · ${label}\n${event.kind==='read'?`本次读到：${event.value}\n`:event.kind==='branch'?`判断结果：${event.branch}\n`:''}变量：${JSON.stringify(event.variables)}\n输入：${JSON.stringify(event.inputs)}\n输出：${JSON.stringify(event.outputs)}\n执行步：${event.step}`;
  $('lamp').classList.toggle('on',event.outputs.LAMP);$('lamp-state').textContent=`LED ${event.outputs.LAMP?'亮':'灭'} · ${event.atMs}ms · 第 ${event.step} 步${event.kind==='initial'?'（执行前初态）':''}`;
  const link=mapping?.links.find(l=>l.nodeId===event.nodeId);if(link)selectLink(link);
}
function selectLink(link){
  $('map-meaning').textContent=`${link.label}：${link.meaning}`;
  if(mapping?.links.includes(link))$('map-node').value=String(mapping.links.indexOf(link));
  const blockId=link.blockId??link.nodeId;if(workspace.getBlockById(blockId))workspace.highlightBlock(blockId);
  const range=mode==='code'?link.originalRange:link.generatedRange;if(range)$('source').setSelectionRange(range.start,range.end);
}
function showMapping(next){
  mapping=next;$('map-node').replaceChildren();mapping.links.forEach((link,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${link.label} → ${link.code.split('\n')[0].trim()}`;$('map-node').append(option);});
  $('map-node').disabled=false;if(mapping.links[0])selectLink(mapping.links[0]);
}
function selectExercise(){
  const exercise=currentExercise();$('goal').textContent=exercise.goal;$('instructions').replaceChildren();
  for(const instruction of exercise.instructions){const li=document.createElement('li');li.textContent=instruction;$('instructions').append(li);}
  $('checkpoint').textContent=exercise.checkpoint.question;$('bug-starter').hidden=exercise.id!=='repair-stale-read';
  document.querySelectorAll('[name=prediction]').forEach(input=>input.checked=false);invalidate();updateRecord();
}
function viewCounterexample(run,counterexample){
  const panel=document.createElement('div');panel.className='counterexample';const p=document.createElement('p');p.textContent=counterexample.observation;panel.append(p);
  for(const [label,event] of [['查看最近一次读取',counterexample.lastRead],['查看所走分支',counterexample.lastBranch],['查看最后输出',counterexample.lastWrite]]){
    if(!event)continue;const button=document.createElement('button');button.textContent=label;
    button.onclick=()=>{
      const index=run.simulation.events.findIndex(e=>e.nodeId===event.nodeId&&e.step===event.step&&e.atMs===event.atMs);
      const next=value(observeLearningEvidence(record,{attemptId:attempt.id,testId:run.testId,eventIndex:index}));if(!next)return;record=next;events=run.simulation.events;$('step').max=String(events.length-1);$('step').value=String(index);showEvent();updateRecord();status('已查看并记录这次真实事件。先对照代码，再决定修改哪一处。');
    };panel.append(button);
  }
  const next=document.createElement('p');next.textContent=counterexample.nextAction;panel.append(next);$('counterexamples').append(panel);
}
$('exercise').onchange=selectExercise;
$('predict').onclick=()=>{
  const selected=document.querySelector('[name=prediction]:checked');if(!selected){$('prediction-status').textContent='先选择亮或灭，再记录预测。';return;}
  if(mode==='blocks'&&!inspectProgramWorkspace(saved()).canRun){showGuidance();status('先把入口和第一段动作连接好，再预测它会怎样执行。');return;}
  const next=value(recordLearningPrediction(record,{...artifact(),predicted:selected.value==='true'}));if(!next)return;record=next;$('prediction-status').textContent=`已记录当前版本预测：${selected.value==='true'?'亮':'灭'}。现在运行来核对。`;
};
$('run').onclick=()=>{
  if(mode==='blocks'&&!inspectProgramWorkspace(saved()).canRun){showGuidance();status('程序还没连接完整。请按左侧下一步继续，不需要加载完整答案。');return;}
  const executed=value(recordLearningAttempt(record,artifact()));if(!executed)return;record=executed.record;attempt=executed.attempt;program=attempt.program;if(mode==='blocks')$('source').value=attempt.mapping.source;showMapping(attempt.mapping);
  const run=attempt.runs[0];events=run.simulation.events;$('step').max=String(events.length-1);$('step').value='0';$('step').disabled=false;showEvent();
  $('assertions').replaceChildren();$('counterexamples').replaceChildren();
  for(const r of attempt.runs)for(const assertion of r.evaluation.cases[0].assertions){const row=document.createElement('tr');for(const text of [`${assertion.atMs}ms`,assertion.equals?'亮':'灭',assertion.actual===undefined?'无输出':assertion.actual?'亮':'灭',assertion.passed?'符合':'需排查']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('assertions').append(row);}
  for(const r of attempt.runs)for(const counterexample of r.feedback.counterexamples.slice(0,2))viewCounterexample(r,counterexample);
  const runtime=attempt.runs.flatMap(r=>r.simulation.diagnostics)[0];
  $('technical').textContent=runtime?JSON.stringify(runtime,null,2):'当前版本没有语法或运行诊断；行为是否符合预期仍看固定测试。';
  if(runtime)explain(runtime);else status(attempt.behaviorPassed?`当前练习的行为符合固定场景。${attempt.prediction?'预测与实际已记录。':'这次尚未记录当前版本预测。'}${record.support.some(s=>s.kind==='example')?'已使用完整参考，不能据此认定独立完成。':'仍需解释与调试过程。'}`:'固定场景发现不符合预期的行为。先查看下面的真实反例和最近读取。',attempt.behaviorPassed?'pass':'fail');
  $('generated').disabled=!attempt.behaviorPassed;updateRecord();
};
$('from-blocks').onclick=()=>{
  const progress=inspectProgramWorkspace(saved());if(!progress.canRun){showGuidance();status(progress.guidance.nextAction);return;}
  const ir=value(workspaceToProgram(workspace,Blockly));if(!ir)return;const generated=value(generateShortCpp(ir)),linked=value(createProgramLearningMap(ir,{blockState:saved()}));if(!generated||!linked)return;
  if(mode==='code'&&$('source').value)previousSources.push($('source').value);
  snapshot=structuredClone(saved());$('snapshot').disabled=false;$('snapshot-status').textContent='已保存积木快照；原文本也保留在快照详情。直接编辑代码后，执行来源改为文本。';
  $('source').value=generated.source;mode='blocks';invalidate();showMapping(linked);workspace.scrollCenter();status('已生成当前积木的对应代码。选择映射项查看它的含义，然后预测并运行。');
};
$('source').addEventListener('input',()=>{mode='code';invalidate();$('map-node').disabled=true;$('map-meaning').textContent='代码已编辑；解析运行后重新定位当前版本，不能假装旧积木已同步。';});
workspace.addChangeListener(event=>{if(!event.isUiEvent){invalidate();if(mode==='blocks'){$('map-node').disabled=true;$('map-meaning').textContent='积木已变动，重新生成当前版本的映射。';}}});
$('load').onclick=()=>{
  const next=value(recordLearningSupport(record,{kind:'example'}));if(!next)return;record=next;if($('source').value)previousSources.push($('source').value);if(workspace.getAllBlocks(false).length)snapshot=structuredClone(saved());$('snapshot').disabled=!snapshot&&!previousSources.length;workspace.clear();Blockly.serialization.workspaces.load(createExampleBlocks(),workspace);mode='blocks';invalidate();updateRecord();status('已加载完整参考，原作品保留在快照详情，协助记录会保留。它可以展示软件行为，但不会自动完成调试和迁移练习。');
};
$('bug-starter').onclick=()=>{
  const starter=value(getLearningStarter('repair-stale-read'));if(!starter)return;const next=value(recordLearningSupport(record,{kind:'bug-fixture',scope:'repair-stale-read'}));if(!next)return;record=next;if($('source').value)previousSources.push($('source').value);$('snapshot').disabled=false;$('source').value=starter.source;mode='code';invalidate();updateRecord();status('含故障代码已打开，原文本保留在快照详情。先预测并运行，保留真实失败，再查看最近读取。');
};
$('step').oninput=showEvent;$('map-node').onchange=()=>selectLink(mapping.links[Number($('map-node').value)]);
$('center-blocks').onclick=()=>workspace.scrollCenter();
$('snapshot').onclick=()=>{$('snapshot-view').hidden=!$('snapshot-view').hidden;$('snapshot-view').textContent=JSON.stringify({blocks:snapshot,previousSources},null,2);};
$('generated').onclick=()=>{if(!program)return;const generated=value(generateArduino(program,device));if(!generated)return;$('arduino-source').textContent=generated.source;$('toolchain').textContent=JSON.stringify(generated.toolchainRequirements,null,2);$('arduino').open=true;};
selectExercise();
