import React, { useId } from 'react';
import { Icon } from '../icons.jsx';
import { STUDIO_SCENE_ART } from '../art.js';

export { STUDIO_SCENE_ART } from '../art.js';
export const STATION_HOTSPOTS = [
  {id: 'mail', actionId: 'open_mail', label: '公司邮箱', hint: '看看客户要解决什么', icon: 'mail', x: 12, y: 49},
  {id: 'kit', actionId: 'inspect_kit', label: '首单工具箱', hint: '认识输入与输出元件', icon: 'chip', x: 46, y: 58},
  {id: 'npc', actionId: 'talk_requirements_npc', label: '和林工聊一聊', hint: '先说想法，方案可以再改', icon: 'help', x: 80, y: 49},
];

function actionState(actionId, states, onAction) {
  const state = states[actionId] || {};
  return {disabled: !onAction || !!state.disabled, reason: state.reason || (!onAction ? '尚未接入操作入口' : '')};
}

export function QuestTracker({ goal }) {
  const current = goal || {id: 'visual', title: '探索你的研发工位', detail: '等待实际任务目标。当前为视觉小样。', status: 'visual'};
  const labels = {visual: '视觉小样', in_progress: '进行中', complete: '已完成', blocked: '等待前置条件'};
  return <section className="eq-quest-tracker" aria-label="当前目标" data-goal-id={current.id}><div><span className="eq-quest-diamond" aria-hidden="true"/><span>当前目标</span><small>{labels[current.status] || current.status || '等待状态'}</small></div><h2>{current.title}</h2><p>{current.detail}</p></section>;
}

export function ExplorationScene({ sceneSrc = STUDIO_SCENE_ART, hotspots = STATION_HOTSPOTS, onAction, actionStates = {}, showMarkers = true }) {
  return <div className="eq-exploration-scene"><img className="eq-exploration-background" src={sceneSrc} alt="原创研发室：左侧公司邮箱、中央元件工作台、右侧抱笔记本的林工" fetchPriority="high"/>
    <div className="eq-scene-vignette" aria-hidden="true"/>
    <div className="eq-scene-hotspots" role="group" aria-label="场景互动" data-markers={showMarkers ? 'visible' : 'hidden'}>{hotspots.map(point => {
      const state = actionState(point.actionId, actionStates, onAction);
      return <button type="button" key={point.id} className="eq-world-hotspot" style={{left: `${point.x}%`, top: `${point.y}%`}} onClick={() => onAction?.(point.actionId)} disabled={state.disabled} title={state.reason || point.hint} aria-label={point.label}><span className="eq-hotspot-ring"><Icon name={point.icon} size={20}/></span><span className="eq-hotspot-label">{point.label}<small>{point.hint}</small></span></button>;
    })}</div>
    <span className="eq-world-location">研发部 <span>/</span> 傍晚的个人工位</span>
  </div>;
}

/** Presentation only. Actions are navigation/inspection requests, never business writes. */
export function ExplorationStation({ employee, goal, onAction, actionStates = {}, sceneSrc, hotspots = STATION_HOTSPOTS, feedback, reduceMotion = false, onReduceMotionChange, showMarkers = true, onShowMarkersChange, homeHref = './preview.html', onHome, sceneStatus = '原创场景 / 视觉小样', children }) {
  const actionsId = useId();
  const tools = [['open_wiring', '硬件接线'], ['open_blocks', '积木 Demo'], ['open_code', '简写 C++'], ['open_tests', '客户测试'], ['open_income', '我的收入']];
  return <div className="eq-ui eq-adventure" data-motion={reduceMotion ? 'reduced' : 'normal'}><a className="eq-skip-link" href={`#${actionsId}`}>跳到互动入口</a>
    <header className="eq-adventure-header"><a href={homeHref} onClick={event => {if (onHome) {event.preventDefault(); onHome();}}} className="eq-adventure-brand"><Icon name="chip" size={24}/><span>ENGINEER QUEST<small>研发体验所 · 个人入职</small></span></a><span className="eq-shift-tag">FIRST SHIFT <b>第一份委托</b></span><div className="eq-adventure-employee"><span>{employee?.nickname || '新员工'}</span><small>{employee?.synthetic ? '合成演示身份' : '个人研发工位'}</small></div></header>
    <main className="eq-adventure-main"><div className="eq-adventure-intro"><div><p>第一日 / 校园自动灯委托</p><h1>每个想法，都从一次好奇开始。</h1></div><span>场景探索 · 可跳过</span></div>
      <div className="eq-world-frame"><QuestTracker goal={goal}/><ExplorationScene sceneSrc={sceneSrc} hotspots={hotspots} actionStates={actionStates} onAction={onAction} showMarkers={showMarkers}/><div className="eq-world-caption"><span><i aria-hidden="true"/>先看看周围，再决定从哪里开始。</span><span>{sceneStatus}</span></div></div>
      <div className="eq-exploration-controls"><p>点选场景标记，或使用下面相同的互动入口。</p><div><label><input type="checkbox" checked={showMarkers} onChange={event => onShowMarkersChange?.(event.target.checked)} disabled={!onShowMarkersChange}/>显示互动标记</label><label><input type="checkbox" checked={reduceMotion} onChange={event => onReduceMotionChange?.(event.target.checked)} disabled={!onReduceMotionChange}/>减少动效</label></div></div>
      <nav id={actionsId} className="eq-discovery-actions" aria-label="互动入口" tabIndex={-1}>{hotspots.map(point => {
        const state = actionState(point.actionId, actionStates, onAction);
        return <div className="eq-discovery-action" key={point.id}><button type="button" disabled={state.disabled} onClick={() => onAction?.(point.actionId)}><Icon name={point.icon} size={22}/><span>{point.label}<small>{point.hint}</small></span><Icon name="arrow" size={18}/></button>{state.disabled && state.reason && <p>{state.reason}</p>}</div>;
      })}</nav>
      <div className="eq-adventure-feedback" role="status" aria-live="polite"><span aria-hidden="true">✦</span>{feedback || '探索可随时跳过。查看物品和对话不会推进课程、发放工程币或授予验收。'}</div>
      <details className="eq-direct-tools"><summary>直接打开工程工具</summary><div>{tools.map(([actionId, label]) => {
        const state = actionState(actionId, actionStates, onAction);
        return <div key={actionId}><button type="button" disabled={state.disabled} onClick={() => onAction?.(actionId)}>{label}<Icon name="arrow" size={15}/></button>{state.disabled && state.reason && <small>{state.reason}</small>}</div>;
      })}</div></details>
      <footer className="eq-adventure-footer"><span>探索入口只负责打开工具；提交、测试和验收仍在实际工作界面完成。</span><button type="button" disabled={actionState('request_help', actionStates, onAction).disabled} onClick={() => onAction?.('request_help')}><Icon name="help" size={16}/>需要时，找老师</button></footer>
    </main>{children}
  </div>;
}
