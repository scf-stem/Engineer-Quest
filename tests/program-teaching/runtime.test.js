import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTeachingRun, teachingFrameAt, assessTeachingRun} from '../../src/program-teaching/runtime.js';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {canonicalJson} from '../../src/contracts/index.js';

// Real B profile and B-validated wiring, not SYNTHETIC_DEVICE / SYNTHETIC_TOPOLOGY.
const hardware = await createHardwareContext();
const context = await createProgramContext(hardware);
const wiring = createAutoLightExample(hardware.profile);
const topologyResult = await context.topologyFor(wiring);
assert.equal(topologyResult.ok, true);
const topology = topologyResult.value;
const bool = (id, on) => ({type: 'logic_boolean', id, fields: {BOOL: on ? 'TRUE' : 'FALSE'}});
const number = (id, value) => ({type: 'math_number', id, fields: {NUM: value}});
const output = (id, on) => ({type: 'eqp_write', id, fields: {PORT: 'LAMP'}, inputs: {VALUE: {block: bool(id + '-value', on)}}});
const wait = (id, ms) => ({type: 'eqp_wait', id, inputs: {MS: {block: number(id + '-value', ms)}}});
const workspace = (...blocks) => ({blocks: {languageVersion: 0, blocks}});
function chain(...blocks) { for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = {block: blocks[i + 1]}; return blocks[0]; }
const sample = (id = 'sample-read') => ({type: 'eqt_sample', id: 'visible-observer', inputs: {VALUE: {block: {type: 'eqp_read_analog', id, fields: {PORT: 'LIGHT'}}}}});
const request = (kind, blockState, extra = {}) => ({kind, blockState, topology, light: 713, initialLamp: false, actor: 'learner', runId: 'real-run-1', ...extra});
const run = (kind, blockState, extra) => buildTeachingRun(request(kind, blockState, extra));
function good(result) { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.value; }
function error(result, code, nodeId) { assert.equal(result.ok, false); assert.ok(result.diagnostics.some(item => item.code === code), JSON.stringify(result.diagnostics)); if (nodeId) assert.ok(result.diagnostics.some(item => item.nodeId === nodeId), JSON.stringify(result.diagnostics)); }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
function programIds(value) { return Array.isArray(value) ? value.flatMap(programIds) : value && typeof value === 'object' ? [...(typeof value.id === 'string' ? [value.id] : []), ...Object.values(value).flatMap(programIds)] : []; }

function eventTimes(result) { return assessTeachingRun(result, {goal: 'on-wait-off'}).observed.writes.map(event => [event.atMs, event.value, event.nodeId]); }

test('a real output fragment becomes a legal setup, preserves IDs/profile refs and runs only once', () => {
  const blockState = deepFreeze(workspace(output('learner-on', true))), before = canonicalJson(blockState);
  const result = run('output', blockState), value = good(result);
  assert.deepEqual(value.origin, {actor: 'learner', kind: 'output', runId: 'real-run-1', scaffoldVersion: 'g0-g3/1'});
  assert.equal(value.workspaceCanonical, before); assert.equal(canonicalJson(blockState), before);
  assert.deepEqual(value.studentNodeIds, ['learner-on', 'learner-on-value']);
  assert.equal(value.program.setup.find(node => node.id === 'learner-on').kind, 'write');
  assert.equal(value.program.loop.length, 1); assert.equal(value.program.loop[0].kind, 'wait');
  assert.equal(value.program.loop[0].duration.value, 100);
  assert.deepEqual(value.simulation.deviceProfileRef, hardware.ref); assert.deepEqual(value.simulation.wiringRef, topology.wiringRef);
  assert.ok(value.simulation.completedThroughMs >= 800);
  const assessed = assessTeachingRun(result, {goal: 'on'});
  assert.equal(assessed.ok, true); assert.deepEqual(assessed.observed.writes.map(event => event.nodeId), ['learner-on']);
  assert.equal(assessed.observed.waits.length, 0); assert.equal(assessed.observed.lastStudentLamp, true);
  assert.equal(teachingFrameAt(result, 300).nodeId, 'learner-on');
  assert.equal(teachingFrameAt(value, 300).lamp, true);
});

