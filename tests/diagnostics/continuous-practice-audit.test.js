import test from 'node:test';
import assert from 'node:assert/strict';
import {blocksToProgram, performProgramLearningAction, getProgramPracticeCriterion, explainProgramPracticeResult} from '../../src/program/index.js';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createWorkspacePolicies} from '../../src/integration/learning-policy-adapter.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createMemoryProgressStore} from '../../src/integration/local-progress-store.js';
import {getRequirement, getCustomerSuite} from '../../content/index.js';
import {canonicalJson} from '../../src/contracts/index.js';

// Characterizes b616c2a's existing learning criterion; it does not create a new policy.
// Authored semantic reconstruction of the CU-reported orders, not the CU learner's archive.
const hardware = await createHardwareContext();
const context = await createProgramContext(hardware);
const wiring = createAutoLightExample(hardware.profile);
const checked = await context.topologyFor(wiring);
assert.equal(checked.ok, true);
const topology = checked.value;
const child = block => ({block});
const block = (type, id, fields = {}, inputs = {}) => ({type, id, fields, inputs});
function auditBlocks(order, waitMs = 100) {
  const number = (id, value) => block('math_number', id, {NUM: value});
  const write = (id, value) => block('eqp_write', id, {PORT: 'LAMP'}, {VALUE: child(block('logic_boolean', id + '-value', {BOOL: value ? 'TRUE' : 'FALSE'}))});
  const declaration = block('eqp_declare', 'audit-declaration', {NAME: 'light', TYPE: 'int', CONSTANT: 'FALSE'}, {INITIAL: child(number('audit-initial', 0))});
  const read = block('eqp_set', 'audit-assign', {NAME: 'light'}, {VALUE: child(block('eqp_read_analog', 'audit-read', {PORT: 'LIGHT'}))});
  const pause = block('eqp_wait', 'audit-wait', {}, {MS: child(number('audit-duration', waitMs))});
  const compare = block('logic_compare', 'audit-compare', {OP: 'LT'}, {A: child(block('eqp_get', 'audit-light', {NAME: 'light'})), B: child(number('audit-threshold', 450))});
  const branch = block('controls_if', 'audit-if', {}, {IF0: child(compare), DO0: child(write('audit-on', true)), ELSE: child(write('audit-off', false))});
  branch.extraState = {hasElse: true};
  read.next = child(order === 'read-wait-if' ? pause : branch);
  (order === 'read-wait-if' ? pause : branch).next = child(order === 'read-wait-if' ? branch : pause);
  return {blocks: {languageVersion: 0, blocks: [block('eqp_program', 'audit-root', {}, {VARIABLES: child(declaration), LOOP: child(read)})]}};
}
function runAction(order, waitMs = 100, actionId = 'repeat-read', inputs = {}) {
  const blockState = auditBlocks(order, waitMs), program = blocksToProgram(blockState);
  assert.equal(program.ok, true, JSON.stringify(program.diagnostics));
  const request = {phase: 'blocks', actionId, inputs, blockState, program, wiring};
  const result = performProgramLearningAction({actionId, inputs, program: program.value, blockState, topology});
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return {request, result};
}
async function customerReport(action) {
  const program = action.request.program.value, source = context.shortSource(program).value.source;
  return context.evaluateSoftware({phase: 'blocks', program, source, wiring, ...context.editions.blocks.refs,
    languageProfileRef: context.languageRef, deviceProfileRef: hardware.ref});
}
const writes = action => action.result.value.observation.writes.map(event => [event.atMs, event.value]);
const total = report => report.cases.reduce((sum, item) => sum + item.assertions.length, 0);

test('read-wait100-if really writes at 100/200/300, fails all three learning samples yet passes frozen customer 26/26', async () => {
  const action = runAction('read-wait-if'), before = canonicalJson(action);
  assert.deepEqual(writes(action), [[100, true], [200, false], [300, true]]);
  assert.deepEqual(action.result.value.factCodes, []);
  const explanation = explainProgramPracticeResult(action);
  assert.equal(explanation.status, 'available');
  assert.deepEqual(explanation.windows.map(row => [row.checkedAtMs, row.input, row.lastRead.atMs, row.lastRead.value, row.lastWrite?.atMs ?? null, row.actualLamp, row.expectedLamp, row.readObserved, row.outputMatches]), [
    [99, 150, 0, 150, null, false, true, true, false],
    [199, 850, 100, 850, 100, true, false, true, false],
    [299, 180, 200, 180, 200, false, true, true, false],
  ]);
  assert.equal(explanation.windows[0].actualOutputSource, 'initial');
  assert.equal(explanation.windows[0].lastWrite, null);
  assert.match(explanation.windows[0].reasons[0].message, /初始灯态/);
  const report = await customerReport(action);
  assert.equal(report.passed, true); assert.equal(total(report), 26);
  assert.deepEqual(report.cases.map(item => [item.caseId, item.assertions.length, item.passed]), [['base-dark', 4, true], ['base-bright', 4, true], ['base-boundary', 8, true], ['base-changing', 10, true]]);
  assert.equal(canonicalJson(action), before); assert.deepEqual(action.result.value.factCodes, []);
  assert.match(explanation.summary, /不能据此断定客户超时/);
  assert.equal(explanation.customerCheck.evaluated, false);
  assert.equal(explanation.customerCheck.responseWithinMs, getRequirement('1.0.0').responseWithinMs);
});

