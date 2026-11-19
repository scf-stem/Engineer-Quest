import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryProgressStore,LOCAL_PROGRESS_FORMAT} from '../../src/integration/local-progress-store.js';

test('atomic progress store preserves complete records across clients and refuses concurrent overwrite',async()=>{
  const store=createMemoryProgressStore();assert.equal(await store.read(),null);
  const original={learner:{id:'local-1'},income:[{amount:100}],tests:[{passed:false}],draft:{source:'waitMs(100);'}};
  const saved=await store.commit(0,original);original.income[0].amount=999;
  assert.equal(saved.data.income[0].amount,100);assert.equal((await store.read()).data.tests[0].passed,false);
  const results=await Promise.allSettled([store.commit(1,{...saved.data,draft:{source:'one'}}),store.commit(1,{...saved.data,draft:{source:'two'}})]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'REVISION_CONFLICT');
  assert.equal((await store.read()).revision,2);
});
test('corrupt and unknown records stay rejected instead of becoming a new empty identity',async()=>{
  for(const record of [{format:'future',revision:1,data:{},digest:'x'},{format:LOCAL_PROGRESS_FORMAT,revision:1,data:{income:999},digest:'sha256:bad'}]){
    await assert.rejects(createMemoryProgressStore(record).read(),{code:'STORAGE_CORRUPT'});
  }
});