test('HOST initial lamp restores the real previous state but is excluded from student output evidence', () => {
  const result = run('reading', workspace(sample()), {initialLamp: true, light: 927}); good(result);
  const frame = teachingFrameAt(result, 20), assessed = assessTeachingRun(result, {goal: 'read'});
  assert.equal(frame.lamp, true); assert.equal(frame.sample, 927);
  assert.ok(frame.write.nodeId.startsWith('__eqt_host_'));
  assert.equal(assessed.observed.writes.length, 0); assert.equal(assessed.observed.lastStudentLamp, null);
  assert.equal(assessed.observed.waits.length, 0); assert.equal(assessed.ok, true);
  error(assessTeachingRun(result, {goal: 'on'}), 'TEACHING_GOAL_KIND');
});

test('same-time on/off stays at 0ms with final off; no animation fabricates an interval', () => {
  const result = run('sequence', workspace(chain(output('on', true), output('off', false)))); good(result);
  assert.deepEqual(eventTimes(result), [[0, true, 'on'], [0, false, 'off']]);
  const frame = teachingFrameAt(result, 0);
  assert.equal(frame.lamp, false); assert.equal(frame.nodeId, 'off');
  assert.deepEqual(frame.events.filter(event => ['on', 'off'].includes(event.nodeId)).map(event => [event.atMs, event.value]), [[0, true], [0, false]]);
  error(assessTeachingRun(result, {goal: 'on-wait-off'}), 'TEACHING_SEQUENCE_WAIT', 'off');
});

test('true -> wait600 -> false replays hold and completion from the exact real trace', () => {
  const result = run('sequence', workspace(chain(output('on', true), wait('hold', 600), output('off', false))));
  const value = good(result);
  assert.deepEqual(eventTimes(result), [[0, true, 'on'], [600, false, 'off']]);
  const middle = teachingFrameAt(result, 300), end = teachingFrameAt(result, 600);
  assert.equal(middle.atMs, 300); assert.equal(middle.lamp, true); assert.equal(middle.nodeId, 'hold');
  assert.equal(middle.waiting.nodeId, 'hold'); assert.equal(middle.waiting.student, true); assert.equal(middle.waiting.remainingMs, 300);
  assert.deepEqual(middle.events, value.simulation.events.filter(event => event.atMs <= 300));
  assert.equal(end.lamp, false); assert.equal(end.nodeId, 'off'); assert.equal(end.waiting.student, false);
  const assessed = assessTeachingRun(result, {goal: 'on-wait-off'});
  assert.equal(assessed.ok, true); assert.equal(assessed.observed.waits[0].durationMs, 600);
  assert.equal(assessed.observed.resumes[0].atMs, 600); assert.equal(assessed.observed.sequence.changedAtMs, 600);
});

test('other positive waits and inverse direction are accepted, including waits longer than initial replay horizon', () => {
  for (const ms of [1, 37, 1450, 32767]) {
    const result = run('sequence', workspace(chain(output('off', false), wait('hold', ms), output('on', true))), {initialLamp: true});
    const value = good(result), assessed = assessTeachingRun(result, {goal: 'off-wait-on'});
    assert.equal(assessed.ok, true, `${ms}: ${JSON.stringify(assessed.diagnostics)}`);
    assert.deepEqual(assessed.observed.writes.map(event => [event.atMs, event.value]), [[0, false], [ms, true]]);
    assert.ok(value.simulation.completedThroughMs >= ms);
    assert.equal(teachingFrameAt(result, ms / 2).lamp, false); assert.equal(teachingFrameAt(result, ms).lamp, true);
    error(assessTeachingRun(result, {goal: 'on-wait-off'}), 'TEACHING_SEQUENCE_DIRECTION');
  }
});

test('replay horizon follows multiple real waits and a real input-valued duration', () => {
  const duration = {type: 'eqp_read_analog', id: 'duration-light', fields: {PORT: 'LIGHT'}};
  const dynamic = wait('dynamic-wait', 0); dynamic.inputs.MS.block = duration;
  const result = run('sequence', workspace(chain(output('on', true), wait('first-wait', 700), dynamic, output('off', false))), {light: 1023});
  const value = good(result), assessed = assessTeachingRun(result, {goal: 'on-wait-off'});
  assert.equal(assessed.ok, true); assert.ok(value.simulation.completedThroughMs >= 1723);
  assert.deepEqual(assessed.observed.waits.map(event => [event.atMs, event.durationMs]), [[0, 700], [700, 1023]]);
  assert.deepEqual(assessed.observed.reads.map(event => [event.nodeId, event.atMs, event.value]), [['duration-light', 700, 1023]]);
  assert.equal(teachingFrameAt(result, 1000).lamp, true); assert.equal(teachingFrameAt(result, 1723).lamp, false);
});

