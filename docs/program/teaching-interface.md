# 编程返工接口与所有权（2026-11-11）

供总控 `6af44c12-c584-8191-bb60-ba1067a5f02a` 及 NPC 教程专项接入。先核查主目录当前 `ProgramBlocks.jsx`、`program-adapter.js`、`QuestApp.jsx`：空白时直接格式化 BLOCK_ROOT；样例标记 teaching-example；轻代码只显示 source；已有执行与订单测试可保留。

本次只修改 A 的 `src/program/`、`tests/program/`、`docs/program/`。不修改 QuestApp/ProgramBlocks UI 壳、src/tutorial、NPC 对话、公共契约、依赖、奖励或客户订单。已有 parseShortCpp/blocksToProgram/simulate/evaluate 的成功/失败规则不变；generateShortCpp 保留 source/map，并补充表达式级映射和 setup/loop 区间。

新增事实接口（以下名称在本分支实现与验证后冻结）：

- `inspectProgramWorkspace(savedState,{activityId?})`：空白/缺入口/缺结构/非法/可运行状态；人能理解的下一步、工具箱/块/输入槽定位、结构观察节点。空白是尚未开始，不渲染成学生做错。可传 observe-output/read-input/branch-output/repeat-read 对齐当前练习，默认 auto-light；合法但尚缺当前目标的读取、比较、分支或等待时也给出下一步，结构观察仍不能当通过事实。
- `explainProgramDiagnostic(diagnostic,context)`：原错误码保留在技术详情；提供标题、观察事实、下一步与定位。不能替学生接块或修改代码。
- `createProgramLearningMap(program,{blockState?})`：每个变量、读入、比较、分支、输出、等待与主循环的中文含义、代码区间和 block ID。文本解析后的 sourceRange 与生成代码区间分别标记，不猜测任意文本可以还原积木。
- `runLearningExercise({exerciseId,program/topology/...})`：调用现有解释器与固定教学用例，返回真实行为结果、反例、最近读取/分支/写入及代码位置。教学用例不覆盖 D 的正式客户测试。
- 练习证据记录：区分空白开始、加载样例、漏洞练习与恢复；辅助记录不会因编辑而清空；调试要求保留失败→修复的两个版本与轨迹。软件通过、练习证据、是否使用示例分开，理解/独立完成均不由引擎宣称。

实验台仅作 A 模块验收载体：从空白逐个搭建，显式显示样例协助状态，逐步查看代码与轨迹。它不是新版游戏壳或 NPC 教程。总控接入时可用这些事实驱动 Galgame 对话，但 NPC 不应自行写通过状态。

交付后在本文件补齐确切调用样例、操作记录和仍需主入口接入的项目；以实际接口和验收记录为准，不以测试数量判断可玩性。

## E / D 动作事实接口（已实现，可先接入）

```js
import {performProgramLearningAction} from '../program/index.js';
const observed = performProgramLearningAction({
  actionId:'branch-output', inputs:{scene:'dark'},
  program:parsed.value, // 原始 ProgramIR，不是 Result 包装
  topology:{deviceProfile:hardware.executionProfile,deviceProfileRef:hardware.ref,wiringRef},
});
// Result<{actionId,program,factCodes:['dark_branch_observed'],
//   facts:[{factCode:'dark_branch_observed',source:'program-runtime',payload:{...真实事件}}],
//   simulation:{...真实执行},observation:{...真实读/分支/输出}}>
```

| actionId / D activityId | inputs | 成立时唯一事实 | 来源 |
| --- | --- | --- | --- |
| observe-output | `{on:true或false}` | guided_output_observed | program-runtime |
| read-input | `{light:0…1023整数}` | current_input_read_observed | program-runtime |
| branch-output | `{scene:'dark'或'bright'}` | dark_branch_observed 或 bright_branch_observed | program-runtime |
| repeat-read | `{}` | repeated_current_read_observed | program-runtime |
| code-mapping | `{nodeId:学生实际点选的比较节点ID}`，另传保存的 `blockState` | own_comparison_mapping_observed | program-analysis |

`observe-output` 明确执行引导程序，不冒充学生作品；其他运行操作使用传入的确切当前 ProgramIR，每次独立运行。暗/亮使用固定合成 150/850 和布尔预期；分支事实需要执行过的 if 分支包含最后写入，且最终状态正确；重复读取在 0/100/200ms 更新 150→850→180，每次有 100ms 观察窗，要求窗内重新读取并产生对应输出，不强迫学生恰在某个毫秒读取（例如 30ms 周期也可得到事实）。没取得观察时 `ok:true,factCodes:[]`，并保留失败/预算/实际轨迹，不能视为完成。

`code-mapping` 只生成传入积木的真实比较映射，拒绝不存在/非比较节点。E 必须从该学习者持久化的积木快照提供 blockState，并验证它就是当前保存版本。A 不产生 `own_blocks_snapshot_preserved`，因为 A 没有存储权限与写入证据；也不从 `testRun.passed` 生成正式客户测试事实。base-delivery/change-delivery 由 E 在学生明确运行**完整 D 套件**后核实；源码/快照事实由 E 在实际保存后核实。

对齐 D 当前 `deriveLearningProgress`：

```js
// E 在实际调用前生成 learnerActionId；不接受 UI 提交的 factCodes/passed。
const raw=performProgramLearningAction(actualAction);
if(raw.ok) {
  const observations=raw.value.facts.map((fact,index)=>({
    id:makeObservationId(index), learnerActionId, activityId:actualAction.actionId,
    source:fact.source, factCodes:[fact.factCode], binding:actualCurrentBinding,
    payload:fact.payload,
  }));
  // E 持久原始 actionId/inputs/确切作品与绑定，恢复时重跑 A 并重算这些事实。
}
const progress=deriveLearningProgress({requirements,changeRequirements,
  context:verifiedContext,observations:replayedSourceVerifiedObservations});
return {...progress, readyToAdvance:phase==='blocks'
  ? progress.readyForCodeChange : progress.readyForSoftwareDelivery};
```

E 的 `summarizeLearning` 适配需要按当前依赖提供 D 的 context/base/change（learnerId、attemptId、requirementRef、requirementsEvidenceKey、wiringKey、blocksKey、sourceKey）；A 不伪造这些摘要。一个 learnerActionId 只绑定一个 activityId；暗/亮分两次实际动作，不能借一次总客测生成所有练习事实。改变作品后旧观察按 D 的依赖规则失效。参考协助记录持续保留，但任何地方都不输出“已理解”或“独立完成”结论。

`assessLearningRecord` 是 A 独立练习台的预测/失败/查看/修复记录摘要，没有个人或订单版本绑定；**不要直接把它当 E 的 readyToAdvance**。正式七项里程碑始终使用 D 的 deriveLearningProgress 和 E 重算后的来源/绑定事实。A 练习台目前记录只在本页内存中，正式持久化由 E 完成；不得把恢复的派生布尔值当作源事实。加载完整参考的原始 action 也应保留，不能因后来编辑或把 support 改成 manual 而清除历史。
