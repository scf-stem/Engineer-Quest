import {CAPS, fail, result, unwrap} from './common.js';
import {inspectDevice, validateProgram} from './validate.js';

/** Readable editable subset, separate from the full .ino runtime implementation. */
export function generateShortCpp(program) {
  return result(() => {
    unwrap(validateProgram(program));
    let source = '';
    const map = [], sections = {};
    const append = text => { source += text; };
    const mapped = (node, render) => {
      const start = source.length; render();
      map.push({nodeId: node.id, nodeKind: node.kind ?? 'declaration', sourceRange: {start, end: source.length}});
    };
    function expr(e) {
      mapped(e, () => {
        if (e.kind === 'literal') append(String(e.value));
        else if (e.kind === 'variable') append(e.name);
        else if (e.kind === 'read') append(`${e.signalType === 'analog' ? 'readAnalog' : 'readDigital'}(${e.port})`);
        else if (e.kind === 'unary') { append(`(${e.op}`); expr(e.operand); append(')'); }
        else { append('('); expr(e.left); append(` ${e.op} `); expr(e.right); append(')'); }
      });
    }
    function body(list, indent) {
      for (const s of list) {
        const prefix = '  '.repeat(indent);
        mapped(s, () => {
          append(prefix);
          switch (s.kind) {
            case 'assign': append(`${s.name} = `); expr(s.value); append(';'); break;
            case 'write': append(`writeDigital(${s.port}, `); expr(s.value); append(');'); break;
            case 'wait': append('waitMs('); expr(s.duration); append(');'); break;
            case 'while': append('while ('); expr(s.condition); append(') {\n'); body(s.body, indent + 1); append(`${prefix}}`); break;
            case 'if': append('if ('); expr(s.condition); append(') {\n'); body(s.then, indent + 1); append(`${prefix}} else {\n`); body(s.else, indent + 1); append(`${prefix}}`); break;
          }
        });
        append('\n');
      }
    }
    for (const v of program.variables) {
      mapped(v, () => { append(`${v.constant ? 'const ' : ''}${v.type} ${v.name} = `); expr(v.initial); append(';'); }); append('\n');
    }
    for (const section of ['setup', 'loop']) {
      const start = source.length; append(`void ${section}() {\n`); body(program[section], 1); append('}\n');
      sections[section] = {start, end: source.length};
    }
    if (source.length > CAPS.source) fail('SOURCE_BUDGET', '展开的教学代码超出文本编辑预算');
    return {source, map, sections};
  });
}

const RUNTIME = `#include <Arduino.h>
#include <stdint.h>
// Fixed teaching runtime. On arithmetic/wait fault, hold outputs until reset.
static void _eqFault() { while (true) { delay(1000UL); } }
static int16_t _eqInt(int32_t value) {
  if (value < -32768L || value > 32767L) _eqFault();
  return (int16_t)value;
}
static int16_t _eqAdd(int16_t a, int16_t b) { return _eqInt((int32_t)a + b); }
static int16_t _eqSub(int16_t a, int16_t b) { return _eqInt((int32_t)a - b); }
static int16_t _eqMul(int16_t a, int16_t b) { return _eqInt((int32_t)a * b); }
static int16_t _eqDiv(int16_t a, int16_t b) { if (b == 0) _eqFault(); return _eqInt((int32_t)a / b); }
static int16_t _eqMod(int16_t a, int16_t b) { if (b == 0) _eqFault(); return _eqInt((int32_t)a % b); }
static int16_t _eqNeg(int16_t a) { return _eqInt(-(int32_t)a); }
static int16_t readAnalog(uint8_t pin) { return _eqInt(analogRead(pin)); }
static bool readDigital(uint8_t pin) { return digitalRead(pin) == HIGH; }
static void writeDigital(uint8_t pin, bool on) { digitalWrite(pin, on ? HIGH : LOW); }
static void waitMs(int16_t ms) { if (ms < 0) _eqFault(); delay((unsigned long)ms); }
`;

