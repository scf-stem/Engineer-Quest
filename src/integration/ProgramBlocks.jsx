import React,{useEffect,useRef,useState} from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Zh from 'blockly/msg/zh-hans';
import {registerProgramBlocks,workspaceToProgram} from '../program/index.js';
import {createExampleBlocks} from '../program/examples.js';
import {canonicalJson} from '../contracts/index.js';
import {ActionButton,Notice} from '../ui/index.js';
import {blockName,guardedChecker,listConnectionTargets,targetConnection,targetBoundary,placementDecision,placeBlock,nativeDropFeedback} from './block-connections.js';
import './block-workspace.css';

const EMPTY={blocks:{languageVersion:0,blocks:[]}};
const category=(name,colour,types)=>({kind:'category',name,colour,contents:types.map(type=>({kind:'block',type,...(type==='controls_if'?{extraState:{hasElse:true}}:{})}))});
function toolboxFor({guided,activityId,all}){
  const reading=guided&&!all&&['observe-output','read-input'].includes(activityId);
  return {kind:'categoryToolbox',contents:[category('变量与流程',180,['eqp_program','eqp_declare','eqp_get','eqp_set',...(!reading?['controls_if','eqp_while']:[]),'eqp_wait']),category('输入与判断',210,['eqp_read_analog','math_number',...(!reading?['logic_boolean','logic_compare','logic_operation','logic_negate','math_arithmetic']:[])]),...(!reading?[category('输出',30,['eqp_write'])]:[]),category('等待',180,['eqp_wait'])]};
}
const liveBlocks=w=>w.getAllBlocks(false).filter(block=>!block.isInsertionMarker()&&!block.isShadow());
function keyboardSelect(event,commit){
  const select=event.currentTarget,last=select.options.length-1;
  const next=event.key==='Home'?0:event.key==='End'?last:event.key==='ArrowDown'?Math.min(last,select.selectedIndex+1):event.key==='ArrowUp'?Math.max(0,select.selectedIndex-1):null;
  if(next!==null){event.preventDefault();commit(select.options[next].value);}
}

