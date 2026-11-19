import React,{useState,useEffect,useRef} from 'react';
import {inspectProgramWorkspace,explainProgramDiagnostic,createProgramLearningMap,blocksToProgram,getProgramPracticeCriterion,explainProgramPracticeResult} from '../program/index.js';
import {ActionButton} from '../ui/index.js';
import {RequirementPractice} from './RequirementPractice.jsx';
import './learning-practice.css';
import {MentorConversation} from './MentorConversation.jsx';
import {mentorScene} from './mentor-scenes.js';
import {previousPracticeActions} from './practice-presentation.js';
import {firstFailure} from '../tutorial/index.js';
import {guidedOutputComplete,readingGuidance,experiencedFact} from './work-guidance.js';
import {PracticeCriterion,PracticeObservationDiagnostic} from './PracticeObservationDiagnostic.jsx';
import {observationIsCurrent} from './observation-model.js';

const hints={
  'read-input':['在「变量与流程」放一个「程序入口」。在变量区声明 light，类型为整数，初值接数字 0。','在「持续执行」放「变量 light 设为」，把「读取模拟输入 LIGHT」接到值槽。','尾部接「等待」，毫秒数接 100。这里只观察读取，不需要先搭完整自动灯。'],
  'branch-output':['保留读取，在读取后、等待前加入「如果／否则」。','把「输入与判断」里的比较接进条件：左边取变量 light，比较符为 <，右边接 450，或取你已声明为 450 的 threshold。','暗时需要照明。为两个分支各放一个 LAMP 输出，分别接你判断的布尔值，再分别运行暗、亮观察。'],
  'repeat-read':['读取、判断和输出都要在「持续执行」中。放在「启动时」的读取只做一次。','先用每轮等待 100 毫秒。观察三个 100 毫秒窗口中的新读数和实际输出。'],
  'base-delivery':['现在运行固定客户场景。失败时先选中失败场景，比较客户期望与实际输出。','只改你定位到的那一部分，再复测；客户预期不会跟着你的程序改变。'],
  'code-mapping':['下面的映射来自你保留的积木。点选你认为决定明暗边界的节点。','对照它生成的代码，再修改自己的确切文本。变量、比较、分支和输出各自承担不同工作。'],
  'change-delivery':['先预测 500 与 600 的输出，再修改自己的代码。','运行新版客户测试，保留失败和修正记录；旧基础报告不能证明变更完成。'],
};

