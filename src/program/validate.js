import {CAPS, LANGUAGE_PROFILE, SCHEMA_VERSION, checkLanguage, exact, fail, identifier, integer, isRecord, result, sameRef, validRef} from './common.js';

/** Candidate boundary: pinMap is supplied by B/E after topology validation. */
export function inspectDevice(profile) {
  if (!isRecord(profile) || !validRef(profile.ref) || profile.family !== 'arduino-uno' || !isRecord(profile.pinMap)) fail('DEVICE_PROFILE', '需要 Arduino Uno 设备版本和 pinMap');
  if (['variant', 'fqbn'].some(key => profile[key] !== undefined && profile[key] !== null && typeof profile[key] !== 'string') || (profile.calibrationStatus !== undefined && !['synthetic', 'pending', 'verified'].includes(profile.calibrationStatus))) fail('DEVICE_PROFILE', '板卡目标或校准状态字段无效');
  const ports = Object.entries(profile.pinMap);
  if (!ports.length || ports.length > 20) fail('PIN_MAP', 'pinMap 应包含 1…20 个逻辑端口');
  const pins = new Set();
  for (const [name, port] of ports) {
    if (!identifier(name)) fail('PORT_NAME', `无效的逻辑端口名 ${name}`);
    exact(port, ['pin', 'direction', 'signalType', 'initialValue'], ['min', 'max']);
    if (!(Number.isInteger(port.pin) && port.pin >= 0 && port.pin <= 13) && !(typeof port.pin === 'string' && /^A[0-5]$/.test(port.pin))) fail('PIN_MAP', `端口 ${name} 的物理引脚无效`);
    const pin = typeof port.pin === 'string' && port.pin[0] === 'A' ? 14 + Number(port.pin[1]) : port.pin;
    if (pins.has(pin)) fail('PIN_COLLISION', '一个物理引脚不能绑定多个逻辑端口');
    pins.add(pin);
    if (!['input', 'output'].includes(port.direction) || !['analog', 'digital'].includes(port.signalType)) fail('PORT_TYPE', `端口 ${name} 的方向或信号类型无效`);
    if (port.signalType === 'analog') {
      if (port.direction !== 'input' || !Number.isInteger(port.min) || !Number.isInteger(port.max) || port.min < 0 || port.max > 1023 || port.min > port.max || !Number.isInteger(port.initialValue) || port.initialValue < port.min || port.initialValue > port.max) fail('PORT_RANGE', `模拟输入 ${name} 需要已知的 0…1023 整数范围与初始值`);
      if (typeof port.pin !== 'string') fail('PIN_MAP', '模拟输入必须映射到 A0…A5');
    } else if (typeof port.initialValue !== 'boolean' || port.min !== undefined || port.max !== undefined) fail('PORT_RANGE', `数字端口 ${name} 的初始值必须是布尔值`);
  }
  return profile;
}

