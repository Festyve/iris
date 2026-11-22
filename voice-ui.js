// Talk to Iris: a live ElevenLabs voice agent whose client tools drive the cursor swarm.
// In Figma the plugin also listens on /bridge, so a voice session in the browser can drive the canvas
// (Figma plugin windows usually cannot open the microphone).
const talkEl=id=>document.getElementById(id);
let talk=null,talkMeter=0,bridgeSource=null;
const toolLabels={look_at_canvas:'Looking at your canvas',build_screen:'Building a new screen',refine_design:'Refining the selected design',control_build:'Controlling the swarm',find_references:'Searching design references',set_profile:'Switching design profile'};
function talkLine(who,text){
  text=String(text||'').replace(/\[[a-z][a-z ]{0,24}\]\s*/gi,'').trim();
  if(!text)return;const list=talkEl('transcript'),li=document.createElement('li');
  li.className=who;li.textContent=text;list.appendChild(li);
  while(list.children.length>12)list.firstChild.remove();
  list.hidden=false;list.scrollTop=list.scrollHeight;
}
function talkState(mode,text){talkEl('talk').dataset.mode=mode;talkEl('talk').setAttribute('aria-pressed',String(mode!=='idle'));talkEl('talk-label').textContent=mode==='idle'?'Talk to Iris':'End conversation';talkEl('talk-state').textContent=text}
async function callLong(path,body,ms){
  const r=await fetch(api+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(ms)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Service unavailable');return data;
}
const fleetBusy=()=>['running','paused','starting'].includes(fleetState);
function waitForFleet(limit){
  const started=Date.now();
  return new Promise(resolve=>{const timer=setInterval(()=>{
    const status=fleetEl('fleet-status').textContent;
    if(fleetState==='finished'){clearInterval(timer);resolve({ok:true,status})}
    else if(fleetState==='idle'){clearInterval(timer);resolve({ok:false,error:status==='Ready'?'The run was canceled before it finished.':status})}
    else if(Date.now()-started>limit){clearInterval(timer);resolve({ok:true,status:'Still running: '+status})}
  },250)});
}
let lookSeq=0;
function pluginLook(){
  const id=++lookSeq;
  return new Promise((resolve,reject)=>{
    function done(e){const m=e.data&&e.data.pluginMessage;if(!m||m.kind!=='look'||m.id!==id)return;clearTimeout(timer);window.removeEventListener('message',done);if(m.error)reject(Error(m.error));else resolve(m)}
    const timer=setTimeout(()=>{window.removeEventListener('message',done);reject(Error('Figma did not return the frame in time.'))},9000);
    window.addEventListener('message',done);parent.postMessage({pluginMessage:{kind:'look',id}},'*');
  });
}
const localTools={
  async look_at_canvas({question}){
    let ctx;
    if(plugin)ctx=await pluginLook();
    else{const c=await getFleetContext();ctx={png:c.png,selected:[],source:Object.assign({name:'Browser canvas'},c.source)}}
    let critique='';
    if(connected&&service.design)try{critique=(await callLong('/critique',JSON.stringify({png:ctx.png,source:ctx.source,question,profile:talkEl('profile').value}),32000)).critique}catch(e){critique=''}
    const layers=(ctx.source.layers||[]).slice(0,40).map(l=>l.text?l.name+' ("'+l.text+'")':l.name);
    return {frame:ctx.source.name,size:Math.round(ctx.source.width)+' by '+Math.round(ctx.source.height),selected:ctx.selected,layers,critique:critique||'No vision critique available, so judge from the layer names and say you cannot see the pixels.'};
  },
  async build_screen({brief,cursors,profile}){
    if(fleetBusy())return {error:'A build is already running. Pause or cancel it first.'};
    if(profile!==undefined)setProfile(profile);
    if(!brief||!String(brief).trim())return {error:'The brief was empty.'};
    fleetEl('formation').value='create';switchMode();fleetEl('screen-brief').value=String(brief).slice(0,700);
    numberInput.value=['5','25','100'].includes(String(cursors))?String(cursors):'100';
    fleetEl('launch').click();const r=await waitForFleet(100000);
    if(!r.ok)return {built:false,error:r.error};
    return {built:true,status:r.status,profile:currentProfileName(),planner:connected&&service.design?'Gemini designed a custom screen from the brief':'Gemini is not connected, so a local starter screen was used'};
  },
  async refine_design({direction,mode,profile}){
    if(fleetBusy())return {error:'A build is already running. Pause or cancel it first.'};
    if(profile!==undefined)setProfile(profile);
    fleetEl('formation').value=mode==='grid'?'grid':'shared';switchMode();byId('brief').value=String(direction||'').slice(0,700);
    fleetEl('launch').click();const r=await waitForFleet(80000);
    return r.ok?{done:true,status:r.status,note:byId('status').textContent}:{done:false,error:r.error};
  },
  async control_build({action}){
    if(!fleetBusy())return {state:fleetState,note:'Nothing is running.'};
    if(action==='cancel')fleetEl('cancel').click();
    else if((action==='pause'&&fleetState==='running')||(action==='resume'&&fleetState==='paused'))fleetEl('pause').click();
    await new Promise(r=>setTimeout(r,400));return {state:fleetState};
  },
  async set_profile({profile}){
    const ok=setProfile(profile);
    return ok?{profile:currentProfileName()}:{error:'Unknown profile. Options: '+profiles.map(p=>p.id).join(', ')};
  },
  async find_references({query}){
    if(!connected)return {results:[],note:'Local service not connected.'};
    return await call('/references?q='+encodeURIComponent(String(query||'').slice(0,120)));
  }
};
async function runTool(name,args){
  if(!localTools[name])return {error:'Unknown tool '+name};
  return await localTools[name](args||{});
}
// Voice side: route to the Figma plugin when one is connected, otherwise act on this window.
async function voiceTool(name,args){
  talkLine('tool',toolLabels[name]||name);
  let result;
  try{
    const remote=!plugin&&connected&&(await call('/status')).studio;
    result=remote?(await callLong('/bridge/command',JSON.stringify({tool:name,args}),118000)).result:await runTool(name,args);
  }catch(e){result={error:e.message}}
  if(result&&result.error)talkLine('tool','⚠ '+result.error);
  return JSON.stringify(result);
}
function loadVoiceClient(){
  if(window.IrisVoice)return Promise.resolve();
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=api+'/voice.js';
    s.onload=()=>window.IrisVoice?resolve():reject(Error('Voice client did not load. Run npm start.'));
    s.onerror=()=>reject(Error('Voice client did not load. Run npm start.'));document.head.appendChild(s)});
}
function animateOrb(){
  cancelAnimationFrame(talkMeter);
  const step=()=>{if(!talk){talkEl('talk').style.setProperty('--level',0);return}
    const mode=talkEl('talk').dataset.mode,v=mode==='speaking'?talk.getOutputVolume():talk.getInputVolume();
    talkEl('talk').style.setProperty('--level',Math.min(1,v*2.2).toFixed(3));talkMeter=requestAnimationFrame(step)};
  talkMeter=requestAnimationFrame(step);
}
async function startTalk(){
  if(!connected){byId('settings').open=true;talkState('idle','Connect the local service first: paste the session key below.');return}
  if(!service.agent){talkState('idle','Voice agent missing. Set ELEVENLABS_API_KEY, run npm run agent, restart the server.');return}
  talkState('connecting','Connecting…');
  try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop())}
  catch(e){
    if(plugin){talkEl('talk-open').hidden=false;talkState('idle','Figma blocks the microphone here. Open voice in your browser; Iris will still drive this canvas.')}
    else talkState('idle','Microphone access was denied. Allow it in the browser and try again.');
    return;
  }
  try{
    await loadVoiceClient();
    const {conversationToken}=await call('/voice/session');
    const tools={};for(const name of Object.keys(localTools))tools[name]=args=>voiceTool(name,args);
    talk=await window.IrisVoice.Conversation.startSession({conversationToken,connectionType:'webrtc',clientTools:tools,
      onConnect:()=>{talkState('listening','Listening…');animateOrb()},
      onDisconnect:()=>{talk=null;talkState('idle','Conversation ended.')},
      onError:m=>talkState(talk?'listening':'idle',String(m||'Voice error')),
      onModeChange:({mode})=>{if(talk)talkState(mode,mode==='speaking'?'Iris is speaking':'Listening…')},
      onMessage:m=>talkLine((m.role||m.source)==='user'?'you':'iris',m.message)});
    talk.sendContextualUpdate((!plugin&&service.studio?'The designer has the Iris plugin open in Figma; your tools act on their live Figma canvas. ':'')+'Active design profile: '+currentProfileName()+'.');
  }catch(e){talk=null;talkState('idle',e.message||'Could not start the conversation.')}
}
talkEl('talk').onclick=()=>{if(talk){const t=talk;talk=null;t.endSession();talkState('idle','Conversation ended.')}else if(talkEl('talk').dataset.mode!=='connecting')startTalk()};
talkEl('talk-open').onclick=()=>parent.postMessage({pluginMessage:{kind:'open-voice',url:api+'/#key='+encodeURIComponent(token)}},'*');
// Plugin side of the bridge: run tool calls sent from a browser voice session.
function openBridge(){
  if(!plugin||bridgeSource)return;
  bridgeSource=new EventSource(api+'/bridge?key='+encodeURIComponent(token));
  bridgeSource.onmessage=async e=>{
    let cmd;try{cmd=JSON.parse(e.data)}catch{return}
    let result;try{result=await runTool(cmd.tool,cmd.args)}catch(err){result={error:err.message}}
    try{await call('/bridge/result',JSON.stringify({id:cmd.id,result}))}catch{}
  };
}
// Design profiles from vault/Profiles, chosen in the panel or by voice.
let profiles=[];
const currentProfileName=()=>{const p=profiles.find(x=>x.id===talkEl('profile').value);return p?p.name:'No profile'};
function showProfileNote(){const p=profiles.find(x=>x.id===talkEl('profile').value);talkEl('profile-note').hidden=!p;talkEl('profile-note').textContent=p?p.tagline:''}
function setProfile(id){
  id=String(id||'').trim();if(id==='none')id='';
  if(id&&!profiles.some(p=>p.id===id))return false;
  talkEl('profile').value=id;showProfileNote();try{localStorage.setItem('iris-profile',id)}catch{}
  if(talk)talk.sendContextualUpdate('Active design profile is now: '+currentProfileName()+'.');
  return true;
}
async function loadProfileOptions(){
  try{profiles=(await call('/profiles')).profiles||[]}catch{profiles=[]}
  const sel=talkEl('profile');sel.replaceChildren(new Option('No profile',''));
  for(const p of profiles)sel.appendChild(new Option(p.name,p.id));
  let saved='';try{saved=localStorage.getItem('iris-profile')||''}catch{}
  if(profiles.some(p=>p.id===saved))sel.value=saved;else if(profiles.some(p=>p.id==='general'))sel.value='general';showProfileNote();
}
talkEl('profile').onchange=()=>setProfile(talkEl('profile').value);
function onServiceConnected(){
  openBridge();loadProfileOptions();
  talkState('idle',service.agent?(service.studio&&!plugin?'Ready. Iris will act on your open Figma file.':'Ready. Tap to talk.'):'Voice agent missing. Run npm run agent and restart the server.');
}
talkState('idle',plugin?'Connect the local service, then tap to talk.':'Connect the local service, then tap to talk.');
