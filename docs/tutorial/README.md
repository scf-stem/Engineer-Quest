# 林工 · 首单带教模块

此专项只负责 NPC 人物、对话状态、首单教学和联动验收。不改 `QuestApp`、整体壳、`content/`、公共配置或规则引擎。

## 接入

```jsx
import {NpcTutorial} from './src/tutorial/NpcTutorial.jsx';
import {tutorialFactsFromQuest} from './src/tutorial/index.js';

const facts = tutorialFactsFromQuest({
  joined, claimed, cardSaved, card, topology, wiring, program, blockError,
  baseCurrent, baseReport, source, applied, codeCurrent, codeReport,
  ledger, pending,
  requirementReview, // D summarizeRequirementReview 的当前事实；由 E 验证 binding
  guidance,          // 可选 E 当前诊断事实，见下表
});
<NpcTutorial facts={facts} open={npcOpen} onOpenChange={setNpcOpen}
  showLauncher={false}
  storageKey={`eq.npc-tutorial.v1:${learnerId}:${attemptId}`}
  onNavigate={(stage, intent) => openToolWithExistingGuards(stage, intent)}
  onOpenManual={section => openManualAtSection(section)} />
```

宿主也可以直接提供规范化的 `facts`，不使用基线适配函数。`NpcTutorial` 自带 `.eq-tutorial / .eq-tutor-*` 作用域 CSS，不读取 `.eq-ui` 变量，不修改 body、业务 localStorage、方案、接线、代码或账本。纯 JS `index.js` 不导入 JSX，Node 可直接测试。

| prop | 实际含义 |
|---|---|
| `facts` | 只读当前工程事实；每次真实检查/修改后重新传入 |
| `open` / `onOpenChange(boolean)` | 可选受控模态开关；不传 `open` 时组件自行管理开关 |
| `showLauncher` | 默认 true，渲染“和林工聊聊”；整体壳可设 false，用自己的林工入口控制 open |
| `onNavigate(stage, intent)` | 玩家明确点击去操作时调用一次；先关对话，只请求导航。stage 是 mail / requirements / wiring / blocks / code / tests。intent 携带当前 actionTarget / retryAction / checkpointId，均不执行 |
| `onOpenManual(section)` | 请求打开人读节号；优先真实 diagnostic.manualSection，否则本节默认。宿主负责版本校对、焦点和返回 |
| `storageKey` | 可选教学记忆键；设 null 禁止持久化。正式宿主应包含本人 learnerId/attemptId，避免不同体验者共用阅读位置 |
| `onStateChange(state)` | 可选观察钩子，返回 open / lesson / activeLesson / line / atTask / reviewing；仅调试或可访问呈现，不作为业务证据 |

`facts` 基础字段：

```js
{
  joined: true, claimed: true, cardSaved: false,
  card: {},
  wiringValid: false, connectionCount: 0,
  wiringDiagnostics: [{code, severity, message, terminalIds, manualSection}],
  programReady: false, programError: '',
  baseCurrent: false, baseReport: null,
  baseReady: false, // 可选：存在时严格 true 才交接；包含 E/D 学习检查
  hasCode: false, codeApplied: false, codeCurrent: false, codeReport: null,
  codeReady: false, // 可选：存在时严格 true 才讨论软件交付
  incomeRecorded: false, pending: false,
  requirementReview: null,
  guidance: null
}
```

report 读取原真实 `cases[].assertions[]` 的 atMs / expected / actual / passed，以及 name / diagnostics。历史 report 可以保留，但必须配 `baseCurrent / codeCurrent = false`；模块会说“旧结果已失效”，不会以过去 passed 推进。接线故障优先于后续教学，POWER_SHORT / NET_CONFLICT 优先于普通缺线。仅阅读、选对本地概念题、跳过或重看均不创建工程通过。

`baseReady/codeReady` 由 E 提供，字段存在时要求严格 true；false、null、undefined、字符串或数字均不能用客测 passed 替代。字段缺省时兼容原独立 demo。客测已通过但学习检查尚未完成，会留在当前教学并优先显示 E `guidance` 的真实诊断；没有该提示时明确说“软件测试通过，学习检查待完成”，不重复要求无意义重测。

## D 分步情境与 E 进度事实

