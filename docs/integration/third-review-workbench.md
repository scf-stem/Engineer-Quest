# 第三次独立试玩判退后的工作台与变更带教修正

2026-11-11。接受第三次独立 computer use 的结论：旧候选 `dialogue-9cce64e9e15b` / `4557fb1` 首单功能闭环通过，整体体验未通过。本轮直接在 E 的 integration 工作区修正宽屏裁切、值槽误替换和重复变更台词。没有新建重复专项、改其他工作区、推送或部署。本页是下一轮独立复验的交接，不是教学合格结论。

## 固定版本与启动

- 最终候选 **`dialogue-03ad3eb46135`**，源码 **`74ba55029c2e3e355ee1cc5d4cc949b4f83d7a24`**。
- 内容 SHA256：`03ad3eb46135a004127bc740d17ac813a4036077c619426409fd6a3db7571af5`。
- `frozen-candidate`、`sourceDirty:false`；[构建记录](evidence/third-review-workbench/build.json)、[实际页面版本](evidence/third-review-workbench/01-final-version.png)。HUD 候选按钮、`/candidate-build.json`、`render_game_to_text().build` 应一致。
- 主体提交 `db4673b`；真实拖动预览保护修正 `d9a4e28`；撤销同步修正 `74ba550`。后续仅证据/普通交接文档提交不改变内容摘要。重建时提交字段可能更新，须核对内容 SHA。
- 本机固定预览 http://127.0.0.1:5210/ 。5190 保留 E 合成工位。独立复验使用隔离浏览器从空白开始，勿导入这里的归档或用专项 harness。

```sh
npm run build
npm run preview -- --port 5210 --strictPort
```

若 5210 已由本项目预览占用，直接打开现有预览。开发命令 `npm run dev -- --port 5190 --strictPort` 会热更新，不用它冒充冻结候选。

## 三项修正

### 3440×1157 工作台

图形程序工具使用有界高度的三列工作区：左侧保留当前动手按钮，中间给工具箱/画布，右侧看实际 LED、读数和分支。去掉外层模态的多重纵向滚动与猜测 `vh` 画布高度；只有带教正文、Blockly 工具箱和画布各自滚动。宽度显式填满可用区，不再受继承的自动边距收缩。

工具栏增加“找到等待积木”，直接打开单独的等待分类；旧“变量与流程”仍含等待，原手册路径可继续使用。没有自动给程序补等待。当前练习与待复核的操作按钮放在可滚动正文之前。[实际宽屏](evidence/third-review-workbench/02-3440-wait-and-actions.png)与[1280×720 回归图](evidence/third-review-workbench/regression/1280-core-actions-fit.png)可核对。720px 高窗口仍需平移/查看完整积木，不能据此称复杂手机搭建合格。

### 精确值槽与真实反馈

“精确槽位”列出当前真实图中的具体输入，如“比较 1 · 左边值（空）”。选中后将实际槽口高亮、定位并锁定本次值积木目标；可取消返回自由拖动。整数取值不能替代 if 的真假条件；已有非影子值默认保护。只有学生先选一个已占用槽、明确点“允许本次替换这个槽”，才允许更换该槽一次。现有加载/恢复作品不被重写。

拖动检查使用拖动开始时的实际占用图，排除 Blockly 临时插入预览，避免把空槽误判成占用。结束提示从实际父块和输入名读取，“比较·左边值”与“某动作后面”分开；不会再把输入连接称为上一块动作。

截图复核发现撤销后的列表仍显示旧占用；进一步修复撤销同步，立刻保存真实图、刷新列表。新增浏览器检查会先自由拖动、确认原 if/比较未替换、撤销、刷新确认空槽和散落值都保留，再锁定左值并拖入同一个值。自由拖动可能安全连接到相邻空左值，这也是合法结果；不要求它必须散落。没有靠检查“看起来在附近”代替实际父子关系断言。[高亮空槽](evidence/third-review-workbench/regression/precise-left-slot-highlight.png)、[实际连接](evidence/third-review-workbench/regression/precise-left-slot-connected.png)。

### 客户变更带教

保留 D 的四项证据要求，但呈现不再是连续四块相同选项面板：前两幕预测500和等值600；第三幕打开当前学生自己的积木→代码映射，必须点实际比较节点才能回应林工；第四幕拿出实际基础版客户回信与采样数，讨论它能证明什么，然后回到当前代码工位。

每幕的正确回应都有具体原因和下一处行动：500跨越450/600的区别、600等于边界、本人比较与同一引脚、旧回信对应旧作品。六个基础情境也有逐情境回应。仍是有限本地脚本，不声称理解任意中文或在线 AI。是否自然、有角色感、有助于迁移理解，必须交给下轮独立实际试玩判断。

查看本人映射与旧回信不执行测试、保存学习事实或入账。原 D 回答门槛、A 的实际映射/确切源码动作、独立客户预期、学习事实顺序与版本失效不变。重新评审会使相关本人映射观察需要真实复核；角色对话不会自动补齐。

## E 在最终候选的实际操作

