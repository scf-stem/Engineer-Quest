import React, { useId } from 'react';
import { Icon } from './icons.jsx';
import { FIRST_ORDER_ART, OFFICE_ART } from './art.js';
import { StoryFigure } from './StoryFigure.jsx';

export { OFFICE_ART } from './art.js';

export function StatusBadge({ children, tone = 'neutral' }) {
  return <span className={`eq-badge eq-badge--${tone}`}><span className="eq-status-dot" aria-hidden="true"/>{children}</span>;
}

export function ActionButton({ children, variant = 'primary', icon, className = '', type = 'button', ...props }) {
  return <button type={type} className={`eq-button eq-button--${variant} ${className}`} {...props}>{children}{icon && <Icon name={icon} size={18}/>}</button>;
}

export function EmployeePass({ employee, onEdit }) {
  return <section className="eq-employee-pass" aria-label="个人员工证">
    <div className="eq-pass-clip" aria-hidden="true"/>
    <div className="eq-pass-heading"><span>EMPLOYEE PASS</span><Icon name="chip" size={18}/></div>
    <div className="eq-employee-avatar" aria-hidden="true">{employee.nickname?.slice(0, 1) || '工'}<span>✦</span></div>
    <h2>{employee.nickname || '新员工'}</h2><p>{employee.role || '见习工程师'}</p>
    <code>{employee.employeeId || '待领取员工证'}</code>
    <div className="eq-pass-rule"/>
    <small>{employee.synthetic ? '合成员工 · 个人体验' : '个人研发工位'}</small>
    {onEdit && <button type="button" className="eq-text-button" onClick={onEdit}>编辑昵称 <Icon name="arrow" size={14}/></button>}
  </section>;
}

export function StageRoute({ stages, activeStage, onStageSelect }) {
  return <section className="eq-route"><div className="eq-section-kicker">这份订单的旅程 <span>01—06</span></div>
    <ol>{stages.map((stage, index) => <li key={stage.id} className={`eq-stage eq-stage--${stage.state || 'upcoming'} ${activeStage === stage.id ? 'eq-stage--selected' : ''}`}>
      <button type="button" onClick={() => onStageSelect?.(stage.id)} disabled={!onStageSelect || stage.disabled} aria-label={`${stage.title}，${stage.subtitle}`} aria-current={activeStage === stage.id ? 'step' : undefined}>
        <span className="eq-stage-number" aria-hidden="true">{stage.state === 'complete' ? <Icon name="check" size={14}/> : String(index + 1).padStart(2, '0')}</span>
        <span><strong>{stage.title}</strong><small>{stage.subtitle}</small></span>
        <span className="eq-sr-only">{stage.state === 'complete' ? '已完成' : stage.state === 'current' ? '当前阶段' : '后续阶段'}</span>
      </button>
    </li>)}</ol>
  </section>;
}

