import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext,resolveHardwareManualSection} from '../../src/integration/hardware-adapter.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {getManualSection} from '../../content/index.js';
test('E stamps B candidate without claiming verified hardware and preserves actual pin bindings',async()=>{
  const context=await createHardwareContext();
  assert.match(context.ref.digest,/^sha256:[0-9a-f]{64}$/);
  assert.equal(context.profile.fqbn,null);assert.equal(context.profile.calibrationStatus,'synthetic');
  assert.equal(context.validate(context.createDocument()).ok,false);
  const result=context.validate(createAutoLightExample(context.profile));
  assert.equal(result.ok,true);assert.equal(result.value.bindings.lamp.arduinoIdentifier,'9');
  for(const section of ['4.1','4.2','5.2','5.3','6.1','6.2'])assert.ok(getManualSection(resolveHardwareManualSection(section)));
  assert.equal(resolveHardwareManualSection('5.2'),'05.1');assert.equal(resolveHardwareManualSection('05.1'),'05.1');
  assert.equal(resolveHardwareManualSection('5.3'),'05.2');assert.equal(resolveHardwareManualSection('05.2'),'05.2');
  assert.equal(resolveHardwareManualSection('99'),null);
});
