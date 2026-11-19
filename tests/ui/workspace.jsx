// Explicit test-only entry. Never imported by src/main.jsx or the production build.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import QuestApp from '../../src/integration/QuestApp.jsx';
import {createProgramContext} from '../../src/integration/program-adapter.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createIndexedDbProgressStore,ProgressStoreError} from '../../src/integration/local-progress-store.js';
import {createExampleBlocks} from '../../src/program/examples.js';
import {fixturePolicies,fixtureAnswer} from '../integration/local-workspace.fixture.js';
let failCount=0;
const createContext=async hardware=>({...await createProgramContext(hardware),uiBindingHarnessMarker:true});
const openWorkspace=context=>{
  if(context.uiBindingHarnessMarker!==true)throw new Error('createContext 注入未到达 openWorkspace');
  const store=createIndexedDbProgressStore({databaseName:'eq-ui-workspace-harness-only'});
  return openLocalWorkspace({programContext:context,policies:fixturePolicies,store:{...store,commit:async(...args)=>{if(failCount>0){failCount--;throw new ProgressStoreError('STORAGE_QUOTA','测试注入：本机存储空间不足');}return store.commit(...args);}}});
};
function FixtureAction({children,run,disabled}){const [busy,setBusy]=useState(false),[error,setError]=useState('');return <><button type="button" className="eq-button eq-button--paper" disabled={disabled||busy} onClick={async()=>{setBusy(true);try{await run();setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}}>{children}</button>{error&&<p role="alert">{error}</p>}</>;}
function RequirementFixture({workspace,state,phase,onNavigate}){
  const ready=(phase==='blocks'?state.facts.requirements:state.facts.changeRequirements)?.readyToAdvance;
  return <div className="eq-fixture-panel"><strong>仅控制器/UI 回归：需求教学策略为测试替身</strong><p>这里不验证学生理解，不是 D 正式情境练习。</p><FixtureAction disabled={state.facts.pending} run={()=>workspace.reviewRequirements({phase,attempt:fixtureAnswer()})}>测试替身：记录需求情境响应</FixtureAction><p data-testid="fixture-requirement-state">{ready?'测试替身已就绪':'测试替身未就绪'}</p><button type="button" className="eq-button" disabled={!ready||state.facts.pending} onClick={()=>onNavigate(phase==='blocks'?'wiring':'code')}>前往当前工程工具</button></div>;
}
function ProgramFixture({workspace,state,phase}){
  return <div className="eq-fixture-panel"><strong>仅回归测试替身：不代表真实编程学习完成</strong><div>{phase==='blocks'?<><FixtureAction disabled={state.facts.pending} run={()=>workspace.editDraft({blockState:{workspace:createExampleBlocks()},support:{kind:'test-fixture'}})}>测试替身：载入程序结构</FixtureAction><FixtureAction disabled={!state.facts.programReady||state.facts.pending} run={()=>workspace.performLearningAction({phase,actionId:'fixture-practice'})}>测试替身：记录局部观察</FixtureAction></>:<FixtureAction disabled={state.facts.pending} run={()=>workspace.performLearningAction({phase,actionId:'fixture-mapping'})}>测试替身：记录代码映射</FixtureAction>}</div><p>真实软件执行与客户测试继续使用现有 A/B/D 引擎。</p></div>;
}
function App(){return <><div className="eq-fixture-banner">测试专用页面 / 教学策略是明确替身 <button onClick={()=>{failCount=1;}}>测试注入：下一次保存失败</button></div><QuestApp createContext={createContext} openWorkspace={openWorkspace} RequirementPracticeComponent={RequirementFixture} ProgramPracticeComponent={ProgramFixture}/></>;}
const style=document.createElement('style');style.textContent='.eq-fixture-banner{position:fixed;z-index:100;top:3px;left:35%;font:9px system-ui;color:#ffe1a1;background:#40321f;padding:3px 7px}.eq-fixture-banner{pointer-events:none}.eq-fixture-banner button{pointer-events:auto;font:9px system-ui;margin-left:8px}@media(max-width:600px){.eq-fixture-banner{top:auto;bottom:0;left:0;right:0;max-height:14px;display:flex;align-items:center;justify-content:center;font-size:7px;padding:1px 3px}.eq-fixture-banner button{font-size:7px;margin:0 0 0 5px;padding:0 3px}}.eq-fixture-panel{padding:14px;margin:12px 20px;background:#332d22;border:1px solid #99733f;color:#ead3a4;font:12px/1.8 system-ui}.eq-fixture-panel p{margin:8px 0}.eq-fixture-panel button{margin-right:8px;margin-top:8px}';document.head.append(style);
createRoot(document.getElementById('root')).render(<App/>);
