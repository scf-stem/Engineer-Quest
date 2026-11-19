import React,{useEffect,useRef,useState} from 'react';
import {LESSONS,LESSON_IDS,TUTORIAL_STORAGE_KEY,createTutorialSession,restoreTutorialSession,tutorialTransition,tutorialView} from './index.js';
import './tutorial.css';

/** Host callbacks navigate only. No work, tests or ledger callbacks are accepted. */
export function NpcTutorial({facts={},onNavigate,onOpenManual,open:controlledOpen,onOpenChange,showLauncher=true,storageKey=TUTORIAL_STORAGE_KEY,onStateChange}){
  const [session,setSession]=useState(()=>{
    try{return storageKey?restoreTutorialSession(localStorage.getItem(storageKey)):createTutorialSession();}catch{return createTutorialSession();}
  });
  const [sessionKey,setSessionKey]=useState(storageKey);
  const sessionRef=useRef(session);sessionRef.current=session;
  const factsRef=useRef(facts);factsRef.current=facts;
  const observer=useRef(onStateChange);observer.current=onStateChange;
  const dialog=useRef(null),lastIntent=useRef(-Infinity);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [instant,setInstant]=useState(false),[characters,setCharacters]=useState(0),[revealedKey,setRevealedKey]=useState(null),[history,setHistory]=useState(false);
  const view=tutorialView(session,facts),visible=controlledOpen??session.open;
  const text=view.line?.text||view.task.text;
  const lineKey=view.id+':'+view.slot.index;
  const complete=instant||reduced||revealedKey===lineKey||characters>=text.length||view.atTask;

  function dispatch(event){
    const next=tutorialTransition(sessionRef.current,event,factsRef.current);
    sessionRef.current=next;setSession(next);
    if(event.type==='open'||event.type==='close')onOpenChange?.(event.type==='open');
  }
  function proceed(){
    const now=performance.now();if(now-lastIntent.current<220)return;lastIntent.current=now;
    if(!complete){setRevealedKey(lineKey);return;}
    dispatch({type:'next'});
  }
  function go(stage){dispatch({type:'close'});onNavigate?.(stage,{actionTarget:view.task.actionTarget,retryAction:view.task.retryAction,checkpointId:view.task.checkpointId});}
  function manual(){dispatch({type:'close'});onOpenManual?.(view.task.manualSection||view.lesson.manual);}
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    if(sessionKey===storageKey)return;
    let next=createTutorialSession();
    try{if(storageKey)next=restoreTutorialSession(localStorage.getItem(storageKey));}catch{}
    sessionRef.current=next;setSession(next);setSessionKey(storageKey);setHistory(false);
  },[storageKey,sessionKey]);
  useEffect(()=>{
    if(!storageKey||sessionKey!==storageKey)return;
    try{localStorage.setItem(storageKey,JSON.stringify({version:session.version,slots:session.slots}));}catch{ /* optional teaching memory; no engineering data is written */ }
  },[session,storageKey,sessionKey]);
  useEffect(()=>{
    const el=dialog.current;if(!el)return;
    if(visible&&!el.open)el.showModal();else if(!visible&&el.open)el.close();
  },[visible]);
  useEffect(()=>{
    setCharacters(0);
    if(!visible||instant||reduced||view.atTask)return;
    const started=performance.now();
    const timer=setInterval(()=>setCharacters(Math.min(text.length,Math.floor((performance.now()-started)/22))),22);
    return()=>clearInterval(timer);
  },[lineKey,text,visible,instant,reduced,view.atTask]);
  useEffect(()=>{observer.current?.({open:visible,lesson:view.id,activeLesson:view.active,line:view.line?.id||'task',atTask:view.atTask,reviewing:view.reviewing});},[visible,lineKey,view.active]);

  return <div className="eq-tutorial">
    {showLauncher&&<button type="button" className="eq-tutor-launch" onClick={()=>dispatch({type:'open'})}><span className="eq-tutor-online"/>和林工聊聊<span>教程 / {LESSONS[view.active].title}</span></button>}
    <dialog ref={dialog} className="eq-tutor-dialog" aria-labelledby="eq-tutor-name" aria-describedby="eq-tutor-mode eq-tutor-current" onCancel={event=>{event.preventDefault();dispatch({type:'close'});}} onKeyDown={event=>{
      if(event.key==='Tab'){
        const stops=[...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(el=>el.getClientRects().length);
        const first=stops[0],last=stops.at(-1);
        if(event.shiftKey&&event.target===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&event.target===last){event.preventDefault();first?.focus();}
      }
      if((event.key===' '||event.key==='Enter')&&event.target===event.currentTarget){event.preventDefault();proceed();}
    }}>
      <div className="eq-tutor-stage" data-lesson={view.id} data-line={view.line?.id||'task'} data-at-task={view.atTask}>
        <div className="eq-tutor-chapter"><span>FIELD NOTES / 001</span><strong>{view.lesson.title}</strong><span>{view.reviewing?'正在重看':view.atTask?'等你操作后继续':`${view.slot.index+1} / ${view.lesson.lines.length}`}</span></div>
        <img className="eq-tutor-portrait" src="/art/npc-tutorial/lin-mentor-v2.webp" alt="林工，穿深蓝工装、戴眼镜的工程同事，手持笔记本"/>
        <section className="eq-tutor-box">
          <header><div className="eq-tutor-nameplate"><h2 id="eq-tutor-name">林工</h2><span>硬件同事 / 新人带教</span></div><button type="button" className="eq-tutor-close" onClick={()=>dispatch({type:'close'})} autoFocus aria-label="暂停对话，回到操作">暂停 · Esc</button></header>
          <p className="eq-tutor-mode" id="eq-tutor-mode">脚本教程 · 依据当前工位状态提示</p>
          {view.reviewing&&<div className="eq-tutor-review">重看不改变工程状态。<button type="button" onClick={()=>dispatch({type:'resume'})}>返回当前任务</button></div>}
          <button type="button" className="eq-tutor-text" onClick={proceed} disabled={view.atTask||!!view.line?.options} aria-label={!complete?'显示整句':'下一句'}>
            <span aria-hidden="true">{complete?text:text.slice(0,characters)}<span className="eq-tutor-caret" hidden={complete}>▍</span></span>
          </button>
          <p className="eq-tutor-sr" id="eq-tutor-current" aria-live="polite">{text}</p>
          {view.line?.options&&<div className="eq-tutor-options" aria-label="想一想">{view.line.options.map(o=><button type="button" key={o.id} aria-pressed={view.slot.answers[view.line.id]===o.id} onClick={()=>{setRevealedKey(lineKey);dispatch({type:'choose',id:o.id});}}>{o.label}</button>)}</div>}
          {view.feedback&&<p className={'eq-tutor-feedback '+(view.feedback.correct?'':'eq-tutor-think')} role="status">{view.feedback.feedback}</p>}
          {view.atTask&&<div className="eq-tutor-task"><span>{view.reviewing?'本节操作目标':view.task.status}</span>{view.task.current&&<p className="eq-tutor-checkpoint">情境 {view.task.current.number} / {view.task.current.total} · {view.task.current.title}</p>}{view.task.diagnostic&&<p><code>{view.task.diagnostic.code}</code>{view.task.diagnostic.message!==text&&` · ${view.task.diagnostic.message}`}</p>}{view.task.observedFact&&<p>当前记录：{typeof view.task.observedFact==='string'?view.task.observedFact:JSON.stringify(view.task.observedFact)}</p>}{view.task.challenge?.scene?.description&&<p>先看场景：{view.task.challenge.scene.description}</p>}{view.task.challenge?.prompt&&<p>这次要判断：{view.task.challenge.prompt}</p>}{view.task.practice&&<section className="eq-tutor-practice" aria-label="局部观察"><h3>{view.task.practice.title}</h3><p>{view.task.practice.observation}</p><p>{view.task.practice.tryThis}</p></section>}<p>完成操作后再找林工查看提示，我会读取当前结果。</p></div>}
          <div className="eq-tutor-primary">{view.atTask?<button type="button" className="eq-tutor-next" disabled={!onNavigate} onClick={()=>go(view.reviewing?LESSONS[view.active].stage:view.lesson.stage)}>{view.reviewing?'回到当前操作':view.task.actionLabel||view.lesson.action} <span>↗</span></button>:<button type="button" className="eq-tutor-next" onClick={proceed} disabled={complete&&!!view.line.options&&!view.feedback?.correct}>{!complete?'显示整句':view.line.options&&!view.feedback?.correct?'先想一想':'下一句'} <span>{!complete?'▸':'▼'}</span></button>}
            {onOpenManual&&<button type="button" onClick={manual}>查手册 §{view.task.manualSection||view.lesson.manual}</button>}
          </div>
          <footer><button type="button" onClick={()=>{dispatch({type:'replay'});setHistory(false);}}>重看本节</button><button type="button" onClick={()=>dispatch({type:'skip'})}>跳过说明，去操作</button><button type="button" aria-expanded={history} onClick={()=>setHistory(!history)}>对话记录</button><label><input type="checkbox" checked={instant||reduced} disabled={reduced} onChange={e=>setInstant(e.target.checked)}/>整句显示</label></footer>
          {history&&<section className="eq-tutor-history" aria-label="对话记录"><nav aria-label="重看已读章节">{LESSON_IDS.filter(id=>session.slots[id]||id===view.active).map(id=><button type="button" key={id} onClick={()=>dispatch({type:'review',id})}>{LESSONS[id].title}</button>)}</nav><ol>{view.lesson.lines.slice(0,Math.min(view.slot.index+1,view.lesson.lines.length)).map(line=><li key={line.id}><p>{line.text}</p>{view.slot.answers[line.id]&&<p>你的选择：{line.options.find(o=>o.id===view.slot.answers[line.id])?.label}</p>}</li>)}</ol></section>}
        </section>
      </div>
    </dialog>
  </div>;
}
export default NpcTutorial;
