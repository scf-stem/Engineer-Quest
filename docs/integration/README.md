# 2026-11-11 返工更新

当前适配以 [完整本机控制器](local-workspace.md) 和 [教学返工记录](teaching-rework.md) 为准。下方会话实验台、旧四项方案卡与旧测试数字保留作历史接口说明；它们不能作为新主线放行或零基础体验验收。新游戏壳正在绑定正式 A/D 学习事实、NPC 和完整手册，尚未邀请用户交付验收。

# 公共适配与主入口 · 0.2

当前软件路径为 A（程序）+ B（接线）+ C（视觉）+ D（客户真值）+ E（版本与合成状态）。四专项目录保持原提交，公共适配全部在 `src/integration/`。

```js
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../src/integration/program-adapter.js';

const hardware = await createHardwareContext();
const context = await createProgramContext(hardware);
const identity = context.createSession('合成员工');
// program 来自 A 的 blocksToProgram 或 context.parse(source)。
const snapshot = await context.submit(identity, {
  phase: 'short-cpp', program, wiring, source, requirementCard,
});
const proof = await identity.lab.runTests(identity.session, snapshot.id);
// 仅当前完整新版测试通过后可演示 synthetic 软件收入。
const event = identity.lab.settleSoftwareDemo(identity.session, {evidenceId:proof.id});
```

`phase:'blocks'` 绑定 D 需求/测试 `1.0.0`，`short-cpp` 绑定 `1.1.0`。调用方不能提交 owner、任务规则或奖励金额。Context 固定实际 evaluator；不能由学生请求上传“passed”替代运行。`createSession` 是内存 fixture 能力，不是真实登录或后端鉴权。

## 适配事实

| 边界 | 显式处理 |
|---|---|
| D → A | `light → LIGHT`，`lamp → LAMP`；固定时间、输入和断言保持不变 |
| B → A | 只消费 B 已验证拓扑，A0 为模拟输入，D9 转整数 9 为布尔输出；初始读数 0、灯 false 为合成约定 |
| A → D | 运行状态原样传递；实际 `completedThroughMs → simulatedUntilMs`，实际 `steps → totalSteps`；不补造覆盖 |
| A 文本 ↔ IR | 比较去除节点 ID/位置后的语义，绑定确切文本 SHA-256；语法或行为不一致拒绝 |
| 版本摘要 | E 外层 profile、需求、测试、手册、程序、接线与源码使用 SHA-256；B 的可选 undefined 字段明确转 JSON 省略 |
| A/B 内部 ref | 保留模块的候选类型/语言识别标记，以兼容原校验器；它们不是哈希。E 外层摘要覆盖完整候选设备、元件目录和执行视图；不将 draft 标记当凭证 |
| 手册 | B `4.1/4.2 → 04.1`，`5.2 → 05.1`，`5.3 → 05.2`，`6.1/6.2 → 06.1/06.2`；未知节号不猜测 |
| 位置 | 电气比较忽略元件位置、线 ID/方向/顺序；布局单独存在草稿中 |

两份设备视图共用同一个 E bundle ref，摘要同时覆盖 B 展示/规则资料和 A 执行 pin map。Uno `variant/fqbn:null`、`calibrationStatus:'synthetic'`、实物待核验均保留。生成器返回 `compileStatus:'not_run'`，不能自行填成功。

## 状态和证据

`QuestApp.jsx` 使用 C 的受控组件，不使用 `EngineerQuestDemo` 的合成人物/收入/通关。`ProgramBlocks.jsx` 延迟加载真正 Blockly，初始为空；明确加载示例时记录协助。文本前积木快照保留，查看时只读；选择编辑新积木版本也保留文本。

依赖编辑产生本机新 revision，旧 UI 结果过期；删除后撤销不能重新激活旧通过。内存仓库每次提交创建不可变快照，异步测试前后核对当前 snapshot，历史保留。源码导出由当前已测 IR 生成完整固定 Arduino 运行库，短代码摘要与完整源码摘要分别显示；不是任意 C++ 执行或目标编译。

