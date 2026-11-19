/** Read-only explanations of the existing repeat-read observation; never issues facts. */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const customerCheck = freeze({
  responseWithinMs: 200,
  independent: true,
  evaluated: false,
  message: '本次核对的是三个学习观察窗口。正式客户测试另按公开的200ms响应时限及稳定区间末尾检查；即使本次学习观察未取得，也不能据此断定客户响应超时。',
});
// Mirrors the current A action's literal scene and frame.atMs + 99 comparison.
// A change to that criterion requires a separate policy review, not a diagnostic fallback.
const criterion = freeze({
  id: 'repeat-read-windows/1',
  actionId: 'repeat-read',
  title: '本次在每个观察窗口末尾核对灯态',
  description: '输入在0、100、200ms依次变化；本步在99、199、299ms查看每段的新读取和灯态。这是学习观察，不是正式客户的200ms响应测试。',
  windows: [
    {fromMs: 0, toMs: 99, checkedAtMs: 99, input: 150, expectedLamp: true},
    {fromMs: 100, toMs: 199, checkedAtMs: 199, input: 850, expectedLamp: false},
    {fromMs: 200, toMs: 299, checkedAtMs: 299, input: 180, expectedLamp: true},
  ],
  customerCheck,
});

/** Can be displayed before running, so the observation's tighter windows are visible. */
export function getProgramPracticeCriterion(actionId = 'repeat-read') {
  return actionId === 'repeat-read' ? criterion : null;
}

const note = (code, message, nodeId) => ({code, severity: 'info', message, ...(typeof nodeId === 'string' ? {nodeId} : {})});
const lampWord = value => value === true ? '亮' : value === false ? '灭' : '未记录';
function eventSummary(item) {
  if (!item) return null;
  const {event, eventIndex} = item;
  return {eventIndex, atMs: event.atMs, step: event.step, kind: event.kind,
    ...(typeof event.nodeId === 'string' ? {nodeId: event.nodeId} : {}),
    ...(typeof event.port === 'string' ? {port: event.port, value: event.value} : {})};
}
function sceneMatches(timeline) {
  return Array.isArray(timeline) && timeline.length === criterion.windows.length && timeline.every((frame, index) => {
    const expected = criterion.windows[index];
    return object(frame) && frame.atMs === expected.fromMs && object(frame.signals)
      && Object.keys(frame.signals).length === 1 && frame.signals.LIGHT === expected.input;
  });
}
function traceIsOrdered(simulation) {
  if (!Array.isArray(simulation.events) || !simulation.events.length || simulation.events[0]?.kind !== 'initial'
    || !Number.isInteger(simulation.completedThroughMs) || simulation.completedThroughMs < 0) return false;
  return simulation.events.every((event, index, events) => object(event) && Number.isInteger(event.atMs) && event.atMs >= 0
    && event.atMs <= simulation.completedThroughMs && Number.isInteger(event.step) && event.step >= 0
    && object(event.outputs) && typeof event.outputs.LAMP === 'boolean'
    && (index === 0 || event.atMs >= events[index - 1].atMs && event.step >= events[index - 1].step));
}
function unavailable(simulation, code, message) {
  return freeze({kind: 'program-practice-diagnostics', actionId: 'repeat-read', status: 'unavailable', criterion,
    simulationStatus: simulation.status ?? 'unknown', windows: [], summary: message,
    nextAction: '保留这份原记录，重新运行当前暗→亮→暗观察，再查看对应窗口。',
    customerCheck, diagnostics: [note(code, message)]});
}
function describeWindow(window, indexed, completedThroughMs) {
  const prefix = indexed.filter(item => item.event.atMs <= window.checkedAtMs);
  const lastRead = prefix.findLast(item => item.event.kind === 'read' && item.event.port === 'LIGHT');
  const matchingRead = prefix.find(item => item.event.kind === 'read' && item.event.port === 'LIGHT'
    && item.event.atMs >= window.fromMs && item.event.value === window.input);
  const lastWrite = prefix.findLast(item => item.event.kind === 'write' && item.event.port === 'LAMP');
  // Original event order is essential: write100 executes before the next cycle's read100.
  const lastReadBeforeWrite = lastWrite ? indexed.slice(0, lastWrite.eventIndex)
    .findLast(item => item.event.kind === 'read' && item.event.port === 'LIGHT') : null;
  const covered = completedThroughMs >= window.checkedAtMs;
  const state = prefix.at(-1)?.event.outputs.LAMP;
  const actualLamp = covered && typeof state === 'boolean' ? state : null;
  const actualOutputSource = !covered ? 'unknown' : lastWrite ? 'write' : prefix.some(item => item.event.kind === 'initial') ? 'initial' : 'unknown';
  const readObserved = covered ? !!matchingRead : null;
  const outputMatches = covered ? actualLamp === window.expectedLamp : null;
  const reasons = [];
  if (!covered) reasons.push(note('WINDOW_NOT_COVERED', `实际轨迹只到${completedThroughMs}ms，尚未覆盖${window.checkedAtMs}ms的观察点。`));
  else {
    if (!readObserved) reasons.push(note('READ_NOT_OBSERVED_IN_WINDOW', `${window.fromMs}–${window.toMs}ms内尚无读到${window.input}的LIGHT事件。`, lastRead?.event.nodeId));
    if (!outputMatches) {
      if (!lastWrite) reasons.push(note('NO_WRITE_BEFORE_CHECK', `${window.checkedAtMs}ms前还没有LAMP写入；看到的是初始灯态，不能把它当成一次输出指令。`));
      else if (lastRead && lastRead.eventIndex > lastWrite.eventIndex) reasons.push(note('OUTPUT_TRAILS_CURRENT_READ', `已经在${lastRead.event.atMs}ms读到${lastRead.event.value}，但末次灯写入发生在这次读取之前，仍为${lampWord(lastWrite.event.value)}。`, lastWrite.event.nodeId));
      else reasons.push(note('OUTPUT_MISMATCH_AT_CHECK', `${window.checkedAtMs}ms的实际灯态为${lampWord(actualLamp)}，本段观察期望为${lampWord(window.expectedLamp)}。`, lastWrite.event.nodeId));
    }
  }
  let explanation;
  if (!covered) explanation = reasons[0].message;
  else {
    const reading = lastRead ? `最近一次在${lastRead.event.atMs}ms读到${lastRead.event.value}` : '尚无LIGHT读取事件';
    const writing = lastWrite ? `末次在${lastWrite.event.atMs}ms写${lampWord(lastWrite.event.value)}` : '尚无LAMP写入，灯态来自初始状态';
    const prior = lastWrite && lastReadBeforeWrite ? `；这条写入之前最近的读取是${lastReadBeforeWrite.event.atMs}ms的${lastReadBeforeWrite.event.value}` : '';
    explanation = `${reading}；${writing}${prior}。在${window.checkedAtMs}ms检查时灯${lampWord(actualLamp)}，本段期望${lampWord(window.expectedLamp)}。`;
  }
  return {...window, covered, lastRead: eventSummary(lastRead), matchingRead: eventSummary(matchingRead),
    lastWrite: eventSummary(lastWrite), lastReadBeforeWrite: eventSummary(lastReadBeforeWrite),
    actualLamp, actualOutputSource, readObserved, outputMatches, reasons, explanation};
}

