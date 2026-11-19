import React,{useState} from 'react';
import {FullManualConsole} from './FullManualConsole.jsx';
import {TASKBOOK,suggestedTaskbookPage} from './illustrated-manual.js';
import wiringPicture from '../../docs/manual/assets/首单虚拟接线.svg?url';
import './student-field-pages.css';
import {guidedOutputComplete,experiencedFact} from './work-guidance.js';
import {graphicIntroFor,graphicIntroPending} from '../program-teaching/progression.js';
import {TeachingManual} from '../program-teaching/TeachingManual.jsx';

export function StudentManual(props){
  const {guided}=props,[mode,setMode]=useState(guided?'step':'library'),[bookOpened,setBookOpened]=useState(false),[libraryOpened,setLibraryOpened]=useState(!guided),[page,setPage]=useState(()=>suggestedTaskbookPage(props));
  const choose=next=>{if(next==='book')setBookOpened(true);if(next==='library')setLibraryOpened(true);setMode(next);};
  return <section className="eq-student-manual" aria-label="手册与任务书">
    <nav className="eq-student-reader-nav" aria-label="选择阅读资料">
      {guided&&<button type="button" aria-pressed={mode==='step'} onClick={()=>choose('step')}>本步图解</button>}
      <button type="button" aria-pressed={mode==='book'} onClick={()=>choose('book')}>首单图文任务书</button>
      <button type="button" aria-pressed={mode==='library'} onClick={()=>choose('library')}>工程资料</button>
      <a href={TASKBOOK.pdf} download="首单图文任务书.pdf">下载 PDF（12页）</a>
    </nav>
    {guided&&<div hidden={mode!=='step'} className="eq-student-step">{props.context==='blocks'&&graphicIntroPending(props.state)?<TeachingManual record={graphicIntroFor(props.state)}/>:<FieldPage {...props} onLibrary={()=>choose('library')}/>}</div>}
    {bookOpened&&<section hidden={mode!=='book'} className="eq-student-book" aria-label="首单图文任务书阅读">
      <div className="eq-student-book-controls"><label>翻到<select aria-label="任务书页码" value={page} onChange={e=>setPage(Number(e.target.value))}>{TASKBOOK.pages.map((title,i)=><option key={title} value={i+1}>{String(i+1).padStart(2,'0')} · {title}</option>)}</select></label>{guided&&<button type="button" onClick={()=>choose('step')}>回到本步图解</button>}<span>图片可点开放大；合上手册回原操作。</span></div>
      <iframe title="首单图文任务书 · 12页" src={`${TASKBOOK.base}index.html#page-${String(page).padStart(2,'0')}`} sandbox="allow-scripts"/>
    </section>}
    {libraryOpened&&<div hidden={mode!=='library'} className="eq-student-library"><FullManualConsole {...props}/></div>}
  </section>;
}
function FieldPage({initialSection='02.1',context,state,onLibrary}){
  const outputPractice=context==='blocks'&&!state?.facts?.baseReady&&!experiencedFact(state,'current_input_read_observed')&&!guidedOutputComplete(state);
  const kind=context==='income'||initialSection==='10.1'?'delivery':outputPractice?'output':/^(04|05|06)/.test(initialSection)?'wiring':/^08/.test(initialSection)?'code':/^07/.test(initialSection)?'program':/^09/.test(initialSection)&&context!=='mail'?'test':'input';
  return <article className="eq-field-page" aria-label="当前任务图解"><header><span>微光 · 工位手册</span><small>§{initialSection} · 合上后回到原来的操作</small></header>
    {kind==='delivery'&&<><h1>留下自己的修正，再确认本机保存。</h1><p>在交付页的工程便签里写一句：我发现了什么、改了哪里、怎样复测。写完刷新，确认便签和收入还在。</p><div className="eq-field-flow"><div><strong>自己的原型</strong><small>从空白做出的作品</small></div><b>→</b><div><strong>失败与修正</strong><small>实际结果怎样改变</small></div><b>→</b><div><strong>留在本机</strong><small>便签与软件交付记录</small></div></div><aside>这次交付是软件演示和本机合成收入。真实装置的编译、烧录与上电检查，需要另请现场老师带着完成。</aside></>}
    {kind==='output'&&<><h1>先由你指挥灯开和关。</h1><p>先按“让虚拟 LED 亮起来”，看右侧的实际灯；再按“让虚拟 LED 熄灭”，看它关掉。两种动作都亲手做过，再搭读取程序。</p><div className="eq-field-flow"><div><strong>你按开或关</strong><small>发出一个输出指令</small></div><b>→</b><div><i className="eq-field-bulb"/><strong>虚拟 LED</strong><small>看实际运行记录中的亮、灭</small></div></div><aside>这次小实验还不是会看环境的自动灯。先合上这一页，完成另一个开关动作；自己的程序下一步由你来搭。</aside></>}
    {kind==='input'&&<><h1>灯怎样知道桌面暗了？</h1><p>先看光照表，再按客户的约定，决定灯怎样回应。灯还不会自己工作时，可以先用手动开关演一遍。</p><div className="eq-field-flow"><div><i>◉</i><strong>光照表</strong><small>读此刻的环境</small></div><b>→</b><div><i>?</i><strong>客户的规则</strong><small>暗时亮，亮时灭</small></div><b>→</b><div><i className="eq-field-bulb"/><strong>灯</strong><small>给出开、关动作</small></div></div><p>光照表的读数越小，这个演示里就越暗。移开遮挡后再读一次，别一直用上一次的数。</p><aside>以后接真实装置：先断电，接好找老师检查，再上电。</aside></>}
    {kind==='wiring'&&<><h1>先接好光照模块，再接灯的回路。</h1><p>点一个端子，再点它要去的端子。接错时用“撤销”或从连接清单删除那条线。</p><figure><img src={wiringPicture} alt="本单真实端子：光照模块 VCC接5V、GND接公共地、AO接A0；D9经过电阻到LED A，LED K回公共地"/><figcaption>游戏里的同一组端子 · 电阻两端可互换，Uno的GND为公共地</figcaption></figure><div className="eq-field-two"><section><h2>先让模块工作</h2><p>VCC → 5V<br/>GND → GND<br/>AO → A0</p></section><section><h2>再让灯形成回路</h2><p>D9 → 电阻 → LED A<br/>LED K → GND</p></section></div><aside>AO 的最后一位是字母 O，A0 的最后一位是数字 0。接成 A1 时，程序从 A0 读不到这根信号。</aside></>}
    {kind==='program'&&<><h1>{initialSection==='07.2'?'让它判断，并不断重新看。':'先把一个读数放进小盒子。'}</h1><p>入口是整份程序的家。“变量”里给 light 这个盒子贴名字；“持续执行”里安排每次要做的动作。</p><div className="eq-field-blocks"><div>程序入口<div>变量：<span>声明 light · 整数 · 初值 <b>0</b></span></div><div>持续执行：<span>light 设为 <b>读取 LIGHT</b></span><span>{initialSection==='07.2'?'如果 〈light 小于 450〉→ 两条输出路':'先观察读到了什么'}</span><span>等待 <b>100</b> 毫秒，再开始下一轮</span></div></div></div><p>拖动作接在流程上；数值接进凹槽。接不准时，用工具栏的“精确槽位”选中那一个空槽，看高亮再拖。点“查看完整积木”能把作品放回视野。</p><aside>先做当前小实验；不需要一次搭好整盏自动灯。少一块时，看看林工指出的是哪个槽。</aside></>}
    {kind==='code'&&<><h1>还是自己的作品，只是换成文字。</h1><p>打开“我保留的积木 ↔ 生成代码”，点自己的比较，找到决定灯何时亮的那个数字。</p><div className="eq-field-flow"><div><strong>自己的比较积木</strong><small>光照 与 450 作比较</small></div><b>↔</b><div><code>light &lt; 450</code><small>同一条“小于”规则</small></div></div><p>客户这次把边界换成600。500在旧规则下灭，在新规则下亮；等于600时仍应灭。修改后要让客户试新作品。</p><details><summary>看当前文字，自己定位</summary><pre>{state?.attempt?.draft.shortSource||'先保留自己的基础作品，再来看对应的文字。'}</pre></details></>}
    {kind==='test'&&<><h1>先看灯在哪一刻和客户想的不一样。</h1><div className="eq-field-flow"><div><strong>这次光照</strong><small>客户给出的输入</small></div><b>→</b><div><strong>客户想要的灯</strong><small>亮，还是灭？</small></div><b>↔</b><div><strong>自己的实际灯</strong><small>程序真的做了什么？</small></div></div><p>先看第一个失败场景，再回自己的比较、分支或等待去改。改好后用同一个客户场景复测，旧回信留作自己的过程记录。</p><aside>软件演示结束后，实物操作交给老师带着检查。这里不会代替真实设备上电。</aside></>}
    <footer><p>只需要眼前这一页。随时合上，作品和当前操作会留着。</p><details><summary>查更多工程资料</summary><p>完整原手册、参考实现、教师与研发附录保留在资料库。首次操作无需通读。</p><button type="button" onClick={onLibrary}>打开完整资料库</button></details></footer>
  </article>;
}
