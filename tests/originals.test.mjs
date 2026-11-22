import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {originals} from '../references/originals.mjs';
import {websiteDesign,websiteEdit} from '../references/planner.mjs';
import {Doc} from '../designer.mjs';
import Screens from '../screen-spec.cjs';

test('all original page references compile with editable layers and existing artwork',async()=>{
  const root=new URL('../vault/Originals/',import.meta.url);
  const ids=new Set();
  for(const f of originals.families){
    for(let i=0;i<3;i++){
      const png=await readFile(new URL('art/'+f.id+'-'+i+'.png',root));
      assert.equal(png.readUInt32BE(16),800);
      assert.equal(png.readUInt32BE(20),680);
    }
    for(const role of originals.rolesFor(f)){
      const {doc}=await websiteDesign(f.name+' '+role,new URL('../vault/',import.meta.url).pathname);
      const board=Screens.checkBoard(Doc.compile(doc));
      assert.equal(board.screens[0].name,f.name+' · '+role);
      for(const n of board.screens[0].layers){
        assert.ok(n.x>=0 && n.y>=0 && n.x+n.w<=1440 && n.y+n.h<=900,n.name);
        if(n.art)assert.ok(n.art.startsWith(f.id+'/v3/'));
      }
      const preview=await readFile(new URL('pages/'+f.id+'/'+role.toLowerCase()+'.svg',root),'utf8');
      assert.ok(preview.includes('<image ') || (f.id==='paper-miles' && ['Itinerary','Routes'].includes(role)));
      ids.add(f.id+'/'+role);
    }
  }
  assert.equal(ids.size,631);
});
test('subjects and named briefs retrieve an original family and can add its pages',async()=>{
  const {doc}=await websiteDesign('a bouldering gym called "Crux"',new URL('../vault/',import.meta.url).pathname);
  assert.equal(doc.name,'Crux');assert.equal(doc.reference.id,'boulder-yard');
  const {ops}=await websiteEdit(doc,'Add a programme page',async()=>({changes:[{addPage:'Programme'}]}));
  assert.equal(ops[0].screen.name,'Crux · Programme');
  assert.ok(ops.some(op=>op.node?.art==='boulder-yard/v3/1'));
});

test('linked reference names retrieve the corresponding vault collections',async()=>{
  const root=new URL('../vault/',import.meta.url).pathname;
  for(const f of originals.families)for(const [,site,url] of f.sources){
    const {doc}=await websiteDesign(site+' website',root);
    assert.equal(doc.reference.id,f.id,site);
    assert.ok(doc.reference.sources.some(s=>s.url===url),site);
  }
  assert.equal((await websiteDesign('road trip planner',root)).doc.reference.id,'mile-marker');
});
