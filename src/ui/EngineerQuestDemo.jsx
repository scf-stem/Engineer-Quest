import React, { useState } from 'react';
import { ActionButton, Dialog, Notice, NpcReviewPanel, OfficeHero, PageHeading, QuestShell, StarterKitCard, StatusBadge, TaskMail, WorkbenchFrame } from './components.jsx';
import { FIRST_ORDER_ART } from './art.js';
import { TerminalIllustration } from './TerminalIllustration.jsx';
import { RequirementDraftForm } from './RequirementDraftForm.jsx';
import { Icon } from './icons.jsx';
import { DEMO_EMPLOYEE, DEMO_INCOME, DEMO_STAGES, DEMO_TASK, REQUIREMENT_FIELDS } from './fixtures.js';

const TOOL_TABS = [{id: 'wiring', label: '01 硬件接线'}, {id: 'blocks', label: '02 积木 Demo'}, {id: 'code', label: '03 简写 C++'}, {id: 'tests', label: '04 客户测试'}];
const PIN_NOTES = { '5V': '电源端子。实际模块额定电压、板卡型号和供电方式需由硬件规范及教师确认。', GND: '公共参考地。具体连接须由接线模块校验，本示意不作电气判断。', A0: '模拟输入候选：接收传感器读数。量程与明暗方向尚需器件校准。', D9: '灯控输出候选。LED 需要限流；本图不能用于真实接线或上电。' };

