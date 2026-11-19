import React from 'react';
import {ActionButton,Notice} from '../ui/index.js';

export function RequirementConsole({task,requirement,claimed,onClaim,fields,card,onChange,onSave,cardSaved,coverage,review,reviewCitations,savedCard,onWiring,onManual,onTutorial,practice,pending=false}){
  return <div className="eq-game-mail" data-claimed={claimed?'true':'false'}>
    <aside className="eq-game-mail-file"><p className="eq-game-kicker">收件箱 <span>01 封委托</span></p><div className="eq-game-mail-selected"><span>客户委托 / 001</span><h1>{task.title}</h1><p>{task.client}</p><small>{claimed?'已接单':'未领取'}</small></div><div className="eq-game-mail-brief"><p className="eq-game-kicker">客户原文</p><p>{task.description}</p><dl><dt>输入</dt><dd>虚拟光照 0–1023</dd><dt>规则</dt><dd>小于 {requirement.rule.threshold} 开灯，否则关灯</dd><dt>响应</dt><dd>持续工作，最多 200ms</dd><dt>范围</dt><dd>低压 LED · 个人项目</dd></dl><button type="button" onClick={()=>onManual('02.1')}>打开需求拆解 §02.1 ↗</button></div><button type="button" className="eq-game-mail-contact" onClick={onTutorial}>林工 / 查看当前工作提示 ↗</button></aside>
    <div className="eq-game-requirement"><div className="eq-game-section-head"><div><p className="eq-game-kicker">REQUIREMENT / {requirement.ref.version}</p><h2>{claimed?(practice?'和林工一起看客户的桌面':'我的中文方案卡'):'校园展台 · 自动灯委托'}</h2></div><span className={`eq-game-state ${cardSaved?'is-ready':''}`}>{cardSaved?'情境练习已完成':claimed?(practice?'林工在桌边等你':'草稿编辑中'):'等待接单'}</span></div>
      {!claimed?<div className="eq-game-order-intro"><span className="eq-game-order-number">001</span><h3>让展台的灯回应光照变化</h3><p>{requirement.studentText}</p><p>先说明你的方案，再进入虚拟工位。基本元件已经备好。</p><ActionButton disabled={pending} onClick={onClaim}>向林工领取订单 →</ActionButton><small>不需要会写代码就能开始。</small></div>:<>
        {!practice&&<p className="eq-game-requirement-rule">{requirement.studentText}</p>}
        {practice||<><Notice tone="warm">需求情境练习尚未接入。下方只保存旧方案草稿，不能授予通过或开放后续工具。</Notice>
        <div className="eq-game-choices">{fields.map((field,index)=><fieldset key={field.key}><legend><span>{String(index+1).padStart(2,'0')}</span>{field.label}</legend>{field.options.map(option=><label className={card[field.key]===option.id?'is-selected':''} key={option.id}><input type="radio" name={field.key} value={option.id} checked={card[field.key]===option.id} onChange={()=>onChange({...card,[field.key]:option.id})}/><span>{option.label}</span></label>)}</fieldset>)}</div>
        <label className="eq-game-explanation">用自己的话说明一次从暗到亮、再变暗的过程<textarea value={card.explanation||''} maxLength={1500} rows={3} placeholder="描述传感器怎样读取，程序怎样判断，灯怎样响应下一次变化。" onChange={e=>onChange({...card,explanation:e.target.value})}/></label>
        <div className="eq-game-requirement-actions"><ActionButton disabled={pending} onClick={onSave}>保存旧方案草稿</ActionButton><ActionButton variant="paper" disabled={!cardSaved} onClick={onWiring}>进入虚拟实验 →</ActionButton><span>旧草稿不作为通过依据</span></div>
        {review&&<Notice>{review.question} {review.suggestedNextStep}<button type="button" className="eq-game-review-citation" onClick={()=>onManual(reviewCitations.manualSection||'02.1')}>{reviewCitations.label||'手册 §02.1'} ↗</button></Notice>}
        {(review||savedCard)&&<details className="eq-live-version-details"><summary>查看依据与版本详情</summary><p>{cardSaved?'当前方案的保存记录':'当前草稿已修改；保存记录属于历史版本'}</p><pre>{JSON.stringify({citations:review?.citations||[],requirementRef:savedCard?.requirementRef||null,cardDigest:savedCard?.digest||null},null,2)}</pre></details>}
        <p className="eq-fine-print">自由文字不在此处做语义评分；继续条件由当前情境练习和控制器事实决定。</p></>}
      </>}
    </div>
  </div>;
}
