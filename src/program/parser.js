import {CAPS, LANGUAGE_PROFILE, SCHEMA_VERSION, checkLanguage, fail, integer, result, unwrap} from './common.js';
import {validateProgram} from './validate.js';

// A bounded lexer and precedence parser. Student text is never evaluated.
export function parseShortCpp(source, languageProfile = LANGUAGE_PROFILE) {
  return result(() => {
    checkLanguage(languageProfile);
    if (typeof source !== 'string' || source.length > CAPS.source) fail('SOURCE_BUDGET', `源码须为最多 ${CAPS.source} 字符的文本`);
    const tokens = []; let offset = 0;
    while (offset < source.length) {
      const start = offset, c = source[offset];
      if (/\s/.test(c)) { offset++; continue; }
      if (source.startsWith('//', offset)) { while (offset < source.length && source[offset] !== '\n') offset++; continue; }
      if (source.startsWith('/*', offset)) {
        const end = source.indexOf('*/', offset + 2);
        if (end < 0) fail('UNCLOSED_COMMENT', '注释没有结束', {sourceRange: {start, end: source.length}});
        offset = end + 2; continue;
      }
      if (source.startsWith('++', offset) || source.startsWith('--', offset)) fail('UNKNOWN_TOKEN', '不支持 ++ 或 --；请写成变量赋值', {sourceRange: {start, end: start + 2}});
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*|^(?:0|[1-9][0-9]*)/.exec(source.slice(offset));
      if (match) offset += match[0].length;
      else if (['<=', '>=', '==', '!=', '&&', '||'].includes(source.slice(offset, offset + 2))) offset += 2;
      else if ('(){};,=<>!+-*/%'.includes(c)) offset++;
      else fail('UNKNOWN_TOKEN', `不支持字符“${c}”`, {sourceRange: {start, end: start + 1}});
      tokens.push({text: source.slice(start, offset), start, end: offset});
      if (tokens.length > 5000) fail('SOURCE_BUDGET', '源码词法预算超限');
    }
    tokens.push({text: '<eof>', start: source.length, end: source.length});
    let index = 0, serial = 0, depth = 0;
    const peek = () => tokens[index].text;
    function take(expected) {
      const token = tokens[index];
      if (expected !== undefined && token.text !== expected) fail('SYNTAX', `需要“${expected}”，实际为“${token.text}”`, {sourceRange: {start: token.start, end: token.end}});
      if (token.text === '<eof>') fail('SYNTAX', '代码意外结束', {sourceRange: {start: token.start, end: token.end}});
      index++; return token;
    }
    function name() {
      const t = take();
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(t.text)) fail('SYNTAX', '需要标识符', {sourceRange: {start: t.start, end: t.end}});
      return t.text;
    }
    function make(start, fields) {
      return {id: `text:${start}:${++serial}`, ...fields, sourceRange: {start, end: tokens[index - 1]?.end ?? start}};
    }
    function nested(fn) {
      if (++depth > CAPS.depth) fail('SOURCE_DEPTH', '代码嵌套过深');
      const value = fn(); depth--; return value;
    }
    const precedence = {'||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6};
    function expr(min = 1) {
      return nested(() => {
        const start = tokens[index].start;
        let left;
        if (peek() === '!' || peek() === '-') {
          const op = take().text;
          // -32768 is a literal, not an out-of-range positive literal with unary minus.
          if (op === '-' && /^[0-9]+$/.test(peek())) left = make(start, {kind: 'literal', value: integer(-Number(take().text))});
          else left = make(start, {kind: 'unary', op, operand: expr(7)});
        } else if (peek() === '(') { take(); left = expr(); take(')'); }
        else if (/^[0-9]+$/.test(peek())) left = make(start, {kind: 'literal', value: integer(Number(take().text))});
        else if (['true', 'false', 'HIGH', 'LOW'].includes(peek())) left = make(start, {kind: 'literal', value: ['true', 'HIGH'].includes(take().text)});
        else if (['readAnalog', 'readDigital'].includes(peek())) {
          const fn = take().text; take('('); const port = name(); take(')');
          left = make(start, {kind: 'read', port, signalType: fn === 'readAnalog' ? 'analog' : 'digital'});
        } else left = make(start, {kind: 'variable', name: name()});
        while ((precedence[peek()] ?? 0) >= min) {
          const op = take().text, right = expr(precedence[op] + 1);
          left = make(start, {kind: 'binary', op, left, right});
        }
        return left;
      });
    }
    function body() {
      return nested(() => { take('{'); const list = []; while (peek() !== '}') list.push(statement()); take('}'); return list; });
    }
    function statement() {
      return nested(() => {
        const start = tokens[index].start;
        if (peek() === 'if') {
          take(); take('('); const condition = expr(); take(')'); const then = body(); let otherwise = [];
          if (peek() === 'else') { take(); otherwise = peek() === 'if' ? [statement()] : body(); }
          return make(start, {kind: 'if', condition, then, else: otherwise});
        }
        if (peek() === 'while') { take(); take('('); const condition = expr(); take(')'); return make(start, {kind: 'while', condition, body: body()}); }
        if (peek() === 'writeDigital') {
          take(); take('('); const port = name(); take(','); const value = expr(); take(')'); take(';'); return make(start, {kind: 'write', port, value});
        }
        if (peek() === 'waitMs') {
          take(); take('('); const duration = expr(); take(')'); take(';'); return make(start, {kind: 'wait', duration});
        }
        const variable = name(); take('='); const value = expr(); take(';'); return make(start, {kind: 'assign', name: variable, value});
      });
    }
    const program = {schemaVersion: SCHEMA_VERSION, languageProfileRef: {...LANGUAGE_PROFILE.ref}, variables: [], setup: [], loop: []};
    while (['const', 'int', 'bool'].includes(peek())) {
      const start = tokens[index].start, constant = peek() === 'const'; if (constant) take();
      const type = take().text, variable = name(); take('='); const initial = expr(); take(';');
      program.variables.push(make(start, {name: variable, type, constant, initial}));
    }
    // setup is optional; pin modes and default outputs are generated from the device profile.
    take('void');
    if (peek() === 'setup') { take(); take('('); take(')'); program.setup = body(); take('void'); }
    take('loop'); take('('); take(')'); program.loop = body();
    if (peek() !== '<eof>') fail('EXTRA_SOURCE', 'loop 后不允许额外函数或语句', {sourceRange: {start: tokens[index].start, end: source.length}});
    unwrap(validateProgram(program));
    return program;
  });
}
