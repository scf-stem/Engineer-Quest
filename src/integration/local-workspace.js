import {canonicalJson,contentDigest,immutable,textDigest,wiringSemantics} from '../contracts/index.js';
import {programSemantics} from './program-adapter.js';
import {createIndexedDbProgressStore} from './local-progress-store.js';
import {derivePracticePresentation} from './practice-presentation.js';
import {freshJourney,JOURNEY_VERSION,FIRST_ORDER_SCENES} from './first-order-story.js';
import {createGraphicIntro,GRAPHIC_INTRO_KEY} from '../program-teaching/progression.js';
import {RESULT_STORY_IDS} from './story-result-handoff.js';

export const WORKSPACE_SCHEMA='eq.workspace/1';
export class WorkspaceError extends Error{constructor(code,message){super(message);this.name='WorkspaceError';this.code=code;}}
const fail=(code,message)=>{throw new WorkspaceError(code,message);};
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const phases=['blocks','short-cpp'];
const publicPhase=phase=>phase==='short-cpp'?'change':'base';
const clone=value=>structuredClone(value);

function assertArchive(data){
  if(!data||data.schemaVersion!==WORKSPACE_SCHEMA||!Array.isArray(data.attempts)||!Array.isArray(data.ledger)||!Array.isArray(data.events))fail('ARCHIVE_INVALID','本机进度结构不支持，原记录保留。');
  if(data.learner&&(!data.learner.localOnly||typeof data.learner.id!=='string'||typeof data.learner.nickname!=='string'))fail('ARCHIVE_INVALID','本机员工记录不完整。');
  if(new Set(data.attempts.map(a=>a.id)).size!==data.attempts.length)fail('ARCHIVE_INVALID','本机订单记录含重复版本。');
  for(const attempt of data.attempts){
    if(!attempt?.id||!attempt.draft||!attempt.epochs||!attempt.reviews||!attempt.currentTests||!Array.isArray(attempt.observations)||!Array.isArray(attempt.learningActions)||!Array.isArray(attempt.snapshots)||!Array.isArray(attempt.tests)||!Array.isArray(attempt.executionAttempts)||!Array.isArray(attempt.reviewHistory)||!['base','change'].every(k=>Number.isSafeInteger(attempt.reviewEpochs?.[k])&&attempt.reviewEpochs[k]>=0))fail('ARCHIVE_INVALID','本机作品记录不完整。');
  }
  if((data.learner&&!data.attempts.some(a=>a.id===data.activeAttemptId))||(!data.learner&&data.attempts.length))fail('ARCHIVE_INVALID','本机员工与订单不匹配。');
  if(new Set(data.ledger.map(e=>e.idempotencyKey)).size!==data.ledger.length||data.ledger.some(e=>e.learnerId!==data.learner?.id||!e.localOnly||!e.synthetic||!Number.isSafeInteger(e.amount)||e.amount<1||!data.attempts.some(a=>a.id===e.attemptId&&a.tests.some(t=>t.id===e.evidenceId))))fail('ARCHIVE_INVALID','本机收入与作品证据不匹配。');
  canonicalJson(data);return data;
}
function readArchive(data){
  const book=clone(data);
  // Additive /1 fields: their absence means no review has ever been reset.
  for(const attempt of book.attempts??[]){attempt.reviewEpochs??={base:0,change:0};attempt.reviewHistory??=[];}
  return assertArchive(book);
}
function wiringKey(wiring){try{return canonicalJson(wiringSemantics(wiring));}catch{return canonicalJson(wiring);}}
function blocksKey(value){
  function project(item){
    if(Array.isArray(item))return item.map(project);
    if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).filter(([key])=>!['x','y'].includes(key)).map(([key,value])=>[key,project(value)]));
    return item;
  }
  return canonicalJson(project(value?.workspace??value));
}
function reportHasEvidence(report){return report&&typeof report.passed==='boolean'&&Array.isArray(report.cases)&&report.cases.length>0&&report.cases.every(c=>typeof c.passed==='boolean')&&report.passed===report.cases.every(c=>c.passed);}

