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
