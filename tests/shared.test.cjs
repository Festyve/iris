const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const Shared=vm.runInNewContext(readFileSync(join(__dirname,'..','shared.js'),'utf8')+'; Shared');
test('one shared screen ramps to 100 active tagged cursors before completing',()=>{
  const targets=[{x:0,y:0,w:160,h:60},{x:90,y:40,w:40,h:50}];
  const jobs=Shared.makeJobs(100,targets,300,200);
  assert.equal(jobs.length,100);
  assert.equal(new Set(jobs.map(j=>Shared.badge(j.id))).size,100);
  const visits=[];
  const tick=time=>Shared.advance(jobs,time,()=>{},(target,stage,id)=>visits.push([id,stage]));
  assert(tick(.3).active<100);
  assert.equal(tick(3).active,100);assert.equal(tick(30).done,100);
  assert.equal(visits.length,300);assert.equal(new Set(visits.map(String)).size,300);
  assert.equal(tick(31).active,0);assert.equal(visits.length,300);
});
