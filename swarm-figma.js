let nativeRun=null,starting=false;
const inputFrame=figma.currentPage.selection.find(n=>n.type==='FRAME');
function postFleet(state,extra){figma.ui.postMessage(Object.assign({kind:'fleet',state},extra||{}))}
function targetFrame(){
  const picked=figma.currentPage.selection.find(n=>n.type==='FRAME'&&n!==phone&&n.getPluginData('sc-output')!=='yes');
  return picked||(inputFrame&&!inputFrame.removed?inputFrame:desk);
}
function dropBoard(run){
  if(run.timer)clearInterval(run.timer);
  if(run.board&&!run.board.removed)run.board.remove();
}
function stopFleet(){
  if(!nativeRun)return;
  dropBoard(nativeRun);nativeRun=null;postFleet('idle');
}
function pointer(color,index,board,pool){
  let n=pool.get(color);
  if(n)n=n.clone();
  else {n=figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><path d="M3 2L36 23L22 26L15 44Z" fill="'+color+'" stroke="white" stroke-width="3"/></svg>');pool.set(color,n)}
  board.appendChild(n);n.name='Cursor '+(index+1);n.locked=true;return n;
}
function resizeNode(n,w,h){
  if(typeof n.resize==='function')n.resize(Math.max(.1,w),Math.max(.1,h));
}
function snapshotNode(n){return {x:n.x,y:n.y,w:n.width,h:n.height,opacity:n.opacity,align:n.type==='TEXT'?n.textAlignHorizontal:null}}
function stageTarget(n,goal,free,fontSize,patch){
  const ox=goal.opacity;
  return {n,goal,phase:-1,apply(phase){
    if(this.phase===phase)return;
    this.phase=phase;
    if(phase===0){n.opacity=ox*.40;return}
    if(phase===1){if(free){n.x=goal.x;n.y=goal.y}n.opacity=ox*.60;return}
    if(phase===2){if(!free&&patch&&n.type==='TEXT'&&n.fontName!==figma.mixed&&typeof n.fontSize==='number')n.fontSize=n.fontSize*patch.scale;
      if(patch&&n.layoutMode&&n.layoutMode!=='NONE'&&typeof n.itemSpacing==='number')n.itemSpacing=Math.max(0,n.itemSpacing*patch.scale);
      if(free){resizeNode(n,goal.w,goal.h);if(fontSize&&n.type==='TEXT'&&n.fontName!==figma.mixed){n.fontSize=fontSize;if(goal.align==='right'||goal.align==='left')n.textAlignHorizontal=goal.align.toUpperCase();if(goal.sampleText)n.textAutoResize='HEIGHT'}n.x=goal.x;n.y=goal.y}n.opacity=ox*.8;return}
    n.opacity=ox;
  }};
}
function applyGroup(job,t){
  const nodes=job.nodes,count=nodes.length;
  // Stagger work within a lane when a product frame has many children.
  for(let i=0;i<count;i++){
    const local=Math.min(1,Math.max(0,t*count-i));
    const phase=local>=1?3:local>.54?2:local>.18?1:0;
    if(nodes[i].phase<phase){for(let step=nodes[i].phase+1;step<=phase;step++)nodes[i].apply(step)}
  }
  const active=nodes[Math.min(count-1,Math.floor(t*count))],n=active.n;
  const end={x:job.frame.x+(n.x+Math.min(28,n.width*.25)),y:job.frame.y+n.y+Math.min(22,n.height*.3)};
  const pos=Swarm.position(job,t,job.start,end);job.ptr.x=pos.x;job.ptr.y=pos.y;
  const cursorWidth=15/Math.max(.01,figma.viewport.zoom||1);
  if(Math.abs(job.ptr.width-cursorWidth)>1)job.ptr.rescale(cursorWidth/job.ptr.width);
  job.ptr.visible=t<1;
}
function stepFleet(){
  const run=nativeRun;if(!run||run.paused)return;
  try{
    if(run.board.removed){stopFleet();return}
    const now=Date.now();run.elapsed+=(now-run.last)/1000;run.last=now;
    let done=0;
    for(const j of run.jobs){if(j.finished){done++;continue}const t=Swarm.progress(j,run.elapsed);applyGroup(j,t);if(t>=1){j.finished=true;done++}}
    if(done!==run.done){run.done=done;postFleet('running',{done,total:run.jobs.length,frames:run.frames})}
    if(done===run.jobs.length){clearInterval(run.timer);run.timer=null;for(const j of run.jobs)if(!j.ptr.removed)j.ptr.remove();
      run.board.name='Second Cursor · '+run.frames+' finished layouts';nativeRun=null;postFleet('finished',{done,total:done,frames:run.frames});figma.commitUndo()}
  }catch(e){stopFleet();figma.ui.postMessage({kind:'error',text:'Swarm stopped: '+e.message})}
}
async function launchFleet(count,brief,sourceKey){
  if(nativeRun||starting)return;
  const source=targetFrame();
  if(!source||source.removed||!source.children.some(n=>n.visible)){throw Error('Select a Figma frame with a visible child layer.')}
  if(sourceKey&&sourceKey!==source.id)throw Error('Source selection changed. Launch again for this frame.');
  starting=true;
  let board;
  try{
    const sample=source===desk,scene=sample?read():null,grid=Swarm.configs(count);
    const used=source.findAll(()=>true).length*grid.items.length;
    if(used>16000)throw Error('Choose a smaller product section or fewer cursors for this frame.');
    const fontList=new Map();
    for(const n of source.children)if(n.type==='TEXT'&&n.fontName!==figma.mixed)fontList.set(JSON.stringify(n.fontName),n.fontName);
    await Promise.all(Array.from(fontList.values()).map(f=>figma.loadFontAsync(f)));
    board=figma.createFrame();board.name='Second Cursor · working layouts';board.setPluginData('sc-output','yes');board.resize(grid.width+144,grid.height+144);
    const bounds=source.absoluteBoundingBox;board.x=bounds.x+bounds.width+650;board.y=bounds.y;
    for(const old of figma.currentPage.children){if(old!==board&&old.getPluginData('sc-output')==='yes'&&old.x===board.x)board.y=Math.max(board.y,old.y+old.height+160)}board.clipsContent=false;board.fills=paint('#E4E1E9');
    const jobs=[],pool=new Map();let frames=0;
    for(const c of grid.items){
      const f=source.clone();board.appendChild(f);f.name=source.name+' · '+c.width+' px';f.setPluginData('sc-output','yes');
      const original=source.children.map(snapshotNode);
      f.resize(c.width,sample?c.height:Math.max(1,Math.round(source.height*c.width/source.width)));
      // Auto-layout roots keep their native flow as the frame changes width.
      const desired=sample?Swarm.layout(scene,direction,c):null;
      const buckets=Array.from({length:5},()=>[]);
      f.children.forEach((n,i)=>{
        if(!n.visible)return;
        const free=f.layoutMode==='NONE'||n.layoutPositioning==='ABSOLUTE';
        let goal=snapshotNode(n),fontSize=null;
        if(sample&&desired.layers[n.name]){const v=desired.layers[n.name];goal=Object.assign({},v,{opacity:n.opacity,sampleText:true});fontSize=v.size||null}
        else if(free){const k=c.width/source.width;goal=Object.assign({},goal,{x:original[i].x*k,y:original[i].y*k,w:original[i].w*k,h:original[i].h*k})}
        const p=Swarm.adjustment(brief,i,c.width);
        if(!sample&&free&&n.type==='TEXT'&&typeof n.fontSize==='number')fontSize=n.fontSize*c.width/source.width;
        goal=Swarm.adjust(goal,p,f.width,f.height);
        if(fontSize&&p)fontSize*=p.scale;
        const item=stageTarget(n,goal,free,fontSize,p);item.apply(0);buckets[i%5].push(item);
      });
      f.x=72+c.x;f.y=72+c.y;frames++;
      buckets.filter(l=>l.length).forEach(items=>{
        const j=Swarm.worker(jobs.length,c.index,items[0].n.name);j.nodes=items;j.frame=f;
        j.start={x:f.x+f.width*(.1+j.lane*.17),y:f.y-32};j.ptr=pointer(j.color,j.id,board,pool);
        j.ptr.x=j.start.x;j.ptr.y=j.start.y;jobs.push(j);
      });
    }
    // Keep every pointer above every finished frame, including later frames in the grid.
    for(const j of jobs)board.appendChild(j.ptr);
    if(!sample){
      let y=72;const cols=Math.ceil(Math.sqrt(frames)),all=board.children.filter(n=>n.getPluginData('sc-output')==='yes');
      for(let i=0;i<all.length;i+=cols){const row=all.slice(i,i+cols);for(const f of row)f.y=y;y+=Math.max(...row.map(f=>f.height))+108}
      board.resize(board.width,Math.max(144,y-36));for(const j of jobs){j.start.y=j.frame.y-32;j.ptr.y=j.start.y}
    }
    nativeRun={board,jobs,frames,elapsed:0,last:Date.now(),done:-1,paused:false};
    figma.viewport.scrollAndZoomIntoView([board]);nativeRun.timer=setInterval(stepFleet,70);
    postFleet('running',{done:0,total:jobs.length,frames});
  }catch(e){if(board&&!board.removed)board.remove();throw e}finally{starting=false}
}
function pauseFleet(){
  if(!nativeRun)return;nativeRun.paused=!nativeRun.paused;nativeRun.last=Date.now();
  postFleet(nativeRun.paused?'paused':'running',{done:Math.max(0,nativeRun.done),total:nativeRun.jobs.length,frames:nativeRun.frames});
}
