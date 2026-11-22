import Screens from './screen-spec.cjs';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createVoiceService, VoiceServiceError } from './voice-service.mjs';
import { createAiPlanner, AiPlanningError } from './studio/ai-planner.mjs';
import { serviceRoute, integrationStatus, sponsors } from './studio/services.mjs';
import { serveStudio, handleVoice } from './studio/server.mjs';
const secret=randomBytes(24).toString('hex');
const origin='http://localhost:4739';
const designKey=process.env.GEMINI_API_KEY,voiceKey=process.env.ELEVENLABS_API_KEY;
const speech = createVoiceService({apiKey:voiceKey,voiceId:process.env.ELEVENLABS_VOICE_ID,
  sttModel:process.env.ELEVENLABS_STT_MODEL,ttsModel:process.env.ELEVENLABS_TTS_MODEL});
const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
const planner = createAiPlanner({apiKey: designKey, model});
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
  const {note}=JSON.parse((await collect(req,10000)).toString());
  if(typeof note!=='string'||!note.trim()||note.length>700)return json(res,400,{error:'Enter a brief of up to 700 characters.'});
  const str={type:'STRING'},num={type:'NUMBER'},integer={type:'INTEGER'};
  const layer={type:'OBJECT',properties:{name:str,kind:{type:'STRING',enum:['text','rect','ellipse']},x:num,y:num,w:num,h:num,fill:str,radius:num,text:str,size:num,bold:{type:'BOOLEAN'}},required:['name','kind','x','y','w','h','fill']};
  const format={type:'OBJECT',properties:{name:str,width:integer,height:integer,background:str,layers:{type:'ARRAY',items:layer}},required:['name','width','height','background','layers']};
  const prompt='You are Iris, a product designer. Design exactly one original, polished UI screen for the user brief. Choose a suitable mobile or desktop viewport (240–1920 wide, 240–2400 high). Return ordered editable primitives from back to front, ideally 25–65 layers. Every layer must be fully within the frame, with positive w and h, a useful name and a six-digit hex fill. Background is also a six-digit hex color. For text, supply text, size 8–110, optional bold, and enough height and width for all characters. Use short realistic copy specific to the product. Use whitespace, hierarchy, distinct information regions and legible contrast. Use rects with radius, ellipses and text for components. No external assets or code.';
  try{
    const generated=await requestPlan(prompt,format,[{text:note}]);
    return json(res,200,{screen:Screens.check(generated)});
  }catch(e){return json(res,502,{error:e.message||'Could not generate the screen. Try again.'})}
}
async function design(req,res,swarm=false){
  if(!designKey)return json(res,503,{error:'Set GEMINI_API_KEY and restart the server.'});
  const d=JSON.parse((await collect(req,3_500_000)).toString());
  if(!d.source?.layers||!d.plan||typeof d.note!=='string'||!d.note.trim()||d.note.length>700)return json(res,400,{error:'Invalid design request.'});
  const parts=[{text:JSON.stringify({desktop:d.source,currentMobile:d.plan,instruction:d.note})}];
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
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  try{
    if(!['localhost:4739','127.0.0.1:4739'].includes(req.headers.host))return json(res,403,{error:'Local host required.'});
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    if(await serveStudio(req,res))return;
    if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('./ui.html',import.meta.url)))}
    if(req.headers.authorization!=='Bearer '+secret)return json(res,401,{error:'Invalid session key.'});
    if(req.method==='GET'&&req.url==='/status')return json(res,200,{design:!!designKey,voice:speech.status().transcriptionConfigured,...speech.status(),...integrationStatus()});
    if(await serviceRoute(req,res,json,collect))return;
    if(req.method==='POST'&&req.url==='/studio-plan'){
      const stop = new AbortController();
      res.on('close', () => { if (!res.writableFinished) stop.abort(); });
      const {brief,references,previous,direction,runId} = JSON.parse((await collect(req,250_000)).toString());
      return json(res,200,await sponsors.withTrace({runId:runId || 'studio',taskId:'design'}, () => planner.plan({brief,references,previous,direction,signal:stop.signal})));
    }
    if(req.method==='POST'&&req.url==='/screen')return await newScreen(req,res);
    if(req.method==='POST'&&req.url==='/swarm')return await design(req,res,true);
    if(req.method==='POST'&&req.url==='/design')return await design(req,res);
    if(req.method==='POST'&&['/voice','/speech'].includes(req.url))return await handleVoice(req,res,speech);
    json(res,404,{error:'Unknown endpoint.'});
  }catch(e){
    if(res.headersSent||res.destroyed){res.destroy();return}
    if(e instanceof VoiceServiceError || e instanceof AiPlanningError)return json(res,e.status,{code:e.code,error:e.message});
    json(res,400,{error:e.name==='TimeoutError'?'Service timed out. Try again.':'Request could not be completed. Check the input and service connection.'})}
});
server.on('error',e=>{console.error('Could not start local service: '+e.message);process.exitCode=1});
server.listen(4739,'127.0.0.1',()=>console.log('Second Cursor\nStudio: '+origin+'/studio/#key='+secret+'\nIris adapter: '+origin+'/#key='+secret+'\nFigma session key: '+secret));
