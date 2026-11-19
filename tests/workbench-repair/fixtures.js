const block=(type,id,fields={},inputs={})=>({type,id,fields,inputs});
const value=block=>({block});
export function workbenchFixture({branches=false,loose=false,correct=false}={}){
  const number=(id,n)=>block('math_number',id,{NUM:n});
  const output=(id,on)=>block('eqp_write',id,{PORT:'LAMP'},{VALUE:value(block('logic_boolean',`${id}-bool`,{BOOL:on?'TRUE':'FALSE'}))});
  const declaration=block('eqp_declare','declaration',{NAME:'light',TYPE:'int',CONSTANT:'FALSE'},{INITIAL:value(number('initial',0))});
  const read=block('eqp_set','read',{NAME:'light'},{VALUE:value(block('eqp_read_analog','reader',{PORT:'LIGHT'}))});
  const wait=block('eqp_wait','wait',{}, {MS:value(number('duration',100))});
  const decision=block('controls_if','if',{}, {IF0:value(block('logic_compare','comparison',{OP:'LT'},{A:value(block('eqp_get','light',{NAME:'light'})),B:value(number('threshold',450))}))});
  decision.extraState={hasElse:true};
  if(branches){decision.inputs.DO0=value(output('on',true));decision.inputs.ELSE=value(output('off',false));}
  if(correct){read.next=value(decision);decision.next=value(wait);}else{read.next=value(wait);wait.next=value(decision);}
  const root={...block('eqp_program','root',{}, {VARIABLES:value(declaration),LOOP:value(read)}),x:30,y:25};
  const blocks=[root];
  if(loose){blocks.push({...output('on',true),x:450,y:110},{...output('off',false),x:450,y:225});}
  return {blocks:{languageVersion:0,blocks}};
}
