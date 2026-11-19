/** Candidate teaching profile. This is NOT identification of a connected board. */
export const HARDWARE_SCHEMA_VERSION = '1.0';
export const WIRING_RULE_VERSION = 'auto-light-wiring/0.1';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// These are version labels, not E's canonical content digests or credentials.
const ref = id => ({id, version: '0.1.0', digest: `draft:${id}:0.1.0`});
export const COMPONENT_REFS = deepFreeze({
  uno: ref('uno-r3-header-candidate'),
  sensor: ref('light-ao-synthetic'),
  resistor: ref('resistor-220-candidate'),
  led: ref('led-polarized-candidate'),
});

const top = ['SCL', 'SDA', 'AREF', 'GND_TOP', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'];
const bottom = ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND_1', 'GND_2', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const openPins = new Set(['5V', 'GND_TOP', 'GND_1', 'GND_2', 'A0', 'A1', 'D8', 'D9']);
function boardTerminal(id, index, row) {
  const ground = id.startsWith('GND');
  const analog = /^A\d$/.test(id);
  const digital = /^D\d+$/.test(id);
  return {
    id, label: ground ? 'GND' : id,
    direction: ground ? 'reference' : analog ? 'input' : digital ? 'bidirectional' : 'power',
    signal: ground ? 'ground' : analog ? 'analog' : digital ? 'digital' : 'power',
    range: analog ? {min: 0, max: 1023, unit: 'ADC count (synthetic)'} : undefined,
    connectable: openPins.has(id),
    position: {x: row === 'top' ? 24 + index * 24 : 24 + index * 30, y: row === 'top' ? 20 : 260},
    row,
    description: ground ? '公共地。候选 R3 的三个 GND 内部相连。' : id === '5V' ? '候选 5V 电源端；这里只表示接线规则，不表示已上电。'
      : analog ? `${id} 模拟输入；首单候选映射为 A0，0–1023 只作合成读数。`
      : digital ? `${id} 数字 IO；首单候选灯输出为 D9。`
      : '首单不开放此端子接线；只展示候选引脚名称。',
  };
}

export const UNO_CANDIDATE_PROFILE = deepFreeze({
  ref: ref('auto-light-uno-candidate'),
  family: 'arduino-uno', variant: null, fqbn: null,
  title: 'Arduino Uno · 候选 R3 引脚示意',
  calibrationStatus: 'synthetic',
  physicalVerification: 'pending',
  candidateVariant: 'UNO R3 / A000066 (reference only)',
  boardTypeRef: COMPONENT_REFS.uno,
  ruleVersion: WIRING_RULE_VERSION,
  // The executor owns sampling, wait, state and step semantics. B supplies no clock.
  timeUnit: 'ms',
  pinMap: {light: 'A0', lamp: 'D9'},
  ports: {
    light: {direction: 'input', signal: 'analog', range: {min: 0, max: 1023}, integer: true, lowerMeans: 'darker (synthetic only)'},
    lamp: {direction: 'output', signal: 'digital', valueType: 'boolean', activeLevel: 'HIGH'},
  },
  terminals: [...top.map((id, i) => boardTerminal(id, i, 'top')), ...bottom.map((id, i) => boardTerminal(id, i, 'bottom'))],
  internalNets: [['GND_TOP', 'GND_1', 'GND_2']],
  constraints: {
    logicVoltage: {value: 5, unit: 'V', status: 'candidate'},
    resistorOhms: {value: 220, status: 'candidate'},
    maximumIoCurrentMa: {value: 20, status: 'reference-only-not-simulated'},
  },
  sources: [
    {title: 'Arduino A000066 Full Pinout, 2022-10-06, p.1', url: 'https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf'},
    {title: 'Arduino UNO R3 documentation', url: 'https://docs.arduino.cc/hardware/uno-rev3/'},
  ],
});

export const COMPONENT_CATALOG = deepFreeze({
  sensor: {
    typeRef: COMPONENT_REFS.sensor, title: '光照模块', subtitle: '模拟输出 · 合成模型', width: 200, height: 140, manualSection: '5.2',
    description: 'VCC 供电、GND 公共地、AO 送出模拟光照信号。模块型号、读数方向和阈值需要实测。',
    terminals: [
      {id: 'VCC', label: 'VCC', signal: 'power', direction: 'input', position: {x: 30, y: 120}, connectable: true},
      {id: 'GND', label: 'GND', signal: 'ground', direction: 'reference', position: {x: 100, y: 120}, connectable: true},
      {id: 'AO', label: 'AO', signal: 'analog', direction: 'output', range: {min: 0, max: 1023}, position: {x: 170, y: 120}, connectable: true},
    ],
  },
  resistor: {
    typeRef: COMPONENT_REFS.resistor, title: '限流电阻', subtitle: '220 Ω · 候选', width: 180, height: 110, manualSection: '5.3',
    description: '串联在输出和 LED 之间；1、2 端可以互换。220 Ω 是候选值，尚未核验实物 LED 和电流。',
    terminals: [
      {id: '1', label: '1', signal: 'passive', direction: 'passive', position: {x: 20, y: 65}, connectable: true},
      {id: '2', label: '2', signal: 'passive', direction: 'passive', position: {x: 160, y: 65}, connectable: true},
    ],
  },
  led: {
    typeRef: COMPONENT_REFS.led, title: 'LED 指示灯', subtitle: 'A 正极 / K 负极', width: 170, height: 150, manualSection: '5.3',
    description: 'A 为阳极（正极），K 为阴极（负极）；本关用串联电阻限流。发光状态由 A 线执行结果提供。',
    terminals: [
      {id: 'A', label: 'A +', signal: 'passive', direction: 'input', position: {x: 40, y: 130}, connectable: true},
      {id: 'K', label: 'K −', signal: 'passive', direction: 'output', position: {x: 130, y: 130}, connectable: true},
    ],
  },
});

export function sameRef(a, b) {
  return !!a && !!b && ['id', 'version', 'digest'].every(key => a[key] === b[key]);
}

export function componentKind(component, profile = UNO_CANDIDATE_PROFILE) {
  if (sameRef(component?.typeRef, profile?.boardTypeRef)) return 'uno';
  return Object.keys(COMPONENT_CATALOG).find(kind => sameRef(component?.typeRef, COMPONENT_CATALOG[kind].typeRef));
}

export function componentDefinition(component, profile = UNO_CANDIDATE_PROFILE) {
  return componentKind(component, profile) === 'uno'
    ? {title: 'Arduino Uno', subtitle: 'R3 引脚候选 · 非实物认证', width: 460, height: 280, terminals: profile.terminals, manualSection: '4.1', description: '仅为候选 R3 顶视图的功能示意，非等比例实物布线图。具体 Uno 代际与 FQBN 尚未确认。'}
    : COMPONENT_CATALOG[componentKind(component, profile)];
}

export const terminalKey = (instanceId, terminalId) => `${instanceId}:${terminalId}`;

export function getTerminalIndex(document, profile = UNO_CANDIDATE_PROFILE) {
  const index = new Map();
  for (const component of Array.isArray(document?.components) ? document.components : []) {
    const definition = componentDefinition(component, profile);
    if (!definition) continue;
    for (const terminal of definition.terminals) {
      const id = terminalKey(component.instanceId, terminal.id);
      index.set(id, {...terminal, key: id, componentId: component.instanceId, componentTitle: definition.title});
    }
  }
  return index;
}
