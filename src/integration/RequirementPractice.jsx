import React, {useEffect, useRef, useState} from 'react';
import {Notice} from '../ui/index.js';
import {ChangeArtifactStage} from './ChangeArtifactStage.jsx';
import {ClientDesk} from './ClientDesk.jsx';
import {RequirementStageChoices, RequirementStageHelp, RequirementStagePortrait, useRequirementFocus} from './RequirementStage.jsx';
import {freshRequirementStage, requirementResponseIds, requirementStageKey, requirementStageRecord, restoreRequirementStage} from './requirement-stage-display.js';
import {requirementReply, requirementNext} from './requirement-dialogue.js';
import './learning-practice.css';
import './requirement-stage.css';

const settings = {
  'req-light-input': ['窗边与阴影', '把能跟着环境变化的信息交给林工'],
  'req-dark-action': ['有人遮住了窗光', '用控制卡，演一遍你想让灯做的事'],
  'req-bright-action': ['遮挡移开之后', '刚才的灯还亮着，现在由你决定下一次动作'],
  'req-read-again': ['同一个下午，光又变了', '沿着三个时刻，安排装置接下来怎样工作'],
  'req-base-equality': ['刚好落在线上', '把450放到边界上，再给灯一个明确动作'],
  'req-transfer-sequence': ['把方案带到另一张桌子', '沿着仪表，预测灯光的顺序'],
  'change-middle': ['客户把便签挪到了600', '拿500试想一次，新旧作品会在哪里不同'],
  'change-equality': ['新的边界，熟悉的方法', '让600落在线上，再预测灯的动作'],
  'change-code-focus': ['从装置走回自己的程序', '在本人作品里找到这一次要改的比较'],
  'change-evidence': ['把修改带回客户桌面', '选一次真正能说明当前作品变化的检查'],
};
const reviewFor = (state, phase) => phase === 'short-cpp' ? state.facts.changeRequirements : state.facts.requirements;
const succeeded = response => response && !['needs-help', 'needs-retry', 'invalid', 'stale'].includes(response.summary?.status);

/** D evaluates public response IDs. All state here describes only what is on screen. */
export function RequirementPractice(props) {
  return <RequirementSession key={`${props.state.activeAttemptId}:${props.phase ?? 'blocks'}`} {...props}/>;
}

