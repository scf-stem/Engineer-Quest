import React, {useEffect, useRef, useState} from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Zh from 'blockly/msg/zh-hans';
import {registerProgramBlocks} from '../program/index.js';
import './teaching-editor.css';

const EMPTY = {blocks: {languageVersion: 0, blocks: []}};
const LOCAL_TYPES = new Set(['eqp_write', 'logic_boolean', 'eqp_wait', 'math_number', 'eqp_read_analog', 'eqt_sample']);
const LABELS = {eqp_write: '灯的指令', logic_boolean: '开／关值', eqp_wait: '等待', math_number: '毫秒数', eqp_read_analog: '读取 LIGHT', eqt_sample: '观察读数'};
const decoratedFields = new WeakSet();
const observedFields = new WeakSet();
const keyOf = target => target ? `${target.blockId}|${target.inputName ?? target.connection}` : '';
const connectionOf = (workspace, target) => {
  const block = workspace?.getBlockById(target?.blockId);
  return target?.inputName ? block?.getInput(target.inputName)?.connection : target?.connection === 'next' ? block?.nextConnection : block?.previousConnection;
};
const screenPoint = connection => {
  const matrix = connection?.getSourceBlock().getSvgRoot()?.getScreenCTM();
  if (!matrix) return null;
  const offset = connection.getOffsetInBlock();
  return new DOMPoint(offset.x, offset.y).matrixTransform(matrix);
};
const blockLabel = block => {
  if(block?.type==='logic_boolean')return block.getFieldValue('BOOL')==='TRUE'?'true · 开':'false · 关';
  if(block?.type==='eqp_write'){
    const value=block.getInputTargetBlock('VALUE');
    return `灯的指令 · ${value?.type==='logic_boolean'?(value.getFieldValue('BOOL')==='TRUE'?'开灯':'关灯'):'值未接好'}`;
  }
  if(block?.type==='eqp_wait')return `等待 · ${block.getInputTargetBlock('MS')?.getFieldValue('NUM')??'未填'} 毫秒`;
  return LABELS[block?.type]??'积木';
};
const visibleBlocks = workspace => workspace.getAllBlocks(false).filter(block => !block.isInsertionMarker());

