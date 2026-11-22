const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Screens=require('../screen-spec.cjs');
const source=['shared.js','create-screen.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
const {Shared,screenJobs}=vm.runInNewContext(source+';({Shared,screenJobs})');
test('three distinct local screens and clear unsupported-brief behavior',()=>{
 const screens=['train','kanban','spending'].map(s=>Screens.starter(s+' called "Test"'));
 assert.deepEqual(screens.map(s=>s.name),['Test','Test','Test']);assert.equal(screens[0].width,390);assert.equal(screens[1].width,1040);
 assert.deepEqual(screens.map(s=>s.layers.some(l=>l.text==='Recent activity')),[false,false,true]);
 assert.throws(()=>Screens.starter('A pottery kiln scheduler'),/Connect Gemini/);
});
test('all layer operations execute exactly once with any supported cursor count, within six seconds',()=>{
 for(const c of [5,25,100]){
   const screen=Screens.starter('kanban'),jobs=screenJobs(c,screen),drawn=[];
   const stats=Shared.advance(jobs,6,()=>{},slice=>{for(let i=slice.first;i<slice.last;i++)drawn.push(i)});
   assert.equal(stats.done,c);assert.deepEqual(drawn.sort((a,b)=>a-b),screen.layers.map((_,i)=>i));
 }
});
test('rejects out-of-bounds or unrenderable AI plans',()=>{
 const s=Screens.starter('bus stop');s.layers[0].x=s.width;assert.throws(()=>Screens.check(s),/geometry/);
});
