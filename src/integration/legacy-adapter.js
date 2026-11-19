import {createRef, canonicalJson} from '../contracts/index.js';
import {generateCpp, parseCpp, runSuite, validateProgram, validateWiring} from '../engine.js';

/** Explicit bridge for the preserved v1 parameter template, never a new ProgramIR. */
export async function createLegacyAdapter() {
  const refs = {
    taskRef: await createRef('synthetic-legacy-light','1',{threshold:450,kind:'legacy-template'}),
    requirementRef: await createRef('synthetic-legacy-requirement','1',{lowerMeansDark:true,threshold:450,onBelow:true}),
    deviceProfileRef: await createRef('synthetic-legacy-uno','1',{family:'arduino-uno',variant:null,fqbn:null,pins:{light:'A0',lamp:'D9'},calibrationStatus:'synthetic'}),
    testSuiteRef: await createRef('synthetic-legacy-suite','1',{inputs:[0,1023,449,450,0,1023,0],expected:[true,false,true,false,true,false,true]}),
    manualRef: await createRef('synthetic-legacy-manual','1',{sections:['02','06','07'],status:'draft'}),
    languageProfileRef: await createRef('legacy-template','1',{fields:['sensorThreshold','lampOnWhenDark','delayMs']}),
  };
  async function evaluate(snapshot) {
    const cases = [];
    for (const [key,ref] of Object.entries(refs)) cases.push({name:`冻结版本 ${key}`,passed:canonicalJson(snapshot[key])===canonicalJson(ref)});
    const program = validateProgram(snapshot.program);
    cases.push({name:'旧四参数模板有效（不是新 IR）',passed:program.valid,diagnostics:program.errors});
    const topology = validateWiring(snapshot.wiring?.legacyConnections);
    cases.push({name:'候选 A0 / D9 接线规则',passed:topology.valid,diagnostics:topology.errors});
    let sourceMatches = false;
    try {sourceMatches = canonicalJson(parseCpp(snapshot.source)) === canonicalJson(snapshot.program);} catch { /* failed evidence, never evaluate source */ }
    cases.push({name:'确切源码与执行程序一致',passed:sourceMatches});
    cases.push({name:'需求卡包含个人解释',passed:typeof snapshot.requirementCard?.explanation==='string' && snapshot.requirementCard.explanation.trim().length>0});
    if (program.valid) cases.push(...runSuite(snapshot.program).cases);
    return {passed:cases.every(c=>c.passed),cases,mode:'legacy-synthetic',limitations:['旧参数模板；没有时序执行','Uno 实物与读数尚未校准','未编译或烧录']};
  }
  return Object.freeze({refs:Object.freeze(refs),evaluate,generateSource:generateCpp});
}
