import {canonicalJson} from '../contracts/index.js';

export const GRAPHIC_INTRO_KEY='graphic-intro:g0-g3';
export const GRAPHIC_INTRO_VERSION='eq.graphic-intro/1';
const value=block=>({block});
const block=(type,id,fields={},inputs={})=>({type,id,fields,inputs});
const bool=(id,on)=>block('logic_boolean',id,{BOOL:on?'TRUE':'FALSE'});
const output=(id,on)=>block('eqp_write',id,{PORT:'LAMP'},on===null?{}:{VALUE:value(bool(id+'-value',on))});
export function teachingSeed(key){
  let root;
  if(key==='g3')root=block('eqt_sample','my-reading');
  else if(key==='g2'||key==='g2-independent'){root=output(key+'-on',true);root.next=value(output(key+'-off',false));}
  else root=output(key+'-lamp',key==='g1-independent'?false:null);
  return {blocks:{languageVersion:0,blocks:[{...root,x:35,y:45}]}};
}
export function mentorSeed(kind){
  if(kind==='reading'){const root=block('eqt_sample','mentor-reading',{}, {VALUE:value(block('eqp_read_analog','mentor-light',{PORT:'LIGHT'}))});return {blocks:{languageVersion:0,blocks:[{...root,x:35,y:45}]}};}
  const root=output('mentor-on',true);if(kind==='sequence')root.next=value(output('mentor-off',false));
  return {blocks:{languageVersion:0,blocks:[{...root,x:35,y:45}]}};
}
export function createGraphicIntro({learnerId,attemptId}){
  return {version:GRAPHIC_INTRO_VERSION,learnerId,attemptId,phase:'g0-start',environment:820,observed:false,inputChoice:null,outputChoice:null,
    paused:false,prediction:null,feedback:null,focus:null,hints:[],drafts:Object.fromEntries(['g1','g1-independent','g2','g2-independent','g3'].map(key=>[key,teachingSeed(key)])),
    runIds:[],selectedRunId:null,pendingRun:null,replay:{atMs:0,playing:false},sampleSelection:false,waitObserved:false,editSequence:0,writerId:null};
}
export function graphicIntroFor(state){const record=state?.attempt?.learning?.[GRAPHIC_INTRO_KEY];return record?.version===GRAPHIC_INTRO_VERSION&&record.learnerId===state.learner?.id&&record.attemptId===state.activeAttemptId?record:null;}
export const graphicIntroPending=state=>{const record=graphicIntroFor(state);return !!record&&record.phase!=='complete';};
export const draftKeyFor=phase=>phase.startsWith('g3')?'g3':phase.startsWith('g2-independent')?'g2-independent':phase.startsWith('g2')?'g2':phase.startsWith('g1-independent')?'g1-independent':'g1';
export const kindFor=phase=>phase.startsWith('g3')?'reading':phase.startsWith('g2')?'sequence':'output';
export function studentRunFor(state,id){return state.attempt?.learningActions.find(a=>a.request?.actionId==='graphic-intro-run'&&a.request.inputs.runId===id)??null;}
export function currentIntroRun(state,record){return studentRunFor(state,record.selectedRunId);}
export function teachingWorkspaceIdentity(workspace){
  function project(item){if(Array.isArray(item))return item.map(project);if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).filter(([key])=>!['x','y'].includes(key)).map(([key,value])=>[key,project(value)]));return item;}
  return canonicalJson(project(workspace));
}

