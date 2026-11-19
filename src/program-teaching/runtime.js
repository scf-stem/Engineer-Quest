import {blocksToProgram} from '../program/blocks.js';
import {simulate} from '../program/simulate.js';
import {CAPS, LANGUAGE_PROFILE, SCHEMA_VERSION} from '../program/common.js';
import {canonicalJson} from '../contracts/index.js';

const VERSION = 'g0-g3/1';
const HOST = '__eqt_host_g0_g3_1__:';
const SAMPLE_NAME = 'eqtObservedLight';
const KINDS = ['output', 'sequence', 'reading'];
const GOALS = ['on', 'off', 'on-wait-off', 'off-wait-on', 'read'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const diag = (code, message, nodeId) => ({code, severity: 'error', message, ...(typeof nodeId === 'string' && nodeId ? {nodeId} : {})});
class FragmentFault extends Error {
  constructor(code, message, block) { super(message); this.diagnostic = diag(code, message, block?.id); }
}
const fail = (code, message, block) => { throw new FragmentFault(code, message, block); };
const connection = (block, name) => block.inputs?.[name]?.block ?? block.inputs?.[name]?.shadow;
const hostNumber = (id, value) => ({type: 'math_number', id: HOST + id, fields: {NUM: value}});

/** Inspect only connected, active Blockly blocks; dormant replacement shadows are not executed. */
function visibleNodes(workspace) {
  const ids = new Set(), objects = new WeakSet();
  function visit(block, depth) {
    if (!object(block)) fail('TEACHING_BLOCK_SHAPE', '连接处需要一块真实积木。', block);
    if (objects.has(block)) fail('BLOCK_CYCLE', '积木连接包含循环或共享对象，原作品保留。', block);
    objects.add(block);
    if (depth > CAPS.depth || ids.size >= CAPS.nodes) fail('BLOCK_BUDGET', '这段练习的积木数量或嵌套超出范围。', block);
    if (typeof block.id !== 'string' || !block.id || block.id.length > 120 || ids.has(block.id)) fail('BLOCK_ID', '每块学生积木需要独立的原始ID。', block);
    if (block.id.startsWith(HOST)) fail('TEACHING_RESERVED_ID', '学生积木不能使用导师准备步骤的ID。', block);
    ids.add(block.id);
    if (block.disabled === true || block.enabled === false || block.disabledReasons?.length) fail('DISABLED_BLOCK', '这块积木已停用，请启用或保留后移开。', block);
    if (block.inputs !== undefined && !object(block.inputs)) fail('BLOCK_INPUT', '积木输入连接的结构无效。', block);
    for (const input of Object.values(block.inputs ?? {})) {
      if (!object(input)) fail('BLOCK_INPUT', '值位或语句位的连接无效。', block);
      const child = input.block ?? input.shadow;
      if (child !== undefined) visit(child, depth + 1);
    }
    if (block.next !== undefined) {
      if (!object(block.next) || !object(block.next.block)) fail('BLOCK_INPUT', '下一句的连接无效，不能静默丢弃后续动作。', block);
      visit(block.next.block, depth);
    }
  }
  for (const block of workspace.blocks.blocks) visit(block, 0);
  return [...ids];
}

function scaffold(kind, root, initialLamp) {
  let action = root, declaration;
  if (kind === 'reading') {
    if (Object.keys(root.inputs ?? {}).some(name => name !== 'VALUE') || root.next !== undefined) fail('TEACHING_SAMPLE_SHAPE', '观察架只提供一个读取值位，不接后续动作。', root);
    const read = connection(root, 'VALUE');
    if (!read) fail('BLOCK_INPUT', '观察值位还空着，请放入LIGHT读取块。', root);
    if (read.type !== 'eqp_read_analog' || read.fields?.PORT !== 'LIGHT') fail('TEACHING_LIGHT_READ', '这里需要读取模拟输入LIGHT，不能用固定数字或输出端口代替。', read);
    action = {type: 'eqp_set', id: HOST + 'sample-set', fields: {NAME: SAMPLE_NAME}, inputs: {VALUE: {block: read}}};
    declaration = {type: 'eqp_declare', id: HOST + 'sample-declaration', fields: {NAME: SAMPLE_NAME, TYPE: 'int', CONSTANT: 'FALSE'}, inputs: {INITIAL: {block: hostNumber('sample-initial', 0)}}};
  } else {
    for (let block = root; block; block = block.next?.block) {
      if (!['eqp_write', 'eqp_wait'].includes(block.type)) fail('TEACHING_STATEMENT', '这次只执行已学的灯输出与等待；请保留其他积木。', block);
    }
  }
  const initial = {type: 'eqp_write', id: HOST + 'initial-lamp', fields: {PORT: 'LAMP'},
    inputs: {VALUE: {block: {type: 'logic_boolean', id: HOST + 'initial-lamp-value', fields: {BOOL: initialLamp ? 'TRUE' : 'FALSE'}}}}, next: {block: action}};
  return {blocks: {languageVersion: 0, blocks: [{type: 'eqp_program', id: HOST + 'program', inputs: {
    ...(declaration ? {VARIABLES: {block: declaration}} : {}),
    SETUP: {block: initial}, LOOP: {block: {type: 'eqp_wait', id: HOST + 'safe-wait', inputs: {MS: {block: hostNumber('safe-wait-value', 100)}}}},
  }}]}};
}

/** Wrap the visible fragment in a legal program; never interpret a loose expression directly. */
export function buildTeachingRun(input = {}) {
  const {kind, blockState, topology, light, initialLamp, actor, runId} = object(input) ? input : {};
  if (!KINDS.includes(kind)) return {ok: false, diagnostics: [diag('TEACHING_KIND', '未知的首段练习类型。')]};
  if (!['mentor', 'learner'].includes(actor) || typeof runId !== 'string' || !runId || runId.length > 200) return {ok: false, diagnostics: [diag('TEACHING_ORIGIN', '运行需要明确的示范/学生来源和本次runId。')]};
  if (!Number.isInteger(light) || light < 0 || light > 1023 || typeof initialLamp !== 'boolean') return {ok: false, diagnostics: [diag('TEACHING_ENVIRONMENT', '光照需要0…1023整数，初始灯态需要明确的开或关。')]};
  const workspace = blockState?.workspace ?? blockState, tops = workspace?.blocks?.blocks;
  if (!Array.isArray(tops)) return {ok: false, diagnostics: [diag('TEACHING_WORKSPACE', '需要当前局部Blockly工作区的原始序列化。')]};
  if (workspace.blocks.languageVersion !== undefined && workspace.blocks.languageVersion !== 0) return {ok: false, diagnostics: [diag('TEACHING_WORKSPACE_VERSION', '此工作区的序列化版本不受支持。')]};
  if (tops.length !== 1) return {ok: false, diagnostics: tops.length
    ? tops.map(block => diag('TEACHING_TOP_LEVEL', '把现有积木接成一条动作链；散落的顶层积木仍保留。', block?.id))
    : [diag('TEACHING_EMPTY_WORKSPACE', '这段练习还没有学生积木。')]};
  const root = tops[0], expected = kind === 'reading' ? 'eqt_sample' : 'eqp_write';
  if (root?.type !== expected) return {ok: false, diagnostics: [diag('TEACHING_FRAGMENT_ROOT', kind === 'reading' ? '从观察架的值位读取，不直接运行散落表达式。' : '这一段从一条灯输出开始，把后续动作接在它下面。', root?.id)]};
  try {
    const studentNodeIds = visibleNodes(workspace);
    const converted = blocksToProgram(scaffold(kind, root, initialLamp));
    if (!converted.ok) return {ok: false, diagnostics: converted.diagnostics.map(item => item.nodeId ? item : {...item, nodeId: root.id})};
    const program = converted.value, workspaceCanonical = canonicalJson(workspace);
    const origin = {actor, kind, runId, scaffoldVersion: VERSION};
    const students = new Set(studentNodeIds);
    let horizon = 800;
    while (true) {
      const actual = simulate(program, topology, [{atMs: 0, signals: {LIGHT: light}}], {maxSteps: CAPS.steps, maxTimeMs: horizon});
      if (!actual.ok) return {ok: false, diagnostics: actual.diagnostics};
      const simulation = actual.value, value = {program, simulation, studentNodeIds, origin, workspaceCanonical};
      if (simulation.status !== 'completed') return {ok: false, value, diagnostics: simulation.diagnostics};
      // A longer student wait is replayed for its real duration; no fixed 600ms success timer.
      const pending = simulation.events.findLast(event => event.kind === 'wait' && students.has(event.nodeId) && event.resumeAtMs > horizon);
      if (!pending || horizon === CAPS.time) return {ok: true, value, diagnostics: []};
      horizon = Math.min(CAPS.time, pending.resumeAtMs + 100);
    }
  } catch (error) {
    if (error instanceof FragmentFault) return {ok: false, diagnostics: [error.diagnostic]};
    if (error instanceof TypeError || error?.name === 'DataCloneError') return {ok: false, diagnostics: [diag('TEACHING_WORKSPACE_SHAPE', '工作区需为有限、无循环的Blockly序列化，原作品保留。', root?.id)]};
    throw error;
  }
}

const isWrapper = run => object(run) && typeof run.ok === 'boolean' && (Object.hasOwn(run, 'value') || Array.isArray(run.diagnostics));
const payload = run => isWrapper(run) ? run.value : run;
const wrapperFailed = run => isWrapper(run) && run.ok !== true;
const wrapperDiagnostics = run => Array.isArray(run?.diagnostics) && run.diagnostics.length ? run.diagnostics : [diag('TEACHING_BUILD_FAILED', '这次运行适配返回了失败，保留实际轨迹后重新检查。')];
function runDiagnostics(run) {
  if (!object(run) || !object(run.origin) || run.origin.scaffoldVersion !== VERSION || !KINDS.includes(run.origin.kind)
    || !['mentor', 'learner'].includes(run.origin.actor) || typeof run.origin.runId !== 'string' || !run.origin.runId) return [diag('TEACHING_RUN_VERSION', '这份运行不是当前版本的首段轨迹，请保留原作重新运行。')];
  if (run.program?.schemaVersion !== SCHEMA_VERSION || ['id', 'version', 'digest'].some(key => run.program?.languageProfileRef?.[key] !== LANGUAGE_PROFILE.ref[key])) return [diag('TEACHING_PROGRAM_VERSION', '运行中的程序或语言版本已变化。')];
  if (!Array.isArray(run.studentNodeIds) || !run.studentNodeIds.length || run.studentNodeIds.some(id => typeof id !== 'string' || !id || id.startsWith(HOST)) || new Set(run.studentNodeIds).size !== run.studentNodeIds.length
    || !Array.isArray(run.simulation?.events) || !run.simulation.events.length || !Number.isInteger(run.simulation.completedThroughMs) || run.simulation.completedThroughMs < 0
    || run.simulation.events.some((event, index, events) => !object(event) || !Number.isInteger(event.atMs) || event.atMs < 0 || event.atMs > run.simulation.completedThroughMs || index > 0 && event.atMs < events[index - 1].atMs || typeof event.kind !== 'string' || !object(event.outputs))) return [diag('TEACHING_RUN_SHAPE', '运行缺少学生节点归属或实际事件。')];
  return [];
}

/** Read-only replay, not a paused/resumable execution engine. Equal-time events stay together. */
export function teachingFrameAt(input, timeMs) {
  const run = payload(input), diagnostics = runDiagnostics(run);
  const empty = {ok: false, atMs: null, lamp: null, sample: null, nodeId: null, runtimeNodeId: null, read: null, write: null, waiting: null, events: []};
  if (diagnostics.length) return {...empty, diagnostics: wrapperFailed(input) ? wrapperDiagnostics(input) : diagnostics};
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs < 0) return {...empty, diagnostics: [diag('TEACHING_REPLAY_TIME', '回放位置需要非负的有限毫秒数。')]};
  const atMs = Math.min(timeMs, run.simulation.completedThroughMs);
  const events = run.simulation.events.filter(event => event.atMs <= atMs), students = new Set(run.studentNodeIds);
  const read = events.findLast(event => event.kind === 'read' && event.port === 'LIGHT') ?? null;
  const write = events.findLast(event => event.kind === 'write' && event.port === 'LAMP') ?? null;
  const last = events.at(-1), student = events.findLast(event => students.has(event.nodeId));
  const wait = events.findLast(event => event.kind === 'wait' && event.resumeAtMs > atMs);
  return {ok: !wrapperFailed(input) && run.simulation.status === 'completed', atMs, lamp: last?.outputs?.LAMP ?? null, sample: read?.value ?? null,
    nodeId: student?.nodeId ?? null, runtimeNodeId: events.findLast(event => event.nodeId)?.nodeId ?? null,
    read, write, waiting: wait ? {...wait, student: students.has(wait.nodeId), remainingMs: wait.resumeAtMs - atMs} : null,
    events, diagnostics: wrapperFailed(input) ? wrapperDiagnostics(input) : run.simulation.diagnostics ?? []};
}

