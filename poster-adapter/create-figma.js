async function startScreen(raw,count){
  if(nativeRun||starting)return;
  const screen=Screens.check(raw);
  starting=true;
  let board;
  try{
    const regular={family:'Inter',style:'Regular'},bold={family:'Inter',style:'Bold'};
    await Promise.all([figma.loadFontAsync(regular),figma.loadFontAsync(bold)]);
    board=figma.createFrame();board.name=screen.name;board.resize(screen.width,screen.height);board.fills=paint(screen.background);board.clipsContent=false;
    const existing=figma.currentPage.children.filter(n=>n!==board&&n.visible);
    board.x=existing.reduce((right,n)=>{const b=n.absoluteBoundingBox;return b?Math.max(right,b.x+b.width+120):right},figma.viewport.center.x-screen.width/2);
    board.y=Math.round(figma.viewport.center.y-screen.height/2);
    const jobs=screenJobs(count,screen),created=[];
    figma.viewport.scrollAndZoomIntoView([board]);
    for(const j of jobs){const ptr=figma.createNodeFromSvg(Shared.badge(j.id));board.appendChild(ptr);ptr.name='Cursor '+(j.id+1);ptr.visible=false;ptr.locked=true;j.ptr=ptr}
    function build(slice){
      for(let i=slice.first;i<slice.last;i++){
        const v=screen.layers[i];let n;
        if(v.kind==='text'){n=figma.createText();n.fontName=v.bold?bold:regular;n.characters=v.text;n.fontSize=v.size;n.lineHeight={unit:'PERCENT',value:116};n.textAutoResize='NONE';n.resize(v.w,v.h)}
        else {n=v.kind==='ellipse'?figma.createEllipse():figma.createRectangle();n.resize(v.w,v.h);if(v.kind==='rect')n.cornerRadius=Math.min(v.radius||0,v.w/2,v.h/2)}
        const below=created.reduce((sum,index)=>sum+(index<i?1:0),0);
        board.insertChild(below,n);created.push(i);n.name=v.name;n.fills=paint(v.fill);n.x=v.x;n.y=v.y;
      }
    }
    nativeRun={board,jobs,build,frames:1,shared:true,elapsed:0,last:Date.now(),done:0,active:0,paused:false,timer:null};
    nativeRun.timer=setInterval(stepFleet,40);postFleet('running',{done:0,active:0,total:count,frames:1,shared:true});
  }catch(e){if(board&&!board.removed)board.remove();throw e}finally{starting=false}
}
