import {guidedOutputComplete,experiencedFact} from './work-guidance.js';
export const TASKBOOK={base:'/manual/first-order-v1/',pdf:'/manual/first-order-v1/首单图文任务书.pdf',pages:['报到','客户桌面','光照模块接线','灯的回路','亲手开关','入口与变量','读取与等待','比较与分支','持续变化与基础测试','客户变更','局部改代码','交付与刷新']};

/** Suggested reading page only; it never changes the work or learning position. */
export function suggestedTaskbookPage({state,context,initialSection='02.1'}){
  const facts=state?.facts??{},id=facts.practice?.blocks?.current?.id;
  if(!facts.joined||initialSection==='01.1')return 1;
  if(context==='income')return 12;
  if(context==='mail')return facts.hasCode?10:2;
  if(context==='wiring')return facts.connectionCount>=3?4:3;
  if(context==='blocks'){
    if(!facts.baseReady&&!experiencedFact(state,'current_input_read_observed')&&!guidedOutputComplete(state))return 5;
    return ({'observe-output':5,'read-input':facts.programReady?7:6,'branch-output':8,'repeat-read':9,'base-delivery':9})[id]??9;
  }
  if(context==='code'||initialSection.startsWith('08'))return 11;
  if(/^(04|05|06)/.test(initialSection))return facts.connectionCount>=3?4:3;
  if(initialSection.startsWith('07'))return 6;
  if(state?.stage==='software-complete')return 12;
  return /^(09|10)/.test(initialSection)?9:2;
}
