import {CAPS, ProgramFault, canonical, exact, fail, integer, isRecord, result, sameRef, unwrap, validRef} from './common.js';
import {validateProgram} from './validate.js';

export function validateTimeline(timeline, profile) {
  if (!Array.isArray(timeline) || timeline.length > 10000) fail('INPUT_TIMELINE', '输入时间线最多 10000 项');
  let previous = -1;
  for (const frame of timeline) {
    exact(frame, ['atMs', 'signals']);
    if (!Number.isInteger(frame.atMs) || frame.atMs < 0 || frame.atMs > CAPS.time || frame.atMs <= previous || !isRecord(frame.signals)) fail('INPUT_TIMELINE', '时间戳必须是严格递增的非负整数毫秒');
    previous = frame.atMs;
    for (const [name, value] of Object.entries(frame.signals)) {
      const port = Object.hasOwn(profile.pinMap, name) ? profile.pinMap[name] : undefined;
      if (!port || port.direction !== 'input') fail('INPUT_PORT', `时间线包含未知输入 ${name}`);
      if (port.signalType === 'digital' ? typeof value !== 'boolean' : !Number.isInteger(value) || value < port.min || value > port.max) fail('INPUT_RANGE', `输入 ${name} 超出端口范围`);
    }
  }
  return timeline;
}

export function validateLimits(limits) {
  exact(limits, ['maxSteps', 'maxTimeMs']);
  if (!Number.isInteger(limits.maxSteps) || limits.maxSteps < 1 || limits.maxSteps > CAPS.steps || !Number.isInteger(limits.maxTimeMs) || limits.maxTimeMs < 0 || limits.maxTimeMs > CAPS.time) fail('SIMULATION_LIMITS', `最多 ${CAPS.steps} 步、${CAPS.time} 毫秒`);
  return limits;
}

