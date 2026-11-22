import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {websiteDesign,websiteEdit} from '../references/planner.mjs';
import {Doc} from '../designer.mjs';
import Screens from '../screen-spec.cjs';
const root=fileURLToPath(new URL('../vault/',import.meta.url));
const index=JSON.parse(await readFile(root+'Code/sites.json','utf8'));

test('each source resolves to its checked-in HTML and yields editable desktop and mobile frames',async()=>{
  for(const site of index){
    const html=await readFile(root+'Code/'+site.group+'/'+site.file+'.html','utf8');
    assert.match(site.revision,/^[a-f0-9]{40}$/);assert.match(html,/data-copy="brand"/);
    assert.doesNotMatch(html,/<script|<iframe|\sonclick=/i);
    const {doc}=await websiteDesign(site.id+' website called “West Fold”',root);
    assert.equal(doc.reference.id,site.id);assert.equal(doc.reference.kind,'html-css');
    assert.ok(doc.screens.some(s=>s.w===390));assert.ok(doc.screens.some(s=>s.w===1440));
    assert.ok(doc.nodes.some(n=>n.text==='West Fold'));
    assert.ok(doc.nodes.every(n=>!/(start bootstrap|milligram|skeleton|business casual|clean blog)/i.test(n.text||'')));
    Screens.checkBoard(Doc.compile(doc));
  }
});
test('coffee retrieves the imported menu and unknown words still select an imported page',async()=>{
  const {doc}=await websiteDesign('coffee shop called “Juniper”',root);
  assert.deepEqual(Array.from(doc.screens,s=>s.vaultSource),['code-cafe','code-cafe-products','code-cafe']);
  assert.equal((await websiteDesign('Tokyo travel planner',root)).doc.reference.id,'code-journal');
  for(const note of ['星空','🪐','quokka'])assert.equal((await websiteDesign(note,root)).doc.reference.kind,'html-css');
  assert.equal(await websiteDesign('a native mobile app',root),null);
  await assert.rejects(websiteDesign('a site',''),/vault/);
});
test('a subsequent edit accepts new copy and only adds pages with real source code',async()=>{
  const {doc}=await websiteDesign('a website called “Cedar”',root);
  let calls=0;
  const {ops}=await websiteEdit(doc,'change the title and add a page',async(_,input)=>{
    calls++;const c=JSON.parse(input);const id=c.nodes.find(n=>n[2]==='Cedar')[0];
    return {changes:[{id,text:'A longer name for an independent design practice'},{addPage:'stripe'},{addPage:'code-journal',title:'Notes'}]};
  });
  assert.equal(calls,1);assert.ok(ops.some(o=>o.node?.text?.startsWith('A longer name')));
  assert.deepEqual(ops.filter(o=>o.op==='addScreen').map(o=>o.screen.vaultSource),['code-journal']);
  Screens.checkBoard(Doc.compile(Doc.apply(doc,ops).doc));
});
