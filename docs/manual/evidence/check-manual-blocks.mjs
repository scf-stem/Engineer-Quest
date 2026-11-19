// Build the manual's custom-toolbox recipe from scratch, not createExampleBlocks().
import assert from 'node:assert/strict';
import {blocksToProgram} from '../../../src/program/index.js';
import {createHardwareContext} from '../../../src/integration/hardware-adapter.js';
import {createProgramContext} from '../../../src/integration/program-adapter.js';
import {createAutoLightExample} from '../../../src/hardware/index.js';
let n=0;const b=(type,fields={},inputs={})=>({id:`manual-${++n}`,type,fields,inputs});
const slot=x=>({block:x}),num=x=>b('math_number',{NUM:x}),get=x=>b('eqp_get',{NAME:x});
const threshold=b('eqp_declare',{NAME:'threshold',TYPE:'int',CONSTANT:'TRUE'},{INITIAL:slot(num(450))});
const light=b('eqp_declare',{NAME:'light',TYPE:'int',CONSTANT:'FALSE'},{INITIAL:slot(num(0))});threshold.next=slot(light);
const assign=b('eqp_set',{NAME:'light'},{VALUE:slot(b('eqp_read_analog',{PORT:'LIGHT'}))});
const branch=b('controls_if',{}, {IF0:slot(b('logic_compare',{OP:'LT'},{A:slot(get('light')),B:slot(get('threshold'))})), DO0:slot(b('eqp_write',{PORT:'LAMP'},{VALUE:slot(b('logic_boolean',{BOOL:'TRUE'}))})),ELSE:slot(b('eqp_write',{PORT:'LAMP'},{VALUE:slot(b('logic_boolean',{BOOL:'FALSE'}))}))});branch.extraState={hasElse:true};assign.next=slot(branch);branch.next=slot(b('eqp_wait',{}, {MS:slot(num(100))}));
const root=b('eqp_program',{}, {VARIABLES:slot(threshold),LOOP:slot(assign)});
const state={blocks:{languageVersion:0,blocks:[root]}};
const program=blocksToProgram(state);assert.equal(program.ok,true);
const hw=await createHardwareContext(),ctx=await createProgramContext(hw),identity=ctx.createSession('手册合成验证');
const wiring=createAutoLightExample(hw.profile),source=ctx.shortSource(program.value).value.source;
const card={input:'light-sensor',condition:'below-customer-threshold',output:'dark-on-bright-off',continuous:'repeat-read-decide',explanation:'每轮重新读取光照，暗时亮，亮时灭，再次变暗再亮。'};
const checks=[];
for(const [phase,code,expected] of [['blocks',source,true],['short-cpp',source,false],['short-cpp',source.replace('450','600'),true]]){
const parsed=ctx.parse(code);assert.equal(parsed.ok,true);
const snapshot=await ctx.submit(identity,{phase,program:parsed.value,wiring,source:code,requirementCard:card});
const proof=await identity.lab.runTests(identity.session,snapshot.id);assert.equal(proof.report.passed,expected);
checks.push({phase,threshold:code.includes('600')?600:450,passed:proof.report.passed,expected});
}
console.log(JSON.stringify({method:'Manual custom block recipe constructed independently via serialization; not mouse-drag usability evidence.',source,checks},null,2));
