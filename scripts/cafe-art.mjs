// Rasterize the authored SVG plates for Figma's native image fills.
import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const folder=new URL('../vault/Originals/',import.meta.url);
const browser=await chromium.launch({channel:'chrome'});
try{
  const p=await browser.newPage({viewport:{width:800,height:680}});
  for(const [i,id] of ['coffee','pastry','beans'].entries()){
    await p.goto(new URL('illustrations/'+id+'.svg',folder).href);
    await p.locator('svg').screenshot({path:fileURLToPath(new URL('art/daybreak-'+i+'.png',folder))});
  }
}finally{await browser.close();}
