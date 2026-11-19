# 连续暗亮暗练习：判定语义审计与纯诊断接口

2026-11-12。隔离分支 `work/learning-diagnostics`，基线 `b616c2a469bd90fa6b212cac72015f18613b617d`。独立CU报告为[图形化G0–G3独立体验](图形化G0-G3独立体验_2026-11-12.md)，其固定修复候选为5234 / `dialogue-b162dbaedb5a` / 源码`ceeb1817170db40e0de355d5a76a5d4d3c82b830`。本专项没有访问或改变该候选、CU档案或其浏览器状态。

## 结论

真实A+B+D确定性复现支持CU的观察：`读取→等待100→判断/输出`在100、200、300ms写出亮、灭、亮，当前连续学习观察不发`repeated_current_read_observed`；`读取→判断/输出→等待100`在0、100、200ms写出亮、灭、亮，取得该fact。**两份程序直接评估同一冻结基础客户套件，都为26/26。**

这是两套场景与观察时刻的差别，不是执行器漏执行，也不能据学习失败宣称该程序违反公开200ms响应要求。学习动作每100ms换输入，在99/199/299ms核对当段结果；正式客户在变化后200ms及稳定区间末尾取样。学习动作需要在更短的稳定窗口内看到相应输出，并且其fact又是开放正式测试的必要条件。基线没有在失败说明中指出具体采样点和旧/新读数关系，形成了教学门槛与公开客户要求之间未充分说明的口径差异。

手册推荐等待放在完整判断/输出之后，也明确100ms不是客户强制常数。不能把推荐摆法硬说成唯一合法结构：`读取→等待50→判断/输出`同样取得连续fact并通过26/26。最小处理是把运行前观察口径及运行后事实说明清楚，保持原业务规则；本次已按E授权新增纯诊断模块，未放宽任何条件。

## 复现范围与程序

使用当前正式 `createHardwareContext()`、实际六线接线文档、B的 `context.topologyFor()`成功结果与原A转换/模拟器。没有使用`SYNTHETIC_DEVICE / SYNTHETIC_TOPOLOGY`替代真实适配profile。

复现测试按CU报告的语义构造原生Blockly12序列化（独立审计样本，**不是声称恢复了CU学员的原始ID或档案**）：声明整数light=0，持续区每次从LIGHT赋值，比较`light < 450`，两个分支分别明确写LAMP true/false；只改变等待100位于判断前还是后。实际转换得到IR并运行，节点使用`audit-read / audit-wait / audit-if / audit-on / audit-off`以便追踪。测试没有加载完整样例，也没有写浏览器作品或伪造passed。

```cpp
// A：CU所报的先等待版本
int light = 0;
void loop() {
  light = readAnalog(LIGHT);
  waitMs(100);
  if (light < 450) { writeDigital(LAMP, true); }
  else { writeDigital(LAMP, false); }
}
```

B仅把同一`waitMs(100)`移到完整if/else之后。两者的读取时刻都是0、100、200、300ms，差别是A在等待结束后才处理本轮已保存的light，B读取后立即处理。原引擎规定同毫秒先同步输入，程序随后按事件/step顺序执行；输出保持到下一次明确写入，观察终点是闭区间。

## 每个失败学习采样

基线学习输入固定为0ms→150、100ms→850、200ms→180，运行到300ms。每段要求：该段内存在读取相应值的LIGHT事件，且段末输出状态为亮、灭、亮。

A：`read→wait100→if`，以下三段**都读到了正确的新输入**，失败项均是该观察点的灯态。

| 输入开始/本段值 | 检查时刻 | 截至检查的最近read | 截至检查的最后write | 该write之前最近read | 实际 / 本段期望 | 精确解释 |
|---|---:|---|---|---|---|---|
| 0ms / 150 | 99ms | 0ms读150 | 无 | 无 | 初态灭 / 亮 | 这时等待尚未结束，还没有LAMP write；初态灭不能说成执行过关灯 |
| 100ms / 850 | 199ms | 100ms读850 | 100ms写亮 | 0ms读150 | 亮 / 灭 | 同为100ms时，先用上一轮light写亮，再开始新一轮读850；新读数还没走到写出 |
| 200ms / 180 | 299ms | 200ms读180 | 200ms写灭 | 100ms读850 | 灭 / 亮 | 200ms先完成上一轮亮处判断并关灯，再读180；下一条开灯要到300ms |

实际写出序列为100ms亮、200ms灭、300ms亮。300ms确实有最后一次开灯，但它不能补作299ms的已发生事件。本模块不外推、不把末尾灯亮当三个窗口都符合。

B：`read→if→wait100`：

