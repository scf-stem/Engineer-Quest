# UI 组件接入 V0.2

所有组件从 `src/ui/index.js` 导出。入口会同时加载 `tokens.css` 与 `quest.css`；选择性从内部文件导入时需要自行导入这两份 CSS。仅使用已有 React，不引入字体服务、图标依赖或远程图片。前缀统一为 `eq-`，样式限定 `.eq-ui`；`Dialog` 自带该命名空间。

## 总控建议路径

真实应用使用展示组件，业务状态、路由、保存和权限继续由总控拥有。`EngineerQuestDemo` 是独立合成视觉预览，不能直接当作已接引擎的产品入口。`fixtures.js` 不可作为客户测试、设备或账本真值。

```jsx
import {
  QuestShell, PageHeading, WorkbenchFrame, Notice,
} from './ui/index.js';

// 这些值与操作由实际应用提供；UI 不负责判断阶段是否通过。
<QuestShell
  employee={{nickname, employeeId, role: '见习工程师', synthetic: true}}
  stages={stageViews}
  activeStage={currentStageId}
  onStageSelect={handleStageSelect}
  activeView={view} onViewChange={setView}
  unreadCount={unreadCount}
  status="本地实验环境"
  footer="本地草稿 / 静态 NPC / 硬件待校准 / 尚无真机验收"
  onOpenManual={openManual} onRequestHelp={openHelp}
>
  <PageHeading eyebrow="研发部 / 自动灯" title="连接输入和输出"/>
  <WorkbenchFrame
    tabs={toolViews} activeTab={tool} onTabChange={setTool}
    status={actualWorkbenchStatus}
    toolbar={actualToolbar} detail={actualDiagnostics}
  >
    {actualWorkbenchComponent}
  </WorkbenchFrame>
  <Notice>在此展示来自实际模块的状态及下一步。</Notice>
</QuestShell>
```

B 的 `WiringWorkbench({value, deviceProfile, onChange, diagnostics, readOnly})` 作为 `WorkbenchFrame.children` 原样接入；C 不包装、翻译或复刻其端子 ID、连线校验和运行逻辑。A 的积木、代码和结果视图同理。内容容器可内部横向滚动，整个页面不应溢出。若 B 有内部样式，应继续限定自身命名空间。

`stageViews` 示例结构：

```js
[{id: 'requirements', title: '读懂客户需求', subtitle: '先用中文说清楚', state: 'current', disabled: false}]
```

`state` 为 `complete | current | upcoming` 的展示值。总控从实际状态转换；`activeStage` 用于 `aria-current="step"` 和当前视觉强调。`disabled` 只控制能否点击。不能因为点击路线就授予完成。每个阶段是否可导航与业务解锁分开处理。

## 导出与 props

