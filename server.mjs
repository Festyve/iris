import Screens from './screen-spec.cjs';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const secret=randomBytes(24).toString('hex');
const origin='http://localhost:4739';
const designKey=process.env.GEMINI_API_KEY,voiceKey=process.env.ELEVENLABS_API_KEY;
const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const bundledVault=fileURLToPath(new URL('./vault',import.meta.url));
const vaultDir=process.env.IRIS_VAULT||(existsSync(bundledVault)?bundledVault:'');
let agentId=process.env.ELEVENLABS_AGENT_ID||'';
if(!agentId)try{agentId=JSON.parse(await readFile(new URL('./.iris-agent.json',import.meta.url),'utf8')).agentId||''}catch{}
const eleven=voiceKey?new ElevenLabsClient({apiKey:voiceKey}):null;
const schema={type:'OBJECT',properties:{
  composition:{type:'STRING',enum:['auto','stack','overlap']},align:{type:'STRING',enum:['left','right']},
  heroScale:{type:'NUMBER'},datePosition:{type:'STRING',enum:['top','bottom']},
  focus:{type:'STRING',enum:['Hero','Title','Date','Venue','Label']},reason:{type:'STRING'}
},required:['composition','align','heroScale','datePosition','focus','reason']};
const artDirection='You are the mobile art director for a print fair poster. You have an editable 390 by 670 mobile frame. The input describes the desktop design and current mobile controls. Interpret the new instruction, retaining prior choices unless superseded. For big art and legible logistics, put the date on the quieter edge. For an expressive or loud design, try intentional overlap and a larger hero. For precise, editorial hierarchy, stack the title and image and share a left edge. These are references, not requirements. Supported edits: composition (stack/overlap/auto), mobile title, date and venue alignment (left/right), scale of the hero (0.65 to 1.35), and date position (top/bottom). Choose the closest supported edit; if impossible keep previous values and explain. Return one short specific sentence describing the choice and the primary affected layer as focus.';
async function collect(req,limit){const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>limit)throw Error('Request is too large');chunks.push(c)}return Buffer.concat(chunks)}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
async function requestPlan(instruction,format,parts){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':designKey},signal:AbortSignal.timeout(28000),body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseSchema:format}})});
  if(!r.ok)throw Error('Design service returned '+r.status+'. Check the model, key and quota.');
  const raw=await r.json();return JSON.parse(raw.candidates?.[0]?.content?.parts?.filter(x=>!x.thought).map(x=>x.text||'').join('')||'{}');
}

