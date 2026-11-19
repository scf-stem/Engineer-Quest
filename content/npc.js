import { getCustomerSuite, getRequirement, npcQuestionCards, studentManual } from './index.js';
import { isExplicitRequirementHelp } from './requirements-review.js';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const sameRef = (left, right) => left?.id === right.id && left?.version === right.version;
const fallbackReasons = new Set(['requested', 'offline', 'timeout', 'invalid_response', 'semantic_review_pending']);

/** Checks explicit option IDs only. This is never a semantic grade of the explanation. */
export function checkRequirementSelections(card) {
  const issues = [];
  for (const field of npcQuestionCards.fields) {
    const selected = card && hasOwn(card, field.key) ? card[field.key] : undefined;
    if (selected !== field.expectedOptionId) {
      issues.push({ field: field.key, code: selected === undefined || selected === '' ? 'MISSING_SELECTION' : 'INCORRECT_SELECTION', questionId: field.questionId });
    }
  }
  if (typeof card?.explanation !== 'string' || !card.explanation.trim() || card.explanation.length > 1500) {
    issues.push({ field: 'explanation', code: 'EXPLANATION_REQUIRED_OR_TOO_LONG', questionId: 'req-explanation' });
  }
  if (isExplicitRequirementHelp(card?.explanation)) issues.unshift({ field: 'explanation', code: 'EXPLICIT_SUPPORT_SIGNAL', questionId: 'req-guided-observation' });
  return {
    draftComplete: issues.length === 0,
    readyForSubmission: false,
    readyForPractice: false,
    readyToAdvance: false,
    requiresScenarioReview: true,
    issues,
    explanationReview: 'semantic_review_pending',
    notice: '旧四选项只保留草稿覆盖信息。必须完成当前绑定的情境练习；此接口永不授予继续资格，也不理解任意中文。',
  };
}

function questionResponse({ questionId, requirementVersion, fallbackReason, needsTeacherHelp = false, citation, coverage }) {
  if (!fallbackReasons.has(fallbackReason)) throw new RangeError('未知静态降级原因。');
  const requirement = getRequirement(requirementVersion);
  const question = npcQuestionCards.questions.find(item => item.id === questionId);
  return {
    mode: 'static',
    fallbackReason,
    questionId,
    question: question.question,
    citations: [
      { ref: requirement.ref, path: question.requirementPath },
      { ref: studentManual.ref, path: `sections/${question.manualSection}` },
      ...(citation ? [citation] : []),
    ],
    suggestedNextStep: question.nextStep,
    needsTeacherHelp,
    ...(coverage ? { coverage } : {}),
    notice: npcQuestionCards.notice,
  };
}

export function reviewStaticRequirements({ requirementVersion, card, fallbackReason = 'requested', teacherHelpRequested = false }) {
  getRequirement(requirementVersion);
  const coverage = checkRequirementSelections(card);
  return questionResponse({
    questionId: teacherHelpRequested ? 'teacher-help' : coverage.issues[0]?.questionId ?? 'req-discussion',
    requirementVersion,
    fallbackReason,
    needsTeacherHelp: teacherHelpRequested,
    coverage,
  });
}

/** The supplied testRun must be E-verified in the host app; this helper grants no authority. */
export function reviewStaticTechnical({ requirementVersion, testRun, stage = 'blocks', fallbackReason = 'requested', teacherHelpRequested = false }) {
  const suite = getCustomerSuite(requirementVersion);
  let questionId = 'tech-run';
  let citation;
  if (stage === 'hardware') questionId = 'hardware-teacher';
  else if (teacherHelpRequested) questionId = 'teacher-help';
  else if (sameRef(testRun?.requirementRef, suite.requirementRef) && sameRef(testRun?.testSuiteRef, suite.ref)
    && Array.isArray(testRun.cases) && testRun.cases.length === suite.tests.length
    && suite.tests.every(item => testRun.cases.filter(result => result.caseId === item.id).length === 1)) {
    const failed = testRun.cases.find(item => item.passed !== true);
    if (failed) {
      questionId = Array.isArray(failed.diagnostics) && failed.diagnostics.some(item => item.code === 'EXECUTION_BUDGET_EXCEEDED') ? 'tech-budget' : 'tech-failure';
      citation = { ref: suite.ref, path: `tests/${failed.caseId}` };
    } else if (testRun.passed === true) questionId = 'tech-explain';
  }
  return questionResponse({ questionId, requirementVersion, fallbackReason, citation, needsTeacherHelp: stage === 'hardware' || teacherHelpRequested });
}
