# A 线：可组合程序与确定性执行候选 0.1

2026-11-11 编程教学返工：新增结构化下一步、逐节点积木—代码映射、小步预测/调试/迁移证据和 E/D 动作事实接口。当前接入说明见 [teaching-interface.md](teaching-interface.md)，从空白实际操作与限制见 [teaching-walkthrough.md](teaching-walkthrough.md)。以下 IR/语言 0.1 的运行语义保持；实验台现在从第一项输出练习开始，完整参考会持续记录协助。

2026-11-11。工作区 `.worktrees/program`，分支 `work/program`，基线 `eb0f63f`。本目录按《开发计划》V1.1 与《自动灯接口与五线协作》实现候选接口；E 冻结公共契约后通过适配器集成。没有修改旧 `engine.js`、`blocks.js`、`main.jsx`、公共配置或依赖清单。

## 运行与集成入口

```sh
npm ci --ignore-scripts
node src/program/demo.js
node --test tests/program/*.test.js
npx playwright test --config tests/program/playwright.config.js
npm run dev -- --port 5186 --strictPort
```

浏览器打开 `http://127.0.0.1:5186/src/program/demo.html`。页面从空白 Blockly 工作区开始，可以拖入程序入口，或明确点击「加载合成示例」。具备逐步状态、固定客户断言、错误节点定位、源码预览与旧积木快照查看。所有样例是合成数据，不是正式课程需求或物理电路。页面的源码预览标明目标编译尚未执行。

主入口 `src/program/index.js`；类型声明 `index.d.ts`；结构候选 `program.schema.json`。引擎和解析器无新依赖；实验台与测试使用项目已有 Blockly、Vite、Playwright。Blockly 采用参数注入，导入主入口不会注册积木、操作 DOM 或修改旧演示。无需新增依赖。

## 简写 C++ 语法

```cpp
const int threshold = 450;
int light = 0;
bool manual = false;
void setup() {
  writeDigital(LAMP, false);
}
void loop() {
  light = readAnalog(LIGHT);
  manual = readDigital(BUTTON);
  if (manual || light < threshold) {
    writeDigital(LAMP, true);
  } else {
    writeDigital(LAMP, false);
  }
  waitMs(100);
}
```

这是固定教学函数与受限 C++ 控制结构。函数由版本化运行库实现，生成器展开出真实 Arduino C++；不经模型翻译，不使用专用汇编。`setup` 可省略；全局声明、带花括号的 `loop` 必须遵循下列白名单。

| 能力 | 0.1 语义 |
| --- | --- |
| 变量 | 全局 `int` / `bool`，必须用字面量初始化；`const` 可选。变量跨主循环保留，不能与逻辑端口同名。暂不支持局部声明与作用域遮蔽 |
| 输入 | `readAnalog(PORT)` 返回整数；`readDigital(PORT)` 返回布尔值 |
| 输出 | `writeDigital(PORT, bool)`；`true/false` 和 `HIGH/LOW` 均可作为布尔字面量 |
| 分支 | `if (...) {...} else {...}`，可嵌套或写 `else if` |
| 循环 | 隐式持续 `loop()`；可组合 `while (bool) {...}`，支持嵌套 |
| 时间 | `waitMs(int)`，单次 0…32767ms；负数为错误 |
| 表达式 | `+ - * / %`、一元 `- !`、`< <= > >= == !=`、`&& ||` 与括号；优先级按 C++，同级左结合 |
| 整数 | 固定 −32768…32767，与目标板默认 `int` 宽度解耦；生成源码使用 `int16_t`。除法向零截断，余数与 C++ 一致 |
| 类型 | 不隐式转换布尔与整数；布尔条件不能写 `if (1)` |
| 注释 | 支持 `//` 与 `/* ... */`；位置使用 JavaScript UTF-16 半开区间 |

不接受 `#include`、用户函数、库、指针、数组、动态内存、递归、系统调用、`for`、`++/--`、本地变量声明和裸数字引脚。当前固定教学函数不是任意 C++ 解析器。整数溢出、除零与动态负等待在解释器中报错；生成的运行库在相同错误处保持输出并停止正常程序，直到复位。

