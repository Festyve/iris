import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {websiteDesign} from '../references/planner.mjs';
import {Doc} from '../designer.mjs';
import Screens from '../screen-spec.cjs';
import {catalog} from '../references/catalog.mjs';
import Match from '../references/match.js';

const root=fileURLToPath(new URL('../vault/',import.meta.url));
test('every captured site can be rebuilt by name with native text and artwork',async()=>{
  const sites=await readdir(root+'/assets/sites');
  const assets=await catalog(root);
  assert.ok(assets.length>300);
  for (const file of sites) {
    const id=file.replace('.png',''), note='recreate '+id;
    const m=Match.select(note,assets,sites.map(s=>s.slice(0,-4)));
    assert.equal(m.id,id); assert.equal(m.exact,true,id);
    const {doc}=await websiteDesign(note,root,()=>assert.fail('exact captures are local'));
    assert.equal(doc.reference.id,id); assert.ok(doc.nodes.some(n=>n.type==='text'));
    const b=Screens.checkBoard(Doc.compile(doc));
    assert.equal(b.screens[0].layers.length,doc.nodes.length,id);
    assert.ok(b.screens[0].layers.length>=5,id);
    assert.ok(Buffer.byteLength(JSON.stringify(doc))<98000,'fits in Figma page plugin data');
  }
});
test('poker retrieves a gallery and actual game imagery, and unsupported subjects still build',async()=>{
  const {doc}=await websiteDesign('poker',root);
  assert.equal(doc.reference.id,'metalforge'); assert.match(doc.reference.image,/game|pixel/i);
  assert.ok(doc.nodes.some(n=>n.text==='No-limit Hold’em'));
  assert.ok(doc.nodes.some(n=>n.name==='Playing card'));
  for(const word of ['quokka','星空','🪐']){
    const site=(await websiteDesign(word,root)).doc;
    assert.ok(site.nodes.some(n=>n.text===word || n.text===word.charAt(0).toUpperCase()+word.slice(1)));
    assert.equal(site.reference.fallback,true);
    Screens.checkBoard(Doc.compile(site));
  }
  assert.equal(await websiteDesign('a native mobile app',root),null);
});
test('custom model requests receive the screenshot, supporting image and editable reference geometry',async()=>{
  let calls=0;
  const {doc}=await websiteDesign('a banking website called "Cedar"',root,async(system,content)=>{
    calls++; assert.match(system,/reference composition/);
    const images=content.filter(c=>c.type==='image');
    assert.equal(images.length,2); assert.ok(images.every(i=>i.source.data.length>100));
    const text=content.at(-1).text;
    assert.match(text,/Cedar/);assert.match(text,/stripe\//);
    return {summary:'Added an account action',ops:[{op:'add',parent:'web',node:{id:'account',name:'Account action',type:'text',text:'Open an account',x:20,y:100}}]};
  });
  assert.equal(calls,1); assert.equal(doc.reference.id,'stripe'); assert.ok(doc.nodes.find(n=>n.id==='account'));
});
