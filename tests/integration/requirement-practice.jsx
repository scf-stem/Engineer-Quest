import React,{useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createIntegratedProgramContext} from '../../src/integration/manual-bundle.js';
import {openLocalWorkspace} from '../../src/integration/local-workspace.js';
import {createIndexedDbProgressStore} from '../../src/integration/local-progress-store.js';
import {createWorkspacePolicies} from '../../src/integration/learning-policy-adapter.js';
import {RequirementPractice} from '../../src/integration/RequirementPractice.jsx';
import {ProgramPractice} from '../../src/integration/ProgramPractice.jsx';
import {FullManualConsole} from '../../src/integration/FullManualConsole.jsx';
const context=await createIntegratedProgramContext(await createHardwareContext());
const work=await openLocalWorkspace({programContext:context,policies:await createWorkspacePolicies(context),store:createIndexedDbProgressStore({databaseName:'eq-requirement-integration-harness'})});
window.requirementHarness={work};
window.render_game_to_text=()=>JSON.stringify({stage:work.getState().stage,storage:work.getState().storage,review:work.getState().facts.requirements});window.advanceTime=()=>{};
function App(){
  const state=useSyncExternalStore(work.subscribe,work.getState),[notice,setNotice]=useState('');
  const params=new URLSearchParams(location.search),Component=params.has('program')?ProgramPractice:RequirementPractice;
  if(params.has('manual'))return <FullManualConsole initialSection={params.get('section')??'07.1'} context="开发验证：实际全文资料" onNavigate={stage=>setNotice(`请求导航：${stage}`)}/>;
  return <><p>开发整合验证 · 使用真实 A/D 与 E 存储；本页不代替统一游戏验收。</p><p role="status">{state.storage.status} / {notice}</p>{!state.learner?<button onClick={async()=>{await work.start('需求界面合成审查');await work.claimOrder();}}>开始本机练习</button>:<Component workspace={work} state={state} phase={params.get('phase')??'blocks'} onNavigate={stage=>setNotice(`请求导航：${stage}`)} onOpenManual={section=>setNotice(`请求手册：§${section}`)}/>}</>;
}
createRoot(document.querySelector('#root')).render(<App/>);
