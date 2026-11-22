import {PNG} from 'pngjs';
import {capture} from './captures.mjs';

const overlaps = (a,b) => a[0]<b[0]+b[2] && b[0]<a[0]+a[2] && a[1]<b[1]+b[3] && b[1]<a[1]+a[3];
const pixel = (im,x,y) => im.data.readUInt32BE((y*im.width+x)*4);
const hex = color => '#'+(color>>>8).toString(16).padStart(6,'0').toUpperCase();
function area(im,[x,y,w,h]) {
  const out=new PNG({width:w,height:h});
  PNG.bitblt(im,out,x,y,w,h,0,0);
  return out;
}
function clear(im,[x,y,w,h],color) {
  for(let row=y;row<y+h;row++) im.data.fill(color,(row*im.width+x)*4,(row*im.width+x+w)*4);
}
const bufferColor = value => { const b=Buffer.alloc(4); b.writeUInt32BE(value); return b; };

// Keep artwork intact even when OCR found small words inside it.
const protectedArt = {
  metalforge: [[240,224,286,410],[540,224,286,310],[840,224,286,288],[1138,224,286,410],
    [240,646,286,254],[540,546,286,354],[840,524,286,376],[1138,646,286,254]],
  godly: [[0,180,1440,720]],
  gumroad: [[0,100,230,540],[1110,100,330,620],[465,750,390,150]],
  'teenage-engineering': [[0,525,1440,375],[1060,0,120,110]]
};

// A label may be lifted only when it has a closed, uniform surface around
// it and the interior consists of ink blended over that single background.
function lettering(im,box) {
  const [x,y,w,h]=box;
  const surface=pixel(im,x,y);
  for(let i=x;i<x+w;i++) if(pixel(im,i,y)!==surface || pixel(im,i,y+h-1)!==surface) return;
  for(let j=y;j<y+h;j++) if(pixel(im,x,j)!==surface || pixel(im,x+w-1,j)!==surface) return;
  const rgb=v=>[v>>>24,(v>>>16)&255,(v>>>8)&255], bg=rgb(surface);
  let max=0, ink, painted=0;
  const colors=new Set();
  for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++){
    const v=pixel(im,i,j);
    if(v===surface)continue;
    colors.add(v); painted++;
    const c=rgb(v), d=c.reduce((sum,n,k)=>sum+(n-bg[k])**2,0);
    if(d>max){max=d;ink=v;}
  }
  if(max<400 || painted<4 || painted>w*h*.58) return;
  const axis=rgb(ink).map((n,k)=>n-bg[k]);
  for(const v of colors){
    const delta=rgb(v).map((n,k)=>n-bg[k]);
    const t=delta.reduce((s,n,k)=>s+n*axis[k],0)/max;
    if(delta.some((n,k)=>Math.abs(n-t*axis[k])>6)) return;
  }
  return {surface,ink};
}

export async function rasterSite(root,id,site) {
  const original=PNG.sync.read(await capture(root,id));
  const shapes=[], images={}, text=[], occupied=[];
  const artwork=protectedArt[id] || [];
  const parts=[], preserved=[];
  function take(box,name) {
    const tile=area(original,box);
    // Later extractions see the surface behind this component. Reversing the
    // extraction order restores the source even for nested UI components.
    const surface=pixel(tile,0,0);
    if(tile.data.every((v,i)=>v===tile.data[i%4]))return;
    parts.push({tile,box,name});
    clear(original,box,bufferColor(surface));
  }
  const letters=site.text.map((row,i)=>({row,i})).sort((a,b)=>b.row[4]-a.row[4]);
  for(const {row,i} of letters){
    const [x,y,w,h]=row;
    const box=[x,y,w,h];
    let mask=null, info=null;
    if(!artwork.some(b=>overlaps(b,box)))for(let pad=0;pad<=4;pad++){
      const l=Math.max(0,x-pad), t=Math.max(0,y-pad);
      const bounds=[l,t,Math.min(original.width,x+w+pad)-l,Math.min(original.height,y+h+pad)-t];
      if(occupied.some(b=>overlaps(b,bounds)))break;
      info=lettering(original,bounds);
      if(info){mask=bounds;break;}
    }
    if(mask){
      clear(original,mask,bufferColor(info.surface));
      occupied.push(mask);
      text.push([i,hex(info.ink)]);
    } else {
      // Preserve text inside previews, textures and logos at its original
      // resolution. A brief may never substitute new copy in these regions.
      preserved.push([box,'Artwork detail · '+row[7].slice(0,40)]);
    }
  }
  for(const [box,name] of preserved)take(box,name);
  const candidates=site.shapes.map(s=>s.slice(0,4))
    .filter(([, ,w,h])=>w>=6 && h>=6 && w*h<original.width*original.height*.65);
  for(const box of candidates.sort((a,b)=>a[2]*a[3]-b[2]*b[3])){
    // Never split a picture across its outer edge.
    if(artwork.some(b=>overlaps(b,box) && !(box[0]>=b[0] && box[1]>=b[1] &&
      box[0]+box[2]<=b[0]+b[2] && box[1]+box[3]<=b[1]+b[3])))continue;
    take(box,'Component '+(parts.length+1));
  }
  for(const [i,box] of artwork.entries())take(box,'Artwork '+(i+1));
  parts.push({tile:original,box:[0,0,original.width,original.height],name:'Page artwork'});
  for(const {tile,box,name} of parts.reverse()){
    const value=pixel(tile,0,0), uniform=tile.data.every((v,i)=>v===tile.data[i%4]);
    const index=shapes.length;
    shapes.push([...box,hex(value),!uniform,name]);
    if(!uniform)images[id+'/v3/'+index]=PNG.sync.write(tile,{colorType:2}).toString('base64');
  }
  return {layout:{shapes,text:text.sort((a,b)=>a[0]-b[0])},images};
}
