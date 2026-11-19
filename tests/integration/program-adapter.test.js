import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareContext} from '../../src/integration/hardware-adapter.js';
import {createProgramContext,validateExactShortSource} from '../../src/integration/program-adapter.js';
import {createAutoLightExample} from '../../src/hardware/index.js';
import {createExampleBlocks} from '../../src/program/examples.js';
import {blocksToProgram} from '../../src/program/index.js';
const card={input:'light-sensor',condition:'below-customer-threshold',output:'dark-on-bright-off',continuous:'repeat-read-decide',explanation:'暗时开灯，亮时关灯，并持续重新读取。'};

test('real A+B+D flow binds pins and time, rejects wrong answers and settles one synthetic income',async()=>{
  const hardware=await createHardwareContext(),context=await createProgramContext(hardware),identity=context.createSession('合成集成员工');
  const wiring=createAutoLightExample(hardware.profile),program=blocksToProgram(createExampleBlocks()).value;
  const source=context.shortSource(program).value.source;
  let snapshot=await context.submit(identity,{phase:'blocks',program,wiring,source,requirementCard:card});
  const base=await identity.lab.runTests(identity.session,snapshot.id);
  assert.equal(base.report.passed,true);
  assert.equal(Object.values(base.report.simulations).every(s=>s.simulatedUntilMs>0&&s.totalSteps>0),true);
  assert.throws(()=>identity.lab.settleSoftwareDemo(identity.session,{evidenceId:base.id}),{code:'SOFTWARE_NOT_PASSED'});
  for(const [text,expected]of [[source,false],[source.replace('450','700'),false],[source.replace('450','600').replace('waitMs(100)','waitMs(500)'),false],[source.replace('450','600'),true]]){
    const next=context.parse(text);assert.equal(next.ok,true);
    snapshot=await context.submit(identity,{phase:'short-cpp',program:next.value,wiring,source:text,requirementCard:card});
    const proof=await identity.lab.runTests(identity.session,snapshot.id);
    assert.equal(proof.report.passed,expected);
    if(expected){
      const event=identity.lab.settleSoftwareDemo(identity.session,{evidenceId:proof.id});
      assert.equal(identity.lab.settleSoftwareDemo(identity.session,{evidenceId:proof.id}).id,event.id);
      const compiled=context.arduino(next.value);assert.equal(compiled.ok,true);assert.equal(compiled.value.toolchainRequirements.compileStatus,'not_run');assert.equal(compiled.value.toolchainRequirements.fqbn,null);
    }
  }
  assert.equal(identity.lab.getLedger(identity.session).income,100);
  const changed=context.parse(source.replace('450','600')).value;
  snapshot=await context.submit(identity,{phase:'short-cpp',program:changed,wiring:{...wiring,connections:wiring.connections.slice(1)},source:source.replace('450','600'),requirementCard:card});
  assert.equal((await identity.lab.runTests(identity.session,snapshot.id)).report.passed,false);
  assert.equal(identity.lab.listEvidence(identity.session,identity.projectId).filter(e=>e.current).length,1);
});

test('source binding tolerates syntax positions but rejects different program semantics',async()=>{
  const hardware=await createHardwareContext(),context=await createProgramContext(hardware),program=blocksToProgram(createExampleBlocks()).value,source=context.shortSource(program).value.source;
  assert.equal(validateExactShortSource('/*注释*/\n'+source,program).ok,true);
  assert.equal(validateExactShortSource(source.replace('450','600'),program).ok,false);
  assert.equal(validateExactShortSource(source,{...program,languageProfileRef:{...program.languageProfileRef,id:'other-language'}}).ok,false);
});
