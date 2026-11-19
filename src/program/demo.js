import {parseShortCpp, generateArduino, runCustomerTests} from './index.js';
import {AUTO_LIGHT_SOURCE, SYNTHETIC_CUSTOMER_TESTS, SYNTHETIC_DEVICE, SYNTHETIC_REFS, SYNTHETIC_TOPOLOGY} from './examples.js';

const parsed = parseShortCpp(AUTO_LIGHT_SOURCE);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
const generated = generateArduino(parsed.value, SYNTHETIC_DEVICE);
const tested = runCustomerTests(parsed.value, SYNTHETIC_TOPOLOGY, SYNTHETIC_CUSTOMER_TESTS, SYNTHETIC_REFS);
if (!generated.ok || !tested.ok) throw new Error(JSON.stringify([generated.diagnostics, tested.diagnostics]));
console.log(JSON.stringify({synthetic: true, passed: tested.value.passed,
  cases: tested.value.runs[0].evaluation.cases, generatedSourceLines: generated.value.source.split('\n').length,
  trace: tested.value.runs[0].simulation.events.filter(e => ['read', 'write', 'wait'].includes(e.kind)),
  toolchainRequirements: generated.value.toolchainRequirements}, null, 2));
