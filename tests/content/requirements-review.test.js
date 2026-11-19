import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequirementReview, getRequirementChallenge, reviewRequirementAttempt, summarizeRequirementReview, requirementTutorialFacts, isExplicitRequirementHelp } from '../../content/requirements-review.js';
import { bindingFor, completeReview } from './review-fixtures.js';

function answer(review, binding, optionId, extra = {}) {
  return reviewRequirementAttempt({ review, binding, attempt: { responseId: `r-${review.responses.length}`, checkpointId: getRequirementChallenge({ review, binding }).id, optionId, confidence: 'ready-to-try', ...extra } });
}

test('learner sees only the current scene, stable options and no answer key', () => {
  const binding = bindingFor(), review = createRequirementReview({ binding });
  const challenge = getRequirementChallenge({ review, binding });
  assert.equal(challenge.id, 'req-light-input');
  assert.ok(challenge.prompt && challenge.scene.description);
  assert.ok(challenge.options.some(item => item.optionId === 'not-sure'));
  assert.ok(challenge.options.every(item => Object.keys(item).sort().join(',') === 'label,optionId'));
  assert.equal('answerOptionId' in challenge, false);
  assert.equal('wrongFeedback' in challenge, false);
  assert.equal(JSON.stringify(challenge).includes('req-transfer-sequence'), false);
});

test('the original acceptance counterexample cannot advance with four correct legacy fields', () => {
  const binding = bindingFor();
  const old = { input: 'light-sensor', condition: 'below-customer-threshold', output: 'dark-on-bright-off', continuous: 'repeat-read-decide', explanation: '我完全不懂，随便选的。', passed: true, readyToAdvance: true };
  const summary = summarizeRequirementReview({ review: old, binding });
  assert.equal(summary.readyToAdvance, false);
  assert.equal(summary.status, 'invalid');
  const review = createRequirementReview({ binding });
  const result = answer(review, binding, 'current-light', { explanation: old.explanation });
  assert.equal(result.summary.status, 'needs-help');
  assert.equal(result.summary.current.number, 1);
  assert.ok(result.summary.guidance.tryThis.includes('信息'));
});

test('unknown option, unsure and explicit help have distinct actionable outcomes', () => {
  const binding = bindingFor(), review = createRequirementReview({ binding });
  for (const [option, confidence, status, code] of [['unknown', 'ready-to-try', 'needs-retry', 'REQ_OPTION_UNKNOWN'], ['not-sure', 'ready-to-try', 'needs-help', 'REQ_SUPPORT_REQUESTED'], ['current-light', 'need-help', 'needs-help', 'REQ_SUPPORT_REQUESTED']]) {
    const result = answer(review, binding, option, { confidence });
    assert.equal(result.summary.status, status);
    assert.equal(result.summary.diagnostic.code, code);
    assert.ok(result.summary.diagnostic.observedFact);
    assert.equal(result.summary.retryAction.type, 'observe-and-retry');
    assert.equal(result.summary.actionTarget.checkpointId, 'req-light-input');
    assert.equal(result.summary.readyForPractice, false);
  }
});

test('help can be followed by a real retry without losing history or future eligibility', () => {
  const binding = bindingFor(), original = createRequirementReview({ binding });
  const help = answer(original, binding, 'not-sure');
  const retried = answer(help.review, binding, 'current-light');
  assert.equal(original.responses.length, 0);
  assert.equal(retried.review.responses.length, 2);
  assert.equal(retried.summary.current.checkpointId, 'req-dark-action');
  assert.equal(retried.summary.status, 'in-progress');
});

test('contradictory dark and bright actions do not get coverage credit', () => {
  const binding = bindingFor();
  let review = createRequirementReview({ binding });
  review = answer(review, binding, 'current-light').review;
  review = answer(review, binding, 'lamp-on').review;
  const contradiction = answer(review, binding, 'lamp-on');
  assert.equal(contradiction.summary.status, 'needs-retry');
  assert.equal(contradiction.summary.diagnostic.code, 'REQ_BRIGHT_BRANCH_MISSING');
  assert.equal(contradiction.summary.readyToAdvance, false);
  assert.ok(contradiction.summary.guidance.observation.includes('客户现在需要灭'));
});

test('the first four familiar concepts are insufficient without boundary and transfer', () => {
  const binding = bindingFor();
  let review = createRequirementReview({ binding });
  for (const option of ['current-light', 'lamp-on', 'lamp-off', 'read-decide-repeat']) review = answer(review, binding, option).review;
  assert.equal(summarizeRequirementReview({ review, binding }).readyToAdvance, false);
  const wrongEquality = answer(review, binding, 'lamp-on');
  assert.equal(wrongEquality.summary.diagnostic.code, 'REQ_BOUNDARY_EQUALITY');
  const equality = answer(wrongEquality.review, binding, 'lamp-off');
  const wrongTransfer = answer(equality.review, binding, 'trace-a');
  assert.equal(wrongTransfer.summary.diagnostic.code, 'REQ_TRANSFER_MISMATCH');
  assert.equal(wrongTransfer.summary.readyToAdvance, false);
});

