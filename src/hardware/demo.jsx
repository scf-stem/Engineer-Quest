import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WiringWorkbench} from './WiringWorkbench.jsx';
import {createWiringDocument, createAutoLightExample} from './wiring.js';
import {UNO_CANDIDATE_PROFILE} from './profile.js';

function HardwareDemo() {
  const [value, setValue] = useState(createWiringDocument), [light, setLight] = useState(150), [readOnly, setReadOnly] = useState(false);
  return <><nav className="demo-nav" aria-label="演示工具"><span>B 线独立演示 / 本地合成数据</span><button type="button" disabled={readOnly} onClick={() => setValue(createWiringDocument())}>空白接线</button><button type="button" disabled={readOnly} onClick={() => setValue(createAutoLightExample())}>载入参考接线</button><label><input type="checkbox" checked={readOnly} onChange={event => setReadOnly(event.target.checked)} />只读模式</label></nav><WiringWorkbench value={value} deviceProfile={UNO_CANDIDATE_PROFILE} onChange={setValue} lightValue={light} onLightChange={setLight} readOnly={readOnly} /><p className="demo-note">参考接线用于检查画布。光照滑条只提供输入，本演示未连接程序引擎；不会自动执行程序、通过客户测试或签发实物验收。</p></>;
}

createRoot(document.getElementById('hardware-demo')).render(<HardwareDemo />);
