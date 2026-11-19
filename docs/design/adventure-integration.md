# 沉浸式工位接入 V0.3

仍从 `src/ui/index.js` 导入；没有新增依赖。新 CSS 限定 `.eq-adventure`、`.eq-dialogue-panel`、`.eq-inspection-panel` 等专属类，不修改公共入口或全局样式。原 `QuestShell` 与首单组件继续可用。`AdventureDemo` 仅供合成演示，真实应用优先使用受控 `ExplorationStation`。

```jsx
import { ExplorationStation } from './ui/index.js';

<ExplorationStation
  employee={actualEmployee}
  goal={actualGoal}
  actionStates={actualActionStates}
  onAction={actionId => openActualView(actionId)}
  feedback={navigationFeedback}
  homeHref="/"
  onHome={() => setView('desk')}
  sceneStatus="原创场景 / 本地软件体验"
  showMarkers={showMarkers} onShowMarkersChange={setShowMarkers}
  reduceMotion={reduceMotion} onReduceMotionChange={setReduceMotion}
/>
```

`onAction` 只收到字符串，不携带提交、测试、奖励或教师批准写入。调用方在实际目标界面验证前置条件；C 不推导 `goal` 或权限。没有 `onAction` 时所有入口禁用，没有 `goal` 时明确显示“视觉小样”。

`onHome?()` 是可选的纯导航回调：提供时品牌点击先 `preventDefault()` 再调用它，保留当前文档与内存状态；不提供则继续按 `homeHref` 正常导航。真实单页应用应传此回调，以免整页刷新清掉会话内证据。`sceneStatus?` 默认 `原创场景 / 视觉小样`，E 可根据实际接入状态传入 `原创场景 / 本地软件体验`；UI 不据此改变业务状态。

## 控制值

```ts
type Goal = { id: string; title: string; detail: string; status: string };
type ActionStates = Record<string, {disabled: boolean; reason?: string}>;
```

`status` 的 `visual/in_progress/complete/blocked` 分别显示视觉小样/进行中/已完成/等待前置条件；其他字符串原样展示。实际状态转换由 E 完成。`complete` 只是外部提供的展示值，UI 不会自行产生它。

已实现动作：`open_mail`、`talk_requirements_npc`、`inspect_kit`、`open_manual`（物品查看中的辅助入口）、`open_wiring`、`open_blocks`、`open_code`、`open_tests`、`open_income`、`request_help`。默认场景只放前三个热点；其它动作在工具直达或面板辅助入口。禁用热点在同名列表显示原因，不触发回调。

## 新导出

| 组件 | props / 用途 |
|---|---|
| `ExplorationStation` | `employee?`、`goal?`、`onAction?`、`actionStates={}`、`sceneSrc?`、`hotspots?`、`feedback?`、`showMarkers=true`、`onShowMarkersChange?`、`reduceMotion=false`、`onReduceMotionChange?`、`homeHref='./preview.html'`、`onHome?()`、`sceneStatus?`、`children?`；完整场景工位、目标、等价入口和工具直达 |
| `ExplorationScene` | `sceneSrc?`、`hotspots?`、`onAction?`、`actionStates?`、`showMarkers?`；单独空间图层 |
| `QuestTracker` | `goal?`；受控目标展示，不监听探索次数 |
| `DialoguePanel` | `speaker='林工'`、`role`、`text`、`portraitSrc?`、`onClose`、`onContinue?`、`continueLabel?`、`onOpenMail?`；原生模态静态剧情对话，轮次由外部控制 |
| `InspectionPanel` | `items:[{id,title,category,description,manualLabel}]`、`selectedId`、`onSelectItem(id)`、`onOpenManual()`、`onClose()`、`art?`；受控道具查看。默认 items 是合成说明，真实接入传 D/B 实际内容 |
| `AdventureDemo` | 无 props；合成目标、静态对话及演示禁用状态；不作为业务入口 |
| `STATION_HOTSPOTS` | 三个视觉点 `{id,actionId,label,hint,icon,x,y}`；x/y 是场景百分比，与任何真实端子坐标无关 |
| `STUDIO_SCENE_ART` / `EXPLORATION_ART` | 场景 URL / 含尺寸与替代文本的艺术对象 |

`Dialog` 追加可选 `className`，其他用法不变。新场景路径为 `public/art/eq-studio-exploration-v1.webp`，275,918 字节，1672×941。坐标与此构图绑定；换场景时一起校准热点。图片不承载中文、动作、引脚或实际接线。

## 运行与验证

沿用本地预览命令，打开 `http://127.0.0.1:4175/src/ui/adventure-preview.html`。三个入口由 `src/ui/preview.vite.config.js` 单独构建，未改 E 的配置。

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome-headless-shell node src/ui/verify-adventure.mjs
npx vite build --config src/ui/preview.vite.config.js --outDir /tmp/eq-ui-adventure-build
```

对话与物品截图只捕获实际视口，主工位与手机截图使用完整页面。浏览器验证不代表已合入 E、在线 AI、真实电路、硬件验收或真实学生试玩。

兼容增量验证：浏览器实际点击品牌后，`onHome` 反馈到达、URL 与主框架导航次数不变、文档内存标记及 React 开关状态保留、受控目标不变。验证针对 UI 导航行为，不冒充真实收入或证据账本验收。
