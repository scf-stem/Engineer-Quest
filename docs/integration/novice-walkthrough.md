# 开发者按零基础路径的独立操作记录

> 最新状态：第二次独立试玩仍判退，持续角色交流返工见[新候选与证据](ongoing-dialogue.md)。本页为历史阶段记录，不能作为最新体验合格结论。

这是29a9f0f当轮的历史记录。最新独立试玩仍否定体验质量；修正及当前手册版本证据见[体验修正候选](experience-refinement.md)。

2026-11-11，主目录 integration，主入口 `http://127.0.0.1:5190/`。E 使用单独合成昵称“整合独立审查”，以真实鼠标/键盘操作界面。没有导入完整程序、调用隐藏Blockly修改接口、填充权威状态或使用主线完整示例。实际操作的开始/存档时间为15:47～16:21 UTC，期间包含开发修复与工具交互，不能用这34分钟推断学生用时。

这是一名开发者按零基础路径的内部独立检查，并非真实高中生试教，也没有第二位独立审查者完成全程。本轮不邀请用户作课堂交付验收。

## 当次路径与观察

| 步骤 | 实际动作和结果 | 当次证据 |
| --- | --- | --- |
| 1 个人入职与订单 | 本机昵称领证，查看林工脚本教程，跳过说明只回任务；领取一张自动灯委托 | [导师](evidence/novice-walkthrough/01-mentor.png) |
| 2 基础情境 | 第一题选日期得到具体观察；选正确输入但写“我完全不懂，随便选的。”仍留在求助；原话清空后可局部重试。等于450误选亮得到严格小于反馈；未完六题点接线仍回评审 | [错误](evidence/novice-walkthrough/02-requirement-wrong.png)、[六题完成](evidence/novice-walkthrough/03-requirements-ready.png) |
| 3 恢复和接线 | 六题后真实刷新，仍是同一身份/订单。手动选择六对端子，0线为中性待连接，六线规则通过后才进入积木 | [六线](evidence/novice-walkthrough/04-six-wires.png) |
| 4 查实际手册 | 打开工程参考§07.1，跨册查看首单原创图；发现模态标题被锚点滚动推走、书册按钮缩小，修复后实看全图和关闭按钮 | [全文](evidence/novice-walkthrough/05-full-manual.png)、[原创SVG](evidence/novice-walkthrough/06-manual-diagram.png) |
| 5 从空白搭最小读取 | 引导点灯只运行隔离输出，积木仍空白。亲手拖入入口、light整数初值0、loop赋值readAnalog(LIGHT)。缺等待时实际STEP_BUDGET且不发读取证据；提示修复后拖入wait100，真实读取前进 | [搭建中/查看完整积木](evidence/novice-walkthrough/07-partial-blocks-fit.png)、压缩档案内失败及后续动作 |
| 6 逐步完成基础 | 在同一作品读取后插入if/else、变量light < 数字450、两路LAMP true/false；曾有浮动未接入积木，继续用鼠标改正。逻辑改变后先复核当前读取，再做暗150、亮850、一次暗→亮→暗真实观察。固定基础4场景26/26 | [实际完整积木/修复前交接提示](evidence/novice-walkthrough/08-base-tests.png)、档案实际报告 |
| 7 本人代码映射 | 保存这份基础积木生成短代码；完成4个变更情境，点本人“运算 <”节点显示`(light < 450)`。查看其它节点本身不记该事实 | 原始档案中的preserve-snapshot/code-mapping及当前绑定 |
| 8 失败与修复 | 保留450运行新版，实际12/20，输入500期望亮而实际灭；只修改自己比较中的450→600，重新检查、复测，3场景20/20 | [旧450代码与失败反馈](evidence/novice-walkthrough/09-change-failed.png)、[重放结果](evidence/novice-walkthrough/replay-result.json) |
| 9 导出和收入 | 点击导出当前候选ino，明确未编译/未烧录。点击合成收入100EC，重复请求仍一笔，刷新仍100EC且3次测试/当前600源码/学习证据恢复 | [真实下载](evidence/novice-walkthrough/own-candidate.ino)、[收入刷新](evidence/novice-walkthrough/10-income-restored.png) |
| 10 重开/继续 | 本地工位导出档案、保留历史重开，回领取订单且收入100EC不变；选择订单尝试1继续，当前600及新版通过恢复。林工读取本机收入事实 | [恢复后的导师](evidence/novice-walkthrough/11-mentor-restored.png)、[工位成果](evidence/novice-walkthrough/12-station-complete.png) |

