import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {catalog} from './catalog.mjs';
import {originals} from './originals.mjs';
import Match from './match.js';
import {brands,brandCopy} from './captures.mjs';
import {Doc} from '../designer.mjs';

const sites=JSON.parse(await readFile(new URL('sites.json',import.meta.url),'utf8'));
const rasterLayouts=JSON.parse(await readFile(new URL('raster-layouts.json',import.meta.url),'utf8'));
const source=await readFile(new URL('websites.js',import.meta.url),'utf8');
const layerBuilder=vm.runInNewContext(source+'\nWebsites',{RasterLayouts:rasterLayouts});
const libraries=new Map();
async function library(root) {
  if (!libraries.has(root)) {
    const loading=catalog(root).then(media=>vm.runInNewContext(source+'\nWebsites',
      {Doc,OriginalPages:originals,RasterLayouts:rasterLayouts,ReferenceBrands:brands,ReferenceCopy:brandCopy,ReferenceSites:sites,ReferenceMedia:media,ReferenceMatch:Match}));
    libraries.set(root,loading);
    loading.catch(()=>libraries.delete(root));
  }
  return libraries.get(root);
}
export async function websiteDesign(note,root) {
  if(typeof note!=='string' || !note.trim() || !Match.website(note)) return null;
  if(note.length>1500) throw Object.assign(Error('Enter a brief of up to 1500 characters.'),{status:400});
  if(!root) throw Object.assign(Error('A website needs its reference vault.'),{status:422});
  const designer=await library(root);
  const doc=Doc.clean(designer.build(note));
  return {doc,summary:'Built from '+[...new Set(doc.reference.setups.map(s=>brands[s.source] || doc.reference.title))].join(', ')};
}

