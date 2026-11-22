// The library stores outlines separately so page plugin data only needs their ids.
const Websites = (() => {
  function artwork(key) {
    if (typeof key !== 'string') return null;
    const [id,version,index] = key.split('/');
    if (!index) {
      const old = typeof LegacyOutlines!=='undefined' && Object.prototype.hasOwnProperty.call(LegacyOutlines,id) && LegacyOutlines[id][Number(version)];
      return old ? {w:old[0],h:old[1],path:old[2]} : null;
    }
    if(version!=='v2')return null;
    const row = Object.prototype.hasOwnProperty.call(ReferenceSites,id) && ReferenceSites[id].shapes[Number(index)];
    return row && row[5] ? {w:row[2]/3,h:row[3]/3,path:row[5]} : null;
  }
  function match(note) { return ReferenceMatch.select(note, ReferenceMedia, Object.keys(ReferenceSites)); }
  function titleOf(note) {
    const named = note.match(/["“]([^"”]{1,55})["”]|\b(?:called|named)\s+(.{1,55})/i);
    const subject = named ? named[1] || named[2] : note.replace(/^(?:(?:please|can you|i want|make|design|create|build|me|a|an|the)\s+)+/i,'')
      .replace(/^(?:website|landing page|site|homepage)\s+(?:(?:for|about|selling)\s+)?/i,'').replace(/\s+(?:website|site|landing page|homepage)\b.*$/i,'');
    const title = (subject || note).trim().slice(0,55);
    return title.charAt(0).toUpperCase()+title.slice(1);
  }
  function base(name, match, bg) {
    return {name, reference:{id:match.id,title:match.site.title,url:match.site.url || '',image:match.inspiration?.title || '',fallback:match.fallback},
      screens:[{id:'web',name:name+' · Home',w:1440,h:900,fill:bg,layout:'stack'}],nodes:[]};
  }
  function add(doc,node) {
    node.id = 'part-'+(doc.nodes.length+1); node.parent = 'web'; doc.nodes.push(node); return node;
  }
  function text(doc,label,x,y,w,h,size,color,weight=400,align='left') {
    // Fit short local substitutions inside the corresponding reference slot.
    const fit = Math.max(6,Math.min(size,w/Math.max(1,Doc.measure(label,1,weight))));
    return add(doc,{type:'text',name:label.slice(0,60),text:label,x,y,w,h,size:fit,weight,color,lh:1,align,wrap:false});
  }
  function shape(doc,name,x,y,w,h,fill,r=0,stroke) {
    return add(doc,{type:'shape',name,x,y,w,h,fill,r,...(stroke?{stroke,sw:1}:{})});
  }
  function lobby(note,m) {
    const name = /called|named|["“]/i.test(note) ? titleOf(note) : 'River Room';
    const d = base(name,m,'#0D1010'), white='#F2F4ED', muted='#A9B4AC', lime='#D7F893';
    text(d,name,30,30,200,40,27,white,700);
    text(d,'POKER CLUB',30,80,190,20,13,muted,600);
    text(d,'Lobby',30,141,160,36,27,white,700);
    ['All tables','Cash games','Tournaments','Private tables'].forEach((s,i)=>{
      if (!i) shape(d,'Active navigation',18,207+i*48,195,40,'#26332B',8);
      text(d,s,32,218+i*48,150,22,16,i?muted:lime,i?400:600);
    });
    shape(d,'Sidebar divider',229,0,1,900,'#333A35');
    text(d,'Live tables',259,72,730,75,60,white,600);
    text(d,'Choose a table and take a seat.',262,160,720,32,22,muted);
    shape(d,'Private table action',1170,76,230,49,lime,24);
    text(d,'Create private table',1182,91,205,20,16,'#182419',600,'center');
    ['All games','Hold’em','Omaha','Open seats'].forEach((v,i)=>{
      shape(d,v+' filter',260+i*140,219,128,40,i?'#1F2421':white,20);
      text(d,v,265+i*140,231,118,20,15,i?white:'#182419',600,'center');
    });
    const names=['The Button','Night Shift','Copper Club','Sunday Social','The Turn','After Hours','Blue Bird','The Orchard'];
    const colors=['#34694C','#385B69','#785345','#525080'];
    names.forEach((s,i)=>{
      const x=260+(i%4)*289,y=299+Math.floor(i/4)*278;
      shape(d,s+' card',x,y,274,255,'#191F1C',14,'#303B34');
      shape(d,s+' felt',x+21,y+32,232,118,colors[i%4],58,'#738477');
      for(let j=0;j<3;j++){
        shape(d,'Playing card',x+91+j*32,y+64,28,43,'#F5F2E8',4);
        text(d,['A♠','K♥','7♦'][j],x+92+j*32,y+79,26,20,14,j?'#A43C43':'#15241D',700,'center');
      }
      text(d,s,x+16,y+166,242,30,23,white,600);
      text(d,i%2?'Pot-limit Omaha':'No-limit Hold’em',x+16,y+203,176,21,15,muted);
      text(d,(2+i%5)+'/6 seats',x+185,y+203,74,21,14,lime,600,'right');
    });
    return d;
  }
  const niches = [
    [/\b(coffee|cafe|bakery|restaurant|dining|food)\b/i,'Seasonal menu','View the menu','Reservations','Visit us'],
    [/\b(store|shop|fashion|clothing|sell|craft|shoe|jewel)/i,'The collection','Shop now','New arrivals','Our story'],
    [/\b(travel|hotel|resort|trip|stay|tourism)/i,'Find your next stay','Explore stays','Destinations','Book a stay'],
    [/\b(bank|payment|financ|money|budget|invest)/i,'Your money, in focus','Get started','Accounts','Pricing'],
    [/\b(photo|portfolio|art|gallery|architect)/i,'Selected work','View collection','Projects','Contact'],
    [/\b(music|radio|audio|song|album)/i,'Listen now','Start listening','Releases','Artists']
  ];
  function build(note,m=match(note)) {
    const site=ReferenceSites[m.id];
    if (!m.exact && m.id==='metalforge' && ReferenceMatch.poker(note)) return lobby(note,m);
    const name=m.exact?ReferenceBrands[m.id]:titleOf(note), d=base(name,m,site.bg);
    site.shapes.forEach(([x,y,w,h,fill,path],i)=>{
      const band=y<95?'Header':y>670?'Lower section':'Hero';
      const n=shape(d,band+' · '+(path?'artwork':'surface')+' '+(i+1),x,y,w,h,fill);
      if(path)n.art=m.id+'/v2/'+i;
    });
    if (m.exact) {
      for(const [x,y,w,h,size,weight,color,label] of site.text) {
        const copy=ReferenceCopy[m.id][label] || label;
        text(d,copy,x,y,w,h,size,color,weight);
      }
      d.reference.capture=true;
      return d;
    }
    const slots=site.text.filter(s=>s[2]>=34 && s[3]>=10);
    const main=slots.filter(s=>s[1]>85 && s[1]<710).sort((a,b)=>b[4]-a[4])[0] || slots[0];
    const copy=niches.find(n=>n[0].test(note)) || [null,'Explore '+name,'Explore','Overview','Contact'];
    // Preserve alignment, type scale and rhythm while removing the source brand and unrelated copy.
    const top=slots.filter(s=>s!==main && s[1]<100).sort((a,b)=>a[0]-b[0]);
    const body=slots.filter(s=>s!==main && s[1]>=100).sort((a,b)=>a[1]-b[1]);
    const write=(slot,label)=>text(d,label,...slot.slice(0,5),slot[6],slot[5]);
    if(main) write(main,name);
    top.slice(0,4).forEach((s,i)=>write(s,[name,copy[3],copy[4],copy[2]][i]));
    const occupied=main?[main]:[];
    const intersects=(a,b)=>a[0]<b[0]+b[2] && a[0]+a[2]>b[0] && a[1]<b[1]+b[3] && a[1]+a[3]>b[1];
    for(const s of body){
      if (occupied.length>=5 || occupied.some(b=>intersects(s,b))) continue;
      write(s,copy[occupied.length] || copy[2]); occupied.push(s);
    }
    return d;
  }
  return {match,build,artwork};
})();
