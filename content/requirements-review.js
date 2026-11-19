import lessonBank from './learning/auto-lamp-progression.json' with { type: 'json' };

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
freeze(lessonBank);

export const REQUIREMENT_REVIEW_SCHEMA = 'eq-requirement-review/1';
export const REQUIREMENT_LESSON_REF = Object.freeze({ ...lessonBank.ref });
const MAX_RESPONSES = 128;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shortString = (value, max = 160) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const copy = value => structuredClone(value);

// E owns cryptographic digests. This exact, deterministic payload is only input to its SHA-256.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function lessonFor(version) {
  const lesson = lessonBank.lessons.find(item => item.requirementVersion === version);
  if (!lesson) throw new RangeError(`没有需求 ${String(version)} 的情境练习；不能自动使用其他版本。`);
  return lesson;
}

function ref(value) {
  if (!object(value) || !shortString(value.id) || !shortString(value.version)) throw new TypeError('版本引用需要明确 id/version。');
  if (own(value, 'digest') && !shortString(value.digest, 240)) throw new TypeError('摘要字段必须为明确文本；摘要由 E 校验。');
  return { id: value.id, version: value.version, ...(own(value, 'digest') ? { digest: value.digest } : {}) };
}

function normalizeBinding(value) {
  if (!object(value) || !shortString(value.learnerId) || !shortString(value.attemptId)) throw new TypeError('评审必须绑定个人 learnerId 和本次 attemptId。');
  const requirementRef = ref(value.requirementRef);
  if (requirementRef.id !== 'eq-requirement-auto-lamp') throw new RangeError('不是自动灯订单的需求引用。');
  lessonFor(requirementRef.version);
  const lessonRef = value.lessonRef === undefined ? copy(REQUIREMENT_LESSON_REF) : ref(value.lessonRef);
  if (lessonRef.id !== REQUIREMENT_LESSON_REF.id || lessonRef.version !== REQUIREMENT_LESSON_REF.version) throw new RangeError('情境练习版本已变化，需要新的评审记录。');
  if (value.artifactRevision !== undefined && !shortString(value.artifactRevision)) throw new TypeError('artifactRevision 必须是明确文本。');
  if (value.requirementsEpoch !== undefined && !(Number.isSafeInteger(value.requirementsEpoch) && value.requirementsEpoch >= 0) && !shortString(value.requirementsEpoch)) throw new TypeError('requirementsEpoch 必须为非负整数或明确版本文本。');
  return {
    learnerId: value.learnerId, attemptId: value.attemptId, requirementRef, lessonRef,
    ...(value.artifactRevision !== undefined ? { artifactRevision: value.artifactRevision } : {}),
    ...(value.requirementsEpoch !== undefined ? { requirementsEpoch: value.requirementsEpoch } : {}),
  };
}

function normalizeResponse(value) {
  if (!object(value) || !shortString(value.responseId) || !shortString(value.checkpointId)
    || !shortString(value.optionId) || !['ready-to-try', 'need-help'].includes(value.confidence)) throw new TypeError('回答需有 responseId、当前 checkpointId、optionId 和明确的尝试/求助选择。');
  if (value.explanation !== undefined && (typeof value.explanation !== 'string' || value.explanation.length > 1500)) throw new TypeError('可选原话最多 1500 字符，不作为自动语义评分。');
  return {
    responseId: value.responseId, checkpointId: value.checkpointId, optionId: value.optionId,
    confidence: value.confidence,
    ...(value.explanation !== undefined ? { explanation: value.explanation } : {}),
  };
}

const normalizeHelpText = value => value.trim().replace(/[\s，。！？,.!?]/gu, '');
export function isExplicitRequirementHelp(value) {
  return typeof value === 'string' && lessonBank.explicitHelpPhrases.some(phrase => normalizeHelpText(phrase) === normalizeHelpText(value));
}

function publicChallenge(checkpoint, lesson) {
  return {
    id: checkpoint.id, checkpointId: checkpoint.id, stageId: lesson.stageId,
    title: checkpoint.title, scene: copy(checkpoint.scene), prompt: checkpoint.prompt,
    options: [...checkpoint.options.map(item => ({ ...item })), { optionId: 'not-sure', label: '我还不确定，先做一个小观察' }],
    confidenceOptions: [{ id: 'ready-to-try', label: '我愿意按这个判断试一次' }, { id: 'need-help', label: '我需要引导，再试一次' }],
    manualSection: checkpoint.manualSection,
  };
}

function diagnostic(code, message, observedFact, checkpoint) {
  return { code, severity: 'info', message, observedFact, manualSection: checkpoint?.manualSection ?? '02.1' };
}

