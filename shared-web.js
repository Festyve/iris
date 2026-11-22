function buildShared(count,brief){
  const svg=fleetEl('fleet-canvas'),w=source.width,h=source.height;
  svg.setAttribute('viewBox',[0,0,w,h].join(' '));svg.innerHTML=sceneSvg(source);
  fleetPanel.hidden=false;document.querySelector('.boards').hidden=true;
  document.querySelector('.stage > p').hidden=true;document.querySelector('.fleet-top b').textContent='Shared canvas';
  fleetPanel.querySelector('.note').hidden=true;
  const targets=Swarm.roles.map((role,index)=>{
    const n=source.layers[role],el=svg.querySelector('[data-role="'+role+'"]');
    const group=makeSvg('g');el.before(group);group.appendChild(el);
    return {x:n.x,y:n.y,w:n.w,h:n.h,group,patch:Swarm.adjustment(brief,index,w)};
  });
  const jobs=Shared.makeJobs(count,targets,w,h);
  for(const j of jobs){
    j.ptr=makeSvg('g',{'data-worker':j.id,visibility:'hidden','pointer-events':'none'});
    j.ptr.innerHTML=Shared.badge(j.id);svg.appendChild(j.ptr);
  }
  return {shared:true,jobs,frames:1,elapsed:0,last:performance.now(),anim:0,lastDone:0,active:0};
}
function tickSharedBrowser(r){
  const ctm=fleetEl('fleet-canvas').getScreenCTM(),k=ctm?1/ctm.a:1;
  const stats=Shared.advance(r.jobs,r.elapsed,(j,p,t)=>{
    j.ptr.setAttribute('visibility','visible');j.ptr.setAttribute('transform','translate('+p.x+' '+p.y+') scale('+k+')');if(t===1)j.ptr.remove();
  },(n,phase)=>{
    if(r.build){r.build(n);return}
    if(phase!==1||n.applied)return;n.applied=true;
    const dest=Swarm.adjust(n,n.patch,source.width,source.height),scale=n.patch?n.patch.scale:1;
    n.group.setAttribute('transform','translate('+Math.round(dest.x)+' '+Math.round(dest.y)+') scale('+scale+') translate('+(-n.x)+' '+(-n.y)+')');
  });
  r.lastDone=stats.done;r.active=stats.active;
  if(stats.done===r.jobs.length){fleetView('finished',stats.done,stats.done,1,0);return}
  fleetView('running',stats.done,r.jobs.length,1,stats.active);r.anim=requestAnimationFrame(browserTick);
}
