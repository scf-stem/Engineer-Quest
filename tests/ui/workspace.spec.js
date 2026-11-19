import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join,prepareCode,complete,tool,read} from './helpers.js';

test('controller-bound shell restores identity, three real reports, source and idempotent income',async({page})=>{
  await page.setViewportSize({width:1440,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await complete(page);const before=await read(page);expect(before.tests).toHaveLength(3);expect(before.tests.map(t=>t.passed)).toEqual([true,false,true]);await page.screenshot({path:test.info().outputPath('bound-income.png')});await page.reload();await expect(page.getByTestId('personal-income')).toHaveText('100 EC');const restored=await read(page);expect(restored.learnerId).toBe(before.learnerId);expect(restored.attemptId).toBe(before.attemptId);expect(restored.tests).toEqual(before.tests);expect(restored.codeReady).toBe(true);expect(restored.source).toContain('600');await expect(page.getByRole('button',{name:'再次请求本机入账（验证去重）',exact:true})).toHaveCount(0);await tool(page,'code').click();await expect(page.getByRole('textbox',{name:'当前简写 C++',exact:true})).toHaveValue(restored.source);const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前候选 .ino',exact:true}).click();expect(await readFile(await(await downloading).path(),'utf8')).toContain('_eqv_threshold = 600');await page.screenshot({path:test.info().outputPath('bound-restored-code.png')});await tool(page,'blocks').click();await expect(page.locator('.blocklySvg').first()).toBeVisible();await page.screenshot({path:test.info().outputPath('bound-blocks-sidebar.png')});await expect.poll(async()=>(await read(page)).codeReady).toBe(true);expect((await read(page)).tests).toEqual(restored.tests);expect(errors).toEqual([]);
});

test('restart preserves historical attempts and income, resume retains original learner',async({page})=>{
  await complete(page);const original=await read(page);await tool(page,'desk').click();await page.getByRole('button',{name:/本地工位/}).click();await page.getByRole('button',{name:'保留历史，重开本单',exact:true}).click();await expect(page.getByRole('region',{name:'当前目标'})).toHaveAttribute('data-goal-id','claim-order');const restarted=await read(page);expect(restarted.learnerId).toBe(original.learnerId);expect(restarted.attemptId).not.toBe(original.attemptId);expect(restarted.income).toBe(100);expect(restarted.tests).toHaveLength(0);await page.reload();await expect(page.getByRole('region',{name:'当前目标'})).toHaveAttribute('data-goal-id','claim-order');await page.getByRole('button',{name:/本地工位/}).click();await page.getByRole('button',{name:/订单尝试 1 · 3 次测试/}).click();await expect.poll(async()=>(await read(page)).attemptId).toBe(original.attemptId);expect((await read(page)).learnerId).toBe(original.learnerId);expect((await read(page)).codeReady).toBe(true);await tool(page,'income').click();await expect(page.getByTestId('personal-income')).toHaveText('100 EC');
});

test('save failure keeps exact typed input, exports it and retries before restoring readiness',async({page})=>{
  await prepareCode(page);const editor=page.getByRole('textbox',{name:'当前简写 C++',exact:true}),changed=(await editor.inputValue()).replace('450','601')+'\n// 本页未保存的输入';await page.getByRole('button',{name:'测试注入：下一次保存失败',exact:true}).click();await editor.fill(changed);await expect(page.getByRole('alert').filter({hasText:'本页输入保留'})).toBeVisible();await expect(editor).toHaveValue(changed);await expect(page.getByRole('button',{name:'运行变更客户测试',exact:true})).toBeDisabled();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出本页备份',exact:true}).click();const backup=JSON.parse(await readFile(await(await downloading).path(),'utf8'));expect(backup.bufferedDraft.shortSource).toBe(changed);await page.screenshot({path:test.info().outputPath('bound-save-failure.png')});await page.getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.locator('.eq-game-storage-alert')).toHaveCount(0);await page.reload();await expect(editor).toHaveValue(changed);expect((await read(page)).storage).toBe('restored');
});

test('another browser page cannot silently overwrite and explicit reread resolves conflict',async({page,context})=>{
  await prepareCode(page);const other=await context.newPage();await other.goto('/tests/ui/workspace.html');const editA=page.getByRole('textbox',{name:'当前简写 C++',exact:true}),editB=other.getByRole('textbox',{name:'当前简写 C++',exact:true});await editB.waitFor();const source=(await editA.inputValue()).replace('450','600');await editA.fill(source);await expect(other.locator('.eq-game-storage-alert')).toContainText('另一页面');await editB.fill(source+'\n// 冲突页保留');await expect(editB).toHaveValue(source+'\n// 冲突页保留');await other.getByRole('button',{name:'重新读取（放弃本页未保存修改）',exact:true}).click();await expect(editB).toHaveValue(source);await expect(other.locator('.eq-game-storage-alert')).toHaveCount(0);await other.close();
});

test('mobile bound work keeps inputs when switching tools and closing manual',async({page})=>{
  await page.setViewportSize({width:390,height:844});await prepareCode(page);const editor=page.getByRole('textbox',{name:'当前简写 C++',exact:true}),source=await editor.inputValue();await editor.fill(source.replace('450','600'));await expect(page.getByRole('button',{name:'检查当前代码',exact:true})).toBeEnabled();await page.getByRole('button',{name:'打开工程手册',exact:true}).click();await page.keyboard.press('Escape');await expect(editor).toHaveValue(source.replace('450','600'));await tool(page,'desk').click();await tool(page,'code').click();await expect(editor).toHaveValue(source.replace('450','600'));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath('bound-mobile.png')});
});

test('receipt notes use the same recoverable input buffer and do not invalidate delivery',async({page})=>{
  await complete(page);const note=page.getByRole('textbox',{name:'给自己的工程便签',exact:true});
  await page.getByRole('button',{name:'测试注入：下一次保存失败',exact:true}).click();
  await note.fill('我先看到一次错误');await expect(page.getByRole('alert').filter({hasText:'本页输入保留'})).toBeVisible();
  const latest='我先看到一次错误，再改比较并复测。这是保存故障后继续输入的完整便签。';await note.fill(latest);await expect(note).toHaveValue(latest);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出本页备份',exact:true}).click();
  const backup=JSON.parse(await readFile(await(await downloading).path(),'utf8'));expect(backup.bufferedDraft.support.reflection).toBe(latest);
  await page.getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.locator('.eq-game-storage-alert')).toHaveCount(0);await page.reload();
  await expect(note).toHaveValue(latest);expect((await read(page)).codeReady).toBe(true);await expect(page.getByTestId('personal-income')).toHaveText('100 EC');
});
