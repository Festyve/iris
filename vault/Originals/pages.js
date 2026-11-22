// Vault-native page compositions. A collection supplies its subject, palette,
// artwork and copy. Each page role has its own geometry and reading order.
const OriginalPages=(()=>{
  const roles=['Home','Collection','Detail','Journal','Index','About','Programme','Lookbook','Contact'];
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
  const families=OriginalCollections.map(row=>{
    const [name,tags,headline,list,cta,paper,ink,accent,motif]=row;
    return {id:slug(name),name,tags,headline,items:list.split('|'),cta,paper:'#'+paper,ink:'#'+ink,accent:'#'+accent,motif};
  });
  function match(note){
    const phrase=' '+note.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
    let best=null,score=0;
    for(const f of families){
      const named=phrase.includes(' '+f.name.toLowerCase()+' ');
      const rank=(named?100:0)+f.tags.split(' ').filter(tag=>phrase.includes(' '+tag+' ') || phrase.includes(' '+tag+'s ')).length;
      if(rank>score){score=rank;best={id:f.id,f,original:true,exact:named,site:{title:f.name},fallback:false};}
    }
    return best;
  }
  function page(f,role,name,parent){
    const nodes=[], rect=(label,x,y,w,h,fill,extra={})=>nodes.push({type:'shape',name:label,x,y,w,h,fill,...extra});
    function text(value,x,y,w,size,weight=400,color=f.ink){
      const fit=Math.min(size,w/Math.max(1,Doc.measure(value,1,weight)));
      nodes.push({type:'text',name:value,text:value,x,y,w,h:Math.ceil(fit*1.18),size:fit,weight,color,lh:1.12,wrap:false});
    }
    const art=(i,x,y,w,h)=>rect(f.items[i],x,y,w,h,f.paper,{art:f.id+'/v3/'+i});
    const rule=(x,y,w)=>rect('Divider',x,y,w,1,f.ink);
    const row=(label,i,x,y,w)=>{rule(x,y,w);text(String(i+1).padStart(2,'0'),x,y+20,58,16);text(label,x+72,y+14,w-120,32,500);text('↗',x+w-36,y+16,36,25);};
    const button=(value,x,y)=>{rect('Button',x,y,232,56,f.ink);text(value,x+18,y+17,195,18,600,f.paper);};
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
    }else{
      heading('Contact');text('Get in touch',54,280,675,52,500);button('Contact the studio',54,393);
      art(2,864,118,522,446);f.items.forEach((v,i)=>row(v,i,54,539+i*75,729));
    }
    rule(54,824,1332);text(name,54,849,650,18,600);text(role,1200,849,182,18);
    nodes.forEach((n,i)=>{n.parent=parent;n.id=parent+'-'+i;});
    return {screen:{id:parent,name:name+' · '+role,w:1440,h:900,fill:f.paper,layout:'stack',vaultSource:f.id},nodes};
  }
  function build(note,m,title,captureOnly){
    const f=m.f,name=/called|named|["“]/i.test(note)?title:f.name;
    const requested=note.toLowerCase().replace(f.name.toLowerCase(),'').replace(f.id,'');
    const first=roles.find(r=>new RegExp('\\b'+r+'\\b','i').test(requested))||'Home';
    const selected=captureOnly?[first]:[...new Set([first,'Collection','Detail','Home'])].slice(0,3);
    const pages=selected.map((r,i)=>page(f,r,name,['web','collection','detail'][i]));
    return {name,reference:{id:f.id,title:f.name,url:'',vaultOnly:true,original:true,setups:pages.map(p=>({screen:p.screen.id,source:f.id}))},screens:pages.map(p=>p.screen),nodes:pages.flatMap(p=>p.nodes)};
  }
  return {families,roles,match,page,build};
})();
