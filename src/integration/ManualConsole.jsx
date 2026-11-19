import React,{useEffect,useId,useState} from 'react';
import {studentManual} from '../../content/index.js';
import {MANUAL_GUIDES} from './manual-content.js';

export function ManualConsole({initialSection='02.1',context='当前任务',onNavigate}){
  const [selected,setSelected]=useState(initialSection),[query,setQuery]=useState('');
  const searchId=useId();
  useEffect(()=>setSelected(initialSection),[initialSection]);
  const sections=studentManual.sections.filter(s=>(s.id+' '+s.title+' '+s.summary+' '+JSON.stringify(MANUAL_GUIDES[s.id])).toLowerCase().includes(query.toLowerCase()));
  const section=studentManual.sections.find(s=>s.id===selected)||studentManual.sections[0],guide=MANUAL_GUIDES[section.id];
  return <div className="eq-game-manual">
    <nav aria-label="工程手册目录"><label htmlFor={searchId}>查找章节</label><input id={searchId} type="search" placeholder="节号或关键词" value={query} onChange={e=>setQuery(e.target.value)}/><div className="eq-game-manual-index">{sections.length?sections.map(item=><button key={item.id} type="button" aria-current={selected===item.id?'page':undefined} onClick={()=>setSelected(item.id)}><code>{item.id}</code><span>{item.title}</span></button>):<p role="status">未找到章节。可搜索“接线”“循环”或“测试”。</p>}</div><small>软件阅读指南 r1<br/>纸质手册仍为草稿</small></nav>
    <article className="eq-game-manual-page" aria-label={`手册章节 ${section.id}`} key={section.id}><p className="eq-game-kicker">ENGINEERING FIELD GUIDE <span>{context}</span></p><h3>§{section.id} {section.title}</h3><p className="eq-game-manual-lead">{section.summary}</p><h4>操作与检查</h4><ol>{guide.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
      {guide.table&&<div className="eq-table-scroll"><table><thead><tr>{guide.table.headers.map(cell=><th key={cell}>{cell}</th>)}</tr></thead><tbody>{guide.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
      {guide.code&&<pre><code>{guide.code}</code></pre>}<aside className="eq-game-manual-note">{guide.note}</aside>
      <div className="eq-game-manual-links"><button type="button" onClick={()=>setSelected('02.1')}>需求 §02.1</button><button type="button" onClick={()=>setSelected('06.1')}>接线 §06.1</button><button type="button" onClick={()=>setSelected('07.1')}>循环 §07.1</button><button type="button" onClick={()=>setSelected('09.1')}>测试 §09.1</button></div>
      {onNavigate&&<button type="button" className="eq-button eq-button--paper" onClick={()=>onNavigate(/^(01|10)/.test(section.id)?'desk':/^(02|03)/.test(section.id)?'mail':/^(04|05|06)/.test(section.id)?'wiring':section.id.startsWith('08')?'code':section.id.startsWith('09')?'tests':section.id.startsWith('11')?'income':'blocks')}>返回相关工具 →</button>}
      <p className="eq-fine-print">节号沿用 {studentManual.ref.id}@{studentManual.ref.version}。此阅读补充以当前软件实现为依据；实物资料与定稿章节尚待核验。</p>
    </article>
  </div>;
}
