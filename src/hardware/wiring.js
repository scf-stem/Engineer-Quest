import {UNO_CANDIDATE_PROFILE, COMPONENT_REFS, HARDWARE_SCHEMA_VERSION, WIRING_RULE_VERSION, componentKind, getTerminalIndex, sameRef, terminalKey} from './profile.js';

const clone = value => JSON.parse(JSON.stringify(value));
const diagnostic = (code, message, terminalIds = [], severity = 'error', manualSection = '6.1') => ({code, severity, message, terminalIds, manualSection});
const isId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const validRef = value => value && ['id', 'version', 'digest'].every(key => typeof value[key] === 'string' && value[key].length > 0);

export function createWiringDocument(profile = UNO_CANDIDATE_PROFILE) {
  return {
    schemaVersion: HARDWARE_SCHEMA_VERSION, deviceProfileRef: clone(profile.ref),
    components: [
      {instanceId: 'uno', typeRef: clone(profile.boardTypeRef), position: {x: 60, y: 65}},
      {instanceId: 'sensor', typeRef: clone(COMPONENT_REFS.sensor), position: {x: 665, y: 65}},
      {instanceId: 'resistor', typeRef: clone(COMPONENT_REFS.resistor), position: {x: 605, y: 340}},
      {instanceId: 'led', typeRef: clone(COMPONENT_REFS.led), position: {x: 810, y: 325}},
    ], connections: [],
  };
}

export function createAutoLightExample(profile = UNO_CANDIDATE_PROFILE) {
  const document = createWiringDocument(profile);
  document.connections = [
    ['uno:5V', 'sensor:VCC'], ['uno:GND_1', 'sensor:GND'],
    [`uno:${profile.pinMap.light}`, 'sensor:AO'], [`uno:${profile.pinMap.lamp}`, 'resistor:1'],
    ['resistor:2', 'led:A'], ['led:K', 'uno:GND_2'],
  ].map(([from, to], i) => ({id: `wire-${i + 1}`, from, to}));
  return document;
}

export function validateDeviceProfile(profile) {
  const errors = [];
  if (!profile || profile.family !== 'arduino-uno' || !validRef(profile.ref) || !validRef(profile.boardTypeRef) || profile.ruleVersion !== WIRING_RULE_VERSION || !Array.isArray(profile.terminals) || !Array.isArray(profile.internalNets)) {
    return {ok: false, diagnostics: [diagnostic('PROFILE_INVALID', '设备 profile 格式或规则版本不受支持。请由总控选择已支持的候选版本。')]};
  }
  const ids = new Set();
  for (const terminal of profile.terminals) {
    if (!terminal || typeof terminal.id !== 'string' || ids.has(terminal.id) || !Number.isFinite(terminal.position?.x) || !Number.isFinite(terminal.position?.y)) errors.push(diagnostic('PROFILE_TERMINAL_INVALID', '设备端子 ID 或坐标无效。'));
    else ids.add(terminal.id);
  }
  for (const id of ['5V', 'GND_TOP', 'GND_1', 'GND_2']) if (!ids.has(id)) errors.push(diagnostic('PROFILE_TERMINAL_INVALID', `设备缺少 ${id} 端子。`));
  for (const [port, signal] of [['light', 'analog'], ['lamp', 'digital']]) {
    const pin = profile.terminals.find(t => t?.id === profile.pinMap?.[port]);
    if (!pin?.connectable || pin.signal !== signal) errors.push(diagnostic('PROFILE_PIN_MAP_INVALID', `逻辑端口 ${port} 没有映射到本关可用的 ${signal} 端子。`));
  }
  for (const net of profile.internalNets) {
    if (!Array.isArray(net) || net.length < 2 || !net.every(id => ids.has(id) && id.startsWith('GND'))) errors.push(diagnostic('PROFILE_INTERNAL_NET_INVALID', '首版只支持板内 GND 公共连接。'));
  }
  if (errors.length) return {ok: false, diagnostics: errors};
  return {ok: true, value: profile, diagnostics: []};
}

