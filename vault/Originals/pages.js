// Vault-native page compositions. A collection supplies its subject, palette,
// artwork and copy. Each page role has its own geometry and reading order.
const OriginalPages=(()=>{
  const roles=['Home','Collection','Detail','Journal','Index','About','Programme','Lookbook','Contact','Billboard','Atlas','Catalogue'];
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
  const families=OriginalCollections.map(row=>{
    const [name,tags,headline,list,cta,paper,ink,accent,motif]=row;
    return {id:slug(name),name,tags,headline,items:list.split('|'),cta,paper:'#'+paper,ink:'#'+ink,accent:'#'+accent,motif};
  });
  for(const f of families)f.sources=OriginalWebSources.filter(row=>row[0]===f.name);
  const phrases={'mile-marker':['road trip','road trips'],'trail-register':['national park'],'side-table':['restaurant booking'],'daybreak':['coffee shop','coffee shops'],'paper-miles':['trip planner','travel planner']};
  function match(note){
    const phrase=' '+note.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()+' ';
    let best=null,score=0;
    for(const f of families){
      const named=phrase.includes(' '+f.name.toLowerCase()+' ');
      const sourceNamed=f.sources.some(([,site])=>phrase.includes(' '+site.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' '));
      const phraseLength=Math.max(0,...(phrases[f.id]||[]).filter(term=>phrase.includes(' '+term+' ')).map(term=>term.length));
      const rank=(named?100:0)+(sourceNamed?50:0)+(f.id==='mile-marker' && phraseLength?30:phraseLength)+f.tags.split(' ').filter(tag=>phrase.includes(' '+tag+' ') || phrase.includes(' '+tag+'s ')).length;
      if(rank>score){score=rank;best={id:f.id,f,original:true,exact:named,site:{title:f.name},fallback:false};}
    }
    return best;
  }
  const rolesFor=f=>f.id==='daybreak'?FieldGuides.cafeRoles:f.id==='paper-miles'?FieldGuides.travelRoles:roles;
  const sequences={
    'night-platform':['Atlas','Programme','Index'],'last-showing':['Billboard','Programme','Detail'],
    'second-sweep':['Catalogue','Lookbook','Detail'],'mile-marker':['Atlas','Lookbook','Index'],
    'camp-almanac':['Lookbook','Atlas','Detail'],'sleeper-car':['Atlas','Programme','Detail'],
    'small-hours-inn':['Lookbook','Catalogue','Contact'],'offbeat-cabinet':['Atlas','Journal','Detail'],
    'side-table':['Home','Catalogue','Contact'],'gallery-sunday':['Billboard','Programme','Lookbook'],
    'walk-ledger':['Atlas','Programme','Detail'],'trail-register':['Atlas','Index','Detail'],
    'host-house':['Lookbook','About','Contact']
  };
  function page(f,role,name,parent,city){
    const nodes=[], rect=(label,x,y,w,h,fill,extra={})=>nodes.push({type:'shape',name:label,x,y,w,h,fill,...extra});
    function text(value,x,y,w,size,weight=400,color=f.ink){
      const fit=Math.min(size,w/Math.max(1,Doc.measure(value,1,weight)));
      nodes.push({type:'text',name:value,text:value,x,y,w,h:Math.ceil(fit*1.18),size:fit,weight,color,lh:1.12,wrap:false});
    }
    const art=(i,x,y,w,h)=>rect(f.items[i],x,y,w,h,f.paper,{art:f.id+'/v3/'+i});
    const rule=(x,y,w)=>rect('Divider',x,y,w,1,f.ink);
    const row=(label,i,x,y,w)=>{rule(x,y,w);text(String(i+1).padStart(2,'0'),x,y+20,58,16);text(label,x+72,y+14,w-120,32,500);text('↗',x+w-36,y+16,36,25);};
    const button=(value,x,y)=>{rect('Button',x,y,232,56,f.ink);text(value,x+18,y+17,195,18,600,f.paper);};
    const ui={text,rect,art,rule};
    if(f.id==='daybreak')FieldGuides.cafe(role,name,ui);
    else if(f.id==='paper-miles')FieldGuides.travel(role,name,ui,city);
    else{
    text(name,54,24,540,30,700);['Collection','Journal','About'].forEach((n,i)=>text(n,800+i*132,33,120,17,500));
    text(f.cta,1210,33,176,17,700);rule(54,79,1332);
    const heading=(value=f.headline)=>text(value,54,118,1320,92,600);
    if(role==='Home'){
      text(f.headline,54,178,610,85,600);button(f.cta,54,345);art(0,755,112,631,538);
      f.items.forEach((v,i)=>row(v,i,54,494+i*76,630));
    }else if(role==='Collection'){
      heading();f.items.forEach((v,i)=>{const x=54+i*451;art(i,x,275,424,362);text(v,x,662,420,33,600);rule(x,723,424);});
    }else if(role==='Detail'){
      art(1,54,116,745,639);text(f.items[1],854,180,520,70,600);text(f.headline,854,337,505,26);button(f.cta,854,431);
      row(f.items[0],0,854,626,532);
    }else if(role==='Journal'){
      heading('Journal');art(2,54,270,688,467);f.items.forEach((v,i)=>row(v,i,798,280+i*140,588));
    }else if(role==='Index'){
      heading('Index');f.items.forEach((v,i)=>{const y=259+i*162;rule(54,y,1332);art(i,60,y+12,155,132);text(v,275,y+48,840,48,500);text('View ↗',1230,y+55,142,23);});
    }else if(role==='About'){
      text('About '+name,54,124,850,74,600);text(f.headline,54,279,705,42);button(f.cta,54,402);
      art(1,842,127,544,464);f.items.forEach((v,i)=>{const x=54+i*452;rule(x,684,418);text(v,x,710,418,30,500);});
    }else if(role==='Programme'){
      heading('Programme');f.items.forEach((v,i)=>{const y=260+i*146;rule(54,y,1332);text(['10 AM','1 PM','4 PM'][i],54,y+32,200,31);text(v,300,y+26,790,48,600);art(i,1230,y+8,148,126);});
    }else if(role==='Lookbook'){
      text('Lookbook',54,108,770,67,600);art(0,54,216,663,566);art(2,748,216,320,273);art(1,1090,216,296,253);text(f.headline,748,563,630,47,500);
    }else if(role==='Billboard'){
      rect('Marquee field',54,106,1332,453,f.ink);
      art(0,780,106,606,453);
      text(f.headline,92,181,646,82,600,f.paper);
      text(f.items[0],92,336,625,35,400,f.paper);
      rect('Marquee action',93,437,218,53,f.paper);
      text(f.cta,110,454,185,17,600,f.ink);
      f.items.forEach((item,i)=>{
        const x=54+i*452;
        rule(x,611,423);
        text(String(i+1).padStart(2,'0'),x,632,54,18);
        text(item,x,687,406,42,600);
      });
    }else if(role==='Atlas'){
      text('Atlas',54,123,690,82,600);
      text(f.headline,793,153,591,36,500);
      rect('Map surface',54,255,811,508,f.ink);
      for(let i=0;i<10;i++)rect('Grid meridian',84+i*82,275,1,468,f.accent);
      for(let i=0;i<6;i++)rect('Grid parallel',72,302+i*83,775,1,f.accent);
      const points=[[170,641],[432,472],[718,365]];
      points.forEach(([x,y],i)=>{
        if(i<2){
          const [nx,ny]=points[i+1];
          rect('Route east',x,y,nx-x,4,f.paper);
          rect('Route north',nx,ny,4,y-ny+4,f.paper);
        }
      });
      points.forEach(([x,y],i)=>{
        rect('Stop '+(i+1),x-10,y-10,24,24,f.paper,{shape:'ellipse'});
        text(f.items[i],x-42,y-50,181,20,600,f.paper);
      });
      art(1,925,259,208,177);
      f.items.forEach((item,i)=>row(item,i,925,472+i*94,461));
    }else if(role==='Catalogue'){
      text('Catalogue',54,110,901,85,600);
      text(f.headline,925,140,460,27);
      f.items.forEach((item,i)=>{
        const y=240+i*186;
        rule(54,y,1332);
        text(String(i+1).padStart(2,'0'),54,y+21,80,22);
        art(i,174,y+14,180,153);
        text(item,400,y+52,707,56,600);
        text('View edition ↗',1184,y+67,202,20,500);
      });
    }else{
      heading('Contact');text('Get in touch',54,280,675,52,500);button('Contact the studio',54,393);
      art(2,864,118,522,446);f.items.forEach((v,i)=>row(v,i,54,539+i*75,729));
    }
    rule(54,824,1332);text(name,54,849,650,18,600);text(role,1200,849,182,18);
    }
    nodes.forEach((n,i)=>{n.parent=parent;n.id=parent+'-'+i;});
    return {screen:{id:parent,name:name+' · '+role,w:1440,h:900,fill:f.paper,layout:'stack',vaultSource:f.id},nodes};
  }
  function build(note,m,title,captureOnly){
    const f=m.f,name=/called|named|["“]/i.test(note)?title:f.name;
    const requested=note.toLowerCase().replace(f.name.toLowerCase(),'').replace(f.id,'');
    const available=rolesFor(f);
    const defaults=available===roles?(sequences[f.id]||['Home','Collection','Detail']):available;
    const explicit=available.find(r=>new RegExp('\\b'+r+'\\b','i').test(requested));
    const selected=captureOnly?[explicit||defaults[0]]:[...new Set([explicit||defaults[0],...defaults,...available])].slice(0,available===FieldGuides.cafeRoles?4:3);
    const city=Object.keys(FieldGuides.destinations).find(c=>requested.includes(c.toLowerCase()));
    const pages=selected.map((r,i)=>page(f,r,name,['web','collection','detail','visit'][i],city));
    return {name,reference:{id:f.id,title:f.name,url:'',vaultOnly:true,original:true,city,sources:f.sources.map(([,title,url,pattern])=>({title,url,pattern})),setups:pages.map(p=>({screen:p.screen.id,source:f.id}))},screens:pages.map(p=>p.screen),nodes:pages.flatMap(p=>p.nodes)};
  }
  return {families,roles,rolesFor,match,page,build};
})();
