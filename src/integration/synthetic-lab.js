import {assertRef, canonicalJson, contentDigest, createRef, immutable, SNAPSHOT_VERSION, textDigest} from '../contracts/index.js';

export class LabError extends Error {
  constructor(code, message) { super(message); this.name = 'LabError'; this.code = code; }
}
const fail = (code, message) => { throw new LabError(code, message); };

/** In-memory fixture repository, NOT authentication or a production API.
 * The trusted adapter is injected by the integrator, never by a student request.
 */
export function createSyntheticLab({evaluate, rewardAmount = 100, now = () => new Date().toISOString()} = {}) {
  if (typeof evaluate !== 'function') throw new TypeError('需要确定性客户测试适配器');
  if (!Number.isSafeInteger(rewardAmount) || rewardAmount < 1) throw new TypeError('合成奖励必须为正整数');
  const sessions = new WeakMap(), projects = new Map(), snapshots = new Map(), evidence = new Map(), ledger = [];
  let sequence = 0;
  const id = prefix => `${prefix}-${++sequence}`;
  function owner(session) { const student = sessions.get(session); if (!student) fail('SESSION_REQUIRED', '需要本地合成员工会话'); return student; }
  function project(session, projectId) {
    const student = owner(session), value = projects.get(projectId);
    if (!value || value.ownerStudentId !== student.id) fail('NOT_FOUND', '找不到本人作品');
    return value;
  }
  function snapshot(session, snapshotId) {
    const value = snapshots.get(snapshotId);
    if (!value || value.ownerStudentId !== owner(session).id) fail('NOT_FOUND', '找不到本人快照');
    return value;
  }
  function assertCurrent(session, snapshotId) {
    const value = snapshot(session, snapshotId);
    if (project(session, value.projectId).snapshotId !== snapshotId) fail('STALE_SNAPSHOT', '作品已修改，请重新提交和测试');
    return value;
  }
  return Object.freeze({
    mode: 'synthetic-local',
    enroll(nickname) {
      if (typeof nickname !== 'string' || !nickname.trim() || nickname.trim().length > 24) fail('INVALID_NICKNAME', '昵称需要 1–24 个字符');
      const student = immutable({id: id('synthetic-student'), nickname: nickname.trim(), synthetic: true});
      const session = Object.freeze({mode: 'synthetic-local'}); sessions.set(session, student);
      return {session, student};
    },
    createProject(session, taskRef) {
      assertRef(taskRef); const student = owner(session);
      const value = immutable({id: id('project'), ownerStudentId: student.id, taskRef, revision: 0, snapshotId: null, synthetic: true});
      projects.set(value.id, value); return value;
    },
    getProject(session, projectId) { return project(session, projectId); },
    async submit(session, projectId, {expectedRevision, ...work}) {
      const before = project(session, projectId);
      if (before.revision !== expectedRevision) fail('REVISION_CONFLICT', '作品已在另一处更新，请先重新读取');
      const permitted = ['requirementRef','deviceProfileRef','testSuiteRef','manualRef','languageProfileRef','program','wiring','source','requirementCard','phase'];
      if (Object.keys(work).some(k => !permitted.includes(k))) fail('UNSUPPORTED_FIELD', '提交包含不可写字段');
      for (const key of ['requirementRef','deviceProfileRef','testSuiteRef','manualRef','languageProfileRef']) assertRef(work[key]);
      if (!['blocks','short-cpp'].includes(work.phase) || typeof work.source !== 'string' || !work.program || !work.wiring || !work.requirementCard) fail('INVALID_WORK', '缺少阶段或作品内容');
      const captured = immutable(work); // capture before awaiting; caller cannot alter an in-flight submission
      const programRef = await createRef('program', SNAPSHOT_VERSION, captured.program);
      const wiringRef = await createRef('wiring', SNAPSHOT_VERSION, captured.wiring);
      const sourceDigest = await textDigest(captured.source);
      const binding = {taskRef: before.taskRef, ...captured, programRef, wiringRef, sourceDigest};
      const digest = await contentDigest(binding);
      if (project(session, projectId).revision !== expectedRevision) fail('REVISION_CONFLICT', '作品已在另一处更新，请先重新读取');
      const value = immutable({schemaVersion: SNAPSHOT_VERSION, id: id('snapshot'), projectId, ownerStudentId: before.ownerStudentId, revision: before.revision + 1, createdAt: now(), synthetic: true, digest, ...binding});
      snapshots.set(value.id, value);
      projects.set(projectId, immutable({...before, revision: value.revision, snapshotId: value.id}));
      return value;
    },
    getSnapshot(session, snapshotId) { return snapshot(session, snapshotId); },
    async runTests(session, snapshotId) {
      const value = assertCurrent(session, snapshotId);
      const report = await evaluate(value);
      assertCurrent(session, snapshotId);
      if (!report || typeof report.passed !== 'boolean' || !Array.isArray(report.cases) || !report.cases.length || report.cases.some(c => typeof c.passed !== 'boolean') || report.passed !== report.cases.every(c => c.passed)) fail('INVALID_REPORT', '测试适配器没有提供一致的逐项证据');
      const record = immutable({id: id('test'), kind: 'software-test', snapshotId, snapshotDigest: value.digest, ownerStudentId: value.ownerStudentId, createdAt: now(), synthetic: true, report});
      evidence.set(record.id, record); return record;
    },
    listEvidence(session, projectId) {
      const p = project(session, projectId);
      return immutable([...evidence.values()].filter(e => snapshots.get(e.snapshotId).projectId === p.id).map(e => ({...e, current: p.snapshotId === e.snapshotId})));
    },
    settleSoftwareDemo(session, {evidenceId}) {
      const student = owner(session), record = evidence.get(evidenceId);
      if (!record || record.ownerStudentId !== student.id) fail('NOT_FOUND', '找不到本人测试证据');
      const value = assertCurrent(session, record.snapshotId);
      if (!record.report.passed || value.phase !== 'short-cpp') fail('SOFTWARE_NOT_PASSED', '需要当前轻代码客户测试通过证据');
      const key = canonicalJson({studentId: student.id, taskId: value.taskRef.id, kind: 'synthetic-software-income'});
      const existing = ledger.find(e => e.idempotencyKey === key);
      if (existing) return existing;
      const event = immutable({id: id('ledger'), studentId: student.id, kind: 'income', amount: rewardAmount, reason: '本地软件闭环演示收入（候选规则）', sourceEvidenceId: record.id, idempotencyKey: key, createdAt: now(), synthetic: true});
      ledger.push(event); return event;
    },
    getLedger(session) {
      const student = owner(session), events = ledger.filter(e => e.studentId === student.id);
      return immutable({synthetic: true, policyStatus: 'candidate', income: events.reduce((sum,e) => sum + (e.kind === 'income' ? e.amount : 0), 0), balance: events.reduce((sum,e) => sum + e.amount, 0), events});
    },
    hardwareStatus() { return immutable({compilation: 'not-implemented', upload: 'not-implemented', safetyApproval: 'not-verified', hardwareAcceptance: 'not-verified'}); },
  });
}
