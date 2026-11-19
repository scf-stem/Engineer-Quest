import React, {useEffect, useLayoutEffect, useState} from 'react';
import {Dialog} from '../ui/components.jsx';

/** Passive outlines never intercept a click or darken the light experiment. */
export function useRequirementFocus(root, target, suspended) {
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    if (suspended) { setVisible(false); return; }
    const element = root.current?.querySelector(`[data-stage-anchor="${target}"]`);
    if (!element) { setVisible(false); return; }
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting === true), {threshold: .1});
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, target, suspended]);
  useEffect(() => {
    if (suspended) return;
    const element = root.current?.querySelector(`[data-stage-anchor="${target}"]`);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.bottom > window.innerHeight || rect.top < 0) element.scrollIntoView({block: 'nearest', behavior: 'instant'});
  }, [root, target]);
  return anchor => ({'data-stage-anchor': anchor, 'data-current-focus': !suspended && visible && target === anchor ? 'true' : undefined});
}

export function RequirementStagePortrait() {
  return <figure className="eq-stage-mentor" aria-label="林工在桌边陪你观察"><img src="/art/npc-tutorial/lin-mentor-v2.webp" alt="林工"/><figcaption>林工 <small>研发部 / 你的带教</small></figcaption></figure>;
}

export function RequirementStageHelp({scene, onClose, onManual, onRequest, explanation, onExplanation, disabled}) {
  const [topic, setTopic] = useState('help');
  return <Dialog className="eq-game-modal eq-stage-help" title="和林工一起看这一步" onClose={onClose}>
    <p>{topic === 'why' ? scene.why ?? scene.help : scene.help}</p>
    <div className="eq-stage-help-topics"><button type="button" onClick={() => setTopic('help')}>再讲一遍</button><button type="button" onClick={() => setTopic('why')}>为什么这样做？</button></div>
    <label>告诉林工卡在哪里（选填）<textarea rows={3} maxLength={1500} value={explanation} onChange={event => onExplanation(event.target.value)} placeholder="说说刚才看到了什么，卡在哪个动作。"/></label>
    <button type="button" disabled={disabled} onClick={onRequest}>林工，我需要一个小观察</button>
    {onManual && scene.manualSection && <button type="button" onClick={() => {onClose(); onManual(scene.manualSection);}}>一起翻手册 §{scene.manualSection} ↗</button>}
  </Dialog>;
}

export function RequirementStageChoices({challenge, disabled, onAnswer, focusProps}) {
  const options = challenge.options.filter(item => item.optionId !== 'not-sure');
  const labels = {'current-light': '当前光照读数', calendar: '今天的日期', 'old-light': '开机时的旧便签'};
  return <div className="eq-stage-choices" role="group" aria-label="把想法演给林工看" {...focusProps('choices')}>
    {options.map(option => <button type="button" key={option.optionId} data-option-id={option.optionId} disabled={disabled} onClick={() => onAnswer(option)}>
      {labels[option.optionId] ?? option.label}
    </button>)}
  </div>;
}
