import {LANGUAGE_PROFILE,parseShortCpp,blocksToProgram,generateShortCpp,generateArduino,validateProgram,simulate,inspectProgramWorkspace,explainProgramDiagnostic} from '../program/index.js';
import {canonicalJson,createRef,wiringSemantics} from '../contracts/index.js';
import {loadCourseEdition,createCourseEvaluator} from './course-adapter.js';
import {createSyntheticLab} from './synthetic-lab.js';

export function programSemantics(value){
  if(Array.isArray(value))return value.map(programSemantics);
  if(value&&typeof value==='object'&&['id','version','digest'].every(key=>Object.hasOwn(value,key)))return {...value};
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='id'&&key!=='sourceRange').map(([key,item])=>[key,programSemantics(item)]));
  return value;
}
const diagnostic=(code,message)=>({code,severity:'error',message});
export function validateExactShortSource(source,program){
  const parsed=parseShortCpp(source);
  if(!parsed.ok)return parsed;
  if(canonicalJson(programSemantics(parsed.value))!==canonicalJson(programSemantics(program)))return {ok:false,diagnostics:[diagnostic('SOURCE_PROGRAM_MISMATCH','确切文本与当前执行程序不一致，请重新解析或生成。')]};
  return {ok:true,value:parsed.value,diagnostics:[]};
}

export async function createProgramContext(hardware,{manualRef}={}){
  const languageRef=await createRef(LANGUAGE_PROFILE.ref.id,LANGUAGE_PROFILE.ref.version,{engineContract:'eq-program/0.1',nativeProfile:LANGUAGE_PROFILE,adapterVersion:'eq.program-integration/1'});
  const editions={'blocks':await loadCourseEdition('1.0.0',{manualRef}),'short-cpp':await loadCourseEdition('1.1.0',{manualRef})};
  async function topologyFor(wiring){
    const checked=hardware.validate(wiring);if(!checked.ok)return checked;
    const wiringRef=await createRef('wiring','1',wiringSemantics(wiring));
    return {ok:true,value:{deviceProfile:hardware.executionProfile,deviceProfileRef:hardware.ref,wiringRef},diagnostics:checked.diagnostics};
  }
  function simulateScenario(program,topology,inputTimeline,limits){
    const timeline=inputTimeline.map(frame=>({atMs:frame.atMs,signals:{LIGHT:frame.signals.light}}));
    const run=simulate(program,topology,timeline,limits);
    if(!run.ok)return {status:'runtime_error',simulatedUntilMs:0,events:[],diagnostics:run.diagnostics};
    const actual=run.value;
    return {status:actual.status,simulatedUntilMs:actual.completedThroughMs,totalSteps:actual.steps,events:actual.events.map(event=>({...event,outputs:{lamp:event.outputs.LAMP}})),diagnostics:actual.diagnostics};
  }
  const evaluators=Object.fromEntries(Object.entries(editions).map(([phase,edition])=>[phase,createCourseEvaluator({edition,simulate:simulateScenario,validateTopology:topologyFor,validateSource:validateExactShortSource,deviceProfileRef:hardware.ref,languageProfileRef:languageRef})]));
  async function evaluate(snapshot){
    // Objective execution only. Requirement/learning advancement belongs to the workspace.
    return evaluators[snapshot.phase](snapshot);
  }
  return {
    hardware,languageRef,editions,evaluate,topologyFor,
    // New workspace applies the current teaching gate separately from objective execution.
    evaluateSoftware:snapshot=>evaluators[snapshot.phase](snapshot),
    fromBlocks:state=>blocksToProgram(state?.workspace??state),
    inspectWorkspace:(state,options)=>inspectProgramWorkspace(state?.workspace??state,options),
    explainDiagnostic:(diagnostic,options)=>explainProgramDiagnostic(diagnostic,options),
    validateSource:validateExactShortSource,
    parse:source=>parseShortCpp(source),validate:program=>validateProgram(program,hardware.executionProfile),
    shortSource:program=>generateShortCpp(program),arduino:program=>generateArduino(program,hardware.executionProfile),
    async observe(program,wiring,light){const topology=await topologyFor(wiring);if(!topology.ok)return topology;return simulate(program,topology.value,[{atMs:0,signals:{LIGHT:light}}],{maxSteps:2000,maxTimeMs:100});},
    createSession(nickname){
      const lab=createSyntheticLab({evaluate,rewardAmount:100}); // explicit software-demo amount, separate from D's physical-delivery candidate
      const {session,student}=lab.enroll(nickname),project=lab.createProject(session,editions.blocks.refs.taskRef);
      return {lab,session,student,projectId:project.id};
    },
    async submit(identity,{phase,program,wiring,source,requirementCard}){
      const edition=editions[phase];if(!edition)throw new Error('未知编程阶段');
      const before=identity.lab.getProject(identity.session,identity.projectId);
      return identity.lab.submit(identity.session,identity.projectId,{expectedRevision:before.revision,requirementRef:edition.refs.requirementRef,testSuiteRef:edition.refs.testSuiteRef,manualRef:edition.refs.manualRef,languageProfileRef:languageRef,deviceProfileRef:hardware.ref,program,wiring,source,requirementCard,phase});
    },
  };
}