/** Closed interval [0,maxTimeMs]. All zero-duration work at the endpoint is included. */
export function simulate(program, topology, inputTimeline, limits = {maxSteps: 10000, maxTimeMs: 1000}) {
  return result(() => {
    if (!isRecord(topology) || !topology.deviceProfile || !sameRef(topology.deviceProfileRef, topology.deviceProfile.ref) || !validRef(topology.wiringRef)) fail('TOPOLOGY', '需要 B 校验后的设备配置、deviceProfileRef 和 wiringRef');
    const device = topology.deviceProfile;
    unwrap(validateProgram(program, device));
    validateLimits(limits); validateTimeline(inputTimeline, device);
    const variables = Object.create(null), outputs = Object.create(null), inputs = Object.create(null);
    for (const v of program.variables) variables[v.name] = v.type === 'int' ? integer(v.initial.value) : v.initial.value;
    for (const [name, port] of Object.entries(device.pinMap)) (port.direction === 'input' ? inputs : outputs)[name] = typeof port.initialValue === 'number' ? integer(port.initialValue) : port.initialValue;
    const events = [], diagnostics = []; let atMs = 0, step = 0, frameIndex = 0, currentNode, status = 'completed';
    function syncInputs() {
      while (frameIndex < inputTimeline.length && inputTimeline[frameIndex].atMs <= atMs) {
        for (const [name, value] of Object.entries(inputTimeline[frameIndex++].signals)) inputs[name] = typeof value === 'number' ? integer(value) : value;
      }
    }
    function tick(node) {
      currentNode = node;
      if (step >= limits.maxSteps) fail('STEP_BUDGET', '程序超过执行步数预算；检查无等待循环或过多计算', node);
      step++; syncInputs();
    }
    function emit(kind, node, detail = {}) {
      events.push({atMs, step, kind, ...(node ? {nodeId: node.id} : {}), variables: {...variables}, outputs: {...outputs}, inputs: {...inputs}, ...detail});
    }
    function compute(e) {
      tick(e);
      switch (e.kind) {
        case 'literal': return typeof e.value === 'number' ? integer(e.value, e) : e.value;
        case 'variable': return variables[e.name];
        case 'read': emit('read', e, {port: e.port, value: inputs[e.port]}); return inputs[e.port];
        case 'unary': { const a = compute(e.operand); return e.op === '!' ? !a : integer(-a, e); }
        case 'binary': {
          const a = compute(e.left);
          if (e.op === '&&') return a && compute(e.right);
          if (e.op === '||') return a || compute(e.right);
          const b = compute(e.right);
          switch (e.op) {
            case '+': return integer(a + b, e);
            case '-': return integer(a - b, e);
            case '*': return integer(a * b, e);
            case '/': case '%':
              if (b === 0) fail('DIVIDE_BY_ZERO', '除数不能为 0', e);
              return integer(e.op === '/' ? Math.trunc(a / b) : a % b, e);
            case '<': return a < b;
            case '<=': return a <= b;
            case '>': return a > b;
            case '>=': return a >= b;
            case '==': return a === b;
            case '!=': return a !== b;
          }
        }
      }
    }
    const horizon = Symbol('horizon');
    function run(list) {
      for (const s of list) {
        tick(s);
        switch (s.kind) {
          case 'assign': variables[s.name] = compute(s.value); emit('assign', s); break;
          case 'write': outputs[s.port] = compute(s.value); emit('write', s, {port: s.port, value: outputs[s.port]}); break;
          case 'wait': {
            const duration = compute(s.duration);
            if (duration < 0) fail('WAIT_RANGE', '等待时间不能为负数', s);
            emit('wait', s, {durationMs: duration, resumeAtMs: atMs + duration});
            if (atMs + duration > limits.maxTimeMs) { atMs = limits.maxTimeMs; syncInputs(); throw horizon; }
            atMs += duration; syncInputs(); emit('resume', s); break;
          }
          case 'if': { const branch = compute(s.condition); emit('branch', s, {branch}); run(branch ? s.then : s.else); break; }
          case 'while':
            while (true) {
              tick(s); const branch = compute(s.condition); emit('branch', s, {branch});
              if (!branch) break;
              run(s.body);
            }
            break;
        }
      }
    }
    syncInputs(); emit('initial');
    try {
      run(program.setup);
      while (true) { tick(); emit('cycle'); run(program.loop); }
    } catch (error) {
      if (error !== horizon) {
        if (!(error instanceof ProgramFault)) throw error;
        status = error.diagnostic.code === 'STEP_BUDGET' ? 'budget_exceeded' : 'runtime_error';
        diagnostics.push(error.diagnostic);
      }
    }
    emit('stop', currentNode, {status});
    return {status, completedThroughMs: atMs, steps: step, events, diagnostics, limits: {...limits},
      inputTimeline: structuredClone(inputTimeline), deviceProfileRef: {...device.ref}, wiringRef: {...topology.wiringRef}};
  });
}

