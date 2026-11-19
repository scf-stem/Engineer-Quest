import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import {LANGUAGE_PROFILE, parseShortCpp, blocksToProgram, workspaceToProgram, registerProgramBlocks, validateProgram, simulate, evaluate, generateArduino, generateShortCpp, migrateLegacyProgram, runCustomerTests} from '../../src/program/index.js';
import {AUTO_LIGHT_SOURCE, SYNTHETIC_DEVICE as device, SYNTHETIC_TOPOLOGY as topology, SYNTHETIC_CUSTOMER_TESTS as tests, SYNTHETIC_REFS as refs, createExampleBlocks} from '../../src/program/examples.js';

function good(r) { assert.equal(r.ok, true, JSON.stringify(r.diagnostics)); return r.value; }
const parse = source => good(parseShortCpp(source));
const run = (source, timeline = [], limits = {maxSteps: 1000, maxTimeMs: 300}) => good(simulate(parse(source), topology, timeline, limits));
const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([k]) => !['id', 'sourceRange'].includes(k)).map(([k, v]) => [k, strip(v)])) : value;
const program = parse(AUTO_LIGHT_SOURCE);

test('composable declarations, branches, arithmetic, boolean precedence, setup and while', () => {
  const simulation = run(`int count = 0; bool ready = false;
    void setup() { count = 1; }
    void loop() {
      while (count < 3) { count = count + 1; waitMs(10); }
      ready = (count == 3 && !readDigital(BUTTON)) || false;
      if (ready) { writeDigital(LAMP, true); } else if (count != 3) { writeDigital(LAMP, false); }
      waitMs(100);
    }`);
  assert.equal(simulation.status, 'completed');
  assert.equal(simulation.events.at(-1).outputs.LAMP, true);
  assert.deepEqual(simulation.events.at(-1).variables, {count: 3, ready: true});
  assert.equal(simulation.events.find(e => e.kind === 'write').atMs, 20);
});

test('fixed customer expectations reject wrong threshold, output and sampling interval', () => {
  for (const [source, expected] of [[AUTO_LIGHT_SOURCE, true], [AUTO_LIGHT_SOURCE.replace('450', '400'), false],
    [AUTO_LIGHT_SOURCE.replace('writeDigital(LAMP, true)', 'writeDigital(LAMP, false)'), false],
    [AUTO_LIGHT_SOURCE.replace('waitMs(100)', 'waitMs(250)'), false]]) {
    const draft = good(runCustomerTests(parse(source), topology, tests, refs));
    assert.equal(draft.passed, expected);
    assert.equal(draft.refs.testSuiteRef.digest, refs.testSuiteRef.digest);
  }
});

test('input is sampled at read time; output holds through waiting and endpoint operations execute', () => {
  const t = tests[0], simulation = good(simulate(program, topology, t.inputTimeline, {maxSteps: t.maxSteps, maxTimeMs: t.maxTimeMs}));
  assert.deepEqual(simulation.events.filter(e => e.kind === 'read').map(e => [e.atMs, e.value]), [[0, 150], [100, 850], [200, 449], [300, 450]]);
  assert.equal(evaluate(simulation, tests).passed, true);
  assert.deepEqual(good(simulate(program, topology, t.inputTimeline, simulation.limits)), simulation);
  const instant = run('void loop() { writeDigital(LAMP, true); waitMs(1); }', [], {maxSteps: 20, maxTimeMs: 0});
  assert.equal(instant.events.at(-1).outputs.LAMP, true);
});

test('integer division truncates toward zero; modulo and short circuit match C++', () => {
  const simulation = run('int x = 0; bool b = false; void loop() { x = -7 / 3; b = false && (1 / 0 > 0); if (x == -2 && -7 % 3 == -1) { writeDigital(LAMP, true); } waitMs(10); }');
  assert.equal(simulation.status, 'completed');
  assert.equal(simulation.events.at(-1).outputs.LAMP, true);
  const short = run('bool b = false; void loop() { b = true || readDigital(BUTTON); waitMs(10); }');
  assert.equal(short.events.some(e => e.kind === 'read'), false);
  const zero = run('int x = 0; void loop() { x = -1 / 2; waitMs(10); }');
  assert.equal(Object.is(zero.events.at(-1).variables.x, -0), false);
});

test('infinite main/while/zero-wait loops stop at bounded steps with a source/node diagnostic', () => {
  for (const source of ['void loop() {}', 'void loop() { while (true) {} }', 'void loop() { waitMs(0); }']) {
    const simulation = run(source, [], {maxSteps: 40, maxTimeMs: 200});
    assert.equal(simulation.status, 'budget_exceeded');
    assert.equal(simulation.steps, 40);
    assert.equal(simulation.diagnostics[0].code, 'STEP_BUDGET');
  }
});

