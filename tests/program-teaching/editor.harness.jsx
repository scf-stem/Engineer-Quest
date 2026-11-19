import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as Blockly from 'blockly';
import TeachingEditor from '../../src/program-teaching/TeachingEditor.jsx';
import {SYNTHETIC_DEVICE} from '../../src/program/examples.js';

export const initial = {
  output: {blocks: {languageVersion: 0, blocks: [{type: 'eqp_write', id: 'output', x: 245, y: 70, fields: {PORT: 'LAMP'}}]}},
  sequence: {blocks: {languageVersion: 0, blocks: [{type: 'eqp_write', id: 'on', x: 235, y: 55, fields: {PORT: 'LAMP'}, inputs: {VALUE: {block: {type: 'logic_boolean', id: 'true', fields: {BOOL: 'TRUE'}}}}, next: {block: {type: 'eqp_write', id: 'off', fields: {PORT: 'LAMP'}, inputs: {VALUE: {block: {type: 'logic_boolean', id: 'false', fields: {BOOL: 'FALSE'}}}}}}}]}},
  reading: {blocks: {languageVersion: 0, blocks: [{type: 'eqt_sample', id: 'sample', x: 245, y: 70}]}},
};
window.editorTest = {initial, changes: [], interactions: [], focusTargets: []};
function Harness() {
  const [kind, setKind] = useState('output'), [value, setValue] = useState(initial.output), [independent, setIndependent] = useState(false), [locked, setLocked] = useState(false), [focus, setFocus] = useState(null), [target, setTarget] = useState(undefined);
  window.editorTest.restore = (next, nextKind = kind) => {setKind(nextKind); setValue(structuredClone(next));};
  window.editorTest.workspace = () => Blockly.Workspace.getAll().find(w => w.rendered && !w.isFlyout);
  window.editorTest.lock = setLocked; window.editorTest.focus = setFocus; window.editorTest.target = setTarget;
  window.render_game_to_text = () => JSON.stringify({kind, independent, locked, workspace: Blockly.serialization.workspaces.save(window.editorTest.workspace()), feedback: document.querySelector('[data-teaching-feedback]')?.textContent, changes: window.editorTest.changes.length, coordinateSystem: 'CSS px; origin top-left, x right, y down'});
  window.advanceTime = async ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 40)));
  return <main><nav aria-label="隔离测试"><strong>局部编辑器 · 合成测试身份</strong>{Object.keys(initial).map(type => <button key={type} onClick={() => {setKind(type); setValue(structuredClone(initial[type]));}}>{type}</button>)}<label><input type="checkbox" checked={independent} onChange={e => setIndependent(e.target.checked)} />独立尝试</label></nav><div className="harness-stage"><aside>林工<br/><small>这里只验证积木操作。主舞台和运行由 E 接入。</small></aside><div className="harness-editor"><TeachingEditor kind={kind} value={value} deviceProfile={SYNTHETIC_DEVICE} independent={independent} disabled={locked} focusNodeId={focus} focusTarget={target} onChange={(next, meta) => {window.editorTest.changes.push({next, meta}); setValue(next);}} onFocusTarget={target => window.editorTest.focusTargets.push(target)} onInteraction={details => window.editorTest.interactions.push(details)} /></div><aside>同一装置<br/><small>本测试不执行程序、不发完成事实。</small></aside></div><footer>下方主运行由父舞台负责 · 编辑器没有第二个运行按钮</footer></main>;
}
const style = document.createElement('style'); style.textContent = 'html,body,#root{margin:0;min-height:100%;background:#081724;color:#d6e9f4;font:14px system-ui}main{height:100vh;display:flex;flex-direction:column}nav{display:flex;gap:12px;align-items:center;padding:14px 22px;border-bottom:1px solid #365367}nav button{padding:6px 12px}nav strong{margin-right:auto}.harness-stage{flex:1;min-height:0;display:grid;grid-template-columns:150px minmax(0,760px) 150px;gap:20px;padding:32px 20px;justify-content:center;align-items:center}.harness-editor{height:min(480px,calc(100vh - 180px));min-height:330px}aside{color:#a2c4d8;font-size:24px}aside small{font-size:13px}footer{padding:20px;text-align:center;background:#102c40}'; document.head.append(style);
createRoot(document.getElementById('root')).render(<Harness />);
