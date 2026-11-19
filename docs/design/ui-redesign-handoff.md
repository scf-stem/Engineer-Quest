# 全屏研发工位 UI 交付 · 2026-11-11

工作区：`.worktrees/ui-redesign`；分支：`work/ui-redesign`；基线：`8bf7386`。本轮只修改此工作区，未改 integration、其他专项或生产数据，未推送、未部署。

## 可运行结果

真实主入口从入职到软件收入共用原创夜间研发室、身份/收入 HUD、工具窗口和底部工具栏。委托档案使用四组可见 radio 选择与中文方案编辑；虚拟接线、Blockly、简写 C++、固定客户测试和交付记录使用统一窗口。窗口内滚动，页面不再成为长表单导航。

程序、接线编辑器在首次访问后保持挂载，切工具/回场景保留作品和接线撤销历史。快捷键 1–7 切工具、M 打开相关手册、F 切浏览器全屏；输入区不抢字符。Esc 先由接线/模态层消费，再返回研发室；场景热点和工具按钮关闭后恢复焦点。手册有目录、正文搜索、节号跳转、首单操作补充、示例与检查表。完整反馈可展开阅读，长诊断不会只剩省略号。

新场景由内置图像工具原创，运行 WebP 约 204 KiB；没有复制参考游戏资产。研究依据与未观察到的内容见 [审查](ui-redesign-review.md)，生成来源见 [资产记录](ui-redesign-assets.json)。

## 打开方式

本次专用开发服务已在本机 `http://127.0.0.1:5193/` 启动。重开时在本工作区运行：

```sh
npm ci --ignore-scripts --offline
npm run dev -- --port 5193 --strictPort
```

离线安装依赖本机已有缓存；若已安装可直接启动。默认只监听本机。用干净浏览器上下文或未使用过的本机浏览器从入职开始；已有本机草稿会进入研发室。不要为了试玩删除其他人的存储。

## 真实首单软件验收

本轮实际通过浏览器操作：领取本机员工证 → 委托接单 → 四项中文方案及解释 → 保存静态覆盖记录 → 虚拟接线六条 → 主动加载教学示例（记录协助）→ 基础客户测试 → 从本人的积木快照生成短代码 → 保留 450 跑变更测试失败 → 改为 600 → 解析并测试 → 导出同一已测 IR 的候选 `.ino` → 合成入账。

- 基础需求 1.0.0：26 条固定断言通过。
- 新需求 1.1.0：旧边界 450 失败，收入入口禁用；改为 600 后 20 条固定断言通过。确定性脚本另证实错误 700 也失败。
- 导出文件实际含 `#include <Arduino.h>` 和 `_eqv_threshold = 600`；不代表 Arduino 目标板已编译。
- 合成收入双击仍为 100 EC，账本只有一条事件。删除一条线后即使撤销回原连接，当前结算仍禁用，已记录收入不会重发。
- 三轮切换需求/接线/积木，作品、协助记录和可执行程序保留；接线撤销/重做历史保留。代码关闭后重开、查看旧积木再返回，文本保留。
- 未保存方案直达接线会回需求；保存后直接点代码会显示待接线画布；接线完成但没有代码则进入真实空白 Blockly，不出现空窗口。

这次使用了教学示例，不宣称零基础学生独立从空白完成，也未做真实学生试教。

## 测试与截图

本轮执行，不沿用旧轮结果：

| 检查 | 结果 |
|---|---|
| `npm test` | 90 / 90 通过，含受控本机 C++ stub 对照、新手册节号完整性 |
| `npm run verify:integration` | 26 + 20 固定断言；450/700 错误、600 正确；结算一次 |
| `npm run build` | 通过；Blockly 语言包约 753 kB，仍有既存 >500 kB 体积提示 |
| 开发浏览器 | 10 / 10 通过，含保留的 legacy 回归 |
| 生产预览浏览器 | 10 / 10 通过，独立 5194 端口，未部署 |
| 标准 web-game 动作客户端 | 手册点击、截图、`render_game_to_text` 输出成功，无错误文件 |
| 键盘补验 | 2 打开真实委托、M 打开手册、Esc 先关模态、F 进入/退出全屏、1 返回研发室，均通过 |
| `git diff --check` | 通过 |

开发/生产命令（本机已安装的 Chromium 路径按环境替换）：

```sh
EQ_PORT=5193 PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome-headless-shell npx playwright test --workers=1
EQ_PREVIEW=1 EQ_PORT=5194 PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome-headless-shell npx playwright test --workers=1
```

标准技能脚本原路径无法解析当前项目的 Playwright，使用 `/tmp/eq-ui-web-game-client.mjs` 的原脚本副本，仅替换依赖导入和已安装浏览器路径；没有重写其动作、截图或错误收集逻辑。DOM/SVG 是真实界面，没有为测试添加假画布；`advanceTime` 对界面无操作，逻辑时间继续由程序执行器负责。

已实际打开并检查截图，发现并修复手机容器被工具栏挤宽、桌面画布过大、旧表格暖色污染等问题。覆盖 1440×900、1265×950、390×844、720×450 短视口，另有标准客户端 1280×720。原始 Playwright 图在 `test-results/`；交付图在 [evidence/ui-redesign](evidence/ui-redesign)。