`requirementReview` 优先接收 D `requirementTutorialFacts(summarizeRequirementReview({review,binding}))` 的公开投影：status / current / stageId / checkpointId / readyForPractice / readyToAdvance / challenge / diagnostic / guidance / retryAction / actionTarget。该投影不含证据与原话。组件**不运行** D 的作答或持久化 API。显示当前题号/标题、scene.description、prompt 及求助时的 guidance.title/observation/tryThis；不显示答案键，不代替宿主收集真实选择。`responseId` 去重、learnerId/attemptId/requirementRef/lessonRef 绑定与 responsesDigest 均归 D/E。

存在此投影时，必须 `status === 'ready'` 且两个 ready 字段均为严格 true，才继续需求后的教学。旧四项卡已保存、故事读完、概念题答对都不能替代。needs-help / needs-retry / stale / invalid 显示真实 diagnostic.message / observedFact / manualSection，并将 retryAction / actionTarget 作为导航意图交回宿主。不会将任意自由中文自动评分，也不把 need-help 记为通过。此处只是 UI 的保守表现，真正业务门禁仍由 E 调 D 校验。

按 `stageId=requirements/short-code` 区分基础与变更教学，不硬编码题号；即使已有代码，基础评审失效也回基础需求。`retryAction={type,label,targetId,checkpointId?}` 与 `actionTarget={type,targetId,checkpointId?,manualSection?}` 原样回传导航，按钮写“去做小观察并重试/去回答当前情境”，不把单击误称为已提交。D 已 ready 但宿主记录尚未确认时显示情境已完成，不再要求旧四项卡。

`guidance` 接受 E 的当前事实投影 `{stageId,checkpointId,diagnostic:{code,message,manualSection,observedFact},manualSection,retryAction,actionTarget,storageStatus,currentEvidence}`。模块显示当前 diagnostic，传回定位意图，不信任该对象里的自造通过标志。`storageStatus/currentEvidence` 可由宿主显示；本模块不承担进度恢复。E 负责在刷新后恢复工程 checkpoint 和有效证据；本地教学记忆只恢复看过哪一句。

## 对话交互

普通文本默认逐字显示。第一次点文本或主按钮只显示整句，下一次才推进；220ms 输入间隔防止连点穿过几句。系统减少动效或“整句显示”直接显示整句。概念题错误时给局部原因，可重新选；“跳过说明，去操作”只到本节任务卡。暂停/去操作/查手册均关闭对话，保留教学位置，宿主工程状态不卸载。再次打开读取最新事实。

原生 dialog 加显式 Tab 环、Escape、可见焦点、屏幕阅读器整句文本；对话记录可重看已访问章节或返回当前任务。手机与低高度横屏使用可滚动对话框，不抢占操作时的画布。真实屏幕阅读器朗读尚未实机验收。

## 本机运行与验证

```sh
npm ci --ignore-scripts --offline
npm run dev -- --port 5196 --strictPort
# http://127.0.0.1:5196/src/tutorial/demo.html
node --test tests/tutorial/model.test.js
npx playwright test --config tests/tutorial/playwright.config.js
```

独立 demo 是供 UI/E 接入参考的真实适配联动页：使用现有 `WiringWorkbench`、`ProgramBlocks`、`createProgramContext` 和 `createSyntheticLab`，从空接线/空积木开始；完整浏览器纵切主动加载教学示例并记录协助。它沿用 8bf7386 的静态方案卡和会话证据范围，不代表 D 的新分步关卡或 E 的完整持久化已在这里集成。这里刷新恢复草稿与阅读位置，旧保存/测试/收入权威清空；正式恢复以 E 新控制器为准。

公共 Vite 配置未修改，demo.html 为开发验收入口。生产主入口接入组件由 UI/E 负责；可用 `npx vite build --config tests/tutorial/vite.config.js` 单独验证本模块生产打包，产物在 `dist-tutorial/`（仅本机验证，不提交、不部署）。

人物原 PNG、运行 WebP、来源/尺寸/摘要见 [资产索引](../../public/art/npc-tutorial/manifest.json)，完整提示词与检验见 [角色记录](character.md)。教学设计依据见 [design.md](design.md)，实际试玩证据见 [verification.md](verification.md)。
