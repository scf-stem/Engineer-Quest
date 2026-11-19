# A 线验证与集成交接

后续编程教学返工的实际操作证据与最新边界见 [teaching-walkthrough.md](teaching-walkthrough.md)，E/D 接口见 [teaching-interface.md](teaching-interface.md)。下表是首版基线验证，不作为本次游戏可玩性或教学质量结论。

2026-11-11，本机 macOS arm64；Node `v25.5.0`，Apple clang `17.0.0`，项目锁定依赖（本次实际 Vite `7.3.8`）。基线 `eb0f63f5aaef73ef92a433ba5a4a61189ccaae83`；工作区 `.worktrees/program` / 分支 `work/program`。未新增依赖、未更改锁文件；受支持 Node LTS 的项目基线由 E 统一处理。

## 实际结果

| 验证 | 命令 / 证据 | 结果 |
| --- | --- | --- |
| 模块与代码一致性 | `node --test tests/program/*.test.js` | 16 项通过，无跳过。15 项语言/Blockly/时序/独立测试，1 项含 8 组本机编译运行对照 |
| 旧演示单测 | `npm test` | 原有 10 项通过；旧模板与旧测试没有在 A 线被修改 |
| 合成命令行演示 | `node src/program/demo.js` | passed:true；5 条固定断言通过；4 次读取发生在 0/100/200/300ms，输入分别为 150/850/449/450 |
| 浏览器独立纵切 | 下方 Chrome 命令 | 1 项通过；真实 Blockly、文本修改、独立测试拒错、快照保留、源码预览失效、预算中断、轨迹滑块与 900px 宽度布局均覆盖；无 pageerror |
| 原入口生产构建 | `npm run build` | 通过；约 995.81kB minified JS，有 >500kB 体积提示 |
| 独立实验台生产构建 | 下方 `build` 命令 | 通过；约 789.46kB minified JS / 207.79kB gzip，有 Blockly 包体积提示 |
| JSON Schema 文件 | `JSON.parse` 与语义回归 | JSON 文件语法可读；语义由 validateProgram 回归覆盖，尚未引入独立 JSON Schema 执行器 |
| 页面视觉检查 | [lab-preview.png](lab-preview.png) | 已实际打开截图检查；修复浅底 Blockly 工具栏文字对比度，并加入 CSS 断言 |

```sh
PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npx playwright test --config tests/program/playwright.config.js

node --input-type=module -e "import {build} from 'vite'; await build({build:{outDir:'/tmp/engineer-quest-program-build',rollupOptions:{input:'src/program/demo.html'}}});"
```

此机器未下载 Playwright 自带 Chromium，使用已安装的 Google Chrome。浏览器测试临时启动 127.0.0.1:5186，退出时自动停止。首次受限沙箱监听返回 EPERM，获本地验证权限后成功；没有仍待处理的操作拒绝。

## 有效覆盖

- 全局变量与常量、启动与持续循环、嵌套判断/while、多个逻辑输入、算术/比较/逻辑优先级与短路。
- 输入按读取时间采样、部分帧保持、等待期间输出保持、精确端点动作、确定性重放。
- 负等待、除零、正负整数边界与溢出、负零归一化、无限循环/空循环/零等待预算中断。
- 正式 lexer/parser 拒绝未知字符/函数/库/前导零/非白名单语法，拒绝类型隐式转换、写常量和未知变量。
- Blockly 12 headless 实例实际载入/保存/编辑；坏积木、空值、停用、额外分支、孤立积木与循环链拒绝。
- 设备版本、重复物理引脚、端口方向、输入类型/范围/时间顺序、客户测试引用与覆盖范围拒绝。
- 固定预期拒绝阈值 400、错误输出与等待 250ms；旧模板按显式端口映射单向迁移并保留原件。
- 生成完整源码逐次读写与解释器对照：自动灯、状态循环、布尔短路、负数整除/取余、左侧错误先于右侧读入、溢出、取负边界、负等待。

## E 接入清单

1. 从 `src/program/index.js` 导入；实际调用与返回样例、类型、pin map、时间和预算见 [README.md](README.md) 与 `src/program/index.d.ts`。不替换旧模板 AST 的 version 字段，使用明确迁移函数。
2. B 提供已校验接线拓扑，E/B 把设备模型适配成 `{deviceProfile,deviceProfileRef,wiringRef}`，其中 `deviceProfile.pinMap` 是具方向/类型/范围/物理脚/初值的逻辑端口表。不要从任意未经验证的学生对象直接构造“已通过接线”。
3. D 的独立客户 fixture 直接传 `runCustomerTests`。每场景重置全局状态，期望不依赖学生阈值。当前仅支持数字布尔输出断言。
4. `Result.ok` 只表明调用输入合法。运行时状态在 `value.status`，正式软件结论以每场景 completed + 固定断言全部通过为准。runCustomerTests 已统一聚合该规则。
5. E 重新计算程序、接线、需求、测试集与设备摘要，并校验实际内容。候选 fixture refs 与语言 ref 的 digest 只是开发标记；公共契约改为 SHA-256 时需同时更新语言 ref。前端传入 programRef 不能作为可信摘要。
6. 公共测试命令加上 `tests/program/*.test.js`；实验台单独配置在 `tests/program/playwright.config.js`。当前 `npm test` 仍只匹配旧根目录测试。完整 UI 集成、Blockly 分包和正式课程引用由 E 统一落公共入口。

## 尚未完成的验证与明确边界

没有 Arduino CLI/core、明确 FQBN 与实物板卡，本次没有 Arduino 目标机编译、上传或实物验证。本机 C++ stub 编译不能替代它们。完整代码生成结果一直返回 `compileStatus:'not_run'`；板卡代际与校准值不自动填 R3/450。

没有新增在线 AI、真实个人身份、学生数据、后台签发、奖励、烧录、远端推送或部署。当前代码仅写 A 线独占目录；旧演示仍走旧模板引擎，需 E 集成新执行链后才能改变主站行为。没有业务或权限阻塞；后续依赖为 B/D/E 契约适配与硬件验证。
