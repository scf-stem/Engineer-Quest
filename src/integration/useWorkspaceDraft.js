import {useEffect,useRef,useState} from 'react';
import {canonicalJson} from '../contracts/index.js';
import {noteKey,readNoteJournal,writeNoteJournal,clearNoteJournal} from './note-journal.js';
const saved=status=>['saved','restored','empty'].includes(status);
function retainFields(previous,next){
  if(!previous||!next)return next;
  return Object.fromEntries(Object.entries(next).map(([key,value])=>[key,Object.hasOwn(previous,key)&&canonicalJson(value)===canonicalJson(previous[key])?previous[key]:value]));
}

// This buffer keeps text typed during a failed save. It grants no progress facts.
export function useWorkspaceDraft(workspace,state,onError){
  const initial=state.attempt?.draft??null;
  let noteStore;try{noteStore=globalThis.localStorage;}catch{/* IndexedDB status still shown */}
  const journalKey=noteKey(state.learner?.id,state.activeAttemptId);
  const [draft,setDraft]=useState(()=>{const text=readNoteJournal(noteStore,journalKey);return initial&&text!==null?{...initial,support:{...initial.support,reflection:text}}:initial;}),[pending,setPending]=useState(false),[noteRecoveryWarning,setNoteRecoveryWarning]=useState('');
  const current=useRef(draft),requests=useRef(new Set()),dirty=useRef(canonicalJson(draft)!==canonicalJson(initial));
  useEffect(()=>{if(dirty.current)void persist({support:current.current.support});},[]);
  useEffect(()=>{if(!dirty.current&&!requests.current.size&&canonicalJson(current.current)!==canonicalJson(initial)){current.current=retainFields(current.current,initial);setDraft(current.current);}},[initial]);
  function replace(next){clearNoteJournal(noteStore,journalKey,readNoteJournal(noteStore,journalKey));current.current=retainFields(current.current,next);dirty.current=false;setDraft(current.current);setPending(false);}
  async function edit(patch){
    if(!current.current)return;
    if(Object.entries(patch).every(([key,value])=>canonicalJson(value)===canonicalJson(current.current[key])))return;
    current.current={...current.current,...structuredClone(patch)};dirty.current=true;setDraft(current.current);setPending(true);
    if(Object.hasOwn(patch.support??{},'reflection'))setNoteRecoveryWarning(writeNoteJournal(noteStore,journalKey,patch.support.reflection)?'':'便签的快速恢复草稿不可用，请等“本机已保存”后再刷新。');
    await persist(patch);
  }
  async function persist(patch){
    const request=workspace.editDraft(patch);requests.current.add(request);
    try{await request;}catch(error){onError(error);}finally{
      requests.current.delete(request);
      if(!requests.current.size){
        const latest=workspace.getState();
        if(saved(latest.storage.status)&&canonicalJson(current.current)===canonicalJson(latest.attempt?.draft)){dirty.current=false;clearNoteJournal(noteStore,journalKey,current.current.support?.reflection);}
        setPending(dirty.current);
      }
    }
  }
  async function flush(){
    await Promise.allSettled([...requests.current]);
    const status=workspace.getState().storage.status;
    if(!saved(status)&&status!=='saving')throw new Error('本机保存尚未解决，请导出、重试保存或重新读取。');
    if(dirty.current){await workspace.editDraft(current.current);dirty.current=false;setPending(false);}
  }
  async function retry(){
    await Promise.allSettled([...requests.current]);
    await workspace.retrySave();
    if(current.current)await workspace.editDraft(current.current);
    replace(workspace.getState().attempt?.draft??null);
  }
  return {draft,pending,edit,flush,retry,replace,noteRecoveryWarning,getBuffered:()=>current.current};
}
