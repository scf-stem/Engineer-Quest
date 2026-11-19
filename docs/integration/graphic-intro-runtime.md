# G0–G3 局部练习运行适配

2026-11-12。专用分支 `work/graphic-runtime`，基线 `c205961e0e2551024c1a722ced9f6b64810d666a`。仅新增本模块、专项测试和本文；未修改执行器、判分策略、控制器、入口、Blockly注册、依赖或部署。

依据主目录只读策划包的 `03-首段逐屏脚本.md` 与 `05-V0.2修订与验证记录.md`。本轮采用**真实轨迹回放**：现有 `simulate` 同步运行，不具备暂停后续执行状态。界面应写“回看一步”，不称实时单步。没有使用设计稿170/820/360预填学生成果。

## 冻结导出

模块：`src/program-teaching/runtime.js`，无外部依赖，仅使用现有 `blocksToProgram`、`simulate` 承载程序语义。

```js
const result = buildTeachingRun({
  kind: 'output', // 'output' | 'sequence' | 'reading'
  blockState,    // 原Blockly 12可见局部workspace，或 {workspace}
  topology,      // await context.topologyFor(真实接线) 成功结果的 .value
  light: 713,    // 当前0…1023整数；无预设成绩值
  initialLamp: true, // 上一次实际灯态，布尔值必填
  actor: 'learner',  // 或 'mentor'
  runId: 'run-id',
});
```

成功返回 `{ok:true,value:{program,simulation,studentNodeIds,origin,workspaceCanonical},diagnostics:[]}`。`origin`恰为`{actor,kind,runId,scaffoldVersion:'g0-g3/1'}`。`workspaceCanonical`是原可见workspace（不含外层wrapper）的稳定JSON，保留位置、ID和全部原序列化；不会改写学生workspace。

静态/拓扑错误返回`ok:false,diagnostics`，能定位时保留原学生nodeId。实际运行错误或预算失败返回`ok:false`，并保留`value`中的真实部分程序/轨迹，可显示已发生的行为；不会把内部simulation对象当作成功。本模块不签发课程通过、收入、当前作品资格或另一套持久化passed。

## 局部块如何进入合法程序

- `output / sequence`：顶层恰好一只`eqp_write`；其`next`形成由`eqp_write / eqp_wait`组成的学生动作链。原ID保留，原值位交现有转换器检查。空VALUE、整数冒充布尔、空MS、负数/小数等待等得到原错误及相关学生ID。多个顶层全部诊断，散落块不被丢弃。停用、重复ID、循环、未知后续动作不静默运行。
- `reading`：顶层恰好一只`eqt_sample`观察架，唯一VALUE中必须是学生`eqp_read_analog PORT=LIGHT`。该原read节点接进导师准备的`eqp_set`和整数记录声明，再由原转换器形成完整程序。观察架自身不进入ProgramIR，也不直接执行散落表达式；read ID保留。固定数字、LAMP方向、空槽或额外next会诊断。
- 学生动作在SETUP中只运行一次。LOOP仅有导师提供的安全`wait100`。导师初始LAMP写入调用者给出的`initialLamp`，因此延续真实上一次灯态，不靠改设备profile伪造初态。
- 所有准备步骤ID都以`__eqt_host_g0_g3_1__:`开头。学生不能使用此前缀。`studentNodeIds`来自可见局部workspace的实际连接块；未执行的替换shadow不算运行节点。观察架容器ID可在此列表，但不会产生IR事件。HOST节点不在学生列表中，亦不计入assessment的观察数组。
- 保持现有版本/类型/端口/拓扑校验，不能传`{ok,value}`拓扑包装代替其`.value`；不能省略真实B校验或用synthetic profile代替正式profile。

模拟窗口从800ms开始。若真实学生wait跨过窗口，使用该真实事件的`resumeAtMs+100`扩大窗口并重新调用原simulate，直到学生动作可见或达到现有60000ms上限。支持1、37、1450、32767等正数等待，不强制600；多段等待和运行时输入给出的等待长度也按实际事件扩窗。超出原引擎上限的尾部动作不会凭空出现，未发生的反向write不能满足顺序目标。

## 回放帧

`teachingFrameAt(result, timeMs)` 与 `teachingFrameAt(result.value, timeMs)`均可。主调用使用完整build包装；包装`ok:false`始终保留失败，即使有人传入内部completed simulation。

直接返回：

```js
{
  ok, atMs, lamp, sample, nodeId, runtimeNodeId,
  read, write, waiting, events, diagnostics,
}
```

