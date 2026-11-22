const fleetEl=id=>document.getElementById(id);
let fleetState='idle',browserRun=null;
const numberInput=fleetEl('workers'),fleetPanel=fleetEl('fleet-preview');
function fleetView(state,done,total,frames,active){
  fleetState=state;
  const busy=state==='running'||state==='paused'||state==='starting';
  fleetEl('launch').disabled=busy;numberInput.disabled=busy;fleetEl('formation').disabled=busy;
  fleetEl('pause').hidden=!['running','paused'].includes(state);fleetEl('pause').textContent=state==='paused'?'Resume':'Pause';
  fleetEl('cancel').hidden=!['running','paused'].includes(state);
  fleetEl('fleet-status').textContent=state==='running'?done+' / '+total+' cursors finished · '+frames+' layouts':
    state==='paused'?'Paused · '+done+' / '+total+' finished':state==='finished'?frames+' layouts ready · '+done+' cursor assignments complete':
    state==='starting'?'Preparing editable layers…':'Ready';
  if(fleetEl('formation').value==='shared'){
    if(state==='running')fleetEl('fleet-status').textContent=(active||0)+' active / '+total+' cursors · '+done+' finished';
    if(state==='finished')fleetEl('fleet-status').textContent='Shared canvas ready · '+done+' cursor assignments complete';
  }
  fleetEl('meter').max=total||1;fleetEl('meter').value=done||0;
}
function makeSvg(tag,attrs){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));return n}
function buildOverview(count,brief){
  document.querySelector('.fleet-top b').textContent='Responsive layouts';fleetPanel.querySelector('.note').hidden=false;
  const grid=Swarm.configs(count),jobs=[],svg=fleetEl('fleet-canvas');
  svg.replaceChildren();const overview=[-48,-85,grid.width+96,grid.height+145].join(' ');svg.setAttribute('viewBox',overview);
  const cursorLayer=makeSvg('g',{'pointer-events':'none'});let zoom=null;
  for(const c of grid.items){
    const m=Swarm.layout(source,plan,c);
    Swarm.roles.forEach((role,i)=>{m.layers[role]=Swarm.adjust(m.layers[role],Swarm.adjustment(brief,i,c.width),c.width,c.height)});
    const g=makeSvg('svg',{x:c.x,y:c.y,width:c.width,height:c.height,viewBox:'0 0 '+c.width+' '+c.height,overflow:'hidden',role:'button',tabindex:0,'aria-label':'Inspect '+c.width+' pixel layout'});
    g.innerHTML=sceneSvg(m);svg.appendChild(g);
    const caption=makeSvg('text',{x:c.x,y:c.y-10,fill:'#424047','font-size':25,'font-family':'Arial'});caption.textContent=c.width+' px';svg.appendChild(caption);
    const inspect=()=>{zoom=zoom===c.index?null:c.index;svg.setAttribute('viewBox',zoom===null?overview:[c.x-25,c.y-40,c.width+50,c.height+65].join(' '))};
    g.addEventListener('click',inspect);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect()}});
    Swarm.roles.forEach((role,i)=>{
      const n=m.layers[role],el=g.querySelector('[data-role="'+role+'"]'),j=Swarm.worker(jobs.length,c.index,role);
      const wrap=makeSvg('g');el.before(wrap);wrap.appendChild(el);
      j.wrap=wrap;j.dx=(i%2?1:-1)*Math.min(c.width*.16,110);j.dy=35+i*7;
      wrap.setAttribute('opacity','.40');wrap.setAttribute('transform','translate('+j.dx+' '+j.dy+')');
      j.start={x:c.x+c.width*(.1+i*.17),y:c.y-36};
      j.end={x:c.x+n.x+Math.min(25,n.w*.2),y:c.y+n.y+Math.min(24,n.h*.4)};
      j.ptr=makeSvg('g',{'data-worker':j.id,transform:'translate('+j.start.x+' '+j.start.y+')'});
      const arrow=makeSvg('path',{d:'M2 1L36 22L22 26L15 44Z',fill:j.color,stroke:'white','stroke-width':3});
      j.ptr.appendChild(arrow);cursorLayer.appendChild(j.ptr);jobs.push(j);
    });
  }
  svg.appendChild(cursorLayer);fleetPanel.hidden=false;
  document.querySelector('.boards').hidden=true;document.querySelector('.stage > p').hidden=true;
  return {jobs,frames:grid.items.length,elapsed:0,last:performance.now(),anim:0,lastDone:-1};
}
function browserTick(now){
  const r=browserRun;if(!r||fleetState!=='running')return;
  r.elapsed+=(now-r.last)/1000;r.last=now;let done=0;
  if(r.shared){tickSharedBrowser(r);return}
  const camera=fleetEl('fleet-canvas').getScreenCTM();const pointerScale=camera?0.36/camera.a:1;
  for(const j of r.jobs){
    if(j.finished){done++;continue}const t=Swarm.progress(j,r.elapsed),s=t*t*(3-2*t);
    const pos=Swarm.position(j,t,j.start,j.end);
    j.ptr.setAttribute('transform','translate('+pos.x+' '+pos.y+') scale('+pointerScale+')');
    j.wrap.setAttribute('transform','translate('+(j.dx*(1-s))+' '+(j.dy*(1-s))+')');j.wrap.setAttribute('opacity',.40+.60*s);
    if(t>=1){j.finished=true;j.ptr.remove();done++}
  }
  if(done===r.jobs.length){fleetView('finished',done,done,r.frames);return}
  if(done!==r.lastDone){r.lastDone=done;fleetView('running',done,r.jobs.length,r.frames)}
  r.anim=requestAnimationFrame(browserTick);
}
function hideOverview(){
  if(browserRun)cancelAnimationFrame(browserRun.anim);
  browserRun=null;fleetPanel.hidden=true;fleetEl('fleet-canvas').replaceChildren();
  document.querySelector('.boards').hidden=false;document.querySelector('.stage > p').hidden=false;
  fleetView('idle',0,0,0);
}
fleetEl('back').onclick=hideOverview;
async function getFleetContext(){
  if(!plugin)return {png:await snapshot(),sourceKey:null,source:{width:source.width,height:source.height,layers:Swarm.roles.map((name,index)=>Object.assign({name,index},source.layers[name]))}};
  const id=++snapshotSeq;
  return new Promise((resolve,reject)=>{
    function complete(e){const d=e.data&&e.data.pluginMessage;if(!d||d.kind!=='fleet-context'||d.id!==id)return;clearTimeout(timer);window.removeEventListener('message',complete);if(d.error)reject(Error(d.error));else resolve(d)}
    const timer=setTimeout(()=>{window.removeEventListener('message',complete);reject(Error('Source snapshot timed out. Try a smaller frame.'))},7000);
    window.addEventListener('message',complete);parent.postMessage({pluginMessage:{kind:'fleet-context',id}},'*');
  });
}
fleetEl('launch').onclick=async()=>{
  const shared=fleetEl('formation').value==='shared',count=Number(numberInput.value);fleetView('starting',0,count,0);
  try{
    let brief=[],sourceKey=null;
    if(connected&&service.design){
      fleetEl('fleet-status').textContent='Art director is assigning layer edits…';
      const context=await getFleetContext();sourceKey=context.sourceKey;
      const note=byId('brief').value.trim()||(shared?'Polish the selected design on a single shared canvas at its current width.':'Adapt this design to compact, medium and wide product screens.');
      const result=await call('/swarm',JSON.stringify({source:context.source,png:context.png,note,plan}));
      brief=result.patches;say(result.reason);
    }
    if(plugin){parent.postMessage({pluginMessage:{kind:'launch-fleet',count,brief,sourceKey,shared}},'*');return}
    browserRun=shared?buildShared(count,brief):buildOverview(count,brief);fleetView('running',0,browserRun.jobs.length,browserRun.frames);
    browserRun.anim=requestAnimationFrame(browserTick);
  }catch(e){fleetView('idle',0,0,0);fleetEl('fleet-status').textContent=e.message}
};
fleetEl('pause').onclick=()=>{
  if(plugin){parent.postMessage({pluginMessage:{kind:'pause-fleet'}},'*');return}
  if(!browserRun)return;const r=browserRun;
  if(fleetState==='running'){cancelAnimationFrame(r.anim);fleetView('paused',Math.max(0,r.lastDone),r.jobs.length,r.frames)}
  else{r.last=performance.now();fleetView('running',Math.max(0,r.lastDone),r.jobs.length,r.frames);r.anim=requestAnimationFrame(browserTick)}
};
fleetEl('cancel').onclick=()=>{if(plugin)parent.postMessage({pluginMessage:{kind:'stop-fleet'}},'*');else hideOverview()};
window.addEventListener('message',e=>{const m=e.data&&e.data.pluginMessage;if(!m)return;
  if(m.kind==='custom-source'){customSource=true;fleetEl('fleet-status').textContent='Source · '+m.name;byId('keep').hidden=true;byId('presets').hidden=true;byId('presets').previousElementSibling.hidden=true;byId('apply').hidden=true;byId('brief').placeholder='Art direction for this frame’s responsive layouts';}
  if(m.kind==='fleet')fleetView(m.state,m.done||0,m.total||0,m.frames||0,m.active);
  if(m.kind==='error'&&fleetState==='starting'){fleetView('idle',0,0,0);fleetEl('fleet-status').textContent=m.text}
});
