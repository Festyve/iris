import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {websiteDesign,websiteEdit} from '../references/planner.mjs';
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
    assert.equal(b.screens.flatMap(s=>s.layers).length,doc.nodes.length,id);
    assert.equal(b.screens.length,3);assert.ok(doc.nodes.length>=200,id);
    for(const s of doc.screens)assert.ok(sites.includes(s.vaultSource+'.png'));
    assert.ok(b.screens[0].layers.length>=5,id);
    assert.ok(doc.reference.vaultOnly);
  }
});
test('poker retrieves a gallery and actual game imagery, and unsupported subjects still build',async()=>{
  const {doc}=await websiteDesign('poker',root);
  assert.equal(doc.reference.id,'metalforge'); assert.match(doc.reference.image,/game|pixel/i);
  assert.ok(doc.nodes.some(n=>n.text==='No-limit Hold’em'));
  assert.ok(doc.nodes.some(n=>n.text==='Join waitlist'));
  for(const word of ['quokka','星空','🪐']){
    const site=(await websiteDesign(word,root)).doc;
    assert.ok(site.nodes.some(n=>n.text===word || n.text===word.charAt(0).toUpperCase()+word.slice(1)));
    assert.equal(site.reference.fallback,true);
    Screens.checkBoard(Doc.compile(site));
  }
  assert.equal(await websiteDesign('a native mobile app',root),null);
});
test('initial generation stays local, every shape comes from its named setup, and no vault fails closed',async()=>{
  const {doc}=await websiteDesign('A bank website called "Cedar"',root,()=>assert.fail('initial model call'));
  const templates=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../references/sites.json',import.meta.url)));
  const raster=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../references/raster-layouts.json',import.meta.url)));
  for(const n of doc.nodes) {
    const setup=doc.screens.find(s=>s.id===n.parent).vaultSource;
    const rows=n.type==='shape'?raster[setup].shapes:templates[setup].text;
    const row=rows[Number(n.id.match(/\d+$/)[0])];
    assert.deepEqual([n.x,n.y,n.w,n.h],row.slice(0,4));
    if(n.type==='shape')assert.equal(n.fill,row[4]);
  }
  await assert.rejects(websiteDesign('unknown website subject',''),/vault/);
});
test('a requested edit calls the model once, contains no image payload, and rejects invented geometry',async()=>{
  const {doc}=await websiteDesign('a website called "Cedar"',root);
  let calls=0,changed;
  const {ops}=await websiteEdit(doc,'Rename Cedar to Laurel',async(_,input)=>{
    calls++;let ctx=JSON.parse(input);changed=ctx.nodes.find(n=>n[2]==='Cedar')[0];
    assert.ok(input.length<20000);assert.ok(!input.includes('base64'));
    return {changes:[{id:changed,text:'Laurel',x:1500},{id:'invented',text:'BAD'},{addPage:'outside-the-vault'}]};
  });
  assert.equal(calls,1);assert.equal(ops.length,1);assert.equal(ops[0].id,changed);assert.equal(ops[0].node.text,'Laurel');assert.equal(ops[0].node.x,undefined);
});

test('coffee and travel briefs compose their domain pages and retain the requested city',async()=>{
  const {doc}=await websiteDesign('coffee shop called “Juniper”',root);
  assert.equal(doc.name,'Juniper');
  assert.deepEqual(Array.from(doc.screens,s=>s.name.split(' · ')[1]),['Home','Menu','Order','Visit']);
  assert.ok(doc.nodes.some(n=>n.text==='Whole bean'));
  const trip=(await websiteDesign('a Tokyo travel planner',root)).doc;
  assert.equal(trip.reference.city,'Tokyo');
  assert.ok(trip.nodes.some(n=>n.text==='Ueno Park'));
});
