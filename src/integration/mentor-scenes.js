import {inspectProgramWorkspace,explainProgramDiagnostic} from '../program/index.js';
import {latestObservationAction,observationFrames,observationIsCurrent} from './observation-model.js';
import {blocksToProgram} from '../program/index.js';
import {wiringJourney} from './wiring-journey.js';
import {readingGuidance,wiringIsReview} from './work-guidance.js';

const workLines={
  'observe-output':['先别急着写整盏灯。你给我一个开或关的指令，我们看看输出是什么。','你按一次点灯，我陪你看右边的 LED。这是小试验，自己的程序一会儿由你来搭。'],
  'read-input':['刚才我们能让灯动了。现在给装置一双“眼睛”：让它读此刻的光照。','先搭入口、变量、读取和等待。你运行一次，我会和你对照仪表与程序读到的数。'],
  'branch-output':['它读到了数。接下来让这个数决定灯做什么，你来给暗处和亮处各安排一条路。','搭好后，我们分别试暗和亮。我不替你按，两个分支都要亲眼看一遍。'],
  'repeat-read':['两个方向都有动作了。但窗边不会只变化一次，咱们让它暗、亮、再暗。','运行一次连续变化，看它有没有重新读取。一直使用开机那次的数，就会跟不上。'],
  'base-delivery':['这份原型已经能回应我们刚才的操作。把它交给客户试一试吧。','有失败也没关系。先找哪一刻和客户想的不一样，再回来改那一小块。'],
  'code-mapping':['这张图就是你搭的作品，不是另一份标准答案。帮我找找，哪一处比较决定了明暗边界？','点自己的比较节点，我们一起看它变成了哪一行代码。'],
  'change-delivery':['客户说想更早亮灯。接线不用重来，你刚才找到的比较，正好能回应这个变化。','改完先别凭感觉交付。用客户的新场景试自己的这份代码，我陪你看第一次不同。'],
};
const why={
  'observe-output':'程序把开、关送到灯，这叫输出。光照表把环境的数送进来，那才是输入。',
  'read-input':'变量像临时放读数的小盒子。每次重新读，再放进去；只记住第一次的数，后来的变化就看不见了。',
  'branch-output':'条件只回答真或假。两个分支分别给动作，灯才能从亮变灭；只写开灯会留下旧状态。',
  'repeat-read':'循环不是重复旧答案，而是重新读取、重新判断，再更新输出。右侧的时间和读数能帮我们分清。',
  'base-delivery':'我们自己试过的两个位置还不够。客户会另外看边界、往返变化和响应时间，预期不会跟着程序改。',
  'code-mapping':'积木和文字都在表达同一个动作。找到自己的比较再修改，就不用重抄整段程序。',
  'change-delivery':'500 能分清旧版与新版：旧边界450下应灭，新边界600下应亮。等于600时仍应灭。',
};
function pin(value){return String(value??'端子').replace(/^uno:/,'开发板 ').replace(/^sensor:/,'光照模块 ').replace(/^resistor:/,'电阻 ').replace(/^led:/,'LED ');}