test('read-if-wait100 produces 0/100/200 writes, the existing fact, and the same customer 26/26', async () => {
  const action = runAction('read-if-wait');
  assert.deepEqual(writes(action).slice(0, 3), [[0, true], [100, false], [200, true]]);
  assert.deepEqual(action.result.value.factCodes, ['repeated_current_read_observed']);
  assert.deepEqual(action.result.value.facts[0].payload.observations.map(row => row.checkedAtMs), getProgramPracticeCriterion().windows.map(row => row.checkedAtMs));
  const explanation = explainProgramPracticeResult(action);
  assert.equal(explanation.windows.every(row => row.readObserved && row.outputMatches), true);
  const report = await customerReport(action); assert.equal(report.passed, true); assert.equal(total(report), 26);
});

test('same-time ordering associates write100 with the earlier read0, not the later read100', () => {
  const row = explainProgramPracticeResult(runAction('read-wait-if')).windows[1];
  assert.equal(row.lastWrite.atMs, row.lastRead.atMs);
  assert.equal(row.lastReadBeforeWrite.atMs, 0); assert.equal(row.lastReadBeforeWrite.value, 150);
  assert.ok(row.lastReadBeforeWrite.eventIndex < row.lastWrite.eventIndex);
  assert.ok(row.lastWrite.eventIndex < row.lastRead.eventIndex);
  assert.ok(row.lastReadBeforeWrite.step < row.lastWrite.step); assert.ok(row.lastWrite.step < row.lastRead.step);
  assert.equal(row.lastWrite.nodeId, 'audit-on'); assert.equal(row.lastRead.nodeId, 'audit-read');
});

test('wait50 before if passes too, so diagnosis cannot require moving wait after if', async () => {
  const action = runAction('read-wait-if', 50), explanation = explainProgramPracticeResult(action);
  assert.deepEqual(action.result.value.factCodes, ['repeated_current_read_observed']);
  assert.equal(explanation.windows.every(row => row.readObserved && row.outputMatches), true);
  assert.equal((await customerReport(action)).passed, true);
  assert.doesNotMatch(explanation.nextAction, /必须.*等待|等待.*后|waitMs|完整程序/);
  const failed = explainProgramPracticeResult(runAction('read-wait-if'));
  assert.doesNotMatch(failed.nextAction, /必须.*等待|等待.*后|waitMs|完整程序/);
  assert.match(failed.nextAction, /间隔缩短/);
});

test('wait150 is a distinct true customer failure at the exact frozen 200ms assertions', async () => {
  const action = runAction('read-wait-if', 150), explanation = explainProgramPracticeResult(action), report = await customerReport(action);
  assert.equal(report.passed, false);
  const failures = report.cases.flatMap(item => item.assertions.filter(row => !row.passed).map(row => [item.caseId, row.atMs, row.actual, row.expected]));
  assert.deepEqual(failures, [['base-changing', 1335, false, true], ['base-changing', 1915, true, false], ['base-changing', 2505, false, true]]);
  assert.equal(explanation.windows[2].outputMatches, true); assert.equal(explanation.windows[2].readObserved, false);
  assert.equal(explanation.windows[2].matchingRead, null); // A coincidentally correct held lamp is not a new read.
});

test('criterion is immutable, visible before running, and the diagnostic has no new completion authority', () => {
  const criterion = getProgramPracticeCriterion();
  assert.equal(getProgramPracticeCriterion('branch-output'), null);
  assert.deepEqual(criterion.windows.map(row => [row.fromMs, row.toMs, row.checkedAtMs]), [[0, 99, 99], [100, 199, 199], [200, 299, 299]]);
  assert.match(criterion.description, /99、199、299/); assert.match(criterion.description, /不是正式客户/);
  assert.equal(Object.isFrozen(criterion.windows[0]), true);
  assert.throws(() => {criterion.windows[0].checkedAtMs = 200;}, TypeError);
  const action = runAction('read-wait-if'), explanation = explainProgramPracticeResult(action);
  for (const field of ['passed', 'ready', 'readyToAdvance', 'factCodes', 'facts', 'observations']) assert.equal(Object.hasOwn(explanation, field), false);
  assert.equal(Object.isFrozen(explanation.windows[0].lastRead), true);
  assert.equal(Object.isFrozen(action.result.value.simulation), false);
  assert.equal(explainProgramPracticeResult(runAction('read-if-wait', 100, 'read-input', {light: 150})), null);
  assert.equal(explainProgramPracticeResult(null), null);
});

