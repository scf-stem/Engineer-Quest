# 本机完整进度控制器（返工中）

本轮独立验收发现旧版刷新丢失测试、目标与收入。新控制器位于 `src/integration/local-workspace.js`，存储位于 `local-progress-store.js`，尚需与正在重做的主界面及 A/D 教学模块统一接入。专项通过不能代表零基础教学验收通过。

## 数据与恢复

IndexedDB 的一次读写事务提交整个本机档案：稳定昵称身份、多个订单尝试、原始需求回答、接线与积木、确切短源码、学习动作、不可变测试快照、失败和成功报告、合成收入和导航位置。版本号通过 compare-and-swap 防止两个页面静默覆盖。摘要用于检测损坏和识别内容，不提供账号权限或防篡改安全。

打开档案时，需求回答交回 D 重演；软件报告由当前 A+B+D 执行器重跑核对；学习动作通过注入的 A 执行适配重算，测试/保留快照事实与历史证据核对。版本或内容改变后，旧结果仍在历史中，不能作为当前通过。只移动元件不改变连线语义；逻辑修改后又撤回仍须重新运行客测。

保存失败时保留页面输入与完整导出，阻止继续写入证据和收入；提供重试保存与重新读取。多页面冲突不自动覆盖。损坏或未知版本不自动清空。浏览器清理存储、换浏览器、隐私模式或换设备均不能保证恢复；当前无云端账号或同步。

## 控制器接口

```js
const controller = await openLocalWorkspace({
  programContext,
  policies: {
    requirements: {createRequirementReview,reviewRequirementAttempt,summarizeRequirementReview},
    deriveLearningProgress,
    performLearningAction, // E/A 真实执行适配，返回 JSON result + observations
    softwareRewardAmount: 100,
  },
});
controller.getState();
const unsubscribe = controller.subscribe(() => render(controller.getState()));
```

`getState()` 返回稳定不可变对象，可供 React `useSyncExternalStore` 使用。包含 `learner/attempt/attempts/facts/stage/ledger/storage/scope`。`stage` 由当前事实推导，`presentation.view/tool/tutorial` 只控制界面。UI 应同时显示存储状态，不把 `saving/unsaved/external-change` 显示为已保存。不得仅凭已打开某工具、NPC 下一句或 `programReady` 推进。

| 方法 | 含义 |
| --- | --- |
| `start(nickname)` | 首次创建本机昵称与订单；已有档案拒绝覆盖 |
| `continue()` | 返回当前档案；打开时已执行恢复核对 |
| `claimOrder()` | 领取当前尝试 |
| `editDraft({requirementCard?,wiring?,blockState?,shortSource?,support?})` | 保存作品；相关证据按依赖失效 |
| `reviewRequirements({phase,attempt})` | D 情境回答；`phase` 为 `blocks/short-cpp` |
| `resetRequirementReview(phase)` | 重置指定评审并使旧客测失效 |
| `performLearningAction({phase,actionId,inputs})` | 调真实学习执行器；E 产生动作 ID 和证据 binding |
| `saveLearning(inputs)` | 只存原始练习输入，不能直接授予学习证据 |
| `savePresentation({view?,tool?,tutorial?})` | 界面/教程阅读位置，无通过权 |
| `runTests(phase)` | 当前真实作品运行独立客户测试，失败也保存；无学习前置不运行 |
| `prepareCodeChange({replaceCode?})` | 保留基础快照，生成自己积木对应代码；逻辑改变时显式保留旧文本到历史 |
| `settleSoftwareIncome()` | 仅当前变更证据与学习均完成时，本机同一人/订单只入账一次 |
| `restartOrder()` | 保留旧作品与已获收入，建立新空白尝试 |
| `resumeAttempt(id)` | 继续旧作品，不另建身份 |
| `exportArchive()` | 导出完整 JSON 备份数据（当前尚无备份导入 UI） |
| `retrySave()/reload()/close()` | 处理失败、冲突和生命周期 |

D `responsesCanonical` 直接作 UTF-8 SHA256，快照绑定 `lessonRef/binding/responsesDigest`。D `deriveLearningProgress` 消费原始观察事实；无教学策略时明确 unavailable，不能退回旧 `readyForSubmission`。A 的动作适配应为确定性、可重演的 JSON 请求/结果，不得填补未实际执行的活动。

## 首轮边界和验证

本地合成软件收入为候选 100 EC，重开订单不重复获得。它与真实交付收入分开。昵称不是账号，商城、多人排行榜、教师后台、在线 AI、真实目标编译和烧录均未实现。

`node --test tests/integration/local-*.test.js` 验证身份/草稿/失败与成功证据/收入恢复、重开与继续、旧选项不放行、完整示例不替代学习、布局与逻辑失效、保存失败和多端冲突。这里的教学策略使用明确测试替身，真实软件执行和独立客户测试不使用替身。

`tests/integration/local-progress-harness.html` 使用独立测试数据库，专测真实浏览器 IndexedDB。它是开发工具，不能作为教学或产品验收。统一界面、新分步需求、A 编程教学、NPC 和新手册合入后，仍须逐步走完零基础路径并记录不足。

本次 `scripts/verify-local-progress.mjs` 已实际通过 Chromium：刷新后同一身份、同一订单与全部三次测试（成功/失败/成功）恢复，100 EC 保留；另一页保存会阻止本页覆盖；重开后刷新仍为新空白订单，继续首份作品恢复已完成状态；真实 IndexedDB 并发写只有一方成功。[结果](evidence/local-progress/result.json) 与 [已目视检查的恢复截图](evidence/local-progress/restored.png)。游戏技能客户端也运行并检查截图；由于技能目录没有 Playwright 且默认浏览器版本未安装，仅在 `/tmp` 副本替换依赖/浏览器路径，未改脚本交互逻辑或下载依赖。

浏览器回归曾发现存储尚在提交时，内存已先切到下一阶段。控制器现先发布旧阶段的 `saving/pending`，事务成功后才公布新阶段；失败则保留未保存内容并报错。UI 必须等待命令完成再提示成功或触发刷新。
