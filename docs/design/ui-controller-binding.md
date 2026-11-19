# 全屏 UI 与本机工位控制器绑定增量

本增量建立在 UI `e29280b` 和 E 控制器 `7a26fcd` 上。控制器基础在此分支重放为 `022681e`；只有 `progress.md` 的追加记录发生冲突，两边保留。总控已拥有 E 基础时，只需审查本增量实现提交，不要重复 cherry-pick 基础提交。

## 已绑定的真实路径

`QuestApp` loader 先创建硬件上下文，再 `await createContext(hardware)`，然后 `await openWorkspace(context)`。`PersonalQuest` 通过 `useSyncExternalStore(controller.subscribe, controller.getState)` 订阅稳定不可变状态。

界面不再调用旧 `createSession/submit/lab`，没有内存账本、`savedCard` 权威、基于页面反推的学习阶段或 `saveDraft` 副作用。开始、接单、保存作品、测试、保留基础作品、入账、重开、继续都 await 控制器方法。目标由 `state.stage` 展示，门槛来自 `state.facts.requirements.readyToAdvance / learning / baseReady / codeReady / pending`；保存未完成或冲突时不开放通过/入账。

- 恢复后使用同一 `learner.id` 和 `activeAttemptId`；已有本机档案不展示创建身份表单。
- “本地工位”提供继续、保留历史重开、继续旧尝试和导出。重开保留收入，不为同一人同一单重奖。
- 保存失败保留当前输入，提供完整备份、重试和明确标注放弃本页修改的重新读取。双页面冲突不会静默覆盖。
- 备份格式 `eq.ui-local-backup/1` 包含控制器原始 `archive` 以及最新 `bufferedDraft/attemptId`，包括保存失败后继续输入、尚未写入控制器的字符。未实现备份导入。
- `.ino` 从当前 `codeReady` 证据绑定的不可变快照程序生成；不依赖一个界面里的“已应用”布尔值。
- 收入显示为“本机合成收入”，明确无真实账号、商城、云同步和真实收入榜。

输入缓冲只负责文字/图形编辑体验，不生产任何学习事实。保存回执采用字段共享：未变的接线文档不重新分配引用，避免中断端子手势或清掉撤销栈。缓冲未保存时工程动作关闭；重试先恢复控制器保存，再提交最后输入。

## 专项注入接口

```jsx
<QuestApp
  createContext={createContextWithActualManualRef}
  openWorkspace={async context => openLocalWorkspace({
    programContext: context,
    policies: await createWorkspacePolicies(context),
  })}
  RequirementPracticeComponent={RequirementPractice}
  ProgramPracticeComponent={ProgramPractice}
  TutorialComponent={NpcTutorial}
  ManualComponent={FullManualConsole}
/>
```

上面的工厂宜在模块范围定义或用稳定引用，避免父组件重渲染重新打开工位。`createContext` 缺省为当前 `createProgramContext`。正式手册摘要/版本由 E 构建器负责；UI 不用旧摘要冒充新的手册引用。

两个练习插槽均收 `{workspace:controller,state,phase,onNavigate,onOpenManual}`。`phase` 为 `blocks/short-cpp`。编程练习在桌面与 Blockly 相邻，手机纵向排列；代码阶段位于文本编辑器前。组件直接使用控制器，UI 不重做 A/D 的策略或补齐学习事实。

未注入需求练习时可以编辑兼容旧卡，但只保存原始草稿，明确“情境练习尚未接入”，绝不能放行；未注入编程学习时显示不可用。默认 `openWorkspace` 使用真实 IndexedDB、无教学策略，所以当前默认入口安全停在需求阶段，不能把它当作正式教学已接入。

NPC 接收规范事实，`requirementReview` 为当前 phase 对应 summary，并显式传 `baseReady/codeReady`。`onNavigate(stage, metadata)` 只导航，metadata 只保存为 presentation 的定位意图，不调用答题或学习动作。对话不改变通过。NPC 自己拥有 dialog，壳不嵌套第二个。

