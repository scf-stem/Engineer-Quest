import {exact, fail, result, unwrap} from './common.js';
import {simulate} from './simulate.js';
import {parseShortCpp} from './parser.js';
import {blocksToProgram} from './blocks.js';
import {validateProgram} from './validate.js';
import {createProgramLearningMap} from './learning-map.js';

/** No facts are derived from UI booleans. E binds and persists these raw facts. */
export function performProgramLearningAction({actionId,inputs={},program,topology,blockState}={}){
  return result(()=>{
    const facts=[];
    const fact=(factCode,source,payload)=>facts.push({factCode,source,payload});
    if(actionId==='code-mapping'){
      exact(inputs,['nodeId']);
      const ownProgram=unwrap(blocksToProgram(blockState));
      // Mapping always comes from the provided saved blocks, never an example fallback.
      const mapping=unwrap(createProgramLearningMap(ownProgram,{blockState}));
      const link=mapping.links.find(l=>l.nodeId===inputs.nodeId&&l.concept==='comparison');
      if(!link)fail('LEARNING_MAPPING_TARGET','请选择自己这份积木里的比较节点，再对照它生成的代码');
      fact('own_comparison_mapping_observed','program-analysis',{nodeId:link.nodeId,path:link.path,generatedRange:link.generatedRange,code:link.code});
      return {actionId,factCodes:facts.map(f=>f.factCode),facts,observation:{label:link.label,meaning:link.meaning,code:link.code},program:ownProgram,mapping};
    }
    let timeline,expected;
    if(actionId==='observe-output'){
      exact(inputs,['on']);if(typeof inputs.on!=='boolean')fail('LEARNING_INPUT','请明确选择打开或关闭 LED');
      program=unwrap(parseShortCpp(`void loop() { writeDigital(LAMP, ${inputs.on}); waitMs(100); }`));timeline=[];
    }else{
      unwrap(validateProgram(program,topology?.deviceProfile));
      if(actionId==='read-input'){
        exact(inputs,['light']);if(!Number.isInteger(inputs.light)||inputs.light<0||inputs.light>1023)fail('LEARNING_INPUT','虚拟光照需要 0…1023 的整数');
        timeline=[{atMs:0,signals:{LIGHT:inputs.light}}];
      }else if(actionId==='branch-output'){
        exact(inputs,['scene']);if(!['dark','bright'].includes(inputs.scene))fail('LEARNING_INPUT','请选择暗或亮的固定观察场景');
        const light=inputs.scene==='dark'?150:850;expected=inputs.scene==='dark';timeline=[{atMs:0,signals:{LIGHT:light}}];
      }else if(actionId==='repeat-read'){
        exact(inputs,[]);timeline=[{atMs:0,signals:{LIGHT:150}},{atMs:100,signals:{LIGHT:850}},{atMs:200,signals:{LIGHT:180}}];
      }else fail('LEARNING_ACTION_OWNER','此动作需要 E 的实际客户测试或存储证据，不能由 UI 的 passed 生成');
    }
    const simulation=unwrap(simulate(program,topology,timeline,{maxSteps:2000,maxTimeMs:actionId==='repeat-read'?300:100}));
    const reads=simulation.events.filter(e=>e.kind==='read'&&e.port==='LIGHT'),branches=simulation.events.filter(e=>e.kind==='branch'),writes=simulation.events.filter(e=>e.kind==='write'&&e.port==='LAMP');
    const writeParents=new Map();
    function branchWrites(list,parents=[]){for(const node of list){if(node.kind==='write')writeParents.set(node.id,parents);if(node.kind==='if'){branchWrites(node.then,[...parents,node.id]);branchWrites(node.else,[...parents,node.id]);}if(node.kind==='while')branchWrites(node.body,parents);}}
    branchWrites(program.setup);branchWrites(program.loop);
    const actualBranch=branches.findLast(e=>writeParents.get(writes.at(-1)?.nodeId)?.includes(e.nodeId)&&e.step<writes.at(-1).step);
    if(simulation.status==='completed'){
      if(actionId==='observe-output'&&writes.some(e=>e.value===inputs.on))fact('guided_output_observed','program-runtime',{guided:true,on:inputs.on,event:summary(writes.find(e=>e.value===inputs.on))});
      if(actionId==='read-input'&&reads.some(e=>e.value===inputs.light))fact('current_input_read_observed','program-runtime',{light:inputs.light,event:summary(reads.find(e=>e.value===inputs.light))});
      if(actionId==='branch-output'&&reads.length&&actualBranch&&simulation.events.at(-1).outputs.LAMP===expected&&writes.at(-1)?.value===expected){
        fact(inputs.scene==='dark'?'dark_branch_observed':'bright_branch_observed','program-runtime',{scene:inputs.scene,input:timeline[0].signals.LIGHT,expected,event:summary(writes.at(-1)),read:summary(reads[0]),branch:summary(actualBranch)});
      }
      if(actionId==='repeat-read'){
        const observations=timeline.map(frame=>{const checkedAtMs=frame.atMs+99,read=reads.find(e=>e.atMs>=frame.atMs&&e.atMs<=checkedAtMs&&e.value===frame.signals.LIGHT);let output;for(const event of simulation.events){if(event.atMs>checkedAtMs)break;output=event.outputs.LAMP;}return {atMs:frame.atMs,checkedAtMs,input:frame.signals.LIGHT,output,read:summary(read)};});
        if(observations.every((o,i)=>o.read&&o.output===[true,false,true][i]))fact('repeated_current_read_observed','program-runtime',{observations});
      }
    }
    return {actionId,factCodes:facts.map(f=>f.factCode),facts,program:structuredClone(program),simulation,observation:{inputTimeline:timeline,reads:reads.map(summary),branches:branches.map(summary),writes:writes.map(summary),message:facts.length?'已记录这次动作的实际观察；其他练习仍需分别操作。':'本次运行还没有提供此练习所需的观察，请查看实际读取、分支与输出。'}};
  });
}
function summary(event){return event?{nodeId:event.nodeId,atMs:event.atMs,step:event.step,kind:event.kind,...(event.port?{port:event.port,value:event.value}:{}),...(event.branch!==undefined?{branch:event.branch}:{})}:null;}
