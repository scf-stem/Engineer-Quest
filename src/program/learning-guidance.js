import {isRecord} from './common.js';
import {blocksToProgram} from './blocks.js';

const SLOT_LABELS = {INITIAL:'初值', VALUE:'要设置的值', IF0:'判断条件', A:'左边的值', B:'右边的值', BOOL:'布尔条件', MS:'等待的毫秒数', CONDITION:'循环条件'};
const REQUIRED = {eqp_declare:['INITIAL'],eqp_set:['VALUE'],variables_set:['VALUE'],eqp_write:['VALUE'],eqp_wait:['MS'],controls_if:['IF0'],logic_compare:['A','B'],logic_operation:['A','B'],math_arithmetic:['A','B'],logic_negate:['BOOL'],eqp_while:['CONDITION'],controls_whileUntil:['BOOL']};
const blockNames = {eqp_declare:'声明变量',eqp_set:'变量赋值',variables_set:'变量赋值',eqp_write:'数字输出',eqp_wait:'等待',controls_if:'如果／否则',logic_compare:'比较',logic_operation:'逻辑组合',math_arithmetic:'算术',logic_negate:'取反',eqp_while:'条件循环',controls_whileUntil:'条件循环'};
function blocksIn(state) {
  const found = [], seen = new Set();
  function visit(block) {
    if (!isRecord(block) || seen.has(block) || found.length > 1000) return;
    seen.add(block); found.push(block);
    for (const connection of Object.values(block.inputs ?? {})) visit(connection?.block ?? connection?.shadow);
    visit(block.next?.block);
  }
  for (const block of Array.isArray(state?.blocks?.blocks)?state.blocks.blocks:[]) visit(block);
  return found;
}
export function walkProgram(program, visitor) {
  function walk(value, path) {
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (!isRecord(value)) return;
    if (typeof value.id === 'string') visitor(value, path);
    for (const [key, child] of Object.entries(value)) if (!['languageProfileRef','sourceRange'].includes(key)) walk(child, path ? `${path}.${key}` : key);
  }
  walk(program, '');
}

