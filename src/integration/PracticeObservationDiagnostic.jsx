import React from 'react';
import './practice-observation.css';

const lamp=value=>value===true?'亮':value===false?'灭':'尚无可核对的记录';
export function PracticeCriterion({criterion}){
  if(!criterion)return null;
  return <aside className="eq-practice-criterion" aria-label="本次连续观察口径"><strong>这次看三段变化</strong><p>{criterion.description}</p><div>{criterion.windows.map(row=><span key={row.checkedAtMs}>{row.fromMs}–{row.toMs}ms<br/>{row.checkedAtMs}ms核对</span>)}</div></aside>;
}
export function PracticeObservationDiagnostic({diagnostic,current=true}){
  if(!diagnostic)return null;
  const first=Math.max(0,diagnostic.windows.findIndex(row=>row.readObserved!==true||row.outputMatches!==true));
  return <section className="eq-practice-diagnostic" aria-label="连续变化实际诊断" data-diagnostic-status={diagnostic.status} data-current={current}>
    <h3>对照这次的读取与输出</h3>{!current&&<p className="eq-practice-diagnostic-stale">修改前的运行记录。当前作品尚未运行这次变化；这里保留原来发生的读写。</p>}<p role="status">{diagnostic.summary}</p>
    <div>{diagnostic.windows.map((row,index)=><article key={row.checkedAtMs} data-window-at={row.checkedAtMs} data-window-matched={row.readObserved===true&&row.outputMatches===true}><details open={index===first}>
      <summary>{row.checkedAtMs}ms · 期望{lamp(row.expectedLamp)} / 实际{lamp(row.actualLamp)}</summary><h4>{row.fromMs}–{row.toMs}ms · 光照{row.input}</h4>
      <p>最近读取：{row.lastRead?`${row.lastRead.atMs}ms 读到${row.lastRead.value}`:'本段之前没有LIGHT读取'}</p>
      <p>最近输出：{row.lastWrite?`${row.lastWrite.atMs}ms 明确${row.lastWrite.value?'开':'关'}灯`:row.actualOutputSource==='initial'?'尚未写出，显示初始灯态':'尚无LAMP写出记录'}</p>
      {row.lastWrite&&row.lastReadBeforeWrite&&<p>这次写出之前，最近一次读取是{row.lastReadBeforeWrite.atMs}ms的{row.lastReadBeforeWrite.value}。</p>}
      {row.reasons.map(reason=><p key={reason.code}>{reason.message}</p>)}
    </details></article>)}</div>
    <p className="eq-practice-diagnostic-next">{diagnostic.nextAction}</p><p>{diagnostic.customerCheck.message}</p>
  </section>;
}
