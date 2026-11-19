import {LESSONS,LESSON_IDS} from './lessons.js';

export const TUTORIAL_VERSION='eq-npc-tutorial/1';
export const TUTORIAL_STORAGE_KEY='eq.npc-tutorial.v1';
const reviewReady=review=>review?.status==='ready'&&review.readyForPractice===true&&review.readyToAdvance===true;
const reviewLesson=f=>f.requirementReview?.stageId==='requirements'?'plan':f.requirementReview?.stageId==='short-code'?'change':f.hasCode?'change':'plan';
const milestoneReady=(facts,key)=>!Object.hasOwn(facts,key)||facts[key]===true;

/** These are observations supplied by the host, never results of a dialogue click. */
export function tutorialFactsFromQuest(state={}){
  return {
    joined:state.joined===true, claimed:state.claimed===true, cardSaved:state.cardSaved===true,
    card:state.card||{}, wiringValid:state.topology?.ok===true,
    wiringDiagnostics:state.topology?.diagnostics||[], connectionCount:state.wiring?.connections?.length||0,
    programReady:!!state.program, programError:state.blockError||'',
    baseCurrent:state.baseCurrent===true, baseReport:state.baseReport||null,
    ...(Object.hasOwn(state,'baseReady')?{baseReady:state.baseReady===true}:{}),
    hasCode:!!state.source, codeApplied:!!state.applied,
    codeCurrent:state.codeCurrent===true, codeReport:state.codeReport||null,
    ...(Object.hasOwn(state,'codeReady')?{codeReady:state.codeReady===true}:{}),
    incomeRecorded:!!state.ledger?.events?.length, pending:state.pending===true,
    requirementReview:state.requirementReview||null, guidance:state.guidance||null,
  };
}

export function activeLesson(f={}){
  if(!f.joined||!f.claimed)return 'welcome';
  if(f.requirementReview&&reviewLesson(f)==='plan'&&!reviewReady(f.requirementReview))return 'plan';
  if(!f.cardSaved)return 'plan';
  if(!f.wiringValid)return 'wiring';
  if(f.hasCode||f.requirementReview?.stageId==='short-code'){
    if(f.requirementReview&&!reviewReady(f.requirementReview))return 'change';
    if(!f.codeCurrent||!f.codeReport?.passed||!milestoneReady(f,'codeReady'))return 'change';
    return f.incomeRecorded?'done':'delivery';
  }
  if(f.baseCurrent&&f.baseReport?.passed&&milestoneReady(f,'baseReady'))return 'handover';
  return 'blocks';
}

const DIAGNOSTIC_HELP={
  POWER_SHORT:'电源与地落在同一个网络了。先定位被标记的 5V/GND 连接，移除把它们直接连在一起的线，再检查；实物必须保持断电。',
  NET_CONFLICT:'不该相通的网络被额外导线合并了。点这条诊断定位端子，检查是否把电源、地和信号串到了同一条线上。',
  SENSOR_POWER_MISSING:'模块还缺供电。找到光照模块 VCC 和本关候选 5V 端，区分它们与信号 AO，再补这条虚拟连接。',
  SENSOR_GROUND_MISSING:'模块缺少公共地。检查模块 GND 是否连到了 Uno 的任一 GND，而不是 A0 或输出口。',
  SENSOR_PIN_MISMATCH:'光照信号到了错误输入。检查 AO 的线路是否落在 A1；当前程序映射读取的是 A0。',
  LED_GROUND_MISSING:'LED 的回路还没闭合。检查 K（负极）是否接入公共 GND。',
  LED_POLARITY_REVERSED:'LED 的方向反了。核对 A 是阳极、K 是阴极；本关输出经电阻到 A，K 接地。',
  LED_SERIES_RESISTOR_MISSING:'输出路径里缺少串联限流电阻。查看 D9 到 LED A 的路径，不要把 LED 直接接在输出和地之间。',
  RESISTOR_BYPASSED:'有导线绕过了电阻。即使画面里放着电阻，只要存在直通路径，它也没有承担限流；移除旁路线后再查。',
  UNMAPPED_PIN:'当前信号到了程序不使用的端子。对照 A0 输入与 D9 输出，检查诊断里列出的实际端子。',
  DEVICE_PROFILE_MISMATCH:'接线引用的设备版本与当前工位不一致。保留草稿，请教师或维护者核对版本；不要用旧通过记录替代。',
};

export function firstFailure(report){
  for(const row of report?.cases||[]){
    const assertion=row.assertions?.find(a=>!a.passed);
    if(assertion)return {name:row.name,...assertion};
    if(!row.passed)return {name:row.name,diagnostic:row.diagnostics?.map(d=>d.message).join('；')||'本场景未完成有效运行'};
  }
  return null;
}

