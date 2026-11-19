# 独立试玩意见后的体验修正候选

> 最新状态：第二次独立试玩仍判退，持续角色交流返工见[新候选与证据](ongoing-dialogue.md)。本页为历史阶段记录，不能作为最新体验合格结论。

2026-11-11，基线 `29a9f0f`，只在主目录 `integration` 修正。总控转交的独立 computer use 已从空白完成26/26、20/20、100EC与刷新，但判定体验不合格；本轮接受该结论。这里记录可供独立复验的修正，**没有宣布适合交给用户验收**。

## 五项修正与证据

| 试玩问题 | 当前改动 | 已验证范围 |
| --- | --- | --- |
| 改积木后从双分支退回读取 | `facts.practice` 单独投影历史真实动作支持的教学位置；D的当前有效证据仍原样严格计算。受影响的读取/分支/重复读取列在独立复核区，只有明确点击且实际重跑才补证；本人代码映射需重新点本人节点，不由复核按钮自动授予 | 正式A/D单测、主入口双分支位置回归；E真实鼠标把本人450改451后停在基础交付位置，原结果仍失效 |
| 大问卷、NPC未贯穿 | 林工就地参与当前情境、接线、编程、变更和交付。场景中可移动遮挡或推进客户输入序列；读数变化后林工回应这一动作。当前判断作为紧凑对话回应，原话改为可展开的选填补充；宽屏并排显示场景和光照表 | 新尝试真实六情境至接线资料；动表后写原求助句仍留在当前题；程序/收入门槛不由聊天或光照表授予 |
| 观察缺少同屏反馈 | `ProgramObservation`从A执行事件重建实际读数、最近判断、LED状态及变化时刻。可以逐帧查看或重放；减少动效保留逐帧查看。明确区分修改前记录、隔离点灯、本人程序与客户执行 | 实看150/真/亮 → 850/假/灭 →180/真/亮；实际错误边界仍被固定客户断言拒绝 |
| 完成后只有调试账本/UUID/去重 | `DeliveryReceipt`显示软件演示成果、客户回信、本机合成100EC、本人原型/失败修正/当前代码入口、工程便签及保留历史重试。没有UUID或去重按钮；客户完成反馈只在当前代码和学习事实就绪时出现 | 鼠标实操、便签刷新恢复、重复正常交付仍100EC；未就绪或重开时不冒充当前软件交付成功 |
| 节号与宽屏布局 | B候选节号经宿主解析后再显示和打开，光照模块§05.1、LED/电阻§05.2；正式节号可重复解析。修正基础积木页误显示变更600需求。工具切换回顶部，去掉嵌套滚动干扰；调整宽/短窗口画布与侧栏尺寸 | 原生点击模块→§05.1正文；浏览器核对LED→§05.2；桌面/手机截图实看 |

手册操作册也同步修改了交付按钮、取消调试去重入口的说明和新复核/同屏观察流程。全文SHA因此改变：旧6次报告保留为历史，E在真实界面重新运行基础与变更、重新点本人比较映射，形成最后2次当前手册报告；没有把旧报告手册摘要改成新版本。

## E本轮实际操作

使用原本从空白亲手搭出的合成工位，未加载完整示例或用隐藏Blockly接口写状态。

1. 查看玩家回信，填写自己的排错便签，刷新后便签和100EC保留。
2. 回看本人积木，选择真实记录的100ms，观察850、判断假、LED灭；切200ms看到180、判断真、LED亮。
3. 解锁编辑这份积木，将450改451。教学仍留在已经到达的基础交付位置，当前测试按钮暂不可用；读取/双分支/重复读取单列待复核。
4. 明确点击三项复核，各由真实程序执行新观察。运行固定基础测试，得到“449、450、451边界，800ms期望灭、实际亮”。没有跟随学生451修改客户预期。
5. 改回450、运行基础、继续原有600文本、变更复测、再次正常交付，仍只有100EC。
6. 切到保留的空白尝试2，领取委托、遮光查看850→150及林工反馈；选正确输入却说“我完全不懂，随便选的。”仍被引导重试。完成六个真实情境，推进620→430序列，进入空白接线并点击光照模块，资料显示并跳转§05.1正文。
7. 手册文字校正后刷新，旧报告按版本失效。重新基础测试、明确点本人比较节点、变更测试及交付，再次导出同版候选ino和档案；刷新当前交付仍恢复。

