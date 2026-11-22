// The same tagged pointer and time-based choreography run in Figma and the browser.
const Shared = (() => {
  const palette=['#1475F0','#A145C9','#00998F','#E95839','#4764D9','#DA4083','#287D49','#8853CB','#A55C19','#007DB7'];
  const digitPaths=['M0 0h3v5H0z','M2 0v5','M0 0h3v2.5H0V5h3','M0 0h3v5H0M0 2.5h3','M0 0v2.5h3M3 0v5','M3 0H0v2.5h3V5H0','M3 0H0v5h3V2.5H0','M0 0h3L1 5','M0 0h3v5H0zM0 2.5h3','M3 5V0H0v2.5h3'];
  function badge(id){
    const color=palette[id%palette.length],digits=String(id+1).padStart(2,'0');
    const paths=digits.split('').map((d,i)=>'<path transform="translate('+(19+i*5)+' 16)" d="'+digitPaths[Number(d)]+'"/>').join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="39" height="25" viewBox="0 0 39 25"><path d="M1 1l4 14 3-5 5-2z" fill="'+color+'" stroke="white" stroke-width="1.1"/><rect x="11" y="12" width="27" height="12" rx="3" fill="'+color+'"/><g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1">'+paths+'</g></svg>';
  }
  function timing(id,count){return {enter:.72*(id/Math.max(1,count-1))+((id*31)%17)/250,duration:3.6+((id*47)%38)/25}}
  function motion(id,t,points){
    const k=Math.min(points.length-2,Math.floor(t*(points.length-1))),u=Math.min(1,(t*(points.length-1)-k)/.73);
    const s=u*u*(3-2*u),a=points[k],b=points[k+1],curve=Math.sin(Math.PI*u)*.055*(id%2?1:-1);
    return {x:a.x+(b.x-a.x)*s+(b.y-a.y)*curve,y:a.y+(b.y-a.y)*s-(b.x-a.x)*curve,stage:k,arrived:u>=1};
  }
  function route(id,total,targets,w,h){
    const anchor=(i)=>targets[Math.floor((id/total*targets.length+i*targets.length*.317)%targets.length)];
    return {indices:[anchor(0),anchor(1),anchor(2)],start:{x:((id*71)%101)/100*w,y:id%2?-h*.025:h*1.025}};
  }
  function makeJobs(count,targets,w,h){
    return Array.from({length:count},(_,id)=>{
      const routeData=route(id,count,targets,w,h),points=[routeData.start];
      for(const target of routeData.indices){
        points.push({x:Math.max(0,Math.min(w,target.x+target.w*(.14+((id*37)%71)/100))),y:Math.max(0,Math.min(h,target.y+target.h*(.14+((id*59)%71)/100)))});
      }
      return {id,clock:timing(id,count),points,targets:routeData.indices,visited:0,finished:false};
    });
  }
  function advance(jobs,elapsed,draw,visit){
    let active=0,done=0;
    for(const j of jobs){
      if(j.finished){done++;continue}
      if(elapsed<j.clock.enter)continue;
      const t=Math.min(1,(elapsed-j.clock.enter)/j.clock.duration),p=motion(j.id,t,j.points);
      const reached=t===1?3:p.stage+(p.arrived?1:0);
      while(j.visited<reached){visit(j.targets[j.visited],j.visited,j.id);j.visited++}
      draw(j,p,t);
      if(t===1){done++;j.finished=true}else active++;
    }
    return {active,done};
  }
  return {badge,timing,motion,makeJobs,advance};
})();
