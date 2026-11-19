import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCourseEdition,createCourseEvaluator} from '../../src/integration/course-adapter.js';
import {createRef} from '../../src/contracts/index.js';

test('course editions bind independent immutable requirement and suite digests', async () => {
  const base=await loadCourseEdition('1.0.0'),change=await loadCourseEdition('1.1.0');
  assert.equal(base.refs.taskRef.digest,change.refs.taskRef.digest);
  assert.notEqual(base.refs.requirementRef.digest,change.refs.requirementRef.digest);
  assert.notEqual(base.refs.testSuiteRef.digest,change.refs.testSuiteRef.digest);
  assert.equal(base.readiness.targetCompile,'not-implemented');
  assert.throws(()=>{base.requirement.rule.threshold=600;});
  await assert.rejects(loadCourseEdition('latest'),RangeError);
});

test('full manual content is bound by its own SHA without rewriting fixed customer truth',async()=>{
  const ref=await createRef('eq-student-manual','0.2.0-local-full',{documents:{'首单手册.md':'实际全文'},attachments:{}});
  const base=await loadCourseEdition('1.0.0',{manualRef:ref}),old=await loadCourseEdition('1.0.0');
  assert.deepEqual(base.refs.manualRef,ref);assert.equal(base.readiness.manual,'full-local-draft');
  assert.deepEqual(base.refs.testSuiteRef,old.refs.testSuiteRef);assert.deepEqual(base.refs.requirementRef,old.refs.requirementRef);
  assert.notEqual(base.refs.manualRef.digest,old.refs.manualRef.digest);
  await assert.rejects(loadCourseEdition('1.0.0',{manualRef:{...ref,digest:'fake'}}),TypeError);
});

test('course adapter refuses missing execution and mismatched versions before running', async () => {
  const edition=await loadCourseEdition('1.0.0');
  assert.throws(()=>createCourseEvaluator({edition}),TypeError);
  let runs=0;
  const evaluate=createCourseEvaluator({edition,deviceProfileRef:edition.refs.manualRef,languageProfileRef:edition.refs.manualRef,simulate:()=>{runs++;},validateTopology:()=>({ok:true,value:{}}),validateSource:()=>({ok:true})});
  const result=await evaluate({...edition.refs,requirementRef:{...edition.refs.requirementRef,version:'1.1.0'},deviceProfileRef:edition.refs.manualRef,languageProfileRef:edition.refs.manualRef});
  assert.equal(result.passed,false);assert.equal(runs,0);
});

test('course adapter does not invent missing trace coverage', async () => {
  const edition=await loadCourseEdition('1.0.0');
  const evaluate=createCourseEvaluator({edition,deviceProfileRef:edition.refs.manualRef,languageProfileRef:edition.refs.manualRef,simulate:()=>({status:'completed',events:[{atMs:0,outputs:{lamp:true}}]}),validateTopology:()=>({ok:true,value:{}}),validateSource:()=>({ok:true})});
  const result=await evaluate({...edition.refs,deviceProfileRef:edition.refs.manualRef,languageProfileRef:edition.refs.manualRef});
  assert.equal(result.passed,false);
  assert.equal(result.cases[0].diagnostics[0].code,'INVALID_TIME_COVERAGE');
});
