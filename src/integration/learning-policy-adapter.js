import lessonBank from '../../content/learning/auto-lamp-progression.json' with {type:'json'};
import * as requirementReview from '../../content/requirements-review.js';
import {deriveLearningProgress,getLearningEvidencePolicy} from '../../content/learning-progress.js';
import {createRef} from '../contracts/index.js';

export async function createRequirementPolicies(){
  return {...requirementReview,lessonRef:await createRef(lessonBank.ref.id,lessonBank.ref.version,lessonBank)};
}

/** E translates only facts actually returned by A; D checks order and dependencies. */
export async function createWorkspacePolicies(programContext){
  const requirements=await createRequirementPolicies(),evidencePolicy=getLearningEvidencePolicy();
  return {requirements,deriveLearningProgress,softwareRewardAmount:100,
    async performLearningAction(request){
      const {actionId,inputs,phase,wiring,blockState,program}=request;
      if(actionId==='graphic-intro-run'){
        if(phase!=='blocks')throw new Error('入门练习在图形化工位进行。');
        const {buildTeachingRun}=await import('../program-teaching/runtime.js');
        const topology=await programContext.topologyFor(wiring);
        if(!topology.ok)return {...topology,observations:[]};
        const result=buildTeachingRun({...inputs,topology:topology.value});
        const writes=result.value?.simulation?.events.filter(event=>event.kind==='write'&&event.port==='LAMP'&&result.value.studentNodeIds.includes(event.nodeId))??[];
        const studentOutput=inputs.actor==='learner'&&inputs.kind==='output'&&result.ok?writes.at(-1)?.value:null;
        const observations=typeof studentOutput==='boolean'?[{activityId:'observe-output',source:'program-runtime',factCodes:['guided_output_observed']}]:[];
        return {...result,...(result.value?{value:{...result.value,studentOutput}}:{}),observations};
      }
      if(!['observe-output','read-input','branch-output','repeat-read','code-mapping'].includes(actionId))throw new Error('此动作由真实客户测试或快照保存负责。');
      if((actionId==='code-mapping')!==(phase==='short-cpp'))throw new Error('练习与当前作品阶段不一致。');
      const module=await import('../program/index.js');
      if(typeof module.performProgramLearningAction!=='function')throw new Error('当前编程教学执行器尚未接入，未生成学习通过。');
      const topology=await programContext.topologyFor(wiring);
      if(!topology.ok)return {...topology,observations:[]};
      const result=module.performProgramLearningAction({actionId,inputs,program:program.ok?program.value:null,topology:topology.value,blockState:blockState?.workspace??blockState});
      if(!result.ok)return {...result,observations:[]};
      const groups=new Map();
      for(const fact of result.value.facts){
        if(evidencePolicy.sourcesByFact[fact.factCode]!==fact.source)throw new Error('编程观察来源与课程事实策略不一致，未记录通过。');
        const codes=groups.get(fact.source)??[];codes.push(fact.factCode);groups.set(fact.source,codes);
      }
      return {ok:true,value:result.value,diagnostics:result.diagnostics,observations:[...groups].map(([source,factCodes])=>({activityId:actionId,source,factCodes}))};
    },
  };
}
