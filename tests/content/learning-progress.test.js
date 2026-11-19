import test from 'node:test';
import assert from 'node:assert/strict';
import { bindingFor, completeReview } from './review-fixtures.js';
import { deriveLearningProgress, evaluateLearningEvidence, getLearningEvidencePolicy } from '../../content/learning-progress.js';
import { getLearningProgression } from '../../content/requirements-review.js';

function fixtures() {
  const baseBinding = bindingFor(), changeBinding = bindingFor('1.1.0');
  const requirements = { review: completeReview(baseBinding), binding: baseBinding };
  const changeRequirements = { review: completeReview(changeBinding), binding: changeBinding };
  const context = {
    learnerId: baseBinding.learnerId, attemptId: baseBinding.attemptId,
    base: { requirementRef: baseBinding.requirementRef, requirementsEvidenceKey: 'sha256-base-review-fixture', wiringKey: 'wiring-1', blocksKey: 'blocks-1' },
    change: { requirementRef: changeBinding.requirementRef, requirementsEvidenceKey: 'sha256-change-review-fixture', wiringKey: 'wiring-1', blocksKey: 'blocks-1', sourceKey: 'source-1' },
  };
  const policy = getLearningEvidencePolicy();
  const observations = getLearningProgression().practiceMilestones.flatMap(milestone => milestone.requiresEvidence.map((code, index) => {
    const phase = policy.phaseOverridesByFact[code] ?? (['code-mapping', 'change-delivery'].includes(milestone.id) ? 'change' : 'base');
    return {
      id: `${milestone.id}-${index}`, activityId: milestone.id, learnerActionId: `action-${milestone.id}`,
      source: policy.sourcesByFact[code], factCodes: [code],
      binding: { ...context[phase], learnerId: context.learnerId, attemptId: context.attemptId },
    };
  }));
  return { requirements, changeRequirements, context, observations };
}

test('requirements readiness opens one practice goal, not all software learning', () => {
  const data = fixtures();
  const result = deriveLearningProgress({ ...data, observations: [] });
  assert.equal(result.currentMilestoneId, 'observe-output');
  assert.equal(result.readyForBaseTests, false);
  assert.equal(result.readyForCodeChange, false);
  assert.equal(result.learningComplete, false);
  assert.equal(result.checkpoints.find(item => item.id === 'base-delivery').state, 'locked');
});

test('programReady or customer-test passed booleans cannot stand in for progressive activities', () => {
  const data = fixtures();
  const result = deriveLearningProgress({ ...data, observations: [{ id: 'fake', passed: true, programReady: true, learningComplete: true, factCodes: ['base_customer_suite_passed'] }] });
  assert.equal(result.learningComplete, false);
  assert.equal(result.currentMilestoneId, 'observe-output');
});

test('source-bound ordered observations complete the seven concrete learning activities', () => {
  const data = fixtures(), result = deriveLearningProgress(data);
  assert.equal(result.status, 'software-ready');
  assert.equal(result.learningComplete, true);
  assert.equal(result.readyForSoftwareDelivery, true);
  assert.equal(result.current, null);
  assert.equal(result.checkpoints.length, 9); // two scenario gates + seven actual practice activities
  assert.equal('income' in result, false);
  assert.ok(result.deferred.includes('physical_upload'));
  const canonicalKeys = fixtures();
  canonicalKeys.context.base.blocksKey = canonicalKeys.context.change.blocksKey = 'canonical-workspace-'.repeat(500);
  for (const row of canonicalKeys.observations) if (row.binding.blocksKey) row.binding.blocksKey = canonicalKeys.context.base.blocksKey;
  assert.equal(deriveLearningProgress(canonicalKeys).learningComplete, true);
});

