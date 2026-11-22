const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx=vm.createContext({});
for(const f of ['engine.js','swarm.js'])vm.runInContext(readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const {SC,Swarm}=vm.runInContext('({SC,Swarm})',ctx);
test('worker counts produce distinct, non-overlapping editable viewports',()=>{
  for(const count of [5,25,100]){
    const {items,width,height}=Swarm.configs(count);
    assert.equal(items.length*Swarm.roles.length,count);
    assert.equal(new Set(items.map(f=>f.width)).size,items.length);
    for(const f of items){
      assert(f.x+f.width<=width&&f.y+f.height<=height);
      for(const g of items)if(g.index!==f.index)assert(f.x+f.width<=g.x||g.x+g.width<=f.x||f.y+f.height<=g.y||g.y+g.height<=f.y);
    }
  }
});
test('each cursor finishes on its assigned node',()=>{
  for(let i=0;i<100;i++){
    const j=Swarm.worker(i,Math.floor(i/5),Swarm.roles[i%5]);
    assert.equal(Swarm.progress(j,0),0);assert.equal(Swarm.progress(j,7),1);
    const end={x:i*10,y:42},p=Swarm.position(j,1,{x:10,y:11},end);
    assert(Math.abs(p.x-end.x)<1e-8&&Math.abs(p.y-end.y)<1e-8);
  }
});
test('responsive planning preserves original geometry and changed content',()=>{
  const source=SC.base();source.layers.Title.text='All night';const before=JSON.stringify(source);
  for(const c of Swarm.configs(100).items){
    const m=Swarm.layout(source,{composition:'stack',heroScale:1.2,datePosition:'top'},c);
    assert.equal(m.layers.Title.text,'All night');assert.equal(m.width,c.width);
    assert(m.layers.Date.y<m.layers.Venue.y);assert(m.layers.Hero.w>0);
  }assert.equal(JSON.stringify(source),before);
});
test('directed patches apply only to the addressed layer and breakpoint',()=>{
  const a={index:2,band:'compact',dx:.1,dy:0,scale:1.2},goal={x:10,y:5,w:50,h:20,size:10};
  assert.equal(Swarm.adjustment([a],2,320),a);assert.equal(Swarm.adjustment([a],1,320),undefined);
  assert.equal(Swarm.adjustment([a],2,1200),undefined);
  const result=Swarm.adjust(goal,a,400,500);assert.equal(result.x,50);assert.equal(result.size,12);assert.equal(goal.x,10);
});