/** Accepts a recorded learningAction {request,result}; no executing, sorting, or state writes. */
export function explainProgramPracticeResult(action) {
  if (action?.request?.actionId !== 'repeat-read') return null;
  const value = action.result?.value, simulation = value?.simulation;
  if (!object(simulation) || !Array.isArray(simulation.events) || !simulation.events.length) return null;
  if (value.actionId !== 'repeat-read' || !sceneMatches(simulation.inputTimeline)
    || value.observation?.inputTimeline && !sceneMatches(value.observation.inputTimeline)) {
    return unavailable(simulation, 'PRACTICE_SCENE_UNAVAILABLE', '这份旧记录的输入时间线不匹配当前三段学习观察，未套用99、199、299ms的窗口结论。');
  }
  if (!traceIsOrdered(simulation)) return unavailable(simulation, 'PRACTICE_TRACE_UNAVAILABLE', '这份记录缺少完整、有序的真实事件，不能推断同一毫秒内读取与写出的先后。');
  const indexed = simulation.events.map((event, eventIndex) => ({event, eventIndex}));
  const windows = criterion.windows.map(window => describeWindow(window, indexed, simulation.completedThroughMs));
  const mismatches = windows.filter(window => window.covered && (!window.readObserved || !window.outputMatches));
  const failedAction = action.result.ok !== true;
  const partial = simulation.status !== 'completed' || windows.some(window => !window.covered);
  const trails = mismatches.some(window => window.readObserved && window.reasons.some(reason => reason.code === 'OUTPUT_TRAILS_CURRENT_READ' || reason.code === 'NO_WRITE_BEFORE_CHECK'));
  const missingRead = mismatches.some(window => !window.readObserved);
  const summary = failedAction ? '这次动作返回失败；下表只还原记录里已发生的事件，不能把窗口比较当作完成结论。请先查看原始诊断。'
    : partial ? '这次运行没有完整覆盖学习观察；未到达的取样时刻不推断灯态。请先查看实际运行错误。'
    : mismatches.length ? `本次在99、199、299ms核对的学习观察中，有${mismatches.length}个窗口的读取或灯态未对上。${trails ? '能看到新读取，但部分对应写出晚于观察点。' : ''}这不是正式客户的200ms响应结论，不能据此断定客户超时。`
    : '本次记录在99、199、299ms能看到各段读取与对应灯态。这是学习观察的事实说明；正式客户的200ms响应要求仍须独立测试。';
  const nextAction = failedAction || partial ? '保留作品，先查看这次真实运行错误，再重新运行；不要把未覆盖的时间点当成已观察。'
    : trails ? '看看取得新读数后到判断、写出之间经过了什么；让这段间隔缩短，再运行本次观察。'
    : missingRead ? '环境改变后需要再次实际读取；检查读取发生的时刻，再运行本次观察。'
    : mismatches.length ? '对照这段输入、实际分支和末次写出，定位差异后再运行。'
    : '保留这些实际事件，继续按当前学习步骤操作；客户测试仍单独核对。';
  return freeze({kind: 'program-practice-diagnostics', actionId: 'repeat-read', status: 'available', criterion,
    simulationStatus: simulation.status ?? 'unknown', windows, summary, nextAction, customerCheck,
    diagnostics: structuredClone([...(failedAction && Array.isArray(action.result.diagnostics) ? action.result.diagnostics : []), ...(Array.isArray(simulation.diagnostics) ? simulation.diagnostics : [])])});
}
