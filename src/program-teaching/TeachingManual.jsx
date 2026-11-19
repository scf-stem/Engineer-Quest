import React from 'react';

/** Two supplied sample pages, adapted to the real local controls. No 24-page edition is implied. */
export function TeachingManual({record}){
  const reading=record.phase.startsWith('g3');
  return <article className="eq-field-page eq-intro-manual" aria-label="当前入门操作图解">
    <header><span>微光 · 桌边操作页</span><small>{reading?'P09 · 读取':'P07 · 连接'} · 合上回到当前作品</small></header>
    {reading?<><h1>环境变了，再主动读一次。</h1><figure><img src="/art/program-teaching/read-block.svg" alt="实际LIGHT读取块的值凸口"/></figure><ol><li>从工具托盘拿起 LIGHT 读取块，接进“观察读数”的值位。它给出一个数字，不接在动作后面。</li><li>改变环境光照。先看“环境光照”和“上次实际读到”；只改变环境不会更新记录。</li><li>点底部“执行读取”，再看真实读取事件。换一个不同的环境值，由你再取得一次。</li></ol><aside>LIGHT → Uno A0 → 光照模块 AO。上次的采样是执行留下的记录，不是正在变化的环境仪表。</aside></>:<><h1>先把值接进这一句，再执行。</h1><div className="eq-intro-manual-frames"><figure><img src="/art/program-teaching/output-empty.svg" alt="LAMP输出的空布尔值位"/><figcaption>先看空值位</figcaption></figure><figure><img src="/art/program-teaching/output-on.svg" alt="真实连接true后的LAMP输出"/><figcaption>看到连接后，再执行</figcaption></figure></div><ol><li>抓住 true / false 积木的实心边缘，避开中间字段菜单；把凸口移近输出右侧值位。</li><li>看到吸附预览再松手。没连上的块会留在画布，可以继续拖，也能撤销。</li><li>先预测亮或灭，再点底部的执行按钮。true 是开，false 是关；连接本身不会点灯。</li></ol><p>不方便拖动时，可先选择要放的积木，再选目标，查看预览并确认放入。这仍由你选择块和位置。</p></>}
    <footer><p>合上这一页，回到眼前的操作。需要更多资料时，可以查阅任务书和工程资料。</p></footer>
  </article>;
}
