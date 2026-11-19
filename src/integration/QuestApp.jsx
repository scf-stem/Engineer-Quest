import React,{lazy,Suspense,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ActionButton,Dialog,Notice,WorkbenchFrame} from '../ui/index.js';
import {GameShell,MissionRoom,TutorialSlot} from './GameShell.jsx';
import {RequirementConsole} from './RequirementConsole.jsx';
import {ManualConsole} from './ManualConsole.jsx';
import {autoLampOrder,getCustomerSuite,getRequirement,npcQuestionCards,firstOrderExperienceCandidate} from '../../content/index.js';
import {WiringWorkbench} from '../hardware/WiringWorkbench.jsx';
import {canonicalJson} from '../contracts/index.js';
import {createHardwareContext,resolveHardwareManualSection} from './hardware-adapter.js';
import {createProgramContext} from './program-adapter.js';
import {openLocalWorkspace} from './local-workspace.js';
import {useWorkspaceDraft} from './useWorkspaceDraft.js';
import './quest-app.css';
import './game-shell.css';
import {ProgramObservation} from './ProgramObservation.jsx';
import {MentorConversation} from './MentorConversation.jsx';
import {mentorScene} from './mentor-scenes.js';
import {DeliveryReceipt} from './DeliveryReceipt.jsx';
import {buildIdentity} from './CandidateStamp.jsx';
import {currentStoryScene,pendingStoryResult,currentWorkTool,introducedTools,lockedToolReason,JOURNEY_VERSION,FIRST_ORDER_SCENES} from './first-order-story.js';
import {StoryDirector} from './StoryDirector.jsx';
import {StoryResult} from './StoryResult.jsx';
import {wiringIsReview} from './work-guidance.js';
import {requirementStageHandoffPending} from './requirement-stage-display.js';
import {graphicIntroFor,graphicIntroPending,stepFor} from '../program-teaching/progression.js';

const ProgramBlocks=lazy(()=>import('./ProgramBlocks.jsx'));
const ProgramTeaching=lazy(()=>import('../program-teaching/ProgramTeaching.jsx'));
const TABS=[{id:'wiring',label:'01 虚拟接线'},{id:'blocks',label:'02 积木 Demo'},{id:'code',label:'03 代码变更'},{id:'tests',label:'04 客户测试'}];
const task={title:firstOrderExperienceCandidate.titleCandidate+'委托',client:autoLampOrder.setting.customer,description:autoLampOrder.customerMessage};
function CompatibilityManual(props){return <div className="eq-game-manual-fallback"><Notice tone="warm">兼容版阅读指南：正式全文尚未接入，此页不代表新版工程手册已验收。</Notice><ManualConsole {...props}/></div>;}
const defaultOpenWorkspace=context=>openLocalWorkspace({programContext:context});
const storageReady=status=>['saved','restored','empty'].includes(status);
const storageLabels={empty:'尚未建立本机档案',saved:'本机已保存',restored:'已恢复本机档案',saving:'正在保存',unsaved:'本页修改尚未保存','external-change':'另一页面已有新版本'};

/** E injects the production policies and practice components at the root. */
export default function QuestApp({createContext=createProgramContext,openWorkspace=defaultOpenWorkspace,TutorialComponent,ManualComponent=CompatibilityManual,RequirementPracticeComponent,ProgramPracticeComponent,employeeControls,enableStory=false}){
  const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let disposed=false,controller;
    setLoaded(null);setError('');
    (async()=>{
      const hardware=await createHardwareContext(),context=await createContext(hardware);
      controller=await openWorkspace(context);
      if(!controller?.getState||!controller.subscribe)throw new Error('本机工位控制器不可用，原记录不会覆盖。');
      if(disposed){await controller.close?.();return;}
      setLoaded({hardware,context,controller});
    })().catch(error=>{if(!disposed)setError(error.message);});
    return()=>{disposed=true;void controller?.close?.();};
  },[createContext,openWorkspace,retry]);
  if(!loaded)return <div className="eq-ui eq-app-loading" role="status"><h1>本机研发工位</h1><p>{error||'正在读取并核对本机作品与测试证据…'}</p>{error&&<><p>原记录保留，不会自动创建空档案或覆盖已有身份。</p><ActionButton onClick={()=>setRetry(n=>n+1)}>重试读取本机工位</ActionButton></>}</div>;
  return <PersonalQuest {...loaded} enableStory={enableStory} employeeControls={employeeControls} TutorialComponent={TutorialComponent} ManualComponent={ManualComponent} RequirementPracticeComponent={RequirementPracticeComponent} ProgramPracticeComponent={ProgramPracticeComponent}/>;
}

function PersonalQuest({controller,...props}){
  const state=useSyncExternalStore(controller.subscribe,controller.getState,controller.getState);
  return <WorkspaceGame key={state.activeAttemptId||'new-workspace'} {...props} workspace={controller} state={state}/>;
}

