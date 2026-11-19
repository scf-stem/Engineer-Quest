import {test, expect} from '@playwright/test';

const terminal = (page, id) => page.locator(`[data-terminal="${id}"]`);
const wireCount = async (page, count) => expect(page.locator('[data-wire]')).toHaveCount(count);
async function pointerDrag(page, from, to) {
  const a = await from.boundingBox(), b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {steps: 12});
  await page.mouse.up();
}
async function allComponentsInsideStage(page) {
  const stage = await page.locator('.eq-hw-stage').boundingBox();
  for (const id of ['uno', 'sensor', 'resistor', 'led']) {
    const component = await page.locator(`[data-component="${id}"]`).boundingBox();
    expect(component.x, `${id} left`).toBeGreaterThanOrEqual(stage.x - 1);
    expect(component.y, `${id} top`).toBeGreaterThanOrEqual(stage.y - 1);
    expect(component.x + component.width, `${id} right`).toBeLessThanOrEqual(stage.x + stage.width + 1);
    expect(component.y + component.height, `${id} bottom`).toBeLessThanOrEqual(stage.y + stage.height + 1);
  }
}

test.beforeEach(async ({page}) => { await page.goto('/src/hardware/demo.html'); });

test('actual pointer drag hits AO/A0 and supports one-step undo/redo', async ({page}) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await pointerDrag(page, terminal(page, 'sensor:AO').locator('circle').first(), terminal(page, 'uno:A0').locator('circle').first());
  await wireCount(page, 1);
  await expect(page.locator('[data-diagnostic-code="SENSOR_PIN_MISMATCH"]')).toHaveCount(0);
  await page.getByRole('button', {name: '↶ 撤销', exact: true}).click(); await wireCount(page, 0);
  await page.getByRole('button', {name: '↷ 重做', exact: true}).click(); await wireCount(page, 1);
  expect(errors).toEqual([]);
});

test('builds the complete circuit with pointer clicks and keyboard, then deleting ground invalidates it', async ({page}) => {
  for (const [from, to] of [['uno:5V','sensor:VCC'], ['uno:GND_1','sensor:GND'], ['uno:A0','sensor:AO'], ['uno:D9','resistor:1'], ['resistor:2','led:A'], ['led:K','uno:GND_2']]) {
    await terminal(page, from).focus(); await page.keyboard.press('Enter');
    await terminal(page, to).focus(); await page.keyboard.press('Enter');
  }
  await wireCount(page, 6);
  await expect(page.getByText('虚拟接线规则通过。下一步运行客户测试。')).toBeVisible();
  await page.getByText('连接清单', {exact: false}).click();
  await page.getByRole('button', {name: '删除连线 wire-2', exact: true}).click();
  await expect(page.locator('[data-diagnostic-code="SENSOR_GROUND_MISSING"]')).toBeVisible();
  await page.locator('[data-diagnostic-code="SENSOR_GROUND_MISSING"]').click();
  await expect(terminal(page, 'sensor:GND')).toBeFocused();
});

test('components move with actual pointer drag and arrow keys while preserving existing endpoints', async ({page}) => {
  await page.getByRole('button', {name: '载入参考接线', exact: true}).click();
  const before = await page.locator('[data-component="sensor"]').getAttribute('transform');
  const handle = page.locator('[data-component-handle="sensor"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 35, box.y + box.height / 2 + 50, {steps: 10}); await page.mouse.up();
  await expect(page.locator('[data-component="sensor"]')).not.toHaveAttribute('transform', before);
  await wireCount(page, 6); await expect(page.locator('.eq-hw-success')).toBeVisible();
  const moved = await page.locator('[data-component="sensor"]').getAttribute('transform');
  await handle.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-component="sensor"]')).not.toHaveAttribute('transform', moved);
  await page.getByRole('button', {name: '↶ 撤销', exact: true}).click();
  await expect(page.locator('[data-component="sensor"]')).toHaveAttribute('transform', moved);
});

