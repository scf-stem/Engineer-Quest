import React,{useEffect,useMemo,useRef,useState} from 'react';
import TeachingEditor from './TeachingEditor.jsx';
import {canonicalJson} from '../contracts/index.js';
import {Dialog} from '../ui/components.jsx';
import {assessTeachingRun,teachingFrameAt} from './runtime.js';
import {draftKeyFor,kindFor,mentorSeed,stepFor,studentRunFor,teachingWorkspaceIdentity} from './progression.js';
import {useTeachingProgress} from './useTeachingProgress.js';
import './program-teaching.css';

const nextPhases={'g0-demo':'g0-operation','g0-error':'g0-operation','g0-success':'g1-start','g1-demo':'g1-operation','g1-success-on':'g1-try-off','g1-success-off':'g1-independent-on','g1-independent-on-done':'g1-independent-off','g1-independent-success':'g2-start','g2-demo':'g2-operation','g2-success-end':'g2-independent-operation','g2-independent-success':'g3-start','g3-demo':'g3-operation','g3-success':'g3-transfer'};
const errorPhase=phase=>phase.startsWith('g3')?'g3-error':phase.startsWith('g2')?'g2-error':'g1-error';
const logicalPhase=record=>record.phase.endsWith('-error')?record.operationPhase??record.phase:record.phase;
const goalFor=phase=>phase.startsWith('g3')?'read':phase==='g2-independent-operation'?'off-wait-on':phase.startsWith('g2')?'on-wait-off':['g1-try-off','g1-independent-off'].includes(phase)?'off':'on';
const lastEvent=(run,kind)=>run?.value?.simulation?.events.filter(e=>e.kind===kind&&run.value.studentNodeIds.includes(e.nodeId)).at(-1);
function teachingError(d,observed,kind,goal){
  if(d?.code==='TEACHING_TOP_LEVEL')return '有积木还留在动作链外。若是刚换下的备用值，用“点选放入”选中它，再点“移走未连接值”；这一步也能撤销。';
  if(d?.code==='BLOCK_INPUT')return d.message.includes('MS')?'等待多久还没填。给等待的时间值位接一个正数，再运行。':kind==='reading'?'观察值位还空着。把 LIGHT 读取块接进去，再执行读取。':'这句还缺开或关。把 true 或 false 接进灯的值位，再执行。';
  if(d?.code==='TEACHING_SEQUENCE_WAIT'){
    const writes=observed?.writes??[],wait=observed?.waits?.[0];
    return wait?`这次先在 ${writes.at(-1)?.atMs??0} ms 做完了两句，之后才开始等。把等待接到两句之间，再看第一句怎样保持。`:`开和关都在 ${writes[0]?.atMs??0} ms 做完了。中间加一个等待，第一句才能保持一会儿。`;
  }
  if(d?.code==='TEACHING_SEQUENCE_DIRECTION')return `刚才先${observed?.writes?.[0]?.value?'开':'关'}，最后${observed?.lastStudentLamp?'亮':'灭'}。这次要先保持${goal==='off-wait-on'?'关，再开':'开，再关'}；沿着积木调整先后，再运行。`;
  if(d?.code==='TEACHING_OUTPUT_MISMATCH')return `刚才发出的是${observed?.lastStudentLamp?'开灯':'关灯'}指令。这次要让灯${goal==='on'?'亮':'灭'}，看一看指令的值，再自己改。`;
  return d?.message??'看一看刚才的真实记录，再调整这一处。';
}