静态 NPC 的 `readyForSubmission` 只检查选项与解释存在。页面保存卡片后允许继续本地虚拟练习，并始终显示解释待核对，没有真实需求审核签核。教师安全/功能审批、求助队列、烧录没有成功按钮。

`synthetic-lab` 当前仅实施正向合成软件收入：100 EC，个人+订单 ID 唯一；新提交、新测试、新幂等键或任务版本不增发。余额与收入字段分开，购买、退款、撤销和正式账本未实现。D 的 300 EC 实物交付候选规则未执行。刷新清空会话收入和证明，不能从 localStorage 恢复权威。

## 验证与后续

- `npm test`：89 项；实际 A/B/D 组合、语言预算、源码与解释器本机 C++ 对照、拓扑、个人版本及幂等。
- `npm run verify:integration`：7 场景/46 条固定断言，450/600 两版本；新版 450/700 失败，600 通过，收入只记一次。
- `npm run test:e2e` 与 `EQ_PREVIEW=1 npm run test:e2e`：各 5 项；完整软件纵切、旧入口、手机恢复、实际探索与1265px接线可用性。
- 实际截图：[桌面](evidence/workstation-desktop.png)、[接线](evidence/workstation-wiring.png)、[积木](evidence/workstation-blocks.png)、[代码](evidence/workstation-code.png)、[收入](evidence/workstation-income.png)、[手机](evidence/workstation-mobile.png)。浏览器使用明确示例协助，不证明零基础独立搭建。

尚无真实账号、跨设备后端、在线 AI、目标板编译/上传、实物校准/验收、正式收入榜、可售商城或真实学生试教。ARPG 式探索已接入；导航协议使用 `onAction(actionId)`，所有业务前置条件仍由 E 判断，不因热点点击授予通过或奖励。

## 空间探索与可用性增量

`experience-state.js` 仅从当前个人事实派生一个目标与动作可用性：入职、领取委托、保存方案、修正接线、基础软件测试、保留积木快照、客户变更、合成入账、回看成果。它没有“看过几个热点”的输入，旧通过或断线状态不能推进目标。目标文字和物品说明使用 D 的体验候选，不改变客户真值。

入职后点击“我的工位”打开 C 的 `ExplorationStation`。三处场景热点和同名列表都只打开邮箱、静态对话或 D 的工具箱用途卡；手册使用实际 §05.1/05.2。`onHome` 在原 React 会话中回到普通操作工位，避免整页导航清空测试和收入。两个界面的提交、测试和入账仍使用原有业务按钮。

`QuestTracker` 在场景与普通界面互斥显示一个当前目标；工作档案只列确实存在的方案、基础/变更运行和合成收入，不制造排错徽章或职业能力结论。过期记录标历史，当前目标要求重测。普通界面及“直接打开工程工具”可跳过探索，静态对话可立即关闭，串联工具箱→手册关闭后回到原入口焦点。

B 增量保持 props 与严格校验不变：空白只含缺少连接诊断时为中性待连接；未知结构、外部 error 和真实短接仍报错，进入积木仍禁止。实际容器断点与默认全景使1265px嵌套工位的全部元件可见；手机可切放大和左右查看，不要求先找到滚动条。

NPC 面向学生显示“当前需求 / 手册 §...”并打开确切章节；来源 ID、路径和方案摘要放在可展开详情。无法匹配版本的引用显示待核对。

最新实际截图：[探索桌面](evidence/exploration-desktop.png)、[探索手机](evidence/exploration-mobile.png)、[初次接线1265px](evidence/wiring-first-1265.png)、[手机全景](evidence/wiring-overview-mobile.png)。新增两条浏览器回归验证热点无业务副作用、唯一目标、D 物品内容、正确手册、焦点/减少动效、无刷新收入保留、初始中性与真实危险、全景/放大和页面无横向溢出。
