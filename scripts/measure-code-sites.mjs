import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {markup} from '../references/code-source.mjs';
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage();
  await page.addScriptTag({content:await readFile(new URL('../references/code-dom.js',import.meta.url),'utf8')});
  const layouts={};
  for(const [id,html] of Object.entries(markup)){
    layouts[id]={};
    for(const width of [1440,390]){
      const layout=await page.evaluate(([html,width])=>measureCodePage(html,width,'Your name'),[html,width]);
      if(!layout.nodes.some(n=>n.copyRole==='brand'))throw Error('Missing editable brand in '+id+' at '+width);
      layouts[id][width]=layout;
    }
  }
  await writeFile(new URL('../vault/Code/layouts.json',import.meta.url),JSON.stringify(layouts)+'\n');
}finally{await browser.close();}
