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
    assert.equal(b.screens.length,3);assert.ok(doc.nodes.length>=60,id);
    // Companion pages are themed from the same capture, so every screen shares its source.
    for(const s of doc.screens)assert.equal(s.vaultSource,id,id);
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
    assert.equal(site.reference.minimal,true);
    Screens.checkBoard(Doc.compile(site));
  }
  assert.equal(await websiteDesign('a native mobile app',root),null);
});
test('initial generation stays local, every shape comes from its named setup, and no vault fails closed',async()=>{
  const {doc}=await websiteDesign('A bank website called "Cedar" like Stripe',root,()=>assert.fail('initial model call'));
  const templates=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../references/sites.json',import.meta.url)));
  const raster=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../references/raster-layouts.json',import.meta.url)));
  for(const n of doc.nodes) {
    if(n.parent!=='web') continue; // Companion pages are composed, not traced.
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

test('custom briefs get the Iris Minimal template with fitting copy, varied layouts and one art family',async()=>{
  const briefs=['Dick','a law firm website','a dog grooming salon','an online course platform for designers','a budgeting app website called "Cedar"',
    'a sneaker brand called Arc','a nonprofit for river cleanup','a yoga studio called Still','quokka','a website for an AI note-taking startup called "Lumen"'];
  const kits={'a law firm website':'service','a dog grooming salon':'pets','an online course platform for designers':'learn',
    'a budgeting app website called "Cedar"':'finance','a sneaker brand called Arc':'shop','a yoga studio called Still':'health','Dick':'general'};
  const families=new Set(), layouts=new Set();
  for(const brief of briefs){
    const {doc}=await websiteDesign(brief,root);
    assert.equal(doc.reference.minimal,true,brief);
    if(kits[brief])assert.equal(doc.reference.kit,kits[brief],brief);
    assert.equal(doc.screens.length,3);
    const board=Screens.checkBoard(Doc.compile(doc));
    for(const s of board.screens)for(const n of s.layers)assert.ok(n.x>=0 && n.y>=0 && n.x+n.w<=1440.5 && n.y+n.h<=900.5,brief+': '+n.name);
    const art=doc.nodes.filter(n=>n.art).map(n=>n.art.split('/')[0]);
    assert.ok(art.length>=3);assert.equal(new Set(art).size,1,brief);
    families.add(art[0]);layouts.add(doc.reference.seed%3);
    assert.ok(!doc.nodes.some(n=>/Noa Arden|Estonian|Cloudmere/.test(n.text||'')),brief);
  }
  assert.ok(families.size>=6,'briefs draw on varied vault art');assert.equal(layouts.size,3);
  const {doc}=await websiteDesign('a minimal coffee shop',root);
  assert.equal(doc.reference.minimal,true);assert.equal(doc.reference.kit,'food');
  assert.equal((await websiteDesign('recreate stripe',root)).doc.reference.minimal,undefined);
  assert.equal((await websiteDesign('poker',root)).doc.reference.id,'metalforge');
});
test('a minimal website can add one of its own pages by edit',async()=>{
  const {doc}=await websiteDesign('a law firm website',root);
  const missing=['Offer','Story','Contact'].find(r=>!doc.screens.some(s=>s.name.endsWith(r==='Offer'?'Services':r==='Story'?'Approach':'Contact')));
  const {ops}=await websiteEdit(doc,'Add a page',async()=>({changes:[{addPage:missing}]}));
  assert.equal(ops[0].op,'addScreen');
  assert.ok(ops.filter(op=>op.op==='add').every(op=>!op.node.art || op.node.art.startsWith(doc.reference.id+'/v3/')));
});