test('complete base/change paths replay to scoped readiness with exact canonical JSON evidence', () => {
  for (const [version, count] of [['1.0.0', 6], ['1.1.0', 4]]) {
    const binding = bindingFor(version), review = completeReview(binding);
    const restored = JSON.parse(JSON.stringify(review));
    const summary = summarizeRequirementReview({ review: restored, binding });
    assert.equal(summary.status, 'ready');
    assert.equal(summary.readyToAdvance, true);
    assert.equal(summary.readyForPractice, true);
    assert.equal(summary.current, null);
    assert.equal(summary.evidence.responseIds.length, count);
    assert.deepEqual(JSON.parse(summary.evidence.responsesCanonical), review.responses);
    assert.equal(summary.evidence.scope, 'specified_scenarios_only');
    assert.equal(summary.explanationReview, 'not_semantically_evaluated');
  }
});

test('editing an earlier answer invalidates later conclusions and the old record remains immutable', () => {
  const binding = bindingFor(), review = completeReview(binding);
  const before = JSON.stringify(review);
  const result = reviewRequirementAttempt({ review, binding, attempt: { responseId: 'edited-input', checkpointId: 'req-light-input', optionId: 'calendar', confidence: 'ready-to-try' } });
  assert.equal(result.summary.readyToAdvance, false);
  assert.equal(result.summary.current.number, 1);
  assert.equal(result.summary.completedCheckpointIds.length, 0);
  assert.equal(result.summary.evidence, null);
  assert.equal(result.review.responses.length, 7);
  assert.equal(JSON.stringify(review), before);
});

test('even a correct edit to an earlier check reopens later transfer checks', () => {
  const binding = bindingFor(), review = completeReview(binding);
  const result = reviewRequirementAttempt({ review, binding, attempt: { responseId: 'reconsider-bright', checkpointId: 'req-bright-action', optionId: 'lamp-off', confidence: 'ready-to-try' } });
  assert.equal(result.summary.readyToAdvance, false);
  assert.equal(result.summary.current.checkpointId, 'req-read-again');
});

test('response retries are idempotent while reused IDs with new answers are rejected', () => {
  const binding = bindingFor(), initial = createRequirementReview({ binding });
  const attempt = { responseId: 'stable', checkpointId: 'req-light-input', optionId: 'current-light', confidence: 'ready-to-try' };
  const first = reviewRequirementAttempt({ review: initial, binding, attempt });
  const duplicate = reviewRequirementAttempt({ review: first.review, binding, attempt });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.review.responses.length, 1);
  const conflict = reviewRequirementAttempt({ review: first.review, binding, attempt: { ...attempt, optionId: 'calendar' } });
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.summary.diagnostic.code, 'REQ_RESPONSE_ID_CONFLICT');
});

test('future checks, forged summary booleans and truncated histories cannot skip practice', () => {
  const binding = bindingFor(), initial = createRequirementReview({ binding });
  const future = reviewRequirementAttempt({ review: initial, binding, attempt: { responseId: 'skip', checkpointId: 'req-transfer-sequence', optionId: 'trace-b', confidence: 'ready-to-try' } });
  assert.equal(future.accepted, false);
  assert.equal(future.review.responses.length, 0);
  assert.equal(summarizeRequirementReview({ review: { ...initial, readyToAdvance: true, passed: true, current: null }, binding }).readyToAdvance, false);
  const complete = completeReview(binding);
  assert.equal(summarizeRequirementReview({ review: { ...complete, responses: complete.responses.slice(2) }, binding }).readyToAdvance, false);
});

test('learner, attempt, requirement digest/version, lesson and artifact changes invalidate proof', () => {
  const binding = { ...bindingFor(), artifactRevision: 'card-1', requirementsEpoch: 0 }, review = completeReview(binding);
  for (const changed of [
    { ...binding, learnerId: 'synthetic-b' }, { ...binding, attemptId: 'new-attempt' },
    { ...binding, requirementRef: { ...binding.requirementRef, digest: 'different' } },
    { ...binding, requirementRef: { ...binding.requirementRef, version: '1.1.0' } },
    { ...binding, artifactRevision: 'card-2' },
    { ...binding, requirementsEpoch: 1 },
  ]) assert.equal(summarizeRequirementReview({ review, binding: changed }).status, 'stale');
  assert.equal(summarizeRequirementReview({ review: { ...review, lessonRef: { id: 'eq-auto-lamp-requirements', version: '0.1.0' } }, binding }).readyToAdvance, false);
  assert.throws(() => createRequirementReview({ binding: { ...binding, requirementRef: { id: 'eq-requirement-auto-lamp', version: 'latest' } } }), RangeError);
});

test('arbitrary Chinese is not graded and NPC fact projection contains no raw explanation or answer key', () => {
  const binding = bindingFor(), initial = createRequirementReview({ binding });
  assert.equal(isExplicitRequirementHelp('之前不懂，现在我愿意试试'), false);
  const result = answer(initial, binding, 'current-light', { explanation: '任意原话，不由字符串判断我是否理解。' });
  assert.equal(result.summary.explanationReview, 'not_semantically_evaluated');
  assert.equal(result.summary.readyToAdvance, false);
  const facts = requirementTutorialFacts(result.summary);
  assert.equal(JSON.stringify(facts).includes('任意原话'), false);
  assert.equal(JSON.stringify(facts).includes('answerOptionId'), false);
  assert.equal('evidence' in facts, false);
});