function goalFor(state){
  const map={
    onboarding:['personal-entry','领取我的本机员工证','领取会建立新工位。同名不会找回旧作品；已有作品请返回员工选择。'],
    'claim-order':['claim-order','领取校园自动灯委托','打开通信终端领取当前订单。'],
    requirements:['read-order-and-save-card','完成当前需求情境练习','在委托档案回应当前情境；旧方案卡与自由文字不会自动授予通过。'],
    wiring:['connect-hardware','连接输入与输出，检查接线','查阅当前虚拟候选模型，依据诊断连接端子。'],
    blocks:['build-and-test','逐步观察程序，再运行客户测试','完成当前编程学习动作，组合自己的程序并检查结果。'],
    'customer-change':['preserve-and-change','保留基础作品，查看客户变更','基础作品与学习证据已就绪，可以从自己的积木生成简写代码。'],
    'change-review':['change-requirements','回应客户的新要求','到委托档案完成变更情境，再修改自己的代码。'],
    'short-cpp':['customer-change','修改代码并核对新版测试','完成当前代码学习动作，比较客户期望与实际输出。'],
    'software-income':['software-income','记录本机合成软件收入','当前变更作品与学习证据已就绪，明确请求本机合成入账。'],
    'software-complete':['review-software','回看本机作品与测试证据','收入已记录。可以回看作品、继续旧订单或保留历史重开；实物仍待教师验收。'],
  };
  const [id,title,detail]=map[state.stage]||map.requirements;
  const current=['blocks','short-cpp'].includes(state.stage)?state.facts.practice?.[state.stage]?.current??state.facts.learning?.current:null;
  if(current)return {id,title:current.title,detail:state.facts.guidance?.diagnostic?.message||current.goal,status:'in_progress'};
  return {id,title,detail:state.facts.guidance?.diagnostic?.message||detail,status:'in_progress'};
}