export default function ProgramBlocks({initial,workspaceState,deviceProfile,onChange,readOnly=false,allowFullExample=true,guided=false,activityId}){
  const [loadError,setLoadError]=useState(''),[snapHint,setSnapHint]=useState('抓住文字旁实心边缘，避开齿轮和字段；对准黄色口，看到插入预览再松手。也可点选移动 / 插入。');
  const [slots,setSlots]=useState([]),[target,setTarget]=useState(''),[replacement,setReplacement]=useState(false),[all,setAll]=useState(false);
  const [stepMode,setStepMode]=useState(false),[source,setSource]=useState(''),[moveMode,setMoveMode]=useState('single'),[preview,setPreview]=useState(null),[existing,setExisting]=useState([]),[canUndo,setCanUndo]=useState(false);
  const [nativeHelp,setNativeHelp]=useState(null);
  const host=useRef(null),workspace=useRef(null),serialized=useRef(null),refresh=useRef(null),load=useRef(null),reveal=useRef(null),framePending=useRef(false),cameraVersion=useRef(0),callback=useRef(onChange),options=useRef({}),slotList=useRef([]),tools=useRef([]),pendingExternal=useRef(null);
  callback.current=onChange;options.current={readOnly,guided,activityId,all};
  const guard=useRef({target:null,targetKind:null,boundary:null,replaceTarget:null,occupied:new Map(),blocked:'',dragging:false}),highlight=useRef(null),targetMarker=useRef(null);
  const toolbox=toolboxFor({guided,activityId,all});
  tools.current=[...new Map(toolbox.contents.flatMap(group=>group.contents).map(block=>[block.type,block])).values()];

  function clearTarget(){
    targetMarker.current?.removeAttribute('data-eq-exact-target');targetMarker.current=null;
    highlight.current?.unhighlight();highlight.current=null;
    guard.current.target=null;guard.current.targetKind=null;guard.current.boundary=null;guard.current.replaceTarget=null;
    setTarget('');setReplacement(false);
  }
  function markTarget(item){
    const connection=targetConnection(workspace.current,item);if(!connection)return;
    highlight.current?.unhighlight();highlight.current=connection;connection.highlight();
    targetMarker.current?.removeAttribute('data-eq-exact-target');targetMarker.current=document.getElementById(connection.id);
    targetMarker.current?.setAttribute('data-eq-exact-target','true');
  }
  function selectTarget(id){
    clearTarget();setPreview(null);setNativeHelp(null);guard.current.lastDropId=null;if(!id)return;
    const item=slotList.current.find(slot=>slot.id===id);if(!item||!targetConnection(workspace.current,item))return;
    guard.current.target=id;guard.current.targetKind=item.kind;guard.current.boundary=targetBoundary(workspace.current,item);
    setTarget(id);markTarget(item);reveal.current?.({centerTarget:true});
    setSnapHint(`目标：${item.label}。${item.kind==='value'?'原值受到保护。':'插入会保留目标原来的后续。'}可拖到黄色口，或选择积木后预览。`);
  }
  useEffect(()=>{
    Blockly.setLocale(Zh);if(!Blockly.Blocks.eqp_program)registerProgramBlocks(Blockly,deviceProfile);
    const theme=Blockly.Theme.defineTheme('eqWorkbenchDark',{base:Blockly.Themes.Classic,componentStyles:{workspaceBackgroundColour:'#0c1826',toolboxBackgroundColour:'#15293b',toolboxForegroundColour:'#cfdeec',flyoutBackgroundColour:'#203c50',flyoutForegroundColour:'#d2e5f0',flyoutOpacity:1,scrollbarColour:'#6a8ba3',scrollbarOpacity:.8,insertionMarkerColour:'#9ff5ee',insertionMarkerOpacity:.82,cursorColour:'#a2ebf5'}});
    const w=Blockly.inject(host.current,{theme,trashcan:true,scrollbars:true,plugins:{connectionChecker:guardedChecker(Blockly,guard.current)},toolbox:toolboxFor(options.current),sounds:false});workspace.current=w;
    const availableView=()=>{
      const rect=host.current.getBoundingClientRect();
      if(!rect.width||!rect.height)return null;
      const tools=options.current.readOnly?0:(w.getToolbox()?.getWidth()??0)+(w.getFlyout()?.isVisible()?w.getFlyout().getWidth():0);
      const area={left:rect.left+tools+16,right:rect.right-22,top:rect.top+16,bottom:rect.bottom-22};
      area.width=area.right-area.left;area.height=area.bottom-area.top;
      return area.width>32&&area.height>32?area:null;
    };
    const panInto=(box,area)=>({
      x:box.left<area.left?area.left-box.left:box.right>area.right?area.right-box.right:0,
      y:box.top<area.top?area.top-box.top:box.bottom>area.bottom?area.bottom-box.bottom:0,
    });
    reveal.current=(request={})=>{const version=++cameraVersion.current;void (async()=>{
      await Blockly.renderManagement.finishQueuedRenders();
      const ready=()=>workspace.current===w&&version===cameraVersion.current&&!guard.current.dragging&&!w.isDragging()&&availableView();
      let area=ready();if(!area)return;
      Blockly.svgResize(w);area=availableView();if(!area)return;
      const selected=slotList.current.find(slot=>slot.id===guard.current.target),connection=selected&&targetConnection(w,selected);
      // Exact ports take priority over the root: a wide/deep program may need
      // its beginning outside the viewport to expose the selected mouth.
      if(connection){
        framePending.current=false;
        const matrix=connection.getSourceBlock().getSvgRoot()?.getScreenCTM();if(!matrix)return;
        const offset=connection.getOffsetInBlock(),point=new DOMPoint(offset.x,offset.y).matrixTransform(matrix);
        const safe={left:area.left+12,right:area.right-12,top:area.top+12,bottom:area.bottom-12};
        const delta=request.centerTarget?{x:(area.left+area.right)/2-point.x,y:(area.top+area.bottom)/2-point.y}:panInto({left:point.x,right:point.x,top:point.y,bottom:point.y},safe);
        if(Math.abs(delta.x)>.5||Math.abs(delta.y)>.5)w.scroll(w.scrollX+delta.x,w.scrollY+delta.y);
        return;
      }
      const root=w.getTopBlocks(false).find(block=>block.type==='eqp_program');
      if(!root){framePending.current=false;return;}
      if(framePending.current){
        const dimensions=root.getBoundingRectangle(),width=dimensions.right-dimensions.left,height=dimensions.bottom-dimensions.top;
        const scale=Math.max(.75,Math.min(1,area.width/Math.max(1,width),area.height/Math.max(1,height)));
        if(Math.abs(w.scale-scale)>.001){w.setScale(scale);await Blockly.renderManagement.finishQueuedRenders();}
        area=ready();if(!area)return;
        const box=root.getSvgRoot().getBoundingClientRect();
        const left=area.left+Math.max(0,(area.width-box.width)/2),top=area.top+Math.max(0,(area.height-box.height)/2);
        w.scroll(w.scrollX+left-box.left,w.scrollY+top-box.top);framePending.current=false;
      }else{
        // Opening a tray may obscure a small program. Pan only dimensions that
        // fit; never anchor an oversized root at the expense of a deep view.
        const box=root.getSvgRoot().getBoundingClientRect(),delta=panInto(box,area);
        if(box.width>area.width)delta.x=0;if(box.height>area.height)delta.y=0;
        if(Math.abs(delta.x)>.5||Math.abs(delta.y)>.5)w.scroll(w.scrollX+delta.x,w.scrollY+delta.y);
      }
    })();};
    const update=(origin='edit',force=false,extra={})=>{
      // Model events can arrive before BLOCK_DRAG(start). Neither temporary
      // disconnections nor flyout creations are a committed student draft.
      if(origin==='edit'&&(guard.current.dragging||w.isDragging()))return;
      const state=Blockly.serialization.workspaces.save(w),encoded=canonicalJson(state),nextSlots=listConnectionTargets(w,Blockly);
      slotList.current=nextSlots;setSlots(nextSlots);setCanUndo(w.getUndoStack().length>0);guard.current.publishedUndoTop=w.getUndoStack().at(-1);
      setExisting(liveBlocks(w).map(block=>({id:block.id,label:`${blockName(block)} · ${block.toString(48)}`})));
      const selected=nextSlots.find(slot=>slot.id===guard.current.target);
      if(guard.current.target&&!selected)clearTarget();
      else if(selected&&!guard.current.dragging){guard.current.boundary=targetBoundary(w,selected);markTarget(selected);}
      if(!force&&encoded===serialized.current)return;
      if(origin==='edit'&&guard.current.lastDropId){setNativeHelp(null);setSnapHint(`当前实际图：${nativeDropFeedback(w.getBlockById(guard.current.lastDropId)).message}`);}
      serialized.current=encoded;
      const result=workspaceToProgram(w,Blockly);
      callback.current?.({origin,program:result.ok?result.value:null,workspace:state,error:result.ok?'':result.diagnostics.map(d=>`${d.code}：${d.message}`).join('；'),...extra});
    };
    refresh.current=update;
    const restore=(desired,origin='external')=>{
      const previous=Blockly.serialization.workspaces.save(w);
      Blockly.Events.disable();
      try{
        Blockly.serialization.workspaces.load(desired??EMPTY,w);clearTarget();setPreview(null);setNativeHelp(null);guard.current.lastDropId=null;setSource('');setLoadError('');
        w.clearUndo();update(origin,true);
      }catch(error){
        Blockly.serialization.workspaces.load(previous,w);update('external',true);
        setLoadError('积木草稿无法载入，原作品保留。'+error.message);
      }finally{Blockly.Events.enable();}
      framePending.current=true;reveal.current?.();
    };
    load.current=restore;restore(initial??workspaceState??EMPTY,'initialize');
    const listener=event=>{
      if(event.type===Blockly.Events.SELECTED&&event.newElementId&&w.getBlockById(event.newElementId)){setSource(`block:${event.newElementId}`);setPreview(null);}
      if(event.type===Blockly.Events.TOOLBOX_ITEM_SELECT)reveal.current?.();
      if(event.type===Blockly.Events.BLOCK_DRAG){
        if(event.isStart){
          // Use the last committed boundary: native unplug events can queue
          // before this UI event, and must not make an older undo look new.
          guard.current.dragStartState=serialized.current;guard.current.dragUndoTop=guard.current.publishedUndoTop;
          setPreview(null);setNativeHelp(null);guard.current.blocked='';guard.current.dragging=true;guard.current.draggedId=event.blockId;guard.current.occupied=new Map();
          const selected=slotList.current.find(slot=>slot.id===guard.current.target);if(selected)guard.current.boundary=targetBoundary(w,selected);
          const moving=w.getBlockById(event.blockId);
          guard.current.carriedIds=new Set([...(event.blocks??[]),...(moving?.getDescendants(false)??[])].filter(block=>!block.isInsertionMarker()).map(block=>block.id));
          const ownTarget=selected&&guard.current.carriedIds.has(selected.blockId);
          for(const block of liveBlocks(w))for(const input of block.inputList)if(input.type===Blockly.INPUT_VALUE&&input.connection.targetBlock()&&!input.connection.targetBlock().isInsertionMarker())guard.current.occupied.set(`${block.id}|${input.name}`,input.connection.targetBlock());
          setSnapHint(ownTarget?'直接拖动会带后续整串；目标在自己的整串内，无法吸附。结束拖动后可改用单句点选。':selected?`对准黄色目标：${selected.label}。浅色积木是插入预览。`:'拖动实心边缘，对准连接口；看到浅色积木预览后松手。点选移动默认只移动一句、保留原后续。');
        }else{
          const block=w.getBlockById(event.blockId),selected=slotList.current.find(slot=>slot.id===guard.current.target);
          const finalState=canonicalJson(Blockly.serialization.workspaces.save(w)),undoTop=w.getUndoStack().at(-1),oldUndoTop=guard.current.dragUndoTop;
          const undoable=finalState!==guard.current.dragStartState&&!!undoTop&&undoTop!==oldUndoTop&&(!undoTop.group||undoTop.group!==oldUndoTop?.group);
          const report=nativeDropFeedback(block,{target:selected,carriedIds:guard.current.carriedIds,blocked:guard.current.blocked,undoable});
          guard.current.dragging=false;guard.current.draggedId=null;guard.current.replaceTarget=null;setReplacement(false);
          if(report.inProgram&&(!selected||report.matched))clearTarget();
          update();reveal.current?.();
          guard.current.lastDropId=event.blockId;setSnapHint(report.message);
          if(report.conflict&&!report.inProgram&&block)setNativeHelp({blockId:block.id,targetId:selected.id,state:finalState,undoable,undoTop});
          requestAnimationFrame(()=>{const desired=pendingExternal.current;if(desired&&canonicalJson(desired)!==serialized.current){pendingExternal.current=null;restore(desired);}});
        }
      }
      if(!options.current.readOnly&&!event.isUiEvent&&event.type!==Blockly.Events.FINISHED_LOADING)update();
    };
    w.addChangeListener(listener);const observer=new ResizeObserver(()=>reveal.current?.());observer.observe(host.current);
    return()=>{observer.disconnect();w.removeChangeListener(listener);highlight.current?.unhighlight();highlight.current=null;w.dispose();workspace.current=null;refresh.current=null;load.current=null;reveal.current=null;};
  },[]);
  useEffect(()=>{const w=workspace.current;if(w)w.updateToolbox(toolboxFor({guided,activityId,all}));},[guided,activityId,all]);
  useEffect(()=>{const w=workspace.current;if(w){w.options.readOnly=readOnly;w.getToolbox()?.setVisible(!readOnly);w.getFlyout()?.setVisible(false);if(readOnly)Blockly.hideChaff();}},[readOnly]);
  useEffect(()=>{
    if(!workspace.current||workspaceState===undefined)return;
    const desired=workspaceState??EMPTY;
    if(canonicalJson(desired)===serialized.current){pendingExternal.current=null;return;}
    if(guard.current.dragging||workspace.current.isDragging())pendingExternal.current=desired;else load.current?.(desired);
  },[workspaceState]);

  function findSource(id){return id.startsWith('block:')?workspace.current.getBlockById(id.slice(6)):null;}
  function createTool(w,type){
    const tool=tools.current.find(item=>item.type===type);if(!tool)throw new Error('这块不在当前托盘中，请重新选择。');
    const block=w.newBlock(type);if(tool.extraState)block.loadExtraState(tool.extraState);return block;
  }
  function previewPlacement(){
    const w=workspace.current,selected=target==='@free'?{id:'@free',kind:'free',label:'工作区空白处（暂不连接）'}:slotList.current.find(slot=>slot.id===target);
    if(!source||!selected)return;
    let moving=findSource(source),probe;
    try{
      if(!moving){Blockly.Events.disable();try{probe=new Blockly.Workspace();moving=createTool(probe,source.slice(5));}finally{Blockly.Events.enable();}}
      const decision=placementDecision(w,moving,selected,{mode:moveMode});
      if(!decision.allowed){setSnapHint(decision.message);return;}
      setPreview({source,target:selected,mode:moveMode,before:canonicalJson(Blockly.serialization.workspaces.save(w)),label:moving.toString(60),...decision});
      setSnapHint('核对连接预览，确认后才会改变作品。');
    }catch(error){setSnapHint(error.message);}
    finally{if(probe){Blockly.Events.disable();try{probe.dispose();}finally{Blockly.Events.enable();}}}
  }
  function confirmPlacement(){
    const w=workspace.current;if(!preview||readOnly)return;
    if(canonicalJson(Blockly.serialization.workspaces.save(w))!==preview.before){setPreview(null);setSnapHint('作品已改变，请重新选择并预览。');return;}
    const previousGroup=Blockly.Events.getGroup();Blockly.Events.setGroup(true);let created;
    try{
      let block=findSource(preview.source);
      if(!block){created=createTool(w,preview.source.slice(5));block=created;block.initSvg();block.render();}
      const metrics=w.getMetrics(),position={x:(metrics.viewLeft+Math.max(32,metrics.viewWidth*.55))/w.scale,y:(metrics.viewTop+70)/w.scale};
      placeBlock(w,Blockly,block,preview.target,{mode:preview.mode,position});
      setPreview(null);setSource(`block:${block.id}`);clearTarget();refresh.current?.();
      setSnapHint(preview.replacement?'已替换；原值留在工作区。若不再使用，可选中后按 Delete 或拖到垃圾桶；也可撤销。':'已按预览连接。原后续与分支保留，可以撤销这一步。');
      void Blockly.renderManagement.finishQueuedRenders().then(()=>{
        if(workspace.current!==w||guard.current.dragging||w.isDragging())return;
        if(guard.current.target)reveal.current?.();else w.centerOnBlock(block.id);
      });
    }catch(error){if(created&&!created.getParent()&&!created.getNextBlock())created.dispose(false);setSnapHint(error.message);refresh.current?.();}
    finally{Blockly.Events.setGroup(previousGroup||false);}
  }
  function undo(){
    if(readOnly)return;clearTarget();setPreview(null);setNativeHelp(null);workspace.current.undo(false);refresh.current?.('edit',false,{action:'undo'});setSnapHint('已撤销一步，真实积木与连接已恢复，草稿同步更新。');
  }
  function undoToSingle(){
    const help=nativeHelp,w=workspace.current;if(!help||readOnly)return;
    // A drag group may append its final move after BLOCK_DRAG(end).
    const undoTop=w.getUndoStack().at(-1),sameUndo=help.undoTop?.group?undoTop?.group===help.undoTop.group:undoTop===help.undoTop;
    if(canonicalJson(Blockly.serialization.workspaces.save(w))!==help.state||(help.undoable&&!sameUndo)){setNativeHelp(null);setSnapHint('作品已改变，请按需要撤销，再选择要单独移动的语句。');return;}
    if(help.undoable)undo();setStepMode(true);setMoveMode('single');setSource(`block:${help.blockId}`);selectTarget(help.targetId);
    setSnapHint(`${help.undoable?'已撤销这次拖动。':''}现在只移动所选这一句，分支随行；请先预览，再确认连接。`);
  }
  function changeSource(next){setSource(next);setPreview(null);}
  function changeDestination(next){if(next==='@free'){clearTarget();setTarget(next);setPreview(null);}else selectTarget(next);}
  const selected=slots.find(slot=>slot.id===target);
  return <div className="eq-blockly-editor" data-readonly={readOnly} onKeyDownCapture={event=>{if(!readOnly&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.shiftKey){event.preventDefault();event.stopPropagation();undo();}}}>
    {loadError&&<Notice tone="warm">{loadError}</Notice>}
    <Notice>{readOnly?'正在查看进入文本前的旧积木快照，文本保留；不会自动反转或覆盖。':'值接值槽，动作接语句口。目标只帮助连接；接好后仍需运行查看。'}</Notice>
    {!readOnly&&allowFullExample&&<ActionButton variant="paper" onClick={()=>{const w=workspace.current;Blockly.Events.setGroup(true);try{w.clear();Blockly.serialization.workspaces.load(createExampleBlocks(),w);refresh.current?.('edit',true,{support:'teaching-example'});}finally{Blockly.Events.setGroup(false);}}}>加载教学示例（记录协助）</ActionButton>}
    <div className="eq-game-block-viewport-tools"><ActionButton variant="paper" onClick={()=>{const w=workspace.current;if(!w||guard.current.dragging||w.isDragging())return;const limit=Math.min(1,w.scale);w.zoomToFit();if(w.scale>limit)w.setScale(limit);w.scrollCenter();reveal.current?.();}}>查看完整积木</ActionButton>
      {!readOnly&&<ActionButton variant="paper" aria-expanded={stepMode} onClick={()=>{setStepMode(!stepMode);setPreview(null);}}>点选移动 / 插入</ActionButton>}
      {!readOnly&&<ActionButton variant="paper" onClick={()=>{const toolbox=workspace.current.getToolbox();toolbox.setSelectedItem(toolbox.getToolboxItems().find(item=>item.getName?.()==='等待'));toolbox.getFlyout().scrollToStart();}}>找到等待积木</ActionButton>}
      {!readOnly&&<ActionButton variant="paper" disabled={!canUndo} onClick={undo}>撤销一步</ActionButton>}
      {guided&&!all&&!readOnly&&<ActionButton variant="paper" onClick={()=>setAll(true)}>看看全部积木</ActionButton>}<span>自由拖动会携带后续整串；点选可只移动一句。</span>
    </div>
    {!readOnly&&<div className="eq-program-connection-controls"><div className="eq-exact-slot-tools"><label>连接目标<select aria-label="准备接入的精确槽位" value={target} onChange={e=>changeDestination(e.target.value)} onKeyDown={event=>keyboardSelect(event,changeDestination)}><option value="">自由拖动 · 保护已占用值槽</option>{stepMode&&<option value="@free">工作区空白处（暂不连接）</option>}<optgroup label="语句、分支与前后插入">{slots.filter(slot=>slot.kind!=='value').map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</optgroup><optgroup label="值槽">{slots.filter(slot=>slot.kind==='value').map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</optgroup></select></label>{target&&<button type="button" onClick={()=>{clearTarget();setPreview(null);}}>取消目标</button>}{selected?.kind==='value'&&selected.occupied&&<button type="button" aria-pressed={replacement} onClick={()=>{guard.current.replaceTarget=replacement?null:target;setReplacement(!replacement);setSnapHint(replacement?'已取消本次替换许可，原值受到保护。':`已允许下一次拖动替换 ${selected.label}；也可以先选积木预览，或取消本次许可。`);}}>{replacement?'取消本次替换':'允许本次拖动替换'}</button>}</div>
      {stepMode&&!preview&&<div className="eq-program-placement-tools"><label>1 选积木<select aria-label="选择要移动或插入的积木" value={source} onChange={e=>changeSource(e.target.value)} onKeyDown={event=>keyboardSelect(event,changeSource)}><option value="">从工作区选一块，或从托盘拿取</option><optgroup label="工作区已有积木">{existing.map(block=><option key={block.id} value={`block:${block.id}`}>{block.label}</option>)}</optgroup><optgroup label="从当前托盘拿一块">{tools.current.map(tool=><option key={tool.type} value={`tool:${tool.type}`}>{blockName({type:tool.type})}</option>)}</optgroup></select></label><label>移动范围<select aria-label="移动语句的范围" value={moveMode} onChange={event=>{setMoveMode(event.target.value);setPreview(null);}}><option value="single">只移动这一句，分支随行</option><option value="chain">这一句和后续整串，分支随行</option></select></label><button type="button" disabled={!source||!target} onClick={previewPlacement}>2 预览连接</button></div>}
      {preview&&<div className="eq-program-placement-preview" role="status"><div><strong>{preview.label} → {preview.target.label}</strong><span>{preview.message}</span></div><button type="button" onClick={confirmPlacement}>{preview.replacement?'确认替换':'确认连接'}</button><button type="button" onClick={()=>{setPreview(null);setSnapHint('已取消预览，原来的积木与连接保持不变。');}}>取消预览</button></div>}
      {nativeHelp&&<div className="eq-program-native-help" role="status"><span>整串不能接到自己或自己的尾块。{nativeHelp.undoable?'先恢复原图，再逐句安排。':'可直接改用单句点选，预览后再确认。'}</span><button type="button" disabled={nativeHelp.undoable&&!canUndo} onClick={undoToSingle}>{nativeHelp.undoable?'撤销并改用单句点选':'改用单句点选'}</button></div>}
    </div>}
    {!readOnly&&<output className="eq-block-snap-message" data-block-snap aria-live="polite">{snapHint}</output>}
    <div className="eq-live-blocks" ref={host}/>
  </div>;
}
