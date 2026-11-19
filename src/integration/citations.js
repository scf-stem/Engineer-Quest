import {autoLampOrder,studentManual} from '../../content/index.js';

const requirementLabels={
  'rule':'判断规则','rule.input':'输入信息','rule.whenFalse':'变亮时的动作',
  'continuous':'持续运行','responseWithinMs':'响应时间','studentText':'客户说明','outOfScope':'本单范围',
};

/** Student-facing labels resolve the actual version; technical paths stay in details. */
export function describeReviewCitations(citations=[],requirementVersion='1.0.0'){
  const labels=[];let manualSection=null;
  for(const citation of citations){
    const ref=citation?.ref;
    if(ref?.id===studentManual.ref.id&&ref.version===studentManual.ref.version){
      const match=/^sections\/([^/]+)$/.exec(citation.path||'');
      const section=studentManual.sections.find(item=>item.id===match?.[1]);
      if(section){labels.push(`手册 §${section.id} · ${section.title}`);manualSection??=section.id;continue;}
    }
    const requirement=autoLampOrder.requirements.find(item=>item.ref.id===ref?.id&&item.ref.version===ref?.version);
    if(requirement){
      const title=requirementLabels[citation.path];
      labels.push(`${ref.version===requirementVersion?'当前需求':'历史需求（需核对）'}${title?' · '+title:''}`);continue;
    }
    labels.push('引用资料待核对');
  }
  return {label:[...new Set(labels)].join('；'),manualSection};
}