/** A specific observed goal, never an award, course gate, or substitute for current-version checks. */
export function assessTeachingRun(input, options = {}) {
  const {goal, previousLight} = object(options) ? options : {};
  const run = payload(input), diagnostics = runDiagnostics(run);
  const students = new Set(Array.isArray(run?.studentNodeIds) ? run.studentNodeIds.filter(id => typeof id === 'string' && !id.startsWith(HOST)) : []);
  const events = Array.isArray(run?.simulation?.events) ? run.simulation.events.filter(event => object(event) && students.has(event.nodeId)) : [];
  const writes = events.filter(event => event.kind === 'write' && event.port === 'LAMP');
  const reads = events.filter(event => event.kind === 'read' && event.port === 'LIGHT');
  const waits = events.filter(event => event.kind === 'wait'), resumes = events.filter(event => event.kind === 'resume');
  const observed = {writes, reads, waits, resumes, events, lastStudentLamp: writes.at(-1)?.value ?? null, sample: reads.at(-1)?.value ?? null};
  const rejected = items => ({ok: false, diagnostics: items, observed});
  if (wrapperFailed(input)) return rejected(wrapperDiagnostics(input));
  if (diagnostics.length) return rejected(diagnostics);
  if (!GOALS.includes(goal)) return rejected([diag('TEACHING_GOAL', '未知的首段观察目标。')]);
  if (run.origin.actor !== 'learner') return rejected([diag('TEACHING_MENTOR_RUN', '这是林工的真实示范，不能记作学生完成。')]);
  if (run.simulation.status !== 'completed') return rejected(run.simulation.diagnostics?.length ? run.simulation.diagnostics : [diag('TEACHING_INCOMPLETE_RUN', '这次运行没有完成，先看实际错误再试。')]);
  const expectedKind = goal === 'read' ? 'reading' : goal.includes('wait') ? 'sequence' : 'output';
  if (run.origin.kind !== expectedKind) return rejected([diag('TEACHING_GOAL_KIND', '这份运行属于另一种练习，不能替代当前目标。')]);
  if (goal === 'read') {
    if (previousLight !== undefined && (!Number.isInteger(previousLight) || previousLight < 0 || previousLight > 1023)) return rejected([diag('TEACHING_PREVIOUS_LIGHT', '上一次读数需要是0…1023整数，或不提供。')]);
    if (!reads.length) return rejected([diag('TEACHING_READ_MISSING', '还没有学生LIGHT读取事件。')]);
    if (previousLight !== undefined && observed.sample === previousLight) return rejected([diag('TEACHING_READ_UNCHANGED', '这次仍读到同一个值，请先改变环境，再实际读取。', reads.at(-1).nodeId)]);
    return {ok: true, diagnostics: [], observed};
  }
  const firstState = goal === 'on' || goal === 'on-wait-off';
  if (!goal.includes('wait')) {
    if (!writes.length || observed.lastStudentLamp !== firstState) return rejected([diag('TEACHING_OUTPUT_MISMATCH', '学生实际发出的最后一条灯指令还没有产生这次目标状态。', writes.at(-1)?.nodeId)]);
    return {ok: true, diagnostics: [], observed};
  }
  const changes = writes.filter((event, index) => index === 0 || event.value !== writes[index - 1].value);
  if (changes.length !== 2 || changes[0].value !== firstState || changes[1].value !== !firstState) return rejected([diag('TEACHING_SEQUENCE_DIRECTION', '按实际输出顺序看，先保持的状态与后一次动作还没有对上。', changes.at(-1)?.nodeId)]);
  const from = changes[0], to = changes[1], firstIndex = events.indexOf(from), changeIndex = events.indexOf(to);
  const holding = waits.filter(wait => {
    const index = events.indexOf(wait), resume = resumes.find(event => event.nodeId === wait.nodeId && event.atMs === wait.resumeAtMs);
    return wait.durationMs > 0 && index > firstIndex && index < changeIndex && resume && events.indexOf(resume) < changeIndex
      && wait.outputs.LAMP === firstState && resume.outputs.LAMP === firstState && to.atMs > from.atMs;
  });
  if (!holding.length) return rejected([diag('TEACHING_SEQUENCE_WAIT', '两条相反指令之间还没有真实的正数等待；等在最后或同刻开关不能产生保持区间。', to.nodeId)]);
  return {ok: true, diagnostics: [], observed: {...observed, sequence: {from: firstState, to: !firstState, startAtMs: from.atMs, changedAtMs: to.atMs, waits: holding}}};
}
