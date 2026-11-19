import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,LESSON_IDS,TUTORIAL_VERSION,activeLesson,createTutorialSession,restoreTutorialSession,tutorialFactsFromQuest,tutorialTransition,tutorialView,taskFeedback,firstFailure} from '../../src/tutorial/index.js';

const plan={joined:true,claimed:true};
const wired={...plan,cardSaved:true,wiringValid:true};
const passed={passed:true,cases:[{passed:true}]};
test('lesson is derived solely from current work facts',()=>{
  const cases=[ [{},'welcome'],[plan,'plan'],[{...plan,cardSaved:true},'wiring'],[wired,'blocks'],[{...wired,baseCurrent:true,baseReport:passed},'handover'],[{...wired,hasCode:true},'change'],[{...wired,hasCode:true,codeCurrent:true,codeReport:passed},'delivery'],[{...wired,hasCode:true,codeCurrent:true,codeReport:passed,incomeRecorded:true},'done'] ];
  for(const [facts,id] of cases)assert.equal(activeLesson(facts),id);
});
test('old passes never advance teaching; broken dependencies take priority',()=>{
  assert.equal(activeLesson({...wired,baseReport:passed}), 'blocks');
  assert.equal(activeLesson({...wired,hasCode:true,codeReport:passed}), 'change');
  assert.equal(activeLesson({...wired,hasCode:true,codeCurrent:true,codeReport:passed,wiringValid:false,incomeRecorded:true}), 'wiring');
  assert.equal(activeLesson({...wired,cardSaved:false,hasCode:true,codeCurrent:true,codeReport:passed}), 'plan');
});
test('explicit E milestone readiness is strict and cannot be replaced by a customer pass',()=>{
  const base={...wired,baseCurrent:true,baseReport:passed};
  const code={...wired,hasCode:true,codeCurrent:true,codeReport:passed};
  for(const value of [false,undefined,null,1,'true']){
    assert.equal(activeLesson({...base,baseReady:value}),'blocks');assert.equal(activeLesson({...code,codeReady:value}),'change');
  }
  assert.equal(activeLesson({...base,baseReady:true}),'handover');assert.equal(activeLesson({...code,codeReady:true}),'delivery');
  assert.equal(activeLesson(base),'handover');assert.equal(activeLesson(code),'delivery');
  assert.match(taskFeedback('blocks',{...base,baseReady:false}).text,/软件测试已通过/);
  assert.equal(Object.hasOwn(tutorialFactsFromQuest({}),'baseReady'),false);
  assert.equal(tutorialFactsFromQuest({baseReady:'true',codeReady:1}).baseReady,false);
  const learning={...code,codeReady:false,requirementReview:{stageId:'short-code',status:'ready',readyForPractice:true,readyToAdvance:true},guidance:{checkpointId:'explain-response',diagnostic:{code:'LEARNING_PENDING',message:'结合当前轨迹说明重新读取的位置。'},actionTarget:{type:'learning-check',targetId:'explain-response'}}};
  assert.equal(taskFeedback('change',learning).diagnostic.code,'LEARNING_PENDING');
  assert.equal(taskFeedback('change',{...learning,guidance:null}).status,'软件测试通过，学习检查待完成');
});
test('host adapter ignores story approvals and reads actual topology',()=>{
  const f=tutorialFactsFromQuest({joined:true,claimed:true,cardSaved:true,topology:{ok:false,diagnostics:[{code:'POWER_SHORT',severity:'error'}]},wiring:{connections:[{}]},source:'x',ledger:{events:[]},storyPassed:true});
  assert.equal(f.wiringValid,false);assert.equal(f.incomeRecorded,false);assert.equal(activeLesson(f),'wiring');
});
test('D situational review blocks legacy card coverage and projects exact diagnostic',()=>{
  const requirementReview={status:'needs-help',checkpointId:'signal-input',readyForPractice:false,readyToAdvance:false,challenge:{prompt:'怎样知道环境变暗？',options:[{optionId:'not-sure',label:'不确定'}]},diagnostic:{code:'LOCAL_PRACTICE',message:'先比较两次光照记录。',observedFact:'你选择了不确定。',manualSection:'03.1'},actionTarget:{stageId:'requirements'},retryAction:{checkpointId:'input-local'}};
  const facts={...wired,requirementReview};assert.equal(activeLesson(facts),'plan');
  const feedback=taskFeedback('plan',facts);assert.equal(feedback.text,requirementReview.diagnostic.message);assert.equal(feedback.manualSection,'03.1');assert.deepEqual(feedback.actionTarget,requirementReview.actionTarget);assert.equal(feedback.observedFact,'你选择了不确定。');
  assert.equal(activeLesson({...facts,hasCode:true,codeCurrent:true,codeReport:passed}),'change');
  assert.equal(activeLesson({...facts,requirementReview:{status:'ready',readyForPractice:true,readyToAdvance:true}}),'blocks');
  assert.equal(activeLesson({...facts,requirementReview:{status:'stale',readyForPractice:true,readyToAdvance:true}}),'plan');
});
test('controller guidance is read only and carries navigation intent without executing it',()=>{
  const facts={...wired,guidance:{checkpointId:'rerun',diagnostic:{code:'EVIDENCE_STALE',message:'当前接线已修改。',observedFact:{revision:3},manualSection:'09.1'},retryAction:{id:'rerun'},actionTarget:'tests'}};
  const before=JSON.stringify(facts);let s=tutorialTransition(createTutorialSession(),{type:'skip'},facts);for(let i=0;i<10;i++)s=tutorialTransition(s,{type:'next'},facts);assert.equal(JSON.stringify(facts),before);assert.equal(taskFeedback('blocks',facts).checkpointId,'rerun');
});
test('actual D public facts preserve scene, local guidance, current checkpoint and navigation without authority',()=>{
  const summary={status:'needs-help',stageId:'requirements',checkpointId:'req-light-input',current:{checkpointId:'req-light-input',title:'先找到会变化的信息',number:1,total:6},readyForPractice:false,readyToAdvance:false,challenge:{prompt:'需要读取哪项信息？',scene:{description:'从窗边移进阴影。'},options:[{optionId:'not-sure',label:'我还不确定'}],manualSection:'03.1'},diagnostic:{code:'REQ_SUPPORT_REQUESTED',message:'先做当前小观察，再重试这一题。',observedFact:'学生选择了还不确定。',manualSection:'03.1'},guidance:{id:'guide-input',title:'比较同一时刻的两个位置',observation:'时间相同，光照不同。',tryThis:'指出真正改变的信息，再重试。'},retryAction:{type:'observe-and-retry',label:'做小观察，再试当前情境',targetId:'req-light-input',checkpointId:'req-light-input'},actionTarget:{type:'requirement-challenge',targetId:'req-light-input',checkpointId:'req-light-input'}};
  const facts={...wired,hasCode:true,requirementReview:summary};assert.equal(activeLesson(facts),'plan');const feedback=taskFeedback('plan',facts);
  assert.deepEqual(feedback.practice,summary.guidance);assert.deepEqual(feedback.current,summary.current);assert.deepEqual(feedback.challenge.scene,summary.challenge.scene);assert.deepEqual(feedback.retryAction,summary.retryAction);assert.equal(feedback.actionLabel,'去做小观察并重试');assert.equal(feedback.evidence,undefined);
  assert.equal(activeLesson({...wired,hasCode:false,requirementReview:{...summary,stageId:'short-code'}}),'change');
  const ready={...summary,status:'ready',readyForPractice:true,readyToAdvance:true,challenge:null,current:null,guidance:null};assert.equal(taskFeedback('plan',{...wired,cardSaved:false,requirementReview:ready}).status,'当前情境已完成');
});
test('next and choices only move the narrative and do not mutate frozen business facts',()=>{
  const facts=Object.freeze({...plan,card:Object.freeze({})});
  let s=createTutorialSession();s=tutorialTransition(s,{type:'open'},facts);s=tutorialTransition(s,{type:'next'},facts);
  assert.equal(tutorialView(s,facts).line.id,'repeat');
  s=tutorialTransition(s,{type:'next'},facts);assert.equal(tutorialView(s,facts).line.id,'repeat');
  s=tutorialTransition(s,{type:'choose',id:'once'},facts);assert.equal(tutorialView(s,facts).feedback.correct,false);
  assert.equal(tutorialTransition(s,{type:'next'},facts),s);
  s=tutorialTransition(s,{type:'choose',id:'repeat'},facts);s=tutorialTransition(s,{type:'next'},facts);
  assert.equal(tutorialView(s,facts).line.id,'save');assert.equal(facts.cardSaved,undefined);
});
test('unknown actions/options are inert',()=>{
  const s=createTutorialSession();assert.equal(tutorialTransition(s,{type:'approve-and-pay'},plan),s);assert.equal(tutorialTransition(s,{type:'choose',id:'anything'},plan),s);assert.equal(tutorialTransition(s,{type:'review',id:'__proto__'},plan),s);
});
test('skip reaches operation goal and never skips business prerequisites',()=>{
  let s=tutorialTransition(createTutorialSession(),{type:'skip'},plan);assert.equal(tutorialView(s,plan).atTask,true);
  for(let i=0;i<50;i++)s=tutorialTransition(s,{type:'next'},plan);
  assert.equal(activeLesson(plan),'plan');assert.equal(tutorialView(s,plan).slot.index,LESSONS.plan.lines.length);
});
test('pause, reopen and review retain line and answers while new facts change active chapter',()=>{
  let s=tutorialTransition(createTutorialSession(),{type:'next'},plan);
  s=tutorialTransition(s,{type:'choose',id:'repeat'},plan);s=tutorialTransition(s,{type:'close'},plan);s=tutorialTransition(s,{type:'open'},plan);
  assert.equal(tutorialView(s,plan).feedback.id,'repeat');
  assert.equal(tutorialView(s,{...plan,cardSaved:true}).id,'wiring');
  s=tutorialTransition(s,{type:'review',id:'plan'},wired);assert.equal(tutorialView(s,wired).reviewing,true);
  s=tutorialTransition(s,{type:'resume'},wired);assert.equal(tutorialView(s,wired).id,'blocks');
});
test('replay resets only the selected teaching slot',()=>{
  let s=tutorialTransition(createTutorialSession(),{type:'skip'},plan);s=tutorialTransition(s,{type:'skip'},wired);s=tutorialTransition(s,{type:'replay'},wired);
  assert.equal(s.slots.plan.index,LESSONS.plan.lines.length);assert.equal(s.slots.blocks.index,0);
});
test('restore sanitizes damaged and mismatched memory',()=>{
  for(const raw of ['{','null','[]','{"version":"old"}',null])assert.deepEqual(restoreTutorialSession(raw),createTutorialSession());
  const s=restoreTutorialSession({version:TUTORIAL_VERSION,open:true,review:'delivery',slots:{plan:{index:999,answers:{repeat:'repeat',injected:'passed'}},blocks:{index:-10},change:{index:'99',answers:{predict500:'unknown'}},delivery:{index:Infinity}}});
  assert.equal(s.open,false);assert.equal(s.review,null);assert.equal(s.slots.plan.index,LESSONS.plan.lines.length);assert.deepEqual(s.slots.plan.answers,{repeat:'repeat'});assert.equal(s.slots.blocks.index,0);assert.equal(s.slots.change.index,0);assert.equal(activeLesson(plan),'plan');
});
for(const code of ['POWER_SHORT','NET_CONFLICT','SENSOR_POWER_MISSING','SENSOR_GROUND_MISSING','SENSOR_PIN_MISMATCH','LED_GROUND_MISSING','LED_POLARITY_REVERSED','LED_SERIES_RESISTOR_MISSING','RESISTOR_BYPASSED','UNMAPPED_PIN','DEVICE_PROFILE_MISMATCH'])test(`specific wiring help: ${code}`,()=>{
  const feedback=taskFeedback('wiring',{connectionCount:2,wiringDiagnostics:[{code,severity:'error',message:'实际诊断',terminalIds:['uno:A0']}]});assert.equal(feedback.diagnostic.code,code);assert.ok(feedback.text.length>25);assert.deepEqual(feedback.diagnostic.terminalIds,['uno:A0']);
});
test('empty wiring remains neutral; urgent faults outrank missing connections',()=>{
  assert.equal(taskFeedback('wiring',{}).status,'待连接');
  assert.equal(taskFeedback('wiring',{connectionCount:1,wiringDiagnostics:[{code:'SENSOR_POWER_MISSING',severity:'error'},{code:'POWER_SHORT',severity:'error'}]}).diagnostic.code,'POWER_SHORT');
});
test('feedback follows actual first failed assertion without fabricating success',()=>{
  const report={passed:false,cases:[{name:'输入500',passed:false,assertions:[{atMs:200,expected:true,actual:false,passed:false}]}]};
  assert.equal(firstFailure(report).name,'输入500');
  const feedback=taskFeedback('change',{codeCurrent:true,codeReport:report});assert.match(feedback.text,/客户期望灯亮，实际灭/);assert.equal(feedback.failure.atMs,200);
  assert.match(taskFeedback('change',{codeCurrent:false,codeReport:passed}).text,/修改前/);
  assert.match(taskFeedback('blocks',{pending:true}).text,/正在运行实际/);
});
test('every chapter has concise lines, manual and operation target; every choice has specific feedback',()=>{
  for(const id of LESSON_IDS){const l=LESSONS[id];assert.ok(l.stage&&l.manual&&l.action);assert.ok(l.lines.length<=4);for(const line of l.lines){assert.ok(line.text.length<150);if(line.options){assert.ok(line.options.some(o=>o.correct));assert.ok(line.options.every(o=>o.feedback.length>20));}}}
});
