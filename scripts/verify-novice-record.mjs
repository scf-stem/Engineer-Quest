import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createRef,textDigest,canonicalJson} from '../src/contracts/index.js';
import {createHardwareContext} from '../src/integration/hardware-adapter.js';
import {createProgramContext} from '../src/integration/program-adapter.js';
import {createWorkspacePolicies} from '../src/integration/learning-policy-adapter.js';
import {createMemoryProgressStore} from '../src/integration/local-progress-store.js';
import {openLocalWorkspace} from '../src/integration/local-workspace.js';

// Replays the exported REAL mouse-built record. This script does not make a new
// learner pass, load an example, or replace independent teaching observation.
const refinement=process.argv.includes('--refinement'),dialogue=process.argv.includes('--dialogue'),workbench=process.argv.includes('--workbench'),currentRun=dialogue||workbench;
const folder=new URL(workbench?'../docs/integration/evidence/third-review-workbench/':dialogue?'../docs/integration/evidence/ongoing-dialogue/':refinement?'../docs/integration/evidence/experience-refinement/':'../docs/integration/evidence/novice-walkthrough/',import.meta.url);
const raw=gunzipSync(await readFile(new URL('local-backup.json.gz',folder)));
const backup=JSON.parse(raw),book=backup.archive.data;
assert.equal(book.learner.nickname,'整合独立审查');
const root=new URL('../docs/manual/',import.meta.url);
const documents={},attachments={};
for(const file of await readdir(root))if(file.endsWith('.md'))documents[file]=await readFile(new URL(file,root),'utf8');
for(const dir of ['assets','examples'])for(const file of await readdir(new URL(dir+'/',root))){
  if((dir==='assets'&&file.endsWith('.svg'))||(dir==='examples'&&file.endsWith('.cpp')))attachments[dir+'/'+file]=await readFile(new URL(dir+'/'+file,root),'utf8');
}
const currentManualRef=await createRef('eq-student-manual','0.2.0-local-full',{schemaVersion:'eq.manual-bundle/1',documents,attachments});
const recordedAttempt=book.attempts.find(a=>a.id===book.activeAttemptId),archivedManualRef=recordedAttempt.snapshots.at(-1).binding.manualRef;
const manualMatchesCurrent=canonicalJson(currentManualRef)===canonicalJson(archivedManualRef);
if(currentRun)assert.equal(manualMatchesCurrent,true,'Current archive needs actual tests against the current full manual');
if(!currentRun&&!manualMatchesCurrent){
  const revision=refinement?'2ef1fed':'29a9f0f',options={cwd:new URL('../',import.meta.url),encoding:'utf8'},historical={schemaVersion:'eq.manual-bundle/1',documents:{},attachments:{}};
  // -z avoids Git's filename quoting for the authored Chinese paths.
  const names=execFileSync('git',['ls-tree','-rz','--name-only',revision,'docs/manual/'],options).split('\0').filter(Boolean);
  for(const path of names){const relative=path.replace('docs/manual/','');if(!/^[^/]+\.md$|^(assets\/[^/]+\.svg|examples\/[^/]+\.cpp)$/.test(relative))continue;
    const target=relative.includes('/')?historical.attachments:historical.documents;target[relative]=execFileSync('git',['show',revision+':'+path],options);
  }
  assert.deepEqual(await createRef('eq-student-manual','0.2.0-local-full',historical),archivedManualRef);
}
// The original run remains historical evidence; never relabel it with a new manual hash.
const manualRef=currentRun?currentManualRef:archivedManualRef;
const context=await createProgramContext(await createHardwareContext(),{manualRef});
const store=createMemoryProgressStore();await store.commit(0,book);
const work=await openLocalWorkspace({programContext:context,policies:await createWorkspacePolicies(context),store});
try{
  const state=work.getState(),attempt=state.attempt;
  assert.equal(state.stage,'software-complete');assert.equal(state.facts.codeReady,true);
  assert.equal(state.ledger.income,100);assert.equal(state.ledger.events.length,1);
  assert.deepEqual(attempt.tests.map(t=>t.report.passed),workbench?[true,false,true,false,true,true,true,true,true,true,true,true]:dialogue?[true,false,true,false,true,true,true,true,true,true]:refinement?[true,false,true,false,true,true,true,true]:[true,false,true]);
  if(!currentRun&&!refinement)assert.equal(attempt.observationInvalidations.length,0);
  assert.equal(attempt.draft.support.kind,'manual');
  assert.ok(attempt.learningActions.some(a=>a.request?.actionId==='read-input'&&a.result.value?.simulation?.status!=='completed'));
  assert.equal(attempt.draft.wiring.connections.length,6);
  assert.equal(state.facts.requirements.readyToAdvance,true);assert.equal(state.facts.changeRequirements.readyToAdvance,true);
  assert.equal(state.facts.learning.learningComplete,true);
  const proof=state.facts.codeEvidence,snapshot=attempt.snapshots.find(s=>s.id===proof.snapshotId);
  assert.deepEqual(snapshot.binding.manualRef,manualRef);
  const generated=context.arduino(snapshot.binding.program);assert.equal(generated.ok,true);
  assert.equal(generated.value.source,await readFile(new URL(workbench?'engineer-quest-current.ino':'own-candidate.ino',folder),'utf8'));
  await work.settleSoftwareIncome();assert.equal(work.getState().ledger.income,100);
  const result={scope:workbench?'Replay of E actual third-review workbench inspection and change coaching on an existing own work; latest independent blank experience re-review pending':dialogue?'Replay of E actual ongoing dialogue, current manual retests and immediate note recovery; independent teaching signoff pending':refinement?'Replay of E actual revision/recheck and player-receipt record; independent experience re-review pending':'Replay of E independent blank mouse-built UI record; not real student or hardware acceptance',
    archiveDigest:await textDigest(raw.toString('utf8')),manualRef,currentManualRef,manualMatchesCurrent,learnerId:state.learner.id,attemptId:attempt.id,
    tests:attempt.tests.map(t=>({phase:t.phase,passed:t.report.passed,invalidReason:t.invalidReason})),
    learning:state.facts.learning.checkpoints.map(c=>({id:c.id,state:c.state})),
    observedActions:attempt.learningActions.map(a=>a.request?.actionId??a.kind),income:100,
    generatedSourceMatchesDownload:true,targetCompile:'not_run',physicalUpload:'not_run'};
  await writeFile(new URL(currentRun?'replay-result.json':'historical-replay-result.json',folder),JSON.stringify(result,null,2)+'\n');
  console.log(currentRun?`PASS: current-manual ${workbench?'workbench':'dialogue'} record restores actual learning, ${attempt.tests.length} reports, six wires, exact source and one 100 EC entry.`:`PASS: historical ${refinement?'2ef1fed':'29a9f0f'} UI record replays against its own manual; current manual matches: ${manualMatchesCurrent}.`);
}finally{await work.close();}
