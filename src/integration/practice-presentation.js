import {getLearningProgression} from '../../content/index.js';
import {canonicalJson} from '../contracts/index.js';

const milestones=getLearningProgression().practiceMilestones;
/** A teaching position remembers work actually attempted. It grants no evidence. */
export function derivePracticePresentation({learning,attempt,phase='blocks'}){
  const ids=phase==='blocks'?milestones.slice(0,5).map(m=>m.id):milestones.slice(5).map(m=>m.id);
  const invalid=new Set(attempt?.observationInvalidations??[]);
  const history=attempt?.observations?.filter(o=>!invalid.has(o.id))??[];
  let frontier=0;
  for(let i=0;i<ids.length;i++){
    const required=milestones.find(m=>m.id===ids[i]).requiresEvidence;
    if(!required.every(code=>history.some(o=>o.activityId===ids[i]&&o.factCodes?.includes(code))))break;
    frontier=Math.min(i+1,ids.length-1);
  }
  const formal=learning?.checkpoints?.find(row=>ids.includes(row.id)&&row.state!=='observed');
  const formalIndex=formal?ids.indexOf(formal.id):ids.length-1;
  const position=Math.max(frontier,formalIndex),current=learning?.checkpoints?.find(row=>row.id===ids[position])??learning?.current;
  const rechecks=ids.slice(0,position).map(id=>learning?.checkpoints?.find(row=>row.id===id)).filter(row=>row&&row.state!=='observed');
  return {current:current??null,validationCurrent:learning?.current??null,rechecks,needsRecheck:rechecks.length>0};
}

/** Select only prior explicit successful inputs for this one observation. */
export function previousPracticeActions(attempt,activityId){
  const unique=new Map();
  for(const action of attempt?.learningActions??[]){
    if(action.kind!=='program-action'||action.request?.actionId!==activityId||!action.result?.observations?.some(o=>o.activityId===activityId))continue;
    const key=activityId==='branch-output'?action.request.inputs.scene:'latest';
    unique.set(key,{phase:action.request.phase,actionId:activityId,inputs:JSON.parse(canonicalJson(action.request.inputs))});
  }
  return [...unique.values()];
}
