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
    const quoted=note.match(/["“]([^"”]{1,55})["”]/);
    const named=quoted || note.match(/\b(?:called|named)\s+(.{1,55})/i);
    const subject = named ? named[1] : note.replace(/^(?:(?:please|can you|i want|make|design|create|build|me|a|an|the)\s+)+/i,'')
      .replace(/^(?:website|landing page|site|homepage)\s+(?:(?:for|about|selling)\s+)?/i,'').replace(/\s+(?:website|site|landing page|homepage)\b.*$/i,'');
    const title = (subject || note).trim().slice(0,55);
    return title.charAt(0).toUpperCase()+title.slice(1);
  }
  // These are product words only. Geometry and artwork always come from the selected captures.
  const vocabularies = [
    [/poker|hold.em|casino|card room/i, ['Live tables','Join a table','Cash games','Tournaments','No-limit Hold’em','Omaha','Private tables','Open seats','Table details','House rules']],
    [/coffee|caf[eé]|bakery|restaurant|food/i, ['Seasonal menu','See menu','Bakery','Coffee','Breakfast','Lunch','Reserve a table','Visit us','Opening hours','Our kitchen']],
    [/fashion|clothing|shoe|jewel|store|shop/i, ['The collection','Shop now','New arrivals','Collections','Accessories','Size guide','Wishlist','Availability','Product details','Delivery']],
    [/travel|hotel|stay|resort/i, ['Plan a stay','Book a stay','Destinations','Rooms','Weekend stays','Experiences','Availability','Guest guide','Visit details','Amenities']],
    [/bank|payment|financ|budget/i, ['Your accounts','Open an account','Balances','Transfers','Activity','Statements','Payments','Savings','Account details','Support']],
    [/music|radio|audio|album/i, ['On rotation','Listen now','Releases','Artists','Live sessions','Playlists','Stations','Schedule','Release notes','Tracklist']],
    [/ceramic|pottery|studio|artist|gallery/i, ['Studio collection','Explore work','Collections','Workshops','Current work','Editions','Visit the studio','Bookings','Studio notes','Materials']]
  ];
  const general=['Selected work','Explore','Collection','Journal','Latest releases','Highlights','Contact','Availability','Details','About'];
  const neutral=/^(log in|sign in|sign up|pricing|support|menu|search|about|help|faq|learn more|subscribe|resources|explore|settings|home|contact|next|back|continue|all|new|beta)$/i;

  const pokerTables=['The Button','Night Shift','Copper Club','Sunday Social','The Turn','After Hours','Blue Bird','The Orchard'];
  function catalogLabel(source,words,name,x,y,index) {
    if (source==='metalforge' && x>=240 && y>210) {
      const column=Math.max(0,Math.min(3,Math.floor((x-240)/297)));
      const card=column+(y>650?4:0);
      if(words[0]==='Live tables') {
        const meta=[pokerTables[card],card%2?'Pot-limit Omaha':'No-limit Hold’em',
          ['$1 / $2','$2 / $5','$5 / $10'][card%3],(card%4+1)+' seats open','Join waitlist'];
        return meta[index%meta.length];
      }
      const meta=[words[card%words.length],words[8],name,words[1],words[9]];
      return meta[index%meta.length];
    }
    return words[index%words.length];
  }

  // Companion layouts are existing captures with a collection or detail structure.
  const collections=['metalforge','godly'];
  const details=['apple-liquid-glass','teenage-engineering','poolsuite','ui-chords'];
  function build(note,m=match(note),captureOnly=false) {
    if(!m || !Object.prototype.hasOwnProperty.call(ReferenceSites,m.id)) throw Error('No usable website setup is available in the vault.');
    const available=new Set(ReferenceMedia.filter(r=>r.path.startsWith('assets/sites/')).map(r=>r.path.slice(13,-4)));
    const name=m.exact?ReferenceBrands[m.id]:ReferenceMatch.poker(note) && !/called|named|["“]/i.test(note)?'River Room':titleOf(note);
    const words=(vocabularies.find(v=>v[0].test(note)) || [null,general])[1];
    const pages=[{id:'web',source:m.id,title:'Home'}];
    if(!captureOnly) {
      const candidates=ids=>ids.filter(id=>available.has(id) && !pages.some(p=>p.source===id));
      const collection=candidates(collections)[0];
      if(!collection)throw Error('The vault needs a collection setup to build this website.');
      pages.push({id:'collection',source:collection,title:words[2]});
      const preferred=/music|audio|radio/i.test(note)?['ui-chords','poolsuite']: /hardware|game|poker|shop/i.test(note)?['teenage-engineering','apple-liquid-glass']:details;
      const detail=candidates([...preferred,...details])[0];
      if(!detail)throw Error('The vault needs a detail setup to build this website.');
      pages.push({id:'detail',source:detail,title:words[8]});
    }
    const doc={name,reference:{id:m.id,title:m.site.title,url:m.site.url || '',image:m.inspiration?.title || '',fallback:m.fallback,capture:m.exact,
      setups:pages.map(p=>({screen:p.id,source:p.source})),vaultOnly:true},screens:[],nodes:[]};
    for(const page of pages) {
      const site=ReferenceSites[page.source], exact=page.id==='web' && m.exact;
      doc.screens.push({id:page.id,name:name+' · '+page.title,w:1440,h:900,fill:site.bg,layout:'stack',vaultSource:page.source});
      site.shapes.forEach(([x,y,w,h,fill,path],i)=>{
        const n={id:page.id+'-s'+i,parent:page.id,type:'shape',name:(y<95?'Header':y>670?'Lower section':'Hero')+' · '+(path?'artwork ':'surface ')+(i+1),x,y,w,h,fill};
        if(path)n.art=page.source+'/v2/'+i;
        doc.nodes.push(n);
      });
      const slots=site.text;
      const heads=slots.map((s,i)=>({s,i})).filter(({s})=>s[1]>=85 && s[1]<710 && s[2]>60).sort((a,b)=>b.s[4]-a.s[4]);
      const hero=heads[0]?.i;
      const nav=slots.map((s,i)=>({s,i})).filter(({s})=>s[1]<95 && s[2]>=35).sort((a,b)=>a.s[0]-b.s[0]);
      let contentIndex=0;
      slots.forEach(([x,y,w,h,size,weight,color,original],i)=>{
        let label=original;
        if(!exact) {
          const navIndex=nav.findIndex(n=>n.i===i);
          if(i===hero) label=page.id==='web'?name:page.title;
          else if(navIndex===0) label=name;
          else if(neutral.test(original)) label=original;
          else if(navIndex>0) label=words[[2,3,6,1][(navIndex-1)%4]];
          else if(w<38 || size<9) {
            // Preserve legible compact symbols and values from the setup.
            if(!/^[0-9.,:%+·×↑↓←→$€ /-]{1,12}$/.test(original)) return;
          } else label=catalogLabel(page.source,words,name,x,y,contentIndex++);
        }
        const fit=Math.max(6,Math.min(size,w/Math.max(1,Doc.measure(label,1,weight))));
        doc.nodes.push({id:page.id+'-t'+i,parent:page.id,type:'text',name:label.slice(0,60),text:label,x,y,w,h,size:fit,weight,color,lh:1,align:'left',wrap:false});
      });
    }
    return doc;
  }
  return {match,build,artwork};
})();
