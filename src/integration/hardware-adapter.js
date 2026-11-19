import {UNO_CANDIDATE_PROFILE,COMPONENT_CATALOG,createWiringDocument,validateWiring} from '../hardware/index.js';
import {createRef,immutable} from '../contracts/index.js';

export async function createHardwareContext() {
  // B uses optional JS properties with undefined. Its JSON profile omits those explicitly.
  const {ref,...profileJson}=JSON.parse(JSON.stringify(UNO_CANDIDATE_PROFILE));
  const executionJson={family:profileJson.family,variant:profileJson.variant,fqbn:profileJson.fqbn,calibrationStatus:profileJson.calibrationStatus,pinMap:{
    LIGHT:{pin:profileJson.pinMap.light,direction:'input',signalType:'analog',min:0,max:1023,initialValue:0},
    LAMP:{pin:Number(profileJson.pinMap.lamp.slice(1)),direction:'output',signalType:'digital',initialValue:false},
  }};
  const profileRef=await createRef(ref.id,ref.version,{adapterVersion:'eq.hardware-execution/1',profile:profileJson,execution:executionJson,componentCatalog:JSON.parse(JSON.stringify(COMPONENT_CATALOG))});
  const profile=immutable({...profileJson,ref:profileRef});
  const executionProfile=immutable({...executionJson,ref:profileRef});
  return {profile,executionProfile,ref:profileRef,createDocument:()=>createWiringDocument(profile),validate:document=>validateWiring(document,profile)};
}

/** B's draft section labels map to D's frozen sections; unknown labels remain unresolved. */
export function resolveHardwareManualSection(section) {
  if(['04.1','05.1','05.2','06.1','06.2'].includes(section))return section;
  return ({'4.1':'04.1','4.2':'04.1','5.2':'05.1','5.3':'05.2','6.1':'06.1','6.2':'06.2'})[section]??null;
}
