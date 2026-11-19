import React from 'react';

/** A manual demonstration. The meter observes; response cards live in the dialogue dock. */
export function ClientDesk({challenge, disabled, desk, onObserve, focusProps = () => ({})}) {
  const sequence = challenge.scene?.lightSequence;
  const {reading, index, lamp} = desk;
  const actionLabel = sequence ? index === sequence.length - 1 ? '从第一个时刻再看' : '看下一个时刻' : reading < 450 ? '移开遮挡，再看读数' : '遮住光源，再看读数';
  function move() {
    const nextIndex = sequence ? (index + 1) % sequence.length : 0;
    const next = sequence ? sequence[nextIndex] : reading < 450 ? 850 : 150;
    onObserve?.({previous: reading, light: next, ...(sequence ? {step: nextIndex + 1} : {})},
      {...desk, reading: next, index: nextIndex});
  }
  return <section className={`eq-client-desk ${reading < 450 ? 'is-dark' : ''}`} aria-label="客户桌面 · 手动演示">
    <div className="eq-client-desk-caption"><span>校园展台 · 手动演示</span><span>{sequence ? `第 ${index + 1} / ${sequence.length} 个时刻` : '日期未变 · 同一个下午'}</span></div>
    <div className="eq-client-objects" {...focusProps('reading')}>
      <div className="eq-client-meter" role="group" aria-label={`光照表，当前读数 ${reading}`} data-reading={reading}>
        <small>光照表 <span>低值较暗</span></small><output aria-live="polite">{reading}</output>
        <span>{challenge.scene?.previousLight ? `这一幕：${challenge.scene.previousLight} → ${reading}` : '此刻的光照'}</span>
      </div>
      <div className={`eq-client-lamp ${lamp ? 'is-on' : ''}`} data-lamp={lamp ? 'on' : 'off'} aria-label={`灯${lamp ? '亮' : '灭'}`}><i aria-hidden="true"/><span>灯 <strong>{lamp ? '亮' : '灭'}</strong></span></div>
    </div>
    {sequence && <ol className="eq-stage-timeline" aria-label="这张桌面的时刻序列">{sequence.map((value, i) => <li key={i} aria-current={index === i ? 'step' : undefined}><small>时刻 {i + 1}</small><strong>{value}</strong></li>)}</ol>}
    <button type="button" className="eq-client-shade" aria-label={actionLabel} disabled={disabled} onClick={move} {...focusProps('observe')}>
      {actionLabel}
    </button>
  </section>;
}