async function newScreen(req,res){
  if(!designKey)return json(res,503,{error:'Set GEMINI_API_KEY and restart the server.'});
  const {note,profile}=JSON.parse((await collect(req,10000)).toString());
  if(typeof note!=='string'||!note.trim()||note.length>700)return json(res,400,{error:'Enter a brief of up to 700 characters.'});
  const str={type:'STRING'},num={type:'NUMBER'},integer={type:'INTEGER'};
  const layer={type:'OBJECT',properties:{name:str,kind:{type:'STRING',enum:['text','rect','ellipse']},x:num,y:num,w:num,h:num,fill:str,radius:num,text:str,size:num,bold:{type:'BOOLEAN'}},required:['name','kind','x','y','w','h','fill']};
  const format={type:'OBJECT',properties:{name:str,width:integer,height:integer,background:str,layers:{type:'ARRAY',items:layer}},required:['name','width','height','background','layers']};
  const prompt='You are Iris, a product designer. Design exactly one original, polished UI screen for the user brief. Choose a suitable mobile or desktop viewport (240–1920 wide, 240–2400 high). Return ordered editable primitives from back to front, ideally 25–65 layers. Every layer must be fully within the frame, with positive w and h, a useful name and a six-digit hex fill. Background is also a six-digit hex color. For text, supply text, size 8–110, optional bold, and enough height and width for all characters. Use short realistic copy specific to the product. Use whitespace, hierarchy, distinct information regions and legible contrast. Use rects with radius, ellipses and text for components. No external assets or code.';
  try{
    const style=await profileParts(profile);
    const generated=await requestPlan(prompt+style.instruction,format,[{text:note},...style.images]);
    return json(res,200,{screen:Screens.check(generated)});
  }catch(e){return json(res,502,{error:e.message||'Could not generate the screen. Try again.'})}
}
async function design(req,res,swarm=false){
  if(!designKey)return json(res,503,{error:'Set GEMINI_API_KEY and restart the server.'});
  const d=JSON.parse((await collect(req,3_500_000)).toString());
  if(!d.source?.layers||!d.plan||typeof d.note!=='string'||!d.note.trim()||d.note.length>700)return json(res,400,{error:'Invalid design request.'});
  const style=await profileParts(d.profile,1);
  const parts=[{text:JSON.stringify({desktop:d.source,currentMobile:d.plan,instruction:d.note})+style.instruction}];
  if(d.png&&typeof d.png==='string'&&d.png.startsWith('iVBOR')&&/^[A-Za-z0-9+/=]+$/.test(d.png))parts.push({inlineData:{mimeType:'image/png',data:d.png}});
  const fleetSchema={type:'OBJECT',properties:{reason:{type:'STRING'},patches:{type:'ARRAY',items:{type:'OBJECT',properties:{index:{type:'INTEGER'},band:{type:'STRING',enum:['compact','medium','wide']},dx:{type:'NUMBER'},dy:{type:'NUMBER'},scale:{type:'NUMBER'}},required:['index','band','dx','dy','scale']}}},required:['reason','patches']};
  const fleetPrompt='Act as the art director coordinating layout workers on a shared Figma product. Examine the source PNG, its indexed child layers, and the user direction. Return a few purposeful responsive adjustments to a proportionally adapted base layout, by actual layer index and viewport band: compact below 600, medium below 950, wide otherwise. dx and dy are offsets in fractions of frame width/height, -0.25 to 0.25. Scale is 0.7 to 1.35. Keep important text legible and preserve intentional relationships. You may leave a band or layer alone. Use at most 24 patches, one per index and band. Explain what you are directing in one sentence.';
  let p;
  try{p=await requestPlan(swarm?fleetPrompt:artDirection,swarm?fleetSchema:schema,parts)}
  catch(e){return json(res,502,{error:e.message})}
  if(swarm){
    if(!Array.isArray(p.patches)||typeof p.reason!=='string'||!Array.isArray(d.source.layers))return json(res,502,{error:'Invalid cursor assignments.'});
    const seen=new Set(),patches=[];
    for(const v of p.patches.slice(0,24)){
      if(!v||!Number.isInteger(v.index)||v.index<0||v.index>=d.source.layers.length||!['compact','medium','wide'].includes(v.band)||![v.dx,v.dy,v.scale].every(Number.isFinite))continue;
      const key=v.index+'/'+v.band;if(seen.has(key))continue;seen.add(key);
      patches.push({index:v.index,band:v.band,dx:Math.max(-.25,Math.min(.25,v.dx)),dy:Math.max(-.25,Math.min(.25,v.dy)),scale:Math.max(.7,Math.min(1.35,v.scale))});
    }
    return json(res,200,{patches,reason:p.reason.slice(0,350)});
  }
  if(!schema.properties.composition.enum.includes(p.composition)||!schema.properties.align.enum.includes(p.align)||!schema.properties.datePosition.enum.includes(p.datePosition)||!schema.properties.focus.enum.includes(p.focus)||!Number.isFinite(p.heroScale)||typeof p.reason!=='string')return json(res,502,{error:'The design service returned an incomplete layout. Try again.'});
  json(res,200,{plan:{composition:p.composition,align:p.align,datePosition:p.datePosition,heroScale:Math.max(.65,Math.min(1.35,p.heroScale))},focus:p.focus,reason:p.reason.slice(0,350)});
}
async function voice(req,res){
  if(!voiceKey)return json(res,503,{error:'Set ELEVENLABS_API_KEY and restart the server.'});
  const bytes=await collect(req,6_000_000),mime=(req.headers['content-type']||'audio/webm').split(';')[0];
  const form=new FormData();form.append('model_id','scribe_v2');form.append('file',new Blob([bytes],{type:mime}),'note.'+(mime.split('/')[1]||'webm'));
  const r=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':voiceKey},body:form,signal:AbortSignal.timeout(28000)});
  if(!r.ok)return json(res,502,{error:'ElevenLabs returned '+r.status+'. Check audio, key and quota.'});
  const result=await r.json();json(res,200,{text:String(result.text||'').slice(0,700)});
}