典型错误：`bool lamp = 1;` → `TYPE_MISMATCH`；`const int x=1; ... x=2;` → `CONSTANT_WRITE`；`int x=32768;` → `INTEGER_RANGE`；漏掉积木值 → `BLOCK_INPUT`；设备未声明的逻辑端口 → `PORT_MAPPING`。诊断含稳定 `code`、中文 `message`，可带 `nodeId` 与 `sourceRange`。

## IR 与积木

`ProgramIR` 包含 `schemaVersion:'eq-program/0.1'`、`languageProfileRef`、全局变量、启动语句和主循环语句。表达式为 `literal/variable/read/unary/binary`；语句为 `assign/write/wait/if/while`。每个表达式、声明与语句有唯一 ID。文本 ID 从位置生成；积木直接保留 Blockly block ID。运行时校验节点唯一性、类型、名称、只读常量、方向、端口、范围、结构循环引用与资源上限；JSON Schema 负责结构，不能替代语义校验。

```js
import {
  parseShortCpp, blocksToProgram, workspaceToProgram,
  registerProgramBlocks, generateShortCpp, validateProgram,
} from './src/program/index.js';

const parsed = parseShortCpp('void loop() { writeDigital(LAMP, true); waitMs(100); }');
// {ok:true, value:{schemaVersion:'eq-program/0.1', ...}, diagnostics:[]}
const invalid = parseShortCpp('void loop() { waitMs(-1); }');
// {ok:false, diagnostics:[{code:'WAIT_RANGE',severity:'error',message:...,nodeId:...,sourceRange:...}]}
const checked = validateProgram(parsed.value, deviceProfile);
// {ok:true,value:{program,deviceProfileRef,portsUsed:{LAMP:'output:digital'},nodeCount},diagnostics:[]}

registerProgramBlocks(Blockly, deviceProfile); // 每个 Blockly 实例注册一次
const fromSavedState = blocksToProgram(Blockly.serialization.workspaces.save(workspace));
const fromWorkspace = workspaceToProgram(workspace, Blockly); // 等价适配
const editable = generateShortCpp(fromWorkspace.value); // {source,map}
```

`parseShortCpp` / `blocksToProgram` 的第二参数为 `LANGUAGE_PROFILE`，默认是候选 0.1。只接受这一确切版本。`validateProgram` 可以先不传设备做语言检查；实际运行与生成完整源码必须给出设备与接线版本。

Blockly 序列化入口是**一个** `eqp_program`，含 `VARIABLES/SETUP/LOOP` 语句槽。变量区使用 `eqp_declare`（`NAME/TYPE/CONSTANT` 字段和 `INITIAL` 值槽）。标准积木支持 `math_number`、`logic_boolean`、`variables_get/set`、`math_arithmetic`、`logic_compare/operation/negate`、单分支 `controls_if` 和 WHILE 模式的 `controls_whileUntil`。标准变量模型通过序列化的 `variables[{id,name}]` 解析名称。

自定义积木支持 `eqp_get/set`（`NAME`）、`eqp_read_analog/digital`（`PORT`）、`eqp_write`（`PORT` 与 `VALUE`）、`eqp_wait`（`MS`）与 `eqp_while`（`CONDITION/BODY`）。实验台优先使用具名自定义变量积木，避免要求学生额外创建 Blockly 变量模型。不支持的标准积木、散落积木、额外 IF1 分支、停用积木、空值和循环链均明确拒绝。否则如果可用嵌套 `controls_if` 组合；此版本不静默丢弃分支。

`generateShortCpp` 返回可编辑的教学代码；`generateArduino` 返回包含固定运行库的完整 `.ino`。后者包含受限编辑区之外的实现，不作为轻代码重新解析输入。两种生成映射均给出 `nodeId` 与目标源码 `sourceRange`，Arduino 映射还保留原文本 `inputSourceRange`。短代码映射现在覆盖每个声明、语句和表达式的精确区间，分支/循环语句区间包含其正文，新增 `sections.setup/loop`。完整生成器把每个运算数展开为临时变量，保证输入读取和错误的先后顺序；布尔逻辑保持短路。

进入文本模式前，由集成层保存积木快照。实验台提供**查看**旧快照，保留新代码；没有自动把任意文本转回积木。`migrateLegacyProgram(legacy,{inputPort:'LIGHT',outputPort:'LAMP'})` 单向迁移旧四字段模板，返回 `{program,migration:{from,to,direction:'one-way',original}}`。原文不变，旧 `UNO.A0` 等物理命名不会自动变成新端口。

