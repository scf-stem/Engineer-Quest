import {autoLampOrder, getCustomerSuite, getRequirement, studentManual, requirementCardSchema} from '../../content/index.js';
import {evaluateCustomerSuite} from '../../content/customer-tests.js';
import {assertRef,createRef, canonicalJson, immutable} from '../contracts/index.js';

/** Freeze D's concrete content, with E-owned digests. Profiles remain explicit candidates. */
export async function loadCourseEdition(requirementVersion,{manualRef}={}) {
  if(manualRef)assertRef(manualRef);
  const requirement = getRequirement(requirementVersion), suite = getCustomerSuite(requirementVersion);
  const stamp = (ref, value) => createRef(ref.id, ref.version, value);
  return immutable({
    requirement, suite,
    refs: {
      taskRef: await stamp(autoLampOrder.ref, autoLampOrder),
      courseRef: await stamp(autoLampOrder.courseRef, {task:autoLampOrder.ref, participation:autoLampOrder.participation}),
      requirementRef: await stamp(requirement.ref, requirement),
      testSuiteRef: await stamp(suite.ref, suite),
      manualRef: manualRef??await stamp(studentManual.ref, studentManual),
      requirementSchemaRef: await stamp(autoLampOrder.requirementSchemaRef, requirementCardSchema),
    },
    readiness: {content:'available',manual:manualRef?'full-local-draft':'section-draft-only', language:'awaiting-program-module', device:'awaiting-hardware-module', targetCompile:'not-implemented', hardware:'not-verified'},
  });
}

/** Only a trusted real runner may supply trace coverage. No legacy time fabrication. */
export function createCourseEvaluator({edition, simulate, validateTopology, validateSource, deviceProfileRef, languageProfileRef}) {
  if (!edition?.refs || typeof simulate !== 'function' || typeof validateTopology !== 'function' || typeof validateSource !== 'function') throw new TypeError('课程执行适配需要实际程序、源码和接线校验器');
  return async snapshot => {
    const failures = [];
    for (const key of ['taskRef','requirementRef','testSuiteRef','manualRef']) if (canonicalJson(snapshot[key]) !== canonicalJson(edition.refs[key])) failures.push({name:`版本不一致：${key}`,passed:false});
    for (const [key,ref] of Object.entries({deviceProfileRef,languageProfileRef})) if (!ref || canonicalJson(snapshot[key]) !== canonicalJson(ref)) failures.push({name:`profile 不一致：${key}`,passed:false});
    const topology = await validateTopology(snapshot.wiring), source = await validateSource(snapshot.source,snapshot.program);
    if (!topology.ok || !source.ok) failures.push({name:'接线或确切源码检查失败',passed:false,diagnostics:[...(topology.diagnostics||[]),...(source.diagnostics||[])]});
    if (failures.length) return {passed:false,cases:failures,mode:'course-local'};
    const simulations = {};
    for (const scenario of edition.suite.tests) simulations[scenario.id] = await simulate(snapshot.program,topology.value,scenario.inputTimeline,{maxSteps:scenario.maxSteps,maxTimeMs:scenario.maxTimeMs});
    return {...evaluateCustomerSuite({requirementVersion:edition.requirement.ref.version,simulations}),simulations,mode:'course-local'};
  };
}