/** Durable local learning controller. No accounts, network, hardware approvals or model calls. */
export async function openLocalWorkspace({programContext,policies={},store=createIndexedDbProgressStore(),now=()=>new Date().toISOString(),createId=()=>crypto.randomUUID()}={}){
  if(!programContext?.evaluateSoftware||!programContext?.fromBlocks)throw new TypeError('需要当前程序与设备适配器');
  const context=programContext,requirements=policies.requirements;
  const record=await store.read();
  let data=record?readArchive(record.data):{schemaVersion:WORKSPACE_SCHEMA,learner:null,activeAttemptId:null,attempts:[],ledger:[],events:[]};
  let revision=record?.revision??0,view,listeners=new Set(),queue=Promise.resolve(),saveFailure=null,externalRevision=null,closed=false;
  const id=prefix=>`${prefix}-${createId()}`;
  const active=book=>book.attempts.find(a=>a.id===book.activeAttemptId)??null;
  function needAttempt(book){const attempt=active(book);if(!book.learner||!attempt)fail('START_REQUIRED','先领取本机个人员工证。');return attempt;}
  const edition=phase=>context.editions[phase];
  function binding(book,attempt,phase){const epoch=attempt.reviewEpochs[publicPhase(phase)];return {learnerId:book.learner.id,attemptId:attempt.id,requirementRef:edition(phase).refs.requirementRef,...(attempt.epochs.requirements||epoch?{requirementsEpoch:`${attempt.epochs.requirements}:${epoch}`}:{ }),
    ...(requirements?.lessonRef?{lessonRef:requirements.lessonRef}:{})};}
  function freshReview(book,attempt,phase){return requirements?.createRequirementReview?.({binding:binding(book,attempt,phase)})??null;}
  function summary(book,attempt,phase){
    if(!requirements?.summarizeRequirementReview)return {status:'unavailable',current:null,readyForPractice:false,readyToAdvance:false,diagnostic:{code:'TEACHING_POLICY_UNAVAILABLE',message:'需求教学内容尚未接入，不能将旧选项覆盖当作完成。'}};
    return requirements.summarizeRequirementReview({review:attempt.reviews[publicPhase(phase)],binding:binding(book,attempt,phase)});
  }
  function programFor(attempt,phase){return phase==='blocks'?context.fromBlocks(attempt.draft.blockState):context.parse(attempt.draft.shortSource);}
  async function reviewEvidence(book,attempt,phase){
    const result=summary(book,attempt,phase);
    const evidence=result.evidence;
    return {binding:evidence?.binding??binding(book,attempt,phase),lessonRef:evidence?.lessonRef??null,
      responsesDigest:await textDigest(evidence?.responsesCanonical??canonicalJson(attempt.reviews[publicPhase(phase)]))};
  }
  async function reviewDigest(book,attempt,phase){return contentDigest(await reviewEvidence(book,attempt,phase));}
  async function learningContext(book,attempt){
    const common={wiringKey:await contentDigest(wiringKey(attempt.draft.wiring)),blocksKey:await contentDigest(blocksKey(attempt.draft.blockState))};
    return {learnerId:book.learner.id,attemptId:attempt.id,
      base:{requirementRef:edition('blocks').refs.requirementRef,requirementsEvidenceKey:await reviewDigest(book,attempt,'blocks'),...common},
      ...(attempt.change?{change:{requirementRef:edition('short-cpp').refs.requirementRef,requirementsEvidenceKey:await reviewDigest(book,attempt,'short-cpp'),...common,sourceKey:await textDigest(attempt.draft.shortSource)}}:{})};
  }
  async function dependencyKey(book,attempt,phase){
    return contentDigest({phase,taskRef:attempt.taskRef,requirementRef:edition(phase).refs.requirementRef,testSuiteRef:edition(phase).refs.testSuiteRef,deviceProfileRef:context.hardware.ref,languageProfileRef:context.languageRef,manualRef:edition(phase).refs.manualRef,
      reviewDigest:await reviewDigest(book,attempt,phase),requirementsEpoch:attempt.epochs.requirements,wiringEpoch:attempt.epochs.wiring,wiring:wiringKey(attempt.draft.wiring),
      ...(phase==='blocks'?{blocksEpoch:attempt.epochs.blocks,blockState:blocksKey(attempt.draft.blockState)}:{codeEpoch:attempt.epochs.code,source:attempt.draft.shortSource,change:attempt.change})});
  }
  async function currentTest(book,attempt,phase){
    const proof=attempt.tests.find(t=>t.id===attempt.currentTests[phase]);
    if(!proof||proof.invalidReason)return null;
    if(phase==='short-cpp'&&attempt.change?.baseEvidenceId!==(await currentTest(book,attempt,'blocks'))?.id)return null;
    return proof.dependencyKey===await dependencyKey(book,attempt,phase)?proof:null;
  }
  async function learningSummary(book,attempt){
    return policies.deriveLearningProgress?.({requirements:{review:attempt.reviews.base,binding:binding(book,attempt,'blocks')},
      ...(attempt.change?{changeRequirements:{review:attempt.reviews.change,binding:binding(book,attempt,'short-cpp')}}:{}),
      context:await learningContext(book,attempt),observations:attempt.observations.filter(o=>!attempt.observationInvalidations.includes(o.id))})??{status:'unavailable',readyForBaseTests:false,readyForCodeChange:false,readyForChangeTests:false,readyForSoftwareDelivery:false,diagnostics:[{code:'PROGRAM_TEACHING_UNAVAILABLE',message:'当前编程教学检查尚未接入；完整示例或测试成功不能自动代替学习过程。'}]};
  }
  async function recordObservation(book,attempt,phase,actionId,fact){
    const context=await learningContext(book,attempt),keys=phase==='blocks'?context.base:context.change;
    if(!keys)fail('OBSERVATION_PHASE','变更作品尚未建立。');
    attempt.observations.push({id:id('observation'),activityId:fact.activityId,learnerActionId:actionId,source:fact.source,
      binding:{learnerId:book.learner.id,attemptId:attempt.id,...keys},factCodes:fact.factCodes});
  }
  async function factsFor(book,attempt){
    if(!book.learner||!attempt)return {stage:'onboarding',joined:false,claimed:false};
    const baseRequirements=summary(book,attempt,'blocks'),changeRequirements=summary(book,attempt,'short-cpp');
    const wiring=context.hardware.validate(attempt.draft.wiring),parsed=programFor(attempt,'blocks'),code=programFor(attempt,'short-cpp');
    const savedBlocks=attempt.draft.blockState?.workspace??attempt.draft.blockState,blankBlocks=!savedBlocks?.blocks?.blocks?.length;
    const base=await currentTest(book,attempt,'blocks'),changed=await currentTest(book,attempt,'short-cpp');
    const learning=await learningSummary(book,attempt);
    const practice=Object.fromEntries(phases.map(phase=>[phase,derivePracticePresentation({learning,attempt,phase})]));
    const baseLearning={...learning,readyToAdvance:learning.readyForCodeChange===true},codeLearning={...learning,readyToAdvance:learning.readyForSoftwareDelivery===true};
    const baseReady=baseRequirements.readyToAdvance===true&&wiring.ok&&!!base?.report.passed&&baseLearning.readyToAdvance===true;
    const codeBaseCurrent=!attempt.change||!!base&&attempt.change.baseEvidenceId===base.id;
    const canKeepCodeOnBaseRefresh=!!attempt.change&&baseReady&&parsed.ok&&attempt.change.baseSemanticsDigest===await contentDigest(programSemantics(parsed.value));
    const codeReady=baseReady&&!!changed?.report.passed&&codeLearning.readyToAdvance===true&&changeRequirements.readyToAdvance===true;
    const income=book.ledger.filter(e=>e.learnerId===book.learner.id&&e.taskId===attempt.taskRef.id);
    let stage='requirements';
    if(!attempt.claimed)stage='claim-order';
    else if(!baseRequirements.readyToAdvance)stage='requirements';
    else if(!wiring.ok)stage='wiring';
    else if(!baseReady)stage='blocks';
    else if(!attempt.change)stage='customer-change';
    else if(!changeRequirements.readyForPractice&&!changeRequirements.readyToAdvance)stage='change-review';
    else if(!codeReady)stage='short-cpp';
    else stage=income.length?'software-complete':'software-income';
    const reviewGoal=stage==='requirements'?baseRequirements:stage==='change-review'?changeRequirements:null;
    const learningGoal=['blocks','short-cpp'].includes(stage)?practice[stage].current:null;
    let guidance=reviewGoal?{stageId:reviewGoal.stageId,checkpointId:reviewGoal.checkpointId,diagnostic:reviewGoal.diagnostic,manualSection:reviewGoal.challenge?.manualSection??reviewGoal.diagnostic?.manualSection,retryAction:reviewGoal.retryAction,actionTarget:reviewGoal.actionTarget}
      :learningGoal?{stageId:learningGoal.stageId,checkpointId:learningGoal.id,diagnostic:learningGoal.diagnostic,manualSection:learningGoal.actionTarget?.manualSection,retryAction:{type:'learning-activity',label:'回到当前练习',targetId:stage==='blocks'?'blocks':'code'},actionTarget:learningGoal.actionTarget}:null;
    if(stage==='blocks'&&!blankBlocks&&!parsed.ok&&context.explainDiagnostic){
      const help=context.explainDiagnostic(parsed.diagnostics[0],{blockState:savedBlocks});
      guidance={...guidance,diagnostic:{code:help.code,message:help.nextAction,observedFact:help.observation,manualSection:guidance?.manualSection??'07.1'}};
    }
    if(stage==='short-cpp'&&!codeBaseCurrent)guidance={stageId:'short-cpp',checkpointId:'change-delivery',manualSection:'08.1',
      diagnostic:{code:'CODE_BASE_CHANGED',message:canKeepCodeOnBaseRefresh?'基础回信更新了。先关联这次回信，保留你的代码，再请客户试一遍。':'基础积木逻辑改过了。先查看新作品，确认重新生成；原代码会留在历史。',observedFact:'当前代码仍关联上一次基础客户回信；新基础测试已经通过。',manualSection:'08.1'},
      retryAction:{type:'navigate',targetId:'code',label:'回到当前代码'},actionTarget:{type:'navigate',targetId:'code'}};
    return {stage,joined:true,claimed:attempt.claimed,learnerId:book.learner.id,attemptId:attempt.id,requirements:baseRequirements,changeRequirements,cardSaved:baseRequirements.readyToAdvance===true,
      card:attempt.draft.requirementCard,wiringValid:wiring.ok,wiringDiagnostics:wiring.diagnostics,connectionCount:attempt.draft.wiring.connections?.length??0,
      programReady:parsed.ok,programError:parsed.ok||blankBlocks?'':parsed.diagnostics.map(d=>d.message).join('；'),programDiagnostics:parsed.ok?[]:parsed.diagnostics,
      baseCurrent:!!base,baseReport:base?.report??null,baseEvidence:base,baseLearning,baseReady,learning,practice,
      hasCode:!!attempt.change,codeApplied:code.ok,codeCurrent:!!changed,codeReport:changed?.report??null,codeEvidence:changed,codeLearning,codeReady,codeBaseCurrent,canKeepCodeOnBaseRefresh,
      incomeRecorded:income.length>0,guidance,pending:false};
  }
  async function publish(storage={status:'saved'}){
    const attempt=active(data),facts=await factsFor(data,attempt);
    facts.pending=!['saved','restored','empty'].includes(storage.status);
    facts.storageStatus=storage.status;
    if(facts.pending)facts.guidance={stageId:facts.stage,checkpointId:null,storageStatus:storage.status,
      diagnostic:{code:storage.code??'LOCAL_SAVE_PENDING',message:storage.message??'本机进度正在保存，请等保存完成后继续。',observedFact:'保存状态与学习、测试状态分别记录。'},
      retryAction:{type:'navigate',label:'回到工位查看本机保存状态',targetId:'desk'},actionTarget:{type:'navigate',targetId:'desk'}};
    view=immutable({schemaVersion:WORKSPACE_SCHEMA,revision,localOnly:true,learner:data.learner,activeAttemptId:data.activeAttemptId,attempt,facts,stage:facts.stage,
      ledger:{localOnly:true,policyStatus:'candidate',income:data.ledger.reduce((n,e)=>n+e.amount,0),balance:data.ledger.reduce((n,e)=>n+e.amount,0),events:data.ledger},
      attempts:data.attempts.map(a=>({id:a.id,createdAt:a.createdAt,updatedAt:a.updatedAt,claimed:a.claimed,archived:a.archived,testCount:a.tests.length,active:a.id===data.activeAttemptId})),
      storage:{...storage,externalRevision},scope:{accounts:false,onlineAI:false,targetCompile:false,hardwareUpload:false,shop:false,multiplayerLeaderboard:false,teacherDashboard:false}});
    for(const listener of listeners)listener();
  }
  async function verifyRestored(book){
    // Re-evaluate stored software facts; a local "passed" flag is never enough.
    for(const attempt of book.attempts){
      for(const proof of attempt.tests){
        const snapshot=attempt.snapshots.find(s=>s.id===proof.snapshotId);
        try{
          if(!snapshot||snapshot.sourceDigest!==await textDigest(snapshot.binding.source)||snapshot.digest!==await contentDigest(snapshot.binding)||proof.reportDigest!==await contentDigest(proof.report))throw new Error('记录摘要不匹配');
          const actual=await context.evaluateSoftware(snapshot.binding);
          if(!reportHasEvidence(actual)||!same(actual,proof.report))throw new Error('当前执行版本与旧结果不同');
          proof.invalidReason=null;
        }catch(error){proof.invalidReason=error.message;}
      }
      attempt.observationInvalidations=[];
      const checkedActions=new Map();
      for(const observation of attempt.observations){
        const action=attempt.learningActions.find(a=>a.id===observation.learnerActionId);
        let valid=false;
        if(action?.kind==='customer-tests'){
          const proof=attempt.tests.find(p=>p.id===action.evidenceId);
          valid=!!proof&&!proof.invalidReason&&(observation.source==='snapshot-store'&&observation.factCodes.every(c=>c==='changed_exact_source_recorded')||observation.source==='course-customer-tests'&&proof.report.passed&&observation.factCodes.every(c=>c===(proof.phase==='blocks'?'base_customer_suite_passed':'change_customer_suite_passed')));
        }else if(action?.kind==='preserve-snapshot'){
          const proof=attempt.tests.find(p=>p.id===action.baseEvidenceId);
          valid=!!proof&&!proof.invalidReason&&proof.report.passed&&observation.source==='snapshot-store'&&observation.factCodes.every(c=>c==='own_blocks_snapshot_preserved');
        }else if(action?.kind==='program-action'&&policies.performLearningAction){
          try{
            if(!checkedActions.has(action.id))checkedActions.set(action.id,await policies.performLearningAction(action.request));
            valid=(checkedActions.get(action.id).observations??[]).some(f=>f.activityId===observation.activityId&&f.source===observation.source&&same(f.factCodes,observation.factCodes));
          }catch{/* Preserve the original action and mark its facts stale. */}
        }
        if(!valid)attempt.observationInvalidations.push(observation.id);
      }
    }
  }
  await verifyRestored(data);await publish({status:record?'restored':'empty'});
  const unsubscribe=store.subscribeExternal?.(next=>{if(next>revision){externalRevision=next;publish({status:'external-change',message:'另一页面已保存此工位，请重新读取，当前内容未覆盖。'});}});
  function command(kind,mutate){
    const operation=queue.catch(()=>{}).then(async()=>{
      if(closed)fail('WORKSPACE_CLOSED','本机工位已关闭。');
      if(saveFailure||externalRevision>revision)fail('SAVE_BLOCKED','本机保存尚未解决，请先重试或重新读取，不能继续生成证据或收入。');
      const next=clone(data),result=await mutate(next);
      next.events.push({id:id('event'),kind,at:now(),attemptId:next.activeAttemptId});
      const attempt=active(next);if(attempt)attempt.updatedAt=now();
      assertArchive(next);await publish({status:'saving'});
      try{const saved=await store.commit(revision,next);data=next;revision=saved.revision;await publish({status:'saved'});}
      catch(error){data=next;saveFailure=error;await publish({status:'unsaved',code:error.code,message:error.message});throw error;}
      return result??view;
    });queue=operation;return operation;
  }
  function newAttempt(book,{welcomed=false,graphicIntro=false}={}){
    const attempt={id:id('attempt'),taskRef:edition('blocks').refs.taskRef,createdAt:now(),updatedAt:now(),archived:false,claimed:false,
      draft:{requirementCard:{},wiring:context.hardware.createDocument(),blockState:null,shortSource:'',support:{kind:'manual'}},
      epochs:{requirements:0,wiring:0,blocks:0,code:0},reviewEpochs:{base:0,change:0},reviews:{base:null,change:null},reviewHistory:[],change:null,learning:{},presentation:{view:'desk',tool:'wiring',tutorial:null,journey:freshJourney({welcomed})},
      observations:[],observationInvalidations:[],learningActions:[],snapshots:[],tests:[],executionAttempts:[],currentTests:{blocks:null,'short-cpp':null},textHistory:[]};
    if(graphicIntro)attempt.learning[GRAPHIC_INTRO_KEY]=createGraphicIntro({learnerId:book.learner.id,attemptId:attempt.id});
    attempt.reviews.base=freshReview(book,attempt,'blocks');attempt.reviews.change=freshReview(book,attempt,'short-cpp');return attempt;
  }
  const api={
    getState:()=>view,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    start(nickname,{graphicIntro=false}={}){return command('start',book=>{
      if(book.learner)fail('LOCAL_WORK_EXISTS','此浏览器已有个人工位，请选择继续或重开订单。');
      if(typeof nickname!=='string'||!nickname.trim()||nickname.trim().length>24)fail('NICKNAME_INVALID','昵称需要1–24个字符，不要求真实姓名。');
      book.learner={id:id('local-learner'),nickname:nickname.trim(),createdAt:now(),localOnly:true,synthetic:true};
      const attempt=newAttempt(book,{graphicIntro});book.attempts.push(attempt);book.activeAttemptId=attempt.id;
    });},
    continue(){return Promise.resolve(view);},
    claimOrder(){return command('claim-order',book=>{needAttempt(book).claimed=true;});},
    editDraft(patch){return command('edit-draft',book=>{
      const attempt=needAttempt(book);if(!patch||Object.keys(patch).some(key=>!['requirementCard','wiring','blockState','shortSource','support'].includes(key)))fail('DRAFT_FIELD','草稿包含不可写字段。');
      for(const [key,value]of Object.entries(patch)){
        if(key==='shortSource'&&(typeof value!=='string'||value.length>24000))fail('SOURCE_LIMIT','简写代码最多24000个字符。');
        if(key==='wiring'&&wiringKey(value)!==wiringKey(attempt.draft.wiring))attempt.epochs.wiring++;
        if(key==='blockState'&&blocksKey(value)!==blocksKey(attempt.draft.blockState))attempt.epochs.blocks++;
        if(key==='shortSource'&&value!==attempt.draft.shortSource)attempt.epochs.code++;
        if(key==='requirementCard'&&!same(value,attempt.draft.requirementCard)){
          for(const phase of phases)attempt.reviewHistory.push({phase,review:clone(attempt.reviews[publicPhase(phase)]),at:now(),reason:'card-edited'});
          attempt.epochs.requirements++;attempt.reviews.base=freshReview(book,attempt,'blocks');attempt.reviews.change=freshReview(book,attempt,'short-cpp');
        }
        attempt.draft[key]=clone(value);
      }
    });},
    reviewRequirements({phase='blocks',attempt:response}={}){return command('requirement-response',book=>{
      const attempt=needAttempt(book);if(!attempt.claimed)fail('CLAIM_REQUIRED','先领取当前客户委托。');
      if(!phases.includes(phase)||!requirements?.reviewRequirementAttempt)fail('TEACHING_POLICY_UNAVAILABLE','需求教学检查尚未接入。');
      if(phase==='short-cpp'&&!attempt.change)fail('CHANGE_NOT_STARTED','先保留自己的积木与基础测试，再查看客户变更。');
      const result=requirements.reviewRequirementAttempt({review:attempt.reviews[publicPhase(phase)],binding:binding(book,attempt,phase),attempt:response});
      attempt.reviews[publicPhase(phase)]=clone(result.review);return result;
    });},
    resetRequirementReview(phase='blocks'){return command('reset-review',book=>{if(!phases.includes(phase))fail('PHASE_INVALID','未知需求阶段。');const attempt=needAttempt(book),key=publicPhase(phase);attempt.reviewHistory.push({phase,review:clone(attempt.reviews[key]),at:now(),reason:'review-reset'});attempt.reviewEpochs[key]++;attempt.reviews[key]=freshReview(book,attempt,phase);});},
    saveLearning(inputs){return command('learning-input',book=>{const attempt=needAttempt(book);attempt.learning={...attempt.learning,...clone(inputs)};});},
    performLearningAction({phase='blocks',actionId,inputs={}}={}){return command('learning-action',async book=>{
      const attempt=needAttempt(book),facts=await factsFor(book,attempt);
      if(!phases.includes(phase)||!policies.performLearningAction)fail('LEARNING_ACTION_UNAVAILABLE','编程练习执行器尚未接入。');
      if(!facts.claimed||!facts.requirements.readyToAdvance||!facts.wiringValid)fail('PRACTICE_NOT_READY','先完成客户情境并连接当前虚拟作品。');
      if(phase==='short-cpp'&&(!attempt.change||!facts.baseReady))fail('CHANGE_NOT_READY','先完成自己的基础作品。');
      if(actionId==='graphic-intro-run'){
        const previous=attempt.learningActions.find(a=>a.request?.actionId===actionId&&a.request.inputs.runId===inputs.runId);
        if(previous){if(!same(previous.request.inputs,inputs))fail('TEACHING_RUN_CONFLICT','这次执行标识已经对应另一份作品。');return clone(previous.result);}
      }
      const learnerActionId=id('learning-action');
      const request={actionId,inputs,phase,program:programFor(attempt,phase),source:attempt.draft.shortSource,blockState:attempt.draft.blockState,wiring:attempt.draft.wiring,learningProgress:facts.learning};
      const result=await policies.performLearningAction(request);
      attempt.learningActions.push({id:learnerActionId,kind:'program-action',request:clone(request),result:clone(result),at:now()});
      for(const observation of result.observations??[])await recordObservation(book,attempt,phase,learnerActionId,observation);
      return result;
    });},
    savePresentation(patch){return command('presentation',book=>{const attempt=needAttempt(book);if(Object.keys(patch).some(k=>!['view','tool','tutorial'].includes(k)))fail('PRESENTATION_FIELD','不支持的界面状态');attempt.presentation={...attempt.presentation,...clone(patch)};});},
    saveJourney(patch){return command('story-position',book=>{
      const attempt=needAttempt(book);
      if(!patch||Object.keys(patch).some(key=>!['sceneId','line','paused','seen','replay','replayLine','resultContinued'].includes(key)))fail('STORY_FIELD','剧情只能保存阅读位置，不能写入作品或通过。');
      if(patch.sceneId!==undefined&&patch.sceneId!==null&&!FIRST_ORDER_SCENES[patch.sceneId])fail('STORY_SCENE','未知剧情场景。');
      if(patch.line!==undefined&&(!Number.isSafeInteger(patch.line)||patch.line<0||patch.line>8))fail('STORY_LINE','剧情句号不支持。');
      if(patch.replayLine!==undefined&&(!Number.isSafeInteger(patch.replayLine)||patch.replayLine<0||patch.replayLine>8))fail('STORY_LINE','重播句号不支持。');
      for(const flag of ['paused','replay'])if(patch[flag]!==undefined&&typeof patch[flag]!=='boolean')fail('STORY_FIELD','剧情开关需要明确状态。');
      if(patch.seen&&Object.entries(patch.seen).some(([key,value])=>!FIRST_ORDER_SCENES[key]||typeof value!=='boolean'))fail('STORY_FIELD','只保存已读场景。');
      if(patch.resultContinued!==undefined&&(!patch.resultContinued||Array.isArray(patch.resultContinued)||typeof patch.resultContinued!=='object'||Object.entries(patch.resultContinued).some(([key,value])=>!RESULT_STORY_IDS.includes(key)||typeof value!=='string'||value.length>2000)))fail('STORY_FIELD','只保存这份结果的继续位置。');
      const current=attempt.presentation.journey?.version===JOURNEY_VERSION?attempt.presentation.journey:freshJourney({welcomed:true});
      attempt.presentation.journey={...current,...clone(patch),seen:{...current.seen,...patch.seen},...(patch.resultContinued?{resultContinued:{...current.resultContinued,...clone(patch.resultContinued)}}:{})};
    });},
    runTests(phase){return command('run-tests',async book=>{
      const attempt=needAttempt(book),facts=await factsFor(book,attempt);
      if(!phases.includes(phase))fail('PHASE_INVALID','未知测试阶段。');
      if(!facts.claimed||!facts.requirements.readyToAdvance)fail('REQUIREMENTS_NOT_READY','先完成当前客户情境练习，旧选项或一句解释不能放行。');
      if(!facts.wiringValid)fail('WIRING_NOT_READY','先修正当前接线，旧通过记录不能覆盖新连接。');
      if(phase==='blocks'&&!facts.learning.readyForBaseTests)fail('BASE_PRACTICE_NOT_READY','先逐步观察输出、输入、分支与重复读取，再运行基础客户测试。');
      if(phase==='short-cpp'&&(!attempt.change||!facts.baseReady||(!facts.changeRequirements.readyForPractice&&!facts.changeRequirements.readyToAdvance)))fail('CHANGE_NOT_READY','先保留当前基础作品并完成客户变更的前置练习。');
      if(phase==='short-cpp'&&!facts.codeBaseCurrent)fail('CODE_BASE_CHANGED','基础客户回信已更新。先关联这次基础回信并保留当前代码，再运行新版测试。');
      if(phase==='short-cpp'&&!facts.learning.readyForChangeTests)fail('CODE_PRACTICE_NOT_READY','先对照自己的积木与简写代码。');
      const parsed=programFor(attempt,phase);
      if(!parsed.ok){const failure={id:id('execution'),phase,at:now(),diagnostics:parsed.diagnostics,complete:false};attempt.executionAttempts.push(failure);return {ok:false,diagnostics:parsed.diagnostics};}
      const valid=context.validate(parsed.value);if(!valid.ok){attempt.executionAttempts.push({id:id('execution'),phase,at:now(),diagnostics:valid.diagnostics,complete:false});return valid;}
      const generated=context.shortSource(parsed.value);if(!generated.ok)return generated;
      const source=phase==='blocks'?generated.value.source:attempt.draft.shortSource;
      const refs=edition(phase).refs;
      const bindingValue={taskRef:attempt.taskRef,requirementRef:refs.requirementRef,testSuiteRef:refs.testSuiteRef,manualRef:refs.manualRef,deviceProfileRef:context.hardware.ref,languageProfileRef:context.languageRef,phase,program:parsed.value,wiring:attempt.draft.wiring,source,requirementCard:attempt.draft.requirementCard,reviewEvidence:await reviewEvidence(book,attempt,phase)};
      const snapshot={id:id('snapshot'),phase,createdAt:now(),binding:clone(bindingValue),sourceDigest:await textDigest(source),digest:await contentDigest(bindingValue),dependencyKey:await dependencyKey(book,attempt,phase)};
      const report=await context.evaluateSoftware(bindingValue);if(!reportHasEvidence(report))fail('REPORT_INVALID','执行器未提供完整一致的客户测试。');
      const proof={id:id('evidence'),snapshotId:snapshot.id,phase,createdAt:now(),dependencyKey:snapshot.dependencyKey,report,reportDigest:await contentDigest(report),invalidReason:null};
      attempt.snapshots.push(snapshot);attempt.tests.push(proof);attempt.currentTests[phase]=proof.id;
      const learnerActionId=id('test-action');
      attempt.learningActions.push({id:learnerActionId,kind:'customer-tests',evidenceId:proof.id,phase,at:now()});
      if(phase==='short-cpp')await recordObservation(book,attempt,phase,learnerActionId,{activityId:'change-delivery',source:'snapshot-store',factCodes:['changed_exact_source_recorded']});
      if(report.passed)await recordObservation(book,attempt,phase,learnerActionId,{activityId:phase==='blocks'?'base-delivery':'change-delivery',source:'course-customer-tests',factCodes:[phase==='blocks'?'base_customer_suite_passed':'change_customer_suite_passed']});
      return {ok:true,proof:immutable(proof),snapshot:immutable(snapshot)};
    });},
    prepareCodeChange({replaceCode=false}={}){return command('prepare-change',async book=>{
      const attempt=needAttempt(book),facts=await factsFor(book,attempt);if(!facts.baseReady)fail('BASE_NOT_READY','基础软件测试与当前编程练习都完成后，才能回应客户变更。');
      const parsed=programFor(attempt,'blocks'),generated=context.shortSource(parsed.value);if(!generated.ok)return generated;
      const semantics=await contentDigest(programSemantics(parsed.value));
      if(attempt.change&&attempt.change.baseSemanticsDigest!==semantics&&attempt.draft.shortSource&&!replaceCode)fail('CODE_REBASE_REQUIRED','积木逻辑已经变化。请明确选择从新版积木生成；原文本会保留到历史。');
      const retain=attempt.change&&attempt.change.baseSemanticsDigest===semantics&&!replaceCode;
      if(!retain){if(attempt.draft.shortSource)attempt.textHistory.push({id:id('text-history'),source:attempt.draft.shortSource,createdAt:now()});attempt.draft.shortSource=generated.value.source;attempt.epochs.code++;}
      attempt.change={id:attempt.change?.id??id('change'),baseEvidenceId:facts.baseEvidence.id,baseSnapshotId:facts.baseEvidence.snapshotId,baseSemanticsDigest:semantics,preparedSourceDigest:await textDigest(generated.value.source)};
      const learnerActionId=id('preserve-action');attempt.learningActions.push({id:learnerActionId,kind:'preserve-snapshot',baseEvidenceId:facts.baseEvidence.id,at:now()});
      await recordObservation(book,attempt,'blocks',learnerActionId,{activityId:'code-mapping',source:'snapshot-store',factCodes:['own_blocks_snapshot_preserved']});
    });},
    settleSoftwareIncome(){return command('settle-software-income',async book=>{
      const attempt=needAttempt(book),facts=await factsFor(book,attempt);if(!facts.codeReady)fail('SOFTWARE_NOT_READY','需要当前版本的完整客户测试、变更理解和编程练习证据。');
      const key=canonicalJson({learnerId:book.learner.id,taskId:attempt.taskRef.id,kind:'software-demo-income'});
      const existing=book.ledger.find(e=>e.idempotencyKey===key);if(existing)return existing;
      const amount=policies.softwareRewardAmount??100;if(!Number.isSafeInteger(amount)||amount<1)fail('REWARD_POLICY','合成收入策略无效。');
      const event={id:id('income'),learnerId:book.learner.id,taskId:attempt.taskRef.id,attemptId:attempt.id,kind:'software-demo-income',amount,evidenceId:facts.codeEvidence.id,idempotencyKey:key,createdAt:now(),localOnly:true,synthetic:true};book.ledger.push(event);return immutable(event);
    });},
    restartOrder({graphicIntro=false}={}){return command('restart-order',book=>{const previous=needAttempt(book);previous.archived=true;const attempt=newAttempt(book,{welcomed:true,graphicIntro});book.attempts.push(attempt);book.activeAttemptId=attempt.id;});},
    resumeAttempt(attemptId){return command('resume-attempt',book=>{if(!book.attempts.some(a=>a.id===attemptId))fail('ATTEMPT_NOT_FOUND','找不到该本机作品。');book.activeAttemptId=attemptId;});},
    exportArchive(){return immutable({format:'eq.local-backup/1',revision,data,notice:'仅本机教学进度，不是账号、真实奖励或实物验收。'});},
    async retrySave(){await queue.catch(()=>{});const saved=await store.commit(revision,data);revision=saved.revision;saveFailure=null;externalRevision=null;await publish({status:'saved'});return view;},
    async reload(){await queue.catch(()=>{});const saved=await store.read();if(!saved)fail('LOCAL_RECORD_MISSING','本机记录已不存在，当前页面内容保留。');const restored=readArchive(saved.data);await verifyRestored(restored);data=restored;revision=saved.revision;saveFailure=null;externalRevision=null;await publish({status:'restored'});return view;},
    async close(){closed=true;await queue.catch(()=>{});unsubscribe?.();listeners.clear();await store.close?.();},
  };
  return Object.freeze(api);
}
