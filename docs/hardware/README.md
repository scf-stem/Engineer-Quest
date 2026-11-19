# B 线：自动灯虚拟电子工作台 V0.1

基线 `eb0f63f`；工作区 `.worktrees/hardware`，分支 `work/hardware`。只新增 `src/hardware/`、`tests/hardware/`、`docs/hardware/`。不改入口、旧引擎、配置、依赖或订单通过条件。

## 集成入口

```jsx
import {useState} from 'react';
import {
  UNO_CANDIDATE_PROFILE, createWiringDocument, createAutoLightExample,
  validateWiring, migrateLegacyWiring, getWiringElectricalState, createInputFixture,
} from './src/hardware/index.js';
import {WiringWorkbench} from './src/hardware/WiringWorkbench.jsx';

function Workbench() {
  const [wiring, setWiring] = useState(() => createWiringDocument());
  const [light, setLight] = useState(150);
  return <WiringWorkbench value={wiring} deviceProfile={UNO_CANDIDATE_PROFILE}
    onChange={setWiring} lightValue={light} onLightChange={setLight}
    diagnostics={[]} readOnly={false} />;
}
```

`index.js` 只导出纯 JS，Node 测试不会装载 JSX 或 CSS。React 组件具名、默认导出均可，组件导入自身作用域 CSS。无需新增依赖。示例导入路径按调用文件调整。

`WiringWorkbench` 是受控组件。每次成功编辑调用 `onChange(nextDocument)`；拖动元件在松手时产生一次编辑，撤销/重做保留最多 40 步，切换外部文档清空本地编辑历史。保存与恢复由 E 处理，组件不自行写 localStorage。外部文档替换时应传入新引用；同一文档的普通重新渲染应保留引用。

| prop | 含义 |
|---|---|
| `value` | 下述 `WiringDocument`，不要传旧线数组 |
| `deviceProfile` | 默认为 `UNO_CANDIDATE_PROFILE`；首版只支持本关规则 |
| `onChange(document)` | 受控编辑；不传时禁止编辑 |
| `diagnostics` | E/A 额外诊断，与本地诊断去重显示；error 阻止界面显示规则通过 |
| `readOnly` | 禁止接线、移位、撤销、删除和滑条；仍可查看端子 |
| `lightValue` / `onLightChange(number)` | `0–1023` 整数的合成输入；父层交给 A 的解释器，不在 B 执行 |
| `outputs` | 可选 `{lamp:boolean}`；只渲染 A 的输出，接线不合法时不显示点亮 |
| `onOpenManual(section)` | 可选；节号是候选索引，需 D/E 统一；未接时手册入口禁用 |
| `className` / `classTokens` | root 额外类；tokens 键为 `root/header/canvas/sidebar/diagnostics` |

C 可覆盖 `--eq-text`、`--eq-text-muted`、`--eq-border`、`--eq-surface`、`--eq-accent`、`--eq-danger`。B 默认样式全部限定在 `.eq-hardware`，无 body 或全局标签修改。独立 demo 的页面样式仅在 demo HTML 内。技术引脚与元件文字为 SVG/HTML，未使用生成图片。

### 窄容器与初始状态增量

本次不新增或修改 props，也不修改校验器或通过条件。

- 空白有效文档只有本地“缺少连接”诊断时显示中性“待连接”，不显示待修复数量或端子错误色。`validateWiring` 依然返回 `ok:false` 和完整原始诊断；不能进入编程阶段。只要有外部 error、未知结构或实际错线，就显示错误。
- `.eq-hardware` 建立命名 inline-size container。组件实际宽度 ≤1200px 时资料/检查移到画布下方，≤600px 时进一步堆叠；与浏览器 viewport 宽度无关。父层保持一个明确可用宽度即可，无需 ResizeObserver 或新依赖。
- 默认“查看全景”模式按可用宽度缩放整个 SVG，全部元件可见。点击“放大接线”后恢复至少 1040px 宽的大画布；可点击“← 向左查看”/“向右查看 →”平移，不要求先找到滚动条。视图按钮在只读状态仍可使用，不改接线文档、位置、历史或任何电气内容。
- 缩放命中继续通过 SVG 屏幕矩阵换算。点击错误卡会进入放大视图，将具体端子置于画布视野并聚焦；键盘聚焦端子也会在放大画布中自动居中。放大模式下仍可用滚动条或触控板浏览。
- 自动化保留 `.eq-hw-state`、`.eq-hw-stage`、`data-component`、`data-terminal`、`data-diagnostic-code`；新增根属性 `data-view-mode="overview|detail"`，按钮以 `aria-pressed` 表示当前视图。按钮中文名称如上，E 无需适配新 props。