export function taskFeedback(id,f={}){
  const summary=f.requirementReview;
  if(f.guidance?.diagnostic&&id===activeLesson(f)){
    const g=f.guidance,d=g.diagnostic;
    return {status:'依据当前检查继续',text:d.message,diagnostic:d,observedFact:d.observedFact,manualSection:d.manualSection||g.manualSection,actionTarget:g.actionTarget,retryAction:g.retryAction,checkpointId:g.checkpointId};
  }
  const learningPending=id==='blocks'?f.baseCurrent&&f.baseReport?.passed&&!milestoneReady(f,'baseReady'):id==='change'?f.codeCurrent&&f.codeReport?.passed&&!milestoneReady(f,'codeReady'):false;
  if(learningPending)return {status:'软件测试通过，学习检查待完成',text:'当前版本的客户软件测试已通过。回工具完成当前学习检查，结合现象说明程序怎样工作；这一步尚未完成，先按当前提示观察与判断。'};
  if(summary&&id===reviewLesson(f)){
    const d=summary.diagnostic;
    const ready=reviewReady(summary);
    return {status:ready?'当前情境已完成':({'needs-retry':'换个情境再练一次','needs-help':'先做局部练习','stale':'评审版本已改变',invalid:'评审记录需要核对','in-progress':'当前情境待响应'})[summary.status]||'当前情境待响应',text:d?.message||summary.challenge?.prompt||'到需求工具完成当前情境练习。不确定时可以请求局部提示；继续对话不会代替你的回答。',observedFact:d?.observedFact,diagnostic:d||null,manualSection:d?.manualSection||summary.challenge?.manualSection||summary.actionTarget?.manualSection,challenge:summary.challenge||null,current:summary.current||null,practice:summary.guidance||null,actionLabel:ready?'回工具确认当前记录':summary.guidance?'去做小观察并重试':'去回答当前情境',actionTarget:summary.actionTarget,retryAction:summary.retryAction,checkpointId:summary.checkpointId};
  }
  if(id==='welcome')return {text:!f.joined?'先在入职入口用昵称领取个人员工证，再到邮箱领取订单。':'到邮箱领取展台自动灯委托。领取只表示接单，尚未完成任何检查。',status:'待接单'};
  if(id==='plan'){
    const fields=['input','condition','output','continuous'];
    const missing=fields.find(k=>!f.card?.[k]);
    const labels={input:'装置读取什么',condition:'按什么规则判断',output:'明暗分别怎样做',continuous:'演示过程中怎样工作'};
    return {status:'待保存当前方案',text:missing?`方案里还没选择“${labels[missing]}”。先选这一项，再继续说明你的过程。`:!f.card?.explanation?.trim()?'选项已有填写。请用自己的话补充一次从暗到亮、再变暗的过程，再点保存；我不会自动理解或评分这段自由文本。':'请点保存当前中文方案。固定检查会指出覆盖问题；解释仍待教师核对。'};
  }
  if(id==='wiring'){
    const errors=(f.wiringDiagnostics||[]).filter(d=>d.severity==='error');
    const urgent=errors.find(d=>d.code==='POWER_SHORT'||d.code==='NET_CONFLICT');
    const d=urgent||errors[0];
    if(!f.connectionCount&&!urgent)return {status:'待连接',text:'画布还是空的。先认出模块 VCC/GND/AO 与 Uno 的电源、地、A0，再连第一组端子。可以随时查手册，不必一次接完整。'};
    return {status:d?'当前接线需要修正':'等待当前接线检查',text:d?(DIAGNOSTIC_HELP[d.code]||`当前诊断：${d.message}。点画布的这条诊断定位端子，对照手册修正；系统不会替你改线。`):'回到接线工具查看当前校验结果。只有实际规则通过后才继续编程。',diagnostic:d?{code:d.code,message:d.message,terminalIds:d.terminalIds||[]}:null};
  }
  if(id==='blocks'||id==='change'){
    const report=id==='blocks'?f.baseReport:f.codeReport;
    const current=id==='blocks'?f.baseCurrent:f.codeCurrent;
    if(f.pending)return {status:'客户测试运行中',text:'正在运行实际客户场景。可以先回工具观察；等结果返回，再讨论证据。'};
    if(report&&!current)return {status:'旧结果已失效',text:'这份测试属于修改前的作品。先检查并应用当前程序，再运行当前需求的整套客户测试；重看对话不能恢复旧通过。'};
    const failure=current&&firstFailure(report);
    if(failure){
      const actual=failure.actual===null?'无有效输出':failure.actual?'亮':'灭';
      const hint=id==='change'?'先核对当前比较边界和等于边界走的分支，再核对读取与等待。':'检查亮时是否明确关灯、每轮是否重新读取，以及等待是否让响应超时。';
      return {status:'按实际失败排查',text:failure.diagnostic?`${failure.name}：${failure.diagnostic}。先修复这项运行问题，再测。`:`${failure.name}，${failure.atMs} 毫秒：客户期望灯${failure.expected?'亮':'灭'}，实际${actual}。${hint}`,failure};
    }
    if(id==='blocks')return {status:'待搭建与测试',text:!f.programReady?`先搭一个完整程序入口和持续工作流程。${f.programError?`当前编辑器提示：${f.programError}`:'从变量与流程分类开始，再放读取、分支和输出。'}`:'程序结构已有结果。先用滑条观察明暗往返，再点“运行基础客户测试”；我只在实际结果返回后继续。'};
    return {status:f.codeApplied?'待运行变更测试':'待解析当前代码',text:f.codeApplied?'代码已应用。去运行变更客户测试，检查 500、600 和明暗往返的实际结果。':'在自己的比较表达式里处理客户变更，然后点“解析并应用代码”。解析是语法检查，之后仍需运行新版客户测试。'};
  }
  return {status:id==='handover'?'当前基础软件测试通过':id==='delivery'?'当前新版软件测试通过':'已记录本次软件收入',text:id==='handover'?'到积木工具点击“保存积木快照，查看代码变更”。教程不会替你生成或覆盖代码。':id==='delivery'?'到代码工具查看当前证据，按需要导出候选 .ino 并明确请求合成入账。真实编译、烧录与教师验收仍未执行。':'软件收入只记一次。你可以回看测试，整理排错经历；实际装置仍需现场教师安全检查与功能验收。'};
}

