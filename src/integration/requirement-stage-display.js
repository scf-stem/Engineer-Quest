// Presentation only. D's replayed review remains the authority for every result.
export const requirementStageKey = phase => `requirement-stage:${phase}`;
const reviewFor = (state, phase) => state.attempt?.reviews?.[phase === 'short-cpp' ? 'change' : 'base'];
const factsFor = (state, phase) => phase === 'short-cpp' ? state.facts?.changeRequirements : state.facts?.requirements;
const ids = review => (review?.responses ?? []).map(item => item.responseId);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function stageRecordMatches(state, phase, record) {
  return !!record && record.schemaVersion === 1 && record.phase === phase
    && !['stale', 'invalid', 'unavailable'].includes(factsFor(state, phase)?.status)
    && record.learnerId === state.learner?.id && record.attemptId === state.activeAttemptId
    && record.checkpointId === record.challenge?.checkpointId
    && !!record.reviewBinding && !!reviewFor(state, phase)?.binding
    && same(record.reviewBinding, reviewFor(state, phase)?.binding);
}

function actualResponse(state, phase, record) {
  const responses = reviewFor(state, phase)?.responses ?? [];
  const last = responses.at(-1);
  if (!last || !record.submission?.responseId) return null;
  return last?.responseId === record.submission?.responseId
    && last.checkpointId === record.checkpointId && last.checkpointId === record.submission.checkpointId
    && last.optionId === record.submission.optionId
    && same(responses.slice(0, -1).map(item => item.responseId), record.priorResponseIds) ? last : null;
}

/** Host may defer the next cinematic; this never changes readyToAdvance or evidence. */
export function requirementStageHandoffPending(state, phase = 'blocks') {
  const record = state.attempt?.learning?.[requirementStageKey(phase)];
  if (!stageRecordMatches(state, phase, record) || !['submitting', 'feedback'].includes(record.handoff)) return false;
  return !!actualResponse(state, phase, record)
    || record.handoff === 'submitting' && !!record.submission?.responseId
      && record.submission.checkpointId === record.checkpointId
      && factsFor(state, phase)?.challenge?.checkpointId === record.checkpointId
      && same(ids(reviewFor(state, phase)), record.priorResponseIds);
}

export function freshRequirementStage(challenge, guided = false, current = null) {
  const sequence = challenge?.scene?.lightSequence;
  return {challenge, checkpointId: challenge?.checkpointId ?? null, current,
    desk: {reading: sequence?.[0] ?? challenge?.scene?.light ?? 850, index: 0, lamp: challenge?.scene?.previousLamp ?? false},
    observation: null, cue: guided && challenge?.checkpointId === 'req-light-input' ? 'observe' : 'explain',
    handoff: 'continued', response: null, submission: null};
}

export function restoreRequirementStage(state, phase, guided) {
  const record = state.attempt?.learning?.[requirementStageKey(phase)], facts = factsFor(state, phase);
  if (!stageRecordMatches(state, phase, record)) return freshRequirementStage(facts?.challenge, guided, facts?.current);
  if (actualResponse(state, phase, record) && ['submitting', 'feedback'].includes(record.handoff)) {
    // Covers a reload between D committing the answer and the feedback presentation committing.
    return {...record, cue: 'feedback', handoff: 'feedback', response: {
      optionId: record.submission.optionId, optionLabel: record.submission.optionLabel, summary: facts,
    }};
  }
  if (record.checkpointId === facts?.challenge?.checkpointId && same(ids(reviewFor(state, phase)), record.reviewResponseIds)) {
    return {...record, handoff: 'continued', submission: null, response: null,
      cue: record.cue === 'submitting' ? 'choices' : record.cue};
  }
  return freshRequirementStage(facts?.challenge, guided, facts?.current);
}

export function requirementStageRecord(state, phase, display) {
  return {...display, schemaVersion: 1, phase, learnerId: state.learner?.id, attemptId: state.activeAttemptId,
    reviewBinding: reviewFor(state, phase)?.binding, reviewResponseIds: ids(reviewFor(state, phase))};
}

export function requirementResponseIds(state, phase) { return ids(reviewFor(state, phase)); }
