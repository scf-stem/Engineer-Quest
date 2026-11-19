import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {contentDigest} from '../../src/contracts/index.js';
import {LOCAL_PROGRESS_FORMAT} from '../../src/integration/local-progress-store.js';
import {freshJourney,FIRST_ORDER_SCENES} from '../../src/integration/first-order-story.js';

/** Disposable restore fixture from the actual E mouse-built archive. */
export async function restoreRecordedWorkspace(page,{atBranches=false,beforeStoryRead=false,delayedDecision=false,forSlotDrag=false,beforeStoryChange=false,guidedCompletion=false}={}){
  const backup=JSON.parse(gunzipSync(await readFile(new URL(atBranches||beforeStoryRead?'../../docs/integration/evidence/novice-walkthrough/local-backup.json.gz':'../../docs/integration/evidence/ongoing-dialogue/local-backup.json.gz',import.meta.url))));
  const data=backup.archive.data;
  if(guidedCompletion){
    // Narrative metadata only. Actual work, tests and income remain the original archive.
    const a=data.attempts.find(a=>a.id===data.activeAttemptId);a.presentation={...a.presentation,view:'income',journey:{...freshJourney(),seen:Object.fromEntries(Object.keys(FIRST_ORDER_SCENES).map(id=>[id,true]))}};
  }
  if(beforeStoryChange){
    // Explicit regression checkpoint from real own work. This is not a blank learner run.
    const a=data.attempts.find(a=>a.id===data.activeAttemptId);
    a.change=null;a.draft.shortSource='';a.currentTests['short-cpp']=null;a.tests=a.tests.filter(t=>t.phase==='blocks');
    a.reviews.change.responses=[];
    a.learningActions=a.learningActions.filter(x=>x.kind==='program-action'&&x.request.phase==='blocks'||x.kind==='customer-tests'&&x.phase==='blocks');
    const ids=new Set(a.learningActions.map(x=>x.id));a.observations=a.observations.filter(x=>ids.has(x.learnerActionId));a.observationInvalidations=[];
    a.presentation={view:'workbench',tool:'blocks',journey:{...freshJourney(),seen:{welcome:true,client:true,wiring:true,lamp:true,reading:true,branch:true,repeat:true}}};
    data.ledger=[];
  }
  if(atBranches||beforeStoryRead){
    const a=data.attempts.find(a=>a.id===data.activeAttemptId),lastRead=a.learningActions.findLastIndex(x=>x.request?.actionId==='read-input');
    a.learningActions=beforeStoryRead?a.learningActions.filter(x=>x.request?.actionId==='observe-output'):a.learningActions.slice(0,lastRead+1);const ids=new Set(a.learningActions.map(x=>x.id));
    a.observations=a.observations.filter(x=>ids.has(x.learnerActionId));a.observationInvalidations=[];
    a.tests=[];a.snapshots=[];a.currentTests={blocks:null,'short-cpp':null};a.change=null;a.draft.shortSource='';
    data.ledger=[];data.events=[];
    a.presentation={view:'workbench',tool:'blocks'};
    if(beforeStoryRead){a.reviews.change.responses=[];a.presentation.journey={...freshJourney(),seen:{welcome:true,client:true,wiring:true,lamp:true,reading:true}};}
    // This explicit checkpoint fixture is a regression setup, not another novice run.
  }
  let dragMetadata;
  if(delayedDecision){
    // An intentionally rearranged regression fixture, not a novice's completed work.
    const a=data.attempts.find(a=>a.id===data.activeAttemptId),state=a.draft.blockState.workspace??a.draft.blockState;
    const assignment=state.blocks.blocks[0].inputs.LOOP.block,decision=assignment.next.block,wait=decision.next.block;
    if(assignment.type!=='eqp_set'||decision.type!=='controls_if'||wait.type!=='eqp_wait')throw new Error('Recorded fixture no longer has read → if → wait.');
    const after=wait.next;if(after)decision.next=after;else delete decision.next;wait.next={block:decision};assignment.next={block:wait};
  }
  if(forSlotDrag){
    const a=data.attempts.find(a=>a.id===data.activeAttemptId),state=a.draft.blockState.workspace??a.draft.blockState;
    function find(block,type){if(!block)return null;if(block?.type===type)return block;for(const input of Object.values(block?.inputs??{})){const match=find(input.block,type);if(match)return match;}return find(block?.next?.block,type);}
    const compare=find(state.blocks.blocks[0],'logic_compare'),variable=compare.inputs.A.block;delete compare.inputs.A;
    variable.x=680;variable.y=300;state.blocks.blocks.push(variable);dragMetadata={variableId:variable.id,compareId:compare.id,ifId:find(state.blocks.blocks[0],'controls_if').id};
    // A deliberately unfinished drag fixture, derived from the real archive. No grading grant.
  }
  const record={format:LOCAL_PROGRESS_FORMAT,revision:backup.archive.revision,data,digest:await contentDigest(data)};
  await page.goto('/legacy.html');
  await page.evaluate(record=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('engineer-quest-local-progress-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put(record,'workspace');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};
  }),record);await page.goto('/sandbox.html');return dragMetadata;
}
