import React from 'react';
import { FIRST_ORDER_ART, OFFICE_ART, EXPLORATION_ART } from './art.js';
import { StoryFigure } from './StoryFigure.jsx';
import { Notice, PageHeading } from './components.jsx';

export function ArtGallery() {
  const assets = [
    {id: 'exploration', title: '00 / 暮色研发室', use: '可探索工位的空间背景', asset: EXPLORATION_ART, variant: 'scene'},
    {id: 'office', title: '01 / 个人工位', use: '入职与我的工位', asset: {src: OFFICE_ART, alt: '暖阳中的原创研发工作室与林工', caption: '首轮工位场景'}, variant: 'scene'},
    {id: 'client', title: '02 / 客户阅读角', use: '首单邮件与需求讨论', asset: FIRST_ORDER_ART.customerScene, variant: 'scene'},
    {id: 'mentor', title: '03 / 林工独立立绘', use: 'NPC 对话、方案回顾', asset: FIRST_ORDER_ART.mentor, variant: 'portrait'},
    {id: 'kit', title: '04 / 首单工具箱', use: '工程准备与工作台入口', asset: FIRST_ORDER_ART.starterKit, variant: 'prop'},
  ];
  return <div className="eq-ui"><main className="eq-art-gallery"><a className="eq-art-back" href="./preview.html">← 返回可交互工位</a><PageHeading eyebrow="ENGINEER QUEST / ORIGINAL ART" title="第一份委托，发生在这里。" subtitle="原创场景、角色与道具。所有中文、引脚和操作继续使用网页组件。"/>
    <div className="eq-art-gallery-grid">{assets.map(item => <section className="eq-panel eq-art-card" key={item.id}><div className="eq-art-card-heading"><h2>{item.title}</h2><span>{item.use}</span></div><StoryFigure asset={item.asset} variant={item.variant}/></section>)}</div>
    <Notice>角色与元件托盘保留真实透明背景；棋盘格为预览底纹。元件图不代表采购清单、真实器件规格或接线标准。</Notice>
  </main></div>;
}