test('overflow, division by zero and dynamic negative wait are explicit runtime failures', () => {
  for (const [code, source] of [['INTEGER_RANGE', 'int x = 32767; void loop() { x = x + 1; }'],
    ['INTEGER_RANGE', 'int x = -32768; void loop() { x = -x; }'],
    ['DIVIDE_BY_ZERO', 'int x = 0; void loop() { x = 4 / x; }'],
    ['WAIT_RANGE', 'int x = -1; void loop() { waitMs(x); }']]) {
    const simulation = run(source);
    assert.equal(simulation.status, 'runtime_error'); assert.equal(simulation.diagnostics[0].code, code);
    assert.ok(simulation.diagnostics[0].sourceRange); assert.ok(simulation.diagnostics[0].nodeId);
    assert.equal(evaluate(simulation, tests).passed, false);
  }
});

test('parser accepts comments and rejects unsupported C++ and implicit coercion', () => {
  assert.deepEqual(strip(parse('/* 课程 */\n' + AUTO_LIGHT_SOURCE)), strip(program));
  for (const source of ['#include <x>\n' + AUTO_LIGHT_SOURCE, AUTO_LIGHT_SOURCE + 'system("x");', 'void loop() { digitalWrite(9, HIGH); }',
    'void loop() { int local = 1; }', 'int x = 01; void loop() {}', 'int x = 32768; void loop() {}',
    'const int x = 1; void loop() { x = 2; }', 'bool x = 1; void loop() {}', 'void loop() { if (1) {} }',
    'void loop() { writeDigital(LAMP, 1); }', 'void loop() { missing = 1; }', 'void loop() { waitMs(-1); }',
    'void loop() { waitMs(1.5); }', '/*', 'void loop() { waitMs(foo()); }']) {
    assert.equal(parseShortCpp(source).ok, false, source);
  }
  assert.equal(parseShortCpp('x'.repeat(24001)).ok, false);
  assert.equal(parseShortCpp('void loop() { waitMs(' + '('.repeat(100) + '1' + ')'.repeat(100) + '); }').ok, false);
  assert.equal(parseShortCpp(AUTO_LIGHT_SOURCE, {ref: {...LANGUAGE_PROFILE.ref, version: 'future'}}).ok, false);
  assert.equal(parseShortCpp(null).ok, false);
  assert.equal(parseShortCpp('int x = 1; void loop() { x = x--1; }').ok, false);
});

test('IR rejects schema drift, duplicate IDs, cycles, unknown nodes and mismatched types', () => {
  const variants = [];
  let p = structuredClone(program); p.extra = 1; variants.push(p);
  p = structuredClone(program); p.loop[0].id = p.variables[0].id; variants.push(p);
  p = structuredClone(program); p.loop[1].condition.left = p.loop[1].condition; variants.push(p);
  p = structuredClone(program); p.loop[0].kind = 'execute'; variants.push(p);
  p = structuredClone(program); p.loop[0].value.signalType = 'digital'; variants.push(p);
  for (const invalid of [null, {}, ...variants]) assert.equal(validateProgram(invalid, device).ok, false);
});

test('ports, topology versions, timeline ranges/order and caller budget are validated', () => {
  assert.equal(validateProgram(program, device).ok, true);
  const wrong = structuredClone(device); wrong.pinMap.LIGHT.direction = 'output';
  assert.equal(validateProgram(program, wrong).ok, false);
  assert.equal(simulate(program, {...topology, deviceProfileRef: {...device.ref, digest: 'changed'}}, [], {maxSteps: 10, maxTimeMs: 10}).ok, false);
  for (const timeline of [null, [{atMs: -1, signals: {}}], [{atMs: 0, signals: {LIGHT: 1024}}], [{atMs: 0, signals: {LAMP: true}}], [{atMs: 0, signals: {BUTTON: 1}}], [{atMs: 0, signals: {}}, {atMs: 0, signals: {}}]]) assert.equal(simulate(program, topology, timeline).ok, false);
  for (const limits of [{maxSteps: 0, maxTimeMs: 1}, {maxSteps: 100001, maxTimeMs: 1}, {maxSteps: 10, maxTimeMs: -1}, {maxSteps: 10, maxTimeMs: 60001}]) assert.equal(simulate(program, topology, [], limits).ok, false);
  const collision = structuredClone(device); collision.pinMap.BUTTON.pin = 9;
  assert.equal(generateArduino(program, collision).ok, false);
  assert.equal(generateArduino(program).ok, false);
  const invalidPin = structuredClone(device); invalidPin.pinMap.LAMP.pin = ['A0'];
  assert.equal(validateProgram(program, invalidPin).ok, false);
});

test('Blockly serialization preserves composable semantics and generated classroom text round trips', () => {
  const blocks = good(blocksToProgram(createExampleBlocks()));
  assert.deepEqual(strip(blocks), strip(program));
  assert.deepEqual(strip(parse(good(generateShortCpp(blocks)).source)), strip(blocks));
  const blockSimulation = good(simulate(blocks, topology, tests[0].inputTimeline, {maxSteps: 1000, maxTimeMs: 300}));
  assert.equal(evaluate(blockSimulation, tests).passed, true);
  assert.ok(generateArduino(blocks, device).value.map.some(m => m.nodeId === blocks.loop[0].id));
});