/** Finite lesson topology, not a circuit solver. The resistor is NOT a wire. */
export function validateWiring(document, profile = UNO_CANDIDATE_PROFILE) {
  const profileResult = validateDeviceProfile(profile);
  if (!profileResult.ok) return profileResult;
  const diagnostics = [diagnostic('HARDWARE_UNVERIFIED', '候选 Uno 引脚、供电、元件与读数尚未完成实物核验；本结果仅代表虚拟接线规则。', [], 'warning', '4.1')];
  const fail = (code, message, ids, section) => diagnostics.push(diagnostic(code, message, ids, 'error', section));
  if (!document || document.schemaVersion !== HARDWARE_SCHEMA_VERSION || !Array.isArray(document.components) || !Array.isArray(document.connections) || document.components.length > 12 || document.connections.length > 64) {
    fail('WIRING_SCHEMA_INVALID', '接线文档格式无效；最多 12 个元件、64 条线，schemaVersion 必须为 1.0。');
    return {ok: false, diagnostics};
  }
  if (!sameRef(document.deviceProfileRef, profile.ref)) fail('DEVICE_PROFILE_MISMATCH', '接线引用的设备版本与当前 profile 不一致，请明确迁移后重检。');
  const byKind = {};
  const componentIds = new Set();
  for (const component of document.components) {
    if (!component || !isId(component.instanceId) || componentIds.has(component.instanceId)) { fail('COMPONENT_ID_INVALID', '元件实例 ID 缺失、重复或包含不支持的字符。'); continue; }
    componentIds.add(component.instanceId);
    const kind = componentKind(component, profile);
    if (!kind) { fail('COMPONENT_UNSUPPORTED', `元件 ${component.instanceId} 的类型或版本不受本关支持。`); continue; }
    if (byKind[kind]) fail('COMPONENT_DUPLICATE', `本关只支持一个 ${kind} 元件。`);
    else byKind[kind] = component;
    if (!Number.isFinite(component.position?.x) || !Number.isFinite(component.position?.y)) fail('POSITION_INVALID', `元件 ${component.instanceId} 的显示坐标无效。`);
  }
  for (const kind of ['uno', 'sensor', 'resistor', 'led']) if (!byKind[kind]) fail('COMPONENT_MISSING', `缺少本关必需的 ${kind} 元件。`);
  // Do not build an ambiguous graph from duplicate or malformed instances.
  if (diagnostics.some(d => d.severity === 'error')) return {ok: false, diagnostics};
  const index = getTerminalIndex(document, profile);
  const parent = new Map([...index.keys()].map(id => [id, id]));
  const root = id => { while (parent.get(id) !== id) id = parent.get(id); return id; };
  const union = (a, b) => parent.set(root(a), root(b));
  const same = (a, b) => root(a) === root(b);
  const t = (kind, id) => terminalKey(byKind[kind].instanceId, id);
  for (const net of profile.internalNets) for (const id of net.slice(1)) union(t('uno', net[0]), t('uno', id));
  const wireIds = new Set();
  const pairs = new Set();
  for (const wire of document.connections) {
    if (!wire || !isId(wire.id) || wireIds.has(wire.id)) { fail('WIRE_ID_INVALID', '连线 ID 缺失或重复。'); continue; }
    wireIds.add(wire.id);
    const endpoints = [wire.from, wire.to];
    if (!endpoints.every(id => typeof id === 'string' && index.has(id))) { fail('UNKNOWN_TERMINAL', `连线 ${wire.id} 指向未知端子，请重新选择端子。`, endpoints.filter(id => typeof id === 'string')); continue; }
    if (wire.from === wire.to) { fail('WIRE_SELF_CONNECTION', '同一个端子不能接到自身。', endpoints); continue; }
    if (endpoints.some(id => !index.get(id).connectable)) { fail('TERMINAL_NOT_ALLOWED', '这条线使用了本关未开放的端子，请查阅端子说明。', endpoints); continue; }
    const pair = [...endpoints].sort().join('|');
    if (pairs.has(pair)) { fail('WIRE_DUPLICATE', '两个端子已经有连线，请删除重复线。', endpoints); continue; }
    pairs.add(pair);
    union(wire.from, wire.to);
  }
  const power = t('uno', '5V'), ground = t('uno', 'GND_1');
  const light = t('uno', profile.pinMap.light), lamp = t('uno', profile.pinMap.lamp);
  const vcc = t('sensor', 'VCC'), sensorGround = t('sensor', 'GND'), ao = t('sensor', 'AO');
  const a = t('led', 'A'), k = t('led', 'K'), r1 = t('resistor', '1'), r2 = t('resistor', '2');
  if (same(power, ground)) fail('POWER_SHORT', '5V 与 GND 直接短接。请移除连接电源与地的导线。', [power, ground]);
  if (!same(vcc, power)) fail('SENSOR_POWER_MISSING', '光照模块 VCC 需要连接候选 5V 电源端。', [vcc, power], '5.2');
  if (!same(sensorGround, ground)) fail('SENSOR_GROUND_MISSING', '光照模块缺少公共地：将 GND 接到 Uno 的 GND。', [sensorGround, ground], '5.2');
  if (!same(ao, light)) fail('SENSOR_PIN_MISMATCH', `光照 AO 需要连接 ${profile.pinMap.light}，与逻辑端口 light 的映射一致。`, [ao, light, ...[...index.keys()].filter(id => id.startsWith(`${byKind.uno.instanceId}:`) && same(ao, id))], '4.2');
  const reversed = same(a, ground) && (same(k, lamp) || (same(lamp, r1) && same(r2, k)) || (same(lamp, r2) && same(r1, k)));
  if (reversed) fail('LED_POLARITY_REVERSED', 'LED 极性接反：K 负极接 GND，A 正极经电阻接输出。', [a, k], '5.3');
  else if (!same(k, ground)) fail('LED_GROUND_MISSING', 'LED K 负极需要接公共地 GND，请确认 A/K 极性。', [k, ground], '5.3');
  const path = (same(lamp, r1) && same(r2, a)) || (same(lamp, r2) && same(r1, a));
  if (!path) fail('LED_SERIES_RESISTOR_MISSING', `${profile.pinMap.lamp} 输出必须经串联限流电阻接 LED A 正极；电阻 1/2 端可互换。`, [lamp, r1, r2, a], '5.3');
  if (same(lamp, a) || same(r1, r2)) fail('RESISTOR_BYPASSED', '限流电阻被导线旁路。请删除跨过电阻的直连线。', [lamp, a, r1, r2], '5.3');
  // Every valid wire belongs to one of five approved nets. No hidden extra links.
  const expected = new Map([[power, 'power'], [vcc, 'power'], [ground, 'ground'], [t('uno', 'GND_TOP'), 'ground'], [t('uno', 'GND_2'), 'ground'], [sensorGround, 'ground'], [k, 'ground'], [light, 'light'], [ao, 'light'], [lamp, 'lamp'], [a, 'anode']]);
  const resistorForward = same(lamp, r1) || same(a, r2);
  expected.set(r1, resistorForward ? 'lamp' : 'anode');
  expected.set(r2, resistorForward ? 'anode' : 'lamp');
  const groups = new Map();
  for (const id of index.keys()) {
    const netId = root(id);
    if (!groups.has(netId)) groups.set(netId, []);
    groups.get(netId).push(id);
  }
  for (const net of groups.values()) {
    const used = net.filter(id => document.connections.some(w => w?.from === id || w?.to === id));
    if (!used.length) continue;
    const roles = new Set(net.map(id => expected.get(id)).filter(Boolean));
    if (roles.size > 1) fail('NET_CONFLICT', `不应相连的网络被合并：${used.join('、')}。请检查多余导线。`, used);
    const wrongPins = used.filter(id => !expected.has(id));
    if (wrongPins.length) fail('UNMAPPED_PIN', `本关程序未使用 ${wrongPins.join('、')}；候选映射为 light→${profile.pinMap.light}、lamp→${profile.pinMap.lamp}。`, wrongPins, '4.2');
  }
  if (diagnostics.some(d => d.severity === 'error')) return {ok: false, diagnostics};
  const nets = [...groups.values()].map(ids => ids.sort()).sort((a, b) => a[0].localeCompare(b[0])).map((terminalIds, i) => ({id: `net-${i + 1}`, terminalIds}));
  return {ok: true, value: {
    schemaVersion: HARDWARE_SCHEMA_VERSION, deviceProfileRef: clone(profile.ref), ruleVersion: profile.ruleVersion,
    pinMap: clone(profile.pinMap),
    bindings: {light: {terminalId: light, physicalPin: profile.pinMap.light, arduinoIdentifier: profile.pinMap.light}, lamp: {terminalId: lamp, physicalPin: profile.pinMap.lamp, arduinoIdentifier: profile.pinMap.lamp.slice(1)}},
    nets,
  }, diagnostics};
}

