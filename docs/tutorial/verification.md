# NPC 首单联动验收 · 2026-11-11

基线：`8bf7386`，分支 `work/npc-tutorial`，只改专项目录及 progress.md。验收的是可运行教程组件和独立真实适配联动页，**不是整体游戏 UI 已经重做完成，也不等同零基础学生独立试教通过**。

## 实际结果

- `node --test tests/tutorial/model.test.js`：27/27。覆盖逐句/选择、暂停重进/重看/跳过、损坏记忆、D 情境投影、旧通过失效、11 种实际接线错误和真实失败断言。
- `npm test`：116/116（原 89 + 专项 27）。包含原确定性引擎与受控主机 C++ stub 对照；stub 不是 Arduino 目标板编译。
- `npx playwright test --config tests/tutorial/playwright.config.js`：5/5。使用隔离 Chrome，无个人浏览器资料。覆盖完整下述联动、390px/844px/低高度横屏、焦点环、Escape、减少动效、刷新阅读位置、本人阅读记忆切换和内联回调稳定性。
- `npm run build`：主/legacy 基线生产构建通过；因为公共入口归 UI，该命令不宣称 NPC 已进主入口。
- `npx vite build --config tests/tutorial/vite.config.js`：独立教程生产构建通过，并实际在本机 5197 预览核查 320×568。图片加载、任务按钮可达、无全页横向溢出，任务文本 opacity=1。`production-smoke.json` 记录实际结果。
- develop-web-game 原客户端已运行，输入 space 与点击，输出 `client-final/shot-0.png` 和 `state-0.json`。技能脚本本身未改；因为技能目录找不到 playwright、默认浏览器版本未安装，使用 /tmp 的 Node resolve hook 指向项目现有 playwright，临时浏览器目录链接已安装 Chromium。没有安装额外依赖或下载浏览器。

独立联动页显式使用基线 `createHardwareContext / createProgramContext / createSyntheticLab`；所有测试结果出自真实执行器和固定客户断言。完整浏览器纵切在空积木后主动点击“加载教学示例（记录协助）”，支持来源保留为 teaching-example，不能称学生从空白独立完成。

## 实际操作与观察

| 操作 | 观察到的结果 |
|---|---|
| 初次点对话、快速双击 | 先显示整句，再逐句继续；220ms 内重复事件不穿过多句 |
| 暂停、再找林工；刷新 | 保留当前阅读位置；工程状态由宿主保持，教学记忆不创造通过 |
| 概念题选“只读一次” | 给出为什么发现不了后续变化，允许重选；本地概念题不写 D 需求响应 |
| 跳过说明、连点任务卡 | 到当前操作目标，订单未领取、收入仍为 0 |
| 真实保存方案后返回 | 进入接线教学，不再重复入职话语 |
| 画布连 5V→GND | 林工读取实际 POWER_SHORT，并建议定位/移除短接；没有笼统“再试一次” |
| 撤销短接，手动连接六条端子 | 实际 topology.ok 后才开始积木教学 |
| 主动教学示例，运行基础客户测试 | 实际基础测试通过后讨论读取位置，要求自己保留快照再生成代码 |
| 保持 450，运行变更测试 | 真实“500 应亮”场景失败，林工读出 200ms 预期亮/实际灭，收入操作不可用 |
| 修改自己的代码到 600、解析、复测 | 实际新版通过后进入软件交付说明；阅读全部说明收入仍是 0 |
| 明确请求两次软件收入 | 原业务账本只记 100 EC 一次；教程没有入账函数 |
| 删线再撤销 | 即使拓扑恢复合法，历史测试仍失效，林工要求重测，收入记录保留且不能据旧结果再交付 |
| 重看旧章节 | 明确显示“正在重看”，可返回当前任务，不改变真实 checkpoint |
| 切换 learner 对应 storageKey | 各自阅读位置独立；不会把前一人的记忆写入新键 |

## 截图证据

实际逐张打开检查了人物、文字、按钮、不同屏幕和错误反馈。早期发现的文字样式覆盖、逐字完成被计时器覆盖、焦点首尾循环问题均修正后复跑。

- [桌面对话](evidence/dialogue-desktop.png)
- [手机对话](evidence/dialogue-mobile.png) / [手机操作目标](evidence/mobile-operation-goal.png)
- [低高度横屏](evidence/dialogue-short-landscape.png) / [320px 生产预览](evidence/production-320.png)
- [真实短接反馈](evidence/wiring-feedback.png)
- [新版测试失败反馈](evidence/test-failure-feedback.png)
- [软件交付说明](evidence/software-delivery.png)

每张对应 JSON 保存当前 lesson、line、接线状态、测试是否当前、协助来源、收入和 physical=not-verified。`flow-errors.json` 是完整浏览器纵切的页面异常数组，最终为 []。

## 交接边界与未验证项

UI/E 尚需把组件接到统一游戏壳并复验模态焦点、手册返回、真实 checkpoint 和持久化事实。D 新分步情境 API 的 summary 已兼容并有保守门禁测试，但独立 demo 仍用基线静态卡；E 新进度仓库未在本分支集成。不能以此验收记录声称 D/E 的新业务闭环已经验收。

一张平静立绘承担首版教学，没有多表情动画；工具型号未暴露，未冒称 Image 2。独立 demo 因直接引入 Blockly 保留约 1.14MB JS 构建体积提示；NPC 组件本身不导入 Blockly，正式壳可沿用按需加载。

真实零基础学生试教、屏幕阅读器实机、真实账号、在线 AI、目标板编译、烧录、实物安全/功能验收没有执行。本专项没有推送、部署、生产数据修改、付费服务或权限新增。

## D 实际投影与 E 学习检查兼容增量

读取 D 已落地的 `content/requirements-review.js`，用合成 binding 调用 createRequirementReview → reviewRequirementAttempt(not-sure / need-help) → requirementTutorialFacts，保存无证据、无原话、无答案键的公开投影到 `tests/tutorial/fixtures/requirement-needs-help.json`。新增浏览器回归实际渲染该投影的题号/标题、场景、问题和局部观察，在桌面及390px手机核查；点击去重试只回传 typed retryAction/actionTarget/checkpointId，原宿主收入仍为0。证据：[桌面求助](evidence/requirement-guidance-desktop.png)、[手机求助](evidence/requirement-guidance-mobile.png)、[公开投影及导航结果](evidence/requirement-guidance.json)。这验证了 D→NPC 公开数据兼容，不冒充统一新控制器已经集成。

E 的 baseReady/codeReady 为可选严格门禁：存在时仅 true 可以交接/交付，客测 passed 不能替代。缺省保持基线 demo。当前 E guidance 优先于已完成的 D 情境摘要，学生会看到尚未完成的学习检查，不会被要求反复重测已通过版本。新增单测覆盖 false/null/undefined/数字/字符串、旧demo兼容与真实学习诊断优先。
