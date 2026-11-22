// Shared timeline. Both renderers use the same worker assignments and target sizes.
const Swarm = (() => {
  const colors=['#DC3B52','#6244D7','#00816D','#2164BC','#A14D00'];
  const roles=['Label','Hero','Title','Date','Venue'];
  const widths=[320,360,390,430,480,540,600,640,680,720,768,800,840,900,960,1024,1080,1152,1280,1440];
  function configs(count) {
    const total=Math.max(1,Math.min(20,Math.ceil(count/5)));
    const all=Array.from({length:total},(_,i)=>{
      const w=widths[Math.round(i*(widths.length-1)/Math.max(1,total-1))];
      return {index:i,width:w,height:w<700?Math.round(670+(w-390)*.25):Math.round(560+w*.13)};
    });
    const cols=Math.ceil(Math.sqrt(total)),gap=108,rows=Math.ceil(total/cols);
    const xs=[0],ys=[0];
    for(let col=0;col<cols;col++)xs.push(xs[col]+Math.max(...all.filter((_,i)=>i%cols===col).map(c=>c.width))+gap);
    for(let row=0;row<rows;row++)ys.push(ys[row]+Math.max(...all.slice(row*cols,(row+1)*cols).map(c=>c.height))+gap);
    for(const c of all){c.x=xs[c.index%cols];c.y=ys[Math.floor(c.index/cols)]}
    return {items:all,width:xs[cols]-gap,height:ys[rows]-gap};
  }
  function layout(source,plan,c){
    const result=SC.mobile(source,plan),r=result.layers,w=c.width,h=c.height,p=SC.normalize(plan);
    result.width=w;result.height=h;
    if(w<700){
      const sx=w/390,sy=h/670;
      for(const n of Object.values(r)){n.x*=sx;n.y*=sy;n.w*=sx;n.h*=n.text?sy:sx;if(n.size)n.size*=Math.min(1.2,sx)}
    }else{
      const sx=w/source.width,sy=h/source.height,margin=Math.round(w*.045);
      for(const role of roles){const original=source.layers[role],n=r[role];Object.assign(n,original);
        n.x*=sx;n.w*=sx;n.y*=sy;n.h*=sy;if(n.size)n.size*=Math.min(sx,sy)}
      r.Hero.w*=p.heroScale;r.Hero.h=r.Hero.w*source.layers.Hero.h/source.layers.Hero.w;
      if(p.composition==='stack'){r.Title.y=h*.13;r.Hero.y=h*.35;r.Hero.w=Math.min(r.Hero.w,h*.52);r.Hero.h=r.Hero.w*source.layers.Hero.h/source.layers.Hero.w}
      if(p.composition==='overlap'){r.Hero.x=w*.32;r.Hero.y=h*.12}
      for(const role of ['Title','Date','Venue'])if(p.align==='right'){r[role].align='right';r[role].x=w-r[role].w-margin}
      if(p.datePosition==='top')r.Date.y=Math.max(r.Label.y+r.Label.h+10,h*.09);
    }
    return result;
  }
  function worker(id,frameIndex,target){
    const lane=id%5;
    return {id,frameIndex,target,color:colors[lane],delay:((id*37)%83)/100,duration:3.4+((id*13)%21)/10,lane};
  }
  // Each worker first moves its layer, then sets its geometry and finally reveals it.
  function progress(job,elapsed){return Math.max(0,Math.min(1,(elapsed-job.delay)/job.duration))}
  function position(job,t,start,end){
    const e=t*t*(3-2*t),arc=Math.sin(Math.PI*t)*(job.id%2?1:-1);
    return {x:start.x+(end.x-start.x)*e+arc*30,y:start.y+(end.y-start.y)*e+arc*17};
  }
  // Model instructions are relative, bounded edits keyed to a real source child.
  function adjustment(brief,index,width){
    const band=width<600?'compact':width<950?'medium':'wide';
    return (brief||[]).find(p=>p.index===index&&p.band===band);
  }
  function adjust(goal,patch,width,height){
    if(!patch)return goal;
    const out=Object.assign({},goal);
    out.x+=patch.dx*width;out.y+=patch.dy*height;
    out.w=Math.max(1,out.w*patch.scale);out.h=Math.max(1,out.h*patch.scale);
    if(out.size)out.size*=patch.scale;
    return out;
  }
  return {adjustment,adjust,configs,layout,worker,progress,position,colors,roles};
})();