export function generateArduino(program, deviceProfile) {
  return result(() => {
    inspectDevice(deviceProfile);
    unwrap(validateProgram(program, deviceProfile));
    const lines = RUNTIME.trimEnd().split('\n'), map = [];
    function line(text, node) {
      const start = lines.join('\n').length + 1; lines.push(text);
      if (node) map.push({nodeId: node.id, sourceRange: {start, end: start + text.length}, ...(node.sourceRange ? {inputSourceRange: node.sourceRange} : {})});
    }
    const names = {variable: name => `_eqv_${name}`, port: name => `_eqp_${name}`};
    // Lower every operand into its own temporary. C++ argument evaluation order
    // must not reorder reads or arithmetic faults relative to the interpreter.
    let temp = 0;
    function expr(e, indent) {
      const prefix = '  '.repeat(indent), id = `_eqt_${++temp}`;
      if (e.kind === 'binary' && ['&&', '||'].includes(e.op)) {
        const a = expr(e.left, indent); line(`${prefix}bool ${id} = ${a};`, e);
        line(`${prefix}if (${e.op === '&&' ? id : '!' + id}) {`);
        const b = expr(e.right, indent + 1); line(`${prefix}  ${id} = ${b};`); line(`${prefix}}`); return id;
      }
      let value;
      if (e.kind === 'literal') value = typeof e.value === 'boolean' ? String(e.value) : e.value === -32768 ? '(-32767 - 1)' : String(e.value);
      if (e.kind === 'variable') value = names.variable(e.name);
      if (e.kind === 'read') value = `${e.signalType === 'analog' ? 'readAnalog' : 'readDigital'}(${names.port(e.port)})`;
      if (e.kind === 'unary') { const a = expr(e.operand, indent); value = e.op === '!' ? `!${a}` : `_eqNeg(${a})`; }
      if (e.kind === 'binary') {
        const a = expr(e.left, indent), b = expr(e.right, indent);
        const helper = {'+': '_eqAdd', '-': '_eqSub', '*': '_eqMul', '/': '_eqDiv', '%': '_eqMod'}[e.op];
        value = helper ? `${helper}(${a}, ${b})` : `(${a} ${e.op} ${b})`;
      }
      line(`${prefix}const auto ${id} = ${value};`, e); return id;
    }
    function body(list, indent) {
      for (const s of list) {
        const prefix = '  '.repeat(indent);
        switch (s.kind) {
          case 'assign': { const value = expr(s.value, indent); line(`${prefix}${names.variable(s.name)} = ${value};`, s); break; }
          case 'write': { const value = expr(s.value, indent); line(`${prefix}writeDigital(${names.port(s.port)}, ${value});`, s); break; }
          case 'wait': { const value = expr(s.duration, indent); line(`${prefix}waitMs(${value});`, s); break; }
          case 'if': {
            const condition = expr(s.condition, indent); line(`${prefix}if (${condition}) {`, s);
            body(s.then, indent + 1); line(`${prefix}} else {`); body(s.else, indent + 1); line(`${prefix}}`); break;
          }
          case 'while':
            line(`${prefix}while (true) {`, s);
            { const condition = expr(s.condition, indent + 1); line(`${prefix}  if (!${condition}) break;`); }
            body(s.body, indent + 1); line(`${prefix}}`); break;
        }
      }
    }
    for (const [name, port] of Object.entries(deviceProfile.pinMap)) line(`static const uint8_t ${names.port(name)} = ${port.pin};`);
    for (const v of program.variables) line(`static ${v.constant ? 'const ' : ''}${v.type === 'int' ? 'int16_t' : 'bool'} ${names.variable(v.name)} = ${v.initial.value === -32768 ? '(-32767 - 1)' : v.initial.value};`, v);
    line('void setup() {');
    for (const [name, port] of Object.entries(deviceProfile.pinMap)) {
      // Preload the output latch before enabling OUTPUT, including initial HIGH.
      if (port.direction === 'output') line(`  digitalWrite(${names.port(name)}, ${port.initialValue ? 'HIGH' : 'LOW'});`);
      line(`  pinMode(${names.port(name)}, ${port.direction === 'input' ? 'INPUT' : 'OUTPUT'});`);
    }
    body(program.setup, 1); line('}'); line('void loop() {'); body(program.loop, 1); line('}');
    return {source: lines.join('\n') + '\n', map, toolchainRequirements: {family: deviceProfile.family, variant: deviceProfile.variant ?? null,
      fqbn: deviceProfile.fqbn ?? null, cppStandard: 'c++11', libraries: [], runtimeVersion: 'eq-runtime/0.1', compileStatus: 'not_run', requiresVerifiedBoardTarget: true}};
  });
}
