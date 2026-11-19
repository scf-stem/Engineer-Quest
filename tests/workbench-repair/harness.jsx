import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as Blockly from 'blockly';
import ProgramBlocks from '../../src/integration/ProgramBlocks.jsx';
import {SYNTHETIC_DEVICE} from '../../src/program/examples.js';
import {workbenchFixture} from './fixtures.js';
import '../../src/integration/game-shell.css';
import '../../src/integration/storyline.css';
const KEY='eq-statement-repair-synthetic-draft';
const stored=()=>{try{return JSON.parse(localStorage.getItem(KEY))??workbenchFixture({loose:true});}catch{return workbenchFixture({loose:true});}};
window.workbenchTest={changes:[],fixture:workbenchFixture,key:KEY};
function Harness(){
  const [value,setValue]=useState(stored),[readOnly,setReadOnly]=useState(false),[hidden,setHidden]=useState(()=>new URLSearchParams(location.search).has('hidden'));
  window.workbenchTest.workspace=()=>Blockly.Workspace.getAll().find(w=>w.rendered&&!w.isFlyout);
  window.workbenchTest.restore=next=>setValue(structuredClone(next));window.workbenchTest.readOnly=setReadOnly;
  window.render_game_to_text=()=>JSON.stringify({mode:'synthetic-statement-harness',workspace:Blockly.serialization.workspaces.save(window.workbenchTest.workspace()),feedback:document.querySelector('[data-block-snap]')?.textContent,edits:window.workbenchTest.changes.filter(change=>change.origin==='edit').length,coordinateSystem:'CSS px; origin top-left, x right, y down'});
  window.advanceTime=async ms=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,40)));
  return <main className="eq-game" data-active-tool="blocks" data-storytelling="true"><nav className="repair-nav"><strong>完整工位语句连接 · 合成测试身份</strong><button onClick={()=>setHidden(!hidden)}>{hidden?'显示工位':'隐藏工位'}</button><button onClick={()=>{localStorage.removeItem(KEY);setValue(workbenchFixture({loose:true}));}}>恢复测试初态</button></nav><section className={`eq-game-program-workspace repair-workspace${new URLSearchParams(location.search).has('compact')?' repair-compact':''}`}><aside className="repair-aside"><h2>当前操作</h2><p>把如果插在读取之后，保留等待。再分别把输出接入两个分支。</p><p>测试页不执行程序、不发通过事实、不接真实存档。</p></aside><div className="eq-game-block-editor" style={hidden?{display:'none'}:undefined}><ProgramBlocks initial={value} workspaceState={value} deviceProfile={SYNTHETIC_DEVICE} readOnly={readOnly} allowFullExample={false} onChange={next=>{window.workbenchTest.changes.push(next);if(next.origin==='edit'){setValue(next.workspace);localStorage.setItem(KEY,JSON.stringify(next.workspace));}}}/></div><aside className="repair-aside"><h2>观察区</h2><p>运行入口由父舞台负责。这里仅验证真实 Blockly 的连接、预览、撤销与草稿同步。</p></aside></section></main>;
}
const style=document.createElement('style');style.textContent='html,body,#root{margin:0;height:100%;background:#071522;color:#d9eef7;font:14px system-ui}.repair-nav{display:flex;align-items:center;gap:16px;padding:12px 22px;height:52px;box-sizing:border-box;border-bottom:1px solid #35566d}.repair-nav button{margin-left:auto}.repair-workspace{height:calc(100vh - 52px);min-height:0}.repair-workspace.repair-compact{height:520px}.repair-aside{padding:16px;box-sizing:border-box;color:#adcada;font-size:13px;line-height:1.7}.repair-aside h2{font-size:17px}.eq-game-block-editor{min-height:0}.eq-game-block-viewport-tools button{white-space:nowrap}';document.head.append(style);
createRoot(document.getElementById('root')).render(<Harness/>);
