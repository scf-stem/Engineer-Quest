# 需求情境舞台与焦点交接

2026-11-12。专项工作树 `.worktrees/requirements-stage`，分支 `work/requirements-stage`，基线 `a5721d0fdbfe4bd53dba467bc392857abff45986`。策划依据为主目录只读的《需求梳理页面_空间与焦点改造方案_2026-11-12.md》。应用源码最终摘要 `dialogue-73dba1f086f5`（sha256: `73dba1f086f518471428f34977cd8badc0cbf9cfff19560eab4b492d8c34d4b1`）。本专项不发布候选、不推送、不部署；5255 只是隔离开发验证。

## 已实现

- 需求六幕及变更四幕改成上方情境舞台、场内边侧林工、下方贯通对话/操作台。仅保留一层章节标题，反馈的标题、情境序号、桌面、仪表、灯都冻结到明确继续。
- 第一幕光照表只观察；日期、当前光照、开机旧便签在相同的三列卡组中，样式、宽度与黄色组焦点等权，保留原 public option IDs。
- 主焦点随讲解、真实遮挡、实际读数、整组选项、原始提交、错误反馈/重试、成功继续、保存恢复移动。黄色只描当前目标，无遮罩、无倒计时、无新增“我已看懂”。选项一直可作答，不把阅读展示进度变成通过门槛。
- 遮挡 850→150 后，重试、刷新、大厅再进和正确反馈都保留150。点击继续才换到下一幕160。灯只在明确开/关选项时改变，“保持/不动作”保留实际状态。
- 求助菜单容纳追问、重讲、原话和小观察请求；手册保持次级入口。内部求助暂停焦点；宿主外部面板使用可选 `focusSuspended` 接口。
- `ChangeArtifactStage` 增加可选 `area='scene'|'controls'`，默认 `all` 保留旧调用。实际本人积木生成代码/旧26采样回信留在舞台；原节点按钮、原D选项到下方。原比较节点→`story-comparison-selection`→`new-current-suite`携带`intent.mappingNodeId`→A真实`code-mapping`路径保留。 guided 变更回信明确“代码还没改”。
- 正文和主选项在电脑小窗口至少16px，大屏18–20px；主操作44px起。200%文本允许同一个主内容区滚动，必要时只滚到当前目标。读数/灯为DOM对象，图片裁切不会移走它们。

## E需接入的两个宿主接口

本专项未修改 QuestApp、first-order-story、GameShell、手册、课程、A执行器、local-workspace、ledger 或根配置。

1. 给 `RequirementPractice` 传 `focusSuspended: Boolean(dialog) || active !== 'mail'`，默认值为false。E已在主目录接好，专项分支按边界未带入。
2. 从 `src/integration/requirement-stage-display.js` 导入 `requirementStageHandoffPending(state, phase='blocks')`。自动wiring/code剧情资格在真实ready之外再等待 `!requirementStageHandoffPending(state,'blocks'/'short-cpp')`，避免最后一题D刚发布ready就盖住当前反馈。显式继续会先持久化continued，再调用原onNavigate。它只延后呈现交接，不改变Dready、作品资格、收入或任何证据。

展示记录：`attempt.learning['requirement-stage:blocks'|'requirement-stage:short-cpp']`，`schemaVersion:1`。记录包含 `learnerId / attemptId / phase / checkpointId / challenge / current / desk / observation / cue / handoff / submission / priorResponseIds / reviewBinding / reviewResponseIds`；response保留原始D返回summary用于当次展示，不另存passed。`handoff`为`submitting`、`feedback`、`continued`。

提交前先await保存submitting（其中有本次真实responseId与此前真实回答ID列表），之后才调用D。helper同时验证learner、attempt、phase、检查点、原review binding，以及实际最新responseId/optionId和此前回答序列；只在原始回答尚未写入或确切已写入的本次回应上等待。显式继续先保存continued。错员工、错尝试、重开评审epoch、版本/binding变化、回答序列变化、无记录都不延后宿主剧情。刷新落在D已提交而反馈尚未落盘的缝隙时，根据实际最新原始回答及D重演summary恢复反馈；不凭展示记录认定通过。旧无journey档案仍能重开真实评审并操作。

