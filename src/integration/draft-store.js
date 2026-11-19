import {canonicalJson} from '../contracts/index.js';

export const DRAFT_VERSION = 'eq.draft/2';
export const DRAFT_KEY = 'engineer-quest-local-draft-v2';
const MAX_BYTES = 1_000_000;
const allowed = ['nickname','joined','requirementCard','wiring','blockState','shortSource','stage','orderClaimed'];
const record = value => value && typeof value==='object'&&!Array.isArray(value);
function assertDraft(draft) {
  if (!record(draft) || Object.keys(draft).some(k=>!allowed.includes(k))) throw new Error('不支持的草稿字段');
  for (const key of ['joined','orderClaimed']) if (draft[key]!==undefined&&typeof draft[key]!=='boolean') throw new Error('无效身份草稿');
  for (const [key,max] of [['nickname',24],['shortSource',24000],['stage',100]]) if(draft[key]!==undefined&&(typeof draft[key]!=='string'||draft[key].length>max)) throw new Error('无效文本草稿');
  if(draft.requirementCard!==undefined&&(!record(draft.requirementCard)||Object.values(draft.requirementCard).some(v=>typeof v!=='string'||v.length>1500)))throw new Error('无效方案卡草稿');
  if(draft.blockState!==undefined&&draft.blockState!==null&&!record(draft.blockState))throw new Error('无效积木草稿');
  if(draft.wiring!==undefined){
    const w=draft.wiring;
    if(!record(w)||typeof w.schemaVersion!=='string'||!record(w.deviceProfileRef)||!Array.isArray(w.components)||!Array.isArray(w.connections)||w.components.length>12||w.connections.length>64)throw new Error('无效接线草稿');
    if(w.components.some(c=>!record(c)||typeof c.instanceId!=='string'||!record(c.typeRef)||!Number.isFinite(c.position?.x)||!Number.isFinite(c.position?.y))||w.connections.some(c=>!record(c)||!['id','from','to'].every(k=>typeof c[k]==='string')))throw new Error('无效接线内容');
  }
}

/** Drafts only: never restore test approvals, accounts or ledger authority from storage. */
export function loadDraft(storage, key = DRAFT_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return {draft:null, notice:''};
    if (raw.length > MAX_BYTES) throw new Error('草稿过大');
    const envelope = JSON.parse(raw);
    if (envelope.schemaVersion !== DRAFT_VERSION || !envelope.draft || typeof envelope.draft !== 'object' || Array.isArray(envelope.draft)) throw new Error('草稿版本不支持');
    assertDraft(envelope.draft);
    canonicalJson(envelope.draft);
    return {draft:envelope.draft, notice:'已恢复本机草稿；当前版本需要重新测试。'};
  } catch {
    return {draft:null, notice:'无法读取本机草稿。原存储保留，请从订单重新开始。'};
  }
}

export function saveDraft(storage, draft, key = DRAFT_KEY) {
  try {
    assertDraft(draft);
    const raw = canonicalJson({schemaVersion:DRAFT_VERSION, draft});
    if (raw.length > MAX_BYTES) throw new Error('草稿过大');
    storage.setItem(key,raw);
    return {ok:true, notice:''};
  } catch {
    return {ok:false, notice:'本机草稿保存失败，请保持页面打开并导出当前源码。'};
  }
}

export function inspectLegacyDraft(storage) {
  try {
    const raw = storage.getItem('engineer-quest-prototype-v1');
    if (!raw || raw.length > MAX_BYTES) return null;
    const old = JSON.parse(raw);
    if (typeof old.person !== 'string') return null;
    return {schemaVersion:'legacy-template/1', nickname:old.person, message:'检测到旧模板草稿；保留原记录，不将其当作新程序或当前通关证据。'};
  } catch { return null; }
}
