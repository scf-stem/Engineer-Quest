import {contentDigest,immutable} from '../contracts/index.js';

export const LOCAL_PROGRESS_FORMAT='eq.local-progress/1';
export const LOCAL_DATABASE='engineer-quest-local-progress-v1';

export class ProgressStoreError extends Error{
  constructor(code,message,cause){super(message,{cause});this.name='ProgressStoreError';this.code=code;}
}
const storageError=error=>error instanceof ProgressStoreError?error:new ProgressStoreError(
  error?.name==='QuotaExceededError'?'STORAGE_QUOTA':'STORAGE_UNAVAILABLE',
  error?.name==='QuotaExceededError'?'本机存储空间不足，当前页面中的修改仍保留。':'无法保存本机进度，当前页面中的修改仍保留。',error);

async function inspect(record){
  if(record===undefined||record===null)return null;
  if(record.format!==LOCAL_PROGRESS_FORMAT||!Number.isSafeInteger(record.revision)||record.revision<1||!record.data||record.digest!==await contentDigest(record.data))throw new ProgressStoreError('STORAGE_CORRUPT','本机进度格式或摘要不匹配。原记录保留，不会用空进度覆盖。');
  return immutable(record);
}
async function envelope(expectedRevision,data){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new TypeError('保存需要明确本地版本');
  const captured=immutable(data);
  return {format:LOCAL_PROGRESS_FORMAT,revision:expectedRevision+1,digest:await contentDigest(captured),data:captured};
}

/** Real browser storage. A single transaction commits progress, evidence and income together. */
export function createIndexedDbProgressStore({indexedDB=globalThis.indexedDB,databaseName=LOCAL_DATABASE,recordKey='workspace'}={}){
  let connection;
  const channel=indexedDB&&typeof BroadcastChannel==='function'?new BroadcastChannel(databaseName+':changes'+(recordKey==='workspace'?'':':'+recordKey)):null;
  const listeners=new Set();
  if(channel)channel.onmessage=event=>{if(Number.isSafeInteger(event.data?.revision))for(const listener of listeners)listener(event.data.revision);};
  function open(){
    if(!indexedDB)return Promise.reject(new ProgressStoreError('STORAGE_UNAVAILABLE','此浏览器未提供本地进度存储，请使用支持 IndexedDB 的本机浏览器。'));
    if(!connection)connection=new Promise((resolve,reject)=>{
      const request=indexedDB.open(databaseName,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records');};
      request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
      request.onerror=()=>reject(storageError(request.error));
      request.onblocked=()=>reject(new ProgressStoreError('STORAGE_BLOCKED','本机进度库正被旧页面占用，请保留当前页面并关闭旧版本后重试。'));
    });
    return connection;
  }
  return {
    async read(){
      try{
        const db=await open();
        const value=await new Promise((resolve,reject)=>{
          const tx=db.transaction('records','readonly'),request=tx.objectStore('records').get(recordKey);let result;
          request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
        });
        return await inspect(value);
      }catch(error){throw storageError(error);}
    },
    async commit(expectedRevision,data){
      const next=await envelope(expectedRevision,data);
      try{
        const db=await open();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),request=store.get(recordKey);let failure;
          request.onsuccess=()=>{
            if((request.result?.revision??0)!==expectedRevision){failure=new ProgressStoreError('REVISION_CONFLICT','另一页面已保存新进度。当前修改仍保留，请先导出或重新读取，不能直接覆盖。');tx.abort();return;}
            try{store.put(next,recordKey);}catch(error){failure=error;tx.abort();}
          };
          tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error);tx.onerror=()=>{};
        });
        channel?.postMessage({revision:next.revision});return immutable(next);
      }catch(error){throw storageError(error);}
    },
    subscribeExternal(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    async close(){listeners.clear();channel?.close();if(connection)(await connection).close();},
  };
}

/** Explicit test adapter; never selected as a silent browser fallback. */
export function createMemoryProgressStore(initial=null){
  let record=initial;
  return {
    async read(){return inspect(record);},
    async commit(expectedRevision,data){
      const next=await envelope(expectedRevision,data);
      if((record?.revision??0)!==expectedRevision)throw new ProgressStoreError('REVISION_CONFLICT','本地保存版本冲突');
      record=next;return immutable(record);
    },
    subscribeExternal(){return()=>{};},async close(){},
  };
}