/** Human-facing remediation, separate from stable technical diagnostic codes. */
export function explainProgramDiagnostic(diagnostic, {blockState} = {}) {
  const block = blocksIn(blockState).find(b => b.id === diagnostic.nodeId);
  const focus = {...(diagnostic.nodeId ? {blockId:diagnostic.nodeId} : {}),...(diagnostic.sourceRange ? {sourceRange:diagnostic.sourceRange} : {})};
  let title = '这里还需要调整', observation = diagnostic.message, nextAction = '查看高亮处，修复后重新检查。';
  switch (diagnostic.code) {
    case 'BLOCK_ROOT': title='先放一个程序入口'; observation='还没有把积木连接成一个程序。'; nextAction='打开「变量与流程」，拖入「程序入口」，把要反复做的动作接在「持续执行」里面。'; focus.toolboxCategory='变量与流程'; focus.blockType='eqp_program'; break;
    case 'BLOCK_INPUT': {
      const slot=(REQUIRED[block?.type] ?? []).find(name=>!block.inputs?.[name]?.block&&!block.inputs?.[name]?.shadow);
      title='这里少了一块值积木'; observation=`「${blockNames[block?.type] ?? '这块积木'}」还没接好${SLOT_LABELS[slot] ?? '所需的值'}。`;
      nextAction=slot==='IF0'?'把「比较」接进判断条件，再接上要比较的两个值。':slot==='MS'?'在等待槽中放一个数值，例如先试 100 毫秒。':`把数值、布尔值或读取积木接到「${SLOT_LABELS[slot] ?? '空槽'}」。`;
      if(block?.type==='eqp_write')nextAction='从「输入与判断」取出「布尔值」，接到输出的「设为」空槽；true 表示开，false 表示关。';
      if(slot)focus.inputName=slot; break;
    }
    case 'UNKNOWN_VARIABLE': title='先声明，再使用这个变量'; nextAction='在程序入口的「变量」区声明名称和初值，再核对赋值／取值积木的名称完全相同。'; break;
    case 'VARIABLE_NAME': title='变量需要自己的名字'; nextAction='用字母开头的名称；不要重复声明，也不要与 LIGHT、LAMP 等端口同名。'; break;
    case 'TYPE_MISMATCH': title='这两种值不能直接混用'; nextAction='数值用于比较和等待；输出与判断条件需要 true/false。要判断数值，请先用 <、> 或 == 得到布尔值。'; break;
    case 'CONSTANT_WRITE': title='常量声明后不能修改'; nextAction='如果它代表会变化的读数，声明为普通变量；如果是固定规则，就只读取它。'; break;
    case 'PORT_MAPPING': case 'PORT_TYPE': title='读取或输出端口不对应'; nextAction='对照当前接线资料：从输入端口读取，向输出端口写入；不要自动换线。'; break;
    case 'WAIT_RANGE': title='等待时间需要是非负毫秒数'; nextAction='检查等待所用的数值或变量，先用 100 毫秒验证，再观察两次读取的时间。'; break;
    case 'STEP_BUDGET': title='程序在允许的步数内没有继续向前'; nextAction='查看循环中是否有等待、条件是否会改变。先让每次检查后等待，再重新运行并对照时间。'; break;
    case 'DIVIDE_BY_ZERO': title='除数变成了零'; nextAction='查看该步变量，先判断除数不等于零，再进行除法。'; break;
    case 'INTEGER_RANGE': title='数值超出本课整数范围'; nextAction='查看这一步的两个操作数，把值保持在 −32768 到 32767 之间。'; break;
    case 'SYNTAX': case 'UNKNOWN_TOKEN': case 'EXTRA_SOURCE': title='这句代码还没有写完整'; nextAction='先对照对应积木和代码高亮，检查括号、花括号、分号及函数名。不要改动整段代码来碰运气。'; break;
    case 'DISABLED_BLOCK': title='这块积木当前停用'; nextAction='启用它或删除它，再运行；停用积木不会被悄悄忽略。'; break;
    case 'BLOCK_BRANCH': title='这个分支还不能这样连接'; nextAction='把另一个判断放进「否则」内部，保留每个分支的动作。'; break;
  }
  return {code:diagnostic.code,title,observation,nextAction,focus,technical:diagnostic};
}