const step=(title,line,action,focus,extra={})=>({title,line,action,focus,...extra});
export const GRAPHIC_STEPS={
  'g0-start':step('还是这张展台，这盏灯。','线路接好了。灯还不知道什么时候动。先看看环境和它的动作各在哪里。','先看一次遮光','primary'),
  'g0-demo':step('环境暗了，灯还没收到指令。','光照表变了，但程序还没有发出新的开关指令。现在由你看看。','轮到我观察','environment'),
  'g0-operation':step('把输入和动作找回来。','亲手改变一次光照，再选出装置读取的信息和灯执行的动作。','确认这两处','environment'),
  'g0-error':step('留在这里，再看一次。','日期没变，光照表变了。找能告诉装置眼前环境的信息。','我再试试','input'),
  'g0-success':step('信息和动作，各有位置。','光照读数是输入，灯的开关是输出。接下来给灯一句真正的指令。','给它第一句指令','primary'),
  'g1-start':step('一句指令，会改变什么？','先猜一猜：数字输出 LAMP 设为 true，执行以后灯会亮还是灭？','看林工执行一次','prediction',{mentor:true}),
  'g1-demo':step('这句执行后，灯亮了。','这是真实输出记录。LAMP 对应 D9；true 发出开灯指令。轮到你把它接好。','我来接这句','device',{mentor:true}),
  'g1-operation':step('给这句补上“开”。','灯先回到灭。从托盘拿起 true，接到指令值位；连接后还要执行，灯才会收到它。','执行这句','editor'),
  'g1-error':step('先看指向的这一处。','积木留在这里。对准值位，看到连接以后再运行。','调整后再执行','editor'),
  'g1-success-on':step('是你接好的这句，让灯亮了。','对照刚才的预测和实际输出。接下来只改这个值，试着明确关灯。','看看怎样关掉','primary'),
  'g1-try-off':step('同一个输出口，也能明确关灯。','把 true 改成 false，先预测，再执行自己的这一句。','执行这句','editor'),
  'g1-success-off':step('开和关，都由你发出了。','作品和两次输出都留下来。这次我不先指位置，你自己再试一遍。','开始独立小任务','primary'),
  'g1-independent-on':step('这次，由你让灯亮起来。','灯从灭开始。用这句输出让它亮，再把它关掉。我在旁边看你的结果。','执行我的指令','editor',{independent:true}),
  'g1-independent-on-done':step('这次开灯，是你自己改值并执行的。','先看清这个输出，再由你把它关掉。','再把它关掉','primary',{independent:true}),
  'g1-independent-off':step('再由你把灯关掉。','保留同一句，改成你认为能关灯的值，预测后再运行。','执行我的指令','editor',{independent:true}),
  'g1-independent-success':step('这两次输出来自你的操作。','你改值并执行了开和关。接下来让两句指令按顺序工作。','给两句排个顺序','primary'),
  'g2-start':step('先开，再关，会看到什么？','两句从上往下做。中间没有等待，先预测最后会看到什么。','看林工执行这两句','prediction',{mentor:true}),
  'g2-demo':step('两句都在同一时刻做完了。','记录是0毫秒开、0毫秒关。没有停留，最后一句把灯关了；不是拖放接错。','我来加一个等待','events',{mentor:true}),
  'g2-operation':step('让第一句保持一会儿。','把等待接在两句之间，给等待填一个正数。等待时，灯保持上一句的状态。','运行这段顺序','editor'),
  'g2-error':step('沿着刚才的顺序找原因。','看开、等待、关分别在什么时候发生。只改你找到的那一处，再运行。','调整后再运行','editor'),
  'g2-success-hold':step('回放到等待中，灯仍然亮。','这是本次运行的回放。点一下时间轴里的等待，看看上一句的输出怎样保留。','回看到等待末尾','events'),
  'g2-success-end':step('等待结束，下一句才关灯。','同一条轨迹中，先开，等过一段时间，才关。这次你来换个顺序。','换个顺序再试','primary'),
  'g2-independent-operation':step('先保持关一会儿，再开。','同样的三块，由你重新安排。先预测最后状态，再运行验证。','运行我的顺序','editor',{independent:true}),
  'g2-independent-success':step('顺序变了，结果也变了。','这段只是在检查输出与时间，还没有替客户判断明暗。把它留下来，再看输入。','保留作品，开始读取','primary'),
  'g3-start':step('让程序取得眼前的数。','LIGHT 对应 A0，接着光照模块的 AO。先看一次读取，不用先设置变量。','看林工读一次','primary',{mentor:true}),
  'g3-demo':step('走到读取，这个数才交给程序。','这次真实读取留下了170。接下来环境会变化，上次的记录先留着。','轮到我再读一次','sample',{mentor:true}),
  'g3-operation':step('环境变了，上次的结果还在。','把 LIGHT 读取块接进观察值位。移开遮挡，再执行读取，看看记录什么时候更新。','执行读取','editor'),
  'g3-error':step('改变环境，不等于已经读取。','只动光照不会更新采样。保留刚才的数，接好读取块，再从同一个入口执行。','执行读取','editor'),
  'g3-success':step('这是你刚刚读到的数。','在旁边指认本次采样。环境已经改变过，而这条记录来自你真正执行的读取。','换个光照，再自己读一次','sample'),
  'g3-transfer':step('换个光照，这次你来更新。','把环境调到另一个数，上次结果会先留着。你决定怎样取得眼前的新数。','执行读取','environment',{independent:true}),
  'g3-transfer-success':step('两次由你读取，结果都更新了。','开关、顺序和这两次读取都留在工位。接下来把这些动作接进自己的完整原型。','接回我的原型工位','primary'),
};
export function stepFor(record){return GRAPHIC_STEPS[record.phase]??step('入门练习已保留。','可以回看自己的动作和真实记录。','返回完整原型','primary');}
