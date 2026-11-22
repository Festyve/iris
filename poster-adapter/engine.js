const SC = (() => {
  const roles = ['Label','Hero','Title','Date','Venue'];
  const paper = '#F6EEDB', ink = '#231D31', accent = '#D94422';
  function base() {
    return {width:960,height:600,bg:paper,layers:{
      Label:{x:40,y:32,w:620,h:24,size:15,text:'TORONTO  /  INDEPENDENT PRINT FAIR',fill:ink},
      Hero:{x:454,y:36,w:500,h:500,fill:accent},
      Title:{x:36,y:158,w:570,h:240,size:108,text:'After\nHours',fill:ink},
      Date:{x:40,y:528,w:460,h:32,size:23,text:'NOV 28—29',fill:ink},
      Venue:{x:40,y:566,w:640,h:22,size:15,text:'THE FOUNDRY    /    6 PM TIL LATE',fill:ink}
    }};
  }
  // A cut-paper rosette. All coordinates are normalized to a 400-unit square.
  function petals() {
    let d='';
    for(let i=0;i<18;i++) d+='<path transform="rotate('+i*20+' 200 200)" d="M191 196 Q154 157 158 92 Q159 49 176 13 Q190 79 211 104 Q231 143 204 194 Z"/>';
    // Negative space through the petals makes their twist readable at mobile scale.
    for(let i=0;i<18;i++) d+='<path transform="rotate('+i*20+' 200 200)" d="M197 193 Q168 146 171 81 Q171 135 207 173Z" fill="#F6EEDB"/>';
    return d+'<circle cx="200" cy="200" r="22"/>';
  }
  function art(color) {return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><g fill="'+color+'">'+petals()+'</g></svg>'}
  function bounded(v,min,max){return Math.max(min,Math.min(max,v))}
  const initial={composition:'auto',heroScale:1,align:'left',datePosition:'bottom'};
  function normalize(plan) {
    const p=plan||{};
    return {composition:['auto','overlap','stack'].includes(p.composition)?p.composition:'auto',
      heroScale:bounded(Number(p.heroScale)||1,.65,1.35),align:p.align==='right'?'right':'left',
      datePosition:p.datePosition==='top'?'top':'bottom'};
  }
  function mobile(source,direction) {
    const p=normalize(direction), l=source.layers, a=l.Hero,t=l.Title;
    const ix=Math.max(0,Math.min(t.x+t.w,a.x+a.w)-Math.max(t.x,a.x));
    const iy=Math.max(0,Math.min(t.y+t.h,a.y+a.h)-Math.max(t.y,a.y));
    const overlap=p.composition==='overlap'||(p.composition==='auto'&&ix*iy>t.w*t.h*.14);
    const m=JSON.parse(JSON.stringify(source));m.width=390;m.height=670;
    const r=m.layers;
    const top=p.datePosition==='top';
    const font=bounded(t.size*.60,40,80), hero=bounded(a.w*.59*p.heroScale,170,420);
    Object.assign(r.Label,{x:20,y:22,w:350,h:20,size:11});
    Object.assign(r.Title,{x:20,y:overlap?(top?150:110):(top?95:60),w:350,h:Math.ceil(font*2.24),size:font,align:p.align});
    Object.assign(r.Hero,{x:overlap?(p.align==='right'?-36:390-hero+25):(390-hero)/2,y:overlap?(top?175:145):(top?255:222),w:hero,h:hero*a.h/a.w});
    Object.assign(r.Date,{x:20,y:top?57:591,w:350,h:34,size:23,align:p.align});
    Object.assign(r.Venue,{x:20,y:640,w:350,h:20,size:12,align:p.align});
    return m;
  }
  return {roles,base,art,petals,initial,normalize,mobile,ink,accent};
})();