/** Only the policy/controller executes programs; this component controls presentation and input. */
export default function ProgramTeaching({workspace,state,context,onManual,onExit,suspended=false,visible=true,review=false,onCloseReview}){
  const progress=useTeachingProgress(workspace,state),{record,current,update}=progress;
  const [busy,setBusy]=useState(false),[sourceOpen,setSourceOpen]=useState(false),[helpOpen,setHelpOpen]=useState(false),[reviewRun,setReviewRun]=useState(null);
  const lock=useRef(false),root=useRef(null),resumePending=useRef(null);
  const phase=logicalPhase(record),step=stepFor(record),key=draftKeyFor(phase),kind=kindFor(phase),mentor=step.mentor===true;
  const preparedWorkspace=useMemo(()=>mentorSeed(kind),[kind]);
  const runId=review?reviewRun??record.runIds.at(-1):record.selectedRunId;
  const action=studentRunFor(state,runId),run=action?.result,frame=run?.value?teachingFrameAt(run,record.replay.atMs):null;
  const allReads=record.runIds.map(id=>studentRunFor(state,id)).filter(a=>a?.request.inputs.actor==='learner'&&a.request.inputs.kind==='reading').map(a=>lastEvent(a.result,'read')).filter(Boolean);
  const lastRead=frame?.read??allReads.at(-1)??record.demoRead??null;
  const lamp=typeof frame?.lamp==='boolean'?frame.lamp:record.lastLamp??null;
  const stopped=record.paused||suspended||!visible||sourceOpen||helpOpen||['unsaved','external-change'].includes(state.storage.status);
  const oldResult=!review&&action&&action.request.inputs.actor==='learner'&&(teachingWorkspaceIdentity(record.drafts[key])!==teachingWorkspaceIdentity(action.request.inputs.blockState)||canonicalJson(state.attempt.draft.wiring)!==canonicalJson(action.request.wiring));
  const activeBlocks=record.drafts[key]?.blocks?.blocks??[],first=activeBlocks[0];
  let filledWait=false;for(let node=first;node;node=node.next?.block)if(node.type==='eqp_wait'&&node.inputs?.MS?.block)filledWait=true;
  const connected=kind==='reading'?!!first?.inputs?.VALUE?.block:kind==='output'?!!first?.inputs?.VALUE?.block:filledWait;
  let nextFocus=step.focus;
  if(record.phase==='g0-operation')nextFocus=!record.observed?'environment':record.inputChoice!=='light'?'input':record.outputChoice!=='lamp'?'output':'primary';
  else if(connected&&['g1-operation','g1-try-off','g1-independent-on','g1-independent-off','g2-operation','g2-independent-operation'].includes(phase))nextFocus=record.prediction===null?'prediction':'primary';
  else if(kind==='reading'&&connected&&['g3-operation','g3-transfer'].includes(phase))nextFocus=record.environment===(phase==='g3-transfer'?allReads.at(-1)?.value:record.demoRead?.value)?'environment':'primary';
  if(record.phase==='g3-success')nextFocus=record.sampleSelection?'primary':'sample';
  if(record.phase==='g2-success-hold'&&record.waitObserved)nextFocus='primary';
  const focus=review||stopped?'none':record.feedback?.target??nextFocus;
  const focusProps=target=>({'data-intro-target':target,'data-intro-focus':focus===target?'true':undefined});
  const blocked=busy||state.facts.pending||!state.facts.wiringValid;
  const editorDisabled=stopped||busy||!state.facts.wiringValid;

  function save(patch){const request=update(patch);request.catch(()=>{});return request;}
  async function move(to,patch={}){await save({phase:to,operationPhase:to,prediction:null,feedback:null,focus:null,replay:{...current.current.replay,playing:false},...patch});}
  function feedback(message,target='editor',diagnostic=null){return save({feedback:{message,target,diagnostic},...(diagnostic?.nodeId?{focus:{blockId:diagnostic.nodeId,inputName:diagnostic.inputName??'VALUE'}}:{})});}
  function studentEdit(next,detail={}){
    if(stopped||review)return;
    const before=current.current,draftKey=draftKeyFor(logicalPhase(before));
    if(canonicalJson(next)===canonicalJson(before.drafts[draftKey]))return;
    const changed=teachingWorkspaceIdentity(next)!==teachingWorkspaceIdentity(before.drafts[draftKey]);
    void save({drafts:{...before.drafts,[draftKey]:next},...(changed?{prediction:null}:{}),feedback:detail.diagnostic?{message:detail.diagnostic.message,target:'editor',diagnostic:detail.diagnostic}:null,replay:{...before.replay,playing:false}});
  }
  async function finishRun(result,pending){
    const before=current.current,base={pendingRun:null,selectedRunId:pending.inputs.runId,runIds:[...new Set([...before.runIds,pending.inputs.runId])],replay:{atMs:0,playing:false},feedback:null,waitObserved:false};
    if(pending.inputs.actor==='mentor'){
      if(!result.ok)return save({...base,feedback:{message:result.diagnostics?.[0]?.message??'刚才这一步没有执行完，作品留着，可以重试。',target:'primary'}});
      const read=lastEvent(result,'read'),write=lastEvent(result,'write');
      return save({...base,phase:pending.after,operationPhase:pending.after,prediction:pending.after.endsWith('-demo')?before.prediction:null,lastPrediction:pending.after.endsWith('-demo')?before.prediction:null,...(read?{demoRead:read}:{}),...(write?{lastLamp:write.value}:{}),environment:pending.inputs.light});
    }
    const checked=assessTeachingRun(result,{goal:goalFor(pending.from),...(pending.inputs.kind==='reading'?{previousLight:pending.previousLight}:{})});
    if(!checked.ok){
      const diagnostics=checked.diagnostics??result.diagnostics??[],tops=pending.inputs.blockState?.blocks?.blocks??[];
      const d=diagnostics.find(item=>tops.length>1&&item.nodeId===tops[1].id)??diagnostics[0];
      const target=d?.nodeId?{blockId:d.nodeId,...(d.code==='TEACHING_SEQUENCE_WAIT'||d.code==='TEACHING_SEQUENCE_DIRECTION'?{connection:'previous'}:{inputName:d.inputName??(d.message?.includes('MS')?'MS':'VALUE')})}:null;
      return save({...base,phase:errorPhase(pending.from),operationPhase:pending.from,feedback:{message:teachingError(d,checked.observed,pending.inputs.kind,goalFor(pending.from)),target:d?.code==='TEACHING_READ_UNCHANGED'?'environment':'editor',diagnostic:d??null},focus:target});
    }
    let to,atMs=0;
    if(pending.inputs.kind==='reading')to=pending.from==='g3-transfer'?'g3-transfer-success':'g3-success';
    else if(pending.inputs.kind==='sequence'){
      to=pending.from==='g2-independent-operation'?'g2-independent-success':'g2-success-hold';
      const wait=checked.observed.waits[0];atMs=to==='g2-success-hold'?wait.atMs+Math.floor(wait.durationMs/2):lastEvent(result,'write')?.atMs??0;
    }else to=pending.from==='g1-independent-on'?'g1-independent-on-done':pending.from==='g1-independent-off'?'g1-independent-success':pending.from==='g1-try-off'?'g1-success-off':'g1-success-on';
    const write=lastEvent(result,'write');
    return save({...base,phase:to,operationPhase:to,sampleSelection:false,replay:{atMs,playing:false},...(write?{lastLamp:write.value}:{}),lastPrediction:before.prediction});
  }
  async function execute(actor='learner',after=null,preparation=null){
    if(lock.current||blocked)return;lock.current=true;setBusy(true);
    try{
      const before=current.current,from=logicalPhase(before),runKind=kindFor(from);
      if(runKind!=='reading'&&before.prediction===null&&!preparation){await feedback('先猜一猜最后会亮还是灭，再看实际执行。','prediction');return;}
      const pending=before.pendingRun??{from,after,previousLight:runKind==='reading'?(from==='g3-transfer'?allReads.at(-1)?.value:before.demoRead?.value):undefined,
        inputs:{kind:runKind,blockState:preparation??(actor==='mentor'?mentorSeed(runKind):before.drafts[draftKeyFor(from)]),light:actor==='mentor'&&runKind==='reading'?170:before.environment,initialLamp:before.lastLamp??false,actor,runId:crypto.randomUUID(),...(preparation?{preparation:true}:{})}};
      // Keep every saved value JSON-only, including before the real action is committed.
      if(pending.previousLight===undefined)delete pending.previousLight;
      await save({pendingRun:pending,replay:{atMs:0,playing:false},feedback:null});
      const result=await workspace.performLearningAction({phase:'blocks',actionId:'graphic-intro-run',inputs:pending.inputs});
      await finishRun(result,pending);
    }catch(e){await feedback(e.message,'primary').catch(()=>{});}
    finally{lock.current=false;setBusy(false);}
  }
  useEffect(()=>{
    const pending=record.pendingRun,found=pending&&studentRunFor(state,pending.inputs.runId);
    if(!found||state.facts.pending||lock.current||resumePending.current===found.id)return;
    resumePending.current=found.id;void finishRun(found.result,pending).catch(()=>{});
  },[state.attempt?.learningActions,state.facts.pending,record.pendingRun]);
  useEffect(()=>{
    if(stopped||!record.replay.playing||!run?.value)return;
    const timer=setTimeout(()=>{const end=run.value.simulation.completedThroughMs,atMs=Math.min(end,current.current.replay.atMs+100);void save({replay:{atMs,playing:atMs<end}});},220);
    return()=>clearTimeout(timer);
  },[record.replay,stopped,runId]);
  useEffect(()=>{if(stopped&&current.current.replay.playing)void save({replay:{...current.current.replay,playing:false}});},[stopped]);
  async function primary(){
    if(record.paused)return save({paused:false});
    if(record.pendingRun)return execute(record.pendingRun.inputs.actor,record.pendingRun.after);
    if(record.phase==='g0-start')return move('g0-demo',{environment:170});
    if(record.phase==='g0-operation'){
      if(!record.observed)return feedback('先亲手遮住或移开遮挡，看看哪一个数变了。','environment');
      if(record.inputChoice!=='light')return save({phase:'g0-error',feedback:{message:'日期没变，光照表变了。哪个信息能告诉装置眼前暗了？',target:'input'}});
      if(record.outputChoice!=='lamp')return feedback('灯要执行的是开关动作；光照数字是它读进来的信息。','output');
      return move('g0-success');
    }
    if(['g1-start','g2-start','g3-start'].includes(record.phase))return execute('mentor',record.phase.replace('start','demo'));
    if(record.phase==='g1-demo'){const off=mentorSeed('output');off.blocks.blocks[0].inputs.VALUE.block.fields.BOOL='FALSE';return execute('mentor','g1-operation',off);}
    if(record.phase==='g2-success-hold'){if(!record.waitObserved)return feedback('点一下时间轴里的等待记录，看看等待时保留的灯态。','events');return move('g2-success-end',{replay:{atMs:lastEvent(run,'write')?.atMs??600,playing:false}});}
    if(record.phase==='g3-success'&&!record.sampleSelection)return feedback('指给我看：哪一项是刚才真正读到的记录？','sample');
    if(record.phase==='g3-transfer-success')return move('complete');
    if(nextPhases[record.phase])return move(nextPhases[record.phase],record.phase==='g0-demo'?{environment:820,observed:false}:record.phase==='g2-success-end'?{drafts:{...record.drafts,'g2-independent':structuredClone(record.drafts.g2)}}:{});
    if(review)return onCloseReview?.();
    return execute();
  }
  const independentOnDone=record.phase==='g1-independent-on-done';
  const currentStep=record.phase==='g2-success-hold'&&frame?.lamp===false?{...step,title:'回放到关灯以后，灯灭了。',line:'这条记录里的等待已经结束，后面的关灯指令生效了。点等待记录可回看保持的区间。'}:record.phase==='g2-success-hold'&&record.waitObserved?{...step,line:'等待这段保留了开灯状态。现在看结束之后，下一句怎样执行。'}:record.phase==='g3-operation'&&record.environment===lastRead?.value?{...step,title:'先改变环境，再看旧记录。'}:step;
  const showEditor=review||!record.phase.startsWith('g0')&&record.phase!=='complete';
  const displayWorkspace=review?action?.request.inputs.blockState??record.drafts.g3:mentor?preparedWorkspace:record.drafts[key];
  const editorKind=review?action?.request.inputs.kind??'reading':kind;
  const choicesVisible=!review&&!record.phase.startsWith('g0')&&!record.phase.startsWith('g3')&&!record.phase.includes('success')&&!record.phase.endsWith('-demo')&&!independentOnDone&&(!record.phase.endsWith('-error')||record.prediction===null);
  const meaningfulEvents=run?.value?.simulation?.events.filter(e=>run.value.studentNodeIds.includes(e.nodeId)&&['write','read','wait','resume'].includes(e.kind))??[];
  const showEvents=review||record.phase.endsWith('-demo')||record.phase.includes('success')||independentOnDone||record.phase.endsWith('-error')&&!oldResult;
  const actionLabel=record.pendingRun?'重试刚才这次执行':currentStep.action;
  return <section ref={root} className="eq-graphic-intro" data-phase={record.phase} data-focus={focus} data-paused={record.paused} aria-label="图形化入门带教">
    <div className="eq-intro-scene"><img src={`/art/program-teaching/scene-${lamp===true?'on':'off'}.webp`} alt={lamp===true?'样机灯罩发光，台面受到照亮':'冷色研发现场，林工陪同观察灯控样机'}/></div>
    <header className="eq-intro-heading" inert={record.paused?true:undefined} aria-hidden={record.paused?true:undefined}><div><small>{record.phase==='complete'?'G0–G3 / 练习记录':phase.slice(0,2).toUpperCase()+' / '+(mentor?'林工先示范':currentStep.independent?'这次你自己来':'轮到你')}</small><h2>{currentStep.title}</h2></div><nav><button type="button" onClick={()=>onManual?.(kind==='reading'?'P09':'P07')}>本步图解</button><button type="button" disabled={busy} onClick={()=>save({paused:!record.paused,replay:{...record.replay,playing:false}})}>{record.paused?'继续':'暂停'}</button><button type="button" onClick={async()=>{await save({replay:{...record.replay,playing:false}});await onExit?.();}}>返回研发室</button></nav></header>
    <div className="eq-intro-port-strip">LIGHT → Uno A0 输入　　LAMP → D9 输出</div>
    <div className="eq-intro-mentor-name">林工 <small>你的带教同事</small></div>
    <div className="eq-intro-center" inert={record.paused?true:undefined} aria-hidden={record.paused?true:undefined}>
      {record.phase.startsWith('g0')?<div className="eq-intro-g0">
        <section className="eq-intro-region" {...focusProps('environment')}><label>当前光照 <output data-intro-environment>{record.environment}</output></label><button type="button" onClick={()=>save({environment:record.environment<450?820:170,observed:true,feedback:null})}>{record.environment<450?'移开遮挡':'遮住光源'}</button></section>
        <section className="eq-intro-region" {...focusProps('input')}><p>装置读进来的信息</p><div className="eq-intro-card-row">{[['light','当前光照读数'],['date','今天的日期']].map(([id,label])=><button type="button" key={id} aria-pressed={record.inputChoice===id} onClick={()=>save({inputChoice:id,feedback:null})}>{label}</button>)}</div></section>
        <section className="eq-intro-region" {...focusProps('output')}><p>灯要执行的动作</p><div className="eq-intro-card-row">{[['lamp','灯的开关'],['light','光照数字']].map(([id,label])=><button type="button" key={id} aria-pressed={record.outputChoice===id} onClick={()=>save({outputChoice:id,feedback:null})}>{label}</button>)}</div></section>
      </div>:showEditor?<div className="eq-intro-editor eq-intro-region" data-needed="true" {...focusProps('editor')}>
        {review&&<label>回看实际执行<select aria-label="回看入门运行记录" value={runId??''} onChange={e=>setReviewRun(e.target.value)}>{record.runIds.map((id,i)=>{const item=studentRunFor(state,id);return <option key={id} value={id}>{i+1}. {item?.request.inputs.actor==='mentor'?'林工示范':'本人操作'} · {({output:'开关',sequence:'顺序',reading:'读取'})[item?.request.inputs.kind]}</option>;})}</select></label>}
        <TeachingEditor kind={editorKind} value={displayWorkspace} deviceProfile={context.hardware.executionProfile} readOnly={mentor||review} disabled={editorDisabled} independent={currentStep.independent===true} focusTarget={focus==='editor'?record.focus:null} focusNodeId={record.feedback?.diagnostic?.nodeId??frame?.nodeId??null}
          onChange={studentEdit} onFocusTarget={target=>{if(!stopped&&!review&&!mentor&&canonicalJson(target)!==canonicalJson(current.current.focus))void save({focus:target});}} onInteraction={detail=>{if(stopped||review)return;if(detail?.diagnostic)void feedback(detail.diagnostic.message,'editor',detail.diagnostic);else if(detail?.type==='select-target'&&detail.focusTarget)void save({focus:detail.focusTarget,feedback:{message:'目标轮廓在这里。先核对连接预览，再确认放入。',target:'editor'}});}}/>
      </div>:<div className="eq-intro-complete"><h3>开关 · 顺序 · 取当前数</h3><p>自己的局部作品与运行记录都已保留。</p><p>回到完整原型工位，把读取和明暗判断接起来，再交给客户试。</p></div>}
      {choicesVisible&&<div className="eq-intro-prediction eq-intro-region" {...focusProps('prediction')}><span>我的预测：最后会</span>{[[true,'亮'],[false,'灭']].map(([value,label])=><button type="button" key={label} aria-pressed={record.prediction===value} disabled={stopped||blocked} onClick={()=>save({prediction:value,feedback:null})}>{label}</button>)}</div>}
    </div>
    {!phase.startsWith('g3')&&<aside className="eq-intro-device eq-intro-region" data-needed="true" {...focusProps('device')}><small>当前装置 / 实际输出记录</small><strong data-intro-lamp={lamp===null?'unrun':lamp?'on':'off'}>{lamp===null?'尚未执行':lamp?'灯亮':'灯灭'}</strong>{action&&<span>{!run?.value?'本次尚未执行':!run.ok?'本次运行未完成':action.request.inputs.actor==='mentor'?action.request.inputs.preparation?'林工准备':'林工示范':'本人执行'}{oldResult?' · 修改前记录':''}</span>}</aside>}
    {phase.startsWith('g3')&&<aside className="eq-intro-readings" inert={record.paused?true:undefined} aria-hidden={record.paused?true:undefined}>
      <div className="eq-intro-region" data-needed="true" {...focusProps('environment')}><label>环境光照<input aria-label="入门练习环境光照" type="range" min="0" max="1023" value={record.environment} disabled={stopped||busy||mentor} onChange={e=>save({environment:Number(e.target.value),feedback:null})}/><input aria-label="环境光照数值" type="number" min="0" max="1023" value={record.environment} disabled={stopped||busy||mentor} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=1023)void save({environment:n,feedback:null});}}/></label><button type="button" disabled={stopped||busy||mentor} onClick={()=>save({environment:record.environment<450?820:170,feedback:null})}>{record.environment<450?'移开遮挡':'遮住光源'}</button></div>
      <button type="button" className="eq-intro-sample eq-intro-region" data-needed="true" {...focusProps('sample')} disabled={stopped||mentor||record.phase==='g3-transfer-success'} onClick={()=>record.phase==='g3-success'?save({sampleSelection:true,feedback:null}):save({phase:'g3-error',operationPhase:phase,feedback:{message:record.environment!==lastRead?.value?'环境变了，这里仍是上次采样；还没有新的读取事件。接好后，从底部执行读取。':'这是上次执行留下的结果。换个环境，再主动读取一次。',target:'primary'}})}><small>{record.phase==='g3-success'?'本次实际读取 · 点此指认':'上次实际读到'}</small><strong data-intro-sample>{lastRead?.value??'还没有'}</strong>{lastRead&&<span>LIGHT · 本次运行内 {lastRead.atMs} ms</span>}</button>
      <p className="eq-intro-lamp-inline">灯{lamp===true?'亮':lamp===false?'灭':'尚未执行'} · 保留上次输出</p>
    </aside>}
    <section inert={record.paused?true:undefined} aria-hidden={record.paused?true:undefined} className="eq-intro-events eq-intro-region" {...focusProps('events')} hidden={!showEvents||!meaningfulEvents.length}>
      <header><span>真实运行轨迹回放 · {record.replay.atMs} ms{oldResult?' · 修改前':''}</span><div><button type="button" disabled={stopped||!run?.value} onClick={()=>save({replay:{...record.replay,playing:!record.replay.playing}})}>{record.replay.playing?'暂停回放':'播放回放'}</button><button type="button" disabled={stopped||!run?.value} onClick={()=>{const next=meaningfulEvents.find(e=>e.atMs>record.replay.atMs);void save({replay:{atMs:next?.atMs??0,playing:false}});}}>回看下一时刻</button></div></header>
      <div>{meaningfulEvents.map((e,i)=><button type="button" key={i} aria-pressed={record.replay.atMs===e.atMs} disabled={stopped} onClick={()=>save({replay:{atMs:e.atMs,playing:false},...(record.phase==='g2-success-hold'&&e.kind==='wait'&&e.durationMs>0?{waitObserved:true,feedback:null}:{})})}>{e.atMs}ms {e.kind==='write'?e.value?'开灯':'关灯':e.kind==='read'?`读到${e.value}`:e.kind==='wait'?`等待${e.durationMs}ms`:'等待结束'}</button>)}</div>
    </section>
    <button inert={record.paused?true:undefined} aria-hidden={record.paused?true:undefined} type="button" className="eq-intro-source" onClick={()=>setSourceOpen(true)}>这段练习是怎样准备的？</button>
    <footer className="eq-intro-dialogue" inert={record.paused?true:undefined} aria-hidden={record.paused?true:undefined}><div className="eq-intro-speech"><b>林工</b><p role="status">{record.feedback?.message??currentStep.line}</p>{record.lastPrediction!==null&&record.lastPrediction!==undefined&&(record.phase.includes('success')||record.phase.endsWith('-demo')||independentOnDone)&&<small>刚才预测{record.lastPrediction?'亮':'灭'}；这段记录末尾为{run?.value?.simulation?.events.at(-1)?.outputs.LAMP?'亮':'灭'}。当前回放 {record.replay.atMs} ms。</small>}{progress.error&&<p role="alert">{progress.error}<button onClick={()=>progress.retry().catch(()=>{})}>重试保存</button></p>}</div>
      <div className="eq-intro-primary eq-intro-region" {...focusProps('primary')}><button type="button" data-intro-primary disabled={blocked||record.paused||suspended||sourceOpen||helpOpen} onClick={()=>record.phase==='complete'?(review?onCloseReview?.():onExit?.('blocks')):primary()}>{busy?'正在执行并保存…':actionLabel}</button><button type="button" className="eq-intro-help" onClick={()=>{setHelpOpen(true);void save({hints:[...record.hints,{phase:record.phase,at:new Date().toISOString()}]});}}>林工，我卡在这里</button></div>
    </footer>
    {record.paused&&<div className="eq-intro-pause" role="region" aria-label="教学已暂停"><h3>先停在这一步。</h3><p>积木、环境和回放位置都留着。</p><button type="button" onClick={()=>save({paused:false})}>继续这一步</button><button type="button" onClick={onExit}>返回研发室</button></div>}
    {sourceOpen&&<Dialog title="这段练习的准备" onClose={()=>setSourceOpen(false)}><p>入口和持续执行中的安全等待由林工预先备好。画面里的积木由你选择和连接，运行时会放回这份完整程序。</p>{kind==='reading'&&<p>观察值位背后的记录位置也已备好。这次只接读取块，先看它真正读到什么。</p>}<p>林工示范、本人的操作和再次独立练习分别保存。</p>{run?.value&&<details><summary>查看这次完整准备程序</summary><pre>{context.shortSource(run.value.program).value?.source}</pre></details>}</Dialog>}
    {helpOpen&&<Dialog title="一起看眼前这一步" onClose={()=>setHelpOpen(false)}><p>{record.feedback?.message??currentStep.line}</p><p>{kind==='reading'?'读取块给出一个数字，要接进观察值位。改环境不会自动取得新数。':'抓取积木的实心边缘，移近目标凹口，看连接预览再松手。也可以先选择积木和目标，再确认放入。'}</p><button type="button" onClick={()=>{setHelpOpen(false);onManual?.(kind==='reading'?'P09':'P07');}}>一起翻本步图解</button></Dialog>}
  </section>;
}
