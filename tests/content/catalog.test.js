import test from 'node:test';
import assert from 'node:assert/strict';
import { autoLampOrder, courseBundle, courseStages, customerTestCatalog, economyCandidate, getCustomerSuite, getManualSection, getRequirement, npcQuestionCards, studentManual, teachingHints } from '../../content/index.js';
import { getLearningProgression, createRequirementReview, getRequirementChallenge } from '../../content/requirements-review.js';
import { getLearningEvidencePolicy } from '../../content/learning-progress.js';

test('all course stages have usable feedback, help, artifacts and teacher intervention', () => {
  const ids = new Set(courseStages.stages.map(item => item.id));
  assert.deepEqual([...ids], autoLampOrder.stages);
  const hintIds = new Set(teachingHints.topics.map(item => item.id));
  const seen = new Set();
  for (const stage of courseStages.stages) {
    for (const key of ['title', 'studentAction', 'feedback', 'failureMessage', 'help', 'teacherIntervention']) assert.ok(stage[key]?.length > 0, `${stage.id}.${key}`);
    for (const key of ['artifacts', 'passConditions', 'manualSections']) assert.ok(stage[key].length > 0, `${stage.id}.${key}`);
    assert.ok(stage.requires.every(id => seen.has(id)), `${stage.id}: dependencies are ordered and acyclic`);
    for (const id of stage.manualSections) assert.ok(getManualSection(id));
    if (stage.hintTopic) assert.ok(hintIds.has(stage.hintTopic));
    if (stage.requirementRef) assert.deepEqual(stage.testSuiteRef, getCustomerSuite(stage.requirementRef.version).ref);
    seen.add(stage.id);
  }
  assert.equal(courseStages.stages.find(item => item.id === 'extension').optional, true);
  assert.deepEqual(courseStages.stages.find(item => item.id === 'reflection').requires, ['delivery']);
  assert.equal(courseStages.trialTiming.segments.reduce((sum, item) => sum + item.duration, 0), 240);
});

test('independent literal test fixtures agree with their own frozen requirements and allowed inputs', () => {
  for (const suite of customerTestCatalog.suites) {
    const requirement = getRequirement(suite.requirementRef.version);
    assert.equal(requirement.calibrationStatus, 'synthetic');
    assert.equal(new Set(suite.tests.map(item => item.id)).size, suite.tests.length);
    for (const customerTest of suite.tests) {
      assert.equal(customerTest.requirementId, requirement.ref.id);
      assert.ok(customerTest.maxSteps > 0 && customerTest.maxTimeMs > 0);
      let previous = -1;
      for (const input of customerTest.inputTimeline) {
        assert.ok(Number.isSafeInteger(input.atMs) && input.atMs > previous && input.atMs < customerTest.maxTimeMs);
        assert.ok(Number.isInteger(input.signals.light) && input.signals.light >= 0 && input.signals.light <= 1023);
        previous = input.atMs;
      }
      previous = -1;
      for (const assertion of customerTest.assertions) {
        assert.ok(assertion.atMs > previous && assertion.atMs < customerTest.maxTimeMs);
        const input = customerTest.inputTimeline.filter(item => item.atMs <= assertion.atMs).at(-1);
        assert.ok(assertion.atMs - input.atMs >= requirement.responseWithinMs);
        assert.equal(assertion.equals, input.signals.light < requirement.rule.threshold);
        assert.equal(assertion.output, 'lamp');
        previous = assertion.atMs;
      }
      assert.ok(getManualSection(customerTest.manualSection));
    }
  }
  assert.notEqual(getRequirement('1.0.0').rule.threshold, getRequirement('1.1.0').rule.threshold);
  assert.deepEqual(autoLampOrder.codeChange.toRequirementRef, getRequirement('1.1.0').ref);
  assert.deepEqual(autoLampOrder.codeChange.toTestSuiteRef, getCustomerSuite('1.1.0').ref);
});

