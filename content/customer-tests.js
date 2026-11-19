import { getCustomerSuite } from './index.js';

const isTime = value => Number.isSafeInteger(value) && value >= 0;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function inspectSimulation(simulation, customerTest) {
  const diagnostics = [];
  const fail = (code, message) => diagnostics.push({ code, severity: 'error', message, manualSection: customerTest.manualSection });
  if (!simulation || simulation.status !== 'completed') {
    fail(simulation?.status === 'budget_exceeded' ? 'EXECUTION_BUDGET_EXCEEDED' : 'SIMULATION_NOT_COMPLETED', '运行未完整完成，不能作为客户测试通过证据。');
    return diagnostics;
  }
  const lastAssertionMs = customerTest.assertions.at(-1).atMs;
  if (!isTime(simulation.simulatedUntilMs) || simulation.simulatedUntilMs < lastAssertionMs || simulation.simulatedUntilMs > customerTest.maxTimeMs) {
    fail('INVALID_TIME_COVERAGE', `需明确记录模拟覆盖到 ${lastAssertionMs}–${customerTest.maxTimeMs} 毫秒，不能把已停止的轨迹外推为完成。`);
  }
  if (!Array.isArray(simulation.events) || simulation.events.length > customerTest.maxSteps) {
    fail('INVALID_TRACE', '运行事件缺失或超过本场景预算。');
    return diagnostics;
  }
  if (simulation.totalSteps !== undefined && (!isTime(simulation.totalSteps) || simulation.totalSteps > customerTest.maxSteps)) {
    fail('EXECUTION_BUDGET_EXCEEDED', '执行步数记录无效或超过客户场景预算。');
  }
  let previousMs = -1;
  for (const event of simulation.events) {
    if (!event || !isTime(event.atMs) || event.atMs < previousMs || event.atMs > simulation.simulatedUntilMs) {
      fail('INVALID_TRACE', '事件时间必须有序、非负且处于已模拟区间。');
      break;
    }
    if (!event.outputs || typeof event.outputs !== 'object' || Array.isArray(event.outputs)
      || (hasOwn(event.outputs, 'lamp') && typeof event.outputs.lamp !== 'boolean')) {
      fail('INVALID_OUTPUT', '轨迹需包含输出对象，灯状态只能使用布尔值；缺少明确输出不能当成关灯。');
      break;
    }
    if (event.step !== undefined && (!isTime(event.step) || event.step > customerTest.maxSteps)) {
      fail('EXECUTION_BUDGET_EXCEEDED', '事件执行步数无效或超出预算。');
      break;
    }
    previousMs = event.atMs;
  }
  return diagnostics;
}

/** Compares A's trace with frozen customer literals. Does not execute student programs. */
export function evaluateCustomerTrace({ requirementVersion, caseId, simulation }) {
  const suite = getCustomerSuite(requirementVersion);
  const customerTest = suite.tests.find(item => item.id === caseId);
  if (!customerTest) throw new RangeError(`测试 ${String(caseId)} 不属于需求 ${requirementVersion}。`);
  const diagnostics = inspectSimulation(simulation, customerTest);
  let cursor = 0;
  const latest = {};
  const assertions = customerTest.assertions.map(assertion => {
    if (!diagnostics.length) {
      while (cursor < simulation.events.length && simulation.events[cursor].atMs <= assertion.atMs) {
        const outputs = simulation.events[cursor++].outputs;
        if (hasOwn(outputs, 'lamp')) latest.lamp = outputs.lamp;
      }
    }
    const actual = diagnostics.length || !hasOwn(latest, assertion.output) ? null : latest[assertion.output];
    return {
      atMs: assertion.atMs,
      output: assertion.output,
      expected: assertion.equals,
      actual,
      passed: !diagnostics.length && actual === assertion.equals,
      code: diagnostics.length ? 'INVALID_SIMULATION' : actual === null ? 'NO_OBSERVED_OUTPUT' : actual === assertion.equals ? 'MATCH' : 'OUTPUT_MISMATCH',
    };
  });
  return {
    authority: 'local_draft',
    requirementRef: suite.requirementRef,
    testSuiteRef: suite.ref,
    caseId,
    name: customerTest.name,
    passed: !diagnostics.length && assertions.every(item => item.passed),
    assertions,
    diagnostics,
    failureHint: customerTest.failureHint,
    manualSection: customerTest.manualSection,
  };
}

/** Every listed case is required. Missing simulations fail instead of reducing the suite. */
export function evaluateCustomerSuite({ requirementVersion, simulations }) {
  const suite = getCustomerSuite(requirementVersion);
  const cases = suite.tests.map(customerTest => evaluateCustomerTrace({
    requirementVersion,
    caseId: customerTest.id,
    simulation: simulations && hasOwn(simulations, customerTest.id) ? simulations[customerTest.id] : undefined,
  }));
  return {
    authority: 'local_draft',
    requirementRef: suite.requirementRef,
    testSuiteRef: suite.ref,
    passed: cases.every(item => item.passed),
    cases,
  };
}
