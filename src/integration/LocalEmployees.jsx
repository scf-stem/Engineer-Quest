import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createIndexedDbProgressStore} from './local-progress-store.js';
import './storyline.css';

/** Directory contains labels and a last selection only. Work authority stays in each original record. */
export function LocalEmployees({children}){
  const [directory,setDirectory]=useState(null),[error,setError]=useState('');
  const store=useRef(null),record=useRef(null),queue=useRef(Promise.resolve());
  useEffect(()=>{
    let alive=true;const catalog=createIndexedDbProgressStore({recordKey:'employee-directory'});store.current=catalog;
    (async()=>{
      const saved=await catalog.read();let data=saved?.data;
      if(saved&&(!data||data.version!=='eq.local-employees/1'||!Array.isArray(data.profiles)))throw new Error('员工选择记录无法读取。原作品保留，请先保留本页并重试。');
      if(!data){
        const legacy=createIndexedDbProgressStore();let old;try{old=await legacy.read();}finally{await legacy.close();}
        data={version:'eq.local-employees/1',activeKey:'workspace',profiles:old?.data.learner?[{key:'workspace',nickname:old.data.learner.nickname,learnerId:old.data.learner.id}]:[]};
      }
      if(alive){record.current={revision:saved?.revision??0,data};setDirectory(data);}
    })().catch(e=>alive&&setError(e.message));
    return()=>{alive=false;void queue.current.finally(()=>catalog.close()).catch(()=>{});};
  },[]);
  const change=useCallback(mutate=>{
    const task=queue.current.catch(()=>{}).then(async()=>{
      const current=record.current;if(!current)throw new Error('员工选择还没有读取完成。');
      const data=mutate(structuredClone(current.data)),saved=await store.current.commit(current.revision,data);
      record.current=saved;setDirectory(saved.data);setError('');return true;
    });queue.current=task;return task.catch(e=>{setError(e.message);return false;});
  },[]);
  const onLearner=useCallback(learner=>{
    if(!learner)return;
    const current=record.current?.data,key=current?.activeKey;
    if(!key||current.profiles.some(p=>p.key===key&&p.learnerId===learner.id&&p.nickname===learner.nickname&&(p.createdAt??null)===(learner.createdAt??null)))return;
    void change(data=>{
      const profile={key,learnerId:learner.id,nickname:learner.nickname,...(typeof learner.createdAt==='string'?{createdAt:learner.createdAt}:{})};
      const index=data.profiles.findIndex(p=>p.key===key);
      if(index<0)data.profiles.push(profile);else data.profiles[index]={...data.profiles[index],...profile};
      return data;
    });
  },[change]);
  const create=()=>change(data=>{const key='employee:'+crypto.randomUUID();return {...data,activeKey:key,profiles:[...data.profiles,{key,nickname:'新员工 · 待报到',learnerId:null}]};});
  if(!directory)return <div className="eq-employee-loading" role="status"><h1>微光 · 员工工位</h1><p>{error||'正在打开本机工作档案…'}</p></div>;
  return <>{error&&<div className="eq-employee-error" role="alert">{error} 当前作品未删除。<button type="button" onClick={async()=>{try{const saved=await store.current.read(),activeKey=record.current.data.activeKey;record.current={...saved,data:{...saved.data,activeKey}};setDirectory(record.current.data);setError('');}catch(e){setError(e.message);}}}>重读员工选择</button></div>}
    {directory.activeKey?children({recordKey:directory.activeKey,onLearner,onExit:()=>change(data=>({...data,activeKey:null}))}):<main className="eq-employee-select"><img className="eq-employee-background" src="/art/eq-night-lab-v2.webp" alt="微光研发室"/><section><p>WEIGUANG / 员工工位</p><h1>回到自己的作品。</h1><p>本机员工分别保存。按工位继续原作品；同一个昵称也可能属于不同工位。</p><div className="eq-employee-list">{directory.profiles.map((profile,index)=><button type="button" key={profile.key} onClick={()=>change(data=>({...data,activeKey:profile.key}))}><strong>{profile.nickname}</strong><small>本机工位 {index+1}{profile.createdAt&&Number.isFinite(Date.parse(profile.createdAt))?` · 领证 ${new Date(profile.createdAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`:''}</small><span>{profile.learnerId?'继续这个工位 →':'继续领取员工证 →'}</span></button>)}</div><button className="eq-story-primary" type="button" onClick={create}>新员工报到 →</button><small>仅保存在这个浏览器，无需真实姓名。</small></section></main>}
  </>;
}
