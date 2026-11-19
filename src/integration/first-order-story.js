import {guidedOutputComplete,experiencedFact} from './work-guidance.js';
import {requirementStageHandoffPending} from './requirement-stage-display.js';
import {graphicIntroFor,graphicIntroPending} from '../program-teaching/progression.js';
import {resultForStory} from './story-result-handoff.js';
export const JOURNEY_VERSION='eq.first-order-story/1';
export const freshJourney=({welcomed=false}={})=>({version:JOURNEY_VERSION,seen:welcomed?{welcome:true}:{},sceneId:null,line:0,paused:false,replay:false,replayLine:0});
const scene=(id,title,lines,action,target,manualSection,workAction=null)=>({id,title,lines,action,target,manualSection,workAction});
export const FIRST_ORDER_SCENES={
  welcome:scene('welcome','第一天 · 微光研发室',[
    '欢迎来到微光，我是林工。今晚这张工位属于你。先不用认识所有工具，我们一起接一份能做出来的工作。',
    '校园科技展台缺一盏灯：有人挡住窗光，它就亮；光回来，它就熄灭。客户想要的是这个变化，不是一段漂亮的代码。',
    '你来观察、接线、搭程序，我在旁边陪着看。不会的地方随时问，作品留着，我们一小步一小步改。',
    '先在虚拟工位操作。以后接真实设备，要先断电，接好请老师检查再上电。现在，通信终端刚收到客户的信。',
  ],'跟林工去收信 →','mail','01.1'),
  client:scene('client','第一封委托 · 校园展台',[
    '这封信已经放进你的工作档案。先别急着接线，来看看客户说的“暗下来”究竟发生了什么。',
    '遮住一点窗光，看看仪表；再用灯的动作把你的想法演给我看。数值和线路，我们在用到时再讲。',
  ],'到客户桌边看看 →','mail','02.1'),
  wiring:scene('wiring','把想法带回工位',[
    '客户的桌面我们看过了。现在给光照模块接上电，再把它看到的读数送到开发板。',
    '先找到光照模块的 VCC 和开发板 5V，点两端就能连线。做完一条，工位会告诉你下一条；没做的只是待办，接错了我们再修。',
  ],'接第一条线 →','wiring','06.1'),
  lamp:scene('lamp','先让灯回应我',[
    '输入、供电和灯的回路接好了。先不搭整段程序，你来指挥灯开一次、关一次。',
    '看着装置按“让虚拟 LED 亮起来”。这是你发出的输出；下一步让它自己看环境。',
  ],'亲手点亮它 →','blocks','07.1'),
  reading:scene('reading','给装置一双眼睛',[
    '刚才灯真的回应了你的指令。可你不能一直站在展台边替它开关。让它先读到眼前的光照吧。',
    '从空白放一个程序入口。light 像贴了名字的小盒子，把这次读到的数放进去。先做这件小事，不急着搭完整灯。',
  ],'让它读到一个数 →','blocks','07.1'),
  branch:scene('branch','让读数作决定',[
    '它看到了环境中的数。现在让同一个数走两条不同的路：暗时开，亮时关。',
    '客户的约定是小于450才亮。把比较结果交给“如果／否则”，再分别试150和850。我陪你看两次灯的变化。',
  ],'给明暗各安排一条路 →','blocks','07.2'),
  repeat:scene('repeat','窗光又变了',[
    '明暗两次都回应了。可展台不是一张静止的照片，刚才亮了，接下来还会暗。',
    '运行暗、亮、再暗这段变化。看读数有没有重新读到；把读取和判断留在持续执行里，并留一点等待时间。',
  ],'试一次连续变化 →','blocks','07.2'),
  base:scene('base','客户的第一封回信',[
    '客户看过基础版的连续变化和边界，灯按原来的约定工作了。这份积木是你自己做的，先保留下来。',
    '展台刚发来一封新信：桌子挪到偏暗的位置，希望灯更早亮。我们接着改这份作品，不用重新接线。',
  ],'保留我的作品，打开新来信 →','mail','08.1','prepare-change'),
  change:scene('change','同一盏灯 · 新的约定',[
    '原来小于450才亮，现在客户把边界移到600。先拿500想一想，旧版和新版会在哪里不同？',
    '看完这点区别，我们就去自己的积木图里找那处比较，再改它对应的短代码。不是再抄一份答案。',
  ],'拿500试想这次变化 →','mail','08.1'),
  code:scene('code','走进自己的代码',[
    '你已经在自己的作品里找到了比较。积木变成文字，读数、判断和灯仍是同一件事。',
    '先点自己保留的比较，看它对应哪一行；把边界改成600，再让客户试这份确切的代码。旧作品和旧回信都留着。',
  ],'改这份作品 →','code','08.1'),
  delivery:scene('delivery','把作品带到展台',[
    '新版场景也试过了，500会亮，等于600会灭，持续变化仍能跟上。现在把这份软件演示交给客户。',
    '回信会和你的作品一起保存在本机。软件订单的游戏收入也记在这里；上真实板卡时，我们再请老师一起检查。',
  ],'交付这版软件演示 →','income','10.1','settle'),
};
/** Narrative only. Every predicate reads real work facts; seen never grants them. */
function eligibleStoryScene(state){
  const j=state.attempt?.presentation?.journey,f=state.facts;
  if(j?.version!==JOURNEY_VERSION)return null;
  if(j.replay)return FIRST_ORDER_SCENES.welcome;
  if(graphicIntroPending(state)&&f.requirements?.readyToAdvance&&f.wiringValid&&j.seen?.wiring)return null;
  const candidates=[['welcome',true],['client',f.claimed],['wiring',f.requirements?.readyToAdvance&&!requirementStageHandoffPending(state,'blocks')],['lamp',!graphicIntroFor(state)&&f.wiringValid&&f.requirements?.readyToAdvance],['reading',guidedOutputComplete(state)],['branch',experiencedFact(state,'current_input_read_observed')],['repeat',experiencedFact(state,'dark_branch_observed')&&experiencedFact(state,'bright_branch_observed')],['base',f.baseReady&&!f.hasCode],['change',f.hasCode],['code',f.changeRequirements?.readyToAdvance&&!requirementStageHandoffPending(state,'short-cpp')],['delivery',f.codeReady&&!f.incomeRecorded]];
  const id=candidates.find(([id,eligible])=>eligible&&!j.seen?.[id])?.[0];if(!id)return null;
  if(graphicIntroFor(state)?.phase==='complete'&&id==='reading')return {...FIRST_ORDER_SCENES.reading,title:'回到完整原型工位',lines:['开关、顺序和两次亲手读取都保留了。接下来把这些动作接进完整原型，让它自己继续回应环境。','这里会展开完整程序的入口和记录位置。先把读取安排进去，再接明暗判断与连续变化。局部练习留在工位，可以随时回看。']};
  if(id==='code'&&f.learning?.checkpoints?.some(c=>c.id==='code-mapping'&&c.state==='observed'))return {...FIRST_ORDER_SCENES.code,lines:['刚才你找到了本人积木里的比较，也确认了要从这处修改。代码工位已经把这行留在旁边。','把450改成600，再让客户试这份新代码。这里不用重新选一次同样的比较，旧作品也会保留。']};
  return FIRST_ORDER_SCENES[id];
}
/** A real result stays visible until the learner explicitly opens its next scene. */
export function pendingStoryResult(state){const scene=eligibleStoryScene(state);return scene?resultForStory(state,scene.id):null;}
export function currentStoryScene(state){const scene=eligibleStoryScene(state);return scene&&!resultForStory(state,scene.id)?scene:null;}
export function introducedTools(state){
  const f=state.facts,j=state.attempt?.presentation?.journey;
  if(j?.version!==JOURNEY_VERSION)return ['desk','mail','wiring','blocks','code','tests','income'];
  return ['desk',...(j.seen?.welcome?['mail']:[]),...(f.requirements?.readyToAdvance?['wiring']:[]),...(f.requirements?.readyToAdvance&&f.wiringValid?['blocks']:[]),...(f.hasCode?['code']:[]),...(state.attempt.tests.length?['tests']:[]),...(f.incomeRecorded?['income']:[])];
}
export const lockedToolReason={mail:'先和林工完成报到，再一起收客户来信。',wiring:'先和林工看懂客户桌面的变化，再到这里接线。',blocks:'先接好输入和灯的回路，再来亲手点亮。',code:'保留自己的基础积木作品后，林工会介绍文字代码。',tests:'第一次给客户演示之后，可以在这里回看结果。',income:'完成软件交付后，这里会收到客户回信。'};
export function currentWorkTool(state){
  return ({onboarding:'desk','claim-order':'mail',requirements:'mail',wiring:'wiring',blocks:'blocks','customer-change':'blocks','change-review':'mail','short-cpp':'code','software-income':'code','software-complete':'income'})[state.stage]??'desk';
}
