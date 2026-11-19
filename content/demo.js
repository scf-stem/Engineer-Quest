// Existing prototype adapter for an executable content example; not a timed simulator.
import { runProgram } from '../src/engine.js';
import { autoLampOrder, getCustomerSuite } from './index.js';
import { evaluateCustomerSuite } from './customer-tests.js';
import { reviewStaticRequirements } from './npc.js';

export function makeLegacySampleTraces(program, requirementVersion) {
  const suite = getCustomerSuite(requirementVersion);
  return Object.fromEntries(suite.tests.map(customerTest => [customerTest.id, {
    status: 'completed',
    simulatedUntilMs: customerTest.maxTimeMs,
    events: customerTest.inputTimeline.map(input => ({
      atMs: input.atMs,
      outputs: { lamp: runProgram(program, input.signals.light).lamp },
    })),
  }]));
}

const scenarios = [
  { label: '基础：450', requirementVersion: '1.0.0', threshold: 450, onWhenDark: true },
  { label: '错误阈值：700', requirementVersion: '1.0.0', threshold: 700, onWhenDark: true },
  { label: '错误输出：明暗反转', requirementVersion: '1.0.0', threshold: 450, onWhenDark: false },
  { label: '变更：沿用450应失败', requirementVersion: '1.1.0', threshold: 450, onWhenDark: true },
  { label: '变更：600', requirementVersion: '1.1.0', threshold: 600, onWhenDark: true },
];
console.log(`${autoLampOrder.title} · 合成样例，非真实时序、编译或硬件证据`);
for (const scenario of scenarios) {
  const program = { version: 1, sensorThreshold: scenario.threshold, lampOnWhenDark: scenario.onWhenDark, delayMs: 100 };
  const result = evaluateCustomerSuite({ requirementVersion: scenario.requirementVersion, simulations: makeLegacySampleTraces(program, scenario.requirementVersion) });
  console.log(JSON.stringify({ label: scenario.label, requirementVersion: scenario.requirementVersion, passed: result.passed, failedCases: result.cases.filter(item => !item.passed).map(item => item.caseId) }));
}
console.log(JSON.stringify(reviewStaticRequirements({ requirementVersion: '1.0.0', fallbackReason: 'offline', card: {} }), null, 2));