根 `.eq-requirement-stage` 提供 `data-checkpoint-id`、`data-focus-target`、`data-focus-intent`、`data-stage-response`；目标稳定值为 `explain / observe / reading / choices / submitting / feedback / continue / recovery / suspended`。仪表`data-reading`与灯`data-lamp=on|off`均为当前可见手动演示。`data-option-id`、`data-change-node`、`data-scene-continue`保留。E可把可见舞台这些只读摘要加进render_game_to_text；无需全局setter。

## 验证结果与证据

最终应用源码 `dialogue-73dba1f086f5`：构建通过。保留原有JSON import attributes和大包提示，没有引入依赖。`git diff --check`通过。

真实正式入口测试共11条通过（8条新专项、3条既有主线），使用独立5255及本worktree离线安装依赖。最后一轮8条新专项与既有3条在同一源码合跑11/11，包含第一次回应前刷新仍保留读数的空历史边界。新专项正常路径的pageerror/console.error均为零。所有截图已实际打开核看，未仅靠首屏或断言判定体验。

- 1920×1080、1280×720、1024×768：空白新员工真实入职/领取委托，遮挡850→150，原续读转选择、三项等权、误选日历、同幕重试、刷新、求助开闭、手册开闭、大厅再进、双击正确项，原始回答恰好两条；反馈读数150、序号1/6，明确继续后160/第2幕。见 `evidence/{1920,1280,1024}-{observe,equal-choices,retry,accepted-150}.png`。
- 后续暗/亮：开灯后亮处“keep-on”仍亮，正确关灯才灭；时序推进150→850；450等值整组选项；迁移序列保留四时刻。见 `1280-no-action-keeps-lamp.png`、`1280-timeline-reading.png`、`1280-equality-choices.png`。
- 键盘Enter操作遮挡/选项/继续、Tab能到同组下一张卡；prefers-reduced-motion启用；1024下html字体200%，当前响应和继续实际可按。见 `1024-text-200.png`。
- 本人变更回归使用已明确标注的E真实鼠标作品归档（不是另一次零基础验收），500/600、本人比较、真实26采样、旧450新版12/20失败、改600新版通过、收入100幂等和刷新由原主线回归覆盖。见 `1280-own-code-choices.png`、`1280-own-comparison.png`、`1280-own-evidence.png`及1024对应截图。
- 旧无journey归档回归通过真实UI“保留旧回答重新核对”，重新操作850→150并提交真实D。见 `1024-legacy-review.png`。
- 一次性原生IndexedDB put抛QuotaExceededError的显式故障回归：提交前展示保存失败，界面保留150、明确重试；恢复后实际D恰好一条回应，未造通过。见 `1280-save-recovery.png`。当前专项基线的E store.get.onsuccess未捕获同步put抛错，浏览器同时报告一次精确注入错误；专项测试精确断言该一条后清空，其他路径不放宽。E已接单在主目录修存储错误捕获，合入后需将此专用断言收严为零错误并重跑。

开发游戏标准动作客户端已运行并打开截图。技能原路径缺playwright依赖，使用node_modules内临时原脚本副本，只补现有Chromium executablePath；该客户端对DOM界面仅提供首屏输入烟测（无canvas时鼠标编排不执行），证据为 `evidence/standard-client/`，不作为本专项多步验收；正式多步证据来自上述真实页面动作spec。

## 剩余整合检查

E接入外部dialog暂停与最终handoff后，再用完整宿主检查：最后一题正确反馈保持到明确继续，手册打开时data-focus-target=suspended，关闭恢复原焦点/句子/滚动，宿主自动剧情不提前切幕。专项工作树尚无这两处E宿主改动，不能宣称其已验证。E修原生存储异常捕获后收紧并重跑故障断言。

未修改既有公共e2e helper/spec。既有 `scripts/verify-requirement-practice.mjs` 仍依赖旧独立标题和常驻求助按钮/原话details，需E按新 `data-checkpoint-id`、求助菜单及完整标题调整旧验证脚本；本专项不擅改它。既有storyline/storyline-change三项已直接通过。
