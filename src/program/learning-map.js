import {result, unwrap} from './common.js';
import {generateShortCpp} from './generate.js';
import {walkProgram} from './learning-guidance.js';

function describe(node) {
  if(!node.kind)return {concept:'declaration',label:`${node.constant?'常量':'变量'} ${node.name}`,meaning:node.constant?'给固定规则起名字，声明后不再修改。':'保存一个值，后面的语句可以更新和读取它。'};
  switch(node.kind){
    case 'read':return {concept:'input',label:`读取 ${node.port}`,meaning:'执行到这里时才采样输入；等待时不会自动更新已存变量。'};
    case 'literal':return {concept:'value',label:`固定值 ${node.value}`,meaning:typeof node.value==='boolean'?'布尔值表示开关或条件成立与否。':'这是一个整数值；它本身不会读取传感器。'};
    case 'variable':return {concept:'state',label:`取出 ${node.name}`,meaning:'使用变量当前保存的值；取值不等于重新读取传感器。'};
    case 'assign':return {concept:'assignment',label:`更新 ${node.name}`,meaning:'先计算等号右边，再把结果保存到左边的变量。'};
    case 'binary':return {concept:['<','<=','>','>=','==','!='].includes(node.op)?'comparison':'expression',label:`运算 ${node.op}`,meaning:['<','<=','>','>=','==','!='].includes(node.op)?'比较两个值，结果是 true 或 false；它决定分支。':['&&','||'].includes(node.op)?'组合条件；不需要检查右边时，会跳过右边的读取。':'计算两个整数，结果仍须在本课整数范围内。'};
    case 'unary':return {concept:'expression',label:node.op==='!'?'条件取反':'取相反数',meaning:node.op==='!'?'把 true 与 false 对调。':'计算整数的相反数。'};
    case 'if':return {concept:'branch',label:'如果／否则',meaning:'每次执行只进入一个分支；条件下次执行时会重新计算。'};
    case 'while':return {concept:'loop',label:'条件循环',meaning:'条件为 true 就继续执行内部动作；要留意条件更新与等待。'};
    case 'write':return {concept:'output',label:`设置 ${node.port}`,meaning:'写入输出后保持该状态，直到下一次写入；离开分支不会自动关灯。'};
    case 'wait':return {concept:'time',label:'等待后继续',meaning:'暂停本程序一段毫秒；输入可以变化，保存的变量和输出保持不变。'};
  }
}

export function createProgramLearningMap(program,{blockState}={}) {
  return result(()=>{
    const generated=unwrap(generateShortCpp(program)),nodes=new Map();
    walkProgram(program,(node,path)=>nodes.set(node.id,{node,path}));
    const links=generated.map.map(entry=>{
      const {node,path}=nodes.get(entry.nodeId);
      return {nodeId:node.id,path,...describe(node),generatedRange:entry.sourceRange,code:generated.source.slice(entry.sourceRange.start,entry.sourceRange.end),...(node.sourceRange?{originalRange:node.sourceRange}:{})};
    }).sort((a,b)=>a.generatedRange.start-b.generatedRange.start || b.generatedRange.end-a.generatedRange.end);
    const root=blockState?.blocks?.blocks?.find(b=>b.type==='eqp_program');
    links.unshift({nodeId:'section:loop',...(root?{blockId:root.id,inputName:'LOOP'}:{}),path:'loop',concept:'main-loop',label:'持续执行 ↔ void loop()',meaning:'Arduino 启动后反复调用这部分；把读取放在这里，才会持续看到光照变化。',generatedRange:generated.sections.loop,code:generated.source.slice(generated.sections.loop.start,generated.sections.loop.end)});
    links.unshift({nodeId:'section:setup',...(root?{blockId:root.id,inputName:'SETUP'}:{}),path:'setup',concept:'startup',label:'启动时 ↔ void setup()',meaning:'这里只在启动时执行一次，适合初始化；在这里读过的数值不会自己刷新。',generatedRange:generated.sections.setup,code:generated.source.slice(generated.sections.setup.start,generated.sections.setup.end)});
    return {source:generated.source,links,sections:generated.sections};
  });
}