test('actual headless Blockly 12 loads/edits/serializes the opt-in program blocks', () => {
  registerProgramBlocks(Blockly, device);
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(createExampleBlocks(), workspace);
    const ir = good(workspaceToProgram(workspace, Blockly));
    assert.deepEqual(strip(ir), strip(program));
    const threshold = workspace.getAllBlocks(false).find(b => b.type === 'math_number' && b.getFieldValue('NUM') === 450);
    threshold.setFieldValue(400, 'NUM');
    assert.equal(good(runCustomerTests(good(workspaceToProgram(workspace, Blockly)), topology, tests, refs)).passed, false);
  } finally { workspace.dispose(); }
});

test('Blockly rejects holes, orphan/disabled blocks, extra branches and cyclic chains', () => {
  const base = createExampleBlocks(), variants = [];
  let b = structuredClone(base); b.blocks.blocks.push({type: 'math_number', id: 'orphan', fields: {NUM: 1}}); variants.push(b);
  b = structuredClone(base); delete b.blocks.blocks[0].inputs.LOOP.block.inputs.VALUE; variants.push(b);
  b = structuredClone(base); b.blocks.blocks[0].inputs.LOOP.block.enabled = false; variants.push(b);
  b = structuredClone(base); b.blocks.blocks[0].inputs.LOOP.block.next.block.inputs.IF1 = {block: {type: 'logic_boolean', id: 'extra', fields: {BOOL: 'TRUE'}}}; variants.push(b);
  b = structuredClone(base); b.blocks.blocks[0].inputs.LOOP.block.next = {block: b.blocks.blocks[0].inputs.LOOP.block}; variants.push(b);
  for (const invalid of [null, {}, ...variants]) assert.equal(blocksToProgram(invalid).ok, false);
});

test('one-way migration keeps original template and requires explicit logical port mapping', () => {
  const legacy = {version: 1, sensorThreshold: 450, lampOnWhenDark: true, delayMs: 100}, saved = structuredClone(legacy);
  const migrated = good(migrateLegacyProgram(legacy, {inputPort: 'LIGHT', outputPort: 'LAMP'}));
  assert.deepEqual(legacy, saved); assert.deepEqual(migrated.migration.original, saved);
  assert.equal(good(runCustomerTests(migrated.program, topology, tests, refs)).passed, true);
  assert.equal(migrateLegacyProgram({...legacy, version: 2}, {inputPort: 'LIGHT', outputPort: 'LAMP'}).ok, false);
  assert.equal(migrateLegacyProgram(legacy).ok, false);
});

test('evaluation fails closed on scenario/version/coverage mismatch and empty suites', () => {
  const simulation = good(simulate(program, topology, tests[0].inputTimeline, {maxSteps: 1000, maxTimeMs: 300}));
  assert.equal(evaluate(simulation, []).passed, false);
  assert.equal(evaluate(simulation, [{...tests[0], inputTimeline: []}]).passed, false);
  assert.equal(evaluate(simulation, [{...tests[0], maxTimeMs: 500}]).passed, false);
  assert.equal(evaluate(simulation, [{...tests[0], assertions: []}]).passed, false);
  assert.equal(runCustomerTests(program, topology, tests, {...refs, requirementRef: {...refs.requirementRef, id: 'different'}}).ok, false);
  assert.equal(runCustomerTests(program, topology, tests, {...refs, wiringRef: {...refs.wiringRef, digest: 'stale'}}).ok, false);
  assert.equal(runCustomerTests(program, topology, [tests[0], tests[0]], refs).ok, false);
  assert.equal(evaluate({}, tests).passed, false);
});

test('partial input frames retain values, initial output is explicit, and failed assertions point to writes', () => {
  const source = 'void loop() { writeDigital(LAMP, readDigital(BUTTON)); waitMs(100); }';
  const timeline = [{atMs: 0, signals: {BUTTON: true}}, {atMs: 40, signals: {LIGHT: 200}}];
  const simulation = run(source, timeline);
  assert.equal(simulation.events.at(-1).outputs.LAMP, true);
  const assessed = evaluate(simulation, [{id: 'partial', requirementId: 'synthetic-auto-light', inputTimeline: timeline,
    assertions: [{atMs: 150, output: 'LAMP', equals: false}], maxSteps: 1000, maxTimeMs: 300}]);
  assert.equal(assessed.passed, false);
  const assertionNode = assessed.cases[0].assertions[0].nodeId;
  assert.equal(simulation.events.find(e => e.nodeId === assertionNode).kind, 'write');
  assert.equal(run('void loop() { waitMs(100); }').events[0].outputs.LAMP, false);
});
