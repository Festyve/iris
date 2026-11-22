const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const vault=path.join(__dirname,'..','vault');
const profiles=fs.readdirSync(path.join(vault,'Profiles')).filter(f=>f.endsWith('.md'))
  .map(f=>({f,text:fs.readFileSync(path.join(vault,'Profiles',f),'utf8')}))
  .map(p=>({...p,meta:Object.fromEntries(((p.text.match(/^---\n([\s\S]*?)\n---/)||[])[1]||'').split('\n').map(l=>l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]))}))
  .filter(p=>p.meta.id);
test('every design profile has a unique id, a name, a tagline and three reference images that exist',()=>{
  assert.ok(profiles.length>=10);
  assert.equal(new Set(profiles.map(p=>p.meta.id)).size,profiles.length);
  for(const p of profiles){
    assert.ok(p.meta.name&&p.meta.tagline,p.f);
    const refs=p.meta.refs.replace(/^\[|\]$/g,'').split(',').map(s=>s.trim()).filter(Boolean);
    assert.equal(refs.length,3,p.f);
    for(const r of refs)assert.ok(fs.existsSync(path.join(vault,r)),p.f+' missing '+r);
  }
});
test('every image embedded in a vault note exists',()=>{
  const notes=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name.startsWith('.')||e.name==='assets')continue;const f=path.join(d,e.name);e.isDirectory()?walk(f):f.endsWith('.md')&&notes.push(f)}})(vault);
  let count=0;
  for(const n of notes)for(const [,src] of fs.readFileSync(n,'utf8').matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)){
    if(/^https?:/.test(src))continue;count++;
    assert.ok(fs.existsSync(path.resolve(path.dirname(n),src)),path.relative(vault,n)+' -> '+src);
  }
  assert.ok(count>300);
});
