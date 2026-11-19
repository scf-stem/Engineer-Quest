import React, { useRef, useState } from 'react';
import { ActionButton, Dialog, Notice } from '../components.jsx';
import { FIRST_ORDER_ART } from '../art.js';
import { StoryFigure } from '../StoryFigure.jsx';
import { ExplorationStation } from './ExplorationStation.jsx';
import { DialoguePanel } from './DialoguePanel.jsx';
import { InspectionPanel } from './InspectionPanel.jsx';
import { DEMO_EMPLOYEE } from '../fixtures.js';

const GOAL = {id: 'synthetic-understand-order', title: '读懂自动灯委托，保存我的中文方案卡', detail: '先看客户的场景，再用中文说清输入、判断、输出与持续工作。', status: 'visual'};
const LINES = ['新委托到了。先看看客户遇到了什么，再想一想装置应该怎样回应。', '灯已经亮着，周围又变亮了，你希望它怎么办？'];
const FEEDBACK = {
  open_mail: '委托已展开：先看看客户要解决什么。',
  talk_requirements_npc: '先说你的想法，方案可以再改。',
  inspect_kit: '已打开工具箱。查看用途即可，正式接线稍后按手册完成。',
  open_manual: '手册说明已打开；正式节号由课程内容提供。',
  request_help: '求助说明已打开；当前没有发送请求或加入教师队列。',
};

/** All state below is synthetic visual state; it never changes GOAL or evidence. */
export function AdventureDemo() {
  const [overlay, setOverlay] = useState(null);
  const [line, setLine] = useState(0);
  const [item, setItem] = useState('sensor');
  const [feedback, setFeedback] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const originFocus = useRef(null);
  function action(actionId) {
    if (!overlay) originFocus.current = document.activeElement;
    setFeedback(FEEDBACK[actionId] || '已选中工具入口。当前仅展示导航，不运行程序或修改作品。');
    setLine(0);
    setOverlay(actionId);
  }
  const close = () => {setOverlay(null); requestAnimationFrame(() => {if (originFocus.current?.isConnected) originFocus.current.focus();});};
  return <ExplorationStation employee={DEMO_EMPLOYEE} goal={GOAL} onAction={action} onHome={() => setFeedback('已回到个人工位，保留本次探索设置。')} feedback={feedback} reduceMotion={reduceMotion} onReduceMotionChange={setReduceMotion} showMarkers={showMarkers} onShowMarkersChange={setShowMarkers} actionStates={{open_code: {disabled: true, reason: '视觉小样：示例前置条件尚未满足'}}}>
    {overlay === 'talk_requirements_npc' && <DialoguePanel text={LINES[line]} onContinue={line === 0 ? () => setLine(1) : undefined} continueLabel="接着聊" onOpenMail={() => action('open_mail')} onClose={close}/>}
    {overlay === 'inspect_kit' && <InspectionPanel selectedId={item} onSelectItem={setItem} onOpenManual={() => action('open_manual')} onClose={close}/>}
    {overlay === 'open_mail' && <Dialog title="校园自动灯委托" onClose={close} className="eq-adventure-mail"><p className="eq-eyebrow">客户的场景 / 故事示意</p><StoryFigure asset={FIRST_ORDER_ART.customerScene}/><p>校园里有一处桌面，环境暗时需要亮起 LED，环境变亮时关闭，并持续观察变化。这一单先做低压演示，不接市电。</p><Notice>先用中文描述你的方案。查看邮件不表示需求评审通过，也不产生收入。</Notice><a className="eq-button eq-button--primary" href="./preview.html">查看中文方案界面 →</a></Dialog>}
    {overlay === 'open_manual' && <Dialog title="随时翻一翻工程手册" onClose={close}><p>先找与你的问题有关的内容：输入与传感器、输出与限流、开发板与 IO。</p><Notice>此处为手册入口小样。接入后按课程实际节号打开，当前不冒充已冻结的手册。</Notice><ActionButton variant="paper" onClick={() => action('inspect_kit')}>回到工具箱</ActionButton></Dialog>}
    {overlay === 'request_help' && <Dialog title="需要时，让老师搭把手" onClose={close}><p>把当前步骤和遇到的现象告诉老师，课堂中也可以举手。</p><Notice>当前只展示说明，尚未发送求助请求或建立教师队列。</Notice></Dialog>}
    {overlay && !['talk_requirements_npc','inspect_kit','open_mail','open_manual','request_help'].includes(overlay) && <Dialog title="在操作工位继续" onClose={close}><p>当前为场景探索小样。真实接线、编辑、测试和提交使用实际工作界面的对应按钮。</p><a className="eq-button eq-button--primary" href="./preview.html">查看标准布局 →</a><Notice>本次操作只选择了入口，没有运行测试、发放收入或推进课程阶段。</Notice></Dialog>}
  </ExplorationStation>;
}
