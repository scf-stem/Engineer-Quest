import test from 'node:test';
import assert from 'node:assert/strict';
import {noteKey,readNoteJournal,writeNoteJournal,clearNoteJournal} from '../../src/integration/note-journal.js';

test('immediate recovery holds only note text for the same learner and attempt',()=>{
  const values=new Map(),store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const key=noteKey('learner-a','attempt-a');
  assert.equal(writeNoteJournal(store,key,'最后刚打的一句'),true);
  assert.equal(readNoteJournal(store,key),'最后刚打的一句');assert.equal(readNoteJournal(store,noteKey('learner-a','attempt-b')),null);
  clearNoteJournal(store,key,'更早保存的半句');assert.equal(readNoteJournal(store,key),'最后刚打的一句');
  clearNoteJournal(store,key,'最后刚打的一句');assert.equal(readNoteJournal(store,key),null);
  values.set(key,JSON.stringify({format:'eq.note-recovery/1',passed:true,income:999}));assert.equal(readNoteJournal(store,key),null);
  assert.equal(writeNoteJournal({setItem(){throw new Error('quota');}},key,'text'),false);
});