## 数据、版本与 pin map

```js
const profile = UNO_CANDIDATE_PROFILE;
profile.family;             // 'arduino-uno'
profile.variant;            // null — 实物代际未确认
profile.fqbn;               // null — 不能用于烧录
profile.calibrationStatus;  // 'synthetic'
profile.physicalVerification; // 'pending'
profile.pinMap;             // {light:'A0', lamp:'D9'}，候选
```

`candidateVariant` 描述参考图为 R3/A000066，不等同确认套件。`ref.digest` 当前是 `draft:*` 版本标记，不是内容哈希或权限凭证。E 冻结契约后统一生成摘要，profile/元件改版要同时重建或迁移引用，不原地沿用通过证据。

```js
{
  schemaVersion: '1.0', deviceProfileRef: {id, version, digest},
  components: [{instanceId: 'uno', typeRef: {id, version, digest},
                position: {x: 60, y: 65}}, /* sensor/resistor/led */],
  connections: [{id: 'wire-1', from: 'uno:5V', to: 'sensor:VCC'}],
}
```

端子键为 `instanceId:terminalId`；实例 ID 是 1–64 个字母、数字、`_` 或 `-`。首单恰好一个 Uno、光照 AO 模块、电阻和 LED，实例 ID 可以改名，元件类型及版本必须匹配。profile 的 `terminals` 描述板卡，`getTerminalIndex(document,profile)` 展开所有元件端子。位置是画布坐标，不改变电气网络。

Uno 展示候选 R3 的两排参考名称，只开放 `5V`、`GND_TOP/GND_1/GND_2`、`A0/A1`、`D8/D9` 接线。A1/D8 用于真实指出接错口，其他灰色端子可查看资料。`D9` 是教学名称，Arduino 输出参数为 `9`；三个 GND 是不同物理端子，图中都准确显示 `GND`，模型中内部相连。模拟量 `0–1023` 和低值为暗均仅为合成约定。

## 校验与错误处理

```js
const candidate = createAutoLightExample(profile); // 显式参考答案，不自动给学生装载
const result = validateWiring(candidate, profile);
if (result.ok) {
  result.value.pinMap;   // {light:'A0',lamp:'D9'}
  result.value.bindings; // light:{terminalId:'uno:A0',physicalPin:'A0',arduinoIdentifier:'A0'}
                         // lamp:{terminalId:'uno:D9',physicalPin:'D9',arduinoIdentifier:'9'}
  result.value.nets;     // 仅导线/板内公共地构成的网络；不跨电阻合并
}
// {ok:false,diagnostics:[...]} 没有 value，禁止作为已验证拓扑传 A。
// 每次结果含 HARDWARE_UNVERIFIED warning，不阻止虚拟规则通过。
```

诊断使用 `{code,severity,message,terminalIds,manualSection}`。错误不会自动修线。点击错误卡聚焦相关端子；HTML `data-diagnostic-code` 可供 e2e 稳定定位，界面展示中文。校验拒绝未知元件/端子、重复 ID/导线、自连、超出 64 线、版本不一致等文档问题。

| 关键 code | 场景 |
|---|---|
| `SENSOR_POWER_MISSING` / `SENSOR_GROUND_MISSING` | 模块缺供电/公共地 |
| `SENSOR_PIN_MISMATCH` / `UNMAPPED_PIN` | AO 接 A1、输出接 D8 等，指出当前与期望端子 |
| `LED_GROUND_MISSING` / `LED_POLARITY_REVERSED` | K 缺地或 A/K 反接 |
| `LED_SERIES_RESISTOR_MISSING` | 输出到 A 没有串联电阻 |
| `RESISTOR_BYPASSED` | 输出直连 A，或电阻两端被短接 |
| `POWER_SHORT` / `NET_CONFLICT` | 电源短地，或合法网络间被额外导线合并 |
| `DEVICE_PROFILE_MISMATCH` | 接线引用版本与当前设备不匹配 |

