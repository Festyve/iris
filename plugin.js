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
    return {id,frameIndex,target,color:colors[lane],delay:((id*37)%83)/250,duration:1.36+((id*13)%21)/25,lane};
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

/* Ordered primitives are the transport between the planner and both renderers. */
const Screens = (() => {
  const color = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
  function check(screen){
    const {name,width,height,background,layers}=screen||{};
    if(typeof name!=='string'||!name.trim()||name.length>90||!color(background)||
      !Number.isInteger(width)||width<240||width>1920||!Number.isInteger(height)||height<240||height>2400||
      !Array.isArray(layers)||!layers.length||layers.length>180)throw Error('Invalid screen definition.');
    for(const v of layers){
      if(!v||!['rect','text','ellipse'].includes(v.kind)||!color(v.fill)||typeof v.name!=='string'||!v.name.trim()||
        ![v.x,v.y,v.w,v.h].every(Number.isFinite)||v.x<0||v.y<0||v.w<1||v.h<1||
        v.x+v.w>width+1||v.y+v.h>height+1)throw Error('Invalid geometry in the screen plan.');
      if(v.kind==='text'&&(typeof v.text!=='string'||!v.text.trim()||v.text.length>240||!Number.isFinite(v.size)||v.size<8||v.size>110))throw Error('Invalid text in the screen plan.');
      if(v.radius!==undefined&&(!Number.isFinite(v.radius)||v.radius<0))throw Error('Invalid corner radius.');
    }
    return screen;
  }
  function starter(brief){
    const mobile=/transit|metro|train|commut|departure|bus stop/i.test(brief);
    const board=/kanban|task|sprint|project board/i.test(brief);
    const finance=/spend|budget|expense|financ|wallet/i.test(brief);
    if(!mobile&&!board&&!finance)throw Error('Connect Gemini for this custom brief, or try a local transit, task board, or spending screen.');
    const ink='#172523',muted='#51655E',leaf='#D9F79B',white='#FFFFFF',paper='#F4F6F1';
    const quoted=brief.match(/["“]([^"”\n]{1,32})["”]/);
    const name=quoted?quoted[1]:mobile?'Northline':board?'Studio board':'Ledger';
    const width=mobile?390:1040,height=mobile?780:690,layers=[];
    const shape=(kind,name,x,y,w,h,fill,radius=0)=>layers.push({kind,name,x,y,w,h,fill,radius});
    const box=(name,x,y,w,h,fill,r=0)=>shape('rect',name,x,y,w,h,fill,r);
    const label=(text,x,y,w,size,fill=ink,bold=false)=>layers.push({kind:'text',name:text.slice(0,50),text,x,y,w,h:Math.ceil(size*1.32),size,fill,bold});
    if(mobile){
      box('Station header',0,0,390,307,ink);label(name,24,28,300,22,leaf,true);
      label('Union Station',24,98,345,38,white,true);label('Northbound platform',25,152,330,17,'#C1D4CC');
      box('Departure highlight',24,207,342,70,leaf,14);label('Next train',40,219,180,14);label('3 min',258,223,94,26,ink,true);
      label('Departures',24,338,320,26,ink,true);
      ['North York Centre','Finch','Sheppard–Yonge','Finch'].forEach((s,i)=>{
        const y=397+i*76;shape('ellipse','Line marker',24,y,30,30,'#F7CA51');label('1',34,y+5,13,15,ink,true);
        label(s,70,y,212,18,ink,true);label('Platform 2',70,y+30,180,13,muted);label([3,8,13,19][i]+' min',308,y+3,65,15);
        box('Divider',24,y+59,342,1,'#CFDAD1');
      });
      box('Save station',24,715,342,44,ink,12);label('Save station',137,727,130,15,white,true);
    }else if(board){
      box('Navigation',0,0,width,67,ink);label(name,32,19,420,23,leaf,true);
      label('Product sprint',32,99,610,40,ink,true);label('Design and engineering',34,159,560,17,muted);
      const cols=[['Backlog','Search filters','Update shortcuts','Export states'],['In progress','Mobile navigation','Activity history'],['In review','Color system','Keyboard focus']];
      cols.forEach((col,i)=>{const x=32+i*328;
        box(col[0]+' column',x,220,312,420,'#E4EBE2',16);label(col[0],x+16,237,230,21,ink,true);
        col.slice(1).forEach((s,k)=>{const y=292+k*101;box('Task card',x+12,y,288,85,white,12);label(s,x+26,y+14,255,18,ink,true);label(['Design','Engineering','Product'][k],x+26,y+48,235,13,muted)});
      });
    }else{
      box('Sidebar',0,0,188,height,ink);label(name,20,31,151,24,leaf,true);
      ['Overview','Activity','Budgets','Reports'].forEach((s,i)=>label(s,22,122+i*44,145,16,i?'#C1D4CC':white,i===0));
      label('Spending overview',218,44,790,42,ink,true);label('November',220,110,300,17,muted);
      box('Total card',218,165,785,217,ink,16);label('Total spending',245,191,360,17,leaf);label('$2,480',242,239,390,54,white,true);
      [40,55,36,62,90,75,103,85,125,103,133,153].forEach((v,i)=>box('Daily spending',590+i*32,351-v,20,v,leaf,4));
      label('Recent activity',219,415,610,27,ink,true);['Neighborhood market','City transit','Paper & ink'].forEach((s,i)=>{const y=479+i*57;label(s,221,y,440,18);label(['$68.40','$24.00','$42.50'][i],895,y,108,17,ink,true);box('Divider',220,y+37,784,1,'#CDD8D1')});
    }
    return check({name,width,height,background:paper,layers});
  }
  return {check,starter};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Screens;

// Map each visit to an ordered slice of the design. Small and large fleets both
// build every layer once, even when a slow frame skips an animation phase.
function screenJobs(count,screen){
  const jobs=Shared.makeJobs(count,screen.layers,screen.width,screen.height),total=count*3;
  for(const job of jobs){
    for(let stage=0;stage<3;stage++){
      const slot=stage*count+job.id;
      const first=Math.floor(slot*screen.layers.length/total),last=Math.floor((slot+1)*screen.layers.length/total);
      const layer=screen.layers[first];
      job.targets[stage]={first,last};
      job.points[stage+1]={x:layer.x+layer.w*(.18+(job.id%5)*.12),y:layer.y+layer.h*.45};
    }
  }
  return jobs;
}

figma.showUI(__html__, {width:340,height:560,themeColors:true});
let desk,phone,arrow,last='',direction=Object.assign({},SC.initial),active=false;
const fonts={Title:{family:'Inter',style:'Black'},normal:{family:'Inter',style:'Regular'}};
function paint(hex){return [{type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}}]}
function hex(n,fallback){const p=Array.isArray(n.fills)&&n.fills[0];if(!p||p.type!=='SOLID')return fallback;return '#'+['r','g','b'].map(k=>Math.round(p.color[k]*255).toString(16).padStart(2,'0')).join('')}
function drawFrame(scene,name,x,y) {
  const frame=figma.createFrame();frame.name=name;frame.resize(scene.width,scene.height);frame.x=x;frame.y=y;frame.fills=paint(scene.bg);frame.clipsContent=true;
  for(const role of SC.roles){
    const v=scene.layers[role];
    let n;
    if(role==='Hero'){n=figma.createNodeFromSvg(SC.art(v.fill));n.rescale(v.w/n.width)}
    else {n=figma.createText();n.fontName=role==='Title'?fonts.Title:fonts.normal;n.characters=v.text;
      n.fontSize=v.size;n.lineHeight={unit:'PERCENT',value:role==='Title'?92:110};n.textAutoResize='HEIGHT';n.resize(v.w,n.height);n.textAlignHorizontal=v.align==='right'?'RIGHT':'LEFT';n.fills=paint(v.fill)}
    frame.appendChild(n);n.name=role;n.x=v.x;n.y=v.y;
  }
  return frame;
}
function read(){
  const s=SC.base();s.bg=hex(desk,s.bg);s.width=desk.width;s.height=desk.height;
  for(const role of SC.roles){const n=desk.children.find(c=>c.name===role);if(!n)throw Error('Restore the '+role+' layer to resume.');
    const v=s.layers[role];Object.assign(v,{x:n.x,y:n.y,w:n.width,h:n.height});
    if(n.type==='TEXT'){v.text=n.characters;v.size=typeof n.fontSize==='number'?n.fontSize:v.size;v.fill=hex(n,v.fill)}
  }return s;
}
function cursor(x,y){
  if(!arrow||arrow.removed){arrow=figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="32"><path d="M2 2L25 16L15 18L10 29Z" fill="#7A47E7" stroke="white" stroke-width="2"/></svg>');arrow.name='Iris · pointer';arrow.locked=true}
  figma.currentPage.appendChild(arrow);arrow.x=x;arrow.y=y;
}
function render(force,focus) {
  if(!active||!desk||desk.removed)return;
  const s=read(),sig=JSON.stringify(s)+JSON.stringify(direction);if(!force&&sig===last)return;
  const m=SC.mobile(s,direction);
  // Clone the real hero so the proposal preserves vector edits and fills.
  const fresh=drawFrame(m,'Mobile · proposal',desk.x+desk.width+84,desk.y);
  const placeholder=fresh.children.find(n=>n.name==='Hero'), art=desk.children.find(n=>n.name==='Hero').clone();
  fresh.insertChild(1,art);art.rescale(m.layers.Hero.w/art.width);art.x=placeholder.x;art.y=placeholder.y;placeholder.remove();
  if(phone&&!phone.removed)phone.remove();phone=fresh;last=sig;
  const target=m.layers[focus]||m.layers.Title;cursor(phone.x+target.x+8,phone.y+target.y+8);
  figma.ui.postMessage({kind:'scene',source:s});
}
let failure='';
function tick(){try{render(false);failure=''}catch(e){if(String(e)!==failure){failure=String(e);figma.ui.postMessage({kind:'error',text:failure})}}}
async function startSample(){
  await Promise.all([figma.loadFontAsync(fonts.Title),figma.loadFontAsync(fonts.normal)]);
  if(desk&&!desk.removed)return;
  const center=figma.viewport.center;desk=drawFrame(SC.base(),'Desktop · edit me',Math.round(center.x-650),Math.round(center.y-300));active=true;render(true);figma.viewport.scrollAndZoomIntoView([desk,phone]);figma.currentPage.selection=inputFrame&&!inputFrame.removed?[inputFrame]:[desk];
  setInterval(tick,650);
}
figma.ui.onmessage=async msg=>{
  try{
    if(msg.kind==='ui-ready'){if(inputFrame&&!inputFrame.removed)figma.ui.postMessage({kind:'custom-source',name:inputFrame.name});else figma.ui.postMessage({kind:'blank-source'});return}
    if(msg.kind==='new-screen'){await startScreen(msg.screen,[5,25,100].includes(msg.count)?msg.count:100);return}
    if(['fleet-context','launch-fleet','apply','keep','snapshot'].includes(msg.kind)&&!targetFrame())await startSample();
    if(msg.kind==='fleet-context'){
      try{const f=targetFrame();if(!f)throw Error('Select a source frame.');
        const img=await f.exportAsync({format:'PNG',constraint:{type:'WIDTH',value:720}});
        figma.ui.postMessage({kind:'fleet-context',id:msg.id,sourceKey:f.id,source:{name:f.name,width:f.width,height:f.height,layers:f.children.slice(0,64).map((n,index)=>({index,name:n.name,type:n.type,x:n.x,y:n.y,w:n.width,h:n.height}))},png:figma.base64Encode(img)});
      }catch(e){figma.ui.postMessage({kind:'fleet-context',id:msg.id,error:e.message})}return}
    if(msg.kind==='launch-fleet'){await launchFleet([5,25,100].includes(msg.count)?msg.count:100,msg.brief,msg.sourceKey,msg.shared);return}
    if(msg.kind==='pause-fleet'){pauseFleet();return}
    if(msg.kind==='stop-fleet'){stopFleet();return}
    if(msg.kind==='snapshot'){try{const img=await desk.exportAsync({format:'PNG',constraint:{type:'WIDTH',value:720}});figma.ui.postMessage({kind:'snapshot',id:msg.id,png:figma.base64Encode(img)})}catch(e){figma.ui.postMessage({kind:'snapshot',id:msg.id})}return}
    if(msg.kind==='apply'){direction=SC.normalize(msg.plan);render(true,msg.focus)}
    if(msg.kind==='keep'&&phone&&!phone.removed){const saved=phone.clone();saved.name='Mobile · saved';saved.x=phone.x;saved.y=phone.y+phone.height+64;while(figma.currentPage.children.some(n=>n!==saved&&n.name==='Mobile · saved'&&n.x===saved.x&&n.y===saved.y))saved.y+=saved.height+64;figma.notify('Editable mobile frame saved below the proposal.')}
  }catch(e){figma.ui.postMessage({kind:'error',text:String(e)})}
};
figma.on('close',()=>{if(nativeRun)dropBoard(nativeRun);if(arrow&&!arrow.removed)arrow.remove()});

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
    if(run.shared){stepShared(run);return}
    let done=0;
    for(const j of run.jobs){if(j.finished){done++;continue}const t=Swarm.progress(j,run.elapsed);applyGroup(j,t);if(t>=1){j.finished=true;done++}}
    if(done!==run.done){run.done=done;postFleet('running',{done,total:run.jobs.length,frames:run.frames})}
    if(done===run.jobs.length){clearInterval(run.timer);run.timer=null;for(const j of run.jobs)if(!j.ptr.removed)j.ptr.remove();
      run.board.name='Iris · '+run.frames+' finished layouts';nativeRun=null;postFleet('finished',{done,total:done,frames:run.frames});figma.commitUndo()}
  }catch(e){stopFleet();figma.ui.postMessage({kind:'error',text:'Swarm stopped: '+e.message})}
}
async function launchFleet(count,brief,sourceKey,shared){
  if(nativeRun||starting)return;
  const source=targetFrame();
  if(!source||source.removed||!source.children.some(n=>n.visible)){throw Error('Select a Figma frame with a visible child layer.')}
  if(sourceKey&&sourceKey!==source.id)throw Error('Source selection changed. Launch again for this frame.');
  if(shared){launchShared(source,count,brief);return}
  starting=true;
  let board;
  try{
    const sample=source===desk,scene=sample?read():null,grid=Swarm.configs(count);
    const used=source.findAll(()=>true).length*grid.items.length;
    if(used>16000)throw Error('Choose a smaller product section or fewer cursors for this frame.');
    const fontList=new Map();
    for(const n of source.children)if(n.type==='TEXT'&&n.fontName!==figma.mixed)fontList.set(JSON.stringify(n.fontName),n.fontName);
    await Promise.all(Array.from(fontList.values()).map(f=>figma.loadFontAsync(f)));
    board=figma.createFrame();board.name='Iris · working layouts';board.setPluginData('sc-output','yes');board.resize(grid.width+144,grid.height+144);
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
  postFleet(nativeRun.paused?'paused':'running',{done:Math.max(0,nativeRun.done),total:nativeRun.jobs.length,frames:nativeRun.frames,shared:nativeRun.shared,active:nativeRun.active});
}

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
