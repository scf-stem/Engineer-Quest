import {test,expect} from '@playwright/test';
import {join,claim,tool,read,setRequirementQuestion} from './game-helpers.js';
import {restoreRecordedWorkspace} from './recorded-workspace.js';

test('branch instruction remains while edited evidence needs explicit rerun; actual failures remain independent',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await restoreRecordedWorkspace(page,{atBranches:true});
  const practice=page.getByRole('region',{name:'当前编程练习',exact:true});
  await expect(practice.getByRole('heading',{name:'让两个分支给出不同动作',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'查看完整积木',exact:true}).click();
  await page.locator('.blocklyWorkspace .blocklyText').filter({hasText:/^450$/}).dblclick();
  await page.locator('.blocklyHtmlInput').fill('451');await page.locator('.blocklyHtmlInput').press('Enter');
  await expect(practice.getByRole('button',{name:'用当前作品复核：读取并观察一个当前值',exact:true})).toBeVisible();
  await expect(practice.getByRole('heading',{name:'让两个分支给出不同动作',exact:true})).toBeVisible();
  expect((await read(page)).practice.validationId).toBe('read-input');expect((await read(page)).practice.teachingId).toBe('branch-output');
  await expect(page.getByRole('button',{name:'运行基础客户测试',exact:true})).toBeDisabled();
  await page.screenshot({path:test.info().outputPath('branch-position-retained.png')});
  await practice.getByRole('button',{name:'用当前作品复核：读取并观察一个当前值',exact:true}).click();
  await page.getByRole('button',{name:'观察暗场景 · 光照 150',exact:true}).click();
  await page.getByRole('button',{name:'观察亮场景 · 光照 850',exact:true}).click();
  const observation=page.getByRole('region',{name:'程序实际观察',exact:true});
  await expect(observation).toContainText('850');await expect(observation).toContainText('LED 灭');await expect(observation).toContainText('假 → 否则');
  await page.getByRole('button',{name:'运行暗 → 亮 → 暗，查看三次读取',exact:true}).click();
  await observation.getByRole('button',{name:'100 ms',exact:true}).click();await expect(observation).toContainText('850');
  await page.getByRole('checkbox',{name:'减少动效',exact:true}).check();await expect(observation.getByRole('button',{name:'重放这次变化',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'运行当前基础客户测试',exact:true}).click();
  await expect(practice).toContainText('期望灭，实际亮');expect((await read(page)).baseReady).toBe(false);
  await page.screenshot({path:test.info().outputPath('same-screen-real-failure.png')});
});

test('scene manipulation gets in-place mentor response without granting progress',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await join(page);await claim(page);
  const practice=page.getByRole('region',{name:'客户需求情境练习',exact:true});
  await practice.getByRole('button',{name:'遮住光源，再看读数',exact:true}).click();
  await expect(practice).toContainText('表从 850 变成 150');expect((await read(page)).requirementsReady).toBe(false);

  await setRequirementQuestion(page,'我完全不懂，随便选的。');
  await practice.locator('[data-option-id="current-light"]').click();
  await expect(practice.locator('.eq-stage-heading')).toContainText('1 / 6 / 窗边与阴影');await expect(practice).toContainText('求助不会失去继续资格');await expect.poll(async()=>(await read(page)).requirementsScene.reviewStatus).toBe('needs-help');
  expect((await read(page)).requirementsReady).toBe(false);
  await page.screenshot({path:test.info().outputPath('mentor-scene-desktop.png')});
});

test('component manual labels match full-text anchors; player delivery has customer feedback and useful next actions',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await restoreRecordedWorkspace(page);
  await tool(page,'wiring').click();
  for(const [name,section,title]of [['光照模块','05.1','光照模块资料'],['LED 指示灯','05.2','LED 与限流元件']]){
    await page.getByRole('button',{name:`移动 ${name}（方向键可微调）`,exact:true}).click();
    await page.getByRole('button',{name:`手册 §${section} · 元件资料 ↗`,exact:true}).click();
    await expect(page.getByRole('article').getByRole('heading',{name:new RegExp(section+'.*'+title)})).toBeVisible();
    await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
  }
  await tool(page,'income').click();const receipt=page.getByRole('region',{name:'首单交付回信',exact:true});
  await expect(receipt).toContainText('首单软件演示已交付');await expect(receipt).toContainText('客户回信');
  await expect(receipt).not.toContainText('去重');await expect(receipt).not.toContainText('evidence-');
  await expect(page.getByRole('button',{name:'回研发室，整理这次作品 →',exact:true})).toBeVisible();
  await receipt.getByRole('textbox',{name:'给自己的工程便签',exact:true}).fill('我修过边界，再用客户场景验证。');
  await expect.poll(async()=>(await read(page)).storage).toBe('saved');await page.reload();
  await expect(page.getByRole('textbox',{name:'给自己的工程便签',exact:true})).toHaveValue('我修过边界，再用客户场景验证。');
  await expect(page.getByTestId('personal-income')).toHaveText('100 EC');await page.screenshot({path:test.info().outputPath('player-receipt-desktop.png')});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('player-receipt-mobile.png')});
});
