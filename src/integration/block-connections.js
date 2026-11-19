const names={eqp_program:'程序入口',eqp_declare:'变量声明',eqp_get:'变量取值',eqp_set:'变量赋值',eqp_read_analog:'读取',eqp_write:'灯输出',logic_compare:'比较',controls_if:'如果',eqp_while:'循环',eqp_wait:'等待',math_number:'数值',logic_boolean:'布尔值'};
const inputs={LOOP:'持续执行',VARIABLES:'变量区',SETUP:'启动时',INITIAL:'初值',VALUE:'设为的值',IF0:'判断条件',A:'左边值',B:'右边值',DO0:'如果分支',DO:'执行分支',ELSE:'否则分支',BODY:'循环内动作',MS:'毫秒数',CONDITION:'循环条件',BOOL:'真假条件'};
export const blockName=block=>names[block?.type]??'积木';
export const slotName=(block,name)=>`${blockName(block)} · ${inputs[name]??name}`;
export function valueKind(block){
  if(['math_number','math_arithmetic','eqp_read_analog'].includes(block?.type))return 'Number';
  if(['logic_boolean','logic_compare','logic_operation','logic_negate'].includes(block?.type))return 'Boolean';
  if(block?.type==='eqp_get'){
    const declaration=block.workspace.getAllBlocks(false).find(b=>b.type==='eqp_declare'&&b.getFieldValue('NAME')===block.getFieldValue('NAME'));
    return declaration?.getFieldValue('TYPE')==='int'?'Number':declaration?.getFieldValue('TYPE')==='bool'?'Boolean':null;
  }
  return null;
}
function expectedKind(block,name){
  if(['IF0','BOOL','CONDITION'].includes(name)||block.type==='logic_operation'||block.type==='logic_negate'||block.type==='eqp_write')return 'Boolean';
  if(block.type==='eqp_wait'||block.type==='math_arithmetic')return 'Number';
  if(block.type==='eqp_declare')return block.getFieldValue('TYPE')==='int'?'Number':'Boolean';
  return null;
}
/** Drag-only protection. Loading old work never rewrites or detaches it. */
export function valueDropDecision({moving,parent,input,occupied,selected,replaceTarget}){
  const key=parent.id+'|'+input.name,label=slotName(parent,input.name);
  if(selected&&selected!==key)return {allowed:false,message:`已锁定精确槽位；请把这块拖到所选槽，或取消目标后自由拖动。`};
  const actual=valueKind(moving),expected=expectedKind(parent,input.name);
  if(actual&&expected&&actual!==expected)return {allowed:false,message:`${label}需要${expected==='Boolean'?'真/假':'数值'}。变量读数请接到比较的左边值，比较结果再接判断条件。`};
  if(occupied&&!occupied.isShadow?.()&&occupied.id!==moving.id&&replaceTarget!==key)return {allowed:false,message:`${label}已有${blockName(occupied)}，已保护原结构。先选精确槽位；确实要更换时，再明确允许替换这个槽。`};
  return {allowed:true,message:`目标：${label}`};
}
export function describeConnection(block){
  if(block?.type==='eqp_program')return '程序入口已放下。入口独立留在画布里，动作接到它的内部槽口。';
  const parent=block?.getParent();if(!parent)return null;
  const input=parent.getInputWithBlock(block);
  return input?`已经吸附到${slotName(parent,input.name)}。`:`已经连接在${blockName(parent)}后面，成为下一步动作。`;
}
export function listValueSlots(workspace,Blockly){
  const counters=new Map(),slots=[];
  for(const block of workspace.getAllBlocks(false)){
    if(block.isInsertionMarker()||block.isShadow())continue;
    const number=(counters.get(block.type)??0)+1;counters.set(block.type,number);
    for(const input of block.inputList)if(input.type===Blockly.INPUT_VALUE){const target=input.connection.targetBlock();slots.push({id:block.id+'|'+input.name,blockId:block.id,inputName:input.name,label:`${blockName(block)} ${number} · ${inputs[input.name]??input.name}${target?`（已接${blockName(target)}）`:'（空）'}`,occupied:!!target&&!target.isShadow()});}
  }
  return slots;
}
/** Stable value IDs are retained for callers that already save exact slots. */
export function listConnectionTargets(workspace,Blockly){
  const counters=new Map(),targets=[];
  for(const block of workspace.getAllBlocks(false)){
    if(block.isInsertionMarker()||block.isShadow())continue;
    const number=(counters.get(block.type)??0)+1;counters.set(block.type,number);
    const label=`${blockName(block)} ${number}`;
    for(const input of block.inputList)if(input.connection){
      const kind=input.type===Blockly.INPUT_VALUE?'value':input.type===Blockly.NEXT_STATEMENT?'statement':null;
      if(!kind)continue;
      const child=input.connection.targetBlock();
      targets.push({id:`${block.id}|${input.name}`,kind,blockId:block.id,inputName:input.name,label:`${label} · ${inputs[input.name]??input.name}${child?kind==='value'?`（已接${blockName(child)}）`:'（插到本路第一句前）':'（空）'}`,occupied:!!child&&!child.isShadow()});
    }
    if(block.previousConnection)targets.push({id:`${block.id}|@before`,kind:'before',blockId:block.id,label:`${label} · 前面（插到本句前）`});
    if(block.nextConnection)targets.push({id:`${block.id}|@after`,kind:'after',blockId:block.id,label:`${label} · 后面${block.nextConnection.isConnected()?'（原下句保留）':'（末尾）'}`});
  }
  return targets;
}
export function targetConnection(workspace,target){
  const block=workspace.getBlockById(target?.blockId);
  return target?.kind==='before'?block?.previousConnection:target?.kind==='after'?block?.nextConnection:block?.getInput(target?.inputName)?.connection;
}
export function connectionKey(connection){
  if(!connection)return '';
  const block=connection.getSourceBlock(),input=block.inputList.find(item=>item.connection===connection);
  return `${block.id}|${input?.name??(block.previousConnection===connection?'@before':'@after')}`;
}
export function targetBoundary(workspace,target){
  const connection=targetConnection(workspace,target);
  return new Set([connectionKey(connection),connectionKey(connection?.targetConnection)].filter(Boolean));
}
/** Describe the actual final graph, never a previous hover or selected label. */
export function nativeDropFeedback(block,{target=null,carriedIds=new Set(),blocked='',undoable=true}={}){
  if(!block)return {inProgram:false,matched:false,conflict:false,message:'这块已移出工作区。需要恢复时可撤销。'};
  if(block.type==='eqp_program')return {inProgram:true,matched:false,conflict:false,message:describeConnection(block)};
  let root=block;while(root.getParent())root=root.getParent();
  const inProgram=root.type==='eqp_program',conflict=!!target&&carriedIds.has(target.blockId);
  let matched=false;
  if(target&&!conflict){
    const connection=targetConnection(block.workspace,target);
    if(target.kind==='before'){
      let tail=block;while(tail.getNextBlock()&&carriedIds.has(tail.getNextBlock().id))tail=tail.getNextBlock();
      matched=tail.getNextBlock()?.id===target.blockId;
    }else matched=connection?.targetBlock()===block;
  }
  if(!inProgram){
    const reason=conflict?`直接拖动会携带后续整串，不能接到自己或自己的尾块。请${undoable?'撤销并':''}改用单句点选。`:target?`未接到所选「${target.label}」。可撤销或重新选择连接口。`:'可撤销，或重新选择入口内的连接口。';
    return {inProgram,matched:false,conflict,message:`尚未接入程序入口。以「${blockName(root)}」开头的这组积木仍在工作区。${reason}${blocked&&!conflict?` 本次检查提示：${blocked}`:''}`};
  }
  const actual=describeConnection(block)??'积木已连接到入口内的实际连接口。';
  return {inProgram,matched,conflict,message:target&&!matched?`实际落点：${actual} 尚未接到所选「${target.label}」。`:actual};
}
/** Single-statement moves own their inputs/branches, but leave their next chain. */
function ownedIds(block,mode){
  if(mode==='chain'||!block.previousConnection)return new Set(block.getDescendants(false).map(child=>child.id));
  const ids=new Set([block.id]);
  for(const input of block.inputList)for(const child of input.connection?.targetBlock()?.getDescendants(false)??[])ids.add(child.id);
  return ids;
}
export function placementDecision(workspace,moving,target,{mode='single'}={}){
  if(!moving)return {allowed:false,message:'先选择要移动或拿取的积木。'};
  if(target?.kind==='free')return {allowed:true,message:'放到工作区空白处，暂不连接。'};
  const connection=targetConnection(workspace,target),owner=connection?.getSourceBlock();
  if(!connection)return {allowed:false,message:'这个连接口已改变，请重新选择目标。'};
  if(ownedIds(moving,mode).has(owner.id))return {allowed:false,message:'不能把积木接到它自己的内部或自身连接口。请选择另一处目标。'};
  if(target.kind==='value'){
    if(!moving.outputConnection)return {allowed:false,message:`${target.label}是值位；动作积木要选择语句、前面或后面。`};
    const decision=valueDropDecision({moving,parent:owner,input:owner.getInput(target.inputName),occupied:null});
    if(!decision.allowed)return decision;
    if(!workspace.connectionChecker.doTypeChecks(moving.outputConnection,connection))return {allowed:false,message:'这块提供的值类型与所选值位不同。原来的连接保持不变。'};
    const old=connection.targetBlock();
    return {allowed:true,replacement:!!old&&old.id!==moving.id&&!old.isShadow(),message:old&&old.id!==moving.id?`将替换${blockName(old)}；原值留在工作区，可撤销。`:'把这一块接入所选值位。'};
  }
  if(!moving.previousConnection)return {allowed:false,message:'这里连接下一句动作。提供数值的积木要选择值位。'};
  const declarationTarget=target.inputName==='VARIABLES'||owner.type==='eqp_declare';
  if((moving.type==='eqp_declare')!==declarationTarget)return {allowed:false,message:declarationTarget?'变量区只接声明；动作请选择启动时、持续执行或分支。':'声明留在变量区；这里接执行动作。'};
  if(target.kind==='before'&&!moving.nextConnection)return {allowed:false,message:'这块没有后续连接口，不能插在本句前。'};
  const superior=target.kind==='before'?connection.targetConnection:connection;
  if(superior&&!workspace.connectionChecker.doTypeChecks(superior,moving.previousConnection))return {allowed:false,message:'这两处语句连接口不兼容，原来的连接保持不变。'};
  return {allowed:true,message:mode==='chain'?'移动这一句和它的后续整串，分支随行；目标原下句接在整串后。':'只移动这一句，分支随行；原位置的后续会接回，目标原下句保留。'};
}
function detachStatement(block,mode){
  if(mode==='chain'){block.unplug(false);return;}
  const upper=block.previousConnection?.targetConnection,lower=block.nextConnection?.targetConnection;
  if(upper)block.previousConnection.disconnect();
  if(lower)block.nextConnection.disconnect();
  if(upper&&lower)upper.connect(lower);
}
/** Mutates real Blockly connections only; callers group these native undo events. */
export function placeBlock(workspace,Blockly,moving,target,{mode='single',position}={}){
  const decision=placementDecision(workspace,moving,target,{mode});
  if(!decision.allowed)throw new Error(decision.message);
  if(moving.previousConnection)detachStatement(moving,mode);else moving.unplug(false);
  if(target.kind==='free'){
    if(position){const old=moving.getRelativeToSurfaceXY();moving.moveBy(position.x-old.x,position.y-old.y);}
    return decision;
  }
  const connection=targetConnection(workspace,target);
  if(target.kind==='value'){
    const old=connection.targetBlock();
    if(old){old.unplug(false);if(!old.isShadow())old.moveBy(32,72);}
    connection.connect(moving.outputConnection);
    return decision;
  }
  let upper,lower;
  if(target.kind==='before'){lower=connection;upper=connection.targetConnection;}
  else{upper=connection;lower=connection.targetConnection;}
  if(upper&&lower)upper.disconnect();
  let tail=moving;while(tail.getNextBlock())tail=tail.getNextBlock();
  if(upper)upper.connect(moving.previousConnection);
  if(lower)tail.nextConnection.connect(lower);
  return decision;
}
export function guardedChecker(Blockly,guard){
  return class extends Blockly.ConnectionChecker{
    doDragChecks(a,b,distance){
      if(!super.doDragChecks(a,b,distance))return false;
      if(guard.targetKind&&guard.targetKind!=='value'){
        if(!guard.boundary?.has(connectionKey(a))&&!guard.boundary?.has(connectionKey(b))){guard.blocked='请对准当前高亮的语句连接口，或取消目标后自由拖动。';return false;}
      }
      const superior=a.type===Blockly.INPUT_VALUE?a:b.type===Blockly.INPUT_VALUE?b:null;
      if(!superior)return true;
      const output=superior===a?b:a,parent=superior.getSourceBlock(),input=parent.inputList.find(i=>i.connection===superior);
      if(!input)return true;
      // Insertion previews temporarily connect a cloned block. Only the drag-start
      // graph can tell whether a value slot was really occupied.
      const prior=guard.dragging?guard.occupied?.get(parent.id+'|'+input.name):superior.targetBlock();
      const occupied=prior?.id===guard.draggedId?null:prior;
      const decision=valueDropDecision({moving:output.getSourceBlock(),parent,input,occupied,selected:guard.targetKind&&guard.targetKind!=='value'?null:guard.target,replaceTarget:guard.replaceTarget});
      if(!decision.allowed)guard.blocked=decision.message;
      return decision.allowed;
    }
  };
}