export function QuestShell({ employee, stages = [], activeStage, onStageSelect, activeView = 'desk', onViewChange, unreadCount = 0, children, onOpenManual, onRequestHelp, status = '本地视觉演示', footer = '合成数据 / 不代表课程通关、实物验收或真实收入', tools, sidebarExtra }) {
  const mainId = useId();
  const views = [ ['desk', '我的工位', 'desk'], ['mail', '公司邮箱', 'mail'], ['workbench', '电子工作台', 'chip'], ['income', '收入榜', 'chart'] ];
  return <div className="eq-ui">
    <a className="eq-skip-link" href={`#${mainId}`}>跳到主要内容</a>
    <header className="eq-topbar"><a className="eq-brand" href="#" onClick={event => {event.preventDefault(); onViewChange?.('desk');}} aria-label="Engineer Quest 我的工位"><span className="eq-brand-mark" aria-hidden="true"><Icon name="chip" size={27}/></span><span>ENGINEER <b>QUEST</b><small>未来工程师 · 研发体验所</small></span></a>
      <div className="eq-mobile-tools">{onOpenManual && <button type="button" className="eq-icon-button" onClick={onOpenManual} aria-label="打开工程手册"><Icon name="book" size={17}/></button>}{onRequestHelp && <button type="button" className="eq-icon-button" onClick={onRequestHelp} aria-label="向老师求助"><Icon name="help" size={17}/></button>}</div>
      <nav className="eq-main-nav" aria-label="主要导航">{views.map(([id, label, icon]) => <button type="button" key={id} onClick={() => onViewChange?.(id)} disabled={!onViewChange} aria-label={id === 'mail' && unreadCount > 0 ? `${label}，${unreadCount} 封未读` : label} aria-current={activeView === id ? 'page' : undefined}><Icon name={icon}/><span>{label}</span>{id === 'mail' && unreadCount > 0 && <span className="eq-unread-dot" aria-hidden="true"/>}</button>)}</nav>
      <div className="eq-topbar-status"><StatusBadge tone="green">{status}</StatusBadge></div>
    </header>
    <div className="eq-layout"><aside className="eq-sidebar"><EmployeePass employee={employee}/><StageRoute stages={stages} activeStage={activeStage} onStageSelect={onStageSelect}/>
      <div className="eq-sidebar-actions"><ActionButton variant="paper" icon="book" onClick={onOpenManual} disabled={!onOpenManual}>工程手册 <small>随时翻一翻</small></ActionButton>{onRequestHelp && <button type="button" className="eq-text-button" onClick={onRequestHelp}><Icon name="help" size={17}/>遇到困难，找老师</button>}</div>{sidebarExtra}
    </aside><main id={mainId} className="eq-main" tabIndex={-1}>{tools}{children}</main></div>
    <footer className="eq-footer"><span>EQ / 研发体验所</span><span>{footer}</span><span>BUILD SOMETHING THAT MATTERS.</span></footer>
  </div>;
}

export function PageHeading({ eyebrow, title, subtitle, trailing }) {
  return <div className="eq-page-heading"><div><p className="eq-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="eq-subtitle">{subtitle}</p>}</div>{trailing}</div>;
}

export function OfficeHero({ onOpenMail, artSrc = OFFICE_ART }) {
  return <section className="eq-office-hero"><img className="eq-office-art" src={artSrc} alt="原创场景：暖阳照进电子研发工作室，一位戴圆眼镜的工程师站在工位旁" fetchPriority="high"/>
    <div className="eq-office-copy"><span className="eq-tape-label">欢迎来到研发部</span><h2>今天，<br/>让想法亮起来。</h2><p>一张工位，一份委托。<br/>从第一个「为什么」开始。</p><ActionButton icon="arrow" onClick={onOpenMail} disabled={!onOpenMail}>查看我的第一份委托</ActionButton></div>
    <span className="eq-scene-caption">研发体验所 / 午后工位 · 风格小样</span>
  </section>;
}

export function TaskMail({ task, compact = false, onOpen, scene, children }) {
  return <article className={`eq-panel eq-task-mail ${compact ? 'eq-task-mail--compact' : ''}`}>
    <div className="eq-mail-top"><span className="eq-envelope-stamp"><Icon name="mail" size={22}/></span><div><p className="eq-eyebrow">客户来信 / ORDER 001</p><span>来自：{task.client}</span></div><span className="eq-mail-date">新委托</span></div>
    <h2>{task.title}</h2><p className="eq-mail-body">{task.description}</p>
    {!compact && <p className="eq-mail-scope">{task.scope}</p>}
    {scene && !compact && <StoryFigure asset={scene}/>}
    <div className="eq-chips"><span>Arduino Uno</span><span>基础材料免费</span><span>个人项目</span></div>
    {children}{onOpen && <div className="eq-card-bottom"><small>先理解需求，再开始接线</small><ActionButton variant="text" icon="arrow" onClick={onOpen}>打开委托</ActionButton></div>}
  </article>;
}