test('mismatched old timelines or reordered equal-time events are unavailable, never silently reinterpreted', () => {
  const old = runAction('read-wait-if'); old.result.value.simulation.inputTimeline[1].atMs = 101;
  const explanation = explainProgramPracticeResult(old);
  assert.equal(explanation.status, 'unavailable'); assert.deepEqual(explanation.windows, []);
  assert.equal(explanation.diagnostics[0].code, 'PRACTICE_SCENE_UNAVAILABLE');
  const reordered = runAction('read-wait-if'), events = reordered.result.value.simulation.events;
  const write = events.findIndex(event => event.atMs === 100 && event.kind === 'write');
  const read = events.findIndex(event => event.atMs === 100 && event.kind === 'read');
  [events[write], events[read]] = [events[read], events[write]];
  assert.equal(explainProgramPracticeResult(reordered).status, 'unavailable');
});

test('real incomplete execution does not extrapolate future window state or claim that current input was read', () => {
  const action = runAction('read-wait-if', 0), explanation = explainProgramPracticeResult(action);
  assert.equal(action.result.value.simulation.status, 'budget_exceeded');
  assert.equal(explanation.windows.every(row => !row.covered && row.actualLamp === null && row.outputMatches === null), true);
  assert.equal(explanation.diagnostics[0].code, 'STEP_BUDGET');
  assert.equal(Object.isFrozen(action.result.value.simulation.diagnostics[0]), false);
  const delayedStart = auditBlocks('read-if-wait');
  const root = delayedStart.blocks.blocks[0], first = root.inputs.LOOP.block;
  const wait = first.next.block.next.block; delete first.next.block.next; wait.next = child(first); root.inputs.LOOP = child(wait);
  const parsed = blocksToProgram(delayedStart); assert.equal(parsed.ok, true);
  const result = performProgramLearningAction({actionId: 'repeat-read', inputs: {}, program: parsed.value, topology});
  const report = explainProgramPracticeResult({request: {actionId: 'repeat-read'}, result});
  assert.equal(report.windows[0].readObserved, false); assert.doesNotMatch(report.summary, /新输入已读到/);
});

test('real D gate blocks the otherwise customer-conforming old order until actual current learning observations exist', async () => {
  const policies = await createWorkspacePolicies(context), store = createMemoryProgressStore();
  const work = await openLocalWorkspace({programContext: context, policies, store});
  try {
    await work.start('连续观察语义审计合成样本'); await work.claimOrder();
    for (const optionId of ['current-light', 'lamp-on', 'lamp-off', 'read-decide-repeat', 'lamp-off', 'trace-b']) {
      await work.reviewRequirements({attempt: {responseId: crypto.randomUUID(), checkpointId: work.getState().facts.requirements.checkpointId, optionId, confidence: 'ready-to-try'}});
    }
    await work.editDraft({wiring}); await work.performLearningAction({actionId: 'observe-output', inputs: {on: true}});
    await work.editDraft({blockState: auditBlocks('read-wait-if')});
    const actions = [['read-input', {light: 150}], ['branch-output', {scene: 'dark'}], ['branch-output', {scene: 'bright'}], ['repeat-read', {}]];
    for (const [actionId, inputs] of actions) await work.performLearningAction({actionId, inputs});
    const first = work.getState();
    assert.equal(first.facts.learning.currentMilestoneId, 'repeat-read'); assert.equal(first.facts.learning.readyForBaseTests, false);
    assert.equal(first.attempt.learningActions.at(-1).result.observations.length, 0);
    assert.equal(explainProgramPracticeResult(first.attempt.learningActions.at(-1)).windows.length, 3);
    await assert.rejects(work.runTests('blocks'), {code: 'BASE_PRACTICE_NOT_READY'});
    assert.equal(work.getState().attempt.tests.length, 0); assert.equal(work.getState().ledger.income, 0);
    await work.editDraft({blockState: auditBlocks('read-if-wait')});
    for (const [actionId, inputs] of actions) await work.performLearningAction({actionId, inputs});
    assert.equal(work.getState().facts.learning.readyForBaseTests, true);
    const proof = await work.runTests('blocks'); assert.equal(proof.proof.report.passed, true); assert.equal(total(proof.proof.report), 26);
    assert.equal(work.getState().ledger.income, 0);
  } finally { await work.close(); }
});

// All expected customer samples still come from the frozen D suite, never from student IR.
test('the public response deadline and frozen sampling contract remain 200ms and unmodified', () => {
  assert.equal(getRequirement('1.0.0').responseWithinMs, 200);
  const suite = getCustomerSuite('1.0.0');
  assert.equal(suite.tests.reduce((sum, item) => sum + item.assertions.length, 0), 26);
  assert.deepEqual(suite.tests.find(item => item.id === 'base-changing').assertions.map(item => item.atMs), [200, 574, 775, 1134, 1335, 1714, 1915, 2304, 2505, 2899]);
});
