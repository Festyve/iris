// Each screen is a projection of one checked-in upstream page at a real CSS viewport.
const CodeSites=(()=>{
  function match(note){
    const query=String(note).normalize('NFKD').toLowerCase();
    const words=query.match(/[\p{L}\p{N}]+/gu)||[];
    const ranked=CodeIndex.map(site=>{
      const searchable=(site.title+' '+site.tags+' '+site.source).normalize('NFKD').toLowerCase().split(/[^\p{L}\p{N}]+/u);
      const score=words.reduce((n,w)=>n+(searchable.includes(w)?1:0),0)+(query.split(/[^a-z0-9-]+/).includes(site.id)?100:0);
      return {id:site.id,site,score};
    }).sort((a,b)=>b.score-a.score);
    return ranked[0].score?ranked[0]:{id:'code-milligram',site:CodeIndex.find(s=>s.id==='code-milligram'),fallback:true};
  }
  function panels(id){
    return [{source:id,id:'web',width:1440,title:'Desktop'},...(id==='code-cafe'?[{source:'code-cafe-products',id:'menu',width:1440,title:'Menu'}]:[]),{source:id,id:'mobile',width:390,title:'Mobile'}];
  }
  function page(panel,layout,brand){
    const screen={id:panel.id,name:brand+' · '+panel.title,w:layout.w,h:layout.h,layout:'stack',fill:'#FFFFFF',vaultSource:panel.source};
    const nodes=layout.nodes.map(n=>({...n,id:panel.id+'-'+n.id,parent:panel.id,slot:n.id,
      ...(n.copyRole==='brand'?{text:brand}:{} )}));
    return {screen,nodes};
  }
  function build(brand,m,measured){
    const setups=panels(m.id);
    const doc={name:brand,reference:{id:m.id,title:m.site.title,url:m.site.url,kind:'html-css',vaultOnly:true,fallback:!!m.fallback,setups:setups.map(p=>({screen:p.id,source:p.source}))},screens:[],nodes:[]};
    for(const p of setups){
      const {nodes,screen}=page(p,measured?.[p.id]||CodeLayouts[p.source][p.width],brand);
      doc.screens.push(screen);doc.nodes.push(...nodes);
    }
    return doc;
  }
  return {match,panels,build,page};
})();
