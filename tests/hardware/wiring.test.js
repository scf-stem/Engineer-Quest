import test from 'node:test';
import assert from 'node:assert/strict';
import {UNO_CANDIDATE_PROFILE as profile, componentDefinition, getTerminalIndex, terminalKey, createWiringDocument, createAutoLightExample, validateDeviceProfile, validateWiring, migrateLegacyWiring, getWiringElectricalState, createInputFixture} from '../../src/hardware/index.js';
import {routeWire} from '../../src/hardware/routing.js';

const clone = value => JSON.parse(JSON.stringify(value));
const codes = value => validateWiring(value).diagnostics.filter(d => d.severity === 'error').map(d => d.code);
const without = number => { const doc = createAutoLightExample(); doc.connections.splice(number - 1, 1); return doc; };
const add = (doc, from, to) => { doc.connections.push({id: 'extra', from, to}); return doc; };

test('candidate identity and physical verification stay explicit and immutable', () => {
  assert.equal(profile.family, 'arduino-uno');
  assert.equal(profile.variant, null); assert.equal(profile.fqbn, null);
  assert.equal(profile.calibrationStatus, 'synthetic');
  assert.equal(profile.physicalVerification, 'pending');
  assert.deepEqual(profile.pinMap, {light: 'A0', lamp: 'D9'});
  assert.throws(() => { profile.pinMap.light = 'A1'; }, TypeError);
  assert.ok(validateDeviceProfile(profile).ok);
});

test('candidate top/bottom header labels and coordinates match a documented top view', () => {
  const top = profile.terminals.filter(t => t.row === 'top');
  const bottom = profile.terminals.filter(t => t.row === 'bottom');
  assert.deepEqual(top.map(t => t.id), ['SCL','SDA','AREF','GND_TOP','D13','D12','D11','D10','D9','D8','D7','D6','D5','D4','D3','D2','D1','D0']);
  assert.deepEqual(bottom.map(t => t.id), ['NC','IOREF','RESET','3V3','5V','GND_1','GND_2','VIN','A0','A1','A2','A3','A4','A5']);
  assert.ok(top.every(t => t.position.y === 20));
  assert.ok(bottom.every(t => t.position.y === 260));
});

test('blank work fails with actionable diagnostics and no topology value', () => {
  const result = validateWiring(createWiringDocument());
  assert.equal(result.ok, false); assert.equal('value' in result, false);
  assert.ok(result.diagnostics.some(d => d.code === 'SENSOR_GROUND_MISSING' && d.terminalIds.includes('sensor:GND') && d.manualSection));
});

test('approved topology exports the exact A/E pin binding and isolated resistor sides', () => {
  const result = validateWiring(createAutoLightExample());
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.pinMap, {light: 'A0', lamp: 'D9'});
  assert.equal(result.value.bindings.lamp.arduinoIdentifier, '9');
  assert.equal(result.value.bindings.light.arduinoIdentifier, 'A0');
  assert.equal(result.value.nets.find(n => n.terminalIds.includes('resistor:1')).terminalIds.includes('resistor:2'), false);
  assert.ok(result.diagnostics.some(d => d.code === 'HARDWARE_UNVERIFIED' && d.severity === 'warning'));
});

test('swapping resistor terminals is allowed', () => {
  const doc = createAutoLightExample();
  for (const w of doc.connections) for (const key of ['from', 'to']) if (w[key].startsWith('resistor:')) w[key] = w[key] === 'resistor:1' ? 'resistor:2' : 'resistor:1';
  assert.equal(validateWiring(doc).ok, true);
});

test('each of the six missing wires prevents a pass', () => {
  for (let number = 1; number <= 6; number++) assert.equal(validateWiring(without(number)).ok, false, `missing wire ${number}`);
  assert.ok(codes(without(2)).includes('SENSOR_GROUND_MISSING'));
  assert.ok(codes(without(6)).includes('LED_GROUND_MISSING'));
  assert.ok(codes(without(4)).includes('LED_SERIES_RESISTOR_MISSING'));
});