// ---- Talk to Iris: ElevenLabs agent sessions, studio bridge, critique and references ----
async function voiceSession(res){
  if(!eleven)return json(res,503,{error:'Set ELEVENLABS_API_KEY and restart the server.'});
  if(!agentId)return json(res,503,{error:'No Iris agent yet. Run npm run agent, then restart the server.'});
  try{const r=await eleven.conversationalAi.conversations.getWebrtcToken({agentId});json(res,200,{conversationToken:r.token})}
  catch(e){json(res,502,{error:'ElevenLabs could not start a voice session ('+(e.statusCode||e.message)+'). Check the key and agent.'})}
}
// The Figma plugin keeps an event stream open; the voice window sends tool calls through it.
const studios=new Set(),pending=new Map();let commandNo=0;
function openBridge(req,res){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store',Connection:'keep-alive'});
  res.write('retry: 2000\n\n');studios.add(res);
  const ping=setInterval(()=>res.write(': ping\n\n'),15000);
  req.on('close',()=>{clearInterval(ping);studios.delete(res)});
}
async function relay(req,res){
  const {tool,args}=JSON.parse((await collect(req,20000)).toString());
  const studio=[...studios].pop();
  if(!studio)return json(res,409,{error:'No Figma plugin is connected.'});
  const id=++commandNo;
  const result=await new Promise(resolve=>{
    const timer=setTimeout(()=>{pending.delete(id);resolve({error:'Figma did not answer in time.'})},115000);
    pending.set(id,{resolve,timer});
    studio.write('data: '+JSON.stringify({id,tool:String(tool),args:args||{}})+'\n\n');
  });
  json(res,200,{result});
}
async function relayResult(req,res){
  const {id,result}=JSON.parse((await collect(req,200000)).toString());
  const p=pending.get(id);if(p){clearTimeout(p.timer);pending.delete(id);p.resolve(result)}
  json(res,200,{ok:!!p});
}
async function requestText(instruction,parts){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':designKey},signal:AbortSignal.timeout(28000),body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:'user',parts}]})});
  if(!r.ok)throw Error('Design service returned '+r.status+'.');
  const raw=await r.json();return (raw.candidates?.[0]?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('').trim();
}
async function critique(req,res){
  const d=JSON.parse((await collect(req,3_500_000)).toString());
  const question=String(d.question||'general critique').slice(0,300);
  if(!designKey)return json(res,200,{critique:'',note:'Vision critique needs GEMINI_API_KEY; judge from the layer list instead.'});
  const style=await profileParts(d.profile,0);
  const parts=[{text:JSON.stringify({question,frame:d.source})+style.instruction}];
  if(typeof d.png==='string'&&d.png.startsWith('iVBOR')&&/^[A-Za-z0-9+/=]+$/.test(d.png))parts.push({inlineData:{mimeType:'image/png',data:d.png}});
  const text=await requestText('You are Iris, a senior product designer looking over a colleague\'s shoulder at their Figma frame (image attached, with its layer list). Answer their question, or give a general critique. Reply in at most four short plain sentences meant to be spoken aloud: one thing that works, then the two highest-impact, specific improvements (hierarchy, spacing, alignment, contrast, type, copy). Name elements by what they are, never by hex code or layer id. No markdown.',parts);
  json(res,200,{critique:text.slice(0,900)});
}
let vaultCache=null;
async function vaultNotes(){
  if(vaultCache)return vaultCache;const notes=[];
  async function walk(dir,depth){
    if(depth>6||notes.length>=3000)return;
    for(const e of await readdir(dir,{withFileTypes:true})){
      if(e.name.startsWith('.')||e.name==='node_modules')continue;const full=join(dir,e.name);
      if(e.isDirectory())await walk(full,depth+1);
      else if(e.name.endsWith('.md'))notes.push({title:basename(e.name,'.md'),body:(await readFile(full,'utf8')).slice(0,20000)});
    }
  }
  await walk(vaultDir,0);vaultCache=notes;setTimeout(()=>vaultCache=null,60000);return notes;
}
// Design profiles live in vault/Profiles/*.md: frontmatter (id, name, tagline, refs) plus a written style brief.
async function loadProfiles(){
  if(!vaultDir)return [];const dir=join(vaultDir,'Profiles');let files=[];
  try{files=(await readdir(dir)).filter(f=>f.endsWith('.md'))}catch{return []}
  const out=[];
  for(const f of files){
    const raw=await readFile(join(dir,f),'utf8'),m=raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);if(!m)continue;
    const meta={};for(const line of m[1].split('\n')){const kv=line.match(/^(\w+):\s*(.*)$/);if(kv)meta[kv[1]]=kv[2].trim().replace(/^["']|["']$/g,'')}
    if(!meta.id)continue;
    const brief=m[2].replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g,'$1').replace(/\n{3,}/g,'\n\n').trim();
    const refs=(meta.refs||'').replace(/^\[|\]$/g,'').split(',').map(r=>r.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
    out.push({id:meta.id,name:meta.name||meta.id,tagline:meta.tagline||'',order:Number(meta.order)||99,brief,refs});
  }
  return out.sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name));
}
const mimeOf=f=>f.endsWith('.png')?'image/png':f.endsWith('.webp')?'image/webp':'image/jpeg';
async function profileParts(id,maxImages=3){
  if(!id||typeof id!=='string')return {instruction:'',images:[]};
  const p=(await loadProfiles()).find(x=>x.id===id);if(!p)return {instruction:'',images:[]};
  const images=[];
  for(const ref of p.refs.slice(0,maxImages)){
    try{const file=join(vaultDir,ref.replace(/^\.\.\//,''));if(!file.startsWith(vaultDir))continue;
      images.push({inlineData:{mimeType:mimeOf(ref),data:(await readFile(file)).toString('base64')}})}catch{}
  }
  return {images,instruction:'\n\nFollow this design profile, "'+p.name+'" ('+p.tagline+'). Attached images are its references; borrow their palette, type, surfaces and spacing, never their content.\n'+p.brief.slice(0,2400)};
}
async function references(url,res){
  const q=(url.searchParams.get('q')||'').toLowerCase().slice(0,120);
  if(!vaultDir)return json(res,200,{results:[],note:'No reference vault connected (set IRIS_VAULT).'});
  const terms=q.split(/[^a-z0-9]+/).filter(t=>t.length>2);
  const scored=(await vaultNotes()).map(n=>{const t=n.title.toLowerCase(),b=n.body.toLowerCase();
    return {n,score:terms.reduce((s,w)=>s+(t.includes(w)?5:0)+Math.min(5,b.split(w).length-1),0)}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
  json(res,200,{results:scored.map(({n})=>({title:n.title,excerpt:n.body.replace(/^---[\s\S]*?---/,'').replace(/[#*>`\[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,420)}))});
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  try{
    if(!['localhost:4739','127.0.0.1:4739'].includes(req.headers.host))return json(res,403,{error:'Local host required.'});
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('./ui.html',import.meta.url)))}
    const url=new URL(req.url,origin);
    if(req.method==='GET'&&url.pathname==='/voice.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('./voice.bundle.js',import.meta.url)))}
    if(req.method==='GET'&&url.pathname==='/bridge'){if(url.searchParams.get('key')!==secret)return json(res,401,{error:'Invalid session key.'});return openBridge(req,res)}
    if(req.headers.authorization!=='Bearer '+secret)return json(res,401,{error:'Invalid session key.'});
    if(req.method==='GET'&&req.url==='/status')return json(res,200,{design:!!designKey,voice:!!voiceKey,agent:!!(voiceKey&&agentId),studio:studios.size>0});
    if(req.method==='GET'&&url.pathname==='/voice/session')return await voiceSession(res);
    if(req.method==='POST'&&url.pathname==='/bridge/command')return await relay(req,res);
    if(req.method==='POST'&&url.pathname==='/bridge/result')return await relayResult(req,res);
    if(req.method==='POST'&&url.pathname==='/critique')return await critique(req,res);
    if(req.method==='GET'&&url.pathname==='/references')return await references(url,res);
    if(req.method==='GET'&&url.pathname==='/profiles')return json(res,200,{profiles:(await loadProfiles()).map(({id,name,tagline})=>({id,name,tagline}))});
    if(req.method==='POST'&&req.url==='/screen')return await newScreen(req,res);
    if(req.method==='POST'&&req.url==='/swarm')return await design(req,res,true);
    if(req.method==='POST'&&req.url==='/design')return await design(req,res);
    if(req.method==='POST'&&req.url==='/voice')return await voice(req,res);
    json(res,404,{error:'Unknown endpoint.'});
  }catch(e){if(res.headersSent)return res.end();json(res,400,{error:e.name==='TimeoutError'?'Service timed out. Try again.':'Request could not be completed. Check the input and service connection.'})}
});
server.on('error',e=>{console.error('Could not start local service: '+e.message);process.exitCode=1});
server.listen(4739,'127.0.0.1',()=>console.log('Iris\nBrowser: '+origin+'/#key='+secret+'\nFigma session key: '+secret));