未注入正式全文时显示有醒目标记的兼容阅读指南；本轮只更新其中与本机保存/按钮有关的过时说明。正式全文、真实 docs 内容 SHA 与课程差异由 E/手册专项验收。

## 编辑器恢复与隔离

`WorkspaceGame` 使用 `key={state.activeAttemptId}`。同一尝试切换工具保持真实 WiringWorkbench/Blockly 挂载；重开或继续另一个尝试会重建编辑器和撤销历史，防止跨作品写入。

`ProgramBlocks` 增加 `workspaceState` 用于显示控制器/局部练习加载的作品；初始化、外部加载和只读快照不作为真实编辑写回。只有用户编辑事件会保存。加载失败保留原记录，不以空工作区覆盖。`allowFullExample` 默认为 true 兼容独立 demo，但主入口明确为 false，完整答案按钮不出现。正式程序从学生的实际编辑/专项局部练习产生。

实际浏览器发现并修复：初始化/只读加载会触发 Blockly 事件，曾导致旧快照被当成新编辑；工具打开的延迟聚焦曾抢走手机第一个端子选择。现在前者不写业务，后者不覆盖用户已主动放到窗口内的焦点。手机完整准备路径连续三次通过。

## 本轮验证范围

教学策略只使用 E 已提供的明确测试替身 `tests/integration/local-workspace.fixture.js`。虚拟接线、程序解析/执行、固定客户测试、IndexedDB 与 UI 都是真实组件；不宣称正式教学或学生理解验收。

测试专用入口是 `tests/ui/workspace.html`。它不被 `src/main.jsx` 或正式 `vite.config.js` 引用；正式构建中未发现 fixture 标识。其独立构建输出在 `/tmp/eq-ui-workspace-build`，不会作为正式产品发布。

```sh
npm test
npm run build
# 默认入口：教学未注入时不得旧卡放行
EQ_PORT=5193 PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome npx playwright test --workers=1
EQ_PREVIEW=1 EQ_PORT=5194 PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome npx playwright test --workers=1
# 明确测试替身 + 真实控制器/UI/引擎
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome npx playwright test --config tests/ui/playwright.config.js --workers=1
npx vite build --config tests/ui/preview.vite.config.js
EQ_UI_PREVIEW=1 PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome npx playwright test --config tests/ui/playwright.config.js --workers=1
```

绑定浏览器验收包括：基础成功/变更失败/修正成功三次报告及确切源码恢复；同一身份/订单恢复；100 EC 和入账去重；重开新尝试保留旧作品及收入；继续原尝试；保存失败保留文本并导出/重试；另一页冲突后明确重读；手机手册、关闭与切工具不丢代码。本轮结果：97/97 单测；默认入口开发 5/5、生产预览 5/5；绑定测试入口开发 5/5、生产预览 5/5；手机准备路径额外连续 3/3。正式构建与独立测试构建均通过，仍有既存 Blockly >500 kB 提示。标准游戏客户端已运行，截图与只读文本状态成功，没有错误文件。

已实际打开核看：[恢复后的短代码](evidence/ui-binding/bound-restored-code.png)、[相邻练习与只读积木](evidence/ui-binding/bound-blocks-sidebar.png)、[保存失败与备份/重试](evidence/ui-binding/bound-save-failure.png)、[本机收入](evidence/ui-binding/bound-income.png)、[手机](evidence/ui-binding/bound-mobile.png)、[未注入策略时旧卡阻断](evidence/ui-binding/default-no-policy.png)。结果摘要见 [verification.json](evidence/ui-binding/verification.json)。

仍待 E 合入正式 D/A 策略、真实练习组件、NPC 增量和正式全文后，重新验证真实教学纵切。当前分支没有自行合入/修改这些专项模块，也没有修改 E 的 `local-workspace.js`。无推送、部署或生产操作。
