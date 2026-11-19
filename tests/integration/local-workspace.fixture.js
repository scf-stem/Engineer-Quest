// Teaching-policy test double ONLY. Production must use D/A's actual lesson modules.
// The objective program, wiring, simulator and independent customer suites are real.
import {canonicalJson} from '../../src/contracts/index.js';
export const fixturePolicies={
  requirements:{
    createRequirementReview:({binding})=>({binding,responses:[]}),
    reviewRequirementAttempt:({review,binding,attempt})=>({accepted:true,review:{binding,responses:[...review.responses,attempt]}}),
    summarizeRequirementReview:({review,binding})=>{
      const ready=review?.responses.at(-1)?.optionId==='fixture-ready'&&review?.responses.at(-1)?.confidence==='ready-to-try'&&canonicalJson(binding)===canonicalJson(review.binding);
      return {status:ready?'ready':'in-progress',readyForPractice:ready,readyToAdvance:ready,challenge:{checkpointId:'fixture-only'},evidence:{binding,lessonRef:{id:'fixture-lesson',version:'test'},responsesCanonical:canonicalJson(review?.responses??[])}};
    },
  },
  performLearningAction:async({actionId})=>({observations:[{activityId:actionId,source:'program-analysis',factCodes:[actionId==='fixture-practice'?'fixture_practice_observed':'own_comparison_mapping_observed']}],notice:'synthetic policy fixture'}),
  deriveLearningProgress:({context,observations})=>{
    const has=(code,phase='base')=>observations.some(o=>o.factCodes.includes(code)&&Object.entries(context[phase]??{}).every(([key,value])=>(code==='own_blocks_snapshot_preserved'&&['requirementRef','requirementsEvidenceKey','sourceKey'].includes(key))||(key==='sourceKey'&&phase==='change'&&!['changed_exact_source_recorded','change_customer_suite_passed'].includes(code))||canonicalJson(o.binding[key])===canonicalJson(value)));
    return {status:'fixture-only',readyForBaseTests:has('fixture_practice_observed'),readyForCodeChange:has('fixture_practice_observed')&&has('base_customer_suite_passed'),readyForChangeTests:has('own_blocks_snapshot_preserved')&&has('own_comparison_mapping_observed','change'),readyForSoftwareDelivery:has('changed_exact_source_recorded','change')&&has('change_customer_suite_passed','change')};
  },
};
export const fixtureAnswer=()=>({responseId:crypto.randomUUID(),checkpointId:'fixture-only',optionId:'fixture-ready',confidence:'ready-to-try'});
