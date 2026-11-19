import assert from 'node:assert/strict';
import { createRequirementReview, getRequirementChallenge, reviewRequirementAttempt } from '../../content/requirements-review.js';

// Authored synthetic play route, not a learner-facing answer sheet.
const answers = {
  'req-light-input': 'current-light', 'req-dark-action': 'lamp-on', 'req-bright-action': 'lamp-off',
  'req-read-again': 'read-decide-repeat', 'req-base-equality': 'lamp-off', 'req-transfer-sequence': 'trace-b',
  'change-middle': 'now-on', 'change-equality': 'lamp-off', 'change-code-focus': 'comparison', 'change-evidence': 'new-current-suite',
};
export const bindingFor = (version = '1.0.0') => ({ learnerId: 'synthetic-a', attemptId: 'order-attempt-1', requirementRef: { id: 'eq-requirement-auto-lamp', version, digest: `fixture-${version}` } });
export function completeReview(binding = bindingFor()) {
  let review = createRequirementReview({ binding }), number = 0;
  while (getRequirementChallenge({ review, binding })) {
    const challenge = getRequirementChallenge({ review, binding });
    const optionId = answers[challenge.id];
    assert.ok(optionId, challenge.id);
    review = reviewRequirementAttempt({ review, binding, attempt: { responseId: `answer-${++number}`, checkpointId: challenge.id, optionId, confidence: 'ready-to-try' } }).review;
  }
  return review;
}
