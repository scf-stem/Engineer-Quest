export const SCHEMA_VERSION = 'eq-program/0.1';
export const LANGUAGE_PROFILE = Object.freeze({
  ref: Object.freeze({id: 'eq-short-cpp', version: '0.1', digest: 'candidate-0.1'}),
});
export const INT_MIN = -32768;
export const INT_MAX = 32767;
export const CAPS = Object.freeze({nodes: 1000, depth: 32, source: 24000, steps: 100000, time: 60000});

export class ProgramFault extends Error {
  constructor(code, message, node) {
    super(message);
    const range = node?.sourceRange;
    this.diagnostic = {code, severity: 'error', message, ...(typeof node?.id === 'string' ? {nodeId: node.id} : {}),
      ...(range && Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.end >= range.start ? {sourceRange: {start: range.start, end: range.end}} : {})};
  }
}
export function fail(code, message, node) { throw new ProgramFault(code, message, node); }
export function result(fn) {
  try { return {ok: true, value: fn(), diagnostics: []}; }
  catch (error) {
    if (!(error instanceof ProgramFault)) throw error;
    return {ok: false, diagnostics: [error.diagnostic]};
  }
}
export function unwrap(r) {
  if (!r.ok) { const error = new ProgramFault('', ''); error.diagnostic = r.diagnostics[0]; throw error; }
  return r.value;
}
export function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function exact(value, required, optional = [], node = value) {
  if (!isRecord(value) || required.some(k => !Object.hasOwn(value, k)) ||
      Object.keys(value).some(k => !required.includes(k) && !optional.includes(k))) {
    fail('INVALID_SHAPE', `字段必须为 ${required.join(', ')}${optional.length ? `；可选 ${optional.join(', ')}` : ''}`, node);
  }
}
export function validRef(ref) {
  return isRecord(ref) && ['id', 'version', 'digest'].every(k => typeof ref[k] === 'string' && ref[k].length > 0 && ref[k].length <= 200);
}
export function sameRef(a, b) {
  return validRef(a) && validRef(b) && ['id', 'version', 'digest'].every(k => a[k] === b[k]);
}
const RESERVED = new Set(('alignas alignof and and_eq asm auto bitand bitor bool break case catch char char16_t char32_t class compl concept const constexpr const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq setup loop readAnalog readDigital writeDigital waitMs HIGH LOW INPUT OUTPUT').split(' '));
export function identifier(name) {
  return typeof name === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name) && !RESERVED.has(name);
}
export function integer(value, node) {
  if (!Number.isInteger(value) || value < INT_MIN || value > INT_MAX) fail('INTEGER_RANGE', `整数范围为 ${INT_MIN}…${INT_MAX}`, node);
  return value === 0 ? 0 : value;
}
export function checkLanguage(profile = LANGUAGE_PROFILE) {
  if (!sameRef(profile?.ref, LANGUAGE_PROFILE.ref)) fail('LANGUAGE_PROFILE', '不支持的语言配置版本');
  return profile;
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
