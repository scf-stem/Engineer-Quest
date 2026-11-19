import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Isolated synthetic identity; this harness has no application storage or runtime.
const evidence = process.env.EDITOR_EVIDENCE_DIR ?? '/tmp/eq-teaching-editor';
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/Users/limou/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page = await browser.newPage({viewport: {width: 1280, height: 720}}), errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
const settle = () => page.waitForTimeout(220);
const graph = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const check = (name, condition) => {assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`);};
async function screenshot(name) {await page.screenshot({path: `${evidence}/${name}.png`});}
async function restore(kind, value) {
  await page.evaluate(({kind, value}) => window.editorTest.restore(value ?? window.editorTest.initial[kind], kind), {kind, value}); await settle();
}
async function point(blockId, port, flyout = false) {
  return page.evaluate(({blockId, port, flyout}) => {
    let w = window.editorTest.workspace(); if (flyout) w = w.getFlyout().getWorkspace();
    const block = flyout ? w.getTopBlocks(false).find(item => item.type === blockId || item.getFieldValue('BOOL') === blockId) : w.getBlockById(blockId);
    const connection = port === 'output' ? block.outputConnection : port === 'previous' ? block.previousConnection : port === 'next' ? block.nextConnection : block.getInput(port).connection;
    const offset = connection.getOffsetInBlock(), matrix = block.getSvgRoot().getScreenCTM(), tip = new DOMPoint(offset.x, offset.y).matrixTransform(matrix), box = block.getSvgRoot().getBoundingClientRect();
    return {x: tip.x, y: tip.y, grabX: box.x + Math.min(23, box.width / 3), grabY: box.y + 5};
  }, {blockId, port, flyout});
}
async function drag(fromId, port, toId, toPort, flyout = true, empty = null) {
  const from = await point(fromId, port, flyout), target = empty ?? await point(toId, toPort);
  await page.mouse.move(from.grabX, from.grabY); await page.mouse.down();
  await page.mouse.move(from.grabX + 9, from.grabY + 9, {steps: 3}); await page.waitForTimeout(70);
  await page.mouse.move(from.grabX + target.x - from.x, from.grabY + target.y - from.y, {steps: 24}); await page.waitForTimeout(130); await page.mouse.up(); await settle();
}
async function step(source, target, confirm = true) {
  if (!(await page.getByRole('combobox', {name: '选积木', exact: true}).isVisible())) await page.getByRole('button', {name: '点选放入', exact: true}).click();
  await page.getByRole('combobox', {name: '选积木', exact: true}).selectOption(source);
  await page.getByRole('combobox', {name: '选目标', exact: true}).selectOption(target);
  await page.getByRole('button', {name: '3 预览放入', exact: true}).click(); await settle();
  if (confirm) {await page.getByRole('button', {name: /^确认(放入|替换)$/}).click(); await settle();}
}

try {
  await page.goto(process.env.EDITOR_TEST_URL ?? 'http://127.0.0.1:5198/tests/program-teaching/editor.harness.html');
  await page.waitForFunction(() => window.editorTest?.workspace()); await settle();
  check('initial fragment stays empty and emits no student edit', (await graph()).changes === 0 && !(await graph()).workspace.blocks.blocks[0].inputs);
  check('one persistent exact target', await page.locator('[data-teaching-target]').count() === 1);
  const workspaceId = await page.evaluate(() => window.editorTest.workspace().id);
  await screenshot('01-output-empty-1280');
  await drag('TRUE', 'output', 'output', 'VALUE');
  let state = await graph(), root = state.workspace.blocks.blocks.find(block => block.id === 'output');
  check('real flyout drag snaps true into output VALUE', root.inputs?.VALUE?.block?.fields?.BOOL === 'TRUE');
  const boolId = root.inputs.VALUE.block.id;
  check('controlled echo keeps the same workspace instance', workspaceId === await page.evaluate(() => window.editorTest.workspace().id));
  const fieldPoint = await page.evaluate(id => {const r = window.editorTest.workspace().getBlockById(id).getField('BOOL').getSvgRoot().getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2};}, boolId);
  await page.mouse.click(fieldPoint.x, fieldPoint.y);
  await page.locator('.blocklyMenuItem').filter({hasText: 'false · 关'}).click(); await settle();
  check('real boolean field menu edits TRUE to FALSE with Chinese meaning', (await graph()).workspace.blocks.blocks[0].inputs.VALUE.block.fields.BOOL === 'FALSE');
  await page.getByRole('button', {name: '撤销一步'}).click(); await settle();
  await screenshot('02-output-connected');
  const canvas = await page.locator('.eqt-editor-canvas').boundingBox();
  await drag(boolId, 'output', null, null, false, {x: canvas.x + canvas.width - 100, y: canvas.y + canvas.height - 90});
  state = await graph(); root = state.workspace.blocks.blocks.find(block => block.id === 'output');
  check('empty-space drop preserves the loose block and original empty slot', !root.inputs && state.workspace.blocks.blocks.some(block => block.id === boolId));
  check('unconnected drop reports an actual target immediately', await page.evaluate(() => window.editorTest.interactions.some(item => item.type === 'drop-unconnected' && item.focusTarget?.blockId === 'output')));
  await page.getByRole('button', {name: '撤销一步'}).click(); await settle();
  check('undo restores the connection and reports undo synchronously', (await graph()).workspace.blocks.blocks.find(block => block.id === 'output').inputs.VALUE.block.id === boolId && await page.evaluate(() => window.editorTest.changes.at(-1).meta.origin === 'undo'));
  await step('tool:false', 'output|VALUE', false);
  check('replacement preview leaves true connected until confirmed', (await graph()).workspace.blocks.blocks.find(block => block.id === 'output').inputs.VALUE.block.fields.BOOL === 'TRUE');
  await screenshot('03-replacement-preview');
  await page.getByRole('button', {name: '取消', exact: true}).click(); await settle();
  check('cancel preserves the original value', (await graph()).workspace.blocks.blocks.find(block => block.id === 'output').inputs.VALUE.block.id === boolId);
  await step('tool:false', 'output|VALUE');
  state = await graph(); root = state.workspace.blocks.blocks.find(block => block.id === 'output');
  check('confirmed replacement uses false and retains old true loose', root.inputs.VALUE.block.fields.BOOL === 'FALSE' && state.workspace.blocks.blocks.some(block => block.id === boolId));
  await page.getByRole('button', {name: '撤销一步'}).click(); await settle();
  check('one undo restores the replaced value and removes the new block', (await graph()).workspace.blocks.blocks.length === 1 && (await graph()).workspace.blocks.blocks[0].inputs.VALUE.block.id === boolId);
  // A native drag to an occupied value is also gated by a cancellable preview.
  await drag('FALSE', 'output', 'output', 'VALUE');
  check('native occupied drop opens replacement confirmation', await page.getByRole('button', {name: '确认替换', exact: true}).isVisible());
  check('native replacement preview protects original true', (await graph()).workspace.blocks.blocks.find(block => block.id === 'output').inputs.VALUE.block.id === boolId);
  await page.getByRole('button', {name: '取消', exact: true}).click(); await settle();
  await screenshot('04-native-replacement-cancel');

  await restore('sequence');
  check('entering sequence clears the previous output connection message', !(await page.locator('[data-teaching-feedback]').textContent()).includes('已经接上'));
  await drag('eqp_wait','next','on','previous');
  state=await graph();const misplaced=state.workspace.blocks.blocks.find(block=>block.type==='eqp_wait');
  check('a real missed wait drop preserves the same wait in the workspace',!!misplaced);
  await step(`block:${misplaced.id}`,'on|previous');
  check('the same existing wait can be placed before the first statement',(await graph()).workspace.blocks.blocks.find(block=>block.id===misplaced.id)?.next?.block?.id==='on');
  await step(`block:${misplaced.id}`,'on|next');
  state=await graph();root=state.workspace.blocks.blocks.find(block=>block.id==='on');
  check('the misplaced existing wait can move from before the root into its own former next-chain',root?.next?.block?.id===misplaced.id&&root.next.block.next?.block?.id==='off');
  await page.getByRole('button',{name:'撤销一步'}).click();await settle();
  check('undo restores the whole misplaced chain without losing its statements',(await graph()).workspace.blocks.blocks.find(block=>block.id===misplaced.id)?.next?.block?.id==='on');
  await restore('sequence');
  state = await graph(); check('sequence false remains a real editable FALSE field', state.workspace.blocks.blocks[0].next.block.inputs.VALUE.block.fields.BOOL === 'FALSE');
  await step('tool:number', 'on|next', false);
  check('wrong numeric-to-statement placement identifies the actual statement connection', await page.evaluate(() => {const d = window.editorTest.interactions.at(-1)?.diagnostic; return d?.code === 'WRONG_CONNECTION' && d.blockId === 'on' && d.connection === 'next';}));
  await drag('math_number', 'output', 'on', 'VALUE');
  check('wrong native value drop identifies the actual boolean VALUE slot', await page.evaluate(() => window.editorTest.interactions.some(item => item.diagnostic?.code === 'WRONG_VALUE' && item.diagnostic.blockId === 'on' && item.diagnostic.inputName === 'VALUE')));
  await restore('sequence');
  await drag('eqp_wait', 'previous', 'on', 'next');
  state = await graph(); root = state.workspace.blocks.blocks.find(block => block.id === 'on');
  check('native wait insertion keeps the original off statement below it', root.next.block.type === 'eqp_wait' && root.next.block.next.block.id === 'off');
  const waitId = root.next.block.id;
  await screenshot('05-sequence-real-insertion');
  await step('tool:number', `${waitId}|MS`);
  state = await graph(); root = state.workspace.blocks.blocks.find(block => block.id === 'on');
  check('step placement fills just the chosen wait MS slot', root.next.block.inputs.MS.block.fields.NUM === 600 && root.next.block.next.block.id === 'off');
  const saved = state.workspace;
  await step('block:off', 'on|previous');
  await step(`block:${waitId}`, 'off|next');
  state = await graph(); root = state.workspace.blocks.blocks.find(block => block.id === 'off');
  check('existing statements can be reordered to off wait on', root.next.block.id === waitId && root.next.block.next.block.id === 'on');
  await screenshot('06-sequence-reordered');
  const editsBeforeRestore = state.changes;
  await restore('sequence', saved);
  state = await graph();
  check('external restore recovers exact connection graph without a student edit', state.workspace.blocks.blocks.find(block => block.id === 'on').next.block.id === waitId && state.changes === editsBeforeRestore);
  await page.evaluate(() => window.editorTest.focus('off')); await settle();
  check('execution focus points to the real supplied Blockly block ID', await page.locator('[data-teaching-block-id="off"][data-teaching-executing]').count() === 1);
  await page.evaluate(() => window.editorTest.focus(null));
  await page.evaluate(() => window.editorTest.target({blockId: 'off', inputName: 'VALUE'})); await settle();
  check('external focusTarget restores an exact real slot', await page.locator('[data-teaching-target="off|VALUE"]').count() === 1);
  await page.evaluate(() => window.editorTest.target(null)); await settle();
  check('external null focusTarget clears the outline', await page.locator('[data-teaching-target]').count() === 0);
  await page.evaluate(() => window.editorTest.target(undefined));

  await restore('reading');
  await drag('eqp_read_analog', 'output', 'sample', 'VALUE');
  state = await graph(); root = state.workspace.blocks.blocks.find(block => block.id === 'sample');
  check('real LIGHT reader connects to the numeric observation anchor', root.type === 'eqt_sample' && root.inputs.VALUE.block.type === 'eqp_read_analog' && root.inputs.VALUE.block.fields.PORT === 'LIGHT');
  await screenshot('07-reading-connected');
  await page.getByRole('button', {name: '撤销一步'}).click(); await settle();
  check('reading undo returns to an empty observation VALUE', !(await graph()).workspace.blocks.blocks.find(block => block.id === 'sample').inputs);
  if (await page.getByRole('combobox', {name: '选积木', exact: true}).isVisible()) await page.getByRole('button', {name: '点选放入', exact: true}).click();
  await page.getByRole('checkbox', {name: '独立尝试'}).check(); await settle();
  check('independent mode has no unsolicited target outline', await page.locator('[data-teaching-target]').count() === 0);
  await page.getByRole('button', {name: '点选放入', exact: true}).click(); await settle();
  check('explicit help can locate the actual target in independent mode', await page.locator('[data-teaching-target]').count() === 1);
  const sourceSelect = page.getByRole('combobox', {name: '选积木', exact: true});
  await sourceSelect.focus(); await sourceSelect.press('Home'); await sourceSelect.press('ArrowDown'); await sourceSelect.press('Enter');
  await page.getByRole('button', {name: '3 预览放入', exact: true}).focus(); await page.keyboard.press('Enter'); await settle();
  await page.getByRole('button', {name: '确认放入', exact: true}).focus(); await page.keyboard.press('Enter'); await settle();
  check('keyboard selection preview and confirm uses the same connection operation', (await graph()).workspace.blocks.blocks[0].inputs.VALUE.block.type === 'eqp_read_analog');
  await page.evaluate(() => window.editorTest.lock(true)); await settle();
  check('disabled editing locks undo and placement actions', await page.getByRole('button', {name: '撤销一步'}).isDisabled() && await page.getByRole('button', {name: '3 预览放入'}).isDisabled());
  await page.evaluate(() => window.editorTest.lock(false)); await settle();
  await page.getByRole('checkbox', {name: '独立尝试'}).uncheck();
  for (const kind of ['output', 'sequence', 'reading']) {
    await restore(kind); await page.setViewportSize({width: 1024, height: 768}); await settle();
    const boxes = await page.evaluate(() => {
      const outer = document.querySelector('.eqt-editor').getBoundingClientRect(), roots = window.editorTest.workspace().getTopBlocks(false).map(block => block.getSvgRoot().getBoundingClientRect());
      return {outer: {left: outer.left, right: outer.right, top: outer.top, bottom: outer.bottom}, roots: roots.map(box => ({left: box.left, right: box.right, top: box.top, bottom: box.bottom})), width: document.documentElement.scrollWidth};
    });
    check(`${kind} core blocks fit 1024x768`, boxes.width <= 1024 && boxes.roots.every(box => box.left >= boxes.outer.left && box.right <= boxes.outer.right && box.top >= boxes.outer.top && box.bottom <= boxes.outer.bottom));
    await screenshot(`08-${kind}-1024`);
  }
  for (const size of [{width: 560, height: 300, viewport: {width: 1280, height: 720}}, {width: 500, height: 330, viewport: {width: 1024, height: 768}}]) {
    await page.setViewportSize(size.viewport);
    await page.evaluate(({width, height}) => {document.querySelector('.harness-stage').style.gridTemplateColumns = `100px ${width}px 100px`; document.querySelector('.harness-editor').style.height = `${height}px`; document.querySelector('.harness-editor').style.minHeight = '0';}, size);
    for (const kind of ['output', 'sequence', 'reading']) {
      await restore(kind); await settle();
      if (kind === 'reading') await step('tool:read', 'sample|VALUE');
      if (kind === 'output') await step('tool:true', 'output|VALUE');
      const fits = await page.evaluate(() => {const canvas = document.querySelector('.eqt-editor-canvas').getBoundingClientRect(), w = window.editorTest.workspace(); return w.getTopBlocks(false).every(block => {const r = block.getSvgRoot().getBoundingClientRect(); return r.left >= canvas.left + w.getFlyout().getWidth() - 1 && r.right <= canvas.right && r.bottom <= canvas.bottom;});});
      check(`${kind} core blocks fit parent ${size.width}x${size.height}`, fits);
      await screenshot(`09-${kind}-${size.width}x${size.height}`);
    }
  }
  check('no browser console or page errors', errors.length === 0);
  await writeFile(`${evidence}/result.json`, JSON.stringify({checks, errors, state: await graph()}, null, 2));
} catch (error) {
  await screenshot('failure');
  await writeFile(`${evidence}/failure.json`, JSON.stringify({checks, errors, state: await graph(), interactions: await page.evaluate(() => window.editorTest.interactions.slice(-8))}, null, 2));
  throw error;
} finally {await browser.close();}
