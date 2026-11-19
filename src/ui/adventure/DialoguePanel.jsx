import React from 'react';
import { ActionButton, Dialog } from '../components.jsx';
import { FIRST_ORDER_ART } from '../art.js';

export function DialoguePanel({ speaker = '林工', role = '需求负责人', text, portraitSrc = FIRST_ORDER_ART.mentor.src, onClose, onContinue, continueLabel = '继续聊聊', onOpenMail }) {
  return <Dialog title={`和${speaker}聊一聊`} onClose={onClose} className="eq-dialogue-panel"><div className="eq-dialogue-layout"><div className="eq-dialogue-portrait"><img src={portraitSrc} alt={`${speaker}的原创角色立绘`}/></div><div className="eq-dialogue-content"><p className="eq-dialogue-mode">静态剧情对话 / 本地演示</p><h3>{speaker}<span>{role}</span></h3><p className="eq-dialogue-text" key={text}>{text}</p><p className="eq-dialogue-aside">先说你的想法，方案可以再改。</p><div className="eq-dialogue-actions">{onContinue && <ActionButton onClick={onContinue} icon="arrow">{continueLabel}</ActionButton>}{onOpenMail && <ActionButton variant="paper" onClick={onOpenMail}>查看客户委托</ActionButton>}</div></div></div></Dialog>;
}
