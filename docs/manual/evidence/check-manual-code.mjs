import {readFileSync,writeFileSync} from 'node:fs';
import {parseShortCpp,simulate} from '../../../src/program/index.js';
import {createHardwareContext} from '../../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../../src/integration/program-adapter.js';
import {createAutoLightExample} from '../../../src/hardware/index.js';
const file=process.argv[2];if(!file)throw Error('pass manual Markdown path');
const text=readFileSync(file,'utf8');const chunks=[...text.matchAll(/```(?:cpp|c\+\+)\s*\n([\s\S]*?)```/g)].map(m=>m[1]);
const hw=await createHardwareContext(),ctx=await createProgramContext(hw),wiring=createAutoLightExample(hw.profile);
const topology=(await ctx.topologyFor(wiring)).value;
const results=[];
for(const [index,source] of chunks.entries()){
 if(!source.includes('void loop()')) {results.push({index,kind:'fragment',status:'not-standalone'});continue;}
 const parsed=parseShortCpp(source);
 if(!parsed.ok){results.push({index,status:'parse-failed',diagnostics:parsed.diagnostics});continue;}
 const validation=ctx.validate(parsed.value);
 const run=validation.ok?simulate(parsed.value,topology,[{atMs:0,signals:{LIGHT:150}},{atMs:575,signals:{LIGHT:850}},{atMs:1135,signals:{LIGHT:449}}],{maxSteps:20000,maxTimeMs:1400}):null;
 results.push({index,status:validation.ok&&run?.ok&&run.value.status==='completed'?'executed':'failed',validation:validation.ok,diagnostics:validation.diagnostics,outputEvents:run?.value?.events.filter(e=>e.kind==='write').map(e=>({time:e.atMs,value:e.outputs.LAMP}))});
}
console.log(JSON.stringify({file,codeBlocks:chunks.length,results},null,2));
if(results.some(x=>['failed','parse-failed'].includes(x.status)))process.exitCode=1;
