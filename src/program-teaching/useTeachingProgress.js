import {useEffect,useRef,useState} from 'react';
import {GRAPHIC_INTRO_KEY,graphicIntroFor} from './progression.js';

// This journal contains only teaching position/drafts. Execution authority stays in IDB actions.
export function teachingJournalKey(state){return `eq.graphic-draft.v1:${state.learner?.id}:${state.activeAttemptId}`;}
export function recoverTeachingDraft(saved,journal){
  if(!journal||!saved||journal.record?.learnerId!==saved.learnerId||journal.record?.attemptId!==saved.attemptId||journal.record?.version!==saved.version)return saved;
  const record=journal.record;
  const sameWriter=saved.writerId===record.writerId;
  const unchangedBase=saved.writerId===journal.baseWriter&&(saved.editSequence??0)===journal.baseSequence;
  const ownPendingPrefix=journal.lineage?.some(item=>item.writerId===saved.writerId&&(saved.editSequence??0)<=item.throughSequence);
  return record.editSequence>(saved.editSequence??0)&&(sameWriter||unchangedBase||ownPendingPrefix)?record:saved;
}
export function useTeachingProgress(workspace,state){
  const key=teachingJournalKey(state),saved=graphicIntroFor(state),writer=useRef(crypto.randomUUID());
  const [record,setRecord]=useState(()=>{let journal;try{journal=JSON.parse(localStorage.getItem(key));}catch{}const recovered=recoverTeachingDraft(saved,journal);return recovered?.replay.playing?{...recovered,replay:{...recovered.replay,playing:false}}:recovered;});
  const current=useRef(record),[error,setError]=useState(''),[saving,setSaving]=useState(false),pending=useRef(new Set()),initial=useRef(true);
  function journal(next,base){try{
    const previous=JSON.parse(localStorage.getItem(key));
    const ownPrefix=previous?.record?.writerId===base.writerId&&previous.record.editSequence===(base.editSequence??0);
    const prefixes=new Map();
    for(const item of [...(ownPrefix?previous.lineage??[]:[]),{writerId:base.writerId??null,throughSequence:base.editSequence??0}])prefixes.set(item.writerId,Math.max(item.throughSequence,prefixes.get(item.writerId)??0));
    const lineage=[...prefixes].map(([writerId,throughSequence])=>({writerId,throughSequence}));
    localStorage.setItem(key,JSON.stringify({record:next,baseSequence:base.editSequence??0,baseWriter:base.writerId??null,lineage:lineage.length>12?[lineage[0],...lineage.slice(-11)]:lineage}));return true;
  }catch{return false;}}
  async function persist(next){
    const request=workspace.saveLearning({[GRAPHIC_INTRO_KEY]:next});pending.current.add(request);setSaving(true);
    try{await request;setError('');try{const j=JSON.parse(localStorage.getItem(key));if(j?.record?.writerId===next.writerId&&j.record.editSequence===next.editSequence)localStorage.removeItem(key);}catch{}}
    catch(e){setError(e.message);throw e;}
    finally{pending.current.delete(request);if(!pending.current.size)setSaving(false);}
  }
  function update(patch){
    const base=current.current,next={...base,...patch,writerId:writer.current,editSequence:(base.editSequence??0)+1};
    current.current=next;setRecord(next);
    if(!journal(next,base))setError('快速恢复草稿暂不可用，请等本机保存完成后再刷新。');
    const promise=persist(next);promise.catch(()=>{});return promise;
  }
  useEffect(()=>{
    if(initial.current){initial.current=false;if(record!==saved){void persist(record).catch(()=>{});}return;}
    if(pending.current.size)return;
    if(saved&&state.storage.status==='restored'&&saved.writerId!==current.current.writerId){current.current=saved;setRecord(saved);try{localStorage.removeItem(key);}catch{}}
  },[saved,state.storage.status]);
  async function retry(){await workspace.retrySave();await persist(current.current);}
  return {record,current,update,error,saving,retry,clearError:()=>setError('')};
}