function toolsFor(kind) {
  if (kind === 'sequence') return [{id: 'wait', label: '等待', type: 'eqp_wait'}, {id: 'number', label: '数字 600', type: 'math_number', fields: {NUM: 600}}];
  if (kind === 'reading') return [{id: 'read', label: '读取 LIGHT', type: 'eqp_read_analog', fields: {PORT: 'LIGHT'}}];
  return [{id: 'true', label: 'true · 开', type: 'logic_boolean', fields: {BOOL: 'TRUE'}}, {id: 'false', label: 'false · 关', type: 'logic_boolean', fields: {BOOL: 'FALSE'}}];
}
function toolboxFor(kind) {
  return {kind: 'flyoutToolbox', contents: toolsFor(kind).map(({type, fields}) => ({kind: 'block', type, ...(fields ? {fields} : {})}))};
}
function targetsFor(workspace) {
  const counts = {}, targets = [];
  for (const block of visibleBlocks(workspace)) {
    const count = counts[block.type] = (counts[block.type] ?? 0) + 1;
    const name = `${LABELS[block.type] ?? '积木'}${count > 1 ? ` ${count}` : ''}`;
    for (const input of block.inputList) if (input.type === Blockly.INPUT_VALUE) {
      const child = input.connection.targetBlock();
      targets.push({blockId: block.id, inputName: input.name, label: `${name} · ${input.name === 'MS' ? '等多久' : '值位'}${child ? `（已有${blockLabel(child)}）` : '（空）'}`});
    }
    if (block.nextConnection) targets.push({blockId: block.id, connection: 'next', label: `${name} · 后面${block.nextConnection.targetBlock() ? '（插在下一句前）' : ''}`});
    if (block.previousConnection && !block.previousConnection.isConnected()) targets.push({blockId: block.id, connection: 'previous', label: `${name} · 前面`});
  }
  return targets;
}
function inspect(workspace) {
  for (const block of visibleBlocks(workspace)) {
    for (const input of block.inputList) if (input.type === Blockly.INPUT_VALUE && !input.connection.isConnected()) {
      return {code: 'EMPTY_VALUE', message: block.type === 'eqp_wait' ? '等多久还没填。把数字接到等待的值位。' : block.type === 'eqt_sample' ? '把读取 LIGHT 接到观察读数的值位。' : '这里需要开或关。把 true／false 接到灯的值位。', blockId: block.id, inputName: input.name};
    }
  }
  const loose = visibleBlocks(workspace).find(block => block.outputConnection && !block.getParent());
  return loose ? {code: 'UNCONNECTED', message: '这块尚未接上，仍保留在工作区。', blockId: loose.id} : null;
}
function validateLocal(value) {
  const visit = block => {
    if (!LOCAL_TYPES.has(block.type)) throw new Error('这段练习只显示当前使用的局部积木。原记录已保留。');
    Object.values(block.inputs ?? {}).forEach(input => {if (input.block) visit(input.block); if (input.shadow) visit(input.shadow);});
    if (block.next?.block) visit(block.next.block);
  };
  (value?.blocks?.blocks ?? []).forEach(visit);
}
function keyboardSelect(event, commit) {
  const select = event.currentTarget, last = select.options.length - 1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowDown' ? Math.min(last, select.selectedIndex + 1) : event.key === 'ArrowUp' ? Math.max(0, select.selectedIndex - 1) : null;
  if (next === null) return;
  event.preventDefault(); commit(select.options[next].value);
}
function decorate(workspace, locked, onFieldChanged) {
  for (const block of visibleBlocks(workspace)) {
    if (block.type === 'logic_boolean') {
      const field = block.getField('BOOL');
      if (field && !decoratedFields.has(field)) {
        const previous = field.getValue(); Blockly.Events.disable();
        try {field.setOptions([['true · 开', 'TRUE'], ['false · 关', 'FALSE']]); field.setValue(previous); field.forceRerender();} finally {Blockly.Events.enable();}
        decoratedFields.add(field);
      }
    }
    const watched=block.getField(block.type==='logic_boolean'?'BOOL':block.type==='math_number'?'NUM':'__none');
    if(onFieldChanged&&!workspace.isFlyout&&watched&&!observedFields.has(watched)){
      const prior=watched.getValidator();
      watched.setValidator(function(next){const accepted=prior?.call(this,next);if(accepted===null)return null;queueMicrotask(onFieldChanged);return accepted===undefined?next:accepted;});
      observedFields.add(watched);
    }
    if (!workspace.isFlyout) block.getSvgRoot()?.setAttribute('data-teaching-block-id', block.id);
  }
}

