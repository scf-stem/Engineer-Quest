import { getLearningProgression, summarizeRequirementReview } from './requirements-review.js';

const FACT_SOURCES = Object.freeze({
  guided_output_observed: 'program-runtime',
  current_input_read_observed: 'program-runtime',
  dark_branch_observed: 'program-runtime',
  bright_branch_observed: 'program-runtime',
  repeated_current_read_observed: 'program-runtime',
  base_customer_suite_passed: 'course-customer-tests',
  own_blocks_snapshot_preserved: 'snapshot-store',
  own_comparison_mapping_observed: 'program-analysis',
  changed_exact_source_recorded: 'snapshot-store',
  change_customer_suite_passed: 'course-customer-tests',
});
const FOUNDATION = ['learnerId', 'attemptId', 'requirementRef', 'requirementsEvidenceKey', 'wiringKey'];
const FACT_DEPENDENCIES = Object.freeze(Object.fromEntries(Object.keys(FACT_SOURCES).map(code => [code,
  code === 'guided_output_observed' ? FOUNDATION
    : [...FOUNDATION, 'blocksKey', ...(['changed_exact_source_recorded', 'change_customer_suite_passed'].includes(code) ? ['sourceKey'] : [])],
])));
const FACT_PHASE_OVERRIDES = Object.freeze({ own_blocks_snapshot_preserved: 'base' });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.length > 0 && value.length <= 1048576;
const sameRef = (left, right) => object(left) && object(right) && left.id === right.id && left.version === right.version && left.digest === right.digest;
const message = (code, text, observedFact, stageId = 'requirements') => ({ code, severity: 'info', message: text, observedFact, stageId });

/** These are adapter observations, never learner-supplied passed flags or NPC approvals. */
export function getLearningEvidencePolicy() {
  return { sourcesByFact: { ...FACT_SOURCES }, dependenciesByFact: structuredClone(FACT_DEPENDENCIES), phaseOverridesByFact: { ...FACT_PHASE_OVERRIDES },
    authority: 'Host must validate actual A/B/runtime/test/snapshot origin and learner action; local data is not an authorization boundary.' };
}

export function evaluateLearningEvidence({ observation, factCode, current }) {
  if (!FACT_SOURCES[factCode]) return { current: false, reason: 'UNKNOWN_FACT', changedDependencies: [] };
  if (!object(observation) || !nonempty(observation.id) || !nonempty(observation.learnerActionId)
    || observation.source !== FACT_SOURCES[factCode] || !Array.isArray(observation.factCodes)
    || !observation.factCodes.includes(factCode) || !object(observation.binding)) return {
    current: false, reason: 'MISSING_VALIDATED_OBSERVATION', changedDependencies: [],
  };
  const changedDependencies = FACT_DEPENDENCIES[factCode].filter(key => key === 'requirementRef'
    ? !sameRef(observation.binding[key], current?.[key])
    : !nonempty(current?.[key]) || observation.binding[key] !== current[key]);
  return { current: changedDependencies.length === 0, reason: changedDependencies.length ? 'STALE_OBSERVATION' : 'CURRENT_OBSERVATION', changedDependencies };
}

function reviewCheckpoint(id, input, expectedVersion) {
  const summary = summarizeRequirementReview(input ?? {});
  const phaseCorrect = input?.binding?.requirementRef?.version === expectedVersion;
  const ready = phaseCorrect && summary.status === 'ready' && summary.readyToAdvance === true;
  return {
    id, stageId: expectedVersion === '1.0.0' ? 'requirements' : 'short-code',
    title: expectedVersion === '1.0.0' ? '确认基础客户情境' : '预测客户变更',
    state: ready ? 'observed' : summary.status === 'stale' ? 'stale' : 'pending',
    missingFacts: ready ? [] : ['current_scenario_review'],
    diagnostic: phaseCorrect ? summary.diagnostic : message('LEARNING_REQUIREMENT_VERSION', `此处需要需求 ${expectedVersion} 的情境证据。`, '没有匹配阶段的需求评审。'),
    actionTarget: summary.actionTarget,
  };
}

