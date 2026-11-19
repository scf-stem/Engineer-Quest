import React,{useEffect,useRef,useState} from 'react';
import {currentStoryScene} from './first-order-story.js';
import './storyline.css';

export function StoryDirector({state,onAdvance,onPause,onResume,onManual,pending}){
  const scene=currentStoryScene(state),j=state.attempt.presentation.journey,button=useRef(null),[history,setHistory]=useState(false);
  useEffect(()=>{setHistory(false);button.current?.focus({preventScroll:true});},[scene?.id,j.paused]);
  if(!scene)return null;
  if(j.paused)return <button className="eq-story-resume" type="button" onClick={onResume}>继续和林工说话 · {scene.title} →</button>;
  const line=j.replay?Math.min(j.replayLine??0,scene.lines.length-1):j.sceneId===scene.id?Math.min(j.line??0,scene.lines.length-1):0,last=line===scene.lines.length-1;
  return <section className="eq-cinematic" role="dialog" aria-modal="true" aria-label={scene.title} data-story-scene={scene.id}>
    <div className="eq-cinematic-setting"><span>WEIGUANG / 第一份委托</span><h1>{scene.title}</h1><small>{state.learner.nickname} · 见习工程师</small></div>
    <img className="eq-cinematic-lin" src="/art/storyline/lin-welcome-v1.webp" alt="林工在研发室伸手迎接你"/>
    <div className="eq-cinematic-speech"><div className="eq-cinematic-speaker">林工 <small>你的带教同事</small></div><p role="status">{scene.lines[line]}</p>
      <div className="eq-cinematic-actions"><button type="button" ref={button} disabled={pending} onClick={()=>onAdvance(scene,line,last)}>{pending?'正在保存…':last?(j.replay?'回到刚才的工作 →':scene.action):'下一句 ▷'}</button><button type="button" disabled={pending} onClick={onPause}>暂停，稍后继续</button><button type="button" onClick={()=>setHistory(!history)} aria-expanded={history}>回看刚才的话</button>{scene.id!=='welcome'&&<button type="button" onClick={()=>onManual(scene.manualSection)}>看看这一页</button>}</div>
      {history&&<div className="eq-cinematic-history">{scene.lines.slice(0,line+1).map((text,i)=><p key={i}>{text}</p>)}</div>}
    </div>
  </section>;
}