test('wrong pin, duplicate wire and unhit drop give concrete feedback', async ({page}) => {
  await terminal(page, 'sensor:AO').locator('circle').first().click();
  await terminal(page, 'uno:A1').locator('circle').first().click();
  await wireCount(page, 1);
  await expect(page.locator('[data-diagnostic-code="SENSOR_PIN_MISMATCH"]')).toContainText('A0');
  await terminal(page, 'sensor:AO').focus(); await page.keyboard.press('Enter');
  await terminal(page, 'uno:A1').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('这两个端子已经相连。');
  await wireCount(page, 1);
  const pin = await terminal(page, 'led:A').locator('circle').first().boundingBox();
  await page.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2); await page.mouse.down(); await page.mouse.move(pin.x - 40, pin.y + 60); await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('未命中终点'); await wireCount(page, 1);
});

test('read only disables all mutation while preserving terminal inspection', async ({page}) => {
  await page.getByRole('button', {name: '载入参考接线', exact: true}).click();
  await page.getByLabel('只读模式', {exact: true}).check();
  await terminal(page, 'uno:A0').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.eq-hw-inspector')).toContainText('uno:A0');
  await terminal(page, 'sensor:AO').focus(); await page.keyboard.press('Enter'); await wireCount(page, 6);
  await expect(page.getByRole('button', {name: '清空连线', exact: true})).toBeDisabled();
  const handle = page.locator('[data-component-handle="led"]'), before = await page.locator('[data-component="led"]').getAttribute('transform');
  await handle.focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-component="led"]')).toHaveAttribute('transform', before);
  await expect(page.getByLabel('虚拟光照', {exact: false})).toBeDisabled();
});

test('mobile starts with all components in panorama and can enlarge the wiring canvas', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.getByRole('heading', {name: /把想法，接成电路/})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', {name: '查看全景', exact: true}).click();
  await allComponentsInsideStage(page);
  expect(await page.locator('.eq-hw-stage').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.getByRole('button', {name: '放大接线', exact: true}).click();
  expect(await page.locator('.eq-hw-stage').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await terminal(page, 'uno:A0').focus(); await page.keyboard.press('Enter');
  await terminal(page, 'sensor:AO').focus(); await page.keyboard.press('Enter'); await wireCount(page, 1);
});

test('external replacement clears undo history and cancelled gestures create no edits', async ({page}) => {
  await terminal(page, 'uno:A0').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  await terminal(page, 'sensor:AO').focus(); await page.keyboard.press('Enter'); await wireCount(page, 0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '载入参考接线', exact: true}).click();
  await expect(page.getByRole('button', {name: '↶ 撤销', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: '空白接线', exact: true}).click(); await wireCount(page, 0);
});

test('external A output is shown only with valid wiring and no external error', async ({page}) => {
  await page.goto('/tests/hardware/props.html');
  await expect(page.locator('.eq-hw-led')).toHaveClass(/is-on/);
  await page.getByRole('button', {name: 'Invalidate output', exact: true}).click();
  await expect(page.locator('.eq-hw-led')).not.toHaveClass(/is-on/);
  await expect(page.locator('[data-diagnostic-code="A_STALE_OUTPUT"]')).toBeVisible();
  await page.reload();
  await page.getByRole('button', {name: 'Invalidate wiring', exact: true}).click();
  await expect(page.locator('.eq-hw-led')).not.toHaveClass(/is-on/);
  await expect(page.locator('[data-diagnostic-code="SENSOR_POWER_MISSING"]')).toBeVisible();
});

test('additional warnings from integration remain visible', async ({page}) => {
  await page.goto('/tests/hardware/props.html');
  await page.getByRole('button', {name: 'External warning', exact: true}).click();
  await expect(page.locator('[data-diagnostic-code="A_WARNING"]')).toHaveText('来自集成层的合成警告。');
  await expect(page.locator('.eq-hw-success')).toBeVisible();
});

test('zero-wire valid document is neutral and does not display a validation pass', async ({page}) => {
  await expect(page.locator('.eq-hw-state')).toContainText('待连接');
  await expect(page.locator('.eq-hw-state')).not.toContainText('待修复');
  await expect(page.locator('.eq-hw-terminal.has-error')).toHaveCount(0);
  await expect(page.locator('.eq-hw-diagnostics li')).toHaveCount(0);
  await expect(page.locator('.eq-hw-pending')).toBeVisible();
  await expect(page.locator('.eq-hw-success')).toHaveCount(0);
  await expect(page.locator('.eq-hw-led')).not.toHaveClass(/is-on/);
});

test('external errors and unknown zero-wire structure cannot be hidden by neutral presentation', async ({page}) => {
  await page.goto('/tests/hardware/props.html');
  await page.getByRole('button', {name: 'Blank external error', exact: true}).click();
  await expect(page.locator('.eq-hw-state')).toContainText('待修复');
  await expect(page.getByText('外部检查要求处理公共地。', {exact: true})).toBeVisible();
  await expect(page.locator('.eq-hw-terminal.has-error')).not.toHaveCount(0);
  await page.getByRole('button', {name: 'Unknown schema', exact: true}).click();
  await expect(page.locator('[data-diagnostic-code="WIRING_SCHEMA_INVALID"]')).toBeVisible();
  await expect(page.locator('.eq-hw-state')).not.toContainText('待连接');
});

test('actual 5V to GND short stays an explicit error from a blank document', async ({page}) => {
  await terminal(page, 'uno:5V').focus(); await page.keyboard.press('Enter');
  await terminal(page, 'uno:GND_1').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-diagnostic-code="POWER_SHORT"]')).toBeVisible();
  await expect(page.locator('.eq-hw-state')).toContainText('待修复');
  await expect(page.locator('.eq-hw-terminal.has-error')).not.toHaveCount(0);
});