test('wrong A1 or D8 is identified without silently moving a wire', () => {
  const sensor = createAutoLightExample(); sensor.connections[2].from = 'uno:A1';
  const before = JSON.stringify(sensor);
  const result = validateWiring(sensor);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.code === 'SENSOR_PIN_MISMATCH' && d.terminalIds.includes('uno:A1')));
  assert.equal(JSON.stringify(sensor), before);
  const led = createAutoLightExample(); led.connections[3].from = 'uno:D8';
  assert.ok(codes(led).includes('UNMAPPED_PIN'));
  assert.ok(codes(led).includes('LED_SERIES_RESISTOR_MISSING'));
});

test('reversed LED, resistor bypass, power short and crossed signal all fail', () => {
  const reversed = createAutoLightExample(); reversed.connections[4].to = 'led:K'; reversed.connections[5].from = 'led:A';
  assert.ok(codes(reversed).includes('LED_POLARITY_REVERSED'));
  assert.ok(codes(add(createAutoLightExample(), 'uno:D9', 'led:A')).includes('RESISTOR_BYPASSED'));
  assert.ok(codes(add(createAutoLightExample(), 'resistor:1', 'resistor:2')).includes('RESISTOR_BYPASSED'));
  assert.ok(codes(add(createAutoLightExample(), 'sensor:VCC', 'led:K')).includes('POWER_SHORT'));
  assert.ok(codes(add(createAutoLightExample(), 'sensor:AO', 'uno:D9')).includes('NET_CONFLICT'));
});

test('all three candidate GND header pins are electrically equivalent', () => {
  for (const ground of ['GND_TOP', 'GND_1', 'GND_2']) {
    const doc = createAutoLightExample(); doc.connections[1].from = `uno:${ground}`; doc.connections[5].to = `uno:${ground}`;
    assert.equal(validateWiring(doc).ok, true, ground);
  }
});

test('exhaustive extra-wire check rejects every bridge between approved nets', () => {
  const roles = [
    ['uno:5V', 'sensor:VCC'],
    ['uno:GND_TOP', 'uno:GND_1', 'uno:GND_2', 'sensor:GND', 'led:K'],
    ['uno:A0', 'sensor:AO'], ['uno:D9', 'resistor:1'], ['resistor:2', 'led:A'],
  ];
  const roleOf = id => roles.findIndex(net => net.includes(id));
  const terminals = [...getTerminalIndex(createAutoLightExample()).values()].filter(t => t.connectable).map(t => t.key);
  for (let i = 0; i < terminals.length; i++) for (let j = i + 1; j < terminals.length; j++) {
    const from = terminals[i], to = terminals[j], doc = createAutoLightExample();
    if (doc.connections.some(w => [w.from, w.to].includes(from) && [w.from, w.to].includes(to))) continue;
    const expected = roleOf(from) >= 0 && roleOf(from) === roleOf(to);
    assert.equal(validateWiring(add(doc, from, to)).ok, expected, `${from} ↔ ${to}`);
  }
});

test('unknown, self, duplicate and lesson-disabled terminals fail closed', () => {
  for (const [from, to, code] of [
    ['uno:A7', 'sensor:AO', 'UNKNOWN_TERMINAL'], ['led:A', 'led:A', 'WIRE_SELF_CONNECTION'],
    ['sensor:VCC', 'uno:5V', 'WIRE_DUPLICATE'], ['uno:VIN', 'sensor:VCC', 'TERMINAL_NOT_ALLOWED'],
  ]) assert.ok(codes(add(createAutoLightExample(), from, to)).includes(code));
});

test('malformed or stale documents, duplicate instances and budgets cannot produce a topology', () => {
  for (const value of [null, [], {}, {...createAutoLightExample(), schemaVersion: 1}, {...createAutoLightExample(), deviceProfileRef: {...profile.ref, version: 'stale'}}, {...createAutoLightExample(), components: [null]}, {...createAutoLightExample(), connections: Array(65).fill(null)}]) {
    const result = validateWiring(value); assert.equal(result.ok, false); assert.equal('value' in result, false);
  }
  const duplicate = createAutoLightExample(); duplicate.components.push(clone(duplicate.components[0]));
  assert.ok(codes(duplicate).includes('COMPONENT_ID_INVALID'));
  const badWire = createAutoLightExample(); badWire.connections[0].id = badWire.connections[1].id;
  assert.ok(codes(badWire).includes('WIRE_ID_INVALID'));
});

