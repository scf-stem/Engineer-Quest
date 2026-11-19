import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';

/** Deterministic identity for code, bundled lesson/manual and original art bytes. */
export function candidateBuild(root,command){
  const files=[];
  function visit(path){for(const name of readdirSync(path).sort()){const file=resolve(path,name);if(statSync(file).isDirectory())visit(file);else files.push(file);}}
  for(const dir of ['src','content','public'])visit(resolve(root,dir));
  for(const name of readdirSync(resolve(root,'docs/manual')).sort()){
    const path=resolve(root,'docs/manual',name);
    if(name.endsWith('.md'))files.push(path);else if(['assets','examples'].includes(name))visit(path);
  }
  for(const file of ['index.html','sandbox.html','legacy.html','workshop.html','package.json','package-lock.json','vite.config.js','scripts/candidate-build.js'])files.push(resolve(root,file));
  const hash=createHash('sha256');
  for(const file of files.sort()){const bytes=readFileSync(file);hash.update(relative(root,file)+'\0'+bytes.length+'\0');hash.update(bytes);}
  const digest=hash.digest('hex');let revision='unavailable',dirty=true;
  try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();dirty=!!execFileSync('git',['status','--porcelain','--',...files.map(file=>relative(root,file))],{cwd:root,encoding:'utf8'}).trim();}catch{/* exported source remains identifiable by digest */}
  return {format:'eq.candidate-build/1',id:'dialogue-'+digest.slice(0,12),sourceDigest:'sha256:'+digest,sourceRevision:revision,sourceDirty:dirty,mode:command==='build'?'frozen-candidate':'development',scope:'src/content/public, bundled full manual, root entries and build configuration'};
}
