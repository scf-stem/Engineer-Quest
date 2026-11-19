import React, { useId } from 'react';
import { ActionButton } from './components.jsx';

export function RequirementDraftForm({ fields, value, onChange, explanation, onExplanationChange, onSave, feedback }) {
  const formId = useId();
  return <form className="eq-panel eq-requirement-form" onSubmit={event => {event.preventDefault(); onSave?.();}}>
    <div className="eq-form-heading"><span className="eq-section-kicker">我的中文方案卡</span><span className="eq-handwritten">先想清楚，再写代码 ↙</span></div>
    <div className="eq-requirement-fields">{fields.map((field, index) => <label key={field.id} htmlFor={`${formId}-${field.id}`}><span><b>{String(index + 1).padStart(2, '0')}</b>{field.title}</span><small>{field.question}</small><select id={`${formId}-${field.id}`} value={value[field.id] || ''} onChange={event => onChange?.({...value, [field.id]: event.target.value})}><option value="">选择你的想法</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}</div>
    <label className="eq-explanation" htmlFor={`${formId}-explanation`}>用自己的话，说说从暗到亮会发生什么<textarea id={`${formId}-explanation`} value={explanation} onChange={event => onExplanationChange?.(event.target.value)} rows={3} maxLength={1000} placeholder="例如：它先读取……然后……"/></label>
    <div className="eq-form-actions"><ActionButton type="submit" icon="arrow" disabled={!onSave}>保存演示草稿</ActionButton><small>仅保留在本次页面演示中</small></div><p role="status" className="eq-form-feedback">{feedback || '保存草稿不会授予阶段通过。'}</p>
  </form>;
}