/** A local Blockly fragment. The parent owns preparation, execution and evidence. */
export default function TeachingEditor({kind = 'output', value, onChange, deviceProfile, disabled = false, readOnly = false, independent = false, focusNodeId = null, focusTarget: requestedTarget, onFocusTarget, onInteraction}) {
  const host = useRef(null), workspace = useRef(null), callbacks = useRef({}), props = useRef({});
  callbacks.current = {onChange, onFocusTarget, onInteraction};
  props.current = {kind, disabled, readOnly, independent, focusNodeId, requestedTarget};
  const serialized = useRef(''), dragging = useRef(false), deferred = useRef(null), publish = useRef(null), refreshMarker = useRef(null), fitPresentation = useRef(null);
  const guard = useRef({occupied: new Map(), blocked: null, draggedId: null});
  const pointer = useRef(null), pointerGrab = useRef(null);
  const selectedTarget = useRef(null), explicitTarget = useRef(false), undoing = useRef(false);
  const [targets, setTargets] = useState([]), [existing, setExisting] = useState([]), [targetKey, setTargetKey] = useState('');
  const [message, setMessage] = useState('从左侧拿起积木，拖近连接口，看到吸附预览再松手。');
  const [stepMode, setStepMode] = useState(false), [source, setSource] = useState(''), [preview, setPreview] = useState(null);
  const [marker, setMarker] = useState(null), [canUndo, setCanUndo] = useState(false), [loadError, setLoadError] = useState('');
  const locked = disabled || readOnly;
  const fieldChanged=()=>{if(!props.current.disabled&&!props.current.readOnly)publish.current?.('edit');};

  function chooseTarget(target, explicit = false) {
    selectedTarget.current = target ?? null;
    if (explicit) explicitTarget.current = true;
    setTargetKey(keyOf(target)); callbacks.current.onFocusTarget?.(target ?? null); refreshMarker.current?.();
  }
  function interaction(type, diagnostic = null, extra = {}) {
    callbacks.current.onInteraction?.({type, diagnostic, focusTarget: selectedTarget.current, ...extra});
  }
  function updateLists(w) {
    const list = targetsFor(w); setTargets(list);
    const counts={};
    setExisting(visibleBlocks(w).filter(block => block.type !== 'eqt_sample').map(block => {
      const number=counts[block.type]=(counts[block.type]??0)+1;
      return {id:block.id,label:`${blockLabel(block)} · 第${number}块`};
    }));
    setCanUndo(w.getUndoStack().length > 0);
    const current = list.find(target => keyOf(target) === keyOf(selectedTarget.current));
    const missing = inspect(w);
    chooseTarget(missing?.inputName ? list.find(target => target.blockId === missing.blockId && target.inputName === missing.inputName) : current ?? (props.current.kind === 'sequence' ? list.find(target => target.connection === 'next') : list[0]));
    return missing;
  }

  useEffect(() => {
    Blockly.setLocale(Zh);
    if (!Blockly.Blocks.eqp_program) registerProgramBlocks(Blockly, deviceProfile);
    if (!Blockly.Blocks.eqt_sample) Blockly.defineBlocksWithJsonArray([{type: 'eqt_sample', message0: '观察读数 %1', args0: [{type: 'input_value', name: 'VALUE', check: 'Number'}], colour: 210}]);
    class TeachingChecker extends Blockly.ConnectionChecker {
      doDragChecks(a, b, distance) {
        const superior = a.type === Blockly.INPUT_VALUE ? a : b.type === Blockly.INPUT_VALUE ? b : null;
        if (superior && dragging.current) {
          const parent = superior.getSourceBlock(), input = parent.inputList.find(item => item.connection === superior);
          const other = superior === a ? b : a;
          if (input && other.type === Blockly.OUTPUT_VALUE) {
            const target = {blockId: parent.id, inputName: input.name};
            const prior = guard.current.occupied.get(keyOf(target));
            if (!this.doTypeChecks(a, b)) {
              guard.current.blocked = {code: 'WRONG_VALUE', message: parent.type === 'eqp_write' ? '这里需要开或关。请对准灯的值位。' : '这处需要数字。请对准数字的值位。', ...target};
              return false;
            }
            if (prior && prior !== guard.current.draggedId) {
              guard.current.blocked = {code: 'REPLACE_PREVIEW', message: '这个值位已有积木。先预览，再确认替换；原值仍保留。', ...target};
              return false;
            }
          }
        }
        return super.doDragChecks(a, b, distance);
      }
    }
    const theme = Blockly.Theme.defineTheme('eqTeachingLocal', {base: Blockly.Themes.Classic, fontStyle: {family: 'system-ui, sans-serif', size: 16}, componentStyles: {workspaceBackgroundColour: '#102737', flyoutBackgroundColour: '#1a3547', flyoutForegroundColour: '#edf7ff', flyoutOpacity: 1, scrollbarColour: '#80a3b8', scrollbarOpacity: .65, insertionMarkerColour: '#ffe078', insertionMarkerOpacity: .8}});
    const w = Blockly.inject(host.current, {theme, toolbox: toolboxFor(props.current.kind), plugins: {connectionChecker: TeachingChecker}, trashcan: false, scrollbars: true, move: {drag: true, wheel: true}, zoom: {controls: false, wheel: false, startScale: .92}, renderer: 'geras', sounds: false});
    workspace.current = w;
    const paint = () => {
      const target = selectedTarget.current, connection = connectionOf(w, target);
      host.current.querySelectorAll('[data-teaching-block-id]').forEach(element => element.removeAttribute('data-teaching-block-id'));
      for (const block of visibleBlocks(w)) {
        const svg = block.getSvgRoot();
        svg?.setAttribute('data-teaching-block-id', block.id);
        svg?.toggleAttribute('data-teaching-executing', block.id === props.current.focusNodeId);
        svg?.removeAttribute('data-teaching-focus');
      }
      if (props.current.requestedTarget===null || !connection || (props.current.independent && !explicitTarget.current)) {setMarker(null); return;}
      const block = connection.getSourceBlock(), svg = block.getSvgRoot(), matrix = svg?.getScreenCTM();
      if (!matrix) return;
      svg.setAttribute('data-teaching-focus', target.inputName ?? target.connection);
      const offset = connection.getOffsetInBlock(), point = new DOMPoint(offset.x, offset.y).matrixTransform(matrix), rect = host.current.getBoundingClientRect();
      setMarker({x: point.x - rect.left, y: point.y - rect.top, value: !!target.inputName});
    };
    refreshMarker.current = paint;
    const fit = (force = false) => {
      const scale = Math.min(.92, Math.max(.6, (host.current.clientWidth - 24) / (props.current.kind === 'reading' ? 625 : 540)));
      const changed = Math.abs(w.scale - scale) > .005;
      if (changed) w.setScale(scale);
      const roots = w.getTopBlocks(false), core = roots.find(block => ['eqp_write', 'eqt_sample'].includes(block.type)) ?? roots[0];
      const box = core?.getSvgRoot().getBoundingClientRect(), rect = host.current.getBoundingClientRect();
      const overflow = box && (box.right > rect.right - 6 || box.left < rect.left + w.getFlyout().getWidth() + 6 || box.bottom > rect.bottom - 6 || box.top < rect.top + 6);
      if (box && (force === true || changed || (force === 'overflow' && overflow))) w.scroll(w.scrollX + rect.left + w.getFlyout().getWidth() + 16 - box.left, w.scrollY + rect.top + 24 - box.top);
    };
    fitPresentation.current = fit;
    const load = desired => {
      const before = Blockly.serialization.workspaces.save(w);
      try {
        validateLocal(desired); Blockly.Events.disable();
        try {Blockly.serialization.workspaces.load(desired ?? EMPTY, w);} finally {Blockly.Events.enable();}
        serialized.current = JSON.stringify(Blockly.serialization.workspaces.save(w));
        decorate(w, props.current.disabled || props.current.readOnly, fieldChanged); updateLists(w); setPreview(null); setLoadError('');
        w.clearUndo(); setCanUndo(false);
        fit(true);
        paint();
      } catch (error) {
        Blockly.Events.disable(); try {Blockly.serialization.workspaces.load(before, w);} finally {Blockly.Events.enable();}
        decorate(w, props.current.disabled || props.current.readOnly, fieldChanged); updateLists(w); paint();
        setLoadError(error.message); interaction('load-error', {code: 'LOCAL_LOAD', message: error.message});
      }
    };
    deferred.current = {load};
    publish.current = (origin = 'edit') => {
      decorate(w, props.current.disabled || props.current.readOnly, fieldChanged);
      const next = Blockly.serialization.workspaces.save(w), encoded = JSON.stringify(next), diagnostic = updateLists(w);
      paint();
      void Blockly.renderManagement.finishQueuedRenders().then(() => {if (workspace.current === w && !dragging.current) {fit('overflow'); paint();}});
      if (encoded === serialized.current) return;
      serialized.current = encoded;
      callbacks.current.onChange?.(next, {origin, diagnostic, focusTarget: selectedTarget.current});
    };
    load(value ?? EMPTY);
    const listener = event => {
      if (event.type === Blockly.Events.BLOCK_DRAG) {
        if (event.isStart) {
          dragging.current = true; setPreview(null); guard.current = {occupied: new Map(), blocked: null, draggedId: event.blockId};
          for (const block of visibleBlocks(w)) for (const input of block.inputList) if (input.type === Blockly.INPUT_VALUE && input.connection.targetBlock()) guard.current.occupied.set(`${block.id}|${input.name}`, input.connection.targetBlock().id);
          guard.current.pointerOffset = pointerGrab.current;
          interaction('drag-start', null, {blockId: event.blockId});
        } else {
          dragging.current = false;
          const block = w.getBlockById(event.blockId), offset = guard.current.pointerOffset;
          const dropPoint = pointer.current && offset ? {x: pointer.current.x - offset.x, y: pointer.current.y - offset.y} : screenPoint(block?.outputConnection);
          const nearest = block?.outputConnection && dropPoint ? targetsFor(w).filter(target => target.inputName && target.blockId !== block.id).map(target => {const connection = connectionOf(w, target), point = screenPoint(connection); return {target, connection, distance: point ? Math.hypot(dropPoint.x - point.x, dropPoint.y - point.y) / w.scale : Infinity};}).sort((a, b) => a.distance - b.distance)[0] : null;
          let blocked = null;
          if (nearest?.distance < 40 && !block.getParent()) {
            const prior = guard.current.occupied.get(keyOf(nearest.target));
            if (!w.connectionChecker.doTypeChecks(block.outputConnection, nearest.connection)) blocked = {code: 'WRONG_VALUE', message: nearest.connection.getCheck()?.includes('Boolean') ? '这里需要开或关。请对准灯的值位。' : '这处需要数字。请对准数字的值位。', ...nearest.target};
            else if (prior && prior !== block.id) blocked = {code: 'REPLACE_PREVIEW', message: '这个值位已有积木。先预览，再确认替换；原值仍保留。', ...nearest.target};
          }
          publish.current?.();
          if (block && !block.getParent() && blocked) {
            chooseTarget(targetsFor(w).find(target => keyOf(target) === keyOf(blocked)));
            setMessage(blocked.message);
            if (blocked.code === 'REPLACE_PREVIEW') setPreview({source: `block:${block.id}`, target: {blockId: blocked.blockId, inputName: blocked.inputName}, replace: true});
            interaction('drop-unconnected', blocked, {blockId: block.id});
          } else if (block?.getParent() || block?.nextConnection?.isConnected()) {setMessage('已经接上。先核对指令的先后位置，再用下方主按钮执行。'); interaction('drop-connected', null, {blockId: block.id});}
          else {const diagnostic = {code: 'UNCONNECTED', message: '尚未接上，积木留在原处。请对准黄色连接口，或用点选放入。', blockId: block?.id}; setMessage(diagnostic.message); interaction('drop-unconnected', diagnostic, {blockId: block?.id});}
          if (deferred.current?.value) {const desired = deferred.current.value; delete deferred.current.value; load(desired);}
        }
      }
      if (event.type === Blockly.Events.SELECTED && event.newElementId) interaction('select', null, {blockId: event.newElementId});
      if (!event.isUiEvent && event.type !== Blockly.Events.FINISHED_LOADING) publish.current?.(undoing.current ? 'undo' : 'edit');
      paint();
    };
    w.addChangeListener(listener);
    const observer = new ResizeObserver(() => {Blockly.svgResize(w); fit(); paint();}); observer.observe(host.current);
    return () => {observer.disconnect(); w.removeChangeListener(listener); w.dispose(); workspace.current = null; publish.current = null; refreshMarker.current = null; fitPresentation.current = null; deferred.current = null;};
  }, []);

  useEffect(() => {
    const w = workspace.current; if (!w) return;
    w.updateToolbox(toolboxFor(kind)); decorate(w.getFlyout().getWorkspace(), locked);
    void Blockly.renderManagement.finishQueuedRenders().then(() => {if (workspace.current === w) {w.getFlyout().reflow(); fitPresentation.current?.(true); refreshMarker.current?.();}});
    explicitTarget.current = false; updateLists(w); setSource(''); setPreview(null);
    setMessage(kind==='sequence'?'把等待接在两句之间，再接上毫秒数。抓住实心边缘拖动，看到吸附预览再松手。':'从左侧拿起积木，拖近连接口，看到吸附预览再松手。');
  }, [kind]);
  useEffect(() => {
    const w = workspace.current; if (!w) return;
    decorate(w, locked, fieldChanged); w.options.readOnly = locked; w.getFlyout()?.setVisible(!locked); if (locked) Blockly.hideChaff(); refreshMarker.current?.();
  }, [locked]);
  useEffect(() => {
    if (!workspace.current || JSON.stringify(value ?? EMPTY) === serialized.current) return;
    if (dragging.current) deferred.current.value = value ?? EMPTY;
    else deferred.current?.load(value ?? EMPTY);
  }, [value]);
  useEffect(() => {refreshMarker.current?.();}, [focusNodeId]);
  useEffect(() => {explicitTarget.current = false; refreshMarker.current?.();}, [independent]);
  useEffect(() => {
    if (requestedTarget === undefined) return;
    if (keyOf(requestedTarget)!==keyOf(selectedTarget.current)&&(requestedTarget===null||connectionOf(workspace.current,requestedTarget))) chooseTarget(requestedTarget,!!requestedTarget);
    else refreshMarker.current?.();
  }, [requestedTarget?.blockId, requestedTarget?.inputName, requestedTarget?.connection, requestedTarget === null]);

  function previewPlacement() {
    const w = workspace.current, target = targets.find(item => keyOf(item) === targetKey), connection = connectionOf(w, target);
    if (!source || !connection) return;
    const isBlock = source.startsWith('block:'), block = isBlock ? w.getBlockById(source.slice(6)) : null, tool = toolsFor(kind).find(item => `tool:${item.id}` === source);
    const valueSource = block ? !!block.outputConnection : !['eqp_wait'].includes(tool?.type);
    const expectedValue = !!target.inputName;
    const checks = connection.getCheck();
    const sourceType = block?.type ?? tool?.type;
    const valueType = sourceType === 'logic_boolean' ? 'Boolean' : 'Number';
    // Moving one statement heals its old next-chain before insertion. A target
    // later in that chain is legal; only the moving block's own inputs can cycle.
    const inOwnInput=block?.getChildren(false).filter(child=>child!==block.getNextBlock()).some(child=>child.getDescendants(false).some(item=>item.id===target.blockId));
    if (block?.id === target.blockId || inOwnInput) {
      const diagnostic={code:'SELF_CONNECTION',message:'不能把积木接到自己里面。选另一句的连接口，或先撤销刚才的移动。',blockId:target.blockId,...(target.inputName?{inputName:target.inputName}:{connection:target.connection})};
      setMessage(diagnostic.message);chooseTarget(target,true);interaction('invalid-target',diagnostic);return;
    }
    if (valueSource !== expectedValue || (expectedValue && checks && !checks.includes(valueType))) {
      const diagnostic = {code: 'WRONG_CONNECTION', message: expectedValue ? `这里需要${checks?.includes('Boolean') ? '开或关值' : '数字值'}，请选择对应积木。` : '这里接下一句动作；提供数值的积木要接到值位。', blockId: target.blockId, ...(target.inputName ? {inputName: target.inputName} : {connection: target.connection})};
      setMessage(diagnostic.message); chooseTarget(target, true); interaction('invalid-target', diagnostic); return;
    }
    setPreview({source, target, replace: expectedValue && !!connection.targetBlock()}); setMessage('先核对下面的连接预览。确认后才会改变工作区。');
  }
  function confirmPlacement() {
    const w = workspace.current; if (!preview || locked) return;
    const connection = connectionOf(w, preview.target); if (!connection) return;
    Blockly.Events.setGroup(true);
    try {
      let block;
      if (preview.source.startsWith('block:')) {block = w.getBlockById(preview.source.slice(6)); if (!block) return; block.unplug(true);}
      else {const tool = toolsFor(kind).find(item => `tool:${item.id}` === preview.source); if (!tool) return; block = w.newBlock(tool.type); Object.entries(tool.fields ?? {}).forEach(([name, field]) => block.setFieldValue(String(field), name)); block.initSvg(); block.render();}
      if (preview.target.inputName) {
        const old = connection.targetBlock(); if (old) {old.unplug(); old.moveBy(28, 78);}
        connection.connect(block.outputConnection);
      } else if (preview.target.connection === 'next') connection.connect(block.previousConnection);
      else block.nextConnection.connect(connection);
      decorate(w, false, fieldChanged); setPreview(null); setSource(''); publish.current?.();
      setMessage('已按预览放入。可以撤销这一步。'); interaction('placement-confirmed', null, {blockId: block.id});
    } finally {Blockly.Events.setGroup(false);}
  }
  function undo() {
    if (locked || !workspace.current?.getUndoStack().length) return;
    undoing.current = true; workspace.current.undo(false); publish.current?.('undo'); undoing.current = false;
    setPreview(null); setMessage('已撤销一步，积木与连接已恢复。'); interaction('undo');
  }
  function pointerDown(event) {
    pointer.current = {x: event.clientX, y: event.clientY}; pointerGrab.current = null;
    const w = workspace.current; if (!w) return;
    const block = [...visibleBlocks(w), ...visibleBlocks(w.getFlyout().getWorkspace())].reverse().find(item => item.getSvgRoot()?.contains(event.target));
    const point = screenPoint(block?.outputConnection);
    if (point) pointerGrab.current = {x: event.clientX - point.x, y: event.clientY - point.y};
  }
  function selectSource(next) {setSource(next); setPreview(null); interaction('select-source', null, {source: next});}
  function selectDestination(next) {chooseTarget(targets.find(target => keyOf(target) === next), true); setPreview(null); interaction('select-target');}
  const spare=source.startsWith('block:')?workspace.current?.getBlockById(source.slice(6)):null;
  const canRemoveSpare=!!spare?.outputConnection&&!spare.getParent();
  function removeSpare(){
    if(locked||!canRemoveSpare)return;
    Blockly.Events.setGroup(true);
    try{const id=spare.id;spare.dispose(false,true);setSource('');setPreview(null);publish.current?.('edit');setMessage('已移走这块未连接值。需要时可以撤销，或从托盘重新取。');interaction('spare-removed',null,{blockId:id});}
    finally{Blockly.Events.setGroup(false);}
  }
  const previewName = preview?.source.startsWith('block:') ? blockLabel(workspace.current?.getBlockById(preview.source.slice(6))) : toolsFor(kind).find(tool => `tool:${tool.id}` === preview?.source)?.label;
  const previewTarget = targets.find(target => keyOf(target) === keyOf(preview?.target));
  return <section className={`eqt-editor${locked ? ' eqt-editor-locked' : ''}`} aria-label="局部积木工作区" data-teaching-kind={kind} onPointerDownCapture={pointerDown} onPointerMoveCapture={event => {pointer.current = {x: event.clientX, y: event.clientY};}} onPointerUpCapture={event => {pointer.current = {x: event.clientX, y: event.clientY};}} onKeyDownCapture={event => {if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {event.preventDefault(); event.stopPropagation(); undo();}}}>
    {!readOnly && <div className="eqt-editor-actions"><button type="button" disabled={locked || !canUndo} onClick={undo}>撤销一步</button><button type="button" aria-expanded={stepMode} disabled={locked} onClick={() => {setStepMode(!stepMode); if (!stepMode) explicitTarget.current = true; refreshMarker.current?.();}}>点选放入</button><span>拖积木边缘 · 点击字段改值</span></div>}
    {loadError && <p className="eqt-editor-error" role="alert">{loadError}</p>}
    <div className="eqt-editor-canvas-wrap"><div className="eqt-editor-canvas" ref={host} aria-label="可拖放的 Blockly 工作区" />{marker && <span className={`eqt-target-marker${marker.value ? ' eqt-target-value' : ''}`} aria-hidden="true" data-teaching-target={targetKey} style={{left: marker.x, top: marker.y}} />}</div>
    {!readOnly && <div className="eqt-editor-feedback"><output aria-live="polite" data-teaching-feedback>{message}</output>{stepMode && !preview && <div className="eqt-step-controls"><label>1 选积木<select aria-label="选积木" disabled={locked} value={source} onChange={event => selectSource(event.target.value)} onKeyDown={event => keyboardSelect(event, selectSource)}><option value="">请选择</option><optgroup label="从托盘拿一块">{toolsFor(kind).map(tool => <option key={tool.id} value={`tool:${tool.id}`}>{tool.label}</option>)}</optgroup><optgroup label="移动工作区已有积木">{existing.map(block => <option key={block.id} value={`block:${block.id}`}>{block.label}</option>)}</optgroup></select></label><label>2 选目标<select aria-label="选目标" disabled={locked} value={targetKey} onChange={event => selectDestination(event.target.value)} onKeyDown={event => keyboardSelect(event, selectDestination)}><option value="">请选择</option>{targets.map(target => <option key={keyOf(target)} value={keyOf(target)}>{target.label}</option>)}</select></label><button type="button" disabled={locked || !source || !targetKey} onClick={previewPlacement}>3 预览放入</button>{canRemoveSpare&&<button type="button" disabled={locked} onClick={removeSpare}>移走未连接值</button>}</div>}{preview && <div className="eqt-placement-preview" role="status"><span>{previewName} → {previewTarget?.label ?? '所选连接口'}{preview.replace ? '。将替换原值，原块留在工作区。' : '。原来的下一句会保留。'}</span><button type="button" disabled={locked} onClick={confirmPlacement}>{preview.replace ? '确认替换' : '确认放入'}</button><button type="button" onClick={() => {setPreview(null); setMessage('已取消，原来的连接保持不变。');}}>取消</button></div>}</div>}
  </section>;
}