/** Structure observations are not correctness or understanding judgments. */
export function inspectProgramWorkspace(blockState,{activityId='auto-light'}={}) {
  const tops=blockState?.blocks?.blocks;
  if (blockState === undefined || blockState === null || (isRecord(blockState) && tops === undefined && blockState.blocks === undefined) || (Array.isArray(tops)&&tops.length===0)) {
    return {state:'empty',canRun:false,program:null,diagnostics:[],observations:[],guidance:{title:'从一块程序入口开始',observation:'工作区是空的，还没有开始编程。',nextAction:'打开「变量与流程」，拖入「程序入口」。先在「持续执行」中放一个数字输出，再放等待。',focus:{toolboxCategory:'变量与流程',blockType:'eqp_program',inputName:'LOOP'}}};
  }
  if (Array.isArray(tops) && (tops.length!==1 || tops[0]?.type!=='eqp_program')) {
    const hasRoot=tops.some(b=>b?.type==='eqp_program'),orphan=tops.find(b=>b?.type!=='eqp_program');
    return {state:'needs_structure',canRun:false,program:null,diagnostics:[],observations:[],guidance:{title:hasRoot?'把散落动作接回程序':'先给这些动作一个入口',observation:hasRoot?'工作区还有未连接到入口的积木。':'动作积木已经放下，但还没有程序入口。',nextAction:hasRoot?'保留已搭好的内容，把散落动作连接到「持续执行」或对应值槽；不要另放第二个入口。':'拖入一个「程序入口」，把现有动作接在「持续执行」里面。',focus:{toolboxCategory:'变量与流程',blockType:'eqp_program',...(orphan?.id?{blockId:orphan.id}:{})}}};
  }
  const checked=blocksToProgram(blockState);
  if(!checked.ok)return {state:'invalid',canRun:false,program:null,diagnostics:checked.diagnostics,observations:[],guidance:explainProgramDiagnostic(checked.diagnostics[0],{blockState})};
  const program=checked.value, loopNodes=[];
  walkProgram(program, (node,path)=>{if(path.startsWith('loop['))loopNodes.push(node);});
  const observe=(id,label,predicate)=>({id,label,nodeIds:loopNodes.filter(predicate).map(n=>n.id)});
  const observations=[observe('read','持续执行中读取输入',n=>n.kind==='read'),observe('compare','用读数比较规则',n=>n.kind==='binary'&&['<','<=','>','>=','==','!='].includes(n.op)),observe('branch','按判断选择动作',n=>n.kind==='if'),observe('output','写入数字输出',n=>n.kind==='write'),observe('wait','连接等待',n=>n.kind==='wait')].map(o=>({...o,observed:o.nodeIds.length>0}));
  const empty=program.loop.length===0;
  let guidance=empty?{title:'让入口里面有一个动作',observation:program.setup.length?'「启动时」只做一次，「持续执行」还是空的。':'程序入口已经放好，「持续执行」还是空的。',nextAction:'先把「数字输出」放进「持续执行」，把布尔值 true 接到「设为」空槽，再在后面接「等待」和一个毫秒数。',focus:{blockId:tops[0].id,inputName:'LOOP',blockType:'eqp_write'}}:{title:'结构可以运行，现在看真实结果',observation:'这些积木已组成合法程序。合法结构不代表满足客户要求。',nextAction:'先预测灯会怎样变化，再运行当前练习；对照输入、预期、实际和对应步骤。',focus:{}};
  const has=id=>observations.some(o=>o.id===id&&o.observed);
  const suggest=(title,observation,nextAction,blockType,inputName)=>({title,observation,nextAction,focus:{blockId:tops[0].id,blockType,...(inputName?{inputName}:{})}});
  if(!empty){
    if(['auto-light','read-input','repeat-read'].includes(activityId)&&!has('read'))guidance=suggest('结构可以运行，下一步接入当前读数','持续执行里还没有读取输入；反复写同一个灯状态不会发现光照变化。','读取是值积木。可以先声明整数 light、初值 0，再在「持续执行」中放「变量 light 设为」，把读取 LIGHT 接到它的值槽。','eqp_read_analog','LOOP');
    else if(['auto-light','branch-output'].includes(activityId)&&!has('compare'))guidance=suggest('结构可以运行，下一步比较读数','还没有观察到持续执行中的比较表达式。','从「输入与判断」拖出「比较」，左边接光照读数或保存它的变量，右边接本练习的规则值。比较会得到 true 或 false。','logic_compare');
    else if(['auto-light','branch-output'].includes(activityId)&&!has('branch'))guidance=suggest('结构可以运行，下一步让判断选择动作','读数可以比较，但还没有如果／否则结构。','把比较接到「如果」条件里，在执行与否则中分别放输出。先检查暗、亮两种场景，再判断组合是否符合要求。','controls_if','IF0');
    else if(!has('output'))guidance=suggest('结构可以运行，下一步给出输出','持续执行中还没有写入数字输出。','把数字输出接到需要执行的分支里；LAMP 的值要用布尔值或布尔表达式。','eqp_write');
    else if(!has('wait'))guidance=suggest('结构可以运行，下一步接等待','还没有连接等待；反复计算可能只消耗步数而没有推进虚拟时间。','找到「等待」积木，在每轮检查后接上数值，例如先试 100 毫秒，再看两次读取间隔。','eqp_wait','MS');
  }
  return {state:empty?'needs_structure':'runnable',canRun:!empty,program,diagnostics:[],observations,guidance};
}
