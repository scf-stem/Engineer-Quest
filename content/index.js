import orderJson from './auto-lamp/order.json' with { type: 'json' };
import customerTestsJson from './auto-lamp/customer-tests.json' with { type: 'json' };
import npcJson from './auto-lamp/npc.json' with { type: 'json' };
import stagesJson from './auto-lamp/stages.json' with { type: 'json' };
import manualJson from './auto-lamp/manual.json' with { type: 'json' };
import hintsJson from './auto-lamp/hints.json' with { type: 'json' };
import economyJson from './auto-lamp/economy.candidate.json' with { type: 'json' };
import requirementCardSchemaJson from './auto-lamp/requirement-card.schema.json' with { type: 'json' };
import experienceCandidateJson from './auto-lamp/experience.candidate.json' with { type: 'json' };

function freezeContent(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeContent(child);
    Object.freeze(value);
  }
  return value;
}

// Content references deliberately omit digest. E stamps canonical digests and binds snapshots.
export const autoLampOrder = freezeContent(orderJson);
export const customerTestCatalog = freezeContent(customerTestsJson);
export const npcQuestionCards = freezeContent(npcJson);
export const courseStages = freezeContent(stagesJson);
export const studentManual = freezeContent(manualJson);
export const teachingHints = freezeContent(hintsJson);
export const economyCandidate = freezeContent(economyJson);
export const requirementCardSchema = freezeContent(requirementCardSchemaJson);
export const firstOrderExperienceCandidate = freezeContent(experienceCandidateJson);
export const courseBundle = freezeContent({
  order: autoLampOrder,
  customerTests: customerTestCatalog,
  npc: npcQuestionCards,
  stages: courseStages,
  manual: studentManual,
  hints: teachingHints,
  economy: economyCandidate,
  requirementCardSchema,
  experienceCandidate: firstOrderExperienceCandidate,
});

export function getRequirement(version) {
  const requirement = autoLampOrder.requirements.find(item => item.ref.version === version);
  if (!requirement) throw new RangeError(`未知需求版本：${String(version)}。请显式选择冻结版本。`);
  return requirement;
}

export function getCustomerSuite(requirementVersion) {
  getRequirement(requirementVersion);
  const suite = customerTestCatalog.suites.find(item => item.requirementRef.version === requirementVersion);
  if (!suite) throw new RangeError(`需求 ${requirementVersion} 没有对应客户测试。`);
  return suite;
}

export function getManualSection(id) {
  const section = studentManual.sections.find(item => item.id === id);
  if (!section) throw new RangeError(`未知手册节号：${String(id)}`);
  return section;
}

export { REQUIREMENT_LESSON_REF, createRequirementReview, getRequirementChallenge, reviewRequirementAttempt, summarizeRequirementReview, requirementTutorialFacts, getLearningProgression } from './requirements-review.js';
export { deriveLearningProgress, evaluateLearningEvidence, getLearningEvidencePolicy } from './learning-progress.js';