test('changing wiring invalidates dependent observations and preserves raw history', () => {
  const data = fixtures(), before = JSON.stringify(data.observations);
  data.context.base.wiringKey = 'wiring-2'; data.context.change.wiringKey = 'wiring-2';
  const result = deriveLearningProgress(data);
  assert.equal(result.currentMilestoneId, 'observe-output');
  assert.equal(result.current.state, 'stale');
  assert.equal(result.learningComplete, false);
  assert.equal(JSON.stringify(data.observations), before);
});

test('blocks changes keep guided output but expire program observations and downstream evidence', () => {
  const data = fixtures();
  data.context.base.blocksKey = 'blocks-2'; data.context.change.blocksKey = 'blocks-2';
  const result = deriveLearningProgress(data);
  assert.equal(result.checkpoints.find(item => item.id === 'observe-output').state, 'observed');
  assert.equal(result.currentMilestoneId, 'read-input');
  assert.equal(result.current.state, 'stale');
});

test('source edits keep preserved blocks/mapping learning but expire exact-source delivery proof', () => {
  const data = fixtures(); data.context.change.sourceKey = 'source-2';
  const result = deriveLearningProgress(data);
  assert.equal(result.checkpoints.find(item => item.id === 'code-mapping').state, 'observed');
  assert.equal(result.currentMilestoneId, 'change-delivery');
  assert.equal(result.current.state, 'stale');
  assert.equal(result.readyForChangeTests, true);
  assert.equal(result.learningComplete, false);
});

test('preserving base snapshot before change answers does not depend on change review key', () => {
  const data = fixtures();
  const preserved = data.observations.find(item => item.factCodes.includes('own_blocks_snapshot_preserved'));
  assert.equal(preserved.binding.requirementRef.version, '1.0.0');
  const current = { ...data.context.base, learnerId: data.context.learnerId, attemptId: data.context.attemptId };
  data.context.change.requirementsEvidenceKey = 'new-change-answer-digest';
  assert.equal(evaluateLearningEvidence({ observation: preserved, factCode: 'own_blocks_snapshot_preserved', current }).current, true);
  assert.equal(deriveLearningProgress(data).currentMilestoneId, 'code-mapping'); // mapping needs the new change binding
});

test('a changed scenario proof, learner or attempt cannot reuse earlier practice evidence', () => {
  const data = fixtures(); data.context.base.requirementsEvidenceKey = 'new-base-answers';
  assert.equal(deriveLearningProgress(data).current.state, 'stale');
  const other = fixtures(); other.context.learnerId = 'synthetic-b';
  assert.equal(deriveLearningProgress(other).checkpoints[0].state, 'stale');
  const attempt = fixtures(); attempt.context.attemptId = 'new-order-attempt';
  assert.equal(deriveLearningProgress(attempt).learningComplete, false);
});

test('facts from wrong sources, missing learner actions or one action spread across stages do not complete learning', () => {
  for (const mutate of [data => { data.observations[0].source = 'learner'; }, data => { delete data.observations[0].learnerActionId; }, data => { for (const row of data.observations) row.learnerActionId = 'one-test-click'; }]) {
    const data = fixtures(); mutate(data);
    assert.equal(deriveLearningProgress(data).learningComplete, false);
  }
});

test('pre-filled future observations before prior activities cannot fast-forward the path', () => {
  const data = fixtures(); data.observations.reverse();
  const result = deriveLearningProgress(data);
  assert.equal(result.learningComplete, false);
  assert.equal(result.currentMilestoneId, 'read-input');
});

test('change scenario review is required even with mapping and passing test observations', () => {
  const data = fixtures(); delete data.changeRequirements;
  const result = deriveLearningProgress(data);
  assert.equal(result.readyForCodeChange, true);
  assert.equal(result.currentMilestoneId, 'change-review');
  assert.equal(result.learningComplete, false);
});

test('invalid or unknown learning contexts fail closed', () => {
  assert.equal(deriveLearningProgress().status, 'invalid');
  assert.equal(evaluateLearningEvidence({ factCode: 'NPC_APPROVED', current: {}, observation: { passed: true } }).current, false);
});