export function createTutorialSession(){return {version:TUTORIAL_VERSION,open:false,review:null,slots:{}};}
const emptySlot=()=>({index:0,answers:{}});

export function restoreTutorialSession(serialized){
  const clean=createTutorialSession();
  try{
    const value=typeof serialized==='string'?JSON.parse(serialized):serialized;
    if(value?.version!==TUTORIAL_VERSION)return clean;
    for(const id of LESSON_IDS){
      const saved=value.slots?.[id];if(!saved)continue;
      const answers={};
      for(const line of LESSONS[id].lines){
        const answer=line.options?.find(o=>o.id===saved.answers?.[line.id]);if(answer)answers[line.id]=answer.id;
      }
      clean.slots[id]={index:Number.isInteger(saved.index)?Math.max(0,Math.min(saved.index,LESSONS[id].lines.length)):0,answers};
    }
    // Reopen is a user choice after reload; no persisted business state or modal trap.
  }catch{ /* corrupt teaching memory cannot block the engineering project */ }
  return clean;
}

export function tutorialView(session,facts){
  const active=activeLesson(facts),id=LESSON_IDS.includes(session.review)?session.review:active;
  const lesson=LESSONS[id],slot=session.slots[id]||emptySlot();
  let line=lesson.lines[slot.index]||null;
  if(id==='plan'&&facts?.requirementReview&&line?.id==='save')line={...line,text:'到需求工具完成当前这一个情境响应。可以选“不确定”来练局部例子，再用自己的话说明想法。脚本只核对明确的选择，不会自动理解任意中文解释。'};
  return {id,active,lesson,slot,line,atTask:!line,reviewing:id!==active,feedback:line?.options?.find(o=>o.id===slot.answers[line.id])||null,task:taskFeedback(id,facts)};
}

export function tutorialTransition(session,event,facts){
  const view=tutorialView(session,facts),{id,lesson,line,slot}=view;
  const update=next=>({...session,slots:{...session.slots,[id]:next}});
  switch(event.type){
    case 'open':return {...session,open:true,review:null};
    case 'close':return {...session,open:false};
    case 'resume':return {...session,review:null};
    case 'review':return LESSON_IDS.includes(event.id)?{...session,review:event.id,open:true}:session;
    case 'replay':return update(emptySlot());
    case 'skip':return update({...slot,index:lesson.lines.length});
    case 'choose':return line?.options?.some(o=>o.id===event.id)?update({...slot,answers:{...slot.answers,[line.id]:event.id}}):session;
    case 'next':return !line||(line.options&&!view.feedback?.correct)?session:update({...slot,index:Math.min(slot.index+1,lesson.lines.length)});
    default:return session;
  }
}