这是**原作品修正/新情境局部复核**，不是声称本轮又独立从空白搭完整自动灯。最新界面的完整空白路径仍交独立 computer use 复验。

## 证据与复现

- 原生操作：[玩家回信](evidence/experience-refinement/01-player-receipt.png)、[同屏亮处关灯](evidence/experience-refinement/02-same-screen-bright.png)、[修改后位置保留](evidence/experience-refinement/03-edit-keeps-position.png)、[独立客户失败](evidence/experience-refinement/04-customer-failure-retained.png)、[就地NPC](evidence/experience-refinement/05-in-place-mentor.png)、[正确手册节号](evidence/experience-refinement/06-correct-manual-section.png)、[当前手册刷新恢复](evidence/experience-refinement/08-current-manual-restored.png)。早于最后画布尺寸收紧的原生截图保留当时状态；最终布局以regression截图为准。
- 原始导出：[压缩本机档案](evidence/experience-refinement/local-backup.json.gz)、[当前候选ino下载](evidence/experience-refinement/own-candidate.ino)、[正式重演结果](evidence/experience-refinement/replay-result.json)、[SHA清单](evidence/experience-refinement/manifest.json)。只含合成昵称，保留8次结果，含旧失败和版本失效；当前2次与新全文手册一致，收入仍一笔。
- 最终生产交互：[双分支位置](evidence/experience-refinement/regression/branch-position-retained.png)、[同屏实际失败](evidence/experience-refinement/regression/same-screen-real-failure.png)、[场景与林工](evidence/experience-refinement/regression/mentor-scene-desktop.png)、[桌面结算](evidence/experience-refinement/regression/player-receipt-desktop.png)、[手机结算](evidence/experience-refinement/regression/player-receipt-mobile.png)。其中双分支回归是从原鼠标档案截取到读取后的明确测试检查点；不伪称另一名学生或新一次空白验收。

```sh
npm test
npm run build
npm run test:e2e
node scripts/verify-novice-record.mjs --refinement
```

当前165项单测、构建、9项生产浏览器检查及6项存储故障/UI检查通过。9项含8个主入口检查和1个旧原型回归；存储harness的教学策略明确为测试替身。默认不带参数的档案重演命令针对29a9f0f原始历史版本，使用Git内该版手册核对原SHA，不升级旧证据。

## 独立复验入口与未完成项

本机启动候选构建：

```sh
npm run build
npm run preview -- --port 5200 --strictPort
```

打开 http://127.0.0.1:5200/ ，使用隔离浏览器/新昵称从头开始；不要用旧工位存档、`legacy.html`、专项预览或test harness代替。核对改积木时标题是否保留、复核是否说明清楚；实际点暗亮/重复读取，看灯与读数是否帮助定位问题；在需求和变更各观察林工是否真正帮操作；完成后是否能说清客户反馈并找到本人作品和下一步。源码/接线改动后旧通过仍须失效，聊天、动光照表和浏览手册不发通过或收入。

需求仍使用D冻结的6+4确定性情境，NPC仍为脚本与事实投影；是否仍像问卷、是否足以帮助初学者，要由独立复验判断，不以新增头像/面板或绿色测试宣告合格。720px高窗口和复杂长程序可能仍需要滚动/查看完整积木；手机完整复杂搭建、真实学生时长与迁移理解均未验收。真实账号、在线AI、商城/多人榜/教师后台、Word/PDF定稿、全部真实板卡工作仍未完成。

已读UI/NPC/A/D现有对话状态，均为交付后idle；没有另开专项或改他人工作区。本轮只在E整合区修改，B仅增加可选节号解析显示prop，课程通过规则、独立客户断言和收入策略未改；没有新增依赖。未推送、未部署。

## 接口与兼容边界

`facts.practice[phase]`新增`current/validationCurrent/rechecks/needsRecheck`，只供展示，`facts.learning`和`baseReady/codeReady`仍是严格当前证据。`previousPracticeActions`只找先前显式成功的输入，运行复核仍走`workspace.performLearningAction`；映射复核必须选择本人节点。`WiringWorkbench.resolveManualSection`是可选宿主显示/跳转适配，缺省维持原独立模块接口；硬件模型、pin map和校验规则未变。

工程便签通过既有`useWorkspaceDraft`缓冲写入`draft.support.reflection`，兼容读取此前原始学习记录中的便签；不改变作品语义或授予证据。已专门验证保存失败后继续输入、完整便签导出、重试和刷新，当前代码交付与100EC仍有效。没有新依赖、迁移账号或后台服务。
