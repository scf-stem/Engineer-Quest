import {readdirSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../../src/integration/program-adapter.js';
import {createAutoLightExample} from '../../../src/hardware/index.js';
const hardware=await createHardwareContext(),context=await createProgramContext(hardware),wiring=createAutoLightExample(hardware.profile);
const card={input:'light-sensor',condition:'below-customer-threshold',output:'dark-on-bright-off',continuous:'repeat-read-decide',explanation:'读取、暗亮判断、输出、继续重复读取。'};
const results=[];
for(const file of readdirSync('docs/manual/examples').filter(f=>f.endsWith('.cpp'))){
const source=readFileSync('docs/manual/examples/'+file,'utf8'),program=context.parse(source);assert.equal(program.ok,true);
const phase=source.includes('600')?'short-cpp':'blocks',identity=context.createSession('手册源码验证');
const snapshot=await context.submit(identity,{phase,program:program.value,wiring,source,requirementCard:card});
const evidence=await identity.lab.runTests(identity.session,snapshot.id);assert.equal(evidence.report.passed,true);
const ino=context.arduino(program.value);assert.equal(ino.ok,true);
results.push({file,phase,customerPassed:evidence.report.passed,arduinoGenerated:ino.ok,targetCompile:ino.value.toolchainRequirements.compileStatus});
}
console.log(JSON.stringify(results,null,2));