原生浏览器只用可见 UI 操作，没有注入程序/通过状态或载入完整样例。本轮使用原有合成身份和原本人作品，**没有重新从空白搭完首单**。

1. 记录最终候选完整 SHA、源码与干净构建状态。
2. 切到未完成的尝试3，在3440×1157打开完整等待工具箱，当前动手按钮仍在左边。实际移开原本连到持续执行的等待积木，撤销并刷新；等待连接保留，林工仍准确指出变量缺初值。该尝试仍未完成、无测试。[刷新后作品](evidence/third-review-workbench/03-native-undo-restored.png)。
3. 继续尝试1，保留旧回答后重新核对变更。预测500亮、600灭；分别得到专属解释。[500](evidence/third-review-workbench/04-change-500-feedback.png)、[等值600](evidence/third-review-workbench/05-change-600-feedback.png)。
4. 选本人实际比较，看到保留积木生成的 `(light < 450)`；回应后林工讨论同一输入输出和比较边界。[实际映射](evidence/third-review-workbench/06-own-comparison.png)、[具体回应](evidence/third-review-workbench/07-comparison-feedback.png)。
5. 实际旧基础回信显示26条采样。选只用旧回信被拒绝，再选带当前作品到新版场景；林工解释新旧证据区别。[旧回信](evidence/third-review-workbench/08-actual-old-letter.png)、[拒绝](evidence/third-review-workbench/09-old-letter-rejected.png)、[新意图](evidence/third-review-workbench/10-new-proof-feedback.png)。
6. 回到代码工位时，当前600源码保留，学习位置保留；仍需显式复核本人比较，测试/导出/交付暂时禁用。这证明对话没有代发学习事实。[实际前置](evidence/third-review-workbench/11-review-does-not-grant-learning.png)。
7. 实际点本人比较、运行当前变更客测，20/20；导出同版ino、正常交付，仍一笔100EC。先立即刷新回到了此前保存的代码视图，测试与收入在；随后保存交付视图再刷新，回信恢复。[当前测试](evidence/third-review-workbench/12-current-tests-pass.png)、[首轮刷新保留当前测试](evidence/third-review-workbench/13-refreshed-current-tests.png)、[保存后刷新交付](evidence/third-review-workbench/15-refreshed-delivery.png)。临时3440视口已恢复。

[实际导出档案](evidence/third-review-workbench/local-backup.json.gz)有3次尝试，尝试1共12份真实报告，包含2次失败，尝试3依然没有通过。旧 `d9a4e28` 中间候选实操为第11份；最终候选为第12份变更报告。全部历史保留，不升级旧证据。当前手册 SHA 仍是 `6b937d8b548d36b3536184014482b9aff3857d7d4d071a1784f5c30cd8c27ade`，本轮未改手册，不需伪造重跑基础测试。重演确认当前9项课程检查、6线、学习顺序、12份结果、一笔100EC和[实际下载ino](evidence/third-review-workbench/engineer-quest-current.ino)均一致，见[重演结果](evidence/third-review-workbench/replay-result.json)。

`intermediate-d9a4e28/`只保留发现撤销同步缺陷前的那版实操、导出与客户端截图，不能算最终版本。`regression/`是最终生产候选的自动化回归，含从实际归档显式截断的未完成检查点，不冒充另一名零基础学生全程试玩。

## 验证与下一次独立复验

```sh
npm test
npm run build
EQ_PREVIEW=1 npm run test:e2e
node scripts/verify-novice-record.mjs --workbench
EQ_UI_PREVIEW=1 npx playwright test --config tests/ui/playwright.config.js --workers=1
```

最终168/168单测、15/15生产主入口回归通过；撤销/刷新/精确拖动连续3次通过，6项存储UI回归在本轮前一代码版本通过（其后只改拖动/撤销）。标准游戏客户端在最终候选运行并实际目检版本截图、状态，无错误文件；原生页面未捕获新控制台错误。构建仍有既存 JSON 导入属性与 Blockly 大包提示，无新依赖。具体机器结果与范围见[验证记录](evidence/third-review-workbench/verification.json)、[文件摘要](evidence/third-review-workbench/manifest.json)。

请下轮未参与实现者用空白隔离浏览器，先核对最终 SHA，再不读答案、不载入完整样例地完成首单；特别复验：

- 3440×1157从空白找到等待、工具箱滚动、不同练习操作与实际灯/读数；是否还需要找外层滚动条。
- 第一次拖变量到比较左值是否能理解目标；试靠近整个if、撤销/刷新、明确替换一个占用槽。看实际结构和学生是否能自行修正。
- 变更是否像与林工一起看自己的作品；500/600两幕到本人比较/旧回信的转换是否自然。台词是否具体但仍显重复，额外映射复核是否令人困惑。
- 一次真实失败、修正、复测、便签立即刷新、交付与继续旧作品，不能只恢复完成档案。

首单功能在旧独立试玩通过，整体体验此前三次未通过；本轮不自评合格、不邀请用户作交付验收。真实学生试教、复杂手机搭建、课堂时长和教学迁移尚未验收。真实账户、商城、多人榜、教师后台、在线AI、目标编译、实物烧录与真实收入不在当前实现内。
