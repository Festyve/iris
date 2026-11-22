import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
import {brands,capture} from '../references/captures.mjs';
import {websiteDesign} from '../references/planner.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../vault',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../references/brand-patches.json',import.meta.url),'utf8'));

test('each gallery reference is rebranded and all pixels outside listed patches are identical',async()=>{
  assert.equal(new Set(Object.values(brands)).size,22);
  for(const [id,name] of Object.entries(brands)){
    const original=PNG.sync.read(await readFile(root+'/assets/sites/'+id+'.png'));
    const rendered=PNG.sync.read(await capture(root,id));
    assert.equal(rendered.width,1440);assert.equal(rendered.height,900);
    assert.notDeepEqual(rendered.data,original.data,id);
    for(const [x,y,bytes] of manifest[id].patches){
      const area=PNG.sync.read(Buffer.from(bytes,'base64'));
      PNG.bitblt(rendered,original,x,y,area.width,area.height,x,y);
    }
    assert.ok(original.data.equals(rendered.data),id+' changed outside its patch');
    const {doc}=await websiteDesign('recreate '+id,root);
    assert.equal(doc.name,name);
    if(id==='stripe')assert.ok(doc.nodes.every(n=>!(/stripe/i.test(n.text || ''))));
  }
  await assert.rejects(capture(root,'../private'),/Unknown/);
});