| 导出 | 主要 props | 责任 |
|---|---|---|
| `QuestShell` | `employee`，`stages`，`activeStage`，`onStageSelect(id)`，`activeView`，`onViewChange(id)`，`unreadCount=0`，`onOpenManual`，`onRequestHelp`，`status`，`footer`，`tools`，`sidebarExtra`，`children` | 顶部导航、个人侧栏、主内容、页脚。视图 ID 固定为 `desk/mail/workbench/income`；无回调则相应操作禁用或隐藏。 |
| `EmployeePass` | `employee:{nickname,employeeId,role,synthetic}`，`onEdit?()` | 个人员工证；不创建身份。 |
| `StageRoute` | `stages`，`activeStage`，`onStageSelect?(id)` | 顺序路线；支持阶段按钮的键盘访问。 |
| `PageHeading` | `eyebrow`，`title`，`subtitle?`，`trailing?` | 单页主标题与当前状态。 |
| `OfficeHero` | `onOpenMail?()`，`artSrc?` | 工位场景；标题固定为首轮风格稿文案。 |
| `TaskMail` | `task:{title,client,description,scope}`，`compact=false`，`onOpen?()`，`scene?`，`children?` | 首单邮件样式；`scene` 接收图片登记对象，仅完整邮件展示，简版不显示图片。订单角标暂为 001。 |
| `RequirementDraftForm` | `fields:[{id,title,question,options:string[]}]`，`value`，`onChange(next)`，`explanation`，`onExplanationChange(text)`，`onSave?()`，`feedback?` | 受控表单。保存文案明确为演示草稿；无答案正确性检查，无业务提交。 |
| `NpcReviewPanel` | `name='林工'`，`role='需求负责人'`，`mode='static'`，`question`，`citation?`，`onOpenManual?()`，`children?`，`artSrc?`，`portraitSrc?` | 默认使用独立林工透明头像；`portraitSrc` 可换独立人像。原 `artSrc` 仍按旧场景裁切，保持兼容。只有实际模型服务返回结果才可传 `mode='ai'`；组件不发请求。 |
| `StoryFigure` | `asset:{src,alt,width?,height?,caption?}`，`caption?`，`variant='scene'`（或 `prop/portrait`），`className?` | 图片及 HTML 图注；scene 在邮件中裁成横幅，图册中保留完整画面。传 `caption=''` 可隐藏图注。 |
| `StarterKitCard` | `asset=FIRST_ORDER_ART.starterKit`，`onOpenWorkbench?()` | 含透明元件托盘的工位入口；不读硬件模型，不表示已领料或购买。 |
| `WorkbenchFrame` | `tabs:[{id,label}]`，`activeTab`，`onTabChange(id)`，`toolbar?`，`children`，`detail?`，`status?` | 工作台框架，不拥有设备和作品状态。支持左右键、Home、End。调用方保证 `activeTab` 存在。 |
| `TerminalIllustration` | `selectedTerminal?`，`onSelectTerminal?(id)`，`showReference=false` | 仅风格示意，回调 ID 为 `5V/GND/A0/D9`；不是正式端子 schema，不可存为接线。 |
| `StatusBadge` | `tone='neutral'`（或 `green/coral`），`children` | 状态展示；不能仅靠颜色表达。 |
| `ActionButton` | 原生 button props，`variant='primary'`（或 `paper/text`），`icon?`，`children` | 默认 `type='button'`，支持 disabled 与外部 aria 属性。 |
| `Notice` | `tone='neutral'`（或 `warm`），`children` | 可读的状态与提示。 |
| `Dialog` | `title`，`onClose()`，`children` | 原生模态 dialog、焦点限制、Escape 关闭、关闭后焦点返回。 |
| `Icon` | `name`，`size=20`，原生 SVG props | 原创几何图标，默认装饰性 aria-hidden。按钮必须有文字或 aria-label。 |
| `EngineerQuestDemo` | `slots?:{wiring,blocks,code,tests}` | 合成演示；slot 值为 ReactNode，供快速视觉对照。真实集成使用前述受控组件。 |
| `OFFICE_ART` | 常量 | 使用 Vite `BASE_URL` 的公共 JPG 地址，兼容子路径构建。 |
| `FIRST_ORDER_ART` | `{customerScene,starterKit,mentor}` | 首单艺术资源登记对象，含可访问文本、图注、尺寸和 Vite BASE_URL 地址；不是课程或元件 schema。 |
| `ArtGallery` | 无 | 单独素材画廊，用于检查完整场景、人物与透明背景；预览入口 `art-preview.html`。 |

可组合组件内不导入 `engine.js`、`npc.js`、Blockly、账本或任何后端。仅 `EngineerQuestDemo` 拥有内存演示状态；UI 模块没有 localStorage、fetch 或奖励计算。点击页签与保存演示表单不产生服务端证据。

## 样式与资源

`QuestShell` 自带 `.eq-ui` 根；单独使用组件时外层加 `<div className="eq-ui">`。预览 HTML 使用 `body margin:0`，总控可继续由自身全局样式管理页面边距。没有向 `html/body/:root` 写全局规则。

`public/art/` 中的一张 JPG 和三张 WebP 必须跟随组件拷贝；没有远程资源。`OfficeHero.artSrc` 用于场景替换；NPC 优先用 `portraitSrc` 替换独立头像，原 `artSrc` 保留旧场景裁切。新头像构图不同需要复验裁切。

本轮未改业务接口，仅追加 props 与艺术资源导出。首单接入示例：

```jsx
import { FIRST_ORDER_ART, TaskMail, StarterKitCard, StoryFigure } from './ui/index.js';

<TaskMail task={actualTask} scene={FIRST_ORDER_ART.customerScene}/>
<StarterKitCard onOpenWorkbench={openWorkbench}/>
<StoryFigure asset={FIRST_ORDER_ART.mentor} variant="portrait"/>
```

以上图片只作剧情或道具，不能从中读取 LED 极性、引脚位置、器件电压或元件数量。端子、接线和测试继续使用 A/B/E 的实际模块。用户授权本轮直接产图，无需等待模型名称确认；素材地址和完整提示词见 `public/art/manifest.json`。

当前工位壳的导航是受控切换，不负责浏览器 history、滚动位置或 deep link。视图切换后是否聚焦标题由总控路由层处理。`tools` 可放全站通知或版本条，`sidebarExtra` 可放实际作品状态。不要把合成数据与实际业务混用。
