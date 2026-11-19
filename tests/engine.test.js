import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProgram,runProgram,generateCpp,parseCpp,runSuite,validateWiring,CORRECT_WIRING} from '../src/engine.js';
const good = {version:1,sensorThreshold:450,lampOnWhenDark:true,delayMs:100};
test('program validation enforces bounded integer semantics', () => {
  assert.equal(validateProgram(good).valid,true);
  for (const patch of [{version:2},{sensorThreshold:0},{sensorThreshold:1024},{sensorThreshold:1.2},{delayMs:0},{delayMs:2001},{lampOnWhenDark:'true'},{extra:1}]) assert.equal(validateProgram({...good,...patch}).valid,false);
});
test('input boundary and repeated independent cycles', () => {
  assert.equal(runProgram(good,449).lamp,true);
  assert.equal(runProgram(good,450).lamp,false);
  assert.equal(runSuite(good).passed,true);
  assert.deepEqual([0,1023,0].map(x => runProgram(good,x).lamp),[true,false,true]);
  for (const input of [-1,1024,NaN,2.2]) assert.throws(() => runProgram(good,input));
});
test('wrong branches fail objective customer behavior', () => {
  const result=runSuite({...good,lampOnWhenDark:false});
  assert.equal(result.passed,false);
  assert.equal(result.cases.every(c => !c.passed),true);
});
test('customer expectations stay fixed when a student changes the threshold', () => {
  for (const sensorThreshold of [1,400,451,500,1023]) assert.equal(runSuite({...good,sensorThreshold}).passed,false);
  assert.deepEqual(runSuite({...good,sensorThreshold:500}).cases.map(c=>[c.input,c.expected]),runSuite(good).cases.map(c=>[c.input,c.expected]));
});
test('generated C++ and parser round trip preserves semantics', () => {
  for (const sensorThreshold of [1,450,1023]) for (const lampOnWhenDark of [true,false]) {
    const ast={...good,sensorThreshold,lampOnWhenDark};
    assert.deepEqual(parseCpp(generateCpp(ast)),ast);
  }
});
test('parser rejects arbitrary code, altered pins, wrong comparison and malformed branches', () => {
  const source=generateCpp(good);
  const invalid=[source+'system("bad");', source.replace('light <','light >'),source.replace('pinMode(9','pinMode(8'),source.replace('A0','A1').replace('analogRead(A0)','analogRead(A1)'),source.replace('450','450 + 1'),source.replace('450','0450'),source.replace('LOW','HIGH'), source+'/*', '#include <evil>\n'+source, source.replace('delay(100)','delay(0)'),source.replace('loop()','loop(int x)')];
  for (const text of invalid) assert.throws(() => parseCpp(text),text);
});
test('C++ comments and whitespace do not change AST', () => {
  assert.deepEqual(parseCpp('/* lesson */\n'+generateCpp(good)),good);
});
test('known safe wiring passes including reversed resistor orientation', () => {
  assert.equal(validateWiring(CORRECT_WIRING).valid,true);
  const reverse=CORRECT_WIRING.map(w => w.map(t => t==='R.1'?'R.2':t==='R.2'?'R.1':t));
  assert.equal(validateWiring(reverse).valid,true);
});
test('missing connections, reversed LED and arbitrary digital pins fail', () => {
  for(let i=0;i<CORRECT_WIRING.length;i++) assert.equal(validateWiring(CORRECT_WIRING.filter((_,j)=>i!==j)).valid,false);
  assert.equal(validateWiring(CORRECT_WIRING.map(w=>w.map(t=>t==='LED.A'?'LED.K':t==='LED.K'?'LED.A':t))).valid,false);
  assert.equal(validateWiring([...CORRECT_WIRING,['UNO.D8','LED.A']]).valid,false);
});
test('shorts, LED resistor bypass and cross-net collisions fail', () => {
  for(const wire of [['UNO.5V','UNO.GND'],['UNO.D9','LED.A'],['R.1','R.2'],['UNO.A0','UNO.5V'],['LED.A','UNO.GND']]) assert.equal(validateWiring([...CORRECT_WIRING,wire]).valid,false);
});
test('bad wiring input is rejected rather than executed', () => {
  for(const input of [null,{},[['UNO.5V']],[['UNKNOWN','UNO.GND']],[['UNO.GND','UNO.GND']]]) assert.equal(validateWiring(input).valid,false);
});
