# G1–G3 局部 Blockly 编辑器

Original prompt: 为获准的 G0–G3 首段教学实现真实局部 Blockly 编辑器；不修改总入口、通用 ProgramBlocks、依赖、课程或运行器；由 E 提供初态与运行适配。

2026-11-12，`work/graphic-editor`，基线 `c205961`。使用 `home-git-safety`、`develop-web-game` 技能。已读取首段逐屏脚本、V0.2 修订记录以及 G1/G2/G3 操作画面。

## 接入

```jsx
<TeachingEditor
  kind="output" // output | sequence | reading
  value={savedBlockly12State}
  onChange={(next, {origin, diagnostic, focusTarget}) => {}}
  deviceProfile={executionProfile}
  disabled={false} readOnly={false} independent={false}
  focusNodeId={actualExecutingBlockId}
  focusTarget={savedTarget} // 可选；undefined 保留内部目标，null 清除
  onFocusTarget={target => {}}
  onInteraction={details => {}}
/>
```

`onChange` 仅报告真实局部编辑与撤销，`origin` 为 `edit` / `undo`。初次载入、外部恢复和属性显示变化不报告学生编辑。父组件应及时回传 `next`；同一序列化回传不重建工作区，不清拖拽或撤销历史。不同的外部值以恢复处理；正在拖动时延后至放下再载入。暂停/返回需保留此组件挂载，或回传保存的序列化。

`focusTarget` / `onFocusTarget` 的值位为 `{blockId,inputName}`，语句口为 `{blockId,connection:'next'|'previous'}`。诊断为 `{code,message,blockId,inputName?,connection?}`。`focusNodeId` 对真实 Blockly ID 加 `data-teaching-executing` 与青色描边；目标口用单个黄色空心轮廓和块上的 `data-teaching-focus`，不覆盖块字与拖放事件。独立模式默认无目标轮廓，主动点选帮助后可定位。父舞台负责整体明暗与教学停点。

`onInteraction` 提供 `type`、`diagnostic`、`focusTarget`，以及相关 `blockId` / `source`。类型包括 `drag-start`、`drop-connected`、`drop-unconnected`、`select`、`select-source`、`select-target`、`invalid-target`、`placement-confirmed`、`undo`、`load-error`，让 E 在实际未连接或错位时立即更新提示。

编辑器不创建学生初态，不执行，不判断完成，不显示程序入口、变量配置、示例答案按钮或运行按钮。`eqt_sample` 仅是本地 `观察读数 %1` Number 值位锚；完整观察架由运行适配构造。需传入项目合法 `deviceProfile`，沿用 `eqp_*` 注册；已有注册不重写。

工具托盘一列，仅开放本次的小练习：output 为 true/false；sequence 为等待和 600 数字；reading 为 LIGHT 模拟读取。布尔值在真实字段中显示 `true · 开` / `false · 关`，能打开字段菜单修改。拖到空处会留下积木。已占用值位先保留原块，经过预览/取消/确认才能替换；旧值保留为散落块，能撤销。分步操作逐个选择积木与目标、预览再确认；不提供整题自动完成。语句插入保留后句，也能选择已有语句重排。

组件高度由父容器给定；已按 560×300 与 500×330 作为核心尺寸核对，包含已接好值块的输出与读取。分步预览替代选择行，避免重复堆叠。字体基准 16px，工作区按宽度缩放；500px 宽的 reading 约 0.76 倍。工作区带滚动，载入及连接后越界时只调整视口，把当前局部语句带到托盘右侧，不改序列化坐标。

## 隔离验证

本机服务：`npx vite --config tests/program-teaching/editor.vite.js`，仅监听 `127.0.0.1:5198`。

测试页：`/tests/program-teaching/editor.harness.html`，仅合成测试身份，不接应用存储或执行器。回归：`node tests/program-teaching/editor.browser.mjs`。可用 `PLAYWRIGHT_EXECUTABLE_PATH`、`EDITOR_TEST_URL`、`EDITOR_EVIDENCE_DIR` 覆盖本机默认值。

使用技能原客户端完成截图/状态回合；本机技能脚本无法解析项目 Playwright、默认浏览器版本未安装、Blockly 隐藏文字测量 canvas 宽高为零，因此仅在 `/tmp` 副本中调整了这三项环境适配，没有修改技能源文件或项目依赖。

测试涵盖真实鼠标 flyout 吸附、空处保留、撤销同步、真实布尔字段修改、占值替换预览/取消/确认、旧块保留、等待插入后句保留、已有语句重排、外部恢复不新增学生编辑、精确 focusTarget 与执行 ID、读取锚、独立模式、键盘选择/预览/确认、禁用态，以及两种视口和父容器核心尺寸。截图与结果位于 `/tmp/eq-teaching-editor/`，技能客户端截图/状态在 `/tmp/eq-editor-client-final/`。

最终回归 40 项通过，浏览器控制台与页面错误均为 0。已实际打开并目检空输出、真实连接、替换预览、等待插入/重排，以及 560×300 / 500×330 已连接读取与顺序画面；托盘、目标口、块字与反馈均可见。`git diff --cached --check` 通过。

此专项仅验证局部编辑器。完整教学舞台、执行适配、长期存档、正式入口与学生理解验收由 E 整合验证；本模块不产生这些事实。