| 证据 | 图像 |
|---|---|
| 改造前入职 / 需求 | [入职](evidence/ui-redesign/before-entry.png) / [需求](evidence/ui-redesign/before-requirements.png) |
| 改造后入职 / 场景 | [入职](evidence/ui-redesign/after-entry.png) / [场景](evidence/ui-redesign/after-room.png) |
| 中文方案 / 可用手册 | [方案](evidence/ui-redesign/after-requirements.png) / [手册](evidence/ui-redesign/after-manual.png) |
| 虚拟接线 / 危险提示 | [接线](evidence/ui-redesign/after-wiring.png) / [短接诊断](evidence/ui-redesign/after-wiring-hazard.png) |
| Blockly / 代码失败 / 修正 | [积木](evidence/ui-redesign/after-blocks.png) / [失败](evidence/ui-redesign/after-code-failed.png) / [通过](evidence/ui-redesign/after-code.png) |
| 测试台 / 收入 | [客户测试](evidence/ui-redesign/after-tests.png) / [幂等收入](evidence/ui-redesign/after-income.png) |
| 手机场景 / 代码 / 阅读器 | [场景](evidence/ui-redesign/after-room-mobile.png) / [代码](evidence/ui-redesign/after-code-mobile.png) / [手册](evidence/ui-redesign/after-manual-mobile.png) |

## 集成接口与分工边界

主要文件：

| 文件 | 职责 |
|---|---|
| `src/integration/GameShell.jsx` | 游戏框架、场景、工具导航、焦点/快捷键；导出 `TutorialSlot`、可选 `WorkspaceControls` |
| `RequirementConsole.jsx` | 受控中文方案界面，不创建通过或账本 |
| `ManualConsole.jsx` / `manual-content.js` | 共享节号阅读器与本轮软件阅读补充 |
| `QuestApp.jsx` | 保留原规则适配与真实功能，接入新框架；提供专项注入点 |
| `ProgramBlocks.jsx` | 原 Blockly 功能加暗色主题 |
| `game-shell.css` | 主流程作用域样式，不改变专项独立预览的视觉规范 |

### NPC 专项

`QuestApp` 可接 `TutorialComponent`：

```jsx
<QuestApp TutorialComponent={NpcTutorial}/>
```

林工入口会传 `facts`、`open={true}`、`showLauncher={false}`、`onOpenChange`、`onNavigate(stage, metadata?)`、`onOpenManual(section)`。注入组件拥有自己的原生 dialog，本壳不再套第二层 dialog。facts 含真实 `joined/claimed/cardSaved/card/wiringValid/wiringDiagnostics/connectionCount/programReady/programError/baseCurrent/baseReport/hasCode/codeApplied/codeCurrent/codeReport/incomeRecorded/pending` 及当前目标/版本。导航适配 `requirements→mail`、`short-code→code`、`onboarding→desk`；未知入口拒绝，真实前置门槛仍由宿主校验。

此分支**未 cherry-pick NPC 专项**；可集成提交由该专项报告为 `7db8261`。默认只有明确标注的本地工作提示，没有声称新角色/剧情已验收。总控合入 NPC 后需在统一主入口复验，不能拿独立页面测试替代。

### E 本地持久化 / D 新需求练习

壳支持可选 `workspace`：`storageStatus`、`storageError`、`progressLabel`、`onResume`、`onRestart`、`onExport`。连接后场景出现“本地工位”菜单，分别请求继续、保留历史重开、导出档案；存储错误优先显示在工作反馈。没有控制器时不展示虚构的重开/恢复功能。

当前 `QuestApp` 仍沿用基线 `loadDraft/saveDraft`、会话 `createSession` 和静态 `readyForSubmission` 覆盖，仅允许继续本地练习，不声称语义通过。**合入 E/D 时应替换此业务状态来源和旧门槛**，使用 E 的持久控制器、D `readyToAdvance` 和实际学习里程碑；不要再并行创建第二个身份/账本，也不能从导航生成学习事实。E 新业务尚未进入本分支，刷新仍不恢复基线通过证据/收入，这不是本轮已解决项。

### 新版手册

`QuestApp` 支持 `ManualComponent`，默认 `ManualConsole`。参数为 `initialSection`、`context`、`onNavigate`，宿主继续负责安全导航。正式全文由手册专项交付后可替换或接入此阅读器的数据来源。本轮补充覆盖首单软件步骤，但不等于纸质/电子正式手册已完成。

仍缺的手册内容：已验证实物 BOM、Uno 代际/FQBN、电源电流与限流选型、真实模块端序/标定、编译烧录工具链、现场教师检查与实物测试记录、真实学生试教校准。现有虚拟接线表明确只适用于当前软件候选模型。

## 验收记录

生产预览最终运行 10 / 10 通过（12.9 秒），开发最终运行 10 / 10 通过（15.2 秒）。截图取自该生产预览实际页面，已逐项打开核看。本地预览不代表部署。在线 AI、真实账号、多用户收入榜、商城、目标板编译烧录与实物验收都不属于本次已实现结果。