function evaluateResponse(response, checkpoint) {
  if (response.confidence === 'need-help' || response.optionId === 'not-sure' || isExplicitRequirementHelp(response.explanation)) {
    return { kind: 'needs-help', diagnostic: diagnostic('REQ_SUPPORT_REQUESTED', '先做当前小观察，再重试这一题；求助不会失去继续资格。',
      response.confidence === 'need-help' ? '学生明确选择了需要帮助。' : response.optionId === 'not-sure' ? '学生选择了还不确定。' : '原话匹配已约定的明确求助句，只据此转引导，没有推断其他中文语义。', checkpoint) };
  }
  if (!checkpoint.options.some(item => item.optionId === response.optionId)) return {
    kind: 'needs-retry', diagnostic: diagnostic('REQ_OPTION_UNKNOWN', '这个选项不属于当前情境，请使用当前题的选项重试。', '收到未知或旧题选项，没有给出本题有效判断。', checkpoint),
  };
  if (response.optionId !== checkpoint.answerOptionId) return {
    kind: 'needs-retry', diagnostic: {
      ...diagnostic(checkpoint.wrongFeedback.code, checkpoint.wrongFeedback.message, `学生选择“${checkpoint.options.find(item => item.optionId === response.optionId).label}”。${checkpoint.wrongFeedback.observedFact}`, checkpoint),
      checkpointId: checkpoint.id, selectedOptionId: response.optionId,
    },
  };
  return { kind: 'correct', diagnostic: diagnostic('REQ_SCENARIO_MATCH', '这个具体情境的选择与客户行为一致。', checkpoint.successFact, checkpoint) };
}

function inspect({ review, binding }) {
  let expected;
  try { expected = normalizeBinding(binding); }
  catch (error) { return { status: 'invalid', diagnostic: diagnostic('REQ_BINDING_INVALID', error.message, '没有可核对的个人、评审会话与版本绑定。') }; }
  const lesson = lessonFor(expected.requirementRef.version);
  if (!object(review) || review.schemaVersion !== REQUIREMENT_REVIEW_SCHEMA || !object(review.binding)
    || !Array.isArray(review.responses) || review.responses.length > MAX_RESPONSES) return {
    status: 'invalid', binding: expected, lesson, diagnostic: diagnostic('REQ_REVIEW_INVALID', '旧卡片或无效评审不能直接迁移成情境通过，请创建本次评审。', '没有当前结构的原始回答记录。'),
  };
  let savedBinding;
  try { savedBinding = normalizeBinding(review.binding); }
  catch { return { status: 'stale', binding: expected, lesson, diagnostic: diagnostic('REQ_LESSON_STALE', '评审内容版本已变化，请保留历史并开始当前练习。', '保存记录中的课程或需求版本无效。') }; }
  if (canonical(savedBinding) !== canonical(expected) || canonical(review.lessonRef) !== canonical(expected.lessonRef)) return {
    status: 'stale', binding: expected, lesson, diagnostic: diagnostic('REQ_EVIDENCE_STALE', '个人、订单需求、练习版本或作品上下文已变化，需要重新核对当前情境。', '旧回答绑定与当前绑定不一致，历史记录不能当作当前证据。'),
  };
  const responses = [], ids = new Set(), completed = [];
  let position = 0, last = null;
  for (const saved of review.responses) {
    let response;
    try { response = normalizeResponse(saved); }
    catch (error) { return { status: 'invalid', binding: expected, lesson, diagnostic: diagnostic('REQ_RESPONSE_INVALID', error.message, '历史回答结构无法重演。') }; }
    const index = lesson.checkpoints.findIndex(item => item.id === response.checkpointId);
    if (ids.has(response.responseId) || index < 0 || index > position) return {
      status: 'invalid', binding: expected, lesson, diagnostic: diagnostic('REQ_HISTORY_OUT_OF_ORDER', '回答历史有重复 ID、未知题或跳题，不能恢复成通过。', '重演时没有满足逐步情境顺序。'),
    };
    // Editing any earlier response reopens it and invalidates later completed checks.
    position = index; completed.length = index;
    last = evaluateResponse(response, lesson.checkpoints[index]);
    if (last.kind === 'correct') { completed.push({ checkpointId: response.checkpointId, responseId: response.responseId }); position++; }
    ids.add(response.responseId); responses.push(response);
  }
  return { status: 'valid', binding: expected, lesson, position, last, completed, responses };
}

