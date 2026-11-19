// Teaching content is deliberately separate from business facts and authority.
const say=(id,text)=>({id,text});
const choice=(id,text,options)=>({id,text,options});
const option=(id,label,correct,feedback)=>({id,label,correct,feedback});
export const LESSONS = Object.freeze({
  welcome:{title:'接下第一份委托',stage:'mail',manual:'02.1',action:'去邮箱领取订单',lines:[
    say('meet','我是林工，负责带你做第一份订单。今天你独立负责展台的一盏小灯；我陪你看现象、查依据，作品由你来做。'),
    say('client','客户说：周围暗下来时开灯，变亮时关灯，而且光照会反复变化。先去邮箱领取委托，读一遍客户要看到的行为。'),
  ]},
  plan:{title:'先说明装置怎样工作',stage:'requirements',manual:'02.1',action:'去写中文方案',lines:[
    say('input','现在先不用代码。想想装置要知道什么、怎样判断、控制什么，以及光照再次改变后怎么办。'),
    choice('repeat','灯已经亮了，后来环境又变亮。只在开始读一次光照，够用吗？',[
      option('once','够用，第一次已经知道明暗',false,'第一次读数只描述那一刻。环境后来变了，装置还不知道；想想下一次读数在哪里发生。'),
      option('repeat','不够，要重新读取并判断',true,'对。下一轮要重新观察，才能发现环境变化。把这个过程用自己的话写进方案，不需要背代码术语。'),
    ]),
    say('save','去选输入、判断、输出和持续工作方式，再用自己的话说明一次明暗往返，点保存。这里的固定检查只核对选项和解释是否填写；自由解释仍需教师核对。'),
  ]},
  wiring:{title:'让信号走到正确的端子',stage:'wiring',manual:'06.1',action:'去接线与检查',lines:[
    say('ports','先分清三件事：VCC 给模块供电，GND 是公共参考，AO 才是光照信号。本关把 AO 送到 Uno 的 A0，把灯的输出放在 D9。'),
    say('led','LED 有方向，也需要串联限流电阻。本关练习路径是 D9 → 电阻 → LED 的 A，LED 的 K → GND。不要用导线绕过电阻。'),
    say('operate','在画布里先点一个端子，再点另一个端子连线；键盘可 Tab 找端子、Enter 选择。看不清可切换“放大接线”，接错可撤销或点诊断定位。'),
    say('safety','这些是当前虚拟模型的约定。真实模块型号、亮暗方向和限流值要现场核对；实物先断电接线，教师检查后才能上电。网页规则通过不代表安全批准。'),
  ]},
  blocks:{title:'让装置持续观察',stage:'blocks',manual:'07.1',action:'去搭积木并测试',lines:[
    say('structure','把程序想成一次次巡视：读取光照 → 按客户边界判断 → 让灯亮或灭 → 短暂等待 → 再读取。先搭外层的持续工作，再放这一轮要做的事。'),
    choice('else','暗时已经执行了开灯；下一轮读数变亮，程序还需要做什么？',[
      option('nothing','什么也不做，灯会自己熄灭',false,'输出会保持上一次的状态。如果亮时没有关灯动作，灯可能一直亮。回到分支想想另一侧该做什么。'),
      option('off','明确执行关灯',true,'对，两个分支都要明确控制输出。读取也要在持续工作里面，不能一直拿第一次的旧读数判断。'),
    ]),
    say('verify','先用光照滑条试一次暗→亮→暗，再运行基础客户测试。客户还会检查恰好 450 和响应时间；滑条看起来对了，也要用固定测试验证。等待过长会超过 200 毫秒要求。'),
  ]},
  handover:{title:'从自己的积木走向代码',stage:'blocks',manual:'08.1',action:'去保留积木并生成代码',lines:[
    say('proof','当前积木版本的基础客户测试通过了，这是软件证据。挑一条明暗往返记录，自己指出：哪一步读到了新的光照？'),
    say('keep','现在到积木工具，保留快照并查看它对应的简写 C++。客户下一步会改变开灯边界；沿用你的硬件和程序结构，不必重抄一份答案。'),
  ]},
  change:{title:'客户希望灯更早亮',stage:'code',manual:'02.2',action:'去修改代码并复测',lines:[
    say('change','客户把虚拟开灯边界从 450 改成了 600，硬件保持原方案。先在你自己的代码里找到决定明暗的比较，再考虑哪一处数值要变。'),
    choice('predict500','先预测一下：新需求下，光照读数为 500 时，灯应该怎样？',[
      option('off','熄灭',false,'新边界是 600。把 500 与 600 比一比：它落在“小于边界”的哪一侧？再判断客户何时要求亮灯。'),
      option('on','亮起',true,'对，500 小于 600。它是区分新旧行为的好例子；旧版在 500 时熄灭，所以旧测试通过不能证明新需求完成。'),
    ]),
    say('apply','只修改你判断需要改变的地方，点“解析并应用代码”，再运行变更客户测试。等于 600 时应关灯；改代码后旧结果会失效，要看当前版本的证据。'),
  ]},
  delivery:{title:'说明软件完成了什么',stage:'code',manual:'10.1',action:'去查看软件交付操作',lines:[
    say('software','当前代码通过了新版客户测试。你可以导出这份确切源码，并在交付操作中明确请求本次会话的合成软件收入；重复领取不会增加金额。'),
    say('physical','交付时说清楚：软件测试已完成，目标板编译、烧录和实物功能仍未验证。真实装置保持断电，下一步交给现场教师检查；我不能替教师批准。'),
  ]},
  done:{title:'回看这次工程经历',stage:'tests',manual:'09.2',action:'去回看实际测试',lines:[
    say('review','本机订单已有合成软件收入记录。选一条你修过的错误，讲清当时看到什么、改了什么、哪次复测证明了变化。'),
    say('next','你可以重看任一节，或回工具继续探索。修改作品后需要重新测试；已经完成的软件成果和仍待现场验证的事项要分别说明。'),
  ]},
});
export const LESSON_IDS=Object.freeze(Object.keys(LESSONS));
