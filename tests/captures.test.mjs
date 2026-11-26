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
  assert.equal(new Set(Object.values(brands)).size,27);
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

test('website image fills reassemble every capture losslessly outside editable type',async()=>{
  const {rasterSite}=await import('../references/raster.mjs');
  const sites=JSON.parse(await readFile(new URL('../references/sites.json',import.meta.url)));
  const stored=JSON.parse(await readFile(new URL('../references/raster-layouts.json',import.meta.url)));
  for(const [id,site] of Object.entries(sites)){
    const {layout,images}=await rasterSite(root,id,site);
    // Crop and accent metadata is added by build.mjs for companion pages; the reassembly layout must match exactly.
    const {accent,crops,cropScores,...base}=stored[id];
    assert.deepEqual(layout,base,id);
    const expected=PNG.sync.read(await capture(root,id));
    const assembled=new PNG({width:expected.width,height:expected.height});
    for(const [i,[x,y,w,h,fill,image]] of layout.shapes.entries()){
      if(image){
        const part=PNG.sync.read(Buffer.from(images[id+'/v3/'+i],'base64'));
        assert.deepEqual([part.width,part.height],[w,h]);
        PNG.bitblt(part,assembled,0,0,w,h,x,y);
      }else{
        const color=Buffer.from(fill.slice(1)+'ff','hex');
        for(let row=y;row<y+h;row++)assembled.data.fill(color,(row*assembled.width+x)*4,(row*assembled.width+x+w)*4);
      }
    }
    for(const [i] of layout.text){
      const [x,y,w,h]=site.text[i];
      if(id==='metalforge')assert.ok(y<224 || x<240,'gallery thumbnail must retain its original lettering');
      const l=Math.max(0,x-4),t=Math.max(0,y-4);
      PNG.bitblt(expected,assembled,l,t,Math.min(1440,x+w+4)-l,Math.min(900,y+h+4)-t,l,t);
    }
    assert.ok(assembled.data.equals(expected.data),id+' lost artwork pixels');
  }
});