export function validateProgram(program, deviceProfile) {
  return result(() => {
    exact(program, ['schemaVersion', 'languageProfileRef', 'variables', 'setup', 'loop']);
    if (program.schemaVersion !== SCHEMA_VERSION || !sameRef(program.languageProfileRef, LANGUAGE_PROFILE.ref)) fail('PROGRAM_VERSION', '不支持的程序或语言版本');
    const device = deviceProfile === undefined ? undefined : inspectDevice(deviceProfile);
    const ids = new Set(), seen = new WeakSet(), variables = new Map(), portsUsed = new Map();
    let nodes = 0;
    function node(value, required, depth) {
      if (depth > CAPS.depth || ++nodes > CAPS.nodes) fail('PROGRAM_BUDGET', '程序结构超出节点或嵌套预算', value);
      exact(value, ['id', ...required], ['sourceRange']);
      if (seen.has(value)) fail('CYCLIC_IR', '程序节点不能共享对象或循环引用', value);
      seen.add(value);
      if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 120 || ids.has(value.id)) fail('NODE_ID', '每个节点必须有独立且唯一的 ID', value);
      ids.add(value.id);
      if (value.sourceRange !== undefined) {
        exact(value.sourceRange, ['start', 'end']);
        if (!Number.isInteger(value.sourceRange.start) || !Number.isInteger(value.sourceRange.end) || value.sourceRange.start < 0 || value.sourceRange.end < value.sourceRange.start || value.sourceRange.end > CAPS.source) fail('SOURCE_RANGE', '源码位置无效', value);
      }
    }
    function expression(expr, depth = 0) {
      if (!isRecord(expr)) fail('EXPRESSION', '缺少表达式');
      switch (expr.kind) {
        case 'literal':
          node(expr, ['kind', 'value'], depth);
          if (typeof expr.value === 'boolean') return 'bool';
          integer(expr.value, expr); return 'int';
        case 'variable': {
          node(expr, ['kind', 'name'], depth);
          if (!variables.has(expr.name)) fail('UNKNOWN_VARIABLE', `变量 ${expr.name} 尚未声明`, expr);
          return variables.get(expr.name).type;
        }
        case 'read':
          node(expr, ['kind', 'port', 'signalType'], depth);
          if (!['analog', 'digital'].includes(expr.signalType)) fail('PORT_TYPE', '读取类型必须是 analog 或 digital', expr);
          port(expr.port, 'input', expr.signalType, expr);
          return expr.signalType === 'analog' ? 'int' : 'bool';
        case 'unary': {
          node(expr, ['kind', 'op', 'operand'], depth);
          if (!['!', '-'].includes(expr.op)) fail('OPERATOR', '只支持 ! 和负号', expr);
          const expected = expr.op === '!' ? 'bool' : 'int';
          type(expression(expr.operand, depth + 1), expected, expr); return expected;
        }
        case 'binary': {
          node(expr, ['kind', 'op', 'left', 'right'], depth);
          const arithmetic = ['+', '-', '*', '/', '%'], order = ['<', '<=', '>', '>='], equal = ['==', '!='], logic = ['&&', '||'];
          if (![...arithmetic, ...order, ...equal, ...logic].includes(expr.op)) fail('OPERATOR', '不支持的运算符', expr);
          const a = expression(expr.left, depth + 1), b = expression(expr.right, depth + 1);
          type(a, b, expr);
          if (!equal.includes(expr.op)) type(a, logic.includes(expr.op) ? 'bool' : 'int', expr);
          return arithmetic.includes(expr.op) ? 'int' : 'bool';
        }
        default: fail('EXPRESSION', `未知表达式 ${expr.kind}`, expr);
      }
    }
    function type(actual, expected, value) {
      if (actual !== expected) fail('TYPE_MISMATCH', `需要 ${expected}，实际为 ${actual}；不隐式转换整数与布尔值`, value);
    }
    function port(name, direction, signalType, value) {
      if (!identifier(name)) fail('PORT_NAME', '逻辑端口名称无效', value);
      const key = `${direction}:${signalType}`;
      if (portsUsed.has(name) && portsUsed.get(name) !== key) fail('PORT_TYPE', `端口 ${name} 的用法冲突`, value);
      portsUsed.set(name, key);
      if (device && (!Object.hasOwn(device.pinMap, name) || device.pinMap[name].direction !== direction || device.pinMap[name].signalType !== signalType)) fail('PORT_MAPPING', `端口 ${name} 与设备的方向/信号类型不一致`, value);
    }
    if (!Array.isArray(program.variables) || program.variables.length > 64) fail('VARIABLES', '最多声明 64 个全局变量');
    for (const v of program.variables) {
      node(v, ['name', 'type', 'constant', 'initial'], 0);
      if (!identifier(v.name) || variables.has(v.name) || (device && Object.hasOwn(device.pinMap, v.name))) fail('VARIABLE_NAME', '变量名重复、保留或与端口冲突', v);
      if (!['int', 'bool'].includes(v.type) || typeof v.constant !== 'boolean') fail('VARIABLE_TYPE', '变量类型只能是 int 或 bool', v);
      if (v.initial?.kind !== 'literal') fail('INITIAL_VALUE', '全局初始值必须是整数或布尔字面量', v);
      type(expression(v.initial), v.type, v);
      variables.set(v.name, v);
    }
    function statements(list, depth = 0) {
      if (!Array.isArray(list) || list.length > CAPS.nodes || depth > CAPS.depth) fail('STATEMENTS', '语句列表无效或嵌套过深');
      for (const s of list) {
        if (!isRecord(s)) fail('STATEMENT', '需要语句节点');
        switch (s.kind) {
          case 'assign': {
            node(s, ['kind', 'name', 'value'], depth);
            if (!variables.has(s.name)) fail('UNKNOWN_VARIABLE', `变量 ${s.name} 尚未声明`, s);
            if (variables.get(s.name).constant) fail('CONSTANT_WRITE', `不能修改常量 ${s.name}`, s);
            type(expression(s.value, depth + 1), variables.get(s.name).type, s); break;
          }
          case 'write':
            node(s, ['kind', 'port', 'value'], depth);
            port(s.port, 'output', 'digital', s); type(expression(s.value, depth + 1), 'bool', s); break;
          case 'wait':
            node(s, ['kind', 'duration'], depth);
            type(expression(s.duration, depth + 1), 'int', s);
            if (s.duration.kind === 'literal' && s.duration.value < 0) fail('WAIT_RANGE', '等待时间不能为负数', s);
            break;
          case 'if':
            node(s, ['kind', 'condition', 'then', 'else'], depth);
            type(expression(s.condition, depth + 1), 'bool', s);
            statements(s.then, depth + 1); statements(s.else, depth + 1); break;
          case 'while':
            node(s, ['kind', 'condition', 'body'], depth);
            type(expression(s.condition, depth + 1), 'bool', s);
            statements(s.body, depth + 1); break;
          default: fail('STATEMENT', `未知语句 ${s.kind}`, s);
        }
      }
    }
    statements(program.setup); statements(program.loop);
    return {program, ...(device ? {deviceProfileRef: device.ref} : {}), portsUsed: Object.fromEntries(portsUsed), nodeCount: nodes};
  });
}

export function validateLanguage(profile) { return result(() => checkLanguage(profile)); }