function summaryFrom(inspection) {
  const { lesson, binding } = inspection;
  if (inspection.status !== 'valid') return {
    status: inspection.status, stageId: lesson?.stageId ?? 'requirements', checkpointId: null, current: null,
    readyForPractice: false, readyToAdvance: false, challenge: null,
    diagnostic: inspection.diagnostic, guidance: null, evidence: null,
    actionTarget: { type: 'requirement-review', targetId: 'requirements' },
    retryAction: { type: 'restart-review', label: '开始当前版本的情境练习', targetId: 'requirements' },
    explanationReview: 'not_semantically_evaluated',
  };
  const ready = inspection.position === lesson.checkpoints.length;
  const checkpoint = ready ? null : lesson.checkpoints[inspection.position];
  const needsGuidance = inspection.last && inspection.last.kind !== 'correct';
  const target = { type: 'requirement-challenge', targetId: checkpoint?.id ?? lesson.readyAction.targetId, checkpointId: checkpoint?.id ?? null, manualSection: checkpoint?.manualSection ?? '02.1' };
  return {
    status: ready ? 'ready' : needsGuidance ? inspection.last.kind : 'in-progress',
    stageId: lesson.stageId, checkpointId: checkpoint?.id ?? null,
    current: checkpoint ? { checkpointId: checkpoint.id, title: checkpoint.title, number: inspection.position + 1, total: lesson.checkpoints.length } : null,
    goal: lesson.goal,
    readyForPractice: ready, readyToAdvance: ready,
    completedCheckpointIds: inspection.completed.map(item => item.checkpointId),
    challenge: checkpoint ? publicChallenge(checkpoint, lesson) : null,
    diagnostic: ready ? diagnostic('REQ_SCENARIOS_READY', '已完成本版具体情境，可以继续相应练习；这不是任意中文理解、软件通过或硬件验收。', `${lesson.checkpoints.length} 个情境由原始回答逐项重演得到。`)
      : needsGuidance ? inspection.last.diagnostic : diagnostic('REQ_NEXT_SCENARIO', '先观察当前情境，再选择一个动作；不确定时可以请求小观察。', inspection.last?.diagnostic.observedFact ?? '当前情境尚未提交判断。', checkpoint),
    guidance: needsGuidance && checkpoint ? copy(checkpoint.guidance) : null,
    actionTarget: ready ? { type: 'practice', targetId: lesson.readyAction.targetId } : target,
    retryAction: ready ? copy(lesson.readyAction) : { ...target, type: needsGuidance ? 'observe-and-retry' : 'answer-checkpoint', label: needsGuidance ? '做小观察，再试当前情境' : '提交当前情境判断' },
    evidence: ready ? {
      authority: 'local-replay-only', binding: copy(binding), lessonRef: copy(binding.lessonRef),
      responseIds: inspection.completed.map(item => item.responseId),
      responsesCanonical: canonical(inspection.responses),
      scope: 'specified_scenarios_only',
    } : null,
    explanationReview: 'not_semantically_evaluated',
  };
}

export function createRequirementReview({ binding } = {}) {
  const normalized = normalizeBinding(binding);
  return { schemaVersion: REQUIREMENT_REVIEW_SCHEMA, lessonRef: copy(normalized.lessonRef), binding: normalized, responses: [] };
}

export function summarizeRequirementReview({ review, binding } = {}) {
  return summaryFrom(inspect({ review, binding }));
}

export function getRequirementChallenge({ review, binding } = {}) {
  return summarizeRequirementReview({ review, binding }).challenge;
}

export function reviewRequirementAttempt({ review, binding, attempt } = {}) {
  const inspection = inspect({ review, binding });
  const before = summaryFrom(inspection);
  if (inspection.status !== 'valid') return { accepted: false, review, summary: before };
  const rejected = (code, message) => ({ accepted: false, review, summary: {
    ...before, status: 'invalid', readyForPractice: false, readyToAdvance: false, evidence: null,
    diagnostic: diagnostic(code, message, '本次请求未写入回答记录。'),
  } });
  let response;
  try { response = normalizeResponse(attempt); }
  catch (error) { return rejected('REQ_RESPONSE_INVALID', error.message); }
  const previous = inspection.responses.find(item => item.responseId === response.responseId);
  if (previous) return canonical(previous) === canonical(response) ? { accepted: true, duplicate: true, review, summary: before }
    : rejected('REQ_RESPONSE_ID_CONFLICT', '同一个 responseId 已用于另一份回答；请保留原记录并使用新的回答 ID。');
  if (inspection.responses.length >= MAX_RESPONSES) return rejected('REQ_HISTORY_LIMIT', '本次练习记录已满，请保留历史并开启新的评审会话。');
  const index = inspection.lesson.checkpoints.findIndex(item => item.id === response.checkpointId);
  if (index < 0 || index > inspection.position) return rejected('REQ_CHECKPOINT_OUT_OF_ORDER', '请先完成当前情境，不能提交未知题或跳到后面的题。');
  const next = { schemaVersion: REQUIREMENT_REVIEW_SCHEMA, lessonRef: copy(inspection.binding.lessonRef), binding: copy(inspection.binding), responses: [...inspection.responses, response] };
  return { accepted: true, review: next, summary: summarizeRequirementReview({ review: next, binding }) };
}

/** Safe NPC facts: no answer key, raw explanation or state-write authority. */
export function requirementTutorialFacts(summary) {
  const keys = ['status', 'stageId', 'checkpointId', 'current', 'goal', 'readyForPractice', 'readyToAdvance', 'challenge', 'diagnostic', 'guidance', 'retryAction', 'actionTarget', 'explanationReview'];
  return Object.fromEntries(keys.filter(key => summary && own(summary, key)).map(key => [key, copy(summary[key])]));
}

export function getLearningProgression() {
  return {
    ref: copy(REQUIREMENT_LESSON_REF), policy: copy(lessonBank.policy),
    lessons: lessonBank.lessons.map(lesson => ({ requirementVersion: lesson.requirementVersion, stageId: lesson.stageId, title: lesson.title, goal: lesson.goal, checkpointIds: lesson.checkpoints.map(item => item.id) })),
    practiceMilestones: copy(lessonBank.practiceMilestones),
  };
}
