import React,{useState} from 'react';

/** A manipulable scene instrument, not a run of the learner's program. */
export function LightProbe({initialLight=850,sequence,onObserve}){
  const steps=Array.isArray(sequence)&&sequence.length?sequence:null;
  const [index,setIndex]=useState(0),[light,setLight]=useState(steps?.[0]??initialLight),dark=light<450;
  return <section className={`eq-light-probe ${dark?'is-shaded':''}`} aria-label="局部光照观察"><div className="eq-probe-desk" aria-hidden="true"><span className="eq-probe-window"/><span className="eq-probe-object"/><span className="eq-probe-shadow"/></div><div><small>{steps?`客户序列 · 第 ${index+1} / ${steps.length} 个时刻`:'局部试验 · 虚拟光照表'}</small><output aria-live="polite">{light}</output><p>{dark?'遮挡落在桌面，表上读数较低。':'桌面靠近光源，表上读数较高。'}</p><button type="button" onClick={()=>{const nextIndex=steps?(index+1)%steps.length:0,next=steps?steps[nextIndex]:dark?850:150;setIndex(nextIndex);setLight(next);onObserve?.({previous:light,light:next,...(steps?{step:nextIndex+1}:{})});}}>{steps?(index===steps.length-1?'从第一个时刻再看':'看下一个时刻'):dark?'移开遮挡，再看读数':'遮住光源，再看读数'}</button><small>观察这张光照表，再回到林工说的客户情境作判断。</small></div></section>;
}