/** Derives progressive goals. E supplies source-verified facts from explicit learner operations. */
export function deriveLearningProgress({ requirements, changeRequirements, context, observations = [] } = {}) {
  if (!object(context) || !nonempty(context.learnerId) || !nonempty(context.attemptId) || !object(context.base) || !Array.isArray(observations) || observations.length > 512) return {
    status: 'invalid', current: null, currentMilestoneId: null, checkpoints: [], readyForBaseTests: false, readyForCodeChange: false,
    readyForChangeTests: false, learningComplete: false, readyForSoftwareDelivery: false,
    diagnostics: [message('LEARNING_CONTEXT_INVALID', '缺少当前个人、尝试和作品上下文，不能从保存的勾选恢复学习完成。', '当前学习上下文无效。')],
  };
  const policy = getLearningProgression();
  const actions = new Map();
  for (const observation of observations) {
    if (!nonempty(observation?.learnerActionId) || !nonempty(observation?.activityId)) continue;
    const activities = actions.get(observation.learnerActionId) ?? new Set();
    activities.add(observation.activityId); actions.set(observation.learnerActionId, activities);
  }
  const ambiguousActions = new Set([...actions].filter(([, activities]) => activities.size > 1).map(([id]) => id));
  const baseReview = reviewCheckpoint('requirements-review', requirements, '1.0.0');
  const changeReview = reviewCheckpoint('change-review', changeRequirements, '1.1.0');
  // A ready summary for another learner/attempt cannot unlock this learner's observations.
  for (const [checkpoint, input, phase] of [[baseReview, requirements, context.base], [changeReview, changeRequirements, context.change]]) {
    if (!phase || input?.binding?.learnerId !== context.learnerId || input?.binding?.attemptId !== context.attemptId
      || !sameRef(input?.binding?.requirementRef, phase.requirementRef) || !nonempty(phase.requirementsEvidenceKey)) {
      checkpoint.state = 'stale'; checkpoint.missingFacts = ['current_scenario_review'];
      checkpoint.diagnostic = message('LEARNING_REVIEW_BINDING', '评审与当前个人、尝试或需求不一致，请核对版本后继续。', '情境结论不能跨个人或尝试复用。', checkpoint.stageId);
    }
  }
  const checkpoints = [baseReview];
  let precedingReady = baseReview.state === 'observed';
  let precedingObservationIndex = -1;
  for (const milestone of policy.practiceMilestones) {
    const phaseName = ['code-mapping', 'change-delivery'].includes(milestone.id) ? 'change' : 'base';
    if (milestone.id === 'code-mapping') {
      checkpoints.push({ ...changeReview, state: precedingReady ? changeReview.state : 'locked' });
      precedingReady = precedingReady && changeReview.state === 'observed';
    }
    const facts = milestone.requiresEvidence.map(factCode => {
      const current = { ...context[FACT_PHASE_OVERRIDES[factCode] ?? phaseName], learnerId: context.learnerId, attemptId: context.attemptId };
      const relevant = observations.map((observation, index) => ({ observation, index })).filter(({ observation: item, index }) => index > precedingObservationIndex && item?.activityId === milestone.id && !ambiguousActions.has(item.learnerActionId) && Array.isArray(item.factCodes) && item.factCodes.includes(factCode));
      const results = relevant.map(({ observation, index }) => ({ observation, index, result: evaluateLearningEvidence({ observation, factCode, current }) }));
      return { factCode, current: results.find(item => item.result.current), stale: results.some(item => item.result.reason === 'STALE_OBSERVATION') };
    });
    const missingFacts = facts.filter(item => !item.current).map(item => item.factCode);
    const state = !precedingReady ? 'locked' : !missingFacts.length ? 'observed' : facts.some(item => !item.current && item.stale) ? 'stale' : 'pending';
    const row = {
      id: milestone.id, stageId: milestone.stageId, title: milestone.title, goal: milestone.goal, state, missingFacts,
      evidenceIds: facts.filter(item => item.current).map(item => item.current.observation.id),
      actionTarget: { type: 'learning-activity', targetId: milestone.helpTarget, activityId: milestone.id, manualSection: milestone.manualSection },
      diagnostic: { ...message(state === 'observed' ? 'LEARNING_OBSERVATION_CURRENT' : state === 'stale' ? 'LEARNING_OBSERVATION_STALE' : state === 'locked' ? 'LEARNING_PREREQUISITE' : 'LEARNING_OBSERVATION_NEEDED',
        state === 'observed' ? '已记录当前作品上的实际练习。' : state === 'stale' ? '作品或需求已变，请在当前版本重新观察；历史仍保留。' : state === 'locked' ? '先完成当前目标，再进入这项练习。' : milestone.goal,
        state === 'observed' ? `${facts.length} 项操作事实来自当前版本记录。` : missingFacts.length ? '这一步尚未记录当前作品上的相应观察。' : '上游学习目标尚未完成。', milestone.stageId), manualSection: milestone.manualSection },
    };
    checkpoints.push(row); precedingReady = precedingReady && state === 'observed';
    if (state === 'observed') precedingObservationIndex = Math.max(...facts.map(item => item.current.index));
  }
  const byId = id => checkpoints.find(item => item.id === id)?.state === 'observed';
  const current = checkpoints.find(item => item.state !== 'observed') ?? null;
  const learningComplete = checkpoints.every(item => item.state === 'observed');
  return {
    status: learningComplete ? 'software-ready' : current?.state === 'stale' ? 'needs-guidance' : 'in-progress',
    current, currentMilestoneId: current?.id ?? null, checkpoints,
    readyForBaseTests: ['requirements-review', 'observe-output', 'read-input', 'branch-output', 'repeat-read'].every(byId),
    readyForCodeChange: byId('base-delivery'),
    readyForChangeTests: byId('code-mapping') && byId('change-review'),
    learningComplete, readyForSoftwareDelivery: learningComplete,
    diagnostics: current ? [current.diagnostic] : [],
    scope: 'local_software_learning_evidence',
    deferred: ['physical_upload', 'real_accounts', 'multi_person_leaderboard', 'teacher_backend', 'shop'],
  };
}