test('wait at the end, zero wait, and extra reversals cannot claim the requested hold sequence', () => {
  for (const blocks of [
    chain(output('on', true), output('off', false), wait('late', 600)),
    chain(output('on', true), wait('zero', 0), output('off', false)),
  ]) error(assessTeachingRun(run('sequence', workspace(blocks)), {goal: 'on-wait-off'}), 'TEACHING_SEQUENCE_WAIT');
  const reversed = run('sequence', workspace(chain(output('on', true), wait('a', 25), output('off', false), output('again', true), wait('b', 25), output('last', false))));
  error(assessTeachingRun(reversed, {goal: 'on-wait-off'}), 'TEACHING_SEQUENCE_DIRECTION');
});

test('read observer carries the original read ID into a HOST assignment without eqt_sample in IR', () => {
  const result = run('reading', {workspace: workspace(sample('own-light'))}, {light: 29});
  const value = good(result), assessed = assessTeachingRun(result, {goal: 'read', previousLight: 712});
  assert.equal(assessed.ok, true); assert.equal(assessed.observed.reads.length, 1);
  assert.deepEqual(assessed.observed.reads.map(event => [event.nodeId, event.port, event.value]), [['own-light', 'LIGHT', 29]]);
  assert.equal(JSON.stringify(value.program).includes('eqt_sample'), false);
  assert.equal(value.program.setup.find(node => node.kind === 'assign').value.id, 'own-light');
  assert.ok(value.program.variables[0].id.startsWith('__eqt_host_'));
  for (const id of programIds([value.program.variables, value.program.setup, value.program.loop])) if (!value.studentNodeIds.includes(id)) assert.ok(id.startsWith('__eqt_host_g0_g3_1__:'));
  assert.equal(programIds([value.program.variables, value.program.setup, value.program.loop]).includes('visible-observer'), false);
  assert.equal(teachingFrameAt(result, 0).sample, 29); assert.equal(teachingFrameAt(result, 800).nodeId, 'own-light');
  error(assessTeachingRun(result, {goal: 'read', previousLight: 29}), 'TEACHING_READ_UNCHANGED', 'own-light');
});

test('new environment values produce new true samples, without prescribed 170/820/360 values', () => {
  const first = run('reading', workspace(sample('read-one')), {light: 0});
  const second = run('reading', workspace(sample('read-two')), {light: 1023, runId: 'real-run-2'});
  assert.equal(assessTeachingRun(first, {goal: 'read'}).ok, true);
  assert.equal(assessTeachingRun(second, {goal: 'read', previousLight: 0}).ok, true);
  assert.equal(teachingFrameAt(first, 800).sample, 0); assert.equal(teachingFrameAt(second, 800).sample, 1023);
  error(assessTeachingRun(second, {goal: 'read', previousLight: null}), 'TEACHING_PREVIOUS_LIGHT');
});

test('mentor real runs remain visible but never satisfy any learner goal', () => {
  for (const [kind, state, goal] of [
    ['output', workspace(output('mentor-on', true)), 'on'],
    ['sequence', workspace(chain(output('mentor-on', true), wait('mentor-wait', 100), output('mentor-off', false))), 'on-wait-off'],
    ['reading', workspace(sample('mentor-read')), 'read'],
  ]) {
    const result = run(kind, state, {actor: 'mentor'}); good(result);
    assert.equal(teachingFrameAt(result, 800).ok, true);
    const assessed = assessTeachingRun(result, {goal}); error(assessed, 'TEACHING_MENTOR_RUN'); assert.ok(assessed.observed.events.length);
  }
});