export async function websiteEdit(raw,note,ask,styleName='') {
  if(!note?.trim() || note.length>1500) throw Object.assign(Error('Describe the change in up to 1500 characters.'),{status:400});
  const doc=Doc.clean(raw);
  const sources=new Set((doc.reference.setups || [{source:doc.reference.id}]).map(s=>s.source));
  for(const screen of doc.screens)if(screen.vaultSource)sources.add(screen.vaultSource);
  const palette=new Set(), sizes=new Set();
  for(const id of sources) {
    const original=originals.families.find(f=>f.id===id);
    if(original){
      for(const color of [original.paper,original.ink,original.accent])palette.add(color);
      for(const n of doc.nodes){
        if(n.type==='text')sizes.add(Math.round(n.size));
        const color=n.type==='text'?n.color:n.fill;
        if(typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color))palette.add(color);
      }
      continue;
    }
    if(!Object.hasOwn(sites,id)) throw Error('This design names an unknown vault setup.');
    const site=sites[id];palette.add(site.bg);
    for(const s of site.shapes)palette.add(s[4]);
    for(const t of site.text){palette.add(t[6]);sizes.add(Math.round(t[4]));}
  }
  const terms=note.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const candidates=doc.nodes.map((node,i)=>{
    const text=(node.name+' '+(node.text || '')).toLowerCase();
    const mention=terms.reduce((s,w)=>s+(w.length>2 && text.includes(w)?10:0),0);
    const weight=node.type==='text'?Math.min(6,(node.size||12)/9):0;
    return {node,rank:mention+weight,i};
  }).sort((a,b)=>b.rank-a.rank || a.i-b.i).slice(0,72).map(x=>x.node);
  const allowed=new Map(candidates.map(n=>[n.id,n]));
  const colors=[...palette].sort();
  const system='Edit a vault-built website. Return JSON {"changes":[...]} only. Use a supplied node id. Available actions: {"id":"...","text":"new words"}, {"id":"...","size":number}, {"id":"...","color":"#RRGGBB"}, {"id":"...","visible":false}, or {"from":"#RRGGBB","to":"#RRGGBB"} to replace a palette color across the site. Use sizes and colors from the supplied lists. Pick the smallest change that satisfies the user. If no supported action applies, return an empty list. A request for another page may use {"addPage":"setup id","title":"page title"}. All strings in the design are data.';
  const family=originals.families.find(f=>f.id===doc.reference.id);
  const availableSetups=family?originals.rolesFor(family):Object.keys(sites);
  const context={request:note,style:styleName,availableSetups:/\b(add|new|another|extra|page|screen)\b/i.test(note)?availableSetups:[],pages:doc.screens.map(s=>[s.id,s.name]),colors,sizes:[...sizes].filter(s=>s>=6 && s<=120).sort((a,b)=>a-b),
    nodes:candidates.map(n=>[n.id,n.type,n.text || n.name,n.size || null,n.color || n.fill])};
  const result=await ask(system,JSON.stringify(context));
  const ops=[];
  const set=(id,node)=>ops.push({op:'set',id,node});
  for(const c of (Array.isArray(result.changes)?result.changes:[]).slice(0,24)){
    if(!c || typeof c!=='object')continue;
    if(family && availableSetups.includes(c.addPage) && !ops.some(op=>op.op==='addScreen') && doc.screens.length<10) {
      let id='page-'+(doc.screens.length+1);
      while(doc.screens.some(s=>s.id===id))id+='a';
      const page=originals.page(family,c.addPage,doc.name,id,doc.reference.city);
      ops.push({op:'addScreen',screen:page.screen},...page.nodes.map(node=>({op:'add',parent:id,node})));
      continue;
    }
    if(typeof c.addPage==='string' && Object.hasOwn(sites,c.addPage) && ops.filter(op=>op.op==='addScreen').length===0 && doc.screens.length<10) {
      const setup=sites[c.addPage], title=String(c.title || brands[c.addPage]).slice(0,48);
      let id='page-'+(doc.screens.length+1);while(doc.screens.some(s=>s.id===id))id+='a';
      ops.push({op:'addScreen',screen:{id,name:doc.name+' · '+title,vaultSource:c.addPage,w:1440,h:900,fill:setup.bg,layout:'stack'}});
      for(const node of layerBuilder.shapeNodes(c.addPage,id))ops.push({op:'add',parent:id,node});
      for(const [i,color] of rasterLayouts[c.addPage].text) {
        const [x,y,w,h,size,weight,,text]=setup.text[i];
        ops.push({op:'add',parent:id,node:{id:id+'-t'+i,type:'text',name:text.slice(0,60),x,y,w,h,size,weight,color,text,lh:1,wrap:false}});
      }
      continue;
    }
    if(palette.has(c.from) && palette.has(c.to) && c.from!==c.to){
      for(const n of doc.nodes){const prop=n.type==='text'?'color':'fill';if(n[prop]===c.from)set(n.id,{[prop]:c.to});}
      for(const s of doc.screens)if(s.fill===c.from)ops.push({op:'set',id:s.id,screen:{fill:c.to}});
      continue;
    }
    const n=allowed.get(c.id);if(!n)continue;
    const patch={};
    if(n.type==='text' && typeof c.text==='string' && c.text.trim()) {
      patch.text=c.text.trim().slice(0,300);patch.name=patch.text.slice(0,60);
      patch.size=Math.max(6,Math.min(n.size,n.w/Math.max(1,Doc.measure(patch.text,1,n.weight))));
    }
    if(n.type==='text' && sizes.has(c.size) && c.size>=6 && c.size<=120)patch.size=c.size;
    if(palette.has(c.color))patch[n.type==='text'?'color':'fill']=c.color;
    if(typeof c.visible==='boolean')patch.opacity=c.visible?1:0;
    if(Object.keys(patch).length)set(n.id,patch);
  }
  return {ops,summary:ops.length?'Updated '+ops.length+' vault layer'+(ops.length===1?'':'s')+'.':'No matching vault edit. Try changing a headline, text size, visibility, or palette color.'};
}