| 输入开始/本段值 | 检查时刻 | 最近read | 最后write | 实际 / 本段期望 |
|---|---:|---|---|---|
| 0ms / 150 | 99ms | 0ms读150 | 0ms写亮 | 亮 / 亮 |
| 100ms / 850 | 199ms | 100ms读850 | 100ms写灭 | 灭 / 灭 |
| 200ms / 180 | 299ms | 200ms读180 | 200ms写亮 | 亮 / 亮 |

A在单独的读取、暗侧分支和亮侧分支动作仍分别取得原fact：这两项分支观察独立运行到100ms，100ms端点write会被原引擎纳入。连续观察却在99ms就检查第一段，差一毫秒并非同一个检查窗口。

## 正式200ms客户检查的对照

原公开要求1.0.0写明“每次变化后最多200毫秒响应”。冻结客户语义写明变化后200ms及稳定段末取样，不要求固定等待常数。两份100ms程序的正式结果完全相同：

| 冻结客户场景 | A：等待在判断前 | B：等待在判断后 |
|---|---:|---:|
| 全暗与稳定暗处 | 4/4 | 4/4 |
| 全亮与稳定亮处 | 4/4 | 4/4 |
| 449/450/451边界 | 8/8 | 8/8 |
| 暗亮往返与重新读取 | 10/10 | 10/10 |
| 合计 | 26/26 | 26/26 |

A在正式往返场景的实际对应write如下。这些是该固定场景里的观测，不把26条离散断言扩称任意瞬态或真实硬件的全局证明。

| 输入变化 | 值 / 目标 | 第一次相应write | 此段响应间隔 | 冻结200ms检查点 |
|---:|---|---:|---:|---:|
| 0ms | 150 / 亮 | 100ms亮 | 100ms | 200ms |
| 575ms | 850 / 灭 | 700ms灭 | 125ms | 775ms |
| 1135ms | 200 / 亮 | 1300ms亮 | 165ms | 1335ms |
| 1715ms | 900 / 灭 | 1900ms灭 | 185ms | 1915ms |
| 2305ms | 150 / 亮 | 2500ms亮 | 195ms | 2505ms |

为防止把一切失败都解释成“只是教学”，另保留等待150前置的对照：正式客户为23/26，三条真实失败均来自`base-changing`。

| 正式失败检查 | 当前输入开始/值 | 最近read | 最后write | 实际 / 冻结期望 | 后来的目标write / 间隔 |
|---:|---|---|---|---|---|
| 1335ms | 1135ms / 200 | 1200ms读200 | 1200ms写灭 | 灭 / 亮 | 1350ms亮 / 215ms |
| 1915ms | 1715ms / 900 | 1800ms读900 | 1800ms写亮 | 亮 / 灭 | 1950ms灭 / 235ms |
| 2505ms | 2305ms / 150 | 2400ms读150 | 2400ms写灭 | 灭 / 亮 | 2550ms亮 / 245ms |

该150ms程序在第三学习窗可能灯态碰巧为亮，但窗口内没有读到180，仍缺读取观察。新诊断会分开说明“灯态符合”和“是否真的重新读取”，不会把一种事实补成另一种。

## A → E → D 的实际链路

1. `src/program/learning-actions.js:35`构造固定0/100/200ms时间线，`:39`模拟到300ms，`:52`用`frame.atMs+99`取样，`:53`仅在三段read与输出都符合时发`repeated_current_read_observed`。未发fact时`:56`返回笼统“本次运行还没有提供此练习所需的观察”。本专项没有改这些条件。
2. `src/integration/learning-policy-adapter.js:31`先取得真实B拓扑，再调用A；`:35`只把A实际返回的facts按来源转为observations。它不把`ok:true`或灯末态亮转换成学习通过。
3. `src/integration/local-workspace.js:236`保存本次原request/result；只记录实际observations，绑定学员、尝试、需求、接线和积木版本。
4. `content/learning-progress.js:118`规定`repeat-read`与前面的真实步骤均为observed才能`readyForBaseTests`。`local-workspace.js:269`实际阻止缺该fact的作品运行正式测试，抛`BASE_PRACTICE_NOT_READY`。因此A这份程序即使直接调用底层客测可26/26，在正常工位仍不能绕过教学门槛。
5. 正式客测使用`src/integration/course-adapter.js`与`content/customer-tests.js`，按`content/auto-lamp/customer-tests.json`冻结字面量运行/比较；不会从学习99ms结果生成客户200ms预期。

独立测试通过真实memory-controller完整调用需求回答、有效接线、输出/读取/暗亮/连续动作验证：A当前停在repeat-read且正式测试按钮门槛关闭，没有生成客户证据或收入；改为B并重新取得当前版本实际观察才开放并产生真实26/26。测试存储为明确合成隔离适配，未触碰CU或用户档案。只读底层客测审计不等于为A放行。

