import test from 'node:test';
import assert from 'node:assert/strict';
import { runProgram } from '../../src/engine.js';
import { getCustomerSuite } from '../../content/index.js';
import { evaluateCustomerSuite, evaluateCustomerTrace } from '../../content/customer-tests.js';

// Synthetic response samples for the comparator, not verification of A's time engine.
function tracesFor(version, behavior) {
  return Object.fromEntries(getCustomerSuite(version).tests.map(customerTest => [customerTest.id, {
    status: 'completed',
    simulatedUntilMs: customerTest.maxTimeMs,
    events: customerTest.inputTimeline.map((input, index) => ({
      atMs: input.atMs + 100,
      outputs: behavior(input.signals.light, index, customerTest),
    })),
  }]));
}

function fromLegacyThreshold(threshold, version, lampOnWhenDark = true) {
  const program = { version: 1, sensorThreshold: threshold, lampOnWhenDark, delayMs: 100 };
  return tracesFor(version, input => ({ lamp: runProgram(program, input).lamp }));
}

test('fixed base and change suites accept their own correct behavior', () => {
  for (const [version, threshold] of [['1.0.0', 450], ['1.1.0', 600]]) {
    const result = evaluateCustomerSuite({ requirementVersion: version, simulations: fromLegacyThreshold(threshold, version) });
    assert.equal(result.passed, true);
    assert.equal(result.cases.length, getCustomerSuite(version).tests.length);
    assert.equal(result.authority, 'local_draft');
    assert.equal(result.requirementRef.version, version);
  }
});

test('customer expectations reject wrong student thresholds on either side of both boundaries', () => {
  for (const [version, thresholds] of [['1.0.0', [1, 449, 451, 600, 700, 1023]], ['1.1.0', [1, 450, 599, 601, 700, 1023]]]) {
    const suiteBefore = JSON.stringify(getCustomerSuite(version));
    for (const threshold of thresholds) {
      assert.equal(evaluateCustomerSuite({ requirementVersion: version, simulations: fromLegacyThreshold(threshold, version) }).passed, false, `${version}: threshold ${threshold}`);
    }
    assert.equal(JSON.stringify(getCustomerSuite(version)), suiteBefore);
  }
});

test('old base program fails explicit customer change at input 500', () => {
  const result = evaluateCustomerSuite({ requirementVersion: '1.1.0', simulations: fromLegacyThreshold(450, '1.1.0') });
  const middle = result.cases.find(item => item.caseId === 'change-middle');
  assert.equal(middle.passed, false);
  assert.deepEqual(middle.assertions[0], { atMs: 200, output: 'lamp', expected: true, actual: false, passed: false, code: 'OUTPUT_MISMATCH' });
});

test('reversed output, stuck on and stuck off fail independently of threshold', () => {
  for (const version of ['1.0.0', '1.1.0']) {
    for (const simulations of [fromLegacyThreshold(version === '1.0.0' ? 450 : 600, version, false), tracesFor(version, () => ({ lamp: true })), tracesFor(version, () => ({ lamp: false }))]) {
      assert.equal(evaluateCustomerSuite({ requirementVersion: version, simulations }).passed, false);
    }
  }
});

test('using <= instead of < fails equal-boundary assertions', () => {
  for (const [version, threshold] of [['1.0.0', 450], ['1.1.0', 600]]) {
    const result = evaluateCustomerSuite({ requirementVersion: version, simulations: tracesFor(version, light => ({ lamp: light <= threshold })) });
    assert.equal(result.passed, false);
    assert.ok(result.cases.some(item => item.assertions.some(row => row.expected === false && row.actual === true)));
  }
});

test('read-once and missing close branch fail changing scenes', () => {
  const readOnce = tracesFor('1.0.0', (_input, _index, customerTest) => ({ lamp: customerTest.inputTimeline[0].signals.light < 450 }));
  const missingElse = tracesFor('1.0.0', light => light < 450 ? { lamp: true } : {});
  for (const simulations of [readOnce, missingElse]) {
    const result = evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations });
    assert.equal(result.passed, false);
    assert.equal(result.cases.find(item => item.caseId === 'base-changing').passed, false);
  }
});

test('response after allowed window fails even if eventual output is correct', () => {
  const simulations = fromLegacyThreshold(450, '1.0.0');
  for (const trace of Object.values(simulations)) for (const event of trace.events) event.atMs += 150;
  const result = evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations });
  assert.equal(result.passed, false);
  assert.equal(result.cases[0].assertions[0].code, 'NO_OBSERVED_OUTPUT');
});

test('outputs hold between events and later writes at the same millisecond win', () => {
  const simulation = { status: 'completed', simulatedUntilMs: 1200, events: [{ atMs: 0, outputs: { lamp: false } }, { atMs: 0, outputs: { lamp: true } }] };
  assert.equal(evaluateCustomerTrace({ requirementVersion: '1.0.0', caseId: 'base-dark', simulation }).passed, true);
});

test('no explicit output is distinct from a correct false output', () => {
  const simulation = { status: 'completed', simulatedUntilMs: 1200, events: [{ atMs: 0, outputs: {} }] };
  const result = evaluateCustomerTrace({ requirementVersion: '1.0.0', caseId: 'base-bright', simulation });
  assert.equal(result.passed, false);
  assert.equal(result.assertions[0].actual, null);
  assert.equal(result.assertions[0].code, 'NO_OBSERVED_OUTPUT');
});

test('missing cases, unfinished runs and exceeded budgets cannot produce a suite pass', () => {
  assert.equal(evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations: {} }).passed, false);
  for (const patch of [{ status: 'budget_exceeded' }, { status: 'runtime_error' }, { totalSteps: 10001 }, { simulatedUntilMs: 200 }, { simulatedUntilMs: 1201 }]) {
    const simulation = { status: 'completed', simulatedUntilMs: 1200, events: [{ atMs: 0, outputs: { lamp: true } }], ...patch };
    const result = evaluateCustomerTrace({ requirementVersion: '1.0.0', caseId: 'base-dark', simulation });
    assert.equal(result.passed, false);
    assert.ok(result.diagnostics.length > 0);
  }
  const simulations = fromLegacyThreshold(450, '1.0.0');
  delete simulations['base-boundary'];
  assert.equal(evaluateCustomerSuite({ requirementVersion: '1.0.0', simulations }).passed, false);
});

test('malformed or unordered output traces fail instead of coercing values', () => {
  const badEvents = [null, [{ atMs: 0, outputs: { lamp: 1 } }], [{ atMs: 0 }], [{ atMs: 1, outputs: {} }, { atMs: 0, outputs: { lamp: true } }], [{ atMs: 1300, outputs: { lamp: true } }], [{ atMs: -1, outputs: {} }]];
  for (const events of badEvents) {
    const result = evaluateCustomerTrace({ requirementVersion: '1.0.0', caseId: 'base-dark', simulation: { status: 'completed', simulatedUntilMs: 1200, events } });
    assert.equal(result.passed, false);
    assert.ok(result.diagnostics.length > 0);
  }
});

test('unknown versions and mismatched test IDs are rejected, with frozen literal assertions', () => {
  assert.throws(() => getCustomerSuite('latest'), RangeError);
  assert.throws(() => evaluateCustomerTrace({ requirementVersion: '1.1.0', caseId: 'base-dark' }), RangeError);
  assert.throws(() => { getCustomerSuite('1.0.0').tests[0].assertions[0].equals = false; }, TypeError);
});
