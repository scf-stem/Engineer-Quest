const prefix='eq.note-recovery/1:';
export function noteKey(learnerId,attemptId){return learnerId&&attemptId?prefix+learnerId+':'+attemptId:null;}
/** Only ungraded note text is journaled synchronously. Never restore progress or awards. */
export function readNoteJournal(storage,key){
  if(!storage||!key)return null;
  try{const value=JSON.parse(storage.getItem(key));return value?.format==='eq.note-recovery/1'&&typeof value.text==='string'&&value.text.length<=1500?value.text:null;}catch{return null;}
}
export function writeNoteJournal(storage,key,text){
  if(!storage||!key)return false;
  try{storage.setItem(key,JSON.stringify({format:'eq.note-recovery/1',text}));return true;}catch{return false;}
}
export function clearNoteJournal(storage,key,text){
  if(!storage||!key)return;
  try{if(readNoteJournal(storage,key)===text)storage.removeItem(key);}catch{/* main persistent save remains authoritative */}
}