test('empty/wrong output values and missing wait duration report the original student node', () => {
  let block = output('empty-output', true); delete block.inputs.VALUE;
  const missingValue = run('output', workspace(block)); error(missingValue, 'BLOCK_INPUT', 'empty-output');
  error(assessTeachingRun(missingValue, {goal: 'on'}), 'BLOCK_INPUT', 'empty-output');
  assert.deepEqual(teachingFrameAt(missingValue, 0).diagnostics, missingValue.diagnostics);
  block = output('numeric-output', true); block.inputs.VALUE.block = number('wrong-value', 1);
  error(run('output', workspace(block)), 'TYPE_MISMATCH', 'numeric-output');
  block = output('bad-bool-output', true); block.inputs.VALUE.block.fields.BOOL = 'ON';
  error(run('output', workspace(block)), 'BLOCK_FIELD', 'bad-bool-output-value');
  const missing = wait('empty-duration', 1); delete missing.inputs.MS;
  error(run('sequence', workspace(chain(output('on', true), missing))), 'BLOCK_INPUT', 'empty-duration');
  error(run('sequence', workspace(chain(output('on', true), wait('negative', -1)))), 'WAIT_RANGE', 'negative');
  error(run('sequence', workspace(chain(output('on', true), wait('fraction', 1.5)))), 'INTEGER_RANGE', 'fraction-value');
});

test('loose expressions and every scattered top-level block retain IDs in diagnostics', () => {
  error(run('reading', workspace({type: 'eqp_read_analog', id: 'loose-read', fields: {PORT: 'LIGHT'}})), 'TEACHING_FRAGMENT_ROOT', 'loose-read');
  const result = run('output', workspace(output('real-output', true), bool('orphan-value', false)));
  assert.equal(result.ok, false); assert.deepEqual(result.diagnostics.map(item => item.nodeId), ['real-output', 'orphan-value']);
  const empty = run('output', workspace()); error(empty, 'TEACHING_EMPTY_WORKSPACE');
  const fullProgram = {type: 'eqp_program', id: 'full-root'};
  error(run('output', workspace(fullProgram)), 'TEACHING_FRAGMENT_ROOT', 'full-root');
});

test('observer rejects empty, fixed, wrong-direction and extra-connected values', () => {
  let root = sample(); delete root.inputs.VALUE; error(run('reading', workspace(root)), 'BLOCK_INPUT', 'visible-observer');
  root = sample(); root.inputs.VALUE.block = number('fixed-number', 713); error(run('reading', workspace(root)), 'TEACHING_LIGHT_READ', 'fixed-number');
  root = sample(); root.inputs.VALUE.block.fields.PORT = 'LAMP'; error(run('reading', workspace(root)), 'TEACHING_LIGHT_READ', 'sample-read');
  root = sample(); root.next = {block: output('extra-output', true)}; error(run('reading', workspace(root)), 'TEACHING_SAMPLE_SHAPE', 'visible-observer');
});

test('disabled, cyclic, duplicate and HOST-reserved student IDs cannot be silently executed', () => {
  let root = output('disabled', true); root.enabled = false; error(run('output', workspace(root)), 'DISABLED_BLOCK', 'disabled');
  root = output('cycle', true); root.next = {block: root}; error(run('output', workspace(root)), 'BLOCK_CYCLE', 'cycle');
  root = output('duplicate', true); root.inputs.VALUE.block.id = 'duplicate'; error(run('output', workspace(root)), 'BLOCK_ID', 'duplicate');
  root = output('__eqt_host_g0_g3_1__:fake-output', true); error(run('output', workspace(root)), 'TEACHING_RESERVED_ID', root.id);
  root = output('unknown-next', true); root.next = {block: {type: 'eqp_set', id: 'not-yet-taught'}}; error(run('output', workspace(root)), 'TEACHING_STATEMENT', 'not-yet-taught');
});

test('invalid profile refs, actual missing wires, environment and workspace versions fail closed', async () => {
  const badTopology = {...topology, deviceProfileRef: {...topology.deviceProfileRef, digest: 'old-version'}};
  error(run('output', workspace(output('on', true)), {topology: badTopology}), 'TOPOLOGY');
  assert.equal((await context.topologyFor({...wiring, connections: wiring.connections.slice(1)})).ok, false);
  error(run('output', workspace(output('on', true)), {topology: undefined}), 'TOPOLOGY');
  for (const light of [-1, 1024, 1.5, '713']) error(run('output', workspace(output('on', true)), {light}), 'TEACHING_ENVIRONMENT');
  error(run('output', workspace(output('on', true)), {initialLamp: 'on'}), 'TEACHING_ENVIRONMENT');
  const state = workspace(output('on', true)); state.blocks.languageVersion = 99;
  error(run('output', state), 'TEACHING_WORKSPACE_VERSION');
  error(buildTeachingRun(null), 'TEACHING_KIND');
  error(run('output', workspace(output('on', true)), {actor: 'unknown'}), 'TEACHING_ORIGIN');
});