function RequirementSession({workspace, state, phase = 'blocks', onNavigate, onOpenManual, guided = false, focusSuspended = false}) {
  const review = reviewFor(state, phase), draftKey = `requirement-draft:${phase}`;
  const [display, setDisplay] = useState(() => restoreRequirementStage(state, phase, guided));
  const displayRef = useRef(display), root = useRef(null), submitLock = useRef(false), pendingSubmission = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [helpOpen, setHelpOpen] = useState(false);
  const [explanation, setExplanation] = useState(() => {
    const draft = state.attempt?.learning?.[draftKey];
    return draft?.checkpointId === display.checkpointId ? draft.explanation ?? '' : '';
  });
  const [ownNode, setOwnNode] = useState(state.attempt?.learning?.['story-comparison-selection'] ?? null);
  const rawBinding = JSON.stringify(state.attempt?.reviews?.[phase === 'short-cpp' ? 'change' : 'base']?.binding);
  const bindingRef = useRef(rawBinding);
  useEffect(() => {
    if (bindingRef.current === rawBinding) return;
    bindingRef.current = rawBinding;
    const next = restoreRequirementStage(state, phase, guided);
    displayRef.current = next; setDisplay(next); setError('');
  }, [rawBinding]);
  const shown = display.challenge, response = display.response, success = succeeded(response);
  const artifact = phase === 'short-cpp' && ['change-code-focus', 'change-evidence'].includes(shown?.checkpointId);
  const [place, invitation] = settings[shown?.checkpointId] ?? ['和林工继续这份委托', '把刚才的想法带到自己的作品'];
  const suspended = focusSuspended || helpOpen;
  const target = error ? 'recovery' : busy ? 'submitting' : response ? success ? 'continue' : 'feedback' : !shown ? 'continue' : display.cue;
  const focusProps = useRequirementFocus(root, target, suspended);
  const disabled = busy || state.facts.pending || !state.facts.claimed;
  const currentState = () => workspace.getState?.() ?? state;
  function show(next) { displayRef.current = next; setDisplay(next); return next; }
  async function persist(next) {
    await workspace.saveLearning({[requirementStageKey(phase)]: requirementStageRecord(currentState(), phase, next)});
  }
  function update(next) { show(next); void persist(next).catch(e => setError(e.message)); }
  function observe(observation, desk) { update({...displayRef.current, desk, observation, cue: 'reading'}); }
  function nextLine() {
    update({...displayRef.current, cue: display.cue === 'explain' && shown.checkpointId === 'req-light-input' ? 'observe' : 'choices'});
  }
  async function selectOwnNode(link) {
    setOwnNode(link);
    try { await workspace.saveLearning({'story-comparison-selection': {nodeId: link.nodeId, label: link.label, code: link.code}}); return true; }
    catch (e) { setError(e.message); return false; }
  }
  async function executeSubmission(request) {
    const {captured, option, intent, attempt, before} = request;
    const result = await workspace.reviewRequirements({phase, attempt});
    if (!result.accepted) {
      show({...before, cue: 'choices', handoff: 'continued', submission: null});
      throw new Error(result.summary?.diagnostic?.message || '这次回应还没有保存，再看看当前这幕。');
    }
    const reply = {optionId: attempt.optionId, optionLabel: option?.label ?? '林工，我还没想明白。', summary: result.summary};
    const feedback = show({...displayRef.current, challenge: captured, checkpointId: captured.checkpointId,
      response: reply, handoff: 'feedback', cue: 'feedback'});
    // Preserve the existing own-comparison -> explicit mapping -> code intent.
    if (guided && phase === 'short-cpp' && succeeded(reply) && result.summary?.readyToAdvance && option?.optionId === 'new-current-suite' && intent?.mappingNodeId) {
      const mapped = await workspace.performLearningAction({phase, actionId: 'code-mapping', inputs: {nodeId: intent.mappingNodeId}});
      if (!mapped.ok || !mapped.observations?.length) setError('刚才的比较还需要在当前作品中重新定位。进入代码工位后，再点一次本人比较。');
    }
    await persist(feedback);
    await workspace.saveLearning({[draftKey]: {checkpointId: captured.checkpointId, explanation: ''}});
    pendingSubmission.current = null; setExplanation('');
  }
  async function answer(option, intent) {
    if (disabled || submitLock.current || !shown || response) return;
    submitLock.current = true; setBusy(true); setError('');
    const before = displayRef.current;
    let lamp = before.desk.lamp;
    if (['lamp-on', 'now-on'].includes(option?.optionId)) lamp = true;
    if (['lamp-off', 'same-off'].includes(option?.optionId)) lamp = false;
    // An absent action retains the actual lamp state.
    const attempt = {responseId: crypto.randomUUID(), checkpointId: shown.checkpointId,
      optionId: option?.optionId ?? 'not-sure', confidence: option ? 'ready-to-try' : 'need-help', explanation};
    const pending = show({...before, desk: {...before.desk, lamp}, cue: 'submitting', handoff: 'submitting', response: null,
      priorResponseIds: requirementResponseIds(currentState(), phase), submission: {...attempt, optionLabel: option?.label ?? '林工，我还没想明白。'}});
    const request = {captured: shown, option, intent, attempt, before}; pendingSubmission.current = request;
    try {
      // Host observes this before D can publish readyToAdvance.
      await persist(pending);
      await executeSubmission(request);
    } catch (e) { setError(e.message); }
    finally { submitLock.current = false; setBusy(false); }
  }
  async function continueScene() {
    if (disabled || submitLock.current) return;
    submitLock.current = true; setBusy(true); setError('');
    try {
      const latest = reviewFor(currentState(), phase);
      const next = success ? freshRequirementStage(latest?.challenge, guided, latest?.current)
        : {...displayRef.current, response: null, submission: null, handoff: 'continued', cue: display.observation ? 'choices' : shown.checkpointId === 'req-light-input' ? 'observe' : 'choices'};
      await persist(next); show(next);
      if (success && latest?.readyToAdvance) await onNavigate?.(phase === 'blocks' ? 'wiring' : 'code');
    } catch (e) { setError(e.message); }
    finally { submitLock.current = false; setBusy(false); }
  }
  async function recover() {
    if (busy) return; setBusy(true); setError(''); submitLock.current = true;
    try {
      if (currentState().storage?.status === 'unsaved') await workspace.retrySave?.();
      if (pendingSubmission.current) await executeSubmission(pendingSubmission.current);
      else await persist(displayRef.current);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); submitLock.current = false; }
  }
  async function restart() {
    setBusy(true); setError('');
    try { await workspace.resetRequirementReview(phase); const latest = reviewFor(currentState(), phase); const next = freshRequirementStage(latest?.challenge, guided, latest?.current); await persist(next); show(next); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const observationLine = display.observation && `刚才${display.observation.step ? `走到第 ${display.observation.step} 个时刻` : '移动遮挡'}，光照表从 ${display.observation.previous} 变成 ${display.observation.light}。${shown?.checkpointId === 'req-light-input' ? '日期没变，读数变了。' : '看看此刻读数和灯，再决定怎样回应。'}`;
  const words = response ? success ? requirementReply(shown.checkpointId)[0] : response.summary?.diagnostic?.message ?? '先停在这里，我们拆开这一小步。'
    : display.cue === 'reading' ? artifact ? `这是本人作品里“${display.previewNode?.label ?? '这处动作'}”对应的代码。看看它实际做什么，再回应客户。` : observationLine
    : display.cue === 'observe' ? '试着遮住一点窗光，看看光照表怎样变化。'
    : display.cue === 'choices' ? invitation
    : guided && shown?.checkpointId === 'change-evidence' ? '旧回信说明旧约定下的作品通过了。代码还没改，我们先确定怎样把修改带回客户桌面。'
    : shown?.scene?.description ?? (phase === 'blocks' ? '明暗、边界和连续变化都看过了。来，把这个想法做成装置。' : '新边界已经说清了。回到本人作品，改比较，再让客户试新版。');
  const help = {help: response?.summary?.guidance?.tryThis ?? review?.guidance?.tryThis ?? '先看眼前读数和灯，再用下面的卡回应。不确定可以请求一个小观察，作品会留在这里。',
    why: guided && shown?.checkpointId === 'change-evidence' ? words : shown?.scene?.description,
    manualSection: shown?.manualSection ?? (phase === 'blocks' ? '06.1' : '08.1')};
  if (!state.facts.claimed) return <Notice>先领取桌上的委托，再和林工一起看。</Notice>;
  return <section ref={root} className="eq-learning eq-requirement-practice eq-requirement-stage" aria-label={phase === 'blocks' ? '客户需求情境练习' : '客户变更情境练习'}
    data-checkpoint-id={shown?.checkpointId ?? 'complete'} data-focus-target={suspended ? 'suspended' : target} data-focus-intent={target} data-stage-response={response ? success ? 'accepted' : 'retry' : undefined}>
    <header className="eq-stage-heading"><h2><span>{phase === 'blocks' ? '校园委托' : '客户新来信'}{display.current && ` ${display.current.number} / ${display.current.total}`} / {place}</span></h2><nav aria-label="当前情境帮助"><button type="button" onClick={() => setHelpOpen(true)}>求助</button>{onOpenManual && <button type="button" onClick={() => onOpenManual(help.manualSection)}>一起翻手册 §{help.manualSection} ↗</button>}</nav></header>
    <div className={`eq-stage-scene ${artifact ? 'has-artifact' : ''}`}>
      <div className="eq-stage-world">{shown ? artifact ? <div className="eq-stage-artifact" {...focusProps('reading')}><ChangeArtifactStage key={shown.checkpointId} area="scene" previewNode={display.previewNode} guided={guided} ownNode={ownNode} state={state} challenge={shown}/></div>
        : <ClientDesk challenge={shown} desk={display.desk} disabled={disabled || !!response} onObserve={observe} focusProps={focusProps}/>
        : <div className="eq-stage-handoff"><strong>{phase === 'blocks' ? '把想法带到电子工位' : '回到自己的作品'}</strong><p>这份委托的情境记录已保留。</p></div>}</div>
      <RequirementStagePortrait/>
    </div>
    <div className="eq-stage-dock">
      {error && <div className="eq-stage-recovery" role="alert" {...focusProps('recovery')}><p>{error}</p><button type="button" disabled={busy} onClick={recover}>重试保存这一步</button></div>}
      <div className="eq-stage-speech" {...focusProps(response && !success ? 'feedback' : 'explain')}><span className="eq-stage-speaker">林工</span><p className="eq-mentor-current-line" role="status">{words}</p>
        {response && !success && <button type="button" data-scene-continue disabled={disabled} onClick={continueScene}>我再操作一下，重新试试</button>}
      </div>
      {busy && <p className="eq-stage-saving" role="status" {...focusProps('submitting')}>正在保存这一次回应，桌面留在刚才的状态……</p>}
      {!response && shown && <>
        {['explain', 'reading'].includes(display.cue) && <button type="button" className="eq-stage-next-line" disabled={disabled} onClick={nextLine}>听林工接着说 ▷</button>}
        {artifact ? <div className="eq-stage-artifact-controls" {...focusProps('choices')}><ChangeArtifactStage key={shown.checkpointId} area="controls" previewNode={display.previewNode} onPreview={node=>update({...displayRef.current,previewNode:node,cue:'reading'})} guided={guided} onSelect={selectOwnNode} ownNode={ownNode} state={state} challenge={shown} disabled={disabled} onAnswer={answer}/></div>
          : <><p className="eq-stage-question">{shown.prompt}</p><RequirementStageChoices challenge={shown} disabled={disabled} onAnswer={answer} focusProps={focusProps}/></>}
      </>}
      {response && success && <div className="eq-stage-feedback" {...focusProps('continue')}><p><span>我刚才选择：</span>{response.optionLabel}</p><button type="button" data-scene-continue disabled={disabled} onClick={continueScene}>{requirementNext(shown.checkpointId, response.summary?.readyToAdvance)}</button></div>}
      {!shown && review?.readyToAdvance && <div className="eq-stage-feedback" {...focusProps('continue')}><button type="button" disabled={disabled} onClick={() => onNavigate?.(phase === 'blocks' ? 'wiring' : 'code')}>继续当前作品 →</button><details><summary>回看约定与记录</summary><p>本版情境已逐项记录，接线、程序和客户测试仍需亲手完成。</p><button type="button" disabled={disabled} onClick={restart}>保留旧回答，重新核对本版</button></details></div>}
      {!shown && !review?.readyToAdvance && <Notice>{review?.diagnostic?.message ?? '这份来信暂时无法打开，原记录保留。'}{['stale', 'invalid'].includes(review?.status) && <button type="button" disabled={disabled} onClick={restart}>开始当前版本的约定</button>}</Notice>}
    </div>
    {helpOpen && <RequirementStageHelp scene={help} disabled={disabled || !!response} onClose={() => setHelpOpen(false)} onManual={onOpenManual} onRequest={() => {setHelpOpen(false); void answer(null);}} explanation={explanation} onExplanation={text => {setExplanation(text); void workspace.saveLearning({[draftKey]: {checkpointId: shown?.checkpointId, explanation: text}}).catch(e => setError(e.message));}}/>}
  </section>;
}