## pin map 与 B/E 适配边界

```js
const deviceProfile = {
  ref: {id:'synthetic-uno',version:'0.1',digest:'synthetic-device-0.1'},
  family:'arduino-uno', variant:null, fqbn:null, calibrationStatus:'synthetic',
  pinMap: {
    LIGHT:{pin:'A0',direction:'input',signalType:'analog',min:0,max:1023,initialValue:0},
    BUTTON:{pin:2,direction:'input',signalType:'digital',initialValue:false},
    LAMP:{pin:9,direction:'output',signalType:'digital',initialValue:false},
  },
};
const topology = {
  deviceProfile, deviceProfileRef:deviceProfile.ref,
  wiringRef:{id:'synthetic-wiring',version:'0.1',digest:'synthetic-wiring-0.1'},
};
```

逻辑端口为合法标识符；数字物理引脚采用整数 0…13，模拟引脚采用 `'A0'…'A5'`。每个物理引脚最多绑定一次。analog 仅支持输入，范围是 0…1023 内的明确整数子区间；digital 使用 boolean。所有端口须有显式 `initialValue`，没有输入帧时使用它，不把缺失输入猜成任意读数。数字输入固定 INPUT，无隐含上拉；数字输出预装初始电平再设 OUTPUT。

这个 pinMap 是 A 的消费契约候选，B 的端子模型若采用其他字段，E/B 需显式适配；A 不解析元件电路、不证明电阻/极性安全，也不将构造该对象当作真实接线已通过。`topology` 必须由 B 的接线验证结果加上确切 wiringRef 组装。引用匹配只是逻辑一致性检查，不能防止不可信调用方伪造对象。

首版限制使用 Uno 共有的逻辑引脚与 10 位虚拟输入，**未冻结 Uno 代际、FQBN、采购批次或校准值**。样例里的 A0/D9、450 与低值表示暗都仅作 synthetic fixture。`variant/fqbn` 原样交还工具链要求，不自动填 R3。`generateArduino(...).value.toolchainRequirements` 含 `cppStandard:'c++11'`、`libraries:[]`、`runtimeVersion:'eq-runtime/0.1'`、`compileStatus:'not_run'` 与待验证目标标志。

