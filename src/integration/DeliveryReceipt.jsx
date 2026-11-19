import React from 'react';
import {WorkshopMentor} from './WorkshopMentor.jsx';

export function DeliveryReceipt({state,onNavigate,onRestart,onSubmit,onReflection,reflection,pending,noteRecoveryWarning}){
  const earned=state.ledger.income>0,ready=state.facts.codeReady===true,hasFailure=state.attempt.tests.some(t=>!t.report.passed);
  return <section className="eq-game-income eq-player-receipt" aria-label="首单交付回信"><header><p className="eq-game-kicker">WEIGUANG / ORDER 001</p><h1>{ready&&earned?'首单软件演示已交付':ready?'客户看过演示，准备交付':earned?'收入与旧作品已留在工位':'这份委托，等你的作品'}</h1><p>{ready?'校园自动灯 · 从自己的积木走到客户变更':'继续当前目标，完成自己的装置和客户检查。'}</p></header>
    <div className="eq-player-payment"><span>{earned?'本机累计合成收入':'本机合成收入'}</span><strong data-testid="personal-income">{state.ledger.income} <small>EC</small></strong><p>{earned?'首单收入已保存，重开保留；同一订单不重复发放。':'本单完成后可记录候选合成收入 100 EC。'}</p></div>
    <blockquote className="eq-client-letter"><p className="eq-game-kicker">客户回信 / 校园展台</p><p>{ready?'“灯在虚拟暗亮变化中按约定工作，新的边界也检查过了。谢谢你保留原作品，找到了需要调整的比较，再拿测试证明修改。”':earned?'“你之前交付的作品和收入都还在。当前修改需要再核对，我会等你把新结果带来。”':'“我想让灯回应桌面的光照。先做眼前的那一小步，遇到不确定的地方，就找林工一起看。”'}</p></blockquote>
    <div className="eq-receipt-artifacts"><button type="button" onClick={()=>onNavigate('blocks')}><strong>{state.facts.programReady?'我搭出的原型':'从空白搭原型'}</strong><span>回看本人的积木与观察</span></button><button type="button" onClick={()=>onNavigate('tests')}><strong>{hasFailure?'失败与修正':state.attempt.tests.length?'我的客户测试':'客户检查'}</strong><span>{state.attempt.tests.length?'看客户期望和真实输出':'这次尝试还没有测试记录'}</span></button><button type="button" onClick={()=>onNavigate(state.facts.hasCode?'code':'mail')}><strong>当前作品</strong><span>{state.facts.hasCode?'查看自己的变更代码':'继续和林工看客户情境'}</span></button></div>
    {ready&&earned?<WorkshopMentor><p>这次你做过预测、接线和搭程序。{hasFailure?'挑一处真正修过的地方，说说“看到什么、改了什么、怎样复测”。':'挑一条客户场景，说说你的预测和实际运行结果。'}把这段过程留在自己的工程便签里。</p></WorkshopMentor>:null}
    {earned&&<label className="eq-receipt-reflection">给自己的工程便签<textarea value={reflection??''} maxLength={1500} rows={3} placeholder="记录一处失败和修正，保存在这次作品里。" onChange={e=>onReflection(e.target.value)}/></label>}
    {noteRecoveryWarning&&<p role="alert">{noteRecoveryWarning}</p>}
    <div className="eq-player-next"><button type="button" onClick={()=>onNavigate('desk')}>回研发室，整理这次作品 →</button>{ready&&!earned&&<button type="button" disabled={pending} onClick={onSubmit}>交付这版软件演示 →</button>}{earned&&<button type="button" disabled={pending} onClick={onRestart}>保留历史，再从空白试一次</button>}</div>
    <p className="eq-receipt-scope">本轮交付为本机软件体验与合成收入。真实装置的编译、烧录和教师现场验收另行完成。</p>
  </section>;
}