test('real arithmetic runtime errors retain their partial trace and student error source', () => {
  const block = output('before-error', true), badWait = wait('divide-wait', 0);
  badWait.inputs.MS.block = {type: 'math_arithmetic', id: 'divide-by-zero', fields: {OP: 'DIVIDE'}, inputs: {A: {block: number('numerator', 5)}, B: {block: number('zero', 0)}}};
  const result = run('sequence', workspace(chain(block, badWait, output('never-ran', false))));
  error(result, 'DIVIDE_BY_ZERO', 'divide-by-zero'); assert.ok(result.value); assert.equal(result.value.simulation.status, 'runtime_error');
  const frame = teachingFrameAt(result, 50); assert.equal(frame.ok, false); assert.equal(frame.lamp, true);
  assert.equal(frame.events.some(event => event.nodeId === 'never-ran'), false);
  error(assessTeachingRun(result, {goal: 'on-wait-off'}), 'DIVIDE_BY_ZERO');
});

test('wrapper failure, scaffold/program drift and malformed replays never become successful student work', () => {
  const result = run('output', workspace(output('on', true))); good(result);
  const failedWrapper = {...result, ok: false, diagnostics: [{code: 'CALLER_FAILED', message: '失败原样保留'}]};
  error(assessTeachingRun(failedWrapper, {goal: 'on'}), 'CALLER_FAILED'); assert.equal(teachingFrameAt(failedWrapper, 0).ok, false);
  const changed = structuredClone(result); changed.value.origin.scaffoldVersion = 'future'; error(assessTeachingRun(changed, {goal: 'on'}), 'TEACHING_RUN_VERSION');
  changed.value.origin.scaffoldVersion = 'g0-g3/1'; changed.value.program.schemaVersion = 'future'; error(assessTeachingRun(changed, {goal: 'on'}), 'TEACHING_PROGRAM_VERSION');
  const malformed = structuredClone(result); malformed.value.simulation.events = [null]; error(assessTeachingRun(malformed, {goal: 'on'}), 'TEACHING_RUN_SHAPE');
  assert.equal(teachingFrameAt(malformed, 0).ok, false); assert.equal(teachingFrameAt(null, 0).ok, false);
  for (const time of [-1, NaN, Infinity, '300']) assert.equal(teachingFrameAt(result, time).ok, false);
  assert.equal(teachingFrameAt(result, 100000).atMs, result.value.simulation.completedThroughMs);
});

test('JSON persistence preserves replay position and source attribution; HOST events cannot be relabelled as student IDs', () => {
  const result = run('sequence', workspace(chain(output('on', true), wait('hold', 217), output('off', false)))); good(result);
  const restored = JSON.parse(JSON.stringify(result));
  assert.deepEqual(teachingFrameAt(restored, 113), teachingFrameAt(result, 113));
  assert.deepEqual(assessTeachingRun(restored, {goal: 'on-wait-off'}), assessTeachingRun(result.value, {goal: 'on-wait-off'}));
  const forgedIds = structuredClone(result); forgedIds.value.studentNodeIds.push(forgedIds.value.program.setup[0].id);
  const rejected = assessTeachingRun(forgedIds, {goal: 'on-wait-off'}); error(rejected, 'TEACHING_RUN_SHAPE');
  assert.equal(rejected.observed.writes.some(event => event.nodeId.startsWith('__eqt_host_')), false);
  const noStudentWrite = run('output', workspace(output('on', true))); good(noStudentWrite);
  noStudentWrite.value.studentNodeIds = ['on-value'];
  const assessed = assessTeachingRun(noStudentWrite, {goal: 'on'}); error(assessed, 'TEACHING_OUTPUT_MISMATCH');
  assert.equal(assessed.observed.writes.length, 0);
});