## 手册与提示核对

- `docs/manual/首单手册.md:52`公开200ms；`:142`明确100ms是教程观察选择，不是客户固定常数；`:163`读取起步先接读取与等待100；`:180`推荐以后把等待接在完整if下方。
- 同手册`:207`明确局部观察不是连续拖动响应测试，200ms必须靠客户测试。`:210`说明四项实际观察齐备后才开放客户测试。
- `docs/manual/工程参考.md:175`用575→600ms说明读取时机，`:296`说明同毫秒输入先变、输出保持和200ms/稳定末尾采样。
- `src/integration/ProgramPractice.jsx:15`提示“观察三个100毫秒窗口”，但没有列99/199/299或本次每个失败行。原分支提示和手册确有推荐顺序，不能因此省略具体的运行后诊断。

准确表述应为：**本次未在学习窗口末尾取得对应观察**，而非“违反客户响应200ms”。若未来希望统一两套时间语义，必须另行审查场景稳定长度、采样时刻与教学fact要求；不能只把99改200，因为200ms已切换到第三个输入，不能拿新场景状态判旧场景。此次不作任何规则变化。

## 已实现的纯诊断接口

新增`src/program/learning-diagnostics.js`，由`src/program/index.js`增量导出。E负责在ProgramPractice/导师UI展示，模块不读写controller、fact、ready、收入或存档，也不执行程序。

`getProgramPracticeCriterion(actionId='repeat-read')`：其它action返回null；返回深冻结的只读描述：

```js
{
  id: 'repeat-read-windows/1', actionId, title, description,
  windows: [{fromMs, toMs, checkedAtMs, input, expectedLamp}],
  customerCheck: {responseWithinMs: 200, independent: true, evaluated: false, message},
}
```

E应在运行前展示“每个观察窗口末尾核对灯态”及0–99/100–199/200–299、检查点99/199/299，不能仅在失败后才告知更紧的窗口。

`explainProgramPracticeResult(action)`接真实`learningAction {request,result}`。非repeat或没有实际轨迹时返回null；返回：

```js
{
  kind: 'program-practice-diagnostics', actionId, status: 'available'|'unavailable',
  criterion, simulationStatus,
  windows: [{
    fromMs, toMs, checkedAtMs, input, expectedLamp, covered,
    lastRead, matchingRead, lastWrite, lastReadBeforeWrite,
    actualLamp, actualOutputSource: 'initial'|'write'|'unknown',
    readObserved, outputMatches, reasons, explanation,
  }],
  summary, nextAction, customerCheck, diagnostics,
}
```

事件摘要保留`eventIndex / atMs / step / kind / nodeId / port / value`。`lastReadBeforeWrite`严格取原events数组中该write之前的read；不排序、不按时间<=粗配。因此write100关联的是read0，后来的read100单列为检查点最近读取。这个字段只提供时间前序事实，不冒充任意程序的数据依赖证明；本审计已知light赋值/if程序可结合实际源码解释旧样本。

不支持的旧时间线、同刻顺序损坏、缺少原始状态/事件完整性会返回`status:'unavailable'`与空windows，不套新窗口推断。真实执行未覆盖到检查点时，`covered:false`、actualLamp/outputMatches为null，不外推停止后的结果。初态灭显示`actualOutputSource:'initial'`、lastWrite=null，不伪装执行关灯。原结果和错误对象不被改写或冻结。

诊断不返回passed、ready、facts或observations，也不授予/撤销原fact。`outputMatches`仅是这一行实际状态与原观察期望的比较。自然下一步只解释读到了但对应写出晚一拍，建议缩短从读到判断/写出的间隔并重跑，不规定等待必须后置，不自动给完整答案。`customerCheck`明确这次未评估正式200ms结论。

## 验证与范围

```sh
node --test tests/diagnostics/continuous-practice-audit.test.js \
  tests/integration/learning-policy-adapter.test.js \
  tests/integration/observation-model.test.js
```

12项通过：10项新审计/诊断回归加2项既有真实A+B+D观察/恢复回归。覆盖两顺序26/26与学习差异、同毫秒事件前后、wait50反例、wait150真正客户超时、只读criterion、无通过权威、旧轨迹不匹配、真实预算失败不外推、原始结果不变、真实D门槛与当前版本复核。`git diff --check`通过。

允许改动仅新诊断模块、index一行导出、新审计测试和本文。没有修改`learning-actions`条件、客户测试、content、ProgramPractice、QuestApp、ProgramBlocks、story、手册、package或锁文件；未启动服务、覆盖候选、部署或推送。E仍需把运行前criterion和运行后诊断接到学生界面并做实际浏览器验收；本专项不声称完成UI或新G4课程。