/** A's real runtime/map facts are produced through the controller, never from UI flags. */
export function ProgramPractice({workspace,state,phase='blocks',onNavigate,onOpenManual,guided=false}){
  const panel=useRef(null);
  const [light,setLight]=useState(150),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(null);
  const learning=state.facts.learning,presentation=state.facts.practice?.[phase],current=presentation?.current??learning?.current,id=guided&&phase==='blocks'&&!state.facts.baseReady&&!experiencedFact(state,'current_input_read_observed')&&!guidedOutputComplete(state)?'observe-output':current?.id;
  const saved=state.attempt?.draft.blockState,blocks=saved?.workspace??saved;
  const inspection=inspectProgramWorkspace(blocks,{activityId:id}),parsed=blocksToProgram(blocks);
  if(guided&&id==='read-input')inspection.guidance={...inspection.guidance,...readingGuidance(blocks)};
  const missingWait=phase==='blocks'&&id!=='observe-output'&&inspection.canRun&&!inspection.observations.some(item=>item.id==='wait'&&item.observed);
  const mapping=phase==='short-cpp'&&parsed.ok?createProgramLearningMap(parsed.value,{blockState:blocks}):null;
  const rememberedMapping=state.attempt?.learningActions.findLast(a=>a.kind==='program-action'&&a.request?.actionId==='code-mapping'&&a.result?.observations?.length);
  useEffect(()=>{if(guided&&rememberedMapping){const link=mapping?.value?.links.find(l=>l.nodeId===rememberedMapping.request.inputs.nodeId);if(link)setSelected(link);}},[rememberedMapping?.id,guided]);
  const last=state.attempt?.learningActions.findLast(a=>a.kind==='program-action'&&a.request?.actionId!=='graphic-intro-run');
  const result=last?.result,value=result?.value,simulation=value?.simulation;
  const runtimeHelp=(simulation?.diagnostics??result?.diagnostics??[]).map(d=>explainProgramDiagnostic(d,{blockState:blocks}));
  const lastOutput=simulation?.events.at(-1)?.outputs.LAMP;
  const disabled=busy||state.facts.pending;
  const criterion=phase==='blocks'&&(id==='repeat-read'||learning?.readyForBaseTests||state.facts.baseReady||presentation?.rechecks.some(row=>row.id==='repeat-read'))?getProgramPracticeCriterion('repeat-read'):null;
  const diagnosis=phase==='blocks'?explainProgramPracticeResult(last):null;
  const diagnosisCurrent=!!last&&observationIsCurrent(last,{program:parsed,source:state.attempt?.draft.shortSource,wiring:state.attempt?.draft.wiring});
  const coreScene=mentorScene({state,phase,activityId:guided?id:undefined});
  const needsExplanation=diagnosis&&diagnosisCurrent&&result?.observations?.length===0;
  useEffect(()=>{
    if(!needsExplanation)return;
    const frame=requestAnimationFrame(()=>{
      const feedback=panel.current?.querySelector('[data-window-matched="false"]')??panel.current?.querySelector('.eq-practice-diagnostic');
      feedback?.scrollIntoView({block:'nearest',behavior:'auto'});
    });
    return()=>cancelAnimationFrame(frame);
  },[last?.id,!!needsExplanation]);
  const scene=needsExplanation?{...coreScene,id:`${coreScene.id}:${last.id}`,lines:[diagnosis.summary,diagnosis.nextAction],help:[diagnosis.windows.find(row=>row.readObserved!==true||row.outputMatches!==true)?.explanation,diagnosis.nextAction].filter(Boolean).join(' '),why:diagnosis.customerCheck.message,working:'好，你来改最怀疑的那一处。旧记录留着，改好再试这段变化。'}:coreScene;
  const manualSection=guided&&id==='observe-output'?'03.1':current?.actionTarget?.manualSection;
  const baseFailure=state.facts.baseCurrent&&!state.facts.baseReport?.passed?firstFailure(state.facts.baseReport):null;
  async function run(actionId,inputs){
    if(disabled)return;setBusy(true);setError('');
    try{await workspace.performLearningAction({phase,actionId,inputs});}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function test(){setBusy(true);setError('');try{await workspace.runTests(phase);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function recheck(row){
    if(disabled)return;setBusy(true);setError('');
    try{const actions=previousPracticeActions(state.attempt,row.id);if(!actions.length)throw new Error('这项需要回到原练习重新观察。');for(const request of actions){const result=await workspace.performLearningAction(request);if(!result.observations?.length)break;}}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const repeatAgain=phase==='blocks'&&id!=='repeat-read'&&(learning?.readyForBaseTests||state.facts.baseReady)&&<details className="eq-practice-repeat-again"><summary>重新观察当前作品</summary><PracticeCriterion criterion={criterion}/><ActionButton variant="paper" disabled={disabled||!inspection.canRun} onClick={()=>run('repeat-read',{})}>重新运行暗 → 亮 → 暗（当前作品）</ActionButton><p>这会实际执行当前积木，留下新记录；右侧的“重放”只回看已有轨迹。</p></details>;
  if(phase==='blocks'&&state.facts.baseReady)return <section className="eq-learning eq-program-practice" aria-label="当前编程练习" aria-busy={disabled}><MentorConversation scene={scene} onManual={onOpenManual} compact/><header><p className="eq-game-kicker">客户的第一封回信</p><h2>基础版已完成</h2><p>{state.facts.hasCode?'正在回看保留的基础积木。到简写 C++ 继续当前客户变更。':'基础情境、程序观察和固定客户测试均有当前记录。点上方“保留基础作品，查看代码变更”，继续自己的作品。'}</p></header><p>{state.facts.baseReport.cases.length} 个固定客户场景已通过。</p>{repeatAgain}<PracticeObservationDiagnostic key={last?.id} diagnostic={diagnosis} current={diagnosisCurrent}/><button type="button" onClick={()=>onNavigate?.('tests')}>查看客户测试详情 ↗</button><p>这里只核对本机软件过程；不代表真实板卡已经编译或验收。</p></section>;
  if(phase==='short-cpp'&&!state.facts.changeRequirements?.readyToAdvance)return guided?<section className="eq-learning eq-program-practice"><h2>客户的新来信还在桌上</h2><p>自己的代码已经保留。先和林工看这次想改变什么，再回到这一行。</p><button type="button" onClick={()=>onNavigate?.('mail')}>回到这封变更来信 →</button></section>:<RequirementPractice workspace={workspace} state={state} phase={phase} onNavigate={onNavigate} onOpenManual={onOpenManual}/>;
  return <section ref={panel} className="eq-learning eq-program-practice" aria-label="当前编程练习" aria-busy={disabled}>
    <header><p className="eq-game-kicker">正在一起做</p><h2>{guided&&id==='observe-output'?'亲手开一次，再亲手关一次':current?.title||'本次软件练习已记录'}</h2></header>
    {guided&&phase==='blocks'&&id!=='observe-output'&&!inspection.canRun&&<div className="eq-guided-next-piece"><p>{inspection.state==='empty'?'先从「变量与流程」拖一个程序入口。再看图解，接变量、读取和等待。':inspection.guidance.nextAction}</p><button type="button" onClick={()=>onOpenManual?.(current?.actionTarget?.manualSection??'07.1')}>看这一步的图解</button></div>}
    <div className="eq-practice-controls" aria-label="当前动手操作">
    {phase==='blocks'&&id==='observe-output'&&<><p>{guided?'你来按开或关，看看旁边灯的动作。然后，我们让它自己看环境。':'先做一个隔离的引导实验：你选择开或关，执行器实际写入虚拟 LAMP。它不会替你在积木中填入自动灯答案。'}</p><div className="eq-learning-actions"><ActionButton disabled={disabled} onClick={()=>run('observe-output',{on:true})}>让虚拟 LED 亮起来</ActionButton><ActionButton variant="paper" disabled={disabled} onClick={()=>run('observe-output',{on:false})}>让虚拟 LED 熄灭</ActionButton></div></>}
    {phase==='blocks'&&id==='read-input'&&<><label>本次虚拟光照：{light}<input aria-label="练习光照读数" type="range" min="0" max="1023" value={light} onChange={e=>setLight(Number(e.target.value))}/></label><div className="eq-learning-actions"><ActionButton disabled={disabled||!inspection.canRun} onClick={()=>run('read-input',{light})}>运行一次，查看实际读取</ActionButton></div></>}
    {phase==='blocks'&&id==='branch-output'&&<div className="eq-learning-actions"><ActionButton disabled={disabled||!inspection.canRun} onClick={()=>run('branch-output',{scene:'dark'})}>观察暗场景 · 光照 150</ActionButton><ActionButton variant="paper" disabled={disabled||!inspection.canRun} onClick={()=>run('branch-output',{scene:'bright'})}>观察亮场景 · 光照 850</ActionButton></div>}
    {phase==='blocks'&&id==='repeat-read'&&<><PracticeCriterion criterion={criterion}/><div className="eq-learning-actions"><ActionButton disabled={disabled||!inspection.canRun} onClick={()=>run('repeat-read',{})}>运行暗 → 亮 → 暗，查看三次读取</ActionButton></div></>}
    {phase==='blocks'&&id==='base-delivery'&&<ActionButton disabled={disabled||!learning.readyForBaseTests} onClick={test}>运行当前基础客户测试</ActionButton>}
    {repeatAgain}
    {presentation?.needsRecheck&&<aside className="eq-practice-rechecks" role="status"><strong>还在这一步，用改好的作品再看看</strong><p>刚才改过作品。交付前，我们再看一遍下面这些变化。</p>{id!=='repeat-read'&&criterion&&<PracticeCriterion criterion={criterion}/>} {presentation.rechecks.map(row=>row.id==='code-mapping'?<p key={row.id}>在下面的本人积木映射中，再点选比较节点，查看对应代码。</p>:<button type="button" key={row.id} disabled={disabled||!inspection.canRun} onClick={()=>recheck(row)}>用当前作品复核：{row.title}</button>)}</aside>}
    </div>
    <div className="eq-practice-story">
    <MentorConversation scene={scene} onManual={onOpenManual} compact/>
    <PracticeObservationDiagnostic key={last?.id} diagnostic={diagnosis} current={diagnosisCurrent}/>
    {error&&<p role="alert" className="eq-learning-error">{error}</p>}
    {phase==='blocks'&&baseFailure&&<aside className="eq-learning-guidance"><h3>客户看到的第一个问题</h3><p>{baseFailure.name}：{baseFailure.diagnostic||`${baseFailure.atMs} ms 期望${baseFailure.expected?'亮':'灭'}，实际${baseFailure.actual===null?'没有有效输出':baseFailure.actual?'亮':'灭'}。`}</p><button type="button" onClick={()=>onNavigate?.('tests')}>一起看失败场景 ↗</button></aside>}
    {runtimeHelp.slice(0,2).map((help,i)=><aside className="eq-learning-guidance" role="status" key={i}><h3>上一次观察未完成：{help.title}</h3><p>{help.observation}</p><p>{help.nextAction}</p></aside>)}
    {current?.state==='stale'&&!presentation?.needsRecheck&&<div className="eq-learning-feedback" role="status"><p>这一步的旧观察保留了。用当前作品重新运行眼前的观察，再继续。</p></div>}
    {missingWait?<aside className="eq-learning-guidance"><h3>再接一个等待，让时间前进</h3><p>从「变量与流程」拖出等待，接在本轮动作后，毫秒数接 100。否则程序会在同一毫秒反复读取，直到达到步数上限。</p></aside>:phase==='blocks'&&id!=='observe-output'&&(!inspection.canRun||(inspection.guidance.focus?.blockType&&!(id==='read-input'&&inspection.guidance.focus.blockType==='eqp_write')))&&<aside className="eq-learning-guidance"><h3>{id==='read-input'&&['empty','needs_structure'].includes(inspection.state)?'先搭一个能读取的最小程序':inspection.guidance.title}</h3><p>{id==='read-input'&&['empty','needs_structure'].includes(inspection.state)?'这一步只需要变量、读取和等待，按下方步骤逐个连接。':inspection.guidance.nextAction}</p></aside>}
    {hints[id]&&<details key={id}><summary>这一步怎样搭 / 遇到困难时查看</summary><ol>{hints[id].map(hint=><li key={hint}>{hint}</li>)}</ol></details>}
    {phase==='short-cpp'&&mapping?.ok&&<details className="eq-learning-mapping" key={`mapping-${id}`} open={id==='code-mapping'||presentation?.rechecks.some(row=>row.id==='code-mapping')}><summary>我保留的积木 ↔ 生成代码</summary><p>点一个节点查看它的作用。找到决定边界的比较节点，再对照自己这份作品的代码。</p><div className="eq-learning-actions">{mapping.value.links.filter(link=>!['value','state'].includes(link.concept)).map(link=><button type="button" key={link.nodeId} disabled={disabled} aria-pressed={selected?.nodeId===link.nodeId} onClick={()=>{setSelected(link);if(link.concept==='comparison')run('code-mapping',{nodeId:link.nodeId});}}>{link.label}</button>)}</div></details>}
    {phase==='short-cpp'&&selected&&<aside className="eq-learning-scene"><h3>保留的基础积木 · {selected.label}</h3><p>下面是基础积木对应的代码。当前修改文本在“当前简写 C++”，两份作品分别保留。</p><p>{selected.meaning}</p><pre>{selected.code}</pre></aside>}
    {phase==='short-cpp'&&id==='change-delivery'&&<ActionButton disabled={disabled||state.facts.codeBaseCurrent===false||!learning.readyForChangeTests} onClick={test}>运行当前变更客户测试</ActionButton>}
    {phase==='short-cpp'&&current&&!['code-mapping','change-delivery'].includes(id)&&<div className="eq-learning-actions"><ActionButton variant="paper" onClick={()=>onNavigate?.('blocks')}>回到当前积木练习 →</ActionButton></div>}
    {last&&<details className="eq-learning-scene" aria-label="上一次实际操作"><summary>上一次实际操作 {typeof lastOutput==='boolean'?`· LED 实际${lastOutput?'亮':'灭'}`:''} · {result.observations.length?'有观察记录':'待排查'}</summary><p>{last.request.actionId==='observe-output'?'引导程序输出；未替换学生积木。':'使用当时保存的确切作品运行。'} {typeof lastOutput==='boolean'?`LED 实际${lastOutput?'亮':'灭'}。`:''}</p>
      {result.ok?<><p>{result.observations.length?'已记录本次实际观察。':diagnosis?.summary??'本次未取得该步所需观察，请对照下列实际事件排查。'}</p>{!diagnosis&&value.observation?.message&&<p>{value.observation.message}</p>}
        {simulation&&<div className="eq-learning-events"><table><caption>前 12 条实际读入、分支与写出事件</caption><thead><tr><th>时间</th><th>操作</th><th>读数 / 动作</th></tr></thead><tbody>{simulation.events.filter(e=>['read','branch','write'].includes(e.kind)).slice(0,12).map((e,i)=><tr key={i}><td>{e.atMs} ms</td><td>{{read:'读取',branch:'判断分支',write:'写入输出'}[e.kind]}</td><td>{e.port??''} {typeof e.value==='boolean'?(e.value?'true / 开':'false / 关'):e.value??e.branch??'按条件选择'}</td></tr>)}</tbody></table></div>}</>:<p role="status">{result.diagnostics?.map(d=>d.message).join('；')}</p>}
    </details>}
    {manualSection&&<button type="button" onClick={()=>onOpenManual?.(manualSection)}>查手册 §{manualSection} ↗</button>}
    <details><summary>当前版本的学习记录</summary><ul>{learning?.checkpoints?.map(row=><li key={row.id}>{row.title}：{{locked:'等待前一步',pending:'待实际观察',stale:'作品已改变，需复核',observed:'有当前观察记录'}[row.state]||row.state}</li>)}</ul><p>这些事实描述具体行为与过程，不自动判断理解程度。</p></details>
    </div>
  </section>;
}
