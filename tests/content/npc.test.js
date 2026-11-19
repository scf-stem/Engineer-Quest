import test from 'node:test';
import assert from 'node:assert/strict';
import reviewExamples from '../../content/auto-lamp/review-examples.json' with { type: 'json' };
import { getCustomerSuite, getManualSection } from '../../content/index.js';
import { evaluateCustomerSuite } from '../../content/customer-tests.js';
import { checkRequirementSelections, reviewStaticRequirements, reviewStaticTechnical } from '../../content/npc.js';

test('synthetic NPC cases preserve Chinese, accept explicit options and keep semantic review pending', () => {
  for (const example of reviewExamples.requirements) {
    const original = JSON.stringify(example.input);
    const result = reviewStaticRequirements(example.input);
    assert.equal(result.mode, 'static', example.id);
    assert.equal(result.questionId, example.expected.questionId, example.id);
    assert.equal(result.coverage.readyForSubmission, example.expected.readyForSubmission, example.id);
    assert.equal(result.coverage.draftComplete, example.expected.draftComplete, example.id);
    assert.equal(result.coverage.readyToAdvance, false, example.id);
    assert.equal(result.coverage.explanationReview, 'semantic_review_pending', example.id);
    assert.equal(result.needsTeacherHelp, example.expected.needsTeacherHelp, example.id);
    assert.equal(result.question.split('？').length, 2, example.id);
    assert.equal(JSON.stringify(example.input), original, example.id);
    assert.equal('complete' in result, false);
    assert.equal('passed' in result, false);
    assert.equal('reward' in result, false);
    assert.equal('hardwareApproved' in result, false);
    const section = result.citations.find(item => item.ref.id === 'eq-student-manual').path.split('/')[1];
    assert.ok(getManualSection(section));
    assert.equal(result.citations[0].ref.version, example.input.requirementVersion);
  }
});

test('legacy card shape and explanation never grant advancement', () => {
  assert.equal(checkRequirementSelections({ input: {}, condition: [], output: 1, continuous: true, explanation: '说明' }).readyForSubmission, false);
  const good = reviewExamples.requirements.find(item => item.id === 'correct-chinese').input.card;
  assert.equal(checkRequirementSelections({ ...good, explanation: '字'.repeat(1501) }).readyForSubmission, false);
  const rejected = reviewStaticRequirements({ requirementVersion: '1.0.0', card: { ...good, explanation: '我完全不懂，随便选的。' } });
  assert.equal(rejected.questionId, 'req-guided-observation');
  assert.equal(rejected.coverage.readyToAdvance, false);
  assert.equal(rejected.coverage.draftComplete, false);
});

test('static review is explicit for timeout and cannot silently choose a new requirement', () => {
  assert.equal(reviewStaticRequirements({ requirementVersion: '1.0.0', fallbackReason: 'timeout', card: {} }).fallbackReason, 'timeout');
  assert.throws(() => reviewStaticRequirements({ requirementVersion: 'latest', card: {} }), RangeError);
  assert.throws(() => reviewStaticRequirements({ requirementVersion: '1.0.0', fallbackReason: 'pretend_ai', card: {} }), RangeError);
});

test('technical review cites the actual fixed failing case, never overrides failure', () => {
  const testRun = evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations: {} });
  const review = reviewStaticTechnical({ requirementVersion: '1.0.0', testRun });
  assert.equal(review.questionId, 'tech-failure');
  assert.ok(review.citations.some(item => item.ref.id === testRun.testSuiteRef.id && item.path === 'tests/base-dark'));
  assert.equal(testRun.passed, false);
  assert.equal('passed' in review, false);
});

test('stale or incomplete technical evidence requests a fresh run', () => {
  const oldRun = evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations: {} });
  assert.equal(reviewStaticTechnical({ requirementVersion: '1.1.0', testRun: oldRun }).questionId, 'tech-run');
  assert.equal(reviewStaticTechnical({ requirementVersion: '1.0.0', testRun: { ...oldRun, cases: [] } }).questionId, 'tech-run');
  assert.equal(reviewStaticTechnical({ requirementVersion: '1.0.0' }).questionId, 'tech-run');
});

test('budget and hardware reviews send the learner to the right help route', () => {
  const suite = getCustomerSuite('1.0.0');
  const simulations = Object.fromEntries(suite.tests.map(item => [item.id, { status: 'budget_exceeded' }]));
  const testRun = evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations });
  assert.equal(reviewStaticTechnical({ requirementVersion: '1.0.0', testRun }).questionId, 'tech-budget');
  const hardware = reviewStaticTechnical({ requirementVersion: '1.1.0', stage: 'hardware', testRun: { passed: true } });
  assert.equal(hardware.questionId, 'hardware-teacher');
  assert.equal(hardware.needsTeacherHelp, true);
  assert.equal('hardwareApproved' in hardware, false);
});