test('question and hint references resolve without inventing printed pages or fixed hardware details', () => {
  assert.equal(studentManual.status, 'section_draft_only');
  assert.equal(studentManual.printPagesAssigned, false);
  assert.equal(new Set(studentManual.sections.map(item => item.id)).size, studentManual.sections.length);
  const questionIds = new Set(npcQuestionCards.questions.map(item => item.id));
  assert.deepEqual(courseBundle.requirementCardSchema['x-content-ref'], autoLampOrder.requirementSchemaRef);
  assert.deepEqual(courseBundle.requirementCardSchema.required, [...npcQuestionCards.fields.map(field => field.key), 'explanation']);
  for (const field of npcQuestionCards.fields) {
    assert.ok(questionIds.has(field.questionId));
    assert.equal(field.options.filter(option => option.id === field.expectedOptionId).length, 1);
    assert.deepEqual(courseBundle.requirementCardSchema.properties[field.key].enum, field.options.map(option => option.id));
  }
  for (const question of npcQuestionCards.questions) {
    assert.ok(getManualSection(question.manualSection));
    for (const requirement of autoLampOrder.requirements) {
      assert.notEqual(question.requirementPath.split('.').reduce((node, key) => node?.[key], requirement), undefined);
    }
  }
  for (const topic of teachingHints.topics) {
    assert.ok(getManualSection(topic.manualSection));
    assert.deepEqual(topic.levels.map(item => item.level), [1, 2, 3, 4]);
  }
});

test('personal income defaults remain candidate-only, and unverified shop modules stay blocked', () => {
  assert.equal(autoLampOrder.participation, 'individual');
  assert.equal(economyCandidate.confirmed.leaderboardMetric, 'income');
  assert.equal(economyCandidate.executionMode, 'synthetic_only');
  assert.equal(economyCandidate.status, 'proposal_unconfirmed');
  assert.equal(economyCandidate.candidateAccounting.purchaseChangesIncome, false);
  assert.equal(economyCandidate.candidateAccounting.baseMaterialsCost, 0);
  assert.equal(economyCandidate.candidateAccounting.hintsCost, 0);
  assert.equal(economyCandidate.shopPolicyCandidate.optionalDoesNotBlockGraduation, true);
  assert.ok(economyCandidate.candidateCatalog.every(item => item.listingStatus === 'blocked_pending_validation' && item.realStock === null));
  assert.ok(economyCandidate.candidateRewards.every(item => item.resubmissionReward === 0 && item.settlementScope.startsWith('one_per_student')));
  assert.equal('teamId' in courseBundle.order, false);
  assert.ok(Object.isFrozen(courseBundle));
  assert.ok(Object.isFrozen(courseBundle.customerTests.suites[0].tests[0].assertions));
});

test('scene exploration has resolving navigation and manual references without progress gates', () => {
  const experience = courseBundle.experienceCandidate;
  const actionIds = new Set(experience.actions.map(item => item.id));
  const inspectionIds = new Set(experience.inspectionCards.map(item => item.id));
  assert.deepEqual(experience.taskRef, autoLampOrder.ref);
  assert.ok(actionIds.has(experience.currentObjectiveCandidate.primaryActionId));
  assert.equal(experience.exploration.requiredForProgress, false);
  assert.equal(experience.exploration.visitedCountUnlocksAnything, false);
  assert.equal(experience.exploration.hotspots.length, 3);
  for (const hotspot of experience.exploration.hotspots) {
    assert.equal(hotspot.optional, true);
    assert.ok(actionIds.has(hotspot.actionId));
    if (hotspot.manualSection) assert.ok(getManualSection(hotspot.manualSection));
    for (const id of hotspot.inspectionCardIds ?? []) assert.ok(inspectionIds.has(id));
  }
  for (const card of experience.inspectionCards) {
    assert.ok(getManualSection(card.manualSection));
    assert.ok(actionIds.has(card.manualActionId));
  }
  assert.equal(experience.actionProtocol.allowedEffect, '纯导航、打开面板、查看物品或请求显示对应手册节。');
  assert.equal('rewardAmount' in experience, false);
});

test('reworked lessons and milestones reference real manual sections and supported observations', () => {
  const progression = getLearningProgression(), policy = getLearningEvidencePolicy();
  assert.equal(progression.lessons.length, 2);
  assert.equal(progression.practiceMilestones.length, 7);
  for (const lesson of progression.lessons) {
    const binding = { learnerId: 'synthetic-catalog', attemptId: 'catalog-attempt', requirementRef: getRequirement(lesson.requirementVersion).ref };
    const challenge = getRequirementChallenge({ review: createRequirementReview({ binding }), binding });
    assert.ok(getManualSection(challenge.manualSection));
    assert.equal(lesson.checkpointIds[0], challenge.id);
    assert.equal(new Set(lesson.checkpointIds).size, lesson.checkpointIds.length);
    assert.equal('checkpoints' in lesson, false); // public overview does not expose the complete answer bank
  }
  for (const milestone of progression.practiceMilestones) {
    assert.ok(getManualSection(milestone.manualSection));
    assert.equal(milestone.fullAnswerAllowed, false);
    assert.ok(milestone.requiresEvidence.every(code => policy.sourcesByFact[code] && policy.dependenciesByFact[code]));
  }
});
