const byId=id=>document.getElementById(id);
const plugin=parent!==window,api='http://localhost:4739';
if(plugin)document.body.classList.add('plugin');
let source=SC.base(),plan={...SC.initial},connected=false,version=0,focus='Title',recording,stream,token='',keepCount=0;
let customSource=false;
let service={design:false,voice:false},requestNo=0,reviewTimer;
function scheduleReview(){
  clearTimeout(reviewTimer);
  if(connected&&service.design&&byId('watch').checked)reviewTimer=setTimeout(()=>ask(true),1250);
}
const say=t=>byId('status').textContent=t;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sceneSvg(scene){
  const art='<rect width="100%" height="100%" fill="'+esc(scene.bg)+'"/>';
  return art+SC.roles.map(role=>{
    const n=scene.layers[role];
    if(role==='Hero')return '<g data-role="Hero" transform="translate('+n.x+' '+n.y+') scale('+n.w/400+' '+n.h/400+')" fill="'+esc(n.fill)+'">'+SC.petals()+'</g>';
    const x=n.align==='right'?n.x+n.w:n.x;
    return '<text data-role="'+role+'" x="'+x+'" y="'+(n.y+n.size*.84)+'" text-anchor="'+(n.align==='right'?'end':'start')+'" fill="'+esc(n.fill)+'" font-family="Inter,Arial,sans-serif" font-weight="'+(role==='Title'?900:600)+'" font-size="'+n.size+'" letter-spacing="'+(role==='Title'?-n.size*.065:.4)+'">'+n.text.split('\n').map((line,i)=>'<tspan x="'+x+'" dy="'+(i?n.size*.92:0)+'">'+esc(line)+'</tspan>').join('')+'</text>';
  }).join('');
}
function paint(id,scene,cursor){
  const el=byId(id);el.setAttribute('viewBox','0 0 '+scene.width+' '+scene.height);
  el.innerHTML=sceneSvg(scene);
  if(cursor){const n=scene.layers[focus]||scene.layers.Title;
    const x=Math.min(270,Math.max(10,n.x+20)),y=Math.min(625,n.y+20);
    el.innerHTML+='<g transform="translate('+x+' '+y+')"><path fill="#7846BF" stroke="white" stroke-width="2" d="M0 0L22 12L13 16L9 26Z"/><rect x="13" y="20" rx="4" width="94" height="21" fill="#7846BF"/><text x="19" y="35" fill="white" font-family="Arial" font-size="12">Iris</text></g>'}
}
function show(){
  if(!plugin){paint('desktop',source,false);paint('mobile',SC.mobile(source,plan),true)}
  for(const b of byId('presets').children)b.setAttribute('aria-pressed',String(b.dataset.value===plan.composition));
}
function update(p,target){
  plan=SC.normalize(p);focus=target||'Title';version++;show();
  if(plugin)parent.postMessage({pluginMessage:{kind:'apply',plan,focus}},'*');
}
for(const [value,text] of [['auto','Follow desktop'],['overlap','Overlap'],['stack','Stack']]){
  const b=document.createElement('button');b.textContent=text;b.dataset.value=value;
  b.onclick=()=>{update({...plan,composition:value},'Title');say('Preset applied · '+text)};byId('presets').appendChild(b);
}
byId('scale').oninput=e=>{const n=source.layers.Hero;n.w=n.h=Number(e.target.value);version++;show();scheduleReview()};
byId('headline').oninput=e=>{source.layers.Title.text=e.target.value.replace(/\s*\/\s*/g,'\n');version++;show();scheduleReview()};
const board=byId('desktop');let drag=null;
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(board.getScreenCTM().inverse())}
board.onpointerdown=e=>{const g=e.target.closest('[data-role]');if(!g)return;const role=g.dataset.role,n=source.layers[role],p=point(e);drag={role,dx:p.x-n.x,dy:p.y-n.y};board.setPointerCapture(e.pointerId)};
board.onpointermove=e=>{if(!drag)return;const p=point(e),n=source.layers[drag.role];n.x=Math.round(p.x-drag.dx);n.y=Math.round(p.y-drag.dy);focus=drag.role;version++;show();scheduleReview()};
board.onpointerup=board.onpointercancel=()=>drag=null;
byId('keep').onclick=()=>{if(plugin)parent.postMessage({pluginMessage:{kind:'keep'}},'*');else{keepCount++;const m=SC.mobile(source,plan);byId('saved').innerHTML='<figcaption>Kept version '+keepCount+'</figcaption><svg class="board" viewBox="0 0 390 670">'+sceneSvg(m)+'</svg>';say('Current mobile version kept below the canvas.')}};
window.addEventListener('message',e=>{const m=e.data&&e.data.pluginMessage;if(!m)return;if(m.kind==='scene'&&JSON.stringify(source)!==JSON.stringify(m.source)){source=m.source;version++;scheduleReview()}if(m.kind==='error')say(m.text)});
async function call(path,body,type){
  const headers={Authorization:'Bearer '+token};if(body)headers['Content-Type']=type||'application/json';
  const r=await fetch(api+path,{method:body?'POST':'GET',headers,body,signal:AbortSignal.timeout(35000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Service unavailable');return data;
}
async function connect(){
  token=byId('token').value.trim();connected=false;
  try{service=await call('/status');connected=true;byId('screen-mode').textContent=service.design?'Gemini designs a new screen from your brief.':'Local starters: transit, task board, spending. Connect Gemini for a custom screen.';byId('watchLabel').hidden=customSource||!service.design;byId('settings').open=false;if(typeof onServiceConnected==='function')onServiceConnected();
    say((service.design?'AI design connected':'Set GEMINI_API_KEY for AI design')+' · '+(service.voice?'voice connected':'voice key missing'))}
  catch(e){say('Connection failed. Check that the local server is running and the session key matches.')}
}
byId('connect').onclick=connect;
let snapshotSeq=0;
async function snapshot(){
  if(plugin){
    const id=++snapshotSeq;
    return new Promise((resolve,reject)=>{
      const done=e=>{const m=e.data&&e.data.pluginMessage;if(m&&m.kind==='snapshot'&&m.id===id){clearTimeout(timer);window.removeEventListener('message',done);if(m.png)resolve(m.png);else reject(Error('Could not render the desktop frame.'))}};
      const timer=setTimeout(()=>{window.removeEventListener('message',done);reject(Error('Frame preview timed out.'))},5000);
      window.addEventListener('message',done);parent.postMessage({pluginMessage:{kind:'snapshot',id}},'*');
    });
  }
  const image=new Image(),url=URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">'+sceneSvg(source)+'</svg>'],{type:'image/svg+xml'}));
  try{image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=720;canvas.height=450;canvas.getContext('2d').drawImage(image,0,0,720,450);return canvas.toDataURL('image/png').split(',')[1]}finally{URL.revokeObjectURL(url)}
}
function localDirection(note){
  const p={...plan},t=note.toLowerCase();let target='';
  if(/stack|separate/.test(t)){p.composition='stack';target='Title'}
  else if(/overlap/.test(t)){p.composition='overlap';target='Title'}
  if(/right.align|align.*right/.test(t)){p.align='right';target='Title'}
  if(/left.align|align.*left/.test(t)){p.align='left';target='Title'}
  if(/bigger|larger|huge/.test(t)&&/hero|art|flower/.test(t)){p.heroScale=1.28;target='Hero'}
  if(/smaller|shrink/.test(t)&&/hero|art|flower/.test(t)){p.heroScale=.77;target='Hero'}
  if(/date/.test(t)&&/top|header/.test(t)){p.datePosition='top';target='Date'}
  if(/date/.test(t)&&/bottom|footer/.test(t)){p.datePosition='bottom';target='Date'}
  if(target){update(p,target);say('Local direction applied · review the mobile proposal.')}
  else{say('Local mode supports stack, overlap, flower size, alignment and date placement. Connect AI for freeform direction.')}
}
async function ask(auto=false){
  const note=auto?'Adapt the latest desktop edit to mobile, preserving prior explicit mobile choices where possible.':byId('brief').value.trim();
  if(!note){say('Enter a design direction first.');return}
  if(!connected||!service.design){localDirection(note);return}
  const before=version,seq=++requestNo;say('Reviewing the layout…');
  try{const png=await snapshot();const result=await call('/design',JSON.stringify({source,plan,note,png,profile:byId('profile').value}));if(seq!==requestNo)return;
    if(before!==version){say('The design changed during review. Ask again with the current version.');return}
    update(result.plan,result.focus);say(result.reason)}
  catch(e){say(e.message)}
}
byId('apply').onclick=()=>ask();
async function transcribe(blob){
  const n=++requestNo;say('Transcribing with ElevenLabs…');
  try{const r=await call('/voice',blob,blob.type||'audio/webm');if(n!==requestNo)return;if(byId('formation').value==='create'){byId('screen-brief').value=r.text;say('Brief ready. Click Build new UI.');return}byId('brief').value=r.text;if(service.design&&!customSource)await ask();else say('Direction ready. Launch the swarm to apply it.')}catch(e){say(e.message)}
}
byId('voice').onclick=async()=>{
  if(recording&&recording.state==='recording'){recording.stop();return}
  if(!connected||!service.voice){byId('settings').open=true;say('Connect the local service with an ElevenLabs key to record direction.');return}
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true});recording=new MediaRecorder(stream);const chunks=[];
    recording.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recording.onstop=()=>{clearTimeout(stopTimer);stream.getTracks().forEach(t=>t.stop());byId('voice').textContent='Record note';transcribe(new Blob(chunks,{type:recording.mimeType}))};
    recording.start();const stopTimer=setTimeout(()=>{if(recording.state==='recording')recording.stop()},20000);byId('voice').textContent='Finish note';say('Recording · up to 20 seconds.')}
  catch(e){if(stream)stream.getTracks().forEach(t=>t.stop());byId('audiofile').hidden=false;say('Microphone unavailable in this window. Select an audio file or type your direction.')}
};
byId('audiofile').onclick=()=>byId('file').click();byId('file').onchange=e=>{if(e.target.files[0])transcribe(e.target.files[0])};
show();
if(!plugin&&location.hash.startsWith('#key=')){byId('token').value=decodeURIComponent(location.hash.slice(5));history.replaceState(null,'',location.pathname);connect()}
