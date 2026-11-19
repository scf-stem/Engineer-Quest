import React from 'react';
import './story-result.css';

/** The work remains on screen. Only the learner's next click opens the dialogue. */
export function StoryResult({handoff,state,pending,onContinue,onReview}){
  const cases=handoff.proof?.report?.cases??[];
  const total=cases.reduce((n,row)=>n+(row.assertions?.length??0),0),matched=cases.reduce((n,row)=>n+(row.assertions?.filter(a=>a.passed).length??0),0);
  const actions=handoff.actionIds.map(id=>state.attempt.learningActions.find(a=>a.id===id)).filter(Boolean);
  return <section className="eq-story-result" aria-label="先查看这次结果" data-result-scene={handoff.id}>
    <div className="eq-story-result-content">
    <span className="eq-story-result-kicker">林工 · 先留在眼前这一步</span><h2>{handoff.title}</h2><p>{handoff.detail}</p>
    {handoff.proof?<><strong className="eq-story-result-count">{matched}/{total} 条客户采样符合</strong><p>{cases.length} 个固定场景 · 需求{handoff.proof.report.requirementRef?.version}</p><button type="button" className="eq-story-result-review" onClick={onReview}>打开完整客户测试结果 ↗</button></>:<div className="eq-story-result-observations">{actions.map(action=>{
      const events=action.result.value?.simulation?.events??[],read=events.findLast(e=>e.kind==='read'&&e.port==='LIGHT'),write=events.findLast(e=>e.kind==='write'&&e.port==='LAMP');
      return <div key={action.id}><b>{action.request.inputs.scene==='dark'?'暗场景':action.request.inputs.scene==='bright'?'亮场景':'本次读取'}</b><span>{read?`${read.atMs}ms 读到 ${read.value}`:'无LIGHT读取记录'}</span><span>{write?`${write.atMs}ms 明确${write.value?'开灯':'关灯'}`:'本次先观察读取'}</span></div>;
    })}</div>}
    </div>
    <button type="button" className="eq-story-result-continue" disabled={pending} onClick={onContinue}>{pending?'正在保存…':handoff.action}</button>
    <p className="eq-story-result-return">现在可以回看记录、查资料或返回工位；这份结果会留着。</p>
  </section>;
}
