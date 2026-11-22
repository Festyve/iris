function buildWebScreen(screen,count){
  const svg=fleetEl('fleet-canvas');svg.replaceChildren();
  svg.setAttribute('viewBox','0 0 '+screen.width+' '+screen.height);
  svg.appendChild(makeSvg('rect',{width:screen.width,height:screen.height,fill:screen.background}));
  const slots=screen.layers.map(()=>{const g=makeSvg('g');svg.appendChild(g);return g});
  function build(slice){
    for(let i=slice.first;i<slice.last;i++){
      const v=screen.layers[i];let element;
      if(v.kind==='text'){
        element=makeSvg('text',{fill:v.fill,'font-size':v.size,'font-family':'Inter, Arial, sans-serif','font-weight':v.bold?700:400});
        v.text.split('\n').forEach((line,k)=>{const span=makeSvg('tspan',{x:v.x,y:v.y+v.size*(.89+k*1.16)});span.textContent=line;element.appendChild(span)});
      }else if(v.kind==='ellipse'){element=makeSvg('ellipse',{cx:v.x+v.w/2,cy:v.y+v.h/2,rx:v.w/2,ry:v.h/2,fill:v.fill})}
      else {element=makeSvg('rect',{x:v.x,y:v.y,width:v.w,height:v.h,rx:v.radius||0,fill:v.fill})}
      element.setAttribute('data-layer',v.name);slots[i].appendChild(element);
    }
  }
  const jobs=screenJobs(count,screen);
  for(const j of jobs){j.ptr=makeSvg('g',{'data-worker':j.id,visibility:'hidden','pointer-events':'none'});j.ptr.innerHTML=Shared.badge(j.id);svg.appendChild(j.ptr)}
  document.querySelector('.fleet-top b').textContent=screen.name;fleetPanel.querySelector('.note').hidden=true;fleetPanel.hidden=false;
  document.querySelector('.boards').hidden=true;document.querySelector('.stage > p').hidden=true;
  return {shared:true,build,jobs,frames:1,elapsed:0,last:performance.now(),anim:0,lastDone:0,active:0};
}
