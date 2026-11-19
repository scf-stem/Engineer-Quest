/** One deliberately small program schema, shared by blocks, simulation and C++.
 * Simulation assumes calibrated AO readings: 0=dark, 1023=bright.
 * This is a teaching fixture, not a claim about an uncalibrated physical module.
 */
export function validateProgram(ast) {
  const errors = [];
  if (!ast || ast.version !== 1) errors.push('程序版本必须是 1');
  if (!Number.isInteger(ast?.sensorThreshold) || ast.sensorThreshold < 1 || ast.sensorThreshold > 1023) errors.push('亮度阈值必须是 1–1023 的整数');
  if (typeof ast?.lampOnWhenDark !== 'boolean') errors.push('灯输出必须是布尔选择');
  if (!Number.isInteger(ast?.delayMs) || ast.delayMs < 10 || ast.delayMs > 2000) errors.push('采样等待必须是 10–2000 毫秒的整数');
  if (ast && Object.keys(ast).some(k => !['version','sensorThreshold','lampOnWhenDark','delayMs'].includes(k))) errors.push('程序包含不支持的字段');
  return {valid: errors.length === 0, errors};
}
function assertProgram(ast) {
  const result = validateProgram(ast);
  if (!result.valid) throw new Error(result.errors.join('；'));
}
export function runProgram(ast, input) {
  assertProgram(ast);
  if (!Number.isInteger(input) || input < 0 || input > 1023) throw new Error('输入必须是 0–1023 的整数');
  const isDark = input < ast.sensorThreshold;
  return {input, lamp: ast.lampOnWhenDark ? isDark : !isDark, delayMs: ast.delayMs};
}
export function generateCpp(ast) {
  assertProgram(ast);
  return `// Engineer Quest: UNO R3 / sensor A0 / LED D9\n// AO calibration assumption: lower readings mean darker.\nvoid setup() {\n  pinMode(9, OUTPUT);\n}\n\nvoid loop() {\n  int light = analogRead(A0);\n  if (light < ${ast.sensorThreshold}) {\n    digitalWrite(9, ${ast.lampOnWhenDark ? 'HIGH' : 'LOW'});\n  } else {\n    digitalWrite(9, ${ast.lampOnWhenDark ? 'LOW' : 'HIGH'});\n  }\n  delay(${ast.delayMs});\n}\n`;
}
// A bounded lexer followed by a deterministic template grammar. Never eval.
// Only this documented C++ subset is accepted; unknown tokens are rejected.
function tokenize(source) {
  if (typeof source !== 'string' || source.length > 12000) throw new Error('代码须为文本且不能超过 12000 字符');
  const tokens = [];
  const alpha = c => c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_');
  const digit = c => c !== undefined && c >= '0' && c <= '9';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (' \t\r\n'.includes(c)) { i++; continue; }
    if (c === '/' && source[i+1] === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i+1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) i++;
      if (i >= source.length) throw new Error('注释没有结束');
      i += 2; continue;
    }
    const start = i;
    if (alpha(c)) {
      while (alpha(source[i]) || digit(source[i])) i++;
      tokens.push(source.slice(start,i));
    } else if (digit(c)) {
      while (digit(source[i])) i++;
      tokens.push(source.slice(start,i));
    } else if ('(){};,=<'.includes(c)) {
      tokens.push(c); i++;
    } else throw new Error(`第 ${i+1} 字符“${c}”不属于本关支持的语法`);
    if (tokens.length > 512) throw new Error('代码超出本关语法预算');
  }
  return tokens;
}
export function parseCpp(source) {
  const tokens = tokenize(source);
  let p = 0;
  function expect(...items) {
    for (const expected of items) {
      const actual = tokens[p++];
      if (actual !== expected) throw new Error(`语法位置 ${p}：需要“${expected}”，实际为“${actual ?? '代码结束'}”。本关只允许修改阈值、HIGH/LOW 和等待时间。`);
    }
  }
  function integer() {
    const value = tokens[p++];
    if (!value || [...value].some(c => c < '0' || c > '9') || (value.length > 1 && value[0] === '0')) throw new Error('需要十进制非负整数，不能写表达式或前导零');
    return Number(value);
  }
  function level() {
    const value = tokens[p++];
    if (value !== 'HIGH' && value !== 'LOW') throw new Error('灯输出只能是 HIGH 或 LOW');
    return value;
  }
  expect('void','setup','(',')','{','pinMode','(','9',',','OUTPUT',')',';','}', 'void','loop','(',')','{','int','light','=','analogRead','(','A0',')',';','if','(','light','<');
  const sensorThreshold = integer();
  expect(')','{','digitalWrite','(','9',',');
  const dark = level();
  expect(')',';','}','else','{','digitalWrite','(','9',',');
  const bright = level();
  expect(')',';','}','delay','(');
  const delayMs = integer();
  expect(')',';','}');
  if (p !== tokens.length) throw new Error('程序末尾包含额外语句；本关不允许增加函数或执行任意代码');
  if (dark === bright) throw new Error('明暗两个分支必须给出相反输出');
  const ast = {version:1,sensorThreshold,lampOnWhenDark:dark === 'HIGH',delayMs};
  assertProgram(ast);
  return ast;
}
export function runSuite(ast) {
  assertProgram(ast);
  // Legacy demo requirement v1 is FIXED at 450, independent of the student's answer.
  // The new program adapter consumes D's separately versioned customer timelines.
  const inputs = [0,1023,449,450,0,1023,0];
  const names = ['全暗应亮','全亮应灭','阈值前一格','等于阈值应灭','连续变化：暗','连续变化：亮','连续变化：再次暗'];
  const cases = inputs.map((input,i) => {
    const expected = input < 450;
    const actual = runProgram(ast,input).lamp;
    return {name:names[i],input,expected,actual,passed:actual === expected};
  });
  return {passed:cases.every(c => c.passed),cases};
}
export const TERMINALS = ['UNO.5V','UNO.GND','UNO.A0','UNO.D9','SENSOR.VCC','SENSOR.GND','SENSOR.AO','R.1','R.2','LED.A','LED.K'];
export const CORRECT_WIRING = [['UNO.5V','SENSOR.VCC'],['UNO.GND','SENSOR.GND'],['UNO.A0','SENSOR.AO'],['UNO.D9','R.1'],['R.2','LED.A'],['LED.K','UNO.GND']];
export function validateWiring(connections) {
  const errors = [];
  if (!Array.isArray(connections) || connections.length > 30) return {valid:false,errors:['接线必须是最多 30 条连线的列表']};
  const parent = new Map(TERMINALS.map(t => [t,t]));
  function root(t) { while (parent.get(t) !== t) t = parent.get(t); return t; }
  function same(a,b) { return root(a) === root(b); }
  for (const wire of connections) {
    if (!Array.isArray(wire) || wire.length !== 2 || !wire.every(t => parent.has(t))) { errors.push('存在未知端子或非本关支持的引脚'); continue; }
    if (wire[0] === wire[1]) { errors.push('不能将端子连接到自身'); continue; }
    parent.set(root(wire[0]),root(wire[1]));
  }
  if (same('UNO.5V','UNO.GND')) errors.push('危险：5V 与 GND 直接短接');
  if (!same('UNO.5V','SENSOR.VCC')) errors.push('光敏模块 VCC 未接 5V');
  if (!same('UNO.GND','SENSOR.GND')) errors.push('光敏模块缺少公共地 GND');
  if (!same('UNO.A0','SENSOR.AO')) errors.push('光敏 AO 信号必须连接 A0，与程序一致');
  if (!same('LED.K','UNO.GND')) errors.push('LED 负极 K 必须接 GND，请检查极性');
  const resistorPath = (same('UNO.D9','R.1') && same('R.2','LED.A')) || (same('UNO.D9','R.2') && same('R.1','LED.A'));
  if (!resistorPath) errors.push('D9 必须通过限流电阻串联到 LED 正极 A');
  if (same('UNO.D9','LED.A') || same('R.1','R.2')) errors.push('限流电阻被旁路，不能直接点亮 LED');
  // Only the five approved nets are legal: reject unsafe additional connections.
  const nets = [['UNO.5V','SENSOR.VCC'],['UNO.GND','SENSOR.GND','LED.K'],['UNO.A0','SENSOR.AO'],['UNO.D9'],['LED.A']];
  for (let i=0;i<nets.length;i++) for (let j=i+1;j<nets.length;j++) {
    if (same(nets[i][0],nets[j][0])) errors.push(`不允许把 ${nets[i][0]} 与 ${nets[j][0]} 接在同一网络`);
  }
  return {valid:errors.length === 0,errors:[...new Set(errors)]};
}
