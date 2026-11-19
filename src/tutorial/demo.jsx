import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NpcTutorial} from './NpcTutorial.jsx';
import {activeLesson,LESSONS,tutorialFactsFromQuest} from './index.js';
import {WiringWorkbench} from '../hardware/WiringWorkbench.jsx';
import ProgramBlocks from '../integration/ProgramBlocks.jsx';
import {createHardwareContext,resolveHardwareManualSection} from '../integration/hardware-adapter.js';
import {createProgramContext} from '../integration/program-adapter.js';
import {canonicalJson,wiringSemantics} from '../contracts/index.js';
import {checkRequirementSelections,reviewStaticRequirements} from '../../content/npc.js';
import {autoLampOrder,npcQuestionCards,studentManual} from '../../content/index.js';
import '../ui/quest.css';
import './demo.css';

const DRAFT_KEY='eq.npc-tutorial.lab-draft.v1';
function readDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY))||{};}catch{return {};}}
function Boot(){
  const [contexts,setContexts]=useState(null),[error,setError]=useState('');
  useEffect(()=>{createHardwareContext().then(async hardware=>({hardware,context:await createProgramContext(hardware)})).then(setContexts).catch(e=>setError(e.message));},[]);
  return contexts?<Lab {...contexts}/>:<p role="status">{error||'正在准备本机首单联动验收…'}</p>;
}
function Lab({hardware,context}){
  const restored=useRef(readDraft()).current;
  const identity=useRef(null);if(!identity.current)identity.current=context.createSession('教程联动体验');
  const [claimed,setClaimed]=useState(!!restored.claimed),[card,setCard]=useState(restored.card||{}),[savedCard,setSavedCard]=useState(null);
  const [wiring,setWiring]=useState(()=>restored.wiring?.deviceProfileRef?.digest===hardware.ref.digest?restored.wiring:hardware.createDocument());
  const [blockState,setBlockState]=useState(restored.blockState||null),[program,setProgram]=useState(null),[blockError,setBlockError]=useState('从“变量与流程”放入程序入口。');
  const [source,setSource]=useState(restored.source||''),[applied,setApplied]=useState(null),[baseReport,setBaseReport]=useState(null),[codeReport,setCodeReport]=useState(null);
  const [stage,setStage]=useState('mail'),[notice,setNotice]=useState(restored.source?'恢复了草稿；测试和保存状态需要重新确认。':''),[pending,setPending]=useState(false),[light,setLight]=useState(150),[outputs,setOutputs]=useState(null);
  const [open,setOpen]=useState(true),[tutorialState,setTutorialState]=useState(null),[manual,setManual]=useState(null),[ledger,setLedger]=useState({income:0,events:[]}),[support,setSupport]=useState(restored.support||'manual');
  const [codeMode,setCodeMode]=useState(!!restored.source);
  const topology=hardware.validate(wiring),cardKey=canonicalJson(card),cardSaved=savedCard===cardKey;
  const dependencies=canonicalJson({card,wiring:wiringSemantics(wiring),blockState,source});
  const revision=useRef({key:dependencies,n:0});if(revision.current.key!==dependencies)revision.current={key:dependencies,n:revision.current.n+1};
  const baseKey=canonicalJson({revision:revision.current.n,program}),codeKey=canonicalJson({revision:revision.current.n,source,applied});
  const keys=useRef({baseKey,codeKey,cardKey});keys.current={baseKey,codeKey,cardKey};
  const baseCurrent=baseReport?.key===baseKey,codeCurrent=codeReport?.key===codeKey;
  const facts=tutorialFactsFromQuest({joined:true,claimed,cardSaved,card,topology,wiring,program,blockError,baseCurrent,baseReport,source,applied,codeCurrent,codeReport,ledger,pending});
  const lesson=activeLesson(facts),currentReport=codeMode?(codeCurrent?codeReport:null):(baseCurrent?baseReport:null);

  useEffect(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({claimed,card,wiring,blockState,source,support}));}catch{setNotice('本机草稿无法写入；当前会话仍可继续。');}},[claimed,card,wiring,blockState,source,support]);
  useEffect(()=>{
    let live=true;setOutputs(null);const target=codeMode?applied:program;
    if(target&&topology.ok)context.observe(target,wiring,light).then(result=>{if(live&&result.ok)setOutputs({lamp:result.value.events.at(-1)?.outputs.LAMP});});
    return()=>{live=false;};
  },[program,applied,codeMode,wiring,light]);
  useEffect(()=>{
    window.render_game_to_text=()=>JSON.stringify({mode:'npc-tutorial-real-adapters',stage,lesson,tutorial:tutorialState,claimed,cardSaved,wiring:{valid:topology.ok,connections:wiring.connections.length,errors:topology.diagnostics.filter(d=>d.severity==='error').map(d=>d.code)},programReady:!!program,support,baseCurrent,basePassed:baseCurrent&&!!baseReport?.passed,codeCurrent,codePassed:codeCurrent&&!!codeReport?.passed,income:ledger.income,light,lamp:outputs?.lamp??null,physical:'not-verified'});
    window.advanceTime=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    return()=>{delete window.render_game_to_text;delete window.advanceTime;};
  });
  function navigate(next){
    setManual(null);
    if(!claimed&&next!=='mail'){setStage('mail');setNotice('请先在邮箱领取订单。');return;}
    if(['wiring','blocks','code','tests'].includes(next)&&!cardSaved){setStage('requirements');setNotice('先保存当前中文方案；解释仍待教师核对。');return;}
    if(['blocks','code'].includes(next)&&!topology.ok){setStage('wiring');setNotice('当前接线需要修正。');return;}
    if(next==='code'&&!source){setStage('blocks');setNotice('先用当前积木通过基础测试，再保留快照生成对应代码。');return;}
    setStage(next);
  }
  function saveCard(){const checked=reviewStaticRequirements({requirementVersion:'1.0.0',card});if(!checked.coverage.readyForSubmission){setNotice(checked.question);return;}setSavedCard(cardKey);setNotice('当前方案已保存；固定选项覆盖完成，自由解释仍待教师核对。');}
  async function test(phase){
    if(pending)return;
    if(!cardSaved||!topology.ok)return setNotice('先保存当前方案并修复接线。');
    const key=phase==='code'?codeKey:baseKey;setPending(true);
    try{
      const target=phase==='code'?applied:program;
      if(!target)throw new Error(phase==='code'?'先解析并应用当前代码。':blockError);
      const generated=context.shortSource(target);if(!generated.ok)throw new Error(generated.diagnostics.map(d=>d.message).join('；'));
      const snapshot=await context.submit(identity.current,{phase:phase==='code'?'short-cpp':'blocks',program:target,wiring,source:phase==='code'?source:generated.value.source,requirementCard:card});
      const proof=await identity.current.lab.runTests(identity.current.session,snapshot.id);
      if((phase==='code'?keys.current.codeKey:keys.current.baseKey)!==key)return setNotice('运行期间作品已修改，结果已过期，请重新测试。');
      const report={...proof.report,key,proof,snapshot,shortSource:phase==='code'?source:generated.value.source};
      if(phase==='code')setCodeReport(report);else setBaseReport(report);
      setNotice(report.passed?'当前客户软件测试通过。可回来与林工讨论证据。':'客户测试有失败。回看具体预期与实际，或找林工讨论。');
    }catch(e){setNotice(e.message);}finally{setPending(false);}
  }
  function beginCode(){if(!baseCurrent||!baseReport?.passed||!cardSaved||!topology.ok)return;setSource(baseReport.shortSource);setApplied(null);setCodeMode(true);setStage('code');setNotice('已保留积木快照，进入客户变更 1.1.0。');}
  function applyCode(){const parsed=context.parse(source);setApplied(parsed.ok?parsed.value:null);setNotice(parsed.ok?'当前代码已解析并应用，请运行新版客户测试。':parsed.diagnostics.map(d=>d.message).join('；'));}
  function settle(){if(!codeCurrent||!codeReport?.passed||!cardSaved||!topology.ok)return;try{identity.current.lab.settleSoftwareDemo(identity.current.session,{evidenceId:codeReport.proof.id});setLedger(identity.current.lab.getLedger(identity.current.session));setNotice('本次会话合成软件收入已记录；重复请求不增发。');}catch(e){setNotice(e.message);}}
  function exportSource(){if(!codeCurrent||!codeReport?.passed)return;const generated=context.arduino(applied);if(!generated.ok)return;const url=URL.createObjectURL(new Blob([generated.value.source],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='EngineerQuest_tutorial_candidate.ino';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('已导出同一已测 IR 的候选源码。目标板编译、烧录和实物验收未执行。');}
  return <main className="eq-tutor-lab eq-ui">
    <header className="eq-lab-header"><a href="/">ENGINEER QUEST</a><span>林工 / 首单带教联动验收</span><small>独立接入样片 · 本机合成会话</small></header>
    <div className="eq-lab-objective"><div><span>当前目标</span><h1>{LESSONS[lesson].title}</h1><p>你的操作生成工程证据，林工根据证据继续带教。</p></div><NpcTutorial facts={facts} onNavigate={navigate} onOpenManual={setManual} open={open} onOpenChange={setOpen} onStateChange={setTutorialState}/></div>
    <nav className="eq-lab-tabs" aria-label="工程工具">{[['mail','订单'],['requirements','中文方案'],['wiring','接线'],['blocks','积木'],['code','代码'],['tests','测试证据']].map(([id,label])=><button type="button" key={id} aria-current={stage===id?'page':undefined} onClick={()=>navigate(id)}>{label}</button>)}</nav>
    {notice&&<p className="eq-lab-notice" role="status">{notice}</p>}
    <section className="eq-lab-work">
      {stage==='mail'&&<><p className="eq-lab-eyebrow">校园科技展台 / 委托 001</p><h2>给展台做一盏自动灯</h2><p>{autoLampOrder.customerMessage}</p><p>基础版约定：虚拟读数小于 450 开灯；等于或大于 450 关灯，变化后 200 毫秒内响应。</p>{!claimed?<button type="button" onClick={()=>{setClaimed(true);setNotice('订单已领取。和林工讨论方案，或打开中文方案工具。');}}>领取订单</button>:<button type="button" onClick={()=>navigate('requirements')}>打开中文方案</button>}</>}
      {stage==='requirements'&&<><h2>用中文说明你的方案</h2><div className="eq-lab-fields">{npcQuestionCards.fields.map(field=><label key={field.key}>{field.label}<select aria-label={field.label} value={card[field.key]||''} onChange={e=>setCard({...card,[field.key]:e.target.value})}><option value="">请选择</option>{field.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}</div><label className="eq-lab-label">用自己的话说明一次从暗到亮、再变暗的过程<textarea value={card.explanation||''} onChange={e=>setCard({...card,explanation:e.target.value})} rows={3} maxLength={1500}/></label><p>选项覆盖：{checkRequirementSelections(card).readyForSubmission?'已填写':'待补齐'}；自由解释没有在线 AI 评分。</p><button type="button" onClick={saveCard}>保存当前中文方案</button></>}
      {stage==='wiring'&&<><WiringWorkbench value={wiring} deviceProfile={hardware.profile} onChange={setWiring} lightValue={light} onLightChange={setLight} outputs={outputs} onOpenManual={section=>setManual(resolveHardwareManualSection(section))}/><p>先点两个端子建立连接；只有真实规则通过才可进入积木。实物保持断电，现场教师另行检查。</p></>}
      {/* Keep Blockly mounted across dialogue, manual and other tools to preserve drafts. */}
      {cardSaved&&<div hidden={stage!=='blocks'}><h2>搭建完整的自动灯</h2><ProgramBlocks initial={blockState?.workspace} deviceProfile={hardware.executionProfile} readOnly={codeMode} onChange={next=>{setProgram(next.program);setBlockError(next.error);setBlockState(previous=>canonicalJson(previous?.workspace??null)===canonicalJson(next.workspace??null)?previous:{workspace:next.workspace});if(next.support)setSupport(next.support);}}/><p>协助记录：{support==='teaching-example'?'已主动使用教学示例':'手动搭建'}。{blockError}</p><div className="eq-lab-actions"><button type="button" disabled={!program||!topology.ok||pending||codeMode} onClick={()=>test('blocks')}>运行基础客户测试</button><button type="button" disabled={!baseCurrent||!baseReport?.passed||!topology.ok} onClick={beginCode}>保存积木快照，查看代码变更</button>{codeMode&&<button type="button" onClick={()=>{setCodeMode(false);setNotice('编辑积木新版本，原代码仍保留；需要重新测试。');}}>编辑积木新版本</button>}</div>{baseReport&&<Results report={baseReport} current={baseCurrent}/>}</div>}
      {stage==='code'&&<><h2>客户变更 · 需求 1.1.0</h2><p>{autoLampOrder.codeChange.customerMessage}</p><label className="eq-lab-label">当前简写 C++<textarea className="eq-lab-code" rows={16} value={source} spellCheck={false} onChange={e=>{setSource(e.target.value);setApplied(null);}}/></label><div className="eq-lab-actions"><button type="button" onClick={applyCode}>解析并应用代码</button><button type="button" disabled={!applied||pending||!topology.ok} onClick={()=>test('code')}>运行变更客户测试</button><button type="button" disabled={!codeCurrent||!codeReport?.passed||!cardSaved||!topology.ok} onClick={exportSource}>导出候选 .ino</button><button type="button" disabled={!codeCurrent||!codeReport?.passed||!cardSaved||!topology.ok} onClick={settle}>请求合成软件收入</button></div>{codeReport&&<Results report={codeReport} current={codeCurrent}/>}</>}
      {stage==='tests'&&<><h2>当前软件证据</h2>{currentReport?<Results report={currentReport} current/>:<p>没有当前版本的完整测试结果。改线、方案、程序或文本后都需重新测试。</p>}</>}
    </section>
    <footer className="eq-lab-footer"><span>软件演示收入 <strong data-testid="tutorial-income">{ledger.income} EC</strong> · 本次会话 · 刷新清空</span><span>目标板编译 / 烧录 / 教师实物验收：未执行</span></footer>
    {manual&&<section className="eq-lab-manual" role="dialog" aria-modal="true" aria-label="手册引用" onKeyDown={e=>{if(e.key==='Escape')setManual(null);}}><h2>手册 §{manual}</h2>{studentManual.sections.filter(s=>s.id===manual).map(s=><div key={s.id}><h3>{s.title}</h3><p>{s.summary}</p></div>)}<p>当前仓库手册仍为章节草稿；正式手册由独立专项重做。此处不伪装成完整教程手册。</p><button type="button" autoFocus onClick={()=>setManual(null)}>返回原操作</button></section>}
  </main>;
}
function Results({report,current}){return <section className="eq-lab-results" aria-label="客户测试结果"><h3>{current?(report.passed?'当前软件测试通过':'当前软件测试有失败'):'历史结果 · 当前作品已改变'}</h3><p>仅软件 · 需求 {report.requirementRef?.version} · {report.snapshot?.id}</p><details><summary>查看实际预期与结果</summary>{report.cases.map(row=><div key={row.id||row.name}><strong>{row.name}</strong>{row.assertions?.map((a,i)=><p key={i}>{a.atMs}ms / 预期{a.expected?'亮':'灭'} / 实际{a.actual===null?'无有效输出':a.actual?'亮':'灭'} / {a.passed?'符合':'失败'}</p>)}</div>)}</details></section>;}
createRoot(document.getElementById('root')).render(<Boot/>);