const LEGACY_TERMINALS = {
  'UNO.5V': 'uno:5V', 'UNO.GND': 'uno:GND_1', 'UNO.A0': 'uno:A0', 'UNO.D9': 'uno:D9',
  'SENSOR.VCC': 'sensor:VCC', 'SENSOR.GND': 'sensor:GND', 'SENSOR.AO': 'sensor:AO',
  'R.1': 'resistor:1', 'R.2': 'resistor:2', 'LED.A': 'led:A', 'LED.K': 'led:K',
};

/** Structural migration deliberately preserves electrically invalid drafts. */
export function migrateLegacyWiring(connections, profile = UNO_CANDIDATE_PROFILE) {
  if (!Array.isArray(connections) || connections.length > 64 || connections.some(w => !Array.isArray(w) || w.length !== 2 || !w.every(id => typeof id === 'string' && Object.hasOwn(LEGACY_TERMINALS, id)))) {
    return {ok: false, diagnostics: [diagnostic('LEGACY_WIRING_INVALID', '旧接线必须是已知端子组成的二元素数组；未知端子不会被猜测替换。')]};
  }
  const profileResult = validateDeviceProfile(profile);
  if (!profileResult.ok) return profileResult;
  const value = createWiringDocument(profile);
  value.connections = connections.map(([from, to], i) => ({id: `legacy-${i + 1}`, from: LEGACY_TERMINALS[from], to: LEGACY_TERMINALS[to]}));
  return {ok: true, value, diagnostics: [diagnostic('LEGACY_MIGRATED', '旧接线已显式迁移；请重新检查，旧通过记录不沿用。', [], 'warning')]};
}

/** Stable projection for E's digest. Positions, wire IDs and array order are presentation only. */
export function getWiringElectricalState(document) {
  return {
    schemaVersion: document.schemaVersion, deviceProfileRef: clone(document.deviceProfileRef),
    components: document.components.map(({instanceId, typeRef}) => ({instanceId, typeRef: clone(typeRef)})).sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
    connections: document.connections.map(({from, to}) => [from, to].sort()).sort((a, b) => a.join('|').localeCompare(b.join('|'))),
  };
}