/** Synthetic state lives here only; reusable components never award passes or income. */
export function EngineerQuestDemo({ slots = {} }) {
  const [view, setView] = useState('desk');
  const [tool, setTool] = useState('wiring');
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState({});
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selectedPin, setSelectedPin] = useState(null);
  const [showReference, setShowReference] = useState(false);
  const currentQuestion = REQUIREMENT_FIELDS.find(field => !draft[field.id])?.question || '环境从暗变亮时，你的方案会怎样响应？请用自己的话解释。';
  function selectStage(id) {
    if (id === 'onboarding') return setDialog('employee');
    if (id === 'delivery') return setDialog('delivery');
    if (id === 'requirements') return setView('mail');
    setTool(id); setView('workbench');
  }
  return <QuestShell employee={DEMO_EMPLOYEE} stages={DEMO_STAGES} activeStage="requirements" onStageSelect={selectStage} activeView={view} onViewChange={setView} unreadCount={1} onOpenManual={() => setDialog('manual')} onRequestHelp={() => setDialog('help')}>
    {view === 'desk' && <>
      <PageHeading eyebrow="研发部 / 我的个人工位" title="早上好，见习工程师。" subtitle="第一份客户委托已送达，准备好开始了吗？" trailing={<span className="eq-desk-number">DESK <b>017</b><span>个人工位</span></span>}/>
      <OfficeHero onOpenMail={() => setView('mail')}/>
      <div className="eq-dashboard-grid"><TaskMail task={DEMO_TASK} compact onOpen={() => setView('mail')}/><NpcReviewPanel question="先别急着选元件。试着想一想：装置怎么知道，天色变暗了？" citation="手册目录草案 · 输入 / 判断 / 输出" onOpenManual={() => setDialog('manual')}><ActionButton variant="paper" icon="arrow" onClick={() => setView('mail')}>和林工读需求</ActionButton></NpcReviewPanel></div>
      <div className="eq-bottom-grid"><StarterKitCard onOpenWorkbench={() => setView('workbench')}/><section className="eq-sticky-note"><span className="eq-note-pin" aria-hidden="true"/><h2>工位便签</h2><p>✓ 不用先会编程<br/>✓ 基础材料免费<br/>↗ 卡住了，随时找老师</p></section></div>
    </>}
    {view === 'mail' && <>
      <PageHeading eyebrow="公司邮箱 / 客户委托 001" title="先把需求，聊明白。" subtitle="客户说的是一个场景，你要把它变成清楚的方案。" trailing={<StatusBadge tone="coral">需求草稿</StatusBadge>}/>
      <div className="eq-mail-layout"><div className="eq-mail-main"><TaskMail task={DEMO_TASK} scene={FIRST_ORDER_ART.customerScene}/><RequirementDraftForm fields={REQUIREMENT_FIELDS} value={draft} onChange={next => {setDraft(next); setFeedback('草稿已修改，尚未保存本次演示。');}} explanation={explanation} onExplanationChange={next => {setExplanation(next); setFeedback('草稿已修改，尚未保存本次演示。');}} onSave={() => setFeedback('已记录本次演示草稿；未评判答案，未授予通关。刷新后会清空。')} feedback={feedback}/></div><div className="eq-mail-side"><NpcReviewPanel question={currentQuestion} citation="手册目录草案 · 读懂客户需求" onOpenManual={() => setDialog('manual')}/><section className="eq-sticky-note"><h2>这一站的成果</h2><p>一张你能自己解释的中文方案卡。</p><small>元件和代码，下一步再认识。</small></section><Notice>静态问题只按未填字段提示，不评判你的解释。正式评审尚未启用。</Notice></div></div>
    </>}
    {view === 'workbench' && <>
      <PageHeading eyebrow="研发部 / 电子工作台" title="想法开始有了形状。" subtitle="认识每个端子，查清用途，再开始你的接线方案。" trailing={<StatusBadge tone="coral">硬件未校准</StatusBadge>}/>
      <WorkbenchFrame tabs={TOOL_TABS} activeTab={tool} onTabChange={setTool} toolbar={tool === 'wiring' ? <><span>Arduino Uno 家族 <small>具体型号待确认</small></span><ActionButton variant="paper" onClick={() => {setShowReference(!showReference); setSelectedPin(null);}} aria-pressed={showReference}>{showReference ? '隐藏连线构图' : '查看连线构图'}</ActionButton></> : <span>工具预览 / 当前尚未启用编辑与运行</span>} detail={tool === 'wiring' ? <><div><strong>{selectedPin ? `${selectedPin} / 端子说明` : '点选主板右侧 4 个端子，查看用途'}</strong><p>{selectedPin ? PIN_NOTES[selectedPin] : '支持鼠标与键盘 Tab。此处为外观小样，不保存接线，不作校验。'}</p></div><StatusBadge>外观示意</StatusBadge></> : <Notice>当前没有运行程序。客户测试的预期将来自独立需求版本。</Notice>}>
        {slots[tool] || (tool === 'wiring' ? <TerminalIllustration selectedTerminal={selectedPin} onSelectTerminal={setSelectedPin} showReference={showReference}/> : <div className="eq-tool-placeholder"><Icon name={tool === 'tests' ? 'chart' : 'chip'} size={38}/><h2>{tool === 'blocks' ? '在这里搭建你的积木方案' : tool === 'code' ? '在这里阅读和修改简写 C++' : '在这里查看独立客户测试'}</h2><p>{tool === 'tests' ? '输入、客户预期、实际结果与相关步骤将并排呈现。' : '使用同一份作品与接线版本。编辑器尚未启用。'}</p><span className="eq-placeholder-label">工具尚未启用 · 无通过结果</span>{tool === 'tests' && <div className="eq-test-columns"><span>模拟输入<br/><b>等待实际数据</b></span><span>客户预期<br/><b>来自独立需求版本</b></span><span>实际结果<br/><b>尚未运行</b></span></div>}</div>)}
      </WorkbenchFrame><Notice tone="warm">本页仅是可交互外观示意，连线构图不用于实物操作。真实接线、上电和烧录之后须经现场教师检查。</Notice>
    </>}
    {view === 'income' && <>
      <PageHeading eyebrow="公司公告栏 / 个人收入" title="每一份交付，都有回响。" subtitle="用收入记录完成的工作。探索慢一点，也没有关系。" trailing={<StatusBadge tone="coral">全部为合成数据</StatusBadge>}/>
      <section className="eq-income-summary"><Icon name="coin" size={40}/><div><p>我的累计收入</p><strong>0 <small>EC 工程币</small></strong></div><span>演示初始值<br/>尚无真实结算</span></section>
      <section className="eq-panel eq-income-board"><h2>个人收入榜 <span>样式预览</span></h2><p>按累计收入展示，余额和消费另行记录。排序及公开范围仍待冻结。</p><div className="eq-table-scroll"><table><caption className="eq-sr-only">合成员工的个人累计收入示意，非真实账本</caption><thead><tr><th scope="col">展示顺序</th><th scope="col">合成员工</th><th scope="col">累计收入</th><th scope="col">说明</th></tr></thead><tbody>{DEMO_INCOME.map((row, index) => <tr key={row.id} className={row.self ? 'eq-income-self' : ''}><td>{String(index + 1).padStart(2, '0')}</td><th scope="row">{row.name}{row.self && <small>我的演示身份</small>}</th><td>{row.income} <small>EC</small></td><td>合成展示</td></tr>)}</tbody></table></div></section><Notice>工程币仅为游戏概念；此界面不发放奖励、不购买零件。商城在完成基础交付并核验元件支持后开放。</Notice>
    </>}
    {dialog && <Dialog title={{manual: '工位上的工程手册', help: '需要时，让老师搭把手', employee: '你的个人员工证', delivery: '之后，把作品带到真实桌面'}[dialog]} onClose={() => setDialog(null)}>
      {dialog === 'manual' && <><p>当前为目录风格小样。正式节号与内容由课程专项冻结，不冒充已完成的学生手册。</p><ul className="eq-manual-list"><li><Icon name="mail"/>读懂需求：输入、判断、输出、持续工作</li><li><Icon name="chip"/>认识开发板、传感器和限流元件</li><li><Icon name="link"/>接线规则与排错依据</li><li><Icon name="book"/>积木与简写 C++ 速查</li></ul><Notice tone="warm">网站告诉你现在做什么，手册解释依据什么知识和规则做。</Notice></>}
      {dialog === 'help' && <><p>课堂中可以举手，请老师一起看当前步骤。</p><Notice>此按钮只展示求助说明，尚未发送请求，也没有建立教师队列。</Notice></>}
      {dialog === 'employee' && <><p>这里以「{DEMO_EMPLOYEE.nickname}」演示个人参与。员工编号与入职完成状态均为合成展示。</p><Notice>没有真实账号或学生数据，也没有组队与共享作品。</Notice></>}
      {dialog === 'delivery' && <><p>断电接线 → 教师安全检查 → 上电与烧录 → 学生自测 → 教师功能验收。</p><Notice tone="warm">当前没有烧录、硬件回读或教师签核功能。软件结果不能证明实物已通过。</Notice></>}
      <ActionButton variant="paper" onClick={() => setDialog(null)}>回到工位</ActionButton>
    </Dialog>}
  </QuestShell>;
}
