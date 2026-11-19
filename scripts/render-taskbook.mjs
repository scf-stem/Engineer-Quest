import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const folder=new URL('../public/manual/first-order-v1/',import.meta.url);
const evidence=process.env.EQ_TASKBOOK_RENDER||'/tmp/eq-taskbook-render';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
try{
  const page=await browser.newPage({viewport:{width:1000,height:1200}});
  await page.goto(new URL('index.html',folder).href);await page.emulateMedia({media:'print'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.page img')].map(img=>img.decode()));});
  const metrics=await page.locator('.page').evaluateAll(pages=>pages.map((page,i)=>{
    const box=page.getBoundingClientRect(),next=page.querySelector('.next').getBoundingClientRect();
    const content=[...page.children].filter(e=>!e.matches('.next,.foot')).map(e=>e.getBoundingClientRect().bottom-box.top);
    return {page:i+1,contentBottom:Math.max(...content),nextTop:next.top-box.top,height:box.height};
  }));
  if(metrics.length!==12||metrics.some(p=>p.contentBottom>p.nextTop-4))throw new Error('Taskbook page content overlaps next-step footer: '+JSON.stringify(metrics));
  await page.pdf({path:fileURLToPath(new URL('首单图文任务书.pdf',folder)),format:'A4',preferCSSPageSize:true,printBackground:true});
  await writeFile(evidence+'/print-metrics.json',JSON.stringify(metrics,null,2)+'\n');
  console.log('Printed 12-page student taskbook with non-overlapping content and next-step areas.');
}finally{await browser.close();}
