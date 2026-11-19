import {canonical, exact, fail, isRecord, result, unwrap} from './common.js';
import {blocksToProgram} from './blocks.js';
import {parseShortCpp} from './parser.js';
import {simulate, evaluate} from './simulate.js';
import {validateProgram} from './validate.js';
import {createProgramLearningMap} from './learning-map.js';

// Teaching probes are synthetic, fixed and separate from D's customer suites.
const responseTest={id:'learning-response',requirementId:'synthetic-learning',inputTimeline:[{atMs:0,signals:{LIGHT:150}},{atMs:40,signals:{LIGHT:850}},{atMs:160,signals:{LIGHT:449}},{atMs:260,signals:{LIGHT:450}}],assertions:[{atMs:0,output:'LAMP',equals:true},{atMs:100,output:'LAMP',equals:false},{atMs:200,output:'LAMP',equals:true},{atMs:300,output:'LAMP',equals:false}],maxSteps:2000,maxTimeMs:300};
const EXERCISES=[
  {id:'first-output',title:'先让一个动作生效',goal:'在持续执行里写入灯状态，并让程序等待后继续。',instructions:['从空白拖入一个程序入口。','在「持续执行」里连接数字输出：LAMP 设为 true。','在后面接等待，给出 100 毫秒，然后预测并运行。'],checkpoint:{atMs:0,output:'LAMP',question:'程序执行第一个动作后，灯会亮还是灭？'},tests:[{id:'learning-first-output',requirementId:'synthetic-learning',inputTimeline:[],assertions:[{atMs:0,output:'LAMP',equals:true},{atMs:100,output:'LAMP',equals:true}],maxSteps:500,maxTimeMs:100}]},
  {id:'follow-light',title:'从输入走到分支',goal:'低于 450 时亮，否则灭；输入变化后仍能继续响应。',instructions:['保留入口，加入读取 LIGHT 与比较条件。','给「如果」与「否则」分别连接输出；不要只在启动时读一次。','每次检查后等待 100 毫秒；先预测 100ms 的结果，再看固定输入和实际轨迹。'],checkpoint:{atMs:100,output:'LAMP',question:'40ms 输入已经变为 850；100ms 这份程序的灯会怎样？'},tests:[responseTest]},
  {id:'repair-stale-read',title:'找出读数为什么不再更新',goal:'保留一次真实失败，定位最近读取，再修改代码修复。',instructions:['打开含一个故障的练习程序，先预测并运行，不要先改。','在失败场景中查看最近读取：它发生在启动时，还是每次检查时？','对照 setup 与 loop 的映射，把需要重复的动作放在正确位置；重新预测、运行并保留两个版本。'],checkpoint:{atMs:100,output:'LAMP',question:'先按当前代码预测：光照已变亮，100ms 的灯真的会关闭吗？'},tests:[responseTest]},
  {id:'hold-between-bounds',title:'用代码保留中间状态',goal:'读数小于 400 开灯，大于 600 关灯；400…600 保持上一次状态。',instructions:['这是新的教学练习，不替换原客户订单。','需要区分「应该开」「应该关」「保持原状」；只改一个阈值不能表达这三种情况。','用已有简写 C++ 组合判断与输出；预测中间区间的状态，运行并检查两个不同历史。'],checkpoint:{atMs:200,output:'LAMP',question:'先在 350 开灯，再到 400 和 600；200ms 应保持什么状态？'},tests:[{id:'learning-hold-history',requirementId:'synthetic-learning',inputTimeline:[{atMs:0,signals:{LIGHT:350}},{atMs:100,signals:{LIGHT:400}},{atMs:200,signals:{LIGHT:600}},{atMs:300,signals:{LIGHT:650}},{atMs:400,signals:{LIGHT:600}},{atMs:500,signals:{LIGHT:400}},{atMs:600,signals:{LIGHT:350}}],assertions:[{atMs:0,output:'LAMP',equals:true},{atMs:100,output:'LAMP',equals:true},{atMs:200,output:'LAMP',equals:true},{atMs:300,output:'LAMP',equals:false},{atMs:400,output:'LAMP',equals:false},{atMs:500,output:'LAMP',equals:false},{atMs:600,output:'LAMP',equals:true}],maxSteps:4000,maxTimeMs:600}]},
];
const BUG_SOURCE=`int light = 0;
void setup() {
  light = readAnalog(LIGHT);
}
void loop() {
  if (light < 450) {
    writeDigital(LAMP, true);
  } else {
    writeDigital(LAMP, false);
  }
  waitMs(100);
}
`;
function exerciseFor(id){const found=EXERCISES.find(e=>e.id===id);if(!found)fail('LEARNING_EXERCISE','未知的编程练习');return found;}
export function getLearningExercises(){return EXERCISES.map(({tests,...meta})=>({...structuredClone(meta),synthetic:true}));}
export function getLearningStarter(exerciseId){return result(()=>{exerciseFor(exerciseId);if(exerciseId!=='repair-stale-read')fail('LEARNING_STARTER','这项练习从当前作品开始，没有一键填入的答案');return {source:BUG_SOURCE,origin:'bug-fixture'};});}
function readArtifact(input){
  if(['program','source','blockState'].filter(k=>input[k]!==undefined).length!==1)fail('LEARNING_ARTIFACT','提供确切程序、代码或积木中的一种');
  const program=input.source!==undefined?unwrap(parseShortCpp(input.source)):input.blockState!==undefined?unwrap(blocksToProgram(input.blockState)):input.program;
  unwrap(validateProgram(program));return program;
}
function semantics(value){
  if(Array.isArray(value))return value.map(semantics);
  if(isRecord(value))return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='sourceRange' && !(k==='id'&&Object.hasOwn(value,'kind')) && !(k==='id'&&Object.hasOwn(value,'initial'))).map(([k,v])=>[k,semantics(v)]));
  return value;
}
function identity(program){return canonical(semantics(program));}
function eventSummary(event){return event?{nodeId:event.nodeId,atMs:event.atMs,step:event.step,kind:event.kind,...(event.port?{port:event.port,value:event.value}:{}),...(event.branch!==undefined?{branch:event.branch}:{})}:null;}
function atOutput(simulation,atMs,output){let value;for(const event of simulation.events){if(event.atMs>atMs)break;value=event.outputs[output];}return value;}

