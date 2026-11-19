import {test,expect} from '@playwright/test';
import {join,claim,tool,read,requirements,setRequirementQuestion,answerScene,finishStory} from './game-helpers.js';

test('real current scenarios reject self-reported guessing and restore six original responses',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await join(page);await claim(page);

  await setRequirementQuestion(page,'我完全不懂，随便选的。');
  await page.locator('[data-option-id="current-light"]').click();
  await expect(page.locator('.eq-requirement-stage')).toHaveAttribute('data-stage-response','retry');await expect.poll(async()=>(await read(page)).requirementsScene.reviewStatus).toBe('needs-help');
  expect((await read(page)).requirementsScene.validationCheckpointId).toBe('req-light-input');
  expect((await read(page)).requirementsReady).toBe(false);
  await tool(page,'code').click();
  await expect(page.locator('.eq-stage-heading')).toContainText('1 / 6 / 窗边与阴影');
  await requirements(page);await page.reload();
  await expect(page.locator('.eq-hardware')).toBeVisible();
  expect((await read(page)).requirementsReady).toBe(true);expect((await read(page)).stage).toBe('wiring');
  expect((await read(page)).income).toBe(0);
  await expect(page.getByRole('button',{name:'领取本机个人员工证 →',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('real final requirement feedback waits for explicit continue, including refresh and manual focus suspension',async({page})=>{
  await join(page,'最后反馈交接');await claim(page);
  for(const id of ['current-light','lamp-on','lamp-off','read-decide-repeat','lamp-off'])await answerScene(page,id);
  await page.locator('[data-option-id="trace-b"]').click();await expect.poll(async()=>(await read(page)).requirementsReady).toBe(true);
  const stage=page.locator('.eq-requirement-stage');await expect(stage).toHaveAttribute('data-stage-response','accepted');
  await expect(stage).toHaveAttribute('data-checkpoint-id','req-transfer-sequence');await expect(page.locator('[data-story-scene="wiring"]')).toHaveCount(0);
  expect((await read(page)).requirementsScene.handoffPending).toBe(true);
  await page.reload();await expect(stage).toHaveAttribute('data-stage-response','accepted');await expect(page.locator('[data-story-scene="wiring"]')).toHaveCount(0);
  await stage.getByRole('button',{name:/一起翻手册/}).click();await expect(stage).toHaveAttribute('data-focus-target','suspended');await expect(stage.locator('[data-current-focus=true]')).toHaveCount(0);
  await page.getByRole('button',{name:'关闭对话框',exact:true}).click();await expect(stage).toHaveAttribute('data-focus-target','continue');await expect(stage.locator('[data-current-focus=true]')).toHaveCount(1);
  await page.screenshot({path:test.info().outputPath('final-feedback-before-wiring.png'),animations:'disabled'});
  await stage.locator('[data-scene-continue]').click();await expect(page.locator('[data-story-scene="wiring"]')).toBeVisible();await finishStory(page);
  await expect(page.locator('.eq-hardware')).toBeVisible();expect((await read(page)).income).toBe(0);
});