/** Scene identities change on actual wiring, structure, action and test events. No completion writes. */
export function mentorScene({state,phase='blocks',tool='program',draft=state.attempt?.draft,topology,activityId}){
  const attempt=state.attempt,facts=state.facts,position=facts.practice?.[phase]?.current??facts.learning?.current;
  if(tool==='wiring'){
    const wires=draft?.wiring?.connections??[],last=wires.at(-1),error=topology?.diagnostics?.find(d=>d.severity==='error');
    if(attempt?.presentation?.journey&&topology?.ok&&wiringIsReview(state))return {id:`wire-review:${wires.map(w=>w.from+'>'+w.to).join('|')}`,place:'林工 · 回看自己的装置',manualSection:'06.1',lines:['这是你已经接好、点过灯的装置，线路还在。回到当前作品继续就好，不用重新做一次点灯练习。'],help:'想改线可以撤销或重新连接。修改后，受影响的观察需要用当前线路复核，旧作品和记录会保留。',why:'回看线路与重新完成学习是两件事。这里显示实际连线，不会清空你已经走过的教学位置。'};
    if(state.attempt?.presentation?.journey){const journey=wiringJourney(draft.wiring,topology);return {id:`wire-story:${wires.map(w=>w.from+'>'+w.to).join('|')}`,place:'林工 · 陪你接当前这条线',manualSection:'06.1',lines:[journey.message],help:journey.next?`先在画布找到 ${pin(journey.next.from)}，再点 ${pin(journey.next.to)}。接错可撤销。`:'查看画布高亮的两个端点。',why:'供电让模块工作，信号把读数送进程序。灯的回路要串联电阻。'};}
    return {id:`wire:${wires.map(w=>w.from+'>'+w.to).join('|')}:${topology?.ok}`,place:'电子工位 · 认识彼此的端子',manualSection:'06.1',
      lines:!wires.length?['先把工具箱摊开。你想先认识光照模块，还是 LED？点画布里的元件，我陪你看用途。','接线时，点第一个端子，再点要去的端子。也能用键盘 Enter；没有接线前不用担心满屏错误。']:topology?.ok?[`你刚接好 ${pin(last?.from)} 和 ${pin(last?.to)}。现在虚拟模型里的输入、输出路径齐了。`,'把这份装置带到积木工位。先让灯亮一下，再给它一双能读光照的眼睛。']:[`这根线连到了 ${pin(last?.from)} ↔ ${pin(last?.to)}，我看到了。`,error?`还差的地方里，先看这一项：${error.message}`:'继续按元件资料连接；现在还不能说明装置能按需求工作。'],
      help:error?.message||'先找光照模块的 VCC、GND、AO，再对照手册的端子名。先做一条，不用一次记六条。',why:'供电让模块工作，信号线把光照读数送到程序；LED 还需要串联限流电阻。这里先检查有限的虚拟规则，实物上电要请现场教师检查。'};
  }
  const id=activityId??position?.id??(facts.baseReady&&phase==='blocks'?'base-delivery':'change-delivery'),inspection=inspectProgramWorkspace(draft?.blockState?.workspace??draft?.blockState,{activityId:id});
  if(attempt?.presentation?.journey&&id==='read-input')inspection.guidance={...inspection.guidance,...readingGuidance(draft?.blockState)};
  const action=latestObservationAction(state,phase),frames=observationFrames(action),frame=frames.at(-1);
  const current=observationIsCurrent(action,{program:blocksToProgram(draft?.blockState?.workspace??draft?.blockState),source:draft?.shortSource,wiring:draft?.wiring});
  const proof=attempt?.tests.findLast(t=>t.phase===phase),testCurrent=phase==='blocks'?facts.baseCurrent:facts.codeCurrent;
  const requested=attempt?.learningActions.findLast(a=>a.kind==='program-action'&&a.request.phase===phase);
  const fault=requested?.result?.diagnostics?.[0]??requested?.result?.value?.simulation?.diagnostics?.[0];
  const recent=[];
  if(current&&frame){recent.push(frame.light===null?`刚才你让 LED ${frame.lamp?'亮了':'熄灭了'}。这是你发出的输出。`:`你刚运行的记录里，光照读到 ${frame.light}，LED ${frame.lamp===true?'亮':frame.lamp===false?'灭':'还没有有效状态'}${typeof frame.branch==='boolean'?`，最近一次判断为${frame.branch?'真':'假'}`:''}。`);}
  if(proof&&testCurrent){const failed=proof.report.cases.find(c=>!c.passed);recent.push(proof.report.passed?'客户刚试过这份作品，这一版的场景都通过了。':`客户在“${failed?.name??'这次场景'}”遇到了不同的结果。先看期望与实际，再回来定位，作品不用丢掉。`);}
  if(phase==='blocks'&&id!=='observe-output'&&!inspection.canRun){if(recent.length)recent[recent.length-1]+=' '+inspection.guidance.observation;else recent.push(inspection.guidance.observation);}
  if(fault){const help=explainProgramDiagnostic(fault,{blockState:draft?.blockState?.workspace??draft?.blockState});recent.push(`刚才运行停住了：${help.observation} ${help.nextAction}`);}
  const lines=[...recent.slice(-1),...(workLines[id]??workLines['change-delivery'])];
  if(activityId==='observe-output'&&frame&&action?.request.actionId==='observe-output')lines.splice(0,lines.length,frame.lamp?'你刚让 LED 亮起来了。现在按“让虚拟 LED 熄灭”，亲手看一次关的动作。':'灯已经按你的指令熄灭了。再按“让虚拟 LED 亮起来”，看一次开的动作。','等你亲手试过开和关，我们再让装置自己读取环境。');
  if(facts.baseReady&&phase==='blocks')lines.splice(0,lines.length,'基础原型收到了客户的通过回信。你已经有一份自己的作品了。','客户又发来一个小变化。保留这张积木图，我们一起看看文字代码能怎样接着改。');
  return {id:`${phase}:${id}:${requested?.id}:${action?.id}:${proof?.id}:${testCurrent}:${inspection.state}:${inspection.guidance.focus?.blockType}:${inspection.observations.map(o=>o.observed).join('')}`,place:phase==='blocks'?'程序工位 · 你动手，我陪着看':'变更来信 · 从自己的作品继续',manualSection:activityId==='observe-output'?'03.1':position?.actionTarget?.manualSection??'07.1',lines,help:id==='observe-output'?why[id]:id==='read-input'&&inspection.state==='empty'?'先拖一个程序入口，在变量区声明 light、整数、初值0；在持续执行里放变量 light 赋值，把读取 LIGHT 接进值槽，再接等待100毫秒。':inspection.canRun?(why[id]??'先对照这一次的真实结果，再改眼前这一处。'):inspection.guidance.nextAction,why:why[id]};
}
