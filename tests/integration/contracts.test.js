import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson, contentDigest, createRef, wiringSemantics, textDigest} from '../../src/contracts/index.js';
import {createSyntheticLab} from '../../src/integration/synthetic-lab.js';

test('canonical SHA-256 is stable across key order and rejects lossy JSON', async () => {
  assert.equal(canonicalJson({b:2,a:1}), '{"a":1,"b":2}');
  assert.equal(canonicalJson(Object.assign(Object.create(null),{b:2,a:1})), '{"a":1,"b":2}');
  assert.equal(await contentDigest({b:2,a:1}), await contentDigest({a:1,b:2}));
  assert.equal(await contentDigest('hello'), 'sha256:5aa762ae383fbb727af3c7a36d4940a5b8c40a989452d2304fc958ff3f354e7a');
  assert.equal(await textDigest('hello'), 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  for (const bad of [NaN, Infinity, undefined, {a:undefined}, new Date(), [,1]]) assert.throws(() => canonicalJson(bad));
  const circular = {}; circular.self = circular; assert.throws(() => canonicalJson(circular));
});

test('wiring semantic comparison ignores drawing position, connection order and direction', async () => {
  const deviceProfileRef = await createRef('uno','1',{});
  const first = {schemaVersion:'1',deviceProfileRef,components:[{instanceId:'uno',typeRef:deviceProfileRef,position:{x:0,y:0}}],connections:[{id:'1',from:'UNO.A0',to:'SENSOR.AO'}]};
  const second = structuredClone(first); second.components[0].position.x = 100; second.connections = [{id:'2',from:'SENSOR.AO',to:'UNO.A0'}];
  assert.equal(await contentDigest(wiringSemantics(first)),await contentDigest(wiringSemantics(second)));
  second.connections[0].to = 'UNO.D9';
  assert.notEqual(await contentDigest(wiringSemantics(first)),await contentDigest(wiringSemantics(second)));
});

async function fixture() {
  const ref = await createRef('fixture', '1', {synthetic:true});
  const lab = createSyntheticLab({evaluate: async s => ({passed:s.program.threshold === 450,cases:[{passed:s.program.threshold === 450}]})});
  const alice = lab.enroll('合成甲'), bob = lab.enroll('合成乙');
  const project = lab.createProject(alice.session, ref);
  const work = {expectedRevision:0,requirementRef:ref,deviceProfileRef:ref,testSuiteRef:ref,manualRef:ref,languageProfileRef:ref,program:{threshold:450},wiring:{connections:[]},source:'readLight();',requirementCard:{explanation:'暗亮持续变化'},phase:'short-cpp'};
  return {lab,alice,bob,project,work};
}

test('individual snapshots are immutable, scoped, and reject owner injection', async () => {
  const {lab,alice,bob,project,work} = await fixture();
  const snapshot = await lab.submit(alice.session,project.id,work);
  work.program.threshold = 900;
  assert.equal(snapshot.program.threshold,450);
  assert.throws(() => {snapshot.program.threshold = 900;});
  assert.throws(() => lab.getSnapshot(bob.session,snapshot.id),{code:'NOT_FOUND'});
  assert.throws(() => lab.getProject({mode:'synthetic-local'},project.id),{code:'SESSION_REQUIRED'});
  await assert.rejects(lab.submit(alice.session,project.id,{...work,expectedRevision:1,ownerStudentId:bob.student.id}),{code:'UNSUPPORTED_FIELD'});
});

test('optimistic revision detects concurrent edits and preserves evidence history', async () => {
  const {lab,alice,project,work} = await fixture();
  const results = await Promise.allSettled([lab.submit(alice.session,project.id,work),lab.submit(alice.session,project.id,work)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'REVISION_CONFLICT');
  const first = results.find(r=>r.status==='fulfilled').value;
  const proof = await lab.runTests(alice.session,first.id);
  await lab.submit(alice.session,project.id,{...work,expectedRevision:1,source:'readLight(); // change'});
  assert.equal(lab.listEvidence(alice.session,project.id)[0].current,false);
  assert.throws(()=>lab.settleSoftwareDemo(alice.session,{evidenceId:proof.id}),{code:'STALE_SNAPSHOT'});
  assert.equal(lab.getSnapshot(alice.session,first.id).source,'readLight();');
});

test('failed or block tests cannot settle; passed short C++ settles once per individual order', async () => {
  const {lab,alice,bob,project,work} = await fixture();
  let snap = await lab.submit(alice.session,project.id,{...work,program:{threshold:800}});
  let proof = await lab.runTests(alice.session,snap.id);
  assert.throws(()=>lab.settleSoftwareDemo(alice.session,{evidenceId:proof.id}),{code:'SOFTWARE_NOT_PASSED'});
  snap = await lab.submit(alice.session,project.id,{...work,expectedRevision:1,phase:'blocks'});
  proof = await lab.runTests(alice.session,snap.id);
  assert.throws(()=>lab.settleSoftwareDemo(alice.session,{evidenceId:proof.id}),{code:'SOFTWARE_NOT_PASSED'});
  snap = await lab.submit(alice.session,project.id,{...work,expectedRevision:2});
  proof = await lab.runTests(alice.session,snap.id);
  const income = lab.settleSoftwareDemo(alice.session,{evidenceId:proof.id});
  assert.deepEqual(lab.settleSoftwareDemo(alice.session,{evidenceId:proof.id}),income);
  const again = await lab.runTests(alice.session,snap.id);
  assert.deepEqual(lab.settleSoftwareDemo(alice.session,{evidenceId:again.id}),income);
  assert.equal(lab.getLedger(alice.session).income,100);
  assert.equal(lab.getLedger(alice.session).events.length,1);
  assert.equal(lab.getLedger(bob.session).income,0);
  assert.throws(()=>lab.settleSoftwareDemo(bob.session,{evidenceId:proof.id}),{code:'NOT_FOUND'});
  assert.equal(lab.hardwareStatus().hardwareAcceptance,'not-verified');
});
test('new version of the same task does not grant duplicate synthetic income',async()=>{
  const {lab,alice,project,work}=await fixture();
  const first=await lab.submit(alice.session,project.id,work),proof=await lab.runTests(alice.session,first.id);
  const income=lab.settleSoftwareDemo(alice.session,{evidenceId:proof.id});
  const newer=lab.createProject(alice.session,{...project.taskRef,version:'2'});
  const second=await lab.submit(alice.session,newer.id,work),newProof=await lab.runTests(alice.session,second.id);
  assert.equal(lab.settleSoftwareDemo(alice.session,{evidenceId:newProof.id}).id,income.id);
  assert.equal(lab.getLedger(alice.session).events.length,1);
});