test('1265px desktop adapts to a 680px nested container and scaled pointer hits remain exact', async ({page}) => {
  await page.setViewportSize({width: 1265, height: 950});
  await page.goto('/tests/hardware/props.html?nested');
  const root = await page.locator('.eq-hardware').boundingBox();
  expect(root.width).toBeLessThan(700);
  const main = await page.locator('.eq-hw-main').boundingBox(), sidebar = await page.locator('.eq-hw-sidebar').boundingBox();
  expect(main.width).toBeGreaterThan(root.width - 4);
  expect(sidebar.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
  await allComponentsInsideStage(page);
  await page.getByRole('button', {name: 'Blank document', exact: true}).click();
  await pointerDrag(page, terminal(page, 'sensor:AO').locator('circle').first(), terminal(page, 'uno:A0').locator('circle').first());
  await wireCount(page, 1);
  await expect(page.locator('[data-diagnostic-code="SENSOR_PIN_MISMATCH"]')).toHaveCount(0);
});

test('zoom has visible pan buttons; error focus reveals the exact target and panorama restores every part', async ({page}) => {
  await page.setViewportSize({width: 1265, height: 950});
  await page.goto('/tests/hardware/props.html?nested');
  await page.getByRole('button', {name: '放大接线', exact: true}).click();
  await expect(page.getByRole('button', {name: '放大接线', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: '向右查看 →', exact: true}).click();
  expect(await page.locator('.eq-hw-stage').evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('button', {name: 'Invalidate wiring', exact: true}).click();
  await page.locator('[data-diagnostic-code="SENSOR_POWER_MISSING"]').click();
  await expect(terminal(page, 'sensor:VCC')).toBeFocused();
  const stage = await page.locator('.eq-hw-stage').boundingBox(), pin = await terminal(page, 'sensor:VCC').boundingBox();
  expect(pin.x).toBeGreaterThanOrEqual(stage.x);
  expect(pin.x + pin.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(pin.y).toBeGreaterThanOrEqual(0);
  expect(pin.y + pin.height).toBeLessThanOrEqual(950);
  await page.getByRole('button', {name: '查看全景', exact: true}).click();
  await allComponentsInsideStage(page);
  await wireCount(page, 5);
});
