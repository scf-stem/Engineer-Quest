const missing=new Set(['SENSOR_POWER_MISSING','SENSOR_GROUND_MISSING','SENSOR_PIN_MISMATCH','LED_GROUND_MISSING','LED_SERIES_RESISTOR_MISSING']);
const steps=[['sensor:VCC','uno:5V','给光照模块接电源'],['sensor:GND','uno:GND_1','给光照模块接公共地'],['sensor:AO','uno:A0','把光照读数送到 A0'],['uno:D9','resistor:1','让灯的输出先经过电阻'],['resistor:2','led:A','把电阻另一端接到 LED A 正极'],['led:K','uno:GND_2','让 LED K 负极回到公共地']];
const ground=id=>/^uno:GND/.test(id)?'uno:GND':id;
export function wiringJourney(document,result){
  const wires=document?.connections??[],graph=new Map();
  for(const {from,to} of wires){const a=ground(from),b=ground(to);graph.set(a,[...(graph.get(a)??[]),b]);graph.set(b,[...(graph.get(b)??[]),a]);}
  const connected=(from,to)=>{const target=ground(to),queue=[ground(from)],seen=new Set();while(queue.length){const p=queue.shift();if(p===target)return true;if(seen.has(p))continue;seen.add(p);queue.push(...graph.get(p)??[]);}return false;};
  const faults=(result?.diagnostics??[]).filter(d=>d.severity==='error'&&(!missing.has(d.code)||d.code==='SENSOR_PIN_MISMATCH'&&d.terminalIds?.some(id=>/^uno:/.test(id)&&id!=='uno:A0')));
  const next=steps.find(([a,b])=>!connected(a,b)&&!(a==='uno:D9'&&connected(a,'resistor:2'))&&!(a==='resistor:2'&&connected('resistor:1',b)));
  const wrongInput=faults.find(d=>d.code==='SENSOR_PIN_MISMATCH'),wrongPin=wrongInput?.terminalIds?.find(id=>/^uno:A/.test(id)&&id!=='uno:A0');
  return {faults,next:next?{from:next[0],to:next[1],title:next[2]}:null,complete:result?.ok===true,
    message:wrongPin?`这根线把光照读数送到了 ${wrongPin.replace('uno:','')}，这份程序从 A0 读。看看要改哪一头？`:faults[0]?.message??(result?.ok?'光照模块和灯的回路都接好了。现在亲手让灯亮一次。':next?`${wires.length?'刚才的线路已留下。':''}接下来：${next[2]}，${next[0].replace(/^[^:]+:/,'')} → ${next[1].replace(/^[^:]+:/,'')}。`:'继续检查灯与电阻的回路。')};
}
