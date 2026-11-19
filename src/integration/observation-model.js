import {canonicalJson,wiringSemantics} from '../contracts/index.js';
import {programSemantics} from './program-adapter.js';

/** Visual frames come only from recorded executor events, including real faults. */
export function observationFrames(action){
  const simulation=action?.result?.value?.simulation;
  if(!simulation?.events?.length)return [];
  const kinds=new Map();
  function walk(node){if(!node||typeof node!=='object')return;if(node.id&&node.kind)kinds.set(node.id,node.kind);for(const value of Object.values(node))if(typeof value==='object')walk(value);}
  walk(action.request?.program?.value??action.result?.value?.program);
  const frames=[];let read=null,branch=null,lamp=null,index=0;
  while(index<simulation.events.length&&frames.length<12){
    const atMs=simulation.events[index].atMs;let relevant=false;
    while(index<simulation.events.length&&simulation.events[index].atMs===atMs){
      const event=simulation.events[index++];
      if(event.kind==='read'&&event.port==='LIGHT')read=event;
      if(event.kind==='branch')branch=event;
      const output=event.outputs?.LAMP??event.outputs?.lamp;if(typeof output==='boolean')lamp=output;
      relevant||=['read','write'].includes(event.kind);
    }
    if(relevant){const frame={atMs,light:read?.value??null,readAtMs:read?.atMs??null,branch:typeof branch?.branch==='boolean'?branch.branch:null,branchKind:kinds.get(branch?.nodeId)??null,lamp};
      if(!frames.length||['light','branch','lamp'].some(key=>frame[key]!==frames.at(-1)[key]))frames.push(frame);
    }
  }
  return frames;
}
export function latestObservationAction(state,phase){
  const action=state.attempt?.learningActions.findLast(a=>a.kind==='program-action'&&a.request?.actionId!=='graphic-intro-run'&&a.request?.phase===phase&&a.result?.value?.simulation);
  const proof=state.attempt?.tests.findLast(t=>t.phase===phase),snapshot=state.attempt?.snapshots.find(s=>s.id===proof?.snapshotId);
  const simulation=proof?.report?.simulations&&Object.values(proof.report.simulations)[0];
  if(!simulation||!snapshot||action&&(phase==='blocks'||action.at>proof.createdAt))return action;
  return {id:proof.id,at:proof.createdAt,request:{phase,actionId:'customer-tests',source:snapshot.binding.source,program:{ok:true,value:snapshot.binding.program},wiring:snapshot.binding.wiring},result:{value:{simulation}}};
}
export function observationIsCurrent(action,{program,source,wiring}){
  if(!action)return false;
  try{
    if(canonicalJson(wiringSemantics(action.request.wiring))!==canonicalJson(wiringSemantics(wiring)))return false;
    if(action.request.actionId==='observe-output'||action.request.actionId==='graphic-intro-run'&&action.request.inputs.kind==='output')return true;
    if(action.request.phase==='short-cpp')return source===action.request.source;
    return program?.ok===true&&action.request.program?.ok===true&&canonicalJson(programSemantics(program.value))===canonicalJson(programSemantics(action.request.program.value));
  }catch{return false;}
}