正反方向接电阻均可；电阻后置于 LED 负极侧本轮不支持，诊断会要求按本关“输出→电阻→A、K→GND”布置，不声称所有其他物理有效电路都非法。

## 显式迁移与电气摘要

```js
const migrated = migrateLegacyWiring([
  ['UNO.5V','SENSOR.VCC'], ['UNO.GND','SENSOR.GND'], ['UNO.A0','SENSOR.AO'],
  ['UNO.D9','R.1'], ['R.2','LED.A'], ['LED.K','UNO.GND'],
], profile);
// migrated.ok -> migrated.value 是新文档；再 validateWiring(value,profile)
// 未知旧端子拒绝迁移；电气错误草稿保留错误，不悄悄修复。
```

`getWiringElectricalState(document)` 对已经通过文档格式校验的文档生成稳定对象：保留 schema/profile ref、元件实例与类型版本、端子连线，排除位置、线 ID、数组顺序和导线方向。增删线、实例或设备版本变化都会改变对象；纯移动不变。保留重复线条目，非法草稿的变化也能使旧证据失效。返回对象不含摘要，E 应使用自身规范序列化/摘要逻辑，并另存布局版本。此函数不是运行时输入校验器，E 应先用契约验证任意外部 JSON。

## 与 A 的时间/信号边界

```js
createInputFixture(profile);
// [{atMs:0,signals:{light:150}}, {atMs:500,signals:{light:850}},
//  {atMs:1000,signals:{light:150}}]
createInputFixture(profile, {samples:[{atMs:0,value:0},{atMs:250,value:1023}]});
```

使用逻辑信号 `light`，A 通过已验证 `pinMap` 映射到硬件。`atMs` 是严格递增的非负整数毫秒；样本最多 1000、读数为 `0–1023` 整数，否则抛 `TypeError`。B 不补帧、不执行 wait、不计算灯输出、不选择阈值，也不生成客户断言。采样、输出保持、等待和预算全部由 A 的执行器负责。此函数只是合成输入适配，D 的独立客户测试仍为验收真值。

## 运行和验证

```sh
npm ci --ignore-scripts
npm run dev -- --port 5186
# 打开 http://127.0.0.1:5186/src/hardware/demo.html
node --test tests/hardware/wiring.test.js
npx playwright test --config tests/hardware/playwright.config.js
```

Playwright 默认使用自身浏览器；如当前机缺少对应版本，可指定已安装 Chrome，不使用个人资料：

```sh
PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test --config tests/hardware/playwright.config.js
PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tests/hardware/capture.mjs
```

测试服务只绑定 `127.0.0.1:5186`；截图脚本使用 `5187`。沙箱限制端口绑定时需由执行环境许可本地服务。测试与截图不烧录、不接入在线 AI、不上传合成资料。旧 `npm test` 仅包含 `tests/*.test.js`，总控需要显式纳入新测试或更新公共测试脚本。

## 实物未解决项

实际 Uno 代际、兼容板批次、USB/芯片、FQBN、供电、光照模块规格与方向、LED 电流/电阻值均待实物核验。无完整电压、电流、损耗、噪声、面包板或电路物理仿真；无编译、串口或烧录实现。接线通过只是软件规则证据，不能代替教师断电接线检查、上电批准与功能验收。

参考依据：Arduino 官方 [UNO R3](https://docs.arduino.cc/hardware/uno-rev3/) 与 [A000066 Full Pinout](https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf) 第 1 页（2022-10-06）。已核对 D9、A0、三处 GND 与 5V 名称；当前 SVG 为本项目原创功能示意，未复制官方插图。物理针脚间距未按比例还原，灰色端子不表示实物不可用。
