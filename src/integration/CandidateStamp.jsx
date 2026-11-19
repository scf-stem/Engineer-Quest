import React,{useState} from 'react';
import {Dialog} from '../ui/index.js';
export const buildIdentity=typeof __EQ_BUILD__==='undefined'?{id:'unversioned-harness',mode:'test-harness'}:__EQ_BUILD__;
export function CandidateStamp(){
  const [open,setOpen]=useState(false),build=buildIdentity;
  return <><button type="button" className="eq-build-stamp" onClick={()=>setOpen(true)} aria-label="查看候选版本">{build.mode==='frozen-candidate'?'候选':'开发'} {build.id.replace('dialogue-','')}</button>{open&&<Dialog className="eq-game-modal" title="当前页面候选版本" onClose={()=>setOpen(false)}><div className="eq-build-details"><p>候选：{build.id}</p><p>模式：{build.mode}</p><p>源码提交：{build.sourceRevision??'独立测试页'}</p><p>构建时相关文件{build.sourceDirty?'尚有修改':'与提交一致'}</p><p>内容 SHA256：{build.sourceDigest??'测试入口未绑定候选'}</p><p>独立试玩请先记录候选号和 SHA。开发预览会热更新，不能据此声称固定版本已经验收。</p></div></Dialog>}</>;
}