/** Evaluates only matching fixed scenarios. No expected value comes from student IR. */
export function evaluate(simulationResult, customerTests) {
  const diagnostics = [], cases = [];
  if (!Array.isArray(customerTests) || !customerTests.length || customerTests.length > 100) return {passed: false, cases, diagnostics: [{code: 'CUSTOMER_TESTS', severity: 'error', message: '需要 1…100 个独立客户场景'}]};
  for (const test of customerTests) {
    const checked = result(() => {
      exact(test, ['id', 'requirementId', 'inputTimeline', 'assertions', 'maxSteps', 'maxTimeMs']);
      validateLimits({maxSteps: test.maxSteps, maxTimeMs: test.maxTimeMs});
      if (typeof test.id !== 'string' || !test.id || typeof test.requirementId !== 'string' || !test.requirementId || !Array.isArray(test.assertions) || !test.assertions.length || test.assertions.length > 1000) fail('CUSTOMER_TESTS', '客户测试需要 ID、需求 ID 与非空断言');
      for (const timeline of [test.inputTimeline, simulationResult?.inputTimeline]) {
        if (!Array.isArray(timeline) || timeline.length > 10000) fail('INPUT_TIMELINE', '测试与运行需要合法的输入时间线');
        let previous = -1;
        for (const frame of timeline) {
          exact(frame, ['atMs', 'signals']);
          if (!Number.isInteger(frame.atMs) || frame.atMs <= previous || frame.atMs > CAPS.time || !isRecord(frame.signals) || Object.values(frame.signals).some(v => typeof v !== 'boolean' && !Number.isInteger(v))) fail('INPUT_TIMELINE', '输入帧需要递增时间与整数/布尔信号');
          previous = frame.atMs;
        }
      }
      if (!simulationResult || simulationResult.status !== 'completed' || !Array.isArray(simulationResult.events) || !Number.isInteger(simulationResult.completedThroughMs) || !Number.isInteger(simulationResult.steps) || canonical(test.inputTimeline) !== canonical(simulationResult.inputTimeline) || simulationResult.completedThroughMs < test.maxTimeMs || simulationResult.steps < 0 || simulationResult.steps > test.maxSteps) fail('SCENARIO_MISMATCH', '执行失败、场景不匹配或未覆盖客户要求的时间/步数范围');
      return test.assertions.map(assertion => {
        exact(assertion, ['atMs', 'output', 'equals']);
        if (!Number.isInteger(assertion.atMs) || assertion.atMs < 0 || assertion.atMs > test.maxTimeMs || typeof assertion.output !== 'string' || typeof assertion.equals !== 'boolean') fail('ASSERTION', '当前断言仅支持时间范围内的数字输出布尔值');
        let last, lastWrite;
        for (const event of simulationResult.events) {
          if (event.atMs > assertion.atMs) break;
          last = event;
          if (event.kind === 'write' && event.port === assertion.output) lastWrite = event;
        }
        const actual = last?.outputs?.[assertion.output];
        return {...assertion, actual, passed: actual !== undefined && actual === assertion.equals, ...(lastWrite?.nodeId ? {nodeId: lastWrite.nodeId} : {})};
      });
    });
    if (!checked.ok) diagnostics.push(...checked.diagnostics);
    cases.push({id: test?.id, requirementId: test?.requirementId, passed: checked.ok && checked.value.every(a => a.passed), assertions: checked.ok ? checked.value : [], diagnostics: checked.diagnostics});
  }
  return {passed: cases.every(c => c.passed), cases, diagnostics};
}

/** E supplies exact refs; this draft has no authority to award or certify hardware. */
export function runCustomerTests(program, topology, customerTests, refs) {
  return result(() => {
    exact(refs, ['programRef', 'wiringRef', 'requirementRef', 'testSuiteRef', 'deviceProfileRef']);
    if (!Object.values(refs).every(validRef) || !sameRef(refs.wiringRef, topology?.wiringRef) || !sameRef(refs.deviceProfileRef, topology?.deviceProfileRef)) fail('TEST_REFS', '测试引用缺失或与接线/设备版本不一致');
    if (!Array.isArray(customerTests) || !customerTests.length || customerTests.length > 100) fail('CUSTOMER_TESTS', '需要 1…100 个固定客户测试');
    if (customerTests.reduce((total, test) => total + (Number.isInteger(test?.maxSteps) && test.maxSteps > 0 ? test.maxSteps : CAPS.steps + 1), 0) > CAPS.steps) fail('SUITE_BUDGET', '客户测试套件总预算最多 100000 步；请拆分运行');
    if (new Set(customerTests.map(test => test?.id)).size !== customerTests.length) fail('CUSTOMER_TESTS', '客户场景 ID 不能重复');
    const runs = customerTests.map(test => {
      if (test?.requirementId !== refs.requirementRef.id) fail('TEST_REFS', '客户场景不属于本次需求版本');
      const simulation = unwrap(simulate(program, topology, test.inputTimeline, {maxSteps: test.maxSteps, maxTimeMs: test.maxTimeMs}));
      return {testId: test.id, simulation, evaluation: evaluate(simulation, [test])};
    });
    return {schemaVersion: 'eq-test-run-draft/0.1', refs: structuredClone(refs), passed: runs.every(r => r.evaluation.passed), runs};
  });
}