export function NpcReviewPanel({ name = '林工', role = '需求负责人', mode = 'static', question, citation, onOpenManual, children, artSrc, portraitSrc }) {
  const portrait = portraitSrc || !artSrc;
  return <section className="eq-panel eq-npc-panel"><div className="eq-npc-heading"><div className={`eq-npc-avatar ${portrait ? 'eq-npc-avatar--portrait' : ''}`}><img src={portraitSrc || artSrc || FIRST_ORDER_ART.mentor.src} alt={`${name}的原创角色插画`} loading="lazy"/></div><div><h2>{name}<span>{role}</span></h2><StatusBadge tone="green">{mode === 'ai' ? 'AI 建议 · 依据需核查' : '静态问题卡'}</StatusBadge></div></div>
    <div className="eq-speech"><span aria-hidden="true">“</span><p>{question}</p></div>
    {citation && <button type="button" className="eq-citation" onClick={onOpenManual} disabled={!onOpenManual}><Icon name="book" size={16}/>{citation}</button>}
    {children}<p className="eq-fine-print">{mode === 'ai' ? '建议不授予通关或安全批准。' : '本地预设内容，尚未连接在线 AI。'}</p>
  </section>;
}

export function StarterKitCard({ asset = FIRST_ORDER_ART.starterKit, onOpenWorkbench }) {
  return <section className="eq-bench-invitation eq-starter-kit-card"><StoryFigure asset={asset} variant="prop" caption=""/><div><p className="eq-eyebrow">首单工具箱 / 基础材料免费</p><h2>在电子工作台，把想法连起来。</h2><p>先认识元件，再查手册、做接线方案。</p><small>插画只表示元件类别，具体规格以手册为准。</small></div><ActionButton variant="paper" icon="arrow" onClick={onOpenWorkbench} disabled={!onOpenWorkbench}>看看工作台</ActionButton></section>;
}

export function WorkbenchFrame({ tabs, activeTab, onTabChange, toolbar, children, detail, status = '图形示意 · 未运行程序' }) {
  const panelId = useId();
  return <section className="eq-workbench-frame" aria-label="电子工作台"><div className="eq-workbench-top"><span><Icon name="chip" size={18}/> ENGINEERING BENCH</span><span>{status}</span></div>
    <div className="eq-workbench-tabs" role="tablist" aria-label="工作台工具">{tabs.map((tab, index) => <button type="button" key={tab.id} id={`${panelId}-tab-${tab.id}`} role="tab" aria-selected={activeTab === tab.id} aria-controls={panelId} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => onTabChange?.(tab.id)} onKeyDown={event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {event.preventDefault(); onTabChange?.(tabs[next].id); document.getElementById(`${panelId}-tab-${tabs[next].id}`)?.focus();}
    }}>{tab.label}</button>)}</div>
    {toolbar && <div className="eq-workbench-toolbar">{toolbar}</div>}
    <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${activeTab}`} tabIndex={0} className="eq-workbench-content">{children}</div>{detail && <div className="eq-workbench-detail">{detail}</div>}
  </section>;
}

export function Notice({ children, tone = 'neutral' }) {return <div className={`eq-notice eq-notice--${tone}`}><Icon name={tone === 'warm' ? 'bulb' : 'link'} size={18}/><div>{children}</div></div>;}

export function Dialog({ title, children, onClose, className = '' }) {
  const ref = React.useRef(null);
  const titleId = useId();
  React.useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {dialog.close(); previous?.focus();};
  }, []);
  return <dialog className={`eq-ui eq-dialog ${className}`} ref={ref} aria-labelledby={titleId} onCancel={event => {event.preventDefault(); onClose();}}><div className="eq-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="eq-icon-button" onClick={onClose} aria-label="关闭对话框"><Icon name="close"/></button></div>{children}</dialog>;
}
