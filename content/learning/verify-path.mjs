import assert from 'node:assert/strict';
import { checkRequirementSelections } from '../npc.js';
import { createRequirementReview, getRequirementChallenge, reviewRequirementAttempt, summarizeRequirementReview } from '../requirements-review.js';

// Developer replay of authored synthetic decisions; not a student-facing answer loader.
const binding = version => ({ learnerId: 'synthetic-playtest', attemptId: 'order-01-attempt-1', requirementRef: { id: 'eq-requirement-auto-lamp', version } });
const oldCard = { input: 'light-sensor', condition: 'below-customer-threshold', output: 'dark-on-bright-off', continuous: 'repeat-read-decide', explanation: '我完全不懂，随便选的。' };
assert.equal(checkRequirementSelections(oldCard).readyForSubmission, false);
console.log('反例：旧四项全对 + 明确不懂 → 不能继续。');

const base = binding('1.0.0');
let review = createRequirementReview({ binding: base });
for (const [responseId, optionId] of [['try-unknown', 'unknown'], ['ask-help', 'not-sure']]) {
  const current = getRequirementChallenge({ review, binding: base });
  const result = reviewRequirementAttempt({ review, binding: base, attempt: { responseId, checkpointId: current.id, optionId, confidence: 'ready-to-try' } });
  review = result.review;
  assert.equal(result.summary.readyToAdvance, false);
  console.log(`${result.summary.status} / ${result.summary.diagnostic.code} / ${result.summary.guidance.tryThis}`);
}

const paths = [
  ['1.0.0', ['current-light', 'lamp-on', 'lamp-off', 'read-decide-repeat', 'lamp-off', 'trace-b']],
  ['1.1.0', ['now-on', 'lamp-off', 'comparison', 'new-current-suite']],
];
let readyBase;
for (const [version, choices] of paths) {
  const currentBinding = binding(version);
  if (version !== '1.0.0') review = createRequirementReview({ binding: currentBinding });
  for (const [index, optionId] of choices.entries()) {
    const current = getRequirementChallenge({ review, binding: currentBinding });
    assert.ok(current);
    const result = reviewRequirementAttempt({ review, binding: currentBinding, attempt: { responseId: `${version}-${index}`, checkpointId: current.id, optionId, confidence: 'ready-to-try' } });
    review = result.review;
    console.log(`需求 ${version} / ${current.title} → ${result.summary.status}`);
  }
  const restored = JSON.parse(JSON.stringify(review));
  assert.equal(summarizeRequirementReview({ review: restored, binding: currentBinding }).readyToAdvance, true);
  if (version === '1.0.0') readyBase = restored;
  console.log(`需求 ${version}：原始回答恢复重演为 ready（只限具体情境，不是程序或实物验收）。`);
}
assert.equal(summarizeRequirementReview({ review: readyBase, binding: binding('1.1.0') }).status, 'stale');
const edit = reviewRequirementAttempt({ review: readyBase, binding: base, attempt: { responseId: 'edit-equality', checkpointId: 'req-base-equality', optionId: 'lamp-on', confidence: 'ready-to-try' } });
assert.equal(edit.summary.readyToAdvance, false);
assert.equal(edit.summary.evidence, null);
console.log('反例：改答边界 → 当前与后续结论失效；基础旧证据不能当新版需求通过。');
console.log('PASS：开发者逻辑游玩路径；网页/NPC/A运行事实接入和整体验收仍由总控完成。');
