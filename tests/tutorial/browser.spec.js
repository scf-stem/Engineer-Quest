import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import requirementHelpFacts from './fixtures/requirement-needs-help.json' with {type:'json'};
const url='/src/tutorial/demo.html';
const evidence='docs/tutorial/evidence';
const state=page=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const pause=page=>page.getByRole('button',{name:'暂停对话，回到操作',exact:true}).click();
const talk=page=>page.getByRole('button',{name:/^和林工聊聊/}).click();
const skip=page=>page.getByRole('button',{name:'跳过说明，去操作',exact:true}).click();
async function capture(page,name){await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/${name}.png`,fullPage:false});await writeFile(`${evidence}/${name}.json`,JSON.stringify(await state(page),null,2)+'\n');}
async function claim(page){await pause(page);await page.getByRole('button',{name:'领取订单',exact:true}).click();}
async function plan(page){
  await page.getByRole('button',{name:'中文方案',exact:true}).click();
  for(const [label,value]of Object.entries({'装置读取什么':'light-sensor','按什么规则判断':'below-customer-threshold','明暗分别怎样做':'dark-on-bright-off','演示过程中怎样工作':'repeat-read-decide'}))await page.getByLabel(label,{exact:true}).selectOption(value);
  await page.getByLabel('用自己的话说明一次从暗到亮、再变暗的过程').fill('每轮重新看光照，暗时开灯，亮时关灯；再次变暗还会开灯。');
  await page.getByRole('button',{name:'保存当前中文方案',exact:true}).click();
}
async function wire(page,a,b){for(const id of [a,b]){await page.locator(`[data-terminal="${id}"]`).focus();await page.keyboard.press('Enter');}}
test('typewriter, repeated clicks, pause/reopen, review, skip and real operation continuation',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:900});await page.goto(url);
  const stage=page.locator('.eq-tutor-stage');await expect(stage).toHaveAttribute('data-line','meet');
  await page.locator('.eq-tutor-next').click();await expect(stage).toHaveAttribute('data-line','meet');
  await page.waitForTimeout(250);await page.locator('.eq-tutor-next').dblclick({delay:10});await expect(stage).toHaveAttribute('data-line','client');
  await pause(page);await talk(page);await expect(stage).toHaveAttribute('data-line','client');
  await page.getByRole('button',{name:'重看本节',exact:true}).click();await expect(stage).toHaveAttribute('data-line','meet');
  await page.getByLabel('整句显示',{exact:true}).check();await capture(page,'dialogue-desktop');
  await skip(page);await expect(stage).toHaveAttribute('data-line','task');
  for(let i=0;i<3;i++)await page.locator('.eq-tutor-text').dispatchEvent('click');
  expect((await state(page)).claimed).toBe(false);expect((await state(page)).income).toBe(0);
  await page.getByRole('button',{name:/^去邮箱领取订单/}).click();await page.getByRole('button',{name:'领取订单',exact:true}).click();await talk(page);
  await expect(stage).toHaveAttribute('data-lesson','plan');
  await page.waitForTimeout(250);await page.locator('.eq-tutor-next').click();await expect(stage).toHaveAttribute('data-line','repeat');
  await page.getByRole('button',{name:'够用，第一次已经知道明暗',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'第一次读数'})).toBeVisible();await expect(page.locator('.eq-tutor-next')).toBeDisabled();
  await page.getByRole('button',{name:'不够，要重新读取并判断',exact:true}).click();await page.waitForTimeout(250);await page.locator('.eq-tutor-next').click();await expect(stage).toHaveAttribute('data-line','save');
  expect((await state(page)).cardSaved).toBe(false);await pause(page);await plan(page);await talk(page);await expect(stage).toHaveAttribute('data-lesson','wiring');
  await page.getByRole('button',{name:'对话记录',exact:true}).click();await page.getByRole('button',{name:'先说明装置怎样工作',exact:true}).click();await expect(stage).toHaveAttribute('data-lesson','plan');await expect(page.getByText('重看不改变工程状态。')).toBeVisible();await page.getByRole('button',{name:'返回当前任务',exact:true}).click();await expect(stage).toHaveAttribute('data-lesson','wiring');
  expect(errors).toEqual([]);
});
test('real wiring diagnostics, assisted Blockly, failed/new test evidence, stale results and idempotent income',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto(url);await claim(page);await plan(page);
  await page.getByRole('button',{name:'接线',exact:true}).click();await wire(page,'uno:5V','uno:GND_1');await talk(page);await skip(page);await expect(page.locator('.eq-tutor-task')).toContainText('POWER_SHORT');await expect(page.locator('.eq-tutor-text')).toContainText('电源与地落在同一个网络');await capture(page,'wiring-feedback');await pause(page);await page.getByRole('button',{name:'↶ 撤销',exact:true}).click();
  for(const [a,b]of [['uno:5V','sensor:VCC'],['uno:GND_1','sensor:GND'],['uno:A0','sensor:AO'],['uno:D9','resistor:1'],['resistor:2','led:A'],['led:K','uno:GND_2']])await wire(page,a,b);
  await expect(page.locator('.eq-hw-state')).toContainText('接线规则通过');await talk(page);await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-lesson','blocks');await pause(page);
  await page.getByRole('button',{name:'积木',exact:true}).click();await expect(page.getByRole('button',{name:'运行基础客户测试',exact:true})).toBeDisabled();await page.getByRole('button',{name:'加载教学示例（记录协助）',exact:true}).click();await page.getByRole('button',{name:'运行基础客户测试',exact:true}).click();await expect.poll(async()=>(await state(page)).basePassed).toBe(true);
  await talk(page);await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-lesson','handover');await pause(page);await page.getByRole('button',{name:'保存积木快照，查看代码变更',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'当前简写 C++',exact:true}),original=await editor.inputValue();expect(original).toContain('450');await page.getByRole('button',{name:'解析并应用代码',exact:true}).click();await page.getByRole('button',{name:'运行变更客户测试',exact:true}).click();await expect.poll(async()=>(await state(page)).codeCurrent).toBe(true);expect((await state(page)).codePassed).toBe(false);
  await talk(page);await skip(page);await expect(page.locator('.eq-tutor-text')).toContainText('客户期望灯亮，实际灭');await capture(page,'test-failure-feedback');await pause(page);await editor.fill(original.replace('450','600'));await page.getByRole('button',{name:'解析并应用代码',exact:true}).click();await page.getByRole('button',{name:'运行变更客户测试',exact:true}).click();await expect.poll(async()=>(await state(page)).codePassed).toBe(true);
  await talk(page);await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-lesson','delivery');await page.getByLabel('整句显示',{exact:true}).check();await capture(page,'software-delivery');await skip(page);expect((await state(page)).income).toBe(0);await pause(page);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出候选 .ino',exact:true}).click();expect((await download).suggestedFilename()).toContain('.ino');
  await page.getByRole('button',{name:'请求合成软件收入',exact:true}).click();await page.getByRole('button',{name:'请求合成软件收入',exact:true}).click();await expect(page.getByTestId('tutorial-income')).toHaveText('100 EC');await talk(page);await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-lesson','done');await pause(page);
  await page.getByRole('button',{name:'接线',exact:true}).click();await page.locator('.eq-hw-wire-list > summary').click();await page.getByRole('button',{name:'删除连线 wire-2',exact:true}).click();await page.getByRole('button',{name:'↶ 撤销',exact:true}).click();
  await talk(page);await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-lesson','change');await skip(page);await expect(page.locator('.eq-tutor-text')).toContainText('修改前的作品');expect((await state(page)).income).toBe(100);await pause(page);await page.getByRole('button',{name:'代码',exact:true}).click();await expect(page.getByRole('button',{name:'请求合成软件收入',exact:true})).toBeDisabled();
  await page.reload();await pause(page);expect((await state(page)).cardSaved).toBe(false);expect((await state(page)).codeCurrent).toBe(false);expect((await state(page)).income).toBe(0);await page.getByRole('button',{name:'中文方案',exact:true}).click();await expect(page.getByLabel('装置读取什么',{exact:true})).toHaveValue('light-sensor');
  expect(errors).toEqual([]);await writeFile(`${evidence}/flow-errors.json`,JSON.stringify(errors));
});
test('mobile, keyboard focus, reduced motion and persisted teaching position',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);await expect(page.locator('.eq-tutor-next')).toContainText('下一句');
  await expect(page.getByRole('button',{name:'暂停对话，回到操作',exact:true})).toBeFocused();await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('dialog'))).toBe(true);
  await page.locator('.eq-tutor-next').click();await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-line','client');await page.reload();await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-line','client');await capture(page,'dialogue-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await talk(page);await expect(page.locator('.eq-tutor-stage')).toHaveAttribute('data-line','client');await skip(page);await capture(page,'mobile-operation-goal');
  await page.setViewportSize({width:844,height:390});await capture(page,'dialogue-short-landscape');await expect(page.getByRole('button',{name:/^去邮箱领取订单/})).toBeInViewport();
});
test('learner memory scope and inline observers cannot leak reading position or loop',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await pause(page);
  await page.evaluate(async()=>{
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {NpcTutorial}=await import('/src/tutorial/NpcTutorial.jsx');
    const node=document.createElement('div');node.id='scope-probe';document.body.append(node);
    function Probe(){
      const [scope,setScope]=React.useState('one'),[observed,setObserved]=React.useState(null);
      window.switchTutorialScope=setScope;
      return React.createElement('div',null,React.createElement('output',{id:'scope-observed'},JSON.stringify(observed)),React.createElement(NpcTutorial,{facts:{joined:true,claimed:false},storageKey:'npc-scope:'+scope,open:true,showLauncher:false,onStateChange:value=>setObserved(value)}));
    }
    ReactDOM.createRoot(node).render(React.createElement(Probe));
  });
  const probe=page.locator('#scope-probe');await expect(probe.locator('.eq-tutor-stage')).toHaveAttribute('data-line','meet');await probe.getByRole('button',{name:'跳过说明，去操作',exact:true}).click();
  await expect(probe.locator('.eq-tutor-stage')).toHaveAttribute('data-line','task');
  await page.evaluate(()=>window.switchTutorialScope('two'));await expect(probe.locator('.eq-tutor-stage')).toHaveAttribute('data-line','meet');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('npc-scope:one')).slots.welcome.index)).toBe(2);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('npc-scope:two')).slots.welcome)).toBeUndefined();
  await page.evaluate(()=>window.switchTutorialScope('one'));await expect(probe.locator('.eq-tutor-stage')).toHaveAttribute('data-line','task');await expect(page.locator('#scope-observed')).toContainText('"line":"task"');expect(errors).toEqual([]);
});
test('actual D help projection renders scene and local observation and returns only navigation intent',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto(url);await pause(page);
  await page.evaluate(async summary=>{
    const {default:React}=await import('/node_modules/.vite/deps/react.js'),{default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {NpcTutorial}=await import('/src/tutorial/NpcTutorial.jsx');const node=document.createElement('div');node.id='requirement-probe';document.body.append(node);
    function Probe(){const [open,setOpen]=React.useState(true);return React.createElement(NpcTutorial,{facts:{joined:true,claimed:true,cardSaved:true,wiringValid:true,requirementReview:summary},open,onOpenChange:setOpen,showLauncher:false,storageKey:null,onNavigate:(stage,intent)=>{window.npcProjectionNavigation={stage,intent};}});}
    ReactDOM.createRoot(node).render(React.createElement(Probe));
  },requirementHelpFacts);
  const probe=page.locator('#requirement-probe');await probe.getByRole('button',{name:'跳过说明，去操作',exact:true}).click();
  await expect(probe.locator('.eq-tutor-stage')).toHaveAttribute('data-lesson','plan');await expect(probe.locator('.eq-tutor-checkpoint')).toContainText('情境 1 / 6');await expect(probe.locator('.eq-tutor-task')).toContainText(requirementHelpFacts.challenge.scene.description);await expect(probe.getByRole('region',{name:'局部观察'})).toContainText(requirementHelpFacts.guidance.tryThis);
  await page.screenshot({path:`${evidence}/requirement-guidance-desktop.png`});await page.setViewportSize({width:390,height:844});const action=probe.getByRole('button',{name:/^去做小观察并重试/});await action.focus();await action.scrollIntoViewIfNeeded();await expect(action).toBeInViewport();await page.screenshot({path:`${evidence}/requirement-guidance-mobile.png`});
  await action.click();await expect(probe.getByRole('dialog')).not.toBeVisible();
  const navigation=await page.evaluate(()=>window.npcProjectionNavigation);expect(navigation).toEqual({stage:'requirements',intent:{actionTarget:requirementHelpFacts.actionTarget,retryAction:requirementHelpFacts.retryAction,checkpointId:'req-light-input'}});expect((await state(page)).income).toBe(0);expect(errors).toEqual([]);
  await writeFile(`${evidence}/requirement-guidance.json`,JSON.stringify({source:'D actual requirementTutorialFacts(reviewRequirementAttempt(not-sure/need-help)); synthetic fixture',summary:requirementHelpFacts,navigation,errors},null,2)+'\n');
});
