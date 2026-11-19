import React,{useEffect,useState} from 'react';
import {blocksToProgram} from '../program/index.js';
import {observationFrames,observationIsCurrent,latestObservationAction} from './observation-model.js';

export function ProgramObservation({state,phase='blocks',reduceMotion=false}){
  const action=latestObservationAction(state,phase);
  const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),frames=observationFrames(action);
  const reduced=reduceMotion||typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(()=>{setIndex(0);setPlaying(false);},[action?.id]);
  useEffect(()=>{if(!playing||reduced)return;if(index>=frames.length-1){setPlaying(false);return;}const timer=setTimeout(()=>setIndex(index+1),700);return()=>clearTimeout(timer);},[playing,reduced,action?.id,frames.length,index]);
  const frame=frames[Math.min(index,frames.length-1)],draft=state.attempt?.draft;
  const current=action&&observationIsCurrent(action,{program:blocksToProgram(draft?.blockState?.workspace??draft?.blockState),source:draft?.shortSource,wiring:draft?.wiring});
  const decision=typeof frame?.branch!=='boolean'?'尚无判断':frame.branchKind==='while'?(frame.branch?'真 → 进入循环':'假 → 退出循环'):frame.branchKind==='if'?(frame.branch?'真 → 执行':'假 → 否则'):(frame.branch?'判断为真':'判断为假');
  return <section className="eq-program-observation" aria-label="程序实际观察"><header><strong>我的装置 · 实际运行记录</strong><span>{action?(current?'这份作品的记录':'修改前的记录 · 等待复核'):'等待第一次观察'}</span></header>
    <div className="eq-observation-readouts" aria-live="polite"><div className={`eq-observation-lamp ${frame?.lamp===true?'is-on':frame?.lamp===false?'is-off':'is-unknown'}`}><i aria-hidden="true"/><span>LED <b>{frame?.lamp===true?'亮':frame?.lamp===false?'灭':'待运行'}</b></span></div><div><small>实际光照读数</small><b>{frame?.light??'未读取'}</b></div><div><small>最近一次判断</small><b>{decision}</b></div></div>
    {frames.length?<div className="eq-observation-playback"><span>{action.request.actionId==='observe-output'?'隔离点灯练习':'当次作品执行'} · {frame.atMs} ms</span><div role="group" aria-label="查看实际变化时刻">{frames.map((f,i)=><button type="button" key={f.atMs} aria-pressed={i===index} onClick={()=>{setPlaying(false);setIndex(i);}}>{f.atMs} ms</button>)}</div>{frames.length>1&&!reduced&&<button type="button" onClick={()=>{setIndex(0);setPlaying(true);}}>重放这次变化</button>}</div>:<p>运行左侧的一个观察。读入、判断和灯的变化会留在这里。</p>}
    {action?.result?.value?.simulation?.status!=='completed'&&action&&<p role="status">这次运行没有走完，按林工提示修复后再观察。</p>}
  </section>;
}
