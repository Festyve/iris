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
  // Named captures rebuild exactly and poker keeps its gallery. Other briefs use an original family
  // when one fits the subject, and every remaining custom brief gets the general Iris Minimal template
  // instead of pouring generic words into another site's capture.
  function match(raw) { const captured=ReferenceMatch.select(raw, ReferenceMedia, Object.keys(ReferenceSites));
    if(captured?.named) return captured;
    // A real company in the brief only steers the kind of site; it never becomes the name.
    const note=BrandNames.neutralize(raw);
    const minimal=typeof MinimalPages!=='undefined';
    if(minimal && /\bminimal(?:ist)?\b/i.test(note)) return MinimalPages.match(note);
    const original=OriginalPages.match(raw) || OriginalPages.match(note);
    if(original) return original;
    if(ReferenceMatch.poker(note) || !minimal) return captured;
    return MinimalPages.match(note); }
  // Whether text names a kind of product (so it is a brief, not a brand name).
  function categoryTest(t) {
    return (typeof MinimalPages!=='undefined' && MinimalPages.kitFor(t).id!=='general') ||
      vocabularies.some(v=>v[0].test(t)) || !!OriginalPages.match(t);
  }
  const tidy=t=>{t=String(t).trim().replace(/\s+/g,' ').slice(0,40);return t.charAt(0).toUpperCase()+t.slice(1);};
  // The name a build shows. Explicit names are kept unless they belong to a real company; a short
  // name-like input is the name; otherwise an invented name fits the template, and original families
  // keep their own names. Returns null when the template's own name should be used.
  function nameFor(note,m) {
    const quoted=note.match(/["“]([^"”]{1,55})["”]/), called=note.match(/\b(?:called|named)\s+([^,.;:!?]{1,55})/i);
    const explicit=quoted?quoted[1]:called?called[1].replace(/\s+(?:for|with|that|which|who|where|in|on|about|and)\s.*$/i,''):null;
    const kind=m?.minimal?(m.kit?.id || 'general'):'general';
    if(m && !m.minimal && !m.original && m.exact) return null;
    if(m?.original && m.exact && !explicit) return null;
    if(explicit && explicit.trim()) return !BrandNames.realBrand(explicit) ? tidy(explicit) : m?.original ? null : BrandNames.invent(note,kind);
    if(BrandNames.looksLikeName(note,categoryTest)) return tidy(note);
    if(m?.original) return null;
    if(m && !m.minimal && m.exact) return null;
    if(m && !m.minimal && ReferenceMatch.poker(note)) return 'River Room';
    return BrandNames.invent(note,kind);
  }
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

  function shapeNodes(source,parent) {
    return RasterLayouts[source].shapes.map(([x,y,w,h,fill,image,name],i)=>({
      id:parent+'-s'+i,parent,type:'shape',name,x,y,w,h,fill,...(image?{art:source+'/v3/'+i}:{})
    }));
  }
  // The café brief uses the vault's three-column index as a printed menu,
  // and its compact directory as a list of opening times and pickup details.
  const cafeCopy={
    gumroad:[null,'Menu','Café','Bakery','Visit us','About','Our story','Hours','See menu',null,null,
      'Fresh coffee and pastries, made daily in our kitchen.','Stop by for a cup or take a look at the menu.',null,
      'See menu','Explore the bakery','Find our opening hours','Freshly baked',null,null,'Find your','daily cup'],
    paco:['Bakery','The counter menu changes with the season. Here’s what we’re making today.',
      'Ask the barista about today’s single-origin pour-over.','Baked here each morning, served until sold out.',
      'Coffee','Filter','Single-origin beans','Brewed to order','Bakery','Butter','Cultured butter','in a flaky croissant.',
      'Kitchen','Market toast','Ricotta, lemon zest','and fresh herbs.','Rye bun','Dark chocolate','and flaky salt.',
      'Morning roll','Cinnamon sugar','and orange.','Granola bowl','Yogurt and berries.','Lunch','Soup of the day','with sourdough.',
      'Note','Our kitchen works with wheat, milk, eggs and nuts. Ask us about ingredients.',
      'Oat milk is available for every coffee.'],
    emilkowal:['Opening hours','Visit the café','Hours','Monday–Friday   7 am – 5 pm','Saturday–Sunday   8 am – 4 pm',
      'At the café','Breakfast','Served from opening until 11 am.','Lunch','From 11 am until the kitchen closes.',
      'Bakery counter','Fresh pastries while they last.','To go','Order at the counter for pickup.']
  };
  // Companion layouts are existing captures with a collection or detail structure.
  const collections=['metalforge','godly'];
  const details=['apple-liquid-glass','teenage-engineering','poolsuite','ui-chords'];
  // Final guard: no real company name survives in a built page's copy or names.
  function scrubDoc(doc) {
    for (const n of doc.nodes) { if (typeof n.text === 'string') n.text = BrandNames.scrub(n.text); if (typeof n.name === 'string') n.name = BrandNames.scrub(n.name); }
    for (const s of doc.screens) s.name = BrandNames.scrub(s.name);
    doc.name = BrandNames.scrub(doc.name);
    return doc;
  }
  function build(raw,m=match(raw),captureOnly=false) { return scrubDoc(buildDoc(raw,m,captureOnly)); }
  function buildDoc(raw,m,captureOnly) {
    const picked=nameFor(raw,m), note=BrandNames.neutralize(raw).replace(/\s*\b(?:called|named)\s+[^,.;:!?]{1,55}|["“][^"”]{1,55}["”]/gi,'').trim() || raw;
    const named=picked ? note+' called "'+picked+'"' : note;
    if(m?.minimal)return MinimalPages.build(named,m,picked || titleOf(note),captureOnly);
    if(m?.original)return OriginalPages.build(named,m,picked || m.f.name,captureOnly);
    if(!m || !Object.prototype.hasOwnProperty.call(ReferenceSites,m.id)) throw Error('No usable website setup is available in the vault.');
    const available=new Set(ReferenceMedia.filter(r=>r.path.startsWith('assets/sites/')).map(r=>r.path.slice(13,-4)));
    const name=picked || ReferenceBrands[m.id] || 'Northwind';
    const words=(vocabularies.find(v=>v[0].test(note)) || [null,general])[1];
    const cafe=/\bcoffee\b|caf[eé]|bakery|espresso/i.test(note) && !m.exact;
    const pages=[{id:'web',source:m.id,title:'Home'}];
    if(!captureOnly) {
      const candidates=ids=>ids.filter(id=>available.has(id) && !pages.some(p=>p.source===id));
      const collection=candidates(cafe?['paco',...collections]:collections)[0];
      if(!collection)throw Error('The vault needs a collection setup to build this website.');
      pages.push({id:'collection',source:collection,title:words[2]});
      const preferred=cafe?['emilkowal',...details]:/music|audio|radio/i.test(note)?['ui-chords','poolsuite']: /hardware|game|poker/i.test(note)?['teenage-engineering','apple-liquid-glass']:details;
      const detail=candidates([...preferred,...details])[0];
      if(!detail)throw Error('The vault needs a detail setup to build this website.');
      pages.push({id:'detail',source:detail,title:words[8]});
    }
    const doc={name,reference:{id:m.id,title:ReferenceBrands[m.id] || name,url:m.site.url || '',image:m.inspiration?.title || '',fallback:m.fallback,capture:m.exact,
      setups:pages.map(p=>({screen:p.id,source:p.source})),vaultOnly:true},screens:[],nodes:[]};
    for(const page of pages) {
      const site=ReferenceSites[page.source], exact=page.id==='web' && m.exact;
      doc.screens.push({id:page.id,name:name+' · '+page.title,w:1440,h:900,fill:site.bg,layout:'stack',vaultSource:page.source});
      doc.nodes.push(...shapeNodes(page.source,page.id));
      const slots=RasterLayouts[page.source].text.map(([i,ink])=>({i,s:site.text[i],ink}));
      const heads=slots.filter(({s})=>s[1]>=85 && s[1]<710 && s[2]>60).sort((a,b)=>b.s[4]-a.s[4]);
      const hero=(heads[0] || slots[0])?.i;
      const nav=slots.filter(({s})=>s[1]<85 && s[2]>=35).sort((a,b)=>a.s[0]-b.s[0]);
      let contentIndex=0;
      slots.forEach(({s:[x,y,w,h,size,weight,,original],i,ink:color})=>{
        let label=original;
        if(!exact) {
          const navIndex=nav.findIndex(n=>n.i===i);
          if(cafe && cafeCopy[page.source]?.[i]) label=cafeCopy[page.source][i];
          else if(i===hero) label=page.id==='web'?name:page.title;
          else if(words[0]==='Live tables' && original.startsWith('One line of code')) label='No-limit Hold’em';
          else if(words[0]==='Live tables' && original.startsWith('platform you build')) label='Join waitlist';
          else if(navIndex===0) label=name;
          else if(neutral.test(original)) label=original;
          else if(navIndex>0) label=words[[2,3,6,1][(navIndex-1)%4]];
          else if(w<38 || size<9) {
            // Preserve legible compact symbols and values from the setup.
            if(!/^[0-9.,:%+·×↑↓←→$€ /-]{1,12}$/.test(original)) return;
          } else label=words[contentIndex++%words.length];
        }
        const fit=Math.max(6,Math.min(size,w/Math.max(1,Doc.measure(label,1,weight))));
        const centered=page.source==='gumroad' && (Math.abs(x+w/2-720)<10 || i===14);
        doc.nodes.push({id:page.id+'-t'+i,parent:page.id,type:'text',name:label.slice(0,60),text:label,x,y,w,h,size:fit,weight,color,lh:1,align:centered?'center':'left',wrap:false});
      });
    }
    return doc;
  }
  // The selectable templates. Each is a vault design under an invented name; "style" says what kind
  // of site it is. Typing a brief picks one at random and puts the typed text in place of its name.
  const templates=[
    {id:'music',label:'Music streaming',style:'Spotify-style',brief:'a music streaming app called "Slow Burn"'},
    {id:'payments',label:'Payments platform',style:'Stripe-style',brief:'recreate stripe'},
    {id:'sneakers',label:'Sneaker store',style:'Nike-style',brief:'a sneaker store called "Stride Supply"'},
    {id:'search',label:'AI search assistant',style:'Google-style',brief:'an AI search assistant startup called "Openframe"'},
    {id:'coffee',label:'Coffee shop',style:'Café & bakery',brief:'a coffee shop called "Daybreak"'},
    {id:'launch',label:'Startup launch page',style:'Dark launch',brief:'recreate animata'},
    {id:'shader',label:'3D shader animation',style:'Motion & WebGL',brief:'recreate scrollshaders'},
    {id:'retro',label:'Retro desktop',style:'Y2K / retro',brief:'recreate poolsuite'},
    {id:'cloud',label:'Developer platform',style:'Vercel-style',brief:'recreate vercel'},
    {id:'app',label:'Productivity app',style:'Raycast-style',brief:'recreate raycast'},
    {id:'hardware',label:'Hardware store',style:'Product catalogue',brief:'recreate teenage-engineering'},
    {id:'portfolio',label:'Studio portfolio',style:'Minimal editorial',brief:'a design studio portfolio called "Northwind Studio"'},
    {id:'firm',label:'Law & advisory firm',style:'Professional services',brief:'a law firm called "Hartwell & Vale"'},
    {id:'travel',label:'Travel planner',style:'Itineraries',brief:'a Tokyo travel planner'}
  ];
  const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Swap the template's name for a new title everywhere it appears, refitting single-line text.
  function retitle(doc,title) {
    const name=String(title).trim().replace(/\s+/g,' ').slice(0,40);
    if(!name || name===doc.name) return doc;
    const re=new RegExp(escapeRe(doc.name),'g');
    for(const n of doc.nodes) {
      if(typeof n.text==='string' && re.test(n.text)) {
        n.text=n.text.replace(re,name); n.name=String(n.name||'').replace(re,name).slice(0,60) || n.text.slice(0,60);
        if(n.wrap===false && n.w && n.size && typeof Doc!=='undefined' && Doc.measure) n.size=Math.max(6,Math.min(n.size,n.w/Math.max(1,Doc.measure(n.text,1,n.weight))));
      }
      re.lastIndex=0;
    }
    for(const s of doc.screens) s.name=s.name.replace(re,name);
    doc.name=name;
    return doc;
  }
  function fromTemplate(id,title) {
    const tpl=templates.find(x=>x.id===id) || templates[0];
    const doc=build(tpl.brief);
    doc.reference={...doc.reference,template:tpl.id,templateLabel:tpl.label};
    return title ? retitle(doc,title) : doc;
  }
  function randomTemplate(title,exclude) {
    const pool=templates.filter(x=>x.id!==exclude);
    return fromTemplate(pool[Math.floor(Math.random()*pool.length)].id,title);
  }
  return {match,build,artwork,shapeNodes,templates,fromTemplate,randomTemplate,retitle};
})();