function WorkspaceGame({hardware,context,workspace,state,TutorialComponent,ManualComponent,RequirementPracticeComponent,ProgramPracticeComponent,employeeControls,enableStory}){
  const facts=state.facts,joined=!!state.learner,attempt=state.attempt,goal=goalFor(state);
  const journey=attempt?.presentation?.journey,storyEnabled=enableStory&&journey?.version===JOURNEY_VERSION,storyScene=storyEnabled?currentStoryScene(state):null,availableTools=introducedTools(state);
  const resultHandoff=storyEnabled?pendingStoryResult(state):null;
  const intro=graphicIntroFor(state),introPending=storyEnabled&&graphicIntroPending(state);
  const [introReview,setIntroReview]=useState(false);
  if(storyEnabled){goal.detail=({onboarding:'跟林工一起接第一份工作。','claim-order':'打开客户刚寄来的信，收下这份委托。',requirements:'动一动客户桌面的光照，决定灯怎样回应。',wiring:'先接当前这一组端子。林工会跟着实际连线往下带。',blocks:'看眼前的一个变化，再改自己的积木。','customer-change':'留下自己的基础作品，接着看客户的新来信。','change-review':'把500放到新旧边界之间，再回自己的作品找比较。','short-cpp':'改自己比较中的边界，再把这版带给客户试。','software-income':'把已检查的这版软件演示交给客户。','software-complete':'回看自己的作品，留下一处真正修过的地方。'})[state.stage]??goal.detail;}
  if(storyEnabled&&state.stage==='blocks'&&!wiringIsReview(state))goal.title=introPending?'跟林工做眼前这一小步':'亲手让灯亮起，再亲手关掉';
  if(introPending&&facts.wiringValid){const current=stepFor(intro);goal.id=`graphic-intro-${intro.phase}`;goal.title=current.title;goal.detail=current.line;}
  if(resultHandoff){goal.id=`result-${resultHandoff.id}`;goal.title=resultHandoff.title;goal.detail='先回到这份结果，查看记录后明确继续。';}
  useEffect(()=>{employeeControls?.onLearner(state.learner);},[state.learner?.id,state.learner?.nickname,employeeControls?.onLearner]);
  const [nickname,setNickname]=useState(state.learner?.nickname||''),[notice,setNotice]=useState(joined?'本机工位已就绪。可继续当前作品，或在本地工位中选择旧订单。':''),[busy,setBusy]=useState(false);
  const presentation=attempt?.presentation||{view:'desk',tool:'wiring'};
  const [view,setView]=useState(presentation.view||'desk'),[tool,setTool]=useState(presentation.tool||'wiring');
  const [visitedTools,setVisitedTools]=useState(presentation.view==='workbench'?[presentation.tool||'wiring']:[]);
  const [dialog,setDialog]=useState(null),[light,setLight]=useState(150),[observed,setObserved]=useState(null),[eventIndex,setEventIndex]=useState(0),[exportManifest,setExportManifest]=useState(null);
  const [reviewPhase,setReviewPhase]=useState(attempt?.change?'short-cpp':'blocks');
  const [readOnlyBlocks,setReadOnlyBlocks]=useState(!!attempt?.change),[reduceMotion,setReduceMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tutorialOrigin=useRef(null),commandBusy=useRef(false);
  const reportError=error=>setNotice(`${error.code?error.code+'：':''}${error.message}`);
  const buffer=useWorkspaceDraft(workspace,state,reportError);
  const draft=buffer.draft||{requirementCard:{},wiring:hardware.createDocument(),blockState:null,shortSource:'',support:{kind:'manual'}};
  const source=draft.shortSource,card=draft.requirementCard,wiring=draft.wiring;
  const topology=hardware.validate(wiring),blocked=!storageReady(state.storage.status)&&state.storage.status!=='saving',pending=busy||buffer.pending||!!facts.pending;
  const codeVersion=!!attempt?.change,activeTestPhase=codeVersion&&facts.baseReady?'short-cpp':'blocks',phase=tool==='code'?'short-cpp':'blocks',requirementVersion=view==='mail'?(reviewPhase==='short-cpp'?'1.1.0':'1.0.0'):['blocks','wiring'].includes(tool)?'1.0.0':tool==='tests'?(activeTestPhase==='short-cpp'?'1.1.0':'1.0.0'):codeVersion?'1.1.0':'1.0.0',requirement=getRequirement(requirementVersion);
  const baseCurrent=!!facts.baseCurrent,codeCurrent=!!facts.codeCurrent;
  function displayReport(proof){if(!proof)return null;return {...proof.report,proof,snapshot:attempt.snapshots.find(s=>s.id===proof.snapshotId)};}
  const baseReport=displayReport(facts.baseEvidence),codeReport=displayReport(facts.codeEvidence),report=activeTestPhase==='short-cpp'?codeReport:baseReport;
  const historical=attempt?.tests.map(displayReport)||[];
  const simulation=report?.simulations?Object.values(report.simulations)[0]:null,event=simulation?.events[Math.min(eventIndex,simulation.events.length-1)];
  const active=view==='workbench'?tool:view;
  useEffect(()=>{document.querySelector('.eq-game-window-content')?.scrollTo({top:0});},[active]);
  const manualSection=!joined?'01.1':view==='mail'?(reviewPhase==='short-cpp'?'02.2':'02.1'):view==='income'?'10.1':view==='desk'?(state.stage==='software-complete'?'10.1':'02.1'):tool==='wiring'?'06.1':tool==='blocks'?'07.1':tool==='code'?'08.1':'09.1';
  const requirementReview=reviewPhase==='short-cpp'?facts.changeRequirements:facts.requirements;
  const income=state.ledger;
  useEffect(()=>{setExportManifest(null);},[source]);
  useEffect(()=>{
    let active=true;setObserved(null);
    const parsed=codeVersion?context.parse(source):context.fromBlocks(draft.blockState);
    if(parsed.ok&&topology.ok)context.observe(parsed.value,wiring,light).then(run=>{if(active&&run.ok&&run.value.status==='completed')setObserved({lamp:run.value.events.at(-1).outputs.LAMP});}).catch(()=>{});
    return()=>{active=false;};
  },[draft.blockState,source,wiring,light,codeVersion]);

  async function command(action,message){
    if(commandBusy.current)return false;
    commandBusy.current=true;setBusy(true);
    try{await buffer.flush();const result=await action();if(result?.ok===false){setNotice(result.diagnostics?.map(d=>d.message).join('；')||'当前操作尚未完成。');return false;}if(message)setNotice(typeof message==='function'?message(result):message);return result??true;}
    catch(error){reportError(error);return false;}finally{commandBusy.current=false;setBusy(false);}
  }
  async function navigateGame(next,intent){
    if(['blocks','short-cpp'].includes(intent?.phase))setReviewPhase(intent.phase);
    next=({requirements:'mail','short-code':'code','short-cpp':'code',onboarding:'desk','change-review':'mail'})[next]||next;
    if(next==='hardware'){setDialog('hardware');return true;}
    if(!['desk','mail','income',...TABS.map(t=>t.id)].includes(next)){setNotice('没有可用的工具入口。');return false;}
    const current=workspace.getState(),f=current.facts;
    if(storyEnabled&&!introducedTools(current).includes(next)){setNotice(lockedToolReason[next]||'我们先完成眼前这一小步。');return false;}
    if(!current.learner&&next!=='desk'){setNotice('先领取本机个人员工证。');return false;}
    if(['wiring','blocks','code'].includes(next)){
      if(f.pending){setNotice('请先解决本机保存状态，再继续工程操作。');return false;}
      if(!f.claimed||f.requirements?.readyToAdvance!==true){next='mail';setReviewPhase('blocks');setNotice('先和林工把眼前的桌面看明白，再一起去工位。');}
      else if((next==='blocks'||next==='code')&&!f.wiringValid){next='wiring';setNotice('先修复当前虚拟接线。');}
      else if(next==='code'&&!f.hasCode){next='blocks';setNotice('先完成基础作品和学习，再保留自己的积木快照。');}
    }
    const nextView=TABS.some(t=>t.id===next)?'workbench':next,nextTool=TABS.some(t=>t.id===next)?next:tool;
    if(current.learner&&!blocked){try{await buffer.flush();await workspace.savePresentation({view:nextView,tool:nextTool,...(intent?{tutorial:JSON.parse(JSON.stringify(intent))}:{})});}catch(error){reportError(error);return false;}}
    if(nextView==='workbench')setVisitedTools(items=>items.includes(nextTool)?items:[...items,nextTool]);
    setTool(nextTool);setView(nextView);return true;
  }
  function closeDialog(){setDialog(null);const original=tutorialOrigin.current;tutorialOrigin.current=null;if(original)requestAnimationFrame(()=>original.isConnected&&original.focus({preventScroll:true}));}
  function showTutorial(){tutorialOrigin.current=document.activeElement;setDialog('tutorial');}
  function showManual(section=manualSection){setDialog({type:'manual',section});}
  async function advanceStory(scene,line,last){
    const replay=journey.replay;
    const patch=replay?(last?{replay:false,replayLine:0}:{replayLine:line+1}):last?{seen:{[scene.id]:true},sceneId:null,line:0,paused:false}:{sceneId:scene.id,line:line+1};
    if(!await command(()=>workspace.saveJourney(patch)))return;
    if(!last||replay)return;
    if(scene.workAction==='prepare-change'){await beginCode();await navigateGame('mail');}
    else if(scene.workAction==='settle')await settleIncome();
    else await navigateGame(scene.target);
  }
  async function continueResult(){
    await command(async()=>{
      const current=pendingStoryResult(workspace.getState());
      if(!current||current.key!==resultHandoff?.key)throw new Error('这份结果已更新，先看看当前记录，再继续。');
      await workspace.saveJourney({resultContinued:{[current.id]:current.key},sceneId:null,line:0,paused:false});
    });
  }
  async function replayWelcome(){return command(()=>workspace.saveJourney({replay:true,replayLine:0,paused:false,...(!storyEnabled?{seen:Object.fromEntries(Object.keys(FIRST_ORDER_SCENES).map(id=>[id,true]))}:{})}));}
  async function leaveEmployee(){if(!employeeControls)return;await command(async()=>{return await employeeControls.onExit();});}
  async function beginCode(replaceCode=false){if(await command(()=>workspace.prepareCodeChange({replaceCode}),'已保留基础作品，客户变更与短代码已保存在本机。')){setReadOnlyBlocks(true);setReviewPhase('short-cpp');await navigateGame('code');}}
  async function runTests(testPhase){const result=await command(()=>workspace.runTests(testPhase),result=>result.proof.report.passed?'客户试过了，这版软件的场景都对上了。接着和林工看下一步。':'客户测试有失败，已保存这次失败记录。');if(result)setEventIndex(0);}
  async function settleIncome(){if(await command(()=>workspace.settleSoftwareIncome(),'客户已收到这版软件演示，合成收入已保存在本机。'))await navigateGame('income');}
  function downloadJson(value,name){const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function exportArchive(){try{const archive=await workspace.exportArchive();downloadJson({format:'eq.ui-local-backup/1',archive,bufferedAttemptId:state.activeAttemptId,bufferedDraft:buffer.getBuffered(),notice:'含本页尚未保存的输入；不是账号或实物验收。'},'EngineerQuest_local_backup.json');setNotice('已导出本机档案和本页输入备份。');return true;}catch(error){reportError(error);return false;}}
  async function recover(kind){if(commandBusy.current)return false;commandBusy.current=true;setBusy(true);try{if(kind==='retry')await buffer.retry();else{await workspace.reload();buffer.replace(workspace.getState().attempt?.draft??null);}setNotice(kind==='retry'?'本页输入已重新保存。':'已重新读取本机档案。');return true;}catch(error){reportError(error);return false;}finally{commandBusy.current=false;setBusy(false);}}
  async function exportSource(){await command(async()=>{
    const current=workspace.getState();if(!current.facts.codeReady||current.facts.pending)throw new Error('当前代码、需求理解、学习和客户测试证据尚未全部就绪。');
    const proof=current.facts.codeEvidence,snapshot=current.attempt.snapshots.find(s=>s.id===proof.snapshotId),generated=context.arduino(snapshot.binding.program);
    if(!generated.ok)return generated;
    const link=document.createElement('a'),url=URL.createObjectURL(new Blob([generated.value.source],{type:'text/plain;charset=utf-8'}));link.href=url;link.download='EngineerQuest_candidate.ino';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setExportManifest({snapshotId:snapshot.id,evidenceId:proof.id,sourceDigest:snapshot.sourceDigest});return true;
  },'已导出当前已测作品的候选 .ino；目标板编译、烧录和实物验收尚未执行。');}
  const workspaceMenu={storageStatus:storageLabels[state.storage.status]||state.storage.status,storageError:blocked?state.storage.message:null,progressLabel:`${state.learner?.nickname||'新员工'} / ${goal.title}`,pending:busy,attempts:state.attempts,
    onResume:async()=>{await workspace.continue();setNotice('继续当前本机工位。');return true;},
    onRestart:()=>command(()=>workspace.restartOrder({graphicIntro:enableStory}),'已保留旧作品与收入，建立新的空白订单。'),onResumeAttempt:id=>command(()=>workspace.resumeAttempt(id),'已继续所选本机作品。'),
    onExport:exportArchive,onRetry:()=>recover('retry'),onReload:()=>recover('reload'),onReplay:replayWelcome,onExit:employeeControls?leaveEmployee:null};
  const records=[
    ...(facts.requirements?.readyToAdvance?[{id:'requirements',title:'需求情境记录',state:'当前版本已就绪',action:'open_mail'}]:[]),
    ...(attempt?.tests.length?[{id:'tests',title:`已保存 ${attempt.tests.length} 次客户测试`,state:`${attempt.tests.filter(t=>t.report.passed).length} 次软件通过 / 保留失败与历史`,action:'open_tests'}]:[]),
    ...(income.events.length?[{id:'income',title:'本机合成收入',state:`${income.income} EC / 重开保留`,action:'open_income'}]:[])];
  const tutorialFacts={...facts,requirementReview:view==='mail'?requirementReview:codeVersion?facts.changeRequirements:facts.requirements,goal,nickname:state.learner?.nickname,requirementVersion,manualSection,pending:pending||facts.pending,baseReady:facts.baseReady===true&&!pending,codeReady:facts.codeReady===true&&!pending};
  useEffect(()=>{
      window.render_game_to_text=()=>{
        const element=[...document.querySelectorAll('.eq-requirement-stage')].find(node=>node.getClientRects().length&&!node.closest('[hidden]'));
        const value=element?.querySelector('[data-reading]')?.dataset.reading;
        const actualReview=active==='mail'?requirementReview:phase==='short-cpp'?facts.changeRequirements:facts.requirements;
        const requirementsScene=element?{checkpointId:element.dataset.checkpointId,validationCheckpointId:actualReview?.challenge?.checkpointId??null,reviewStatus:actualReview?.status,focus:element.dataset.focusTarget,intent:element.dataset.focusIntent,reading:value===undefined?null:Number(value),handoffPending:requirementStageHandoffPending(state,active==='mail'?reviewPhase:phase)}:null;
        return JSON.stringify({mode:'controller-bound-game',build:buildIdentity,view:active,stage:state.stage,storage:state.storage.status,learnerId:state.learner?.id,attemptId:state.activeAttemptId,dialog:typeof dialog==='object'?dialog?.type:dialog,story:storyEnabled?{scene:storyScene?.id,line:journey.line,paused:journey.paused,replay:journey.replay,availableTools}:null,requirementsScene,graphicIntro:intro?{phase:document.querySelector('.eq-graphic-intro')?.dataset.phase??intro.phase,paused:document.querySelector('.eq-graphic-intro')?.dataset.paused==='true',focus:document.querySelector('.eq-graphic-intro')?.dataset.focus??null,environment:intro.environment,runCount:intro.runIds.length}:null,resultHandoff:resultHandoff?{scene:resultHandoff.id,phase:resultHandoff.phase}:null,requirementsReady:facts.requirements?.readyToAdvance===true,practice:state.facts.practice?{teachingId:state.facts.practice[phase]?.current?.id,validationId:state.facts.practice[phase]?.validationCurrent?.id,rechecks:state.facts.practice[phase]?.rechecks.map(r=>r.id)}:null,baseReady:facts.baseReady===true,codeReady:facts.codeReady===true,pending,bufferPending:buffer.pending,controllerPending:facts.pending,wiring:{wires:wiring.connections.length,valid:topology.ok,storedWires:facts.connectionCount},source,tests:attempt?.tests.map(t=>({id:t.id,phase:t.phase,passed:t.report.passed,invalidReason:t.invalidReason})),income:income.income,coordinateSystem:'UI origin top-left, x right, y down'});
      };
    window.advanceTime=()=>{};return()=>{delete window.render_game_to_text;delete window.advanceTime;};
  });
  const practiceProps={workspace,state,guided:storyEnabled,phase:reviewPhase,focusSuspended:Boolean(dialog)||active!=='mail',onNavigate:navigateGame,onOpenManual:showManual};
  const resultView=resultHandoff?<StoryResult handoff={resultHandoff} state={state} pending={pending} onContinue={continueResult} onReview={()=>navigateGame('tests')}/>:null;
  const tutorialPanel=<TutorialSlot component={TutorialComponent} facts={tutorialFacts} onClose={closeDialog} onNavigate={async(next,metadata)=>{if(next==='requirements')setReviewPhase(codeVersion?'short-cpp':'blocks');if(await navigateGame(next,metadata))setDialog(null);}} onOpenManual={showManual}/>;
  const overlay=dialog==='tutorial'&&TutorialComponent?tutorialPanel:dialog&&<Dialog className={typeof dialog==='object'?'eq-game-modal eq-game-manual-modal':'eq-game-modal'} title={dialog==='help'?'课堂求助':dialog==='hardware'?'实物待验':dialog==='tutorial'?'林工 · 工作提示':dialog==='inspection'?'首单工具箱':dialog==='employee'?'员工菜单':'工程手册'} onClose={closeDialog}>
    {dialog==='employee'?<div className="eq-story-employee-menu"><h2>自己的员工工位</h2><p>重新看培训不会重做订单；重做订单会保留旧作品和收入。</p><ActionButton disabled={pending} onClick={async()=>{if(await replayWelcome())closeDialog();}}>重看入职培训</ActionButton><ActionButton variant="paper" disabled={pending} onClick={async()=>{if(await command(()=>workspace.restartOrder({graphicIntro:enableStory}),'旧作品和收入已保留。'))closeDialog();}}>保留作品重做本单</ActionButton>{employeeControls&&<ActionButton variant="paper" disabled={pending} onClick={leaveEmployee}>保存并返回员工选择</ActionButton>}<ActionButton variant="paper" disabled={pending} onClick={exportArchive}>导出我的本机档案</ActionButton></div>:typeof dialog==='object'?<ManualComponent state={state} guided={storyEnabled} initialSection={dialog.section} context={active} onNavigate={async next=>{if(await navigateGame(next))setDialog(null);}}/>:dialog==='tutorial'?tutorialPanel:dialog==='help'?<><p>保留当前作品、输入和失败现象，请现场教师一起检查。</p><Notice>这里只提供求助说明，没有发送消息。</Notice></>:dialog==='hardware'?<><p>断电接线 → 教师现场安全检查 → 目标板编译与上传 → 自测 → 教师功能验收。</p><Notice tone="warm">未编译、未烧录、未签核。网页证据不能代替实物安全检查。</Notice></>:<div className="eq-game-kit-grid">{firstOrderExperienceCandidate.inspectionCards.map(item=><section key={item.id}><h3>{item.title}</h3><p>{item.body}</p><ActionButton variant="paper" onClick={()=>showManual(item.manualSection)}>手册 §{item.manualSection} ↗</ActionButton></section>)}</div>}
  </Dialog>;
  const recovery=blocked&&<div className="eq-game-storage-alert" role="alert"><div><strong>{storageLabels[state.storage.status]||'本机保存需要处理'}</strong><p>{state.storage.message} 本页输入保留，工程通过与入账暂停。</p></div><button type="button" onClick={exportArchive}>导出本页备份</button><button type="button" disabled={busy||state.storage.status==='external-change'} onClick={()=>recover('retry')}>重试保存</button><button type="button" disabled={busy} onClick={()=>recover('reload')}>重新读取（放弃本页未保存修改）</button></div>;
  return <><div inert={storyEnabled&&storyScene&&!journey.paused&&!dialog?true:undefined}><GameShell storyEnabled={storyEnabled} availableTools={availableTools} onEmployee={()=>setDialog('employee')} joined={joined} nickname={state.learner?.nickname||nickname} active={active} goal={goal} income={income.income} notice={`${storageLabels[state.storage.status]||state.storage.status}${buffer.pending?' / 输入保存中':''} · ${notice||goal.detail}`} saveError={null} recovery={recovery}
    onNavigate={navigateGame} onManual={()=>showManual()} onTutorial={showTutorial} onHelp={()=>setDialog('help')} onHardware={()=>setDialog('hardware')} onClose={()=>navigateGame('desk')} reduceMotion={reduceMotion} onReduceMotion={setReduceMotion}
    room={joined?<MissionRoom availableTools={storyEnabled?availableTools:null} workTarget={storyEnabled?currentWorkTool(state):null} workspace={workspaceMenu} goal={goal} records={records} onNavigate={navigateGame} onManual={()=>showManual('02.1')} onTutorial={showTutorial} onInspect={()=>setDialog('inspection')}/>:null}>
    {!joined&&<section className="eq-game-entry"><p className="eq-game-kicker">WEIGUANG / LOCAL WORKSPACE</p>{employeeControls&&<button type="button" className="eq-game-link" disabled={pending} onClick={leaveEmployee}>返回员工选择，继续原作品</button>}<span className="eq-game-entry-number">EQ — 001</span><h1>研发部，<br/>你的工位已就绪。</h1><p>作品和测试保存在这个浏览器。<br/>昵称只作本机称呼，无真实账号与云同步。</p><label className="eq-live-label">员工昵称<input value={nickname} maxLength={24} placeholder="不需要真实姓名" onChange={e=>setNickname(e.target.value)}/></label><ActionButton disabled={!nickname.trim()||busy||blocked} onClick={()=>command(()=>workspace.start(nickname.trim(),{graphicIntro:enableStory}),'本机工位已建立。')}>领取本机个人员工证 →</ActionButton>{employeeControls&&<><p className="eq-fine-print">领取会建立新工位；输入相同昵称也不会找回旧作品。</p></>}<p className="eq-fine-print">基础材料免费 / 个人订单<br/>真实上电须由现场教师检查。</p></section>}
    {view==='mail'&&joined&&<>{codeVersion&&<div className="eq-game-review-phases"><button type="button" aria-pressed={reviewPhase==='blocks'} onClick={()=>setReviewPhase('blocks')}>基础需求 1.0.0</button>{codeVersion&&<button type="button" aria-pressed={reviewPhase==='short-cpp'} onClick={()=>setReviewPhase('short-cpp')}>客户变更 1.1.0</button>}</div>}<RequirementConsole task={task} requirement={getRequirement(reviewPhase==='short-cpp'?'1.1.0':'1.0.0')} claimed={facts.claimed} pending={pending} onClaim={()=>command(()=>workspace.claimOrder(),'已领取当前本机订单。')} fields={npcQuestionCards.fields} card={card} onChange={next=>buffer.edit({requirementCard:next})} onSave={()=>command(async()=>true,'旧方案草稿已保存；未完成需求情境，不开放后续工具。')} cardSaved={requirementReview?.readyToAdvance===true&&!pending} onWiring={()=>navigateGame('wiring')} onManual={showManual} onTutorial={showTutorial} practice={RequirementPracticeComponent?<RequirementPracticeComponent {...practiceProps}/>:null}/></>}
    {visitedTools.length>0&&joined&&<div className="eq-game-kept-tool" hidden={view!=='workbench'}><WorkbenchFrame tabs={storyEnabled?[]:TABS} activeTab={tool} onTabChange={navigateGame} status={`需求 ${requirementVersion}`}>
      <div className="eq-game-tool-mission"><p>{requirement.studentText}</p><button type="button" onClick={()=>showManual()}>相关手册 §{manualSection} ↗</button></div>
      {visitedTools.includes('wiring')&&<div hidden={tool!=='wiring'}><div className="eq-game-tool-actions"><span>点选两个端子接线 · Enter 选择 · Esc 取消</span><ActionButton disabled={!topology.ok||pending} onClick={()=>navigateGame(storyEnabled&&facts.hasCode?'code':'blocks')}>{storyEnabled?(facts.hasCode?'回到当前代码 →':introPending?'到程序台 →':'继续当前积木工作 →'):'进入积木编程 →'}</ActionButton></div><div className="eq-wiring-with-mentor"><MentorConversation scene={mentorScene({state,draft,tool:'wiring',topology})} onManual={showManual}/><div><WiringWorkbench resolveManualSection={resolveHardwareManualSection} guided={storyEnabled} completedMessage={storyEnabled&&wiringIsReview(state)?'线路与先前点灯都已做过了。这里是回看；改了连线后，再复核受影响的观察即可。':null} value={wiring} deviceProfile={hardware.profile} onChange={next=>buffer.edit({wiring:next})} lightValue={light} onLightChange={setLight} outputs={observed} onOpenManual={showManual}/></div></div></div>}
      {visitedTools.includes('blocks')&&<div hidden={tool!=='blocks'} className="eq-live-tool eq-game-program">{introPending||introReview?<Suspense fallback={<p role="status">正在打开入门练习…</p>}><ProgramTeaching key={state.activeAttemptId} workspace={workspace} state={state} context={context} visible={view==='workbench'&&tool==='blocks'} suspended={Boolean(dialog)||Boolean(storyScene&&!journey?.paused)} review={introReview} onCloseReview={()=>setIntroReview(false)} onManual={showManual} onExit={next=>next==='blocks'?setIntroReview(false):navigateGame('desk')}/></Suspense>:<><div className="eq-game-tool-actions">{intro&&<button type="button" onClick={()=>setIntroReview(true)}>回看开关与读取练习</button>}<span>本机作品 / 完整示例不替代学习</span><ActionButton disabled={!facts.programReady||!facts.wiringValid||!facts.requirements?.readyToAdvance||!facts.learning?.readyForBaseTests||pending} onClick={()=>runTests('blocks')}>运行基础客户测试</ActionButton><ActionButton variant="paper" disabled={!facts.baseReady||pending||!!resultHandoff} onClick={()=>beginCode()}>保留基础作品，查看代码变更 →</ActionButton></div>
        <div className="eq-game-program-workspace"><aside className="eq-game-practice-sidebar">{resultHandoff?.phase==='blocks'?resultView:ProgramPracticeComponent?<ProgramPracticeComponent guided={storyEnabled} workspace={workspace} state={state} phase="blocks" onNavigate={navigateGame} onOpenManual={showManual}/>:<Notice tone="warm">编程教学尚未接入；无法以完整示例或软件测试代替实际学习动作。</Notice>}</aside><div className="eq-game-block-editor">
        <Suspense fallback={<p role="status">正在打开 Blockly…</p>}><ProgramBlocks guided={storyEnabled} activityId={facts.practice?.blocks?.current?.id} initial={draft.blockState?.workspace??draft.blockState} workspaceState={draft.blockState&&Object.hasOwn(draft.blockState,'workspace')?draft.blockState.workspace:draft.blockState} deviceProfile={hardware.executionProfile} readOnly={readOnlyBlocks} allowFullExample={false} onChange={next=>{if(!next.origin||next.origin==='edit')buffer.edit({blockState:{workspace:next.workspace}});}}/></Suspense>
        {facts.programError&&<details className="eq-game-program-diagnostic"><summary>程序结构待补齐 · 技术详情</summary><p>{facts.programError}</p></details>}{readOnlyBlocks&&<ActionButton variant="paper" onClick={()=>setReadOnlyBlocks(false)}>编辑积木新版本（保留短代码）</ActionButton>}</div><aside className="eq-game-observation-rail"><ProgramObservation state={state} phase="blocks" reduceMotion={reduceMotion}/><p>先看当前读数、判断和灯。操作按钮留在左边，工具箱与画布各自滚动。</p></aside></div></>}</div>}
      {visitedTools.includes('code')&&<div hidden={tool!=='code'} className="eq-game-code-layout"><div className="eq-game-editor"><div className="eq-game-code-brief"><p className="eq-game-kicker">客户变更 / 1.1.0</p><button type="button" className="eq-game-link" onClick={()=>navigateGame('tests')}>打开完整客户测试台 ↗</button><p>{autoLampOrder.codeChange.customerMessage}</p>{facts.hasCode&&facts.codeBaseCurrent===false&&<aside className="eq-code-base-refresh" role="status"><strong>基础作品的回信已更新</strong><p>{!facts.baseReady?'先回到基础作品，完成当前观察和客户测试。当前代码仍保留。':facts.canKeepCodeOnBaseRefresh?'积木逻辑与原来相同。关联这次基础回信后，再测试你保留的代码。':'积木逻辑也改过了。请先查看这份新基础作品，再明确选择重新生成；原代码会留在历史。'}</p>{!facts.baseReady?<ActionButton variant="paper" onClick={()=>navigateGame('blocks')}>回到基础作品 →</ActionButton>:facts.canKeepCodeOnBaseRefresh?<ActionButton variant="paper" disabled={pending} onClick={()=>beginCode()}>关联这次基础回信，保留当前代码</ActionButton>:<ActionButton variant="paper" onClick={()=>navigateGame('blocks')}>查看当前基础作品 →</ActionButton>}</aside>}<button type="button" className="eq-game-link" onClick={()=>{setReviewPhase('short-cpp');navigateGame('mail');}}>查看变更情境练习 ↗</button></div>
        {resultHandoff?.phase==='short-cpp'?resultView:ProgramPracticeComponent?<ProgramPracticeComponent guided={storyEnabled} workspace={workspace} state={state} phase="short-cpp" onNavigate={navigateGame} onOpenManual={showManual}/>:<Notice tone="warm">代码学习练习尚未接入；不能授予交付就绪。</Notice>}
        <label className="eq-game-code-label">当前简写 C++<textarea aria-label="当前简写 C++" className="eq-live-code" value={source} spellCheck={false} onChange={e=>buffer.edit({shortSource:e.target.value})}/></label><div className="eq-game-tool-actions"><ActionButton disabled={pending} onClick={()=>command(async()=>{const parsed=context.parse(workspace.getState().attempt.draft.shortSource);if(!parsed.ok)return parsed;return true;},'这段代码能读懂了。接下来让客户试一试实际行为。')}>检查当前代码</ActionButton><ActionButton variant="paper" disabled={!facts.codeApplied||!facts.baseReady||facts.codeBaseCurrent===false||!(facts.changeRequirements?.readyForPractice||facts.changeRequirements?.readyToAdvance)||!facts.learning?.readyForChangeTests||pending} onClick={()=>runTests('short-cpp')}>运行变更客户测试</ActionButton></div><button type="button" className="eq-game-link" onClick={()=>{setReadOnlyBlocks(true);navigateGame('blocks');}}>查看保留的积木</button><ActionButton variant="paper" disabled={!facts.baseReady||pending} onClick={()=>beginCode(true)}>从当前积木重新生成（保留旧文本）</ActionButton></div>
        <aside className="eq-game-code-results"><ProgramObservation state={state} phase="short-cpp" reduceMotion={reduceMotion}/>{codeReport?<CustomerResults report={codeReport} current={codeCurrent}/>:<div className="eq-game-awaiting"><span>◇</span><h3>等待当前变更测试</h3><p>先和林工读变更来信，再试自己的新作品。</p></div>}<div className="eq-game-delivery-actions"><ActionButton disabled={!facts.codeReady||pending} onClick={exportSource}>导出当前候选 .ino</ActionButton><ActionButton variant="paper" disabled={!facts.codeReady||pending||resultHandoff?.id==='delivery'} onClick={settleIncome}>交付这版软件演示 →</ActionButton><p>这是本机软件演示。真实装置稍后再由现场教师陪同完成。</p>{exportManifest&&<details><summary>导出版本记录</summary><p className="eq-fine-print">快照 {exportManifest.snapshotId}<br/>证据 {exportManifest.evidenceId}<br/>短代码摘要 {exportManifest.sourceDigest}</p></details>}</div></aside></div>}
      {visitedTools.includes('tests')&&<div hidden={tool!=='tests'} className="eq-game-test-console"><div className="eq-game-section-head"><div><p className="eq-game-kicker">LOCAL CUSTOMER VERIFICATION</p><h2>客户测试台</h2></div><span className="eq-game-state">本机已保存 {attempt.tests.length} 次运行</span></div>{resultView}{report?<CustomerResults report={report} current={true}/>:<Notice>当前作品没有有效完整客户测试；旧记录保留为历史。</Notice>}{event&&<section className="eq-game-trace"><h3>执行事件 · {event.atMs} ms</h3><label>事件 {eventIndex+1} / {simulation.events.length}<input aria-label="执行轨迹事件" type="range" min="0" max={simulation.events.length-1} value={eventIndex} onChange={e=>setEventIndex(Number(e.target.value))}/></label><pre>{JSON.stringify({variables:event.variables,inputs:event.inputs,outputs:event.outputs},null,2)}</pre></section>}
        <details><summary>全部本机测试历史（含失败）</summary>{historical.map(item=><CustomerResults key={item.proof.id} report={item} current={item.proof.id===facts.baseEvidence?.id||item.proof.id===facts.codeEvidence?.id}/>)}</details><details><summary>固定客户场景与依据</summary>{getCustomerSuite(requirementVersion).tests.map(s=><p key={s.id}>{s.name} / {s.assertions.length} 条断言</p>)}</details></div>}
    </WorkbenchFrame></div>}
    {view==='income'&&joined&&<DeliveryReceipt state={state} pending={pending} onNavigate={navigateGame} onSubmit={settleIncome} onRestart={()=>command(()=>workspace.restartOrder({graphicIntro:enableStory}),'原作品已归档，新的空白尝试已就绪。')} reflection={draft.support?.reflection??attempt.learning?.reflection??''} noteRecoveryWarning={buffer.noteRecoveryWarning} onReflection={value=>buffer.edit({support:{...buffer.getBuffered().support,reflection:value}})}/>}
  </GameShell><div className="eq-game-overlay-scope">{overlay}</div></div>{storyEnabled&&<StoryDirector state={state} pending={pending} onAdvance={advanceStory} onPause={()=>command(()=>workspace.saveJourney({paused:true}))} onResume={()=>command(()=>workspace.saveJourney({paused:false}))} onManual={showManual}/>}</>;
}
function CustomerResults({report,current=true}){
  const firstProblem=()=>Math.max(0,report.cases.findIndex(row=>row.passed===false||row.assertions?.some(a=>!a.passed)));
  const [caseIndex,setCaseIndex]=useState(firstProblem);
  useEffect(()=>setCaseIndex(firstProblem()),[report]);
  const selected=report.cases[Math.min(caseIndex,report.cases.length-1)],assertions=selected?.assertions||[];
  const total=report.cases.reduce((n,row)=>n+(row.assertions?.length||0),0),passed=report.cases.reduce((n,row)=>n+(row.assertions?.filter(a=>a.passed).length||0),0);
  const max=Math.max(1,...assertions.map(a=>a.atMs));
  return <section className={`eq-live-results ${!current?'is-stale':report.passed?'is-passed':'is-failed'}`} aria-label="独立客户测试结果">
    <h3>{!current?'历史测试 · 需按当前版本复核':report.passed?'独立客户测试通过（仅软件）':'独立客户测试需要修改'}</h3>
    <p>需求 {report.requirementRef?.version} · 测试集 {report.testSuiteRef?.version} · {current?'当前版本':'证据已失效'} / 不代表目标板编译或实物验收</p>
    <div className="eq-game-result-counts"><b>{passed}/{total}</b><span>断言符合</span><small>{report.cases.length} 个独立场景</small></div>
    <div className="eq-game-case-tabs" role="group" aria-label="选择客户测试场景">{report.cases.map((row,i)=><button type="button" className={row.assertions?.some(a=>!a.passed)?'is-failed':''} key={i} aria-pressed={i===caseIndex} onClick={()=>setCaseIndex(i)}>{row.name}</button>)}</div>
    {assertions.length>0&&<svg className="eq-game-samples" viewBox="0 0 460 94" role="img" aria-label="所选场景断言采样：上行为客户期望，下行为实际输出，亮点表示灯亮，空心点表示灯灭">
      <text x="10" y="23">预期</text><text x="10" y="52">实际</text><path d="M55 20H440M55 49H440" stroke="#33566e" strokeWidth="1"/>
      {assertions.map((a,i)=>{const x=60+a.atMs/max*365;return <g key={i}><title>{a.atMs}ms：期望{a.expected?'亮':'灭'}，实际{a.actual===null?'无输出':a.actual?'亮':'灭'}</title><circle cx={x} cy="20" r="4" fill={a.expected?'#82dbe4':'#0a1927'} stroke="#82dbe4"/><circle cx={x} cy="49" r="4" fill={a.actual===null?'#c49f75':a.actual?(a.passed?'#82dbe4':'#f79e8c'):'#0a1927'} stroke={a.passed?'#82dbe4':'#f79e8c'}/></g>})}<text x="55" y="79">0 ms</text><text x="360" y="79">{max} ms / 断言采样</text>
    </svg>}
    <div className="eq-game-assertion-table"><table><thead><tr><th>时刻</th><th>客户期望</th><th>实际输出</th><th>结果</th></tr></thead><tbody>{assertions.length?assertions.map((a,i)=><tr key={i}><td>{a.atMs} ms</td><td>{a.expected?'亮':'灭'}</td><td>{a.actual===null?'无有效输出':a.actual?'亮':'灭'}</td><td>{a.passed?'符合':'失败'}</td></tr>):<tr><td colSpan={4}>{selected?.diagnostics?.map(d=>d.message).join('；')||'检查失败'}</td></tr>}</tbody></table></div>
    <details className="eq-live-version-details"><summary>查看绑定快照与证据版本</summary><p className="eq-game-proof">个人快照：{report.snapshot?.id}<br/>证据：{report.proof?.id}<br/>需求版本：{report.requirementRef?.version} / 测试版本：{report.testSuiteRef?.version}<br/>{current?'当前作品证据':'历史记录，不能用于当前结算'}</p></details>
  </section>;
}
