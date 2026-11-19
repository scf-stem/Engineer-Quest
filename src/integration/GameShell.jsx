import React,{useEffect,useId,useRef,useState} from 'react';
import {Icon} from '../ui/icons.jsx';
import {Dialog} from '../ui/components.jsx';
import {CandidateStamp} from './CandidateStamp.jsx';

export const GAME_TOOLS=[
  {id:'desk',label:'研发室',key:'1',icon:'desk'},
  {id:'mail',label:'委托档案',key:'2',icon:'mail'},
  {id:'wiring',label:'虚拟接线',key:'3',icon:'chip'},
  {id:'blocks',label:'图形程序',key:'4',icon:'link'},
  {id:'code',label:'简写 C++',key:'5',icon:'code'},
  {id:'tests',label:'客户测试',key:'6',icon:'chart'},
  {id:'income',label:'交付记录',key:'7',icon:'check'},
];

/** Persistent game chrome. It only requests navigation; domain guards stay in QuestApp. */
export function GameShell({joined,nickname,active,goal,income,notice,saveError,onNavigate,onManual,onTutorial,onHelp,onHardware,onClose,reduceMotion,onReduceMotion,children,room,recovery,storyEnabled=false,availableTools=GAME_TOOLS.map(t=>t.id),onEmployee}){
  const main=useId(),focus=useRef(null),wasOpen=useRef(false),opener=useRef(null);
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const open=joined&&active!=='desk';
  useEffect(()=>{
    if(open){if(!wasOpen.current&&!opener.current)opener.current={element:document.activeElement};requestAnimationFrame(()=>{const panel=focus.current,active=document.activeElement;if(panel&&(!panel.contains(active)||active?.closest('[hidden]')))panel.focus({preventScroll:true});});}
    else if(wasOpen.current){requestAnimationFrame(()=>{const original=opener.current;const target=original?.element?.isConnected?original.element:original?.key?document.querySelector(`[data-focus-key="${original.key}"]`):document.querySelector('[data-game-tool="desk"]');target?.focus({preventScroll:true});opener.current=null;});}
    wasOpen.current=open;
  },[active,open]);
  useEffect(()=>{
    const handle=event=>{
      if(document.querySelector('dialog[open]')||event.defaultPrevented)return;
      if(event.key==='Escape'&&open){event.preventDefault();onClose();return;}
      if(event.target.closest('input,textarea,select,[contenteditable="true"],.blocklyWidgetDiv,.blocklyDiv'))return;
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      const action=GAME_TOOLS.find(tool=>tool.key===event.key);
      if(action&&joined){event.preventDefault();if(!open)opener.current={element:document.activeElement,key:document.activeElement?.dataset?.focusKey};onNavigate(action.id);}
      if(event.key.toLowerCase()==='m'){event.preventDefault();onManual();}
      if(event.key.toLowerCase()==='f'){event.preventDefault();if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});}
    };
    document.addEventListener('keydown',handle);return()=>document.removeEventListener('keydown',handle);
  },[joined,open,onNavigate,onManual,onClose]);
  return <div data-active-tool={active} data-storytelling={storyEnabled?'true':undefined} className={`eq-ui eq-game ${reduceMotion?'eq-game--reduced':''}`} onClickCapture={event=>{if(!open){const target=event.target.closest('button');if(target)opener.current={element:target,key:target.dataset.focusKey};}}}>
    <img className="eq-game-backdrop" src="/art/eq-night-lab-v2.webp" alt="原创夜间研发室：左侧通信终端、中央电子工位、右侧资料柜，窗外是雨夜城市" fetchPriority="high"/>
    <a className="eq-skip-link" href={`#${main}`}>跳到主要内容</a>
    <header className="eq-game-hud">
      <button type="button" className="eq-game-brand" onClick={()=>onNavigate('desk')} aria-label="Engineer Quest 研发室"><Icon name="chip" size={27}/><span>ENGINEER <b>QUEST</b><small>微光硬件工作室 / 研发部</small></span></button>
      <div className="eq-game-session"><span className="eq-game-live-dot"/>本地软件体验</div>
      <CandidateStamp/>
      <div className="eq-game-identity"><span>{joined&&onEmployee?<button type="button" className="eq-employee-menu-button" onClick={onEmployee}>{nickname} · 员工菜单</button>:joined?nickname:'新员工'}<small>{joined?'见习工程师':'等待入职'}</small></span><b>{income}<small> EC</small></b></div>
      <button type="button" className="eq-game-hud-button" onClick={onManual} aria-label="打开工程手册"><Icon name="book"/><span>手册</span><kbd>M</kbd></button>
      <button type="button" className="eq-game-hud-button" onClick={onHelp} aria-label="现场求助说明"><Icon name="help"/></button>
    </header>
    <main id={main} tabIndex={-1} className={`eq-game-main ${open?'has-tool':''}`}>
      {!open&&room}
      <section className={`eq-game-window ${!joined?'is-entry':''}`} hidden={joined&&!open} aria-label={!joined?'员工入职':GAME_TOOLS.find(tool=>tool.id===active)?.label}>
        {open&&<div className="eq-game-windowbar"><div><span className="eq-game-window-lights" aria-hidden="true">◆</span><span>EQ / {GAME_TOOLS.find(tool=>tool.id===active)?.label}</span><small>ORDER 001</small></div><button type="button" onClick={onClose} aria-label="关闭工具，返回研发室">返回研发室 <kbd>Esc</kbd><Icon name="close" size={18}/></button></div>}
        <div className="eq-game-window-content" ref={focus} tabIndex={-1}>{children}</div>
      </section>
      {recovery}
    </main>
    <div className="eq-game-feedback"><span className="eq-game-feedback-icon">›</span><span role="status" aria-live="polite">{saveError||notice||goal.detail}</span><button type="button" onClick={()=>setFeedbackOpen(true)} aria-label="展开完整工作反馈">反馈 ↗</button></div>
    <footer className="eq-game-bottom">
      <nav className="eq-game-dock" aria-label="工程工具">{GAME_TOOLS.filter(item=>!storyEnabled||availableTools.includes(item.id)).map(item=><button type="button" data-game-tool={item.id} key={item.id} disabled={!joined&&item.id!=='desk'} onClick={()=>onNavigate(item.id)} aria-current={active===item.id?'page':undefined}><kbd>{item.key}</kbd><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
      {storyEnabled&&<details className="eq-story-tool-cabinet"><summary>工具柜</summary><div>{GAME_TOOLS.filter(item=>!availableTools.includes(item.id)).map(item=><button type="button" data-locked-tool={item.id} key={item.id} onClick={()=>onNavigate(item.id)}>{item.label}<small>用到时林工会带你来</small></button>)}{availableTools.length===GAME_TOOLS.length&&<p>这份委托的工具都已介绍，可从下方回访。</p>}</div></details>}
      <div className="eq-game-utilities"><button type="button" onClick={onTutorial}>林工 <span>工作提示</span></button><button type="button" onClick={onHardware}>实物待验</button><label><input type="checkbox" checked={reduceMotion} onChange={e=>onReduceMotion(e.target.checked)}/>减少动效</label></div>
    </footer>
    {feedbackOpen&&<Dialog className="eq-game-modal" title="工作反馈" onClose={()=>setFeedbackOpen(false)}><p>{saveError||notice||goal.detail}</p></Dialog>}
  </div>;
}

export function MissionRoom({goal,records,onNavigate,onManual,onTutorial,onInspect,workspace,availableTools,workTarget}){
  return <div className="eq-game-room">
    <section className="eq-game-objective" aria-label="当前目标" data-goal-id={goal.id}>
      <p className="eq-game-kicker">当前委托 <span>001 / 自动灯</span></p><h1>{goal.title}</h1><p>{goal.detail}</p>
      <button type="button" onClick={()=>onNavigate(workTarget??(goal.id==='claim-order'||goal.id==='read-order-and-save-card'||goal.id==='change-requirements'?'mail':goal.id==='connect-hardware'?'wiring':goal.id==='build-and-test'||goal.id==='preserve-and-change'?'blocks':goal.id==='customer-change'||goal.id==='software-income'?'code':goal.id==='personal-entry'?'desk':'tests'))}>继续当前工作 <Icon name="arrow" size={18}/></button>
    </section>
    <nav className="eq-game-hotspots" aria-label="场景互动">
      {(!availableTools||availableTools.includes('mail'))&&<button type="button" data-focus-key="room-terminal" className="eq-game-hotspot terminal" onClick={()=>onNavigate('mail')}><span>02</span><strong>通信终端<small>委托 / 中文方案</small></strong></button>}
      {(!availableTools||availableTools.includes('wiring'))&&<button type="button" data-focus-key="room-bench" className="eq-game-hotspot bench" onClick={()=>onNavigate('wiring')}><span>03</span><strong>电子工位<small>接线 / 程序 / 测试</small></strong></button>}
      <button type="button" data-focus-key="room-manual" className="eq-game-hotspot library" onClick={onManual}><span>M</span><strong>工程资料柜<small>章节 / 操作速查</small></strong></button>
    </nav>
    <aside className="eq-game-room-side"><div className="eq-game-location"><span>研发部 · 夜间工位</span><small>个人项目 / 基础材料免费</small></div><button type="button" className="eq-game-contact" onClick={onTutorial}><span>LIN</span><div><b>林工</b><small>需求负责人 · 工作提示</small></div><Icon name="arrow" size={18}/></button><button type="button" className="eq-game-kit" onClick={onInspect}><Icon name="chip"/>查看首单工具箱</button>{workspace&&<WorkspaceControls workspace={workspace}/>}</aside>
    <section className="eq-game-archive" aria-label="我的工作档案"><p className="eq-game-kicker">工作档案 <span>{String(records.length).padStart(2,'0')}</span></p>{records.length?records.map(item=><button type="button" key={item.id} onClick={()=>onNavigate(item.action==='open_mail'?'mail':item.action==='open_income'?'income':'tests')}><span>{item.title}<small>{item.state}</small></span><Icon name="arrow" size={16}/></button>):<p>尚无提交记录。领取委托后保存你的第一份方案。</p>}</section>
    <span className="eq-game-room-caption">WEIGUANG / ENGINEERING DIVISION <span>原创场景 · 本地软件体验</span></span>
  </div>;
}

/** Optional host-owned local-workspace controls. No synthetic restart implementation. */
export function WorkspaceControls({workspace}){
  const [open,setOpen]=useState(false),[acting,setActing]=useState(false);
  async function act(action,close=true){if(!action||acting)return;setActing(true);try{const result=await action();if(result!==false&&close)setOpen(false);}finally{setActing(false);}}
  return <><button type="button" className="eq-game-kit" onClick={()=>setOpen(true)}><Icon name="desk"/>本地工位 <small>{workspace.storageStatus}</small></button>{open&&<Dialog className="eq-game-modal" title="本地工位" onClose={()=>setOpen(false)}><div className="eq-game-workspace-controls"><p>{workspace.progressLabel}</p><p>存储状态：{workspace.storageStatus}</p>{workspace.storageError&&<p role="alert">{workspace.storageError}</p>}<button type="button" className="eq-button eq-button--primary" disabled={!workspace.onResume||acting} onClick={()=>act(workspace.onResume)}>继续本地工位</button><button type="button" className="eq-button eq-button--paper" disabled={!workspace.onRestart||acting||workspace.storageError} onClick={()=>act(workspace.onRestart)}>保留历史，重开本单</button><button type="button" className="eq-button eq-button--paper" disabled={acting} onClick={()=>act(workspace.onExport,false)}>导出本地档案</button>{workspace.storageError&&<><button type="button" className="eq-button eq-button--paper" disabled={acting} onClick={()=>act(workspace.onRetry,false)}>重试保存</button><button type="button" className="eq-button eq-button--paper" disabled={acting} onClick={()=>act(workspace.onReload)}>重新读取（放弃本页未保存修改）</button></>}<section className="eq-game-attempts" aria-label="本机订单历史"><h3>本机订单历史</h3>{workspace.attempts?.map((attempt,index)=><button type="button" key={attempt.id} disabled={acting||attempt.active||!!workspace.storageError} onClick={()=>act(()=>workspace.onResumeAttempt(attempt.id))}>订单尝试 {index+1} · {attempt.testCount} 次测试 {attempt.active?'· 当前':'· 继续'}</button>)}</section></div></Dialog>}</>;
}

/** Integration seam for work/npc-tutorial. No mutation/settlement functions are exposed. */
export function TutorialSlot({component:Component,facts,onNavigate,onOpenManual,onClose}){
  if(Component)return <Component facts={facts} open={true} showLauncher={false} onOpenChange={open=>{if(!open)onClose();}} onNavigate={onNavigate} onOpenManual={onOpenManual}/>;
  return <div className="eq-game-work-hint"><p className="eq-game-kicker">本地规则提示 / 林工入口</p><h3>{facts.goal.title}</h3><p>{facts.requirementReview?.diagnostic?.message||facts.guidance?.diagnostic?.message||facts.goal.detail}</p><p>当前需求 {facts.requirementVersion} · 需求情境{facts.requirementReview?.readyToAdvance?'已就绪':'待完成'} · 接线{facts.wiringValid?'规则通过':'待完成'}</p><button type="button" className="eq-button eq-button--primary" onClick={()=>onOpenManual(facts.manualSection)}>查阅相关章节 §{facts.manualSection}</button><p className="eq-fine-print">本地固定提示，不是在线 AI 评审；教师负责课堂指导与实物安全检查。</p></div>;
}
