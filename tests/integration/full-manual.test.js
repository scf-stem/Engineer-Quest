import test from 'node:test';
import assert from 'node:assert/strict';
import {parseManualMarkdown,splitManualTable} from '../../src/integration/manual-markdown.js';
import {readFileSync} from 'node:fs';
import {studentManual} from '../../content/index.js';

test('manual code, explicit section anchors and operator tables preserve authored meaning',()=>{
  const source='# 工程资料\n\n<a id="s081"></a>\n## §08.1 简写语言\n\n| 写法 | 含义 |\n|---|---|\n| `a || b` | 任一条件成立 |\n\n```cpp\nif (a || b) {\n  // # 不应当变成标题\n}\n```\n';
  const nodes=parseManualMarkdown(source);
  assert.equal(nodes.find(n=>n.type==='heading'&&n.level===2).id,'s081');
  assert.deepEqual(nodes.find(n=>n.type==='table').rows,[['`a || b`','任一条件成立']]);
  assert.equal(nodes.find(n=>n.type==='code').text,'if (a || b) {\n  // # 不应当变成标题\n}');
  assert.deepEqual(splitManualTable('| 信号 \\| 标签 | `x|y` |'),['信号 | 标签','`x|y`']);
});

test('the actual full reference covers the declared section catalog and retains code bodies',()=>{
  const source=readFileSync(new URL('../../docs/manual/工程参考.md',import.meta.url),'utf8'),nodes=parseManualMarkdown(source);
  const original=[...source.matchAll(/<a id="(s\d+)"><\/a>/g)].map(m=>m[1]);
  assert.deepEqual(original,studentManual.sections.map(section=>'s'+section.id.replace('.','')));assert.deepEqual(nodes.filter(n=>n.type==='heading'&&/^s\d+$/.test(n.id)).map(n=>n.id),original);
  assert.ok(nodes.some(n=>n.type==='code'&&n.text.includes('void loop()')));
});
