import {test,expect} from '@playwright/test';
test('local learning flow, real Blockly, code and invalidation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/legacy.html');
 await page.getByPlaceholder('不需要真实姓名').fill('测试员工');
 await page.getByText('登记并领取任务 →').click();
 for(const label of ['输入信息','判断规则','变亮以后','运行方式'])await page.getByLabel(label,{exact:true}).selectOption({index:1});
 await page.getByLabel('用自己的话说明一次从暗到亮的过程').fill('光敏变亮后关灯，再持续检查。');
 await page.getByText('提交需求卡，和 NPC 评审').click();
 await page.getByText('进入接线台 →').click();
 for(const [a,b] of [['UNO.5V','SENSOR.VCC'],['UNO.GND','SENSOR.GND'],['UNO.A0','SENSOR.AO'],['UNO.D9','R.1'],['R.2','LED.A'],['LED.K','UNO.GND']]){
 await page.getByLabel('起点',{exact:true}).selectOption(a);await page.getByLabel('终点',{exact:true}).selectOption(b);await page.getByText('添加连线',{exact:true}).click();}
 await expect(page.getByText('接线规则检查通过',{exact:true})).toBeVisible();
 await page.getByText('进入积木编程 →').click();
 await expect(page.locator('.blocklySvg')).toBeVisible();
 await page.getByText('运行行为测试',{exact:true}).click();
 await expect(page.getByText('虚拟行为通过',{exact:true})).toBeVisible();
 await page.getByText('保存快照，进入轻代码 →').click();
 const area=page.locator('.code');const source=await area.inputValue();await area.fill(source.replace('< 450','< 500'));
 await page.getByText('解析并应用代码',{exact:true}).click();
 await page.getByText('运行行为测试',{exact:true}).click();
 await expect(page.getByText('需要修改',{exact:true})).toBeVisible();
 await area.fill(source.replace('delay(100)','delay(150)'));
 await page.getByText('解析并应用代码',{exact:true}).click();
 await page.getByText('运行行为测试',{exact:true}).click();
 await expect(page.getByText('虚拟行为通过',{exact:true})).toBeVisible();
 await page.getByText('准备真机交付 →').click();
 await expect(page.getByText('实物状态：未验证 · 不自动通关',{exact:true})).toBeVisible();
 await expect(page.getByText('导出当前 .ino 源码',{exact:true})).toBeEnabled();
 const downloadPromise=page.waitForEvent('download');await page.getByText('导出当前 .ino 源码',{exact:true}).click();expect((await downloadPromise).suggestedFilename()).toBe('EngineerQuest_light.ino');
 await page.getByRole('button',{name:/03.*虚拟接线/}).click();await page.getByLabel('删除连线 1',{exact:true}).click();
 await page.getByRole('button',{name:/06.*真机交付/}).click();await expect(page.getByText('导出当前 .ino 源码',{exact:true})).toBeDisabled();
 expect(errors).toEqual([]);
});
