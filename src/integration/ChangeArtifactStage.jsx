import React,{useMemo,useState} from 'react';
import {blocksToProgram,createProgramLearningMap} from '../program/index.js';

/** Inspection of the learner's actual artifact; only an explicit D response advances review. */
export function ChangeArtifactStage({state,challenge,disabled,onAnswer,guided=false,onSelect,ownNode,area='all',previewNode,onPreview}){
  const [selected,setSelected]=useState(null),blocks=state.attempt.draft.blockState?.workspace??state.attempt.draft.blockState;
  const map=useMemo(()=>{const program=blocksToProgram(blocks);return program.ok?createProgramLearningMap(program.value,{blockState:blocks}):null;},[blocks]);
  const option=id=>challenge.options.find(item=>item.optionId===id);
  // The requirement stage can put real artifacts above, and their controls in its dialogue dock.
  // Existing callers keep the original combined presentation.
  if(area!=='all'){
    const node=previewNode??selected;
    const pick=async link=>{setSelected(link);onPreview?.(link);if(guided&&link.concept==='comparison'&&await onSelect?.(link)!==false)onAnswer(option('comparison'));};
    if(challenge.checkpointId==='change-code-focus')return area==='scene'
      ?<section className="eq-change-artifact eq-change-scene" aria-label="在自己的作品中找修改位置"><h3>{node?`本人作品 · ${node.label}`:'本人基础作品 · 积木生成的代码'}</h3>{map?.ok?<pre>{node?.code??map.value.source}</pre>:<p>这份积木目前不能生成对应代码。先回到本人基础作品修复结构，再一起看。</p>}</section>
      :<div className="eq-change-stage-controls"><p className="eq-stage-question">先点本人作品的一处动作，看对应代码，再回应客户。</p>{map?.ok&&<div className="eq-change-own-nodes">{map.value.links.filter(link=>!['value','state'].includes(link.concept)).map(link=><button type="button" key={link.nodeId} data-change-node={link.concept} disabled={disabled} aria-pressed={node?.nodeId===link.nodeId} onClick={()=>pick(link)}>{link.label}</button>)}</div>}{!guided&&<button type="button" data-option-id="comparison" disabled={disabled||node?.concept!=='comparison'} onClick={()=>onAnswer(option('comparison'))}>用我找到的这处比较回应客户</button>}<div className="eq-change-other-choices">{['pin','delay'].map(id=><button type="button" key={id} data-option-id={id} disabled={disabled} onClick={()=>onAnswer(option(id))}>{option(id)?.label}</button>)}</div></div>;
    const proof=state.facts.baseEvidence;
    return area==='scene'
      ?<section className="eq-change-artifact eq-change-scene" aria-label="带着作品回客户桌前"><div className="eq-old-client-note"><small>基础需求 1.0.0 · 旧客户回信</small><strong>{proof?`${proof.report.cases.reduce((sum,c)=>sum+c.assertions.filter(a=>a.passed).length,0)} 条采样符合`:'旧记录暂不可用'}</strong><p>它看过450这条边界。新来信把边界移到600了。</p></div>{guided&&ownNode&&<div className="eq-change-node-detail"><strong>我刚找到的比较</strong><pre>{ownNode.code}</pre></div>}</section>
      :<div className="eq-stage-choices eq-change-evidence-choices" role="group" aria-label="选择带回客户桌面的检查"><button type="button" data-option-id="new-current-suite" disabled={disabled} onClick={()=>onAnswer(option('new-current-suite'),guided&&ownNode?{mappingNodeId:ownNode.nodeId}:null)}>{guided&&ownNode?'从本人比较修改，再给客户复测 →':'带当前作品去试新版客户场景'}</button><button type="button" data-option-id="old-report" disabled={disabled} onClick={()=>onAnswer(option('old-report'))}>只带这份旧通过回信</button><button type="button" data-option-id="edit-expected" disabled={disabled} onClick={()=>onAnswer(option('edit-expected'))}>{option('edit-expected')?.label}</button></div>;
  }
  if(challenge.checkpointId==='change-code-focus')return <section className="eq-change-artifact" aria-label="在自己的作品中找修改位置"><h3>这是你保留的作品</h3><p>先点一处看它实际生成的代码，再告诉林工你准备从哪里改。</p>
    {map?.ok?<><div className="eq-change-own-nodes">{map.value.links.filter(link=>!['value','state'].includes(link.concept)).map(link=><button type="button" key={link.nodeId} data-change-node={link.concept} disabled={disabled} aria-pressed={selected?.nodeId===link.nodeId} onClick={async()=>{setSelected(link);if(guided&&link.concept==='comparison'&&await onSelect?.(link)!==false)onAnswer(option('comparison'));}}>{link.label}</button>)}</div>{selected&&<div className="eq-change-node-detail"><strong>{selected.label}</strong><p>{selected.meaning}</p><pre>{selected.code}</pre></div>}
    {!guided&&<button type="button" data-option-id="comparison" disabled={disabled||selected?.concept!=='comparison'} onClick={()=>onAnswer(option('comparison'))}>用我找到的这处比较回应客户</button>}</>:<p>这份积木目前不能生成对应代码。先回到本人基础作品修复结构，再一起看。</p>}
    <details><summary>我想先改别的地方</summary>{['pin','delay'].map(id=><button type="button" key={id} data-option-id={id} disabled={disabled} onClick={()=>onAnswer(option(id))}>{option(id)?.label}</button>)}</details>
  </section>;
  const proof=state.facts.baseEvidence;
  return <section className="eq-change-artifact" aria-label="带着作品回客户桌前"><h3>工位里的旧客户回信</h3><div className="eq-old-client-note"><small>基础需求 1.0.0 · 旧作品的记录</small><strong>{proof?`${proof.report.cases.reduce((sum,c)=>sum+c.assertions.filter(a=>a.passed).length,0)} 条采样符合`:'旧记录暂不可用'}</strong><p>它看过450这条边界。客户这封新来信，已经把边界移到600了。</p></div><p>你准备带哪份作品、怎样回到客户面前？</p>
    {guided&&ownNode&&<div className="eq-change-node-detail"><strong>我刚找到的比较</strong><pre>{ownNode.code}</pre><p>从这行改边界，改好再用新版场景试。</p></div>}
    <button type="button" data-option-id="new-current-suite" disabled={disabled} onClick={()=>onAnswer(option('new-current-suite'),guided&&ownNode?{mappingNodeId:ownNode.nodeId}:null)}>{guided&&ownNode?'从我找到的这处比较修改，再给客户复测 →':'带当前作品去试新版客户场景'}</button>
    <button type="button" data-option-id="old-report" disabled={disabled} onClick={()=>onAnswer(option('old-report'))}>我想只带这份旧通过回信</button>
    <details><summary>我还有一个想法</summary><button type="button" data-option-id="edit-expected" disabled={disabled} onClick={()=>onAnswer(option('edit-expected'))}>{option('edit-expected')?.label}</button></details>
  </section>;
}
