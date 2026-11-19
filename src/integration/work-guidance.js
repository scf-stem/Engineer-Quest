import {observationFrames,observationIsCurrent} from './observation-model.js';

/** A past real experience may introduce a concept; it is never current submission evidence. */
export function experiencedFact(state,code){
  const attempt=state?.attempt;
  return attempt?.observations.some(o=>!(attempt.observationInvalidations??[]).includes(o.id)&&o.factCodes.includes(code)&&attempt.learningActions.some(a=>a.id===o.learnerActionId&&a.kind==='program-action'&&a.result?.ok===true))??false;
}

export const wiringIsReview=state=>!!(state.facts.baseReady||state.facts.hasCode||experiencedFact(state,'current_input_read_observed')||guidedOutputComplete(state));

export function guidedOutputComplete(state){
  const values=new Set();
  for(const action of state?.attempt?.learningActions??[]){
    const graphic=action.request?.actionId==='graphic-intro-run'&&action.request.inputs?.actor==='learner'&&action.request.inputs?.kind==='output';
    if(action.kind!=='program-action'||(!graphic&&action.request?.actionId!=='observe-output')||!action.result?.ok||!observationIsCurrent(action,{wiring:state.attempt.draft.wiring}))continue;
    const frame=observationFrames(action).at(-1),chosen=graphic?action.result.value.studentOutput:action.request.inputs?.on;
    if(typeof chosen==='boolean'&&frame?.lamp===chosen&&action.result.value?.simulation?.status==='completed')values.add(chosen);
  }
  return values.has(true)&&values.has(false);
}
const input=(block,name)=>block?.inputs?.[name]?.block??block?.inputs?.[name]?.shadow;
function chain(block){const list=[];while(block){list.push(block);block=block.next?.block;}return list;}
/** Reading is a small program, so full-lamp output advice is deliberately excluded. */
export function readingGuidance(saved){
  const state=saved?.workspace??saved,root=state?.blocks?.blocks?.find(b=>b.type==='eqp_program');let nextAction;
  if(!root)nextAction='先从「变量与流程」拖一个程序入口。';
  else{
    const declaration=chain(input(root,'VARIABLES')).find(b=>b.type==='eqp_declare'&&(b.fields?.NAME??'light')==='light');
    const actions=chain(input(root,'LOOP')),assign=actions.find(b=>b.type==='eqp_set'&&(b.fields?.NAME??'light')==='light'),wait=actions.find(b=>b.type==='eqp_wait');
    if(!declaration)nextAction='在入口的「变量」区接声明 light，类型选整数。';
    else if(!input(declaration,'INITIAL')||input(declaration,'INITIAL').type==='logic_boolean')nextAction='给 light 的「初值」接一块数字 0。这里存的是读数，需要整数。';
    else if(!assign)nextAction='在「持续执行」里接「变量 light 设为」。这一步先保存每次读到的数。';
    else if(input(assign,'VALUE')?.type!=='eqp_read_analog')nextAction='把「读取模拟输入 LIGHT」接到 light 赋值的值槽里；先读数，还不用加数字输出。';
    else if(!wait)nextAction='在读取动作后接等待，毫秒数接 100，让下一轮有时间重新读取。';
    else if(!input(wait,'MS'))nextAction='等待的「毫秒数」槽还空着，接数字 100。';
    else nextAction='改变练习光照，再运行一次，对照仪表和实际读到的数。';
  }
  return {title:'眼前只做读取',nextAction,observation:nextAction};
}