test('profile mapping changes require rewiring; valid alternative mappings are explicit', () => {
  const next = clone(profile); next.pinMap = {light: 'A1', lamp: 'D8'};
  next.ref.version = '0.2.0'; next.ref.digest = 'draft:new-map';
  assert.equal(validateWiring(createAutoLightExample(), next).ok, false);
  const example = createAutoLightExample(next);
  const result = validateWiring(example, next);
  assert.equal(result.ok, true); assert.equal(result.value.bindings.lamp.arduinoIdentifier, '8');
  const invalid = clone(profile); invalid.pinMap.light = 'D9';
  assert.equal(validateWiring(example, invalid).ok, false);
});

test('instance IDs are opaque; terminal lookup and topology follow declared instances', () => {
  const doc = createAutoLightExample();
  for (const c of doc.components) c.instanceId = `test-${c.instanceId}`;
  for (const w of doc.connections) { w.from = `test-${w.from}`; w.to = `test-${w.to}`; }
  assert.equal(validateWiring(doc).ok, true);
  assert.equal(getTerminalIndex(doc).has(terminalKey('test-uno', 'A0')), true);
  assert.equal(componentDefinition(doc.components[3]).title, 'LED 指示灯');
});

test('electrical projection ignores display movement, IDs, wire direction and ordering', () => {
  const original = createAutoLightExample(), moved = clone(original);
  moved.components.reverse(); moved.components[0].position = {x: 23, y: 42};
  moved.connections.reverse();
  for (const w of moved.connections) { [w.from, w.to] = [w.to, w.from]; w.id = `renamed-${w.id}`; }
  assert.deepEqual(getWiringElectricalState(original), getWiringElectricalState(moved));
  moved.connections.pop();
  assert.notDeepEqual(getWiringElectricalState(original), getWiringElectricalState(moved));
});

test('legacy arrays only migrate explicitly and do not grant a pass', () => {
  const legacy = [['UNO.5V','SENSOR.VCC'],['UNO.GND','SENSOR.GND'],['UNO.A0','SENSOR.AO'],['UNO.D9','R.1'],['R.2','LED.A'],['LED.K','UNO.GND']];
  assert.equal(validateWiring(legacy).ok, false);
  const result = migrateLegacyWiring(legacy);
  assert.equal(result.ok, true); assert.equal(validateWiring(result.value).ok, true);
  assert.equal(migrateLegacyWiring([['UNO.A1','SENSOR.AO']]).ok, false);
  assert.equal(validateWiring(migrateLegacyWiring(legacy.slice(0, 1)).value).ok, false);
});

test('input fixtures preserve explicit integer milliseconds and logical signals without outputs', () => {
  const timeline = createInputFixture(profile);
  assert.deepEqual(timeline, [{atMs:0,signals:{light:150}}, {atMs:500,signals:{light:850}}, {atMs:1000,signals:{light:150}}]);
  for (const samples of [[], [{atMs: -1, value: 1}], [{atMs: .5, value: 0}], [{atMs: 0, value: 1024}], [{atMs: 0, value: 0}, {atMs: 0, value: 1}], [{atMs: 2, value: 2}, {atMs: 1, value: 1}]]) assert.throws(() => createInputFixture(profile, {samples}), TypeError);
});

test('visual wire routes preserve endpoints and avoid card interiors after leaving a port', () => {
  const from = {x: 100, y: 90, exit: {x: 100, y: 128}}, to = {x: 400, y: 290, exit: {x: 400, y: 328}};
  const obstacles = [{x: 50, y: 20, width: 150, height: 90}, {x: 300, y: 220, width: 150, height: 90}, {x: 210, y: 100, width: 60, height: 160}];
  const path = routeWire(from, to, obstacles);
  const points = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => ({x: +x, y: +y}));
  assert.deepEqual(points[0], {x: from.x, y: from.y});
  assert.deepEqual(points.at(-1), {x: to.x, y: to.y});
  for (let i = 2; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i];
    assert.ok(a.x === b.x || a.y === b.y, 'axis-aligned corridor');
    for (const box of obstacles) {
      const middle = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
      assert.equal(middle.x > box.x && middle.x < box.x + box.width && middle.y > box.y && middle.y < box.y + box.height, false, 'wire must not disappear behind a card');
    }
  }
});

test('terminal lookup tolerates absent/invalid document arrays for the diagnostics view', () => {
  assert.equal(getTerminalIndex(null).size, 0);
  assert.equal(getTerminalIndex({components: {}}).size, 0);
});
