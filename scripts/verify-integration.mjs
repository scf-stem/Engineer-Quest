import assert from 'node:assert/strict';
import {createHardwareContext} from '../src/integration/hardware-adapter.js';
import {createProgramContext} from '../src/integration/program-adapter.js';
import {createAutoLightExample} from '../src/hardware/index.js';
import {blocksToProgram} from '../src/program/index.js';
import {createExampleBlocks} from '../src/program/examples.js';

const hardware=await createHardwareContext(),context=await createProgramContext(hardware),identity=context.createSession('合成集成员工');
const wiring=createAutoLightExample(hardware.profile),program=blocksToProgram(createExampleBlocks()).value;
const source=context.shortSource(program).value.source;
const requirementCard={input:'light-sensor',condition:'below-customer-threshold',output:'dark-on-bright-off',continuous:'repeat-read-decide',explanation:'每轮重新读取，暗开亮关。'};
const snapshot=await context.submit(identity,{phase:'blocks',program,wiring,source,requirementCard});
const base=await identity.lab.runTests(identity.session,snapshot.id);assert.equal(base.report.passed,true);
const results=[];let latest;
for(const threshold of [450,700,600]){
  const shortSource=source.replace('450',String(threshold)),next=context.parse(shortSource).value;
  const snapshot=await context.submit(identity,{phase:'short-cpp',program:next,wiring,source:shortSource,requirementCard});
  latest=await identity.lab.runTests(identity.session,snapshot.id);
  assert.equal(latest.report.passed,threshold===600);results.push({studentThreshold:threshold,passed:latest.report.passed});
}
identity.lab.settleSoftwareDemo(identity.session,{evidenceId:latest.id});identity.lab.settleSoftwareDemo(identity.session,{evidenceId:latest.id});
assert.equal(identity.lab.getLedger(identity.session).events.length,1);
const generated=context.arduino(context.parse(source.replace('450','600')).value);assert.equal(generated.ok,true);
console.log(JSON.stringify({mode:'synthetic-local',modules:['A-program','B-wiring','D-customer-tests','E-snapshots'],base:{version:base.report.requirementRef.version,passed:base.report.passed,assertions:base.report.cases.reduce((n,c)=>n+c.assertions.length,0)},change:{version:latest.report.requirementRef.version,results,assertions:latest.report.cases.reduce((n,c)=>n+c.assertions.length,0)},income:identity.lab.getLedger(identity.session).income,settlements:1,toolchain:generated.value.toolchainRequirements,hardware:identity.lab.hardwareStatus()},null,2));