/** Derives counterexamples exclusively from actual executor output and fixed assertions. */
export function explainLearningFailure(simulation,test,mapping){
  const checked=evaluate(simulation,[test]),counterexamples=[];
  if(!checked.cases[0]?.assertions.length)return {passed:false,diagnostics:[...simulation.diagnostics,...checked.diagnostics],counterexamples};
  for(const assertion of checked.cases[0].assertions.filter(a=>!a.passed).slice(0,20)){
    const prior=simulation.events.filter(e=>e.atMs<=assertion.atMs),inputs={...simulation.events[0].inputs};
    for(const frame of test.inputTimeline){if(frame.atMs>assertion.atMs)break;Object.assign(inputs,frame.signals);}
    const lastRead=prior.findLast(e=>e.kind==='read'),lastBranch=prior.findLast(e=>e.kind==='branch'),lastWrite=prior.findLast(e=>e.kind==='write'&&e.port===assertion.output);
    const focus=lastWrite??lastBranch??lastRead,link=mapping.links.find(l=>l.nodeId===focus?.nodeId);
    counterexamples.push({testId:test.id,atMs:assertion.atMs,output:assertion.output,expected:assertion.equals,actual:assertion.actual,inputs,
      lastRead:eventSummary(lastRead),lastBranch:eventSummary(lastBranch),lastWrite:eventSummary(lastWrite),
      observation:`${assertion.atMs}ms：输入 ${Object.entries(inputs).map(([k,v])=>`${k}=${v}`).join('，')}；期望${assertion.equals?'亮':'灭'}，实际${assertion.actual===undefined?'没有输出':assertion.actual?'亮':'灭'}。${lastRead?`最近一次读取在 ${lastRead.atMs}ms，读到 ${lastRead.value}。`:''}`,
      nextAction:'先查看最近读取、分支和写入对应的代码，再只修改你怀疑的一处，重新运行同一场景。',
      ...(focus?.nodeId?{nodeId:focus.nodeId}:{}),...(link?{generatedRange:link.generatedRange,...(link.originalRange?{originalRange:link.originalRange}:{})}:{})});
  }
  return {passed:checked.passed,diagnostics:checked.diagnostics,counterexamples};
}

export function runLearningExercise(input){return result(()=>{
  const exercise=exerciseFor(input.exerciseId),program=readArtifact(input),mapping=unwrap(createProgramLearningMap(program,{blockState:input.blockState}));
  const runs=exercise.tests.map(test=>{
    const simulation=unwrap(simulate(program,input.topology,test.inputTimeline,{maxSteps:test.maxSteps,maxTimeMs:test.maxTimeMs}));
    return {testId:test.id,test:structuredClone(test),simulation,evaluation:evaluate(simulation,[test]),feedback:explainLearningFailure(simulation,test,mapping)};
  });
  const sample=runs[0].simulation,checkpoint={...exercise.checkpoint,actual:sample.status==='completed'?atOutput(sample,exercise.checkpoint.atMs,exercise.checkpoint.output):undefined};
  return {exerciseId:exercise.id,synthetic:true,behaviorPassed:runs.every(r=>r.evaluation.passed),understanding:'not_assessed',program:structuredClone(program),programIdentity:identity(program),...(input.source!==undefined?{source:input.source}:{}),mapping,runs,checkpoint};
});}

