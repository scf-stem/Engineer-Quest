import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAFT_KEY,DRAFT_VERSION,loadDraft,saveDraft,inspectLegacyDraft} from '../../src/integration/draft-store.js';
const memory = () => { const values = new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}; };
test('draft restore is versioned and cannot persist approvals as authority', () => {
  const storage = memory();
  assert.equal(saveDraft(storage,{nickname:'合成员工',shortSource:'loop {}'}).ok,true);
  assert.equal(loadDraft(storage).draft.nickname,'合成员工');
  assert.equal(saveDraft(storage,{income:99999}).ok,false);
  storage.setItem(DRAFT_KEY,'{broken');
  assert.equal(loadDraft(storage).draft,null);
  assert.equal(storage.getItem(DRAFT_KEY),'{broken');
  assert.equal(saveDraft({setItem:()=>{throw Error('quota');}},{nickname:'甲'}).ok,false);
});
test('malformed but parseable draft is preserved and rejected before reaching the view',()=>{
  const storage=memory();
  for(const draft of [{joined:'yes'},{shortSource:{}},{wiring:{schemaVersion:'1.0',deviceProfileRef:{}}},{income:100}]){
    const raw=JSON.stringify({schemaVersion:DRAFT_VERSION,draft});storage.setItem(DRAFT_KEY,raw);
    assert.equal(loadDraft(storage).draft,null);assert.equal(storage.getItem(DRAFT_KEY),raw);
  }
});
test('legacy drafts are detected without pretending to migrate the old template to IR', () => {
  const storage = memory();
  storage.setItem('engineer-quest-prototype-v1',JSON.stringify({person:'旧员工',ast:{version:1},submitted:true}));
  assert.equal(inspectLegacyDraft(storage).schemaVersion,'legacy-template/1');
  assert.equal(loadDraft(storage).draft,null);
});