截图08保留了当时发现的“尚未开始变更评审却显示stale”缺陷，不冒充最终画面；现已改成“基础版已完成”，最终主入口恢复回归实际断言此文案。截图09主要记录旧代码与失败反馈栏，12/20断言表以压缩原始档案、重放结果和最终回归截图复核。截图11的“本次会话”已在最终整合校正为“本机订单已有合成软件收入”。

完成闭环后才主动打开完整参考附录，逐个点击下载两份CPP；参考实现没有用于这次空白搭建。随后手机自动回归也验证下载内容、SVG正常加载及手册关闭后保留当前原话。

## 可复核的原始结果

[压缩原始UI导出档案](evidence/novice-walkthrough/local-backup.json.gz)只含这次合成身份。解压内容格式为`eq.ui-local-backup/1`，包括原始回答、每笔学习输入/实际结果、六线、本人Blockly、确切源码、3次报告、快照和一笔账本。原JSON SHA256为`b50c4518019c4ce58312b070fe3ace0b348443daa4a53e7b84ceff6b8650d769`；压缩只是减少提交体积，不改变原数据。此文件供开发复核，产品目前没有导入备份按钮。

```sh
node scripts/verify-novice-record.mjs
```

该命令按生产策略重演原始回答、A实际操作、D进度及客户执行。手册已更新时，从Git的29a9f0f取原手册核对其SHA并明确输出历史结果，不将旧证据升级；当前手册的实际复测档案使用`--refinement`。已经验证9行检查（基础/变更评审+7项活动）全部当前、3份结果为通过/失败/通过、下载ino与最后确切程序展开相同、重复入账仍100EC。[结果](evidence/novice-walkthrough/replay-result.json)与[全部文件SHA清单](evidence/novice-walkthrough/manifest.json)可对照。

主入口`restored-novice.spec.js`在一次性浏览器中明确载入这份实际档案，然后由正式控制器重核；它是恢复回归，不是声称又有一名学生完成。它核对基础交接、只读积木不失效、失败历史仍可看、当前600及导出有效、重复收入和再次刷新。新身份的实际情境与六线/空白入口另有默认浏览器回归。

## 仍需审查的体验

- 没有真实学生试教、时长/疲劳/理解迁移的观察。固定情境和动作证据只证明具体行为，不证明掌握职业能力或理解任意中文。
- Blockly长程序仍需要拖画布或“查看完整积木”；插槽需要准确靠近凹口。1265/1280px桌面已实际操作；手机复杂完整搭建未做独立通关，仍应优先在电脑试教。
- 编辑后复核受影响的读取/分支记录有额外操作负担；当前有版本解释，尚需真实试教确认提示是否足够。
- 来源页的仓库源码与历史审查链接未做完整应用内浏览；六册正文、跨册节号、SVG、CPP下载已核实。
- 第二位独立整体验收尚缺：自动审批拒绝向D既有专项发复审消息，未发送、不绕过。没有将E操作或专项规则回放写成第二人审查。
- Word/PDF、在线AI、真实账号/云同步、商城/多人榜/教师后台与全部真实板卡工作均未完成。没有推送或部署。

最终生产构建目视与回归：[当前本人积木](evidence/final-main/actual-own-blocks-restored.png)、[保留的12/20失败](evidence/final-main/actual-failure-retained.png)、[手机全文手册](evidence/final-main/mobile-full-manual.png)、[真实空白入口](evidence/final-main/real-blank-program.png)、[最终验证范围](evidence/final-main/verification.json)。手机目录挤叠问题是在绿色测试后的截图目检中发现，修复后加入书册区/章节区不重叠的几何断言，再跑生产6项并目检。
