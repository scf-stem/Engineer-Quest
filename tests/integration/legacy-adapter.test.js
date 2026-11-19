import test from 'node:test';
import assert from 'node:assert/strict';
import {createLegacyAdapter} from '../../src/integration/legacy-adapter.js';
import {CORRECT_WIRING} from '../../src/engine.js';

test('legacy adapter binds customer versions, exact source, topology and behavior', async () => {
  const adapter = await createLegacyAdapter();
  const program = {version:1,sensorThreshold:450,lampOnWhenDark:true,delayMs:100};
  const snapshot = {...adapter.refs,program,source:adapter.generateSource(program),wiring:{legacyConnections:CORRECT_WIRING},requirementCard:{explanation:'暗开亮关，持续检查'}};
  assert.equal((await adapter.evaluate(snapshot)).passed,true);
  for (const patch of [
    {testSuiteRef:{...snapshot.testSuiteRef,version:'tampered'}},
    {source:snapshot.source.replace('delay(100)','delay(150)')},
    {wiring:{legacyConnections:CORRECT_WIRING.slice(1)}},
    {program:{...program,sensorThreshold:500},source:adapter.generateSource({...program,sensorThreshold:500})},
  ]) assert.equal((await adapter.evaluate({...snapshot,...patch})).passed,false);
});
