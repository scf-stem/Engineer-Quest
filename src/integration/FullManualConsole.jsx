import React,{useEffect,useMemo,useRef,useState} from 'react';
import {parseManualMarkdown} from './manual-markdown.js';
import './full-manual.css';

const sources=import.meta.glob('../../docs/manual/*.md',{query:'?raw',import:'default',eager:true});
const assets=import.meta.glob('../../docs/manual/{assets,examples}/*',{query:'?url',import:'default',eager:true});
const files=['README.md','首单手册.md','工程参考.md','参考实现.md','教师实物附录.md','来源与限制.md'];
const fileLabel=name=>name==='README.md'?'阅读入口':name.replace(/\.md$/,'');
const lookup=name=>sources['../../docs/manual/'+name];
const asset=target=>assets['../../docs/manual/'+target];
const anchorFor=section=>'s'+section.replace(/[^\d]/g,'');

function Inline({text,onLink}){
  const parts=text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|<br\s*\/?>)/g);
  return parts.map((part,i)=>{
    if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
    if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}><Inline text={part.slice(2,-2)} onLink={onLink}/></strong>;
    const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if(link){const external=/^https?:\/\//.test(link[2]);return external?<a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]} ↗</a>:<a key={i} href={'#manual-link'} onClick={e=>{e.preventDefault();onLink(link[2]);}}>{link[1]}</a>;}
    if(/^<br\s*\/?>$/.test(part))return <br key={i}/>;
    return part;
  });
}

/** Loads actual authored manual files. Missing full text never falls back to old summaries. */
export function FullManualConsole({initialSection='02.1',context='当前任务',onNavigate,onReferenceOpen}){
  const [file,setFile]=useState('工程参考.md'),[anchor,setAnchor]=useState(anchorFor(initialSection)),[query,setQuery]=useState(''),[notice,setNotice]=useState(''),[referenceOpen,setReferenceOpen]=useState(false);
  const article=useRef(null),documents=useMemo(()=>files.filter(lookup).map(name=>({name,nodes:parseManualMarkdown(lookup(name))})),[]);
  const selected=documents.find(d=>d.name===file)??documents[0];
  useEffect(()=>{setFile('工程参考.md');setAnchor(anchorFor(initialSection));},[initialSection]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const page=article.current,target=[...page?.querySelectorAll('[data-anchor]')??[]].find(element=>element.dataset.anchor===anchor);if(target){page.scrollTop+=target.getBoundingClientRect().top-page.getBoundingClientRect().top-12;target.focus({preventScroll:true});}else if(page)page.scrollTop=0;});return()=>cancelAnimationFrame(frame);},[selected?.name,anchor,referenceOpen]);
  function navigate(name,id){setFile(name);setAnchor(id??'');setNotice('');}
  function link(target){
    let decoded;try{decoded=decodeURIComponent(target);}catch{setNotice('这条资料链接无法解析。');return;}
    if(decoded.startsWith('#'))return navigate(selected.name,decoded.slice(1));
    const [name,id]=decoded.split('#');if(documents.some(d=>d.name===name))return navigate(name,id);
    const url=asset(decoded);if(url){const a=document.createElement('a');a.href=url;a.download=decoded.split('/').at(-1);a.click();return;}
    setNotice('该附件尚未接入，请保留当前手册并查看来源与限制。');
  }
  if(!selected)return <div className="eq-full-manual"><h3>新版手册全文尚未交付</h3><p>当前不能用旧章节摘要代表新手册。请保留作品，等待本地资料接入。</p></div>;
  const allowed=selected.name!=='参考实现.md'||referenceOpen;
  const inline=text=><Inline text={text} onLink={link}/>;
  const headings=selected.nodes.filter(n=>n.type==='heading'&&n.level<=3);
  return <div className="eq-game-manual eq-full-manual"><nav aria-label="完整工程手册目录"><label>搜索本册正文<input type="search" placeholder="节号、元件或语法" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="eq-game-manual-index">{documents.map(doc=><button key={doc.name} type="button" aria-current={doc===selected?'page':undefined} onClick={()=>navigate(doc.name)}>{fileLabel(doc.name)}</button>)}</div><div className="eq-full-manual-sections">{headings.filter(h=>!query||h.text.toLowerCase().includes(query.toLowerCase())||selected.nodes.slice(selected.nodes.indexOf(h)+1,selected.nodes.findIndex((n,i)=>i>selected.nodes.indexOf(h)&&n.type==='heading')<0?undefined:selected.nodes.findIndex((n,i)=>i>selected.nodes.indexOf(h)&&n.type==='heading')).some(n=>JSON.stringify(n).toLowerCase().includes(query.toLowerCase()))).map(h=><button key={h.id} type="button" onClick={()=>setAnchor(h.id)}>{h.text.replace(/^§/,'')}</button>)}</div><small>完整本地资料 · 非在线 AI<br/>实物规格与烧录待验证</small></nav>
    <article ref={article} className="eq-game-manual-page" aria-label={`完整手册 ${fileLabel(selected.name)}`}><p className="eq-game-kicker">FIELD MANUAL / FULL TEXT <span>{context}</span></p>{notice&&<p role="status">{notice}</p>}
      {!allowed?<section className="eq-full-manual-reference"><h3>尝试后再查看完整实现</h3><p>这里是完整代码与资料附录，供核对和救援。先保留自己的尝试；阅读不会授予学习完成或测试通过。</p><button type="button" className="eq-button eq-button--paper" onClick={()=>{setReferenceOpen(true);onReferenceOpen?.();}}>我需要核对完整参考实现</button></section>:selected.nodes.map((node,i)=>{
        if(node.type==='heading'){const Heading='h'+Math.min(node.level+1,6);return <Heading key={i} data-anchor={node.id} tabIndex={-1}>{inline(node.text)}</Heading>;}
        if(node.type==='code')return <pre key={i}><code>{node.text}</code></pre>;
        if(node.type==='image')return asset(node.target)?<figure key={i}><img src={asset(node.target)} alt={node.alt}/><figcaption>{node.alt}</figcaption></figure>:<p key={i}>{node.alt}（图件尚未接入）</p>;
        if(node.type==='table')return <div className="eq-table-scroll" key={i}><table><thead><tr>{node.headers.map((c,j)=><th key={j}>{inline(c)}</th>)}</tr></thead><tbody>{node.rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>;
        if(node.type==='list'){const List=node.ordered?'ol':'ul';return <List key={i}>{node.items.map((item,j)=><li key={j}>{inline(item)}</li>)}</List>;}
        if(node.type==='quote')return <blockquote key={i}>{inline(node.text)}</blockquote>;
        return <p key={i}>{inline(node.text)}</p>;
      })}
      {onNavigate&&<button type="button" className="eq-button eq-button--paper" onClick={()=>onNavigate(/^(04|05|06)/.test(initialSection)?'wiring':initialSection.startsWith('08')?'code':initialSection.startsWith('09')?'tests':initialSection.startsWith('07')?'blocks':'mail')}>返回相关工具 →</button>}
    </article>
  </div>;
}
