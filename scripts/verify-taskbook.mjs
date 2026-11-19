import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/manual/first-order-v1/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const names=new Set(manifest.files.map(file=>file.path));
for(const file of manifest.files){
  assert.ok(!file.path.includes('..')&&!file.path.startsWith('/'));
  const bytes=await readFile(new URL(file.path,root));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
}
const html=await readFile(new URL('index.html',root),'utf8');
assert.deepEqual([...html.matchAll(/id="page-(\d{2})"/g)].map(match=>match[1]),Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')));
for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const target=match[1].replace(/^\.\//,'').split('#')[0];assert.ok(target&&!/^(?:https?:|data:|\/)/.test(target),'All book dependencies must be packaged locally');assert.ok(names.has(target),target);
}
assert.ok(html.includes('未做完不等于接错')&&html.includes('选槽后画布可能自动移动')&&html.includes('evidence/novice-03-compare-empty.png')&&html.includes('写完刷新页面'));
const pdf=await readFile(new URL('首单图文任务书.pdf',root));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length,12);
console.log(`PASS: ${manifest.files.length} packaged files match SHA256; 12 HTML/PDF pages, all local dependencies, and the final learning revisions are present.`);
