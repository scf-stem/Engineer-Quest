# D 线：个人自动灯课程内容 V0.1

**最新返工以 [需求与渐进关卡 V0.2](需求关卡返工_V0.2.md) 为准。** 旧四项覆盖不再授予继续资格；新增基础六情境、变更四情境及七项操作观察门槛。旧 V0.1 交付/审查文字作为历史事实保留，不能据其“单测通过”声称游戏与教学已合格。

2026-11-11。本交付基于 `eb0f63f`，仅新增 `content/`、`tests/content/`、`docs/course/`。执行依据依次是最新专项指令、[开发计划 V1.1](../开发计划.md)、[五线接口草案](../自动灯接口与五线协作_V0.1.md)；历史 PRD 与全流程文档中的小组、语言、旧教学顺序不作为本版要求。实际工作区为项目内 `.worktrees/course`，分支 `work/course`。

现已实现可导入课程数据、静态 NPC 问题卡与客户输出比较器。公共入口尚未接入；旧 `engine.runSuite` 原样保留，集成时必须替换旧的动态预期路径。不能把本交付表述为在线 AI、完整时序引擎、电气仿真、编译烧录或实物闭环。

| 文件 | 用途 |
| --- | --- |
| `content/index.js` | 冻结导出的 `courseBundle` 与按明确版本查询的入口 |
| `content/auto-lamp/order.json` | 原创公司名称候选、个人订单、中文需求、轻代码客户变更 |
| `content/auto-lamp/requirement-card.schema.json` | 需求卡提交形状的 JSON Schema，不把合法形状等同正确答案 |
| `content/auto-lamp/customer-tests.json` | 两版固定输入、字面量预期与执行预算；基础 4 场景、变更 3 场景 |
| `content/customer-tests.js` | 比较解释器提供的轨迹与冻结断言，不执行学生程序 |
| `content/auto-lamp/stages.json` | 九阶段动作、反馈、产物、通过条件、失败提示、求助与教师介入 |
| `content/auto-lamp/npc.json`、`content/npc.js` | 四类中文选择、一次一个问题、可追溯引用与静态降级 |
| `content/auto-lamp/review-examples.json` | 14 个合成静态评审案例与未来在线评审验收场景 |
| `content/auto-lamp/manual.json` | 20 个纸电共用节号与短说明，未定页码、未做定稿 Word |
| `content/auto-lamp/hints.json` | 五个卡点主题，每个四级帮助 |
| `content/auto-lamp/economy.candidate.json` | 个人收入榜、累计收入与余额分离的候选规则和禁售候选模块 |
| `content/demo.js` | 借现有原型输出演示“正确/错误阈值”比较；不验证旧引擎时序 |

在项目根运行，无新增依赖、无需网络：

```sh
node content/demo.js
node --test tests/content/*.test.js tests/*.test.js
```

第二条是本专项的完整回归命令。现有 `npm test` 仅匹配顶层 `tests/*.test.js`，不会运行新增的子目录；由 E 统一修改测试入口。本次在 Node `v25.5.0` 验证，受支持 LTS 矩阵由 E 另行统一。

实际演示结果：基础 450 通过；基础改成 700 在 `base-boundary` 失败；明暗输出反转在全部基础场景失败；变更仍使用 450 在 `change-middle`、`change-boundary` 失败；变更使用 600 通过。32 项回归通过，其中内容专项 22 项、旧引擎 10 项。测试还拒绝 `<=`、一直亮/灭、只读一次、缺失关灯、响应超窗、缺失输出、缺场景、过期版本、未完成和预算失败轨迹。

原有十项测试通过只说明本交付没有破坏旧演示；其中旧 `runSuite` 的动态阈值缺陷仍待 E/A 接入本内容修正。当前未运行浏览器、Arduino 编译、真实硬件或真实学生试教。

详细调用与接口边界见 [集成接口](集成接口.md)，现场脚本与观察表见 [首单教学脚本](首单教学脚本.md)。

2026-11-11 增量：按用户 ARPG 般体验要求完成 [游戏性审查](游戏性审查_2026-11-11.md)，保留独立 UI 小样六步与实际主入口前三段的 [当次截图证据](游戏性审查_证据索引.md)。新增 `experience.candidate.json` 与 `firstOrderExperienceCandidate` 导出，供 C/E 增量接入唯一目标、三处可跳过探索、短对话与作品成长反馈。动作 ID 已对齐 E 的纯导航协议，不改变课程通过条件或奖励。E 已另行完成主流程接入；本文前面的“未接入口”描述属于 D 首轮交付时状态，最新集成证据由 E 维护。
