import {createRef} from '../contracts/index.js';
import {createProgramContext} from './program-adapter.js';
const documents=import.meta.glob('../../docs/manual/*.md',{query:'?raw',import:'default',eager:true});
const attachments=import.meta.glob('../../docs/manual/{assets/*.svg,examples/*.cpp}',{query:'?raw',import:'default',eager:true});
export function getFullManualBundle(){
  const normalize=values=>Object.fromEntries(Object.entries(values).map(([path,text])=>[path.replace('../../docs/manual/',''),text]));
  return {schemaVersion:'eq.manual-bundle/1',documents:normalize(documents),attachments:normalize(attachments)};
}
export async function createIntegratedProgramContext(hardware){
  const bundle=getFullManualBundle();
  if(!bundle.documents['首单手册.md']||!bundle.documents['工程参考.md'])return createProgramContext(hardware);
  const manualRef=await createRef('eq-student-manual','0.2.0-local-full',bundle);
  return createProgramContext(hardware,{manualRef});
}