- `atMs`是请求时间（非负有限数）截在真实`completedThroughMs`内。非法时间或版本返回失败空帧，不能产生数据。
- `events`是原轨迹里`atMs <= 当前回放位置`的真实事件。0ms的“开→关”都在0ms帧，最终实际灯态为关；没有延长动画创造保持区间。
- `lamp`来自截至该时刻最后事件的实际`outputs.LAMP`；`sample`只来自最近真实LIGHT read，未读为null。环境变化本身不调用此模块、也不刷新旧样本。
- `read / write`是最近真实LIGHT read / LAMP write对象或null，可能包含HOST初始化write；它们不直接表示学生完成。
- `nodeId`为最近一个可见局部块的事件节点，避免安全LOOP抢走学生执行指针；`runtimeNodeId`保留最近实际引擎节点，包括HOST。
- `waiting`为空或真实wait事件加`student`、`remainingMs`。`student:false`表示HOST安全等待，不能当成学生摆放了等待；来源actor仍须看origin，mentor片段即使`student:true`也不是学生成果。
- 序号、steps、时间、输入、输出及原nodeId均来自真实simulation，没有补绘resume或未执行写入。可保存回放`atMs`后从同一轨迹恢复；它不是引擎续执行token。

## 本次目标观察

`assessTeachingRun(result,{goal,previousLight?})`也兼容value本体，但不能把失败包装转成功。直接返回`{ok,diagnostics,observed}`。

`observed`的`writes / reads / waits / resumes / events`只含原simulation里属于可见学生ID的真实事件。`lastStudentLamp`仅取这些LAMP writes的末值（无write为null），`sample`仅取这些LIGHT reads的末值。未根据HOST初态给输出事实。

- `goal:'on'|'off'`要求`kind:'output'`及学生真实末次LAMP write与目标相符。
- `goal:'on-wait-off'|'off-wait-on'`要求`kind:'sequence'`，实际输出按指定方向变一次；两态之间有学生真实正数wait，且实际resume后才有相反write。wait和resume期间灯保持第一态。等在末尾、零等待、0ms同刻开关、方向错误或多次反转不会通过；额外同值write不会因坐标模板被判错。成功额外给`observed.sequence:{from,to,startAtMs,changedAtMs,waits}`。
- `goal:'read'`要求`kind:'reading'`及至少一次学生真实LIGHT读取。给出`previousLight`时，它必须是0…1023整数，且当前实际样本与其不同；首读不传该字段，不以null代替。任意不同合法光照均可，不要求设计稿数值。
- `actor:'mentor'`运行照样能看真实事件、灯与样本，但所有学生目标返回`ok:false / TEACHING_MENTOR_RUN`。
- 不支持的scaffold/program/language版本、错误来源、HOST伪装学生ID、运行错误、空/错轨迹均失败。E仍须把原inputs、原result及当前workspace/topology版本绑定，并在恢复时重演；此纯模块的对象字段不是签名证据。

E主调用约定：`workspace.performLearningAction({actionId:'graphic-intro-run',inputs})`保存原inputs及真实build包装；UI调用`teachingFrameAt(action.result,ms)`与`assessTeachingRun(action.result,{goal,previousLight})`。只有E策略把本轮实际learner output映射为既有`guided_output_observed`，其余intro练习不冒充完整自动灯/原型证据。

## 验证

命令：

```sh
node --test tests/program-teaching/runtime.test.js tests/integration/program-adapter.test.js tests/integration/observation-model.test.js
```

21/21通过：18条新专项，3条既有真实适配/观察回归。新专项全部使用正式`createHardwareContext()`、实际接线文档和`context.topologyFor()`校验结果，没有导入`SYNTHETIC_DEVICE`或`SYNTHETIC_TOPOLOGY`。覆盖：只执行一次与原ID/版本绑定、HOST初态排除、0ms双write、300ms保持/600ms结束、相反方向与非600等待、多段/动态等待、任意真实采样、导师来源排除、空/错值与散落块ID、循环/停用/重复/HOST ID、真实错线/错profileRef、部分运行错误、失败包装、版本漂移、非法回放时间、JSON保存恢复。`git diff --check`通过。

这是纯模块，不需要server、浏览器或新依赖。没有声称完成G0–G3界面、拖放、存档政策或学生盲走；这些由E与编辑器专项整合验证。未修改根progress，未启动/覆盖任何候选服务。