运行库的 API 依据 Arduino 官方 [digitalWrite](https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalwrite/)、[delay](https://docs.arduino.cc/language-reference/en/functions/time/delay) 和 [Arduino API](https://docs.arduino.cc/learn/programming/reference)（2026-11-11 查阅）；虚拟时间不计这些 API 的真实调用开销。

## 时间、状态与预算

```js
const simulated = simulate(program, topology,
  [{atMs:0,signals:{LIGHT:150}}, {atMs:40,signals:{LIGHT:850}}],
  {maxSteps:1000,maxTimeMs:300});
// 外层 ok 表示输入合法。运行结果还必须检查 value.status。
// value:{status:'completed'|'budget_exceeded'|'runtime_error',
//   completedThroughMs,steps,events,diagnostics,limits,inputTimeline,deviceProfileRef,wiringRef}
```

- 时间以整数毫秒从 0 开始；观察窗口是闭区间 `[0,maxTimeMs]`。端点的零耗时语句全部执行，直到下一次等待将越过窗口。正常结束为 `completed`，不把持续主循环的观察窗口结束标为程序终止。
- 输入帧须严格递增；同一时刻多个信号写在同一帧。帧是**部分更新**，其余输入保持。帧先于同毫秒的读取生效；`read` 在表达式实际执行时采样，`&&/||` 未执行的一侧不会采样。
- 普通计算按顺序执行、虚拟耗时为 0。`waitMs(N)` 阻塞本程序，输入可在这期间变化，变量和输出保持，恢复时才继续读取。相同时刻最终一个写入是客户在该时刻看到的状态。这是确定性逻辑模型，不模拟 CPU 指令耗时、电压电流、噪声和 ADC 采样转换时长。
- 等待跨出窗口时记录原 `resumeAtMs`，停在窗口端点，不执行窗口外语句。`maxTimeMs=0` 可观察启动时与首轮零耗时动作；空主循环/零等待循环仍需步数预算停止。
- 每次表达式求值、语句调度、主循环入口和 while 条件调度计步。`initial/resume/stop` 等观察事件可共享 step，UI 应按事件数组顺序播放，不能把 step 当唯一事件 ID。
- 最多 1000 个程序节点、嵌套 32 层、64 个变量、24000 字符/5000 token。单次执行最多 100000 步、60000ms，时间线最多 10000 帧。客户套件最多 100 场景、每场景 1000 条断言，总步数预算最多 100000。运行不使用真实等待、网络、随机数或 `eval`。
- 步数耗尽为 `budget_exceeded`，动态运算/等待错误为 `runtime_error`；内层诊断定位相关节点。未知端口、结构错误、非法输入范围和预算参数在外层返回 `ok:false`。生成源码的运行库保护算术/等待错误，**不带解释器的执行步数沙箱**；不能把软件步数限制声称为硬件看门狗。

事件统一含 `{atMs,step,kind,nodeId?,variables,inputs,outputs}`，kind 为 `initial/read/assign/write/wait/resume/branch/cycle/stop`。read/write 附 `port/value`；wait 附 `durationMs/resumeAtMs`；branch 附布尔 `branch`。使用不可变状态拷贝，可确定性重放；事件数组与输入原件都不会在运行中修改。

## 独立客户测试与证据草稿

```js
const fixedTest = {
  id:'fixed-dark', requirementId:'auto-light',
  inputTimeline:[{atMs:0,signals:{LIGHT:150}}],
  assertions:[{atMs:0,output:'LAMP',equals:true}], maxSteps:1000,maxTimeMs:100,
};
const assessment = evaluate(simulated.value, [fixedTest]);
// {passed,cases:[{id,requirementId,passed,assertions:[{atMs,output,equals,actual,passed,nodeId?}],diagnostics}],diagnostics}
const draft = runCustomerTests(program, topology, fixedTestsFromD, {
  programRef, wiringRef:topology.wiringRef, requirementRef, testSuiteRef,
  deviceProfileRef:deviceProfile.ref,
});
// Result<{schemaVersion:'eq-test-run-draft/0.1',refs,passed,
//   runs:[{testId,simulation,evaluation}]}>
```

`evaluate` 对一次执行做断言：必须输入时间线一致、状态为 completed、覆盖客户窗口且实际步数不超测试预算；否则失败。上例 `fixedTest` 的输入与 `simulated` 不一致时会返回 `SCENARIO_MISMATCH`，不能挪用另一场景的运行。`runCustomerTests` 为 D 的每个固定场景独立启动新程序状态，绑定各引用，拒绝 wiring/device 版本不一致和 requirementId 错配。

当前实现仅数字布尔输出断言；公共草案的数字模拟输出需后续语言/设备模型扩展。测试不接收学生阈值作为真值，不修改客户 fixture。合成测试固定 150→850→449→450 与 0/50/100/200/300ms 预期，改阈值 400、输出取反或等待 250ms 均失败。它们是 A 的回归 fixture；正式客户通过条件来自 D，不将这些值写死为真实订单标准。

候选例子的 digest 字符串只用于可运行演示，未冒充 SHA-256。E 负责规范化/摘要与真实 refs、个人身份、权限、过期证据、签发。语言 Profile 的候选 ref 是语言版本识别标记，公共冻结时需 E/A 一起迁移。`runCustomerTests` 不能凭调用方提供的 programRef 验证内容摘要，服务端必须重新计算、绑定确切程序和测试内容。本模块不发奖励、不改订单、不认证实物。

## 实现限制与证据

本机编译测试链接受控 `Arduino.h` stub，编译**生成器原样输出**，逐条对照读写事件、等待、边界、短路和错误后状态保持。它证明本机 C++ 与解释器在规定输入模型下的一致性；没有安装 Arduino CLI、下载板卡 core、执行目标机编译或烧录。没有真实硬件、在线 AI、真实学生数据或正式部署。

浏览器验证与最终命令结果记录在 [verification.md](verification.md)。旧 npm test 默认只匹配 `tests/*.test.js`，因此 E 集成时应把 `tests/program/*.test.js` 加入公共测试命令；本分支遵守所有权，未修改 package.json。
