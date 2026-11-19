import React from 'react';
import { ActionButton, Dialog } from '../components.jsx';
import { FIRST_ORDER_ART } from '../art.js';

export const SYNTHETIC_KIT_ITEMS = [
  {id: 'sensor', title: '光敏模块', category: '输入', description: '把环境光照变成程序可以读取的信息。读数的明暗方向、范围与阈值，需要按实际器件校准。', manualLabel: '输入与传感器 · 正式节号待接入'},
  {id: 'led', title: 'LED', category: '输出', description: '用亮起和熄灭表达程序的决定。真实 LED 有极性，并且需要限流元件；先查手册，再按规范接线。', manualLabel: '输出与限流 · 正式节号待接入'},
  {id: 'board', title: '开发板', category: '控制', description: '读取输入、执行程序、控制输出。用户已选 Arduino Uno 家族；具体型号、引脚与供电要求以实际设备资料为准。', manualLabel: '开发板与 IO · 正式节号待接入'},
];

export function InspectionPanel({ items = SYNTHETIC_KIT_ITEMS, selectedId, onSelectItem, onOpenManual, onClose, art = FIRST_ORDER_ART.starterKit }) {
  const selected = items.find(item => item.id === selectedId) || items[0];
  return <Dialog title="首单工具箱" className="eq-inspection-panel" onClose={onClose}><div className="eq-inspection-layout"><div className="eq-inspection-art"><img src={art.src} alt={art.alt}/><small>道具插画 / 实际规格以手册为准</small></div><div className="eq-inspection-info"><p className="eq-eyebrow">查看用途，不用先会接线</p><div className="eq-inspection-tabs" role="group" aria-label="工具箱元件">{items.map(item => <button type="button" key={item.id} aria-pressed={selected.id === item.id} onClick={() => onSelectItem?.(item.id)}>{item.title}</button>)}</div><span className="eq-inspection-category">{selected.category}</span><h3>{selected.title}</h3><p>{selected.description}</p><ActionButton variant="paper" icon="book" onClick={onOpenManual} disabled={!onOpenManual}>查工程手册</ActionButton><small>{selected.manualLabel}</small></div></div><p className="eq-inspection-note">已查看用途，正式接线稍后按手册完成。探索无需逐件点完，不影响主线。</p></Dialog>;
}
