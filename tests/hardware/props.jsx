import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WiringWorkbench} from '../../src/hardware/WiringWorkbench.jsx';
import {createAutoLightExample, createWiringDocument} from '../../src/hardware/wiring.js';

// Browser contract fixture, separate from the teaching demo and all program execution.
function PropsFixture() {
  const [value, setValue] = useState(createAutoLightExample), [diagnostics, setDiagnostics] = useState([]);
  const nested = new URLSearchParams(location.search).has('nested');
  return <>
    <button type="button" onClick={() => setValue(doc => ({...doc, connections: doc.connections.slice(1)}))}>Invalidate wiring</button>
    <button type="button" onClick={() => setDiagnostics([{code: 'A_STALE_OUTPUT', severity: 'error', message: '程序输出已过期，需要重新运行。', terminalIds: ['led:A']}])}>Invalidate output</button>
    <button type="button" onClick={() => setDiagnostics([{code: 'A_WARNING', severity: 'warning', message: '来自集成层的合成警告。'}])}>External warning</button>
    <button type="button" onClick={() => { setValue(createWiringDocument()); setDiagnostics([]); }}>Blank document</button>
    <button type="button" onClick={() => { setValue(createWiringDocument()); setDiagnostics([{code: 'SENSOR_GROUND_MISSING', severity: 'error', message: '外部检查要求处理公共地。', terminalIds: ['sensor:GND']}]); }}>Blank external error</button>
    <button type="button" onClick={() => { setValue({...createWiringDocument(), schemaVersion: 'unknown'}); setDiagnostics([]); }}>Unknown schema</button>
    <div data-fixture-container style={{width: nested ? 680 : '100%', maxWidth: '100%'}}><WiringWorkbench value={value} onChange={setValue} diagnostics={diagnostics} outputs={{lamp: true}} /></div>
  </>;
}

createRoot(document.getElementById('fixture')).render(<PropsFixture />);