const RECORD_VERSION='eq-program-learning-record/1';
const ORIGINS=['blank','example','bug-fixture','restored'];
export function createLearningRecord({origin='blank'}={}){
  if(!ORIGINS.includes(origin))fail('LEARNING_ORIGIN','未知的练习起点');
  return {schemaVersion:RECORD_VERSION,origin,support:origin==='blank'?[]:[{kind:origin,scope:'all'}],predictions:[],attempts:[],observations:[]};
}
function checkRecord(record){
  exact(record,['schemaVersion','origin','support','predictions','attempts','observations']);
  if(record.schemaVersion!==RECORD_VERSION||!ORIGINS.includes(record.origin)||!['support','predictions','attempts','observations'].every(k=>Array.isArray(record[k]))||record.attempts.length>30||record.support.length>100||record.predictions.length>100||record.observations.length>100)fail('LEARNING_RECORD','练习记录格式或预算无效');
}
export function recordLearningSupport(record,{kind,scope='all'}){return result(()=>{
  checkRecord(record);if(!['example','bug-fixture','hint','restored'].includes(kind)||typeof scope!=='string'||scope.length>100)fail('LEARNING_SUPPORT','协助记录无效');
  if(record.support.length>=100)fail('LEARNING_RECORD','协助记录达到本轮上限');
  return {...record,support:[...record.support,{kind,scope}]};
});}
export function recordLearningPrediction(record,input){return result(()=>{
  checkRecord(record);exerciseFor(input.exerciseId);if(typeof input.predicted!=='boolean')fail('LEARNING_PREDICTION','先选择你认为这份程序会产生的灯状态');
  if(record.predictions.length>=100)fail('LEARNING_RECORD','预测记录达到本轮上限');
  const program=readArtifact(input),prediction={id:`prediction-${record.predictions.length+1}`,exerciseId:input.exerciseId,predicted:input.predicted,programIdentity:identity(program),beforeAttempt:record.attempts.length};
  return {...record,predictions:[...record.predictions,prediction]};
});}
export function recordLearningAttempt(record,input){return result(()=>{
  checkRecord(record);if(record.attempts.length>=30)fail('LEARNING_RECORD','本轮最多保存 30 次完整执行；请保存本轮记录后另开练习');
  const execution=unwrap(runLearningExercise(input));
  const prediction=record.predictions.findLast(p=>p.exerciseId===input.exerciseId&&p.beforeAttempt===record.attempts.length&&p.programIdentity===execution.programIdentity);
  const attempt={id:`attempt-${record.attempts.length+1}`,...execution,supportUsed:structuredClone(record.support),prediction:prediction?{...prediction,observed:execution.checkpoint.actual,matched:execution.checkpoint.actual!==undefined&&prediction.predicted===execution.checkpoint.actual}:null};
  return {record:{...record,attempts:[...record.attempts,attempt]},attempt};
});}
export function observeLearningEvidence(record,{attemptId,testId,eventIndex}){return result(()=>{
  checkRecord(record);if(record.observations.length>=100)fail('LEARNING_RECORD','观察记录达到本轮上限');
  const attempt=record.attempts.find(a=>a.id===attemptId),run=attempt?.runs.find(r=>r.testId===testId),event=Number.isInteger(eventIndex)?run?.simulation.events[eventIndex]:null;
  if(!event||!['read','write','branch'].includes(event.kind))fail('LEARNING_OBSERVATION','请选择一次真实的读取、分支或输出事件');
  const relevant=run.feedback.counterexamples.some(c=>[c.lastRead,c.lastBranch,c.lastWrite].some(e=>e?.nodeId===event.nodeId&&e.atMs===event.atMs&&e.step===event.step));
  const observation={attemptId,testId,eventIndex,event:eventSummary(event),relevantToFailure:relevant,beforeAttempt:record.attempts.length};
  return {...record,observations:[...record.observations,observation]};
});}
export function assessLearningRecord(record){
  checkRecord(record);
  const verified=id=>record.attempts.findLast(a=>a.exerciseId===id&&a.behaviorPassed&&a.prediction);
  const failed=record.attempts.filter(a=>a.exerciseId==='repair-stale-read'&&!a.behaviorPassed&&a.prediction);
  const repair=failed.find(before=>record.observations.some(o=>o.attemptId===before.id&&o.relevantToFailure&&record.attempts.some((after,i)=>i>=o.beforeAttempt&&i>record.attempts.indexOf(before)&&after.exerciseId===before.exerciseId&&after.behaviorPassed&&after.prediction&&after.programIdentity!==before.programIdentity)));
  const steps=EXERCISES.map(exercise=>({id:exercise.id,title:exercise.title,behaviorVerified:Boolean(verified(exercise.id)),evidenceRecorded:exercise.id==='repair-stale-read'?Boolean(repair):Boolean(verified(exercise.id))}));
  return {status:steps.every(s=>s.evidenceRecorded)?'ready_for_review':'collecting_evidence',steps,supportUsed:structuredClone(record.support),hasExampleSupport:record.support.some(s=>s.kind==='example'),understanding:'not_assessed',independentCompletion:'not_established',
    message:steps.every(s=>s.evidenceRecorded)?'行为、预测和调试过程已记录，可以进行解释与回顾；这不是理解或独立完成的证明。':'继续收集真实运行与排错记录；加载示例和一次软件通过不会自动完成练习。'};
}
