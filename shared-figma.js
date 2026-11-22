function launchShared(source,count,brief){
  const origin=source.absoluteBoundingBox;
  const board=figma.createFrame();
  try{
    board.name='Iris · shared canvas';board.setPluginData('sc-output','yes');board.resize(source.width,source.height);
    board.x=origin.x+origin.width+140;board.y=origin.y;
    for(const prev of figma.currentPage.children)if(prev!==board&&prev.getPluginData('sc-output')==='yes'&&Math.abs(prev.x-board.x)<1)board.y=Math.max(board.y,prev.y+prev.height+100);
    board.fills=[];board.clipsContent=false;
    const copy=source.clone();board.appendChild(copy);copy.x=0;copy.y=0;copy.name=source.name+' · working copy';
    // Visiting descendants of instances or component definitions would violate their editing rules.
    const targets=[],base=board.absoluteBoundingBox;
    function walk(n,level,index){
      if(!n.visible||n.locked)return;
      const b=n.absoluteBoundingBox;
      if(!b||b.width<1||b.height<1)return;
      const left=Math.max(0,b.x-base.x),top=Math.max(0,b.y-base.y),right=Math.min(board.width,b.x+b.width-base.x),bottom=Math.min(board.height,b.y+b.height-base.y);
      if(right<=left||bottom<=top)return;
      const free=(!n.parent.layoutMode||n.parent.layoutMode==='NONE'||n.layoutPositioning==='ABSOLUTE');
      targets.push({n,x:left,y:top,w:right-left,h:bottom-top,free,patch:level===0?Swarm.adjustment(brief,index,source.width):null});
      if(n.children&&n.type!=='INSTANCE'&&n.type!=='COMPONENT'&&n.type!=='COMPONENT_SET')n.children.forEach((child,i)=>walk(child,level+1,i));
    }
    copy.children.forEach((n,i)=>walk(n,0,i));
    if(!targets.length)throw Error('Select a frame containing a visible, unlocked design layer.');
    const jobs=Shared.makeJobs(count,targets,board.width,board.height);
    figma.viewport.scrollAndZoomIntoView([board]);
    const scale=1/Math.max(.01,figma.viewport.zoom);
    for(const j of jobs){const ptr=figma.createNodeFromSvg(Shared.badge(j.id));board.appendChild(ptr);ptr.name='Cursor '+(j.id+1);ptr.rescale(scale);ptr.visible=false;ptr.locked=true;j.ptr=ptr}
    const run={board,copy,jobs,frames:1,shared:true,elapsed:0,last:Date.now(),done:0,active:0,paused:false,timer:null};
    nativeRun=run;run.timer=setInterval(stepFleet,65);postFleet('running',{done:0,active:0,total:count,frames:1,shared:true});
  }catch(e){if(!board.removed)board.remove();throw e}
}
function stepShared(run){
  const count=Shared.advance(run.jobs,run.elapsed,(j,p,t)=>{
    const width=39/Math.max(.01,figma.viewport.zoom);
    if(Math.abs(j.ptr.width-width)>width*.04)j.ptr.rescale(width/j.ptr.width);
    j.ptr.visible=t<1;j.ptr.x=p.x;j.ptr.y=p.y;
  },(target,phase)=>{
    if(run.build){run.build(target);return}
    if(target.applied||phase!==1)return;
    target.applied=true;
    if(target.free){
      const n=target.n,p=target.patch;
      n.x=Math.round(n.x+(p?p.dx*run.board.width:0));n.y=Math.round(n.y+(p?p.dy*run.board.height:0));
      if(p&&p.scale!==1&&typeof n.rescale==='function')n.rescale(p.scale);
    }
  });
  if(count.done!==run.done||count.active!==run.active){run.done=count.done;run.active=count.active;postFleet('running',{shared:true,active:run.active,done:run.done,total:run.jobs.length,frames:1})}
  if(run.done===run.jobs.length){
    clearInterval(run.timer);for(const j of run.jobs)j.ptr.remove();
    if(run.build){run.board.clipsContent=true;figma.currentPage.selection=[run.board]}else{run.board.name='Iris · shared canvas · completed'}nativeRun=null;figma.commitUndo();
    postFleet('finished',{shared:true,done:run.done,total:run.done,active:0,frames:1});
  }
}
