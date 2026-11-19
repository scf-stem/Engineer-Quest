import React, { useId } from 'react';

// Coordinates belong to this visual sample, not a DeviceProfile or wiring schema.
const PINS = [
  {id: '5V', x: 307, y: 124, title: '5V · 电源端子'},
  {id: 'GND', x: 307, y: 163, title: 'GND · 公共参考地'},
  {id: 'A0', x: 307, y: 202, title: 'A0 · 模拟输入候选'},
  {id: 'D9', x: 307, y: 241, title: 'D9 · 灯控输出候选'},
];

export function TerminalIllustration({ selectedTerminal, onSelectTerminal, showReference = false }) {
  const gridId = useId();
  return <div className="eq-terminal-illustration" role="group" aria-label="端子外观示意，非真实接线工具">
    <svg viewBox="0 0 800 420" fill="none" aria-hidden="true">
      <defs><pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#b7c9ba"/></pattern></defs>
      <rect width="800" height="420" fill={`url(#${gridId})`}/>
      <rect x="52" y="70" width="300" height="236" rx="16" fill="#203f35" stroke="#122e26" strokeWidth="2"/>
      <path d="M52 120H36v85h16" fill="#d6d4c5" stroke="#9caa98" strokeWidth="2"/>
      <rect x="80" y="103" width="65" height="48" rx="5" fill="#b1b9a5"/>
      <rect x="110" y="189" width="126" height="45" rx="5" fill="#172d26" stroke="#70866b"/>
      {Array.from({length: 12}, (_, i) => <path key={i} d={`M${118 + i * 10} 183v6m0 45v6`} stroke="#bec5a6" strokeWidth="3"/>)}
      <circle cx="76" cy="90" r="5" fill="#a6b69b"/><circle cx="330" cy="285" r="5" fill="#a6b69b"/>
      <path d="M171 121h57m-57 6h35m-35 6h46" stroke="#b3c7ad" strokeWidth="2"/>
      <text x="80" y="272" fill="#f0e8c9" fontSize="22" fontFamily="monospace" letterSpacing="3">UNO</text>
      <text x="80" y="292" fill="#b4c5aa" fontSize="10" fontFamily="sans-serif">型号与器件批次待确认</text>
      {PINS.map(pin => <g key={pin.id}><text x="282" y={pin.y + 5} textAnchor="end" fill="#f3e9c9" fontSize="14" fontFamily="monospace">{pin.id}</text><rect x="296" y={pin.y - 11} width="22" height="22" rx="4" fill="#0c261e" stroke="#a8bc96"/><circle cx="307" cy={pin.y} r="4" fill="#e8cf85"/></g>)}
      <rect x="540" y="72" width="164" height="112" rx="10" fill="#759b7e" stroke="#3c654d" strokeWidth="2"/>
      <circle cx="620" cy="110" r="24" fill="#d2b68a" stroke="#5e6950" strokeWidth="3"/>
      <path d="m607 95 17 8-18 8 17 8-16 8" stroke="#8b6947" strokeWidth="2"/>
      <text x="622" y="161" textAnchor="middle" fill="#133428" fontSize="14" fontFamily="sans-serif">光敏模块 · 外观示意</text>
      <path d="M568 184v19m25-19v19m25-19v19" stroke="#b49b62" strokeWidth="5"/>
      <path d="M551 289h46m54 0h55" stroke="#8a977d" strokeWidth="4"/>
      <rect x="593" y="278" width="62" height="22" rx="7" fill="#d9bb84" stroke="#a68a59" strokeWidth="2"/>
      <path d="M610 279v20m10-20v20m20-20v20" stroke="#a46541" strokeWidth="5"/>
      <text x="624" y="331" textAnchor="middle" fill="#4f6550" fontSize="13" fontFamily="sans-serif">限流电阻 · 参数待核实</text>
      <path d="M438 303v41m24-41v41" stroke="#7c8976" strokeWidth="4"/>
      <path d="M425 303v-30a25 25 0 0 1 50 0v30z" fill="#e09068" stroke="#bd5a37" strokeWidth="2"/>
      <path d="M420 303h60m-44-34v12" stroke="#fbe8bd" strokeWidth="4" strokeLinecap="round"/>
      <text x="450" y="368" textAnchor="middle" fill="#4f6550" fontSize="13" fontFamily="sans-serif">LED · 注意正负极</text>
      {showReference && <g strokeWidth="3" strokeLinecap="round"><path d="M319 124h73V45h176v152" stroke="#b1543b"/><path d="M319 163h52v-99h222v133" stroke="#465f53"/><path d="M319 202h91v22h208v-27" stroke="#c19a3b"/><path d="M319 241h50v48h226" stroke="#547f67"/><path d="M706 289h30v101H462v-46m-24 0v46H385V163h-66" stroke="#7e8c72" strokeDasharray="7 6"/></g>}
      <text x="51" y="377" fill="#65745c" fontSize="12" fontFamily="sans-serif">布局示意 / 连线与器件规则以接入的硬件模块为准</text>
    </svg>
    {PINS.map(pin => <button type="button" key={pin.id} className={`eq-pin-hit ${selectedTerminal === pin.id ? 'eq-pin-hit--selected' : ''}`} style={{left: `${pin.x / 8}%`, top: `${pin.y / 4.2}%`}} onClick={() => onSelectTerminal?.(pin.id)} disabled={!onSelectTerminal} aria-label={`查看 ${pin.title}`} aria-pressed={selectedTerminal === pin.id} title={pin.title}/>)}
  </div>;
}
