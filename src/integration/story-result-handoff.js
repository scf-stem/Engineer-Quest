import {canonicalJson} from '../contracts/index.js';

export const RESULT_STORY_IDS=['branch','repeat','base','delivery'];
const copy=value=>JSON.parse(JSON.stringify(value));

/** Presentation references existing real results. It neither creates nor renews evidence. */
export function resultForStory(state,id){
  const attempt=state.attempt,j=attempt?.presentation?.journey;
  if(!j||j.replay||j.seen?.[id]||!RESULT_STORY_IDS.includes(id))return null;
  const descriptions={
    branch:{title:'这次读取，已经留下来了。',action:'看清了，继续明暗判断 →',detail:'先对照右侧的实际读数和事件。准备好，再和林工安排两条路。'},
    repeat:{title:'暗、亮两次，都有自己的输出记录。',action:'看清了，继续连续变化 →',detail:'两个场景的读入、分支和输出都保留着。可以先回看，再继续。'},
    base:{title:'基础客户测试通过，先看这封回信。',action:'看完结果，继续客户来信 →',detail:'这份作品的客户期望与实际输出已保存。先查看结果，再打开下一封信。'},
    delivery:{title:'新版客户测试通过，先核对这版结果。',action:'看完结果，继续软件交付 →',detail:'新旧差别和新边界的结果都在这里。准备好，再和林工完成交付。'},
  };
  let refs,phase,proof=null,actions=[];
  if(id==='base'||id==='delivery'){
    proof=id==='base'?state.facts.baseEvidence:state.facts.codeEvidence;
    if(!proof?.id||!proof.report?.passed)return null;
    refs=[proof.id];phase=id==='base'?'blocks':'short-cpp';
  }else{
    const codes=id==='branch'?['current_input_read_observed']:['dark_branch_observed','bright_branch_observed'];
    const invalid=new Set(attempt.observationInvalidations??[]),observations=[];
    for(const code of codes){
      const observation=attempt.observations.findLast(o=>!invalid.has(o.id)&&o.factCodes?.includes(code)&&attempt.learningActions.some(a=>a.id===o.learnerActionId&&a.kind==='program-action'&&a.result?.ok===true));
      if(!observation)return null;
      observations.push(observation);
      actions.push(attempt.learningActions.find(a=>a.id===observation.learnerActionId));
    }
    refs=observations.map(o=>o.id);phase='blocks';
  }
  const key=canonicalJson({sceneId:id,refs});
  if(j.resultContinued?.[id]===key)return null;
  const displayedProof=proof?{id:proof.id,report:copy({passed:proof.report.passed,requirementRef:proof.report.requirementRef??null,cases:proof.report.cases??[]})}:null;
  return {id,key,phase,...descriptions[id],proof:displayedProof,actionIds:[...new Set(actions.map(a=>a.id))]};
}
