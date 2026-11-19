import React,{useEffect,useState} from 'react';
import './mentor-conversation.css';

/** Scripted dialogue reacts to public work facts. Reading/asking never grants evidence. */
export function MentorConversation({scene,onManual,children,compact=false}){
  const [line,setLine]=useState(0),[aside,setAside]=useState(null),[quiet,setQuiet]=useState(false),[history,setHistory]=useState([]);
  useEffect(()=>{setLine(0);setAside(null);setQuiet(false);},[scene.id]);
  const words=aside??scene.lines[Math.min(line,scene.lines.length-1)];
  function say(text){setHistory(items=>[...items,words].filter(Boolean).slice(-12));setAside(text);setQuiet(false);}
  return <section className={`eq-mentor-conversation ${compact?'is-compact':''} ${quiet?'is-working':''}`} aria-label="和林工一起做" data-mentor-scene={scene.id}>
    <div className="eq-mentor-portrait"><img src="/art/npc-tutorial/lin-mentor-v2.webp" alt="林工站在工位旁"/><span>林工 <small>研发部 / 你的带教</small></span></div>
    <div className="eq-mentor-dialogue"><header><span>{scene.place||'微光研发室'}</span><small>角色对话 · 本地脚本</small></header>
      <p className="eq-mentor-current-line" role="status">{words}</p>
      {!quiet&&<div className="eq-mentor-replies" aria-label="回应林工">
        {!aside&&line<scene.lines.length-1?<button type="button" onClick={()=>{setHistory(items=>[...items,words].slice(-12));setLine(line+1);}}>听林工接着说 ▷</button>:<button type="button" onClick={()=>{setQuiet(true);setAside(scene.working||'好，你来动手。我在旁边看；有变化我们再一起聊。');}}>我来动手试试</button>}
        <button type="button" onClick={()=>say(scene.help||'先观察眼前的一个变化，再试一次。作品会留在这里，不用从头重来。')}>林工，我卡在这里</button>
        {scene.why&&<button type="button" onClick={()=>say(scene.why)}>为什么要这样做？</button>}
        {onManual&&scene.manualSection&&<button type="button" onClick={()=>onManual(scene.manualSection)}>一起翻手册 §{scene.manualSection} ↗</button>}
      </div>}
      {quiet&&<button type="button" className="eq-mentor-call-back" onClick={()=>{setQuiet(false);setAside(null);}}>再和林工聊聊</button>}
      {children}
      {history.length>0&&<details className="eq-mentor-history"><summary>刚才聊过的话</summary>{history.map((text,i)=><p key={i}>林工：{text}</p>)}</details>}
    </div>
  </section>;
}
