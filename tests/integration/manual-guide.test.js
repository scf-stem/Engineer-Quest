import test from 'node:test';
import assert from 'node:assert/strict';
import {studentManual} from '../../content/index.js';
import {MANUAL_GUIDES} from '../../src/integration/manual-content.js';

test('game reading companion covers the shared section IDs and keeps physical gaps explicit',()=>{
  assert.deepEqual(Object.keys(MANUAL_GUIDES).sort(),studentManual.sections.map(s=>s.id).sort());
  for(const section of studentManual.sections){const guide=MANUAL_GUIDES[section.id];assert.ok(guide.steps.length>=3,section.id);assert.ok(guide.steps.every(s=>typeof s==='string'&&s.trim()));assert.ok(guide.note);if(guide.table)assert.ok(guide.table.rows.every(row=>row.length===guide.table.headers.length));}
  assert.match(MANUAL_GUIDES['06.1'].note,/不是已验证实物接线图/);
  assert.match(MANUAL_GUIDES['10.1'].note,/待完成章节/);
});
