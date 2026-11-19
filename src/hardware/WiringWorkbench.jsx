import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {UNO_CANDIDATE_PROFILE, componentDefinition, componentKind, getTerminalIndex, terminalKey} from './profile.js';
import {validateWiring} from './wiring.js';
import {routeWire} from './routing.js';
import './workbench.css';
import {wiringJourney} from '../integration/wiring-journey.js';

const WIDTH = 1040, HEIGHT = 530;
const copy = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const COLORS = {ground: '#687b8e', power: '#b75c3e', analog: '#ab791f', digital: '#297a69', passive: '#297a69'};
const EMPTY_CONNECTION_CODES = new Set(['SENSOR_POWER_MISSING', 'SENSOR_GROUND_MISSING', 'SENSOR_PIN_MISMATCH', 'LED_GROUND_MISSING', 'LED_SERIES_RESISTOR_MISSING']);
const curve = (a, b) => {
  const offset = Math.max(42, Math.abs(b.x - a.x) * 0.45);
  return `M${a.x},${a.y} C${a.x + offset},${a.y} ${b.x - offset},${b.y} ${b.x},${b.y}`;
};

/** Controlled, local teaching canvas. Supply execution outputs from A; no program runs here. */
export function WiringWorkbench({value, deviceProfile = UNO_CANDIDATE_PROFILE, onChange, diagnostics = [], readOnly = false, lightValue = 150, onLightChange, outputs, onOpenManual, resolveManualSection, className = '', classTokens = {},guided=false,completedMessage}) {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef(null), stageRef = useRef(null), terminalRefs = useRef(new Map()), gesture = useRef(null);
  const pendingValue = useRef(null), lastValue = useRef(value);
  const [history, setHistory] = useState({past: [], future: []});
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [wireStart, setWireStart] = useState(null), [wireEnd, setWireEnd] = useState(null);
  const [preview, setPreview] = useState(null), [announcement, setAnnouncement] = useState('选择一个端子，开始接线。');
  const [viewMode, setViewMode] = useState('overview'), [revealRequest, setRevealRequest] = useState(null);
  const editable = !readOnly && typeof onChange === 'function';
  const result = useMemo(() => validateWiring(value, deviceProfile), [value, deviceProfile]);
  const index = useMemo(() => getTerminalIndex(value, deviceProfile), [value, deviceProfile]);
  const allDiagnostics = useMemo(() => {
    const seen = new Set();
    return [...result.diagnostics, ...diagnostics].filter(d => {
      const key = `${d.code}|${d.message}|${(d.terminalIds ?? []).join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [result, diagnostics]);
  const errors = allDiagnostics.filter(d => d.severity === 'error');
  const warnings = allDiagnostics.filter(d => d.severity === 'warning');
  const components = Array.isArray(value?.components) ? value.components : [];
  const wires = Array.isArray(value?.connections) ? value.connections : [];
  const localErrors = result.diagnostics.filter(d => d.severity === 'error');
  // This is presentation only. The strict validation result and output gate stay unchanged.
  const journey=wiringJourney(value,result);
  const waitingForConnections = guided?!result.ok&&!journey.faults.length:Array.isArray(value?.connections) && !wires.length && localErrors.length > 0
    && localErrors.every(d => EMPTY_CONNECTION_CODES.has(d.code)) && !diagnostics.some(d => d.severity === 'error');
  const visibleErrors = waitingForConnections ? [] : guided?journey.faults:errors;
  const errorTerminals = new Set(visibleErrors.flatMap(d => d.terminalIds ?? []));
  const shownComponents = components.filter(c => componentDefinition(c, deviceProfile));
  const positions = new Map(shownComponents.map(c => [c.instanceId, preview?.id === c.instanceId ? preview.position : c.position]));
  const pointFor = id => {
    const terminal = index.get(id), position = positions.get(terminal?.componentId);
    return terminal && position ? {x: position.x + terminal.position.x, y: position.y + terminal.position.y} : null;
  };
  const obstacles = shownComponents.map(c => ({...positions.get(c.instanceId), ...componentDefinition(c, deviceProfile)}));
  const portFor = id => {
    const terminal = index.get(id), component = shownComponents.find(c => c.instanceId === terminal?.componentId), point = pointFor(id);
    if (!component || !point) return null;
    const position = positions.get(component.instanceId), definition = componentDefinition(component, deviceProfile), kind = componentKind(component, deviceProfile);
    const exit = kind === 'resistor' ? {x: position.x + (terminal.id === '1' ? -12 : definition.width + 12), y: point.y}
      : {x: point.x, y: position.y + (kind === 'uno' && terminal.row === 'top' ? -12 : definition.height + 12)};
    return {...point, exit};
  };
  const selected = index.get(selectedTerminal);
  const inspectedComponent = components.find(c => c.instanceId === (selected?.componentId ?? selectedComponent));
  const inspectedDefinition = inspectedComponent && componentDefinition(inspectedComponent, deviceProfile);

  // External document replacement starts a fresh local undo history (e.g. a different owner).
  useEffect(() => {
    if (lastValue.current !== value && JSON.stringify(value) !== pendingValue.current) setHistory({past: [], future: []});
    lastValue.current = value; pendingValue.current = null;
    setWireStart(null); setWireEnd(null); setPreview(null); gesture.current = null;
    if (selectedTerminal && !index.has(selectedTerminal)) setSelectedTerminal(null);
  }, [value, index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editable) { gesture.current = null; setWireStart(null); setWireEnd(null); setPreview(null); }
  }, [editable]);
  useEffect(() => {
    if (viewMode === 'overview') stageRef.current?.scrollTo({left: 0, top: 0});
    if (revealRequest) revealTerminal(revealRequest.id, revealRequest.focus);
  }, [viewMode, revealRequest]); // DOM layout has applied the chosen scale before centering.

  function revealTerminal(id, focus = false) {
    const node = terminalRefs.current.get(id), stage = stageRef.current;
    if (!node || !stage) return;
    if (focus) { node.focus({preventScroll: true}); stage.scrollIntoView({block: 'nearest', inline: 'nearest'}); }
    if (viewMode !== 'detail') return;
    const pin = node.getBoundingClientRect(), viewport = stage.getBoundingClientRect();
    stage.scrollTo({
      left: stage.scrollLeft + pin.x + pin.width / 2 - viewport.x - stage.clientWidth / 2,
      top: stage.scrollTop + pin.y + pin.height / 2 - viewport.y - stage.clientHeight / 2,
    });
  }
  function changeView(mode) {
    cancelGesture(); setViewMode(mode);
    setAnnouncement(mode === 'overview' ? '全景显示全部元件。' : '已放大。可用左右按钮查看引脚。');
    setRevealRequest(selectedTerminal ? {id: selectedTerminal, focus: false} : null);
    if (mode === 'detail' && !selectedTerminal) stageRef.current?.scrollTo({left: 0, top: 0});
  }

  function emit(next, message) {
    if (!editable) return;
    setHistory(h => ({past: [...h.past.slice(-39), copy(value)], future: []}));
    pendingValue.current = JSON.stringify(next); onChange(next); setAnnouncement(message);
  }
  function travel(direction) {
    if (!editable) return;
    const collection = direction === 'undo' ? history.past : history.future;
    if (!collection.length) return;
    const next = collection.at(-1);
    setHistory(direction === 'undo' ? {past: history.past.slice(0, -1), future: [...history.future, copy(value)]} : {past: [...history.past, copy(value)], future: history.future.slice(0, -1)});
    pendingValue.current = JSON.stringify(next); onChange(copy(next));
    setAnnouncement(direction === 'undo' ? '已撤销上一步。' : '已重做。');
  }
  function connect(from, to) {
    setWireStart(null); setWireEnd(null);
    if (!editable) return;
    if (from === to) { setAnnouncement('同一个端子不能接到自身。请选择另一个端子。'); return; }
    if (wires.some(w => (w.from === from && w.to === to) || (w.from === to && w.to === from))) { setAnnouncement('这两个端子已经相连。'); return; }
    if (wires.length >= 64) { setAnnouncement('本关最多允许 64 条连线。请先删除多余导线。'); return; }
    let sequence = 1;
    while (wires.some(w => w.id === `wire-${sequence}`)) sequence++;
    emit({...value, connections: [...wires, {id: `wire-${sequence}`, from, to}]}, `已连接 ${from} 和 ${to}。`);
  }
  function chooseTerminal(id) {
    setSelectedTerminal(id); setSelectedComponent(null);
    if (!editable || !index.get(id)?.connectable) return;
    if (wireStart) connect(wireStart, id);
    else { setWireStart(id); setAnnouncement(`起点 ${id}。选择终点，或按 Escape 取消。`); }
  }
  function localPoint(event) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return {x: 0, y: 0};
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }
  function capture(event, data) {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    gesture.current = {...data, start: localPoint(event), moved: false, pointerId: event.pointerId};
    svgRef.current.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || !editable) return;
    const at = localPoint(event), dx = at.x - current.start.x, dy = at.y - current.start.y;
    if (Math.hypot(dx, dy) > 4) current.moved = true;
    if (!current.moved) return;
    if (current.kind === 'wire') { setWireStart(current.id); setWireEnd(at); }
    else {
      const definition = componentDefinition(current.component, deviceProfile);
      setPreview({id: current.component.instanceId, position: {x: clamp(current.component.position.x + dx, 24, WIDTH - definition.width - 24), y: clamp(current.component.position.y + dy, 24, HEIGHT - definition.height - 24)}});
    }
  }
  function pointerUp(event) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (svgRef.current.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    if (!editable) return;
    if (current.kind === 'wire') {
      if (!current.moved) { chooseTerminal(current.id); return; }
      const at = localPoint(event);
      const hit = [...index.values()].filter(t => t.connectable).map(t => ({id: t.key, at: pointFor(t.key)})).filter(t => t.at && Math.hypot(t.at.x - at.x, t.at.y - at.y) <= 16).sort((a, b) => Math.hypot(a.at.x - at.x, a.at.y - at.y) - Math.hypot(b.at.x - at.x, b.at.y - at.y))[0];
      if (hit) connect(current.id, hit.id);
      else { setWireStart(null); setWireEnd(null); setAnnouncement('未命中终点。请拖到端子圆点，或依次点击两个端子。'); }
    } else if (current.moved) {
      const at = localPoint(event), definition = componentDefinition(current.component, deviceProfile);
      const position = {x: clamp(current.component.position.x + at.x - current.start.x, 24, WIDTH - definition.width - 24), y: clamp(current.component.position.y + at.y - current.start.y, 24, HEIGHT - definition.height - 24)};
      setPreview(null);
      emit({...value, components: components.map(c => c.instanceId === current.component.instanceId ? {...c, position} : c)}, `已移动 ${definition.title}，接线关系保持一致。`);
    } else setSelectedComponent(current.component.instanceId);
  }
  function cancelGesture() { gesture.current = null; setPreview(null); setWireStart(null); setWireEnd(null); setAnnouncement('已取消本次操作。'); }
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); cancelGesture(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo'); }
  }
  function moveWithKeys(event, component) {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setSelectedComponent(component.instanceId); setSelectedTerminal(null); return; }
    const delta = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (!delta || !editable) return;
    event.preventDefault(); const step = event.shiftKey ? 1 : 10, definition = componentDefinition(component, deviceProfile);
    const position = {x: clamp(component.position.x + delta[0] * step, 24, WIDTH - definition.width - 24), y: clamp(component.position.y + delta[1] * step, 24, HEIGHT - definition.height - 24)};
    emit({...value, components: components.map(c => c.instanceId === component.instanceId ? {...c, position} : c)}, `已微调 ${definition.title}。`);
  }
  function focusDiagnostic(d) {
    const id = d.terminalIds?.find(id => index.has(id));
    if (id) { setSelectedTerminal(id); setViewMode('detail'); setRevealRequest({id, focus: true}); }
  }
  const lampKnown = !errors.length && result.ok && typeof outputs?.lamp === 'boolean';
  const lampOn = lampKnown && outputs.lamp;

  return <section className={`eq-hardware ${className} ${classTokens.root ?? ''}`} onKeyDown={keyDown} aria-label="虚拟电子工作台" data-view-mode={viewMode}>
    <header className={`eq-hw-header ${classTokens.header ?? ''}`}>
      <div><p className="eq-hw-eyebrow">ENGINEER QUEST / HARDWARE LAB</p><h2>把想法，接成电路<span>01</span></h2><p>自动灯 · 虚拟接线台</p></div>
      <div className="eq-hw-candidate">候选 Uno 引脚<span>R3 参考 · 实物与校准待核验</span></div>
    </header>
    <div className="eq-hw-toolbar">
      <span className={`eq-hw-state ${waitingForConnections ? 'is-pending' : visibleErrors.length ? '' : 'is-ready'}`}>{waitingForConnections ? (wires.length?'继续接线':'待连接') : visibleErrors.length ? `${visibleErrors.length} 项待修复` : '接线规则通过'}<small> / {wires.length} 条线</small></span>
      <div><button type="button" disabled={!editable || !history.past.length} onClick={() => travel('undo')}>↶ 撤销</button><button type="button" disabled={!editable || !history.future.length} onClick={() => travel('redo')}>↷ 重做</button><button type="button" disabled={!editable || !wires.length} onClick={() => emit({...value, connections: []}, '已清空连线，可撤销。')}>清空连线</button></div>
    </div>
    {guided&&<p className="eq-wire-current-goal" role="status">{result.ok&&completedMessage?completedMessage:journey.message}</p>}
    <div className="eq-hw-layout">
      <div className="eq-hw-main">
        <p className="eq-hw-instruction" id={`${uid}-help`}>{readOnly ? '只读接线方案。选择端子可查看资料。' : '拖动端子接线，也可依次点击两个端子。拖动元件标题调整位置。'}<span>键盘：Enter 选端子 · 方向键移动元件 · Esc 取消</span></p>
        <div className="eq-hw-viewbar">
          <div role="group" aria-label="画布视图"><button type="button" aria-pressed={viewMode === 'overview'} onClick={() => changeView('overview')}>查看全景</button><button type="button" aria-pressed={viewMode === 'detail'} onClick={() => changeView('detail')}>放大接线</button></div>
          {viewMode === 'detail' ? <div role="group" aria-label="移动放大视图"><button type="button" onClick={() => stageRef.current?.scrollBy({left: -stageRef.current.clientWidth * .65})}>← 向左查看</button><button type="button" onClick={() => stageRef.current?.scrollBy({left: stageRef.current.clientWidth * .65})}>向右查看 →</button></div> : <span>全景包含全部元件；放大后查看引脚文字。</span>}
        </div>
        <div ref={stageRef} className={`eq-hw-stage ${classTokens.canvas ?? ''}`}>
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="自动灯接线画布" aria-describedby={`${uid}-help`} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelGesture}>
            <defs><pattern id={`${uid}-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#c3cfca" /></pattern><filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#243d36" floodOpacity=".12" /></filter></defs>
            <rect width={WIDTH} height={HEIGHT} fill={`url(#${uid}-grid)`} />
            <text x="28" y="27" className="eq-hw-canvas-note">WORKBENCH 01 / 顶视功能示意 · 非等比例实物图</text>
            {shownComponents.map(component => {
              const definition = componentDefinition(component, deviceProfile), kind = componentKind(component, deviceProfile), position = positions.get(component.instanceId);
              if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return null;
              return <g key={component.instanceId} transform={`translate(${position.x},${position.y})`} data-component={component.instanceId}>
                <rect width={definition.width} height={definition.height} rx={kind === 'uno' ? 18 : 12} className={`eq-hw-part eq-hw-part-${kind}`} filter={`url(#${uid}-shadow)`} />
                {kind === 'uno' ? <>
                  <rect x="-8" y="83" width="60" height="65" rx="5" className="eq-hw-usb" /><text x="16" y="122" className="eq-hw-usb-label">USB</text>
                  <rect x="128" y="160" width="220" height="33" rx="4" fill="#183f37" /><path d="M140 154v-9m20 9v-9m20 9v-9m20 9v-9m20 9v-9m20 9v-9m20 9v-9m20 9v-9m20 9v-9m20 9v-9" stroke="#b4b9a6" strokeWidth="5" />
                  <text x="390" y="104" className="eq-hw-board-badge">UNO</text><text x="390" y="125" className="eq-hw-board-note">候选 R3</text>
                  <text x="70" y="226" className="eq-hw-board-note">POWER</text><text x="300" y="226" className="eq-hw-board-note">ANALOG IN</text>
                  <circle cx="24" cy="228" r="6" className="eq-hw-hole" /><circle cx="430" cy="220" r="6" className="eq-hw-hole" />
                </> : kind === 'sensor' ? <><circle cx="100" cy="69" r="23" fill="#dec48a" stroke="#a27a39" strokeWidth="2" /><path d="M84 56h24v8H91v8h18v8H84" fill="none" stroke="#987039" strokeWidth="3" /></> : kind === 'resistor' ? <><path d="M20 65h35m70 0h35" stroke="#859486" strokeWidth="4" /><rect x="55" y="50" width="70" height="30" rx="10" fill="#decb9c" /><path d="M70 50v30m12-30v30" stroke="#a74436" strokeWidth="6" /><path d="M96 50v30" stroke="#553c31" strokeWidth="6" /><path d="M114 50v30" stroke="#b18a40" strokeWidth="4" /></> : <><path d="M64 102v28m43-28v28" stroke="#9aa89d" strokeWidth="4" /><path d="M59 98V74a26 26 0 0152 0v24z" className={`eq-hw-led ${lampOn ? 'is-on' : ''}`} /><path d="M66 99h44" stroke="#919d90" strokeWidth="4" /><text x="85" y="118" textAnchor="middle" className="eq-hw-output-label">{lampKnown ? (lampOn ? '亮' : '灭') : '未运行'}</text></>}
                <g role="button" tabIndex={0} aria-label={`移动 ${definition.title}（方向键可微调）`} aria-disabled={!editable} data-component-handle={component.instanceId} className="eq-hw-drag-handle" onPointerDown={event => { setSelectedTerminal(null); setSelectedComponent(component.instanceId); capture(event, {kind: 'component', component}); }} onKeyDown={event => moveWithKeys(event, component)}>
                  <rect x={kind === 'uno' ? 80 : 0} y={kind === 'uno' ? 65 : 0} width={kind === 'uno' ? 260 : definition.width} height={kind === 'uno' ? 76 : 43} rx="6" fill="transparent" />
                  <text x={kind === 'uno' ? 92 : 16} y={kind === 'uno' ? 91 : 21} className={kind === 'uno' ? 'eq-hw-board-title' : 'eq-hw-part-title'}>{definition.title}<tspan className="eq-hw-grip"> ⠿</tspan></text>
                  <text x={kind === 'uno' ? 92 : 16} y={kind === 'uno' ? 115 : 36} className={kind === 'uno' ? 'eq-hw-board-note' : 'eq-hw-part-subtitle'}>{definition.subtitle}</text>
                </g>
              </g>;
            })}
            {wires.map(wire => {
              const from = portFor(wire.from), to = portFor(wire.to);
              if (!from || !to) return null;
              const sourceSignal = [index.get(wire.from)?.signal, index.get(wire.to)?.signal].find(s => ['ground', 'power', 'analog'].includes(s)) ?? 'digital';
              const path = routeWire(from, to, obstacles);
              return <g key={wire.id} data-wire={wire.id}><path d={path} className="eq-hw-wire-outline" /><path d={path} stroke={COLORS[sourceSignal]} className="eq-hw-wire" /></g>;
            })}
            {shownComponents.map(component => {
              const definition = componentDefinition(component, deviceProfile), kind = componentKind(component, deviceProfile), position = positions.get(component.instanceId);
              if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return null;
              return <g key={`${component.instanceId}-terminals`} transform={`translate(${position.x},${position.y})`}>
                {definition.terminals.map(terminal => {
                  const id = terminalKey(component.instanceId, terminal.id), board = kind === 'uno', active = wireStart === id, hasError = errorTerminals.has(id);
                  const labelY = board ? terminal.row === 'top' ? 25 : -12 : -14;
                  return <g key={terminal.id} ref={node => { if (node) terminalRefs.current.set(id, node); else terminalRefs.current.delete(id); }} transform={`translate(${terminal.position.x},${terminal.position.y})`} role="button" tabIndex={0} aria-label={`端子 ${id}（${terminal.label}）`} aria-disabled={!editable || !terminal.connectable} aria-pressed={active} data-terminal={id} data-connectable={terminal.connectable} className={`eq-hw-terminal ${board ? 'on-board' : ''} ${!terminal.connectable ? 'is-muted' : ''} ${active ? 'is-active' : ''} ${hasError ? 'has-error' : ''}`} onFocus={() => revealTerminal(id)} onPointerDown={event => { setSelectedTerminal(id); setSelectedComponent(null); if (terminal.connectable) capture(event, {kind: 'wire', id}); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseTerminal(id); } }}>
                    <title>{`${id} · ${terminal.description ?? definition.description}`}</title>
                    <circle r="15" className="eq-hw-terminal-hit" /><circle r={board ? 6 : 7} className="eq-hw-terminal-pin" /><circle r="2" fill={board ? '#243e35' : '#fff'} />
                    <text y={labelY} textAnchor="middle" className="eq-hw-terminal-label">{terminal.label}</text>
                  </g>;
                })}
              </g>;
            })}
            {wireStart && wireEnd && pointFor(wireStart) && <path d={curve(pointFor(wireStart), wireEnd)} className="eq-hw-wire eq-hw-wire-preview" />}
          </svg>
        </div>
        <div className="eq-hw-canvas-footer"><span><i className="eq-hw-dot power" />电源</span><span><i className="eq-hw-dot ground" />公共地</span><span><i className="eq-hw-dot analog" />光照信号</span><span><i className="eq-hw-dot digital" />灯输出</span><small>{viewMode === 'overview' ? '全景视图' : '使用左右按钮查看，或滚动画布'}</small></div>
        <div className="eq-hw-signal-panel">
          <label htmlFor={`${uid}-light`}>虚拟光照 <strong>{lightValue}</strong><span>较小值表示暗 · 合成输入</span></label>
          <input id={`${uid}-light`} type="range" min="0" max="1023" step="1" value={lightValue} disabled={readOnly || !onLightChange} onChange={event => onLightChange?.(Number(event.target.value))} />
          <div className="eq-hw-signal-ends"><span>暗 0</span><span>亮 1023</span></div>
          <p>输入交给程序引擎处理。灯状态：<strong>{lampKnown ? (lampOn ? '亮' : '灭') : '未运行 / 接线未通过'}</strong></p>
        </div>
      </div>
      <aside className={`eq-hw-sidebar ${classTokens.sidebar ?? ''}`} aria-label="接线资料与检查">
        <section className="eq-hw-inspector"><p className="eq-hw-eyebrow">COMPONENT NOTES</p><h3>{selected ? `${selected.componentTitle} · ${selected.label}` : inspectedDefinition?.title ?? '先认识你的元件'}</h3><p>{selected?.description ?? inspectedDefinition?.description ?? '选择端子或元件标题，查看用途。首单包含开发板、光照模块、电阻和 LED。'}</p>{selected && <code>{selected.key}</code>}{inspectedDefinition && <button type="button" className="eq-hw-manual" disabled={!onOpenManual || (resolveManualSection && !resolveManualSection(inspectedDefinition.manualSection))} onClick={() => onOpenManual?.(resolveManualSection ? resolveManualSection(inspectedDefinition.manualSection) : inspectedDefinition.manualSection)}>手册 §{resolveManualSection ? resolveManualSection(inspectedDefinition.manualSection) : inspectedDefinition.manualSection}{resolveManualSection ? " · 元件资料" : " · 候选节号"} ↗</button>}</section>
        <section className={`eq-hw-diagnostics ${classTokens.diagnostics ?? ''}`}><h3>接线检查 <span>{waitingForConnections ? '待连接' : errors.length ? '待修复' : '规则通过'}</span></h3>{waitingForConnections && <p className="eq-hw-pending">{guided?journey.message:'还没有连线。先选择一个端子，开始连接元件；接线后会逐项检查。'}</p>}{errors.length === 0 && <p className="eq-hw-success">{guided&&completedMessage?'当前线路符合这份作品。这里可以回看，或检查修改后的连线。':'虚拟接线规则通过。继续搭建程序、逐步观察，再核对客户测试。'}</p>}<ul>{visibleErrors.map((d, i) => <li key={`${d.code}-${i}`}><button type="button" data-diagnostic-code={d.code} onClick={() => focusDiagnostic(d)}><span className="eq-hw-error-mark">!</span><span>{d.message}</span></button></li>)}</ul>{warnings.map((d, i) => <p className="eq-hw-warning" data-diagnostic-code={d.code} key={`${d.code}-${i}`}>{d.message}</p>)}</section>
      </aside>
    </div>
    <details className="eq-hw-wire-list"><summary>连接清单 <span>{wires.length} 条 · 可逐条删除</span></summary><ul>{wires.map(wire => <li key={wire.id}><span><code>{wire.from}</code><b>↔</b><code>{wire.to}</code></span><button type="button" disabled={!editable} aria-label={`删除连线 ${wire.id}`} onClick={() => emit({...value, connections: wires.filter(w => w.id !== wire.id)}, `已删除 ${wire.id}，可撤销。`)}>删除</button></li>)}</ul>{!wires.length && <p>还没有连线。先找到电源与公共地端子。</p>}</details>
    <p className="eq-hw-announcement" role="status" aria-live="polite">{announcement}</p>
  </section>;
}

export default WiringWorkbench;
