import './poster-adapter/build.mjs';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [spec, icons, layout, kit, crew, studio, page, main, voice] = await Promise.all(['screen-spec.cjs', 'icons.js', 'layout.js', 'kit.js', 'crew.js', 'studio.js', 'template.html', 'figma.js', 'voice.js'].map(read));
const {catalog} = await import('./references/catalog.mjs');
const [sites, media, matcher, websites, minimal, names] = await Promise.all([read('references/sites.json'), catalog(fileURLToPath(new URL('vault',root))), read('references/match.js'), read('references/websites.js'), read('references/minimal.js'), read('references/names.js')]);
const literal = data => JSON.stringify(data).replace(/</g,'\\u003c');
const {brands,brandCopy} = await import('./references/captures.mjs');
const {rasterSite} = await import('./references/raster.mjs');
const rasterLayouts={}, rasterImages={};
for(const [id,site] of Object.entries(JSON.parse(sites))) {
  const {layout,images}=await rasterSite(fileURLToPath(new URL('vault',root)),id,site);
  rasterLayouts[id]=layout;
  Object.assign(rasterImages,images);
}
// Three artwork crops per capture, taken from the most colourful, detailed regions of its home
// screenshot. Companion pages use them (ids 900–902) so every page shares the capture's own visuals.
{
  const {PNG}=await import('pngjs');
  const {capture}=await import('./references/captures.mjs');
  for(const [id,layout] of Object.entries(rasterLayouts)) {
    let im; try { im=PNG.sync.read(await capture(fileURLToPath(new URL('vault',root)),id)); } catch { continue; }
    const W=im.width, H=im.height, C=24, gw=Math.floor(W/C), gh=Math.floor(H/C);
    // Paint out every captured label: each row is blended from the pixel left of the box to the one
    // right of it, which keeps gradients and photos smooth. Text cells are also penalised below.
    const boxes=(JSON.parse(sites)[id].text||[]).map(([x,y,w,h])=>[Math.max(1,Math.floor(x-3)),Math.max(0,Math.floor(y-3)),Math.ceil(w+6),Math.ceil(h+6)]);
    for(const [x,y,w,h] of boxes) {
      const x2=Math.min(W-1,x+w);
      for(let row=y;row<Math.min(H,y+h);row++) {
        const a=(row*W+x-1)*4, z=(row*W+x2)*4;
        for(let col=x;col<x2;col++) { const k=(col-x+1)/(x2-x+1), i=(row*W+col)*4; for(let c=0;c<3;c++) im.data[i+c]=Math.round(im.data[a+c]*(1-k)+im.data[z+c]*k); }
      }
    }
    const textCell=new Uint8Array(gw*gh);
    for(const [x,y,w,h] of boxes) for(let gy=Math.floor(y/C);gy<=Math.min(gh-1,Math.floor((y+h)/C));gy++) for(let gx=Math.floor(x/C);gx<=Math.min(gw-1,Math.floor((x+w)/C));gx++) textCell[gy*gw+gx]=1;
    const score=new Float64Array(gw*gh);
    for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++) {
      // Colour and tonal range score up; dense hard edges (small text) score down.
      let sat=0,l1=0,l2=0,n=0,edges=0,prev=-1;
      for(let y=gy*C;y<gy*C+C;y+=2) for(let x=gx*C;x<gx*C+C;x+=2) {
        const i=(y*W+x)*4, r=im.data[i]/255, g=im.data[i+1]/255, bl=im.data[i+2]/255, mx=Math.max(r,g,bl), mn=Math.min(r,g,bl), l=.3*r+.59*g+.11*bl;
        sat+=mx?(mx-mn)/mx*mx:0; l1+=l; l2+=l*l; n++;
        if(prev>=0 && Math.abs(l-prev)>.3) edges++;
        prev=x+2<gx*C+C?l:-1;
      }
      const mean=l1/n, sd=Math.sqrt(Math.max(0,l2/n-mean*mean));
      score[gy*gw+gx]=sat/n+sd*.7-edges/n*1.6-(textCell[gy*gw+gx]?.35:0);
    }
    const cw=Math.round(gw*.34), ch=Math.round(gh*.44), picks=[];
    const sum=(x,y)=>{let s=0;for(let j=y;j<y+ch;j++)for(let i=x;i<x+cw;i++)s+=score[j*gw+i];return s;};
    const windows=[];
    for(let y=Math.round(gh*.08);y+ch<=gh;y+=2) for(let x=0;x+cw<=gw;x+=2) windows.push([x,y,sum(x,y)]);
    windows.sort((a,b)=>b[2]-a[2]);
    const overlap=(p,w)=>Math.max(0,Math.min(p[0]+cw,w[0]+cw)-Math.max(p[0],w[0]))*Math.max(0,Math.min(p[1]+ch,w[1]+ch)-Math.max(p[1],w[1]));
    for(const w of windows) {
      if(picks.length===3) break;
      if(picks.some(p=>overlap(p,w)>cw*ch*.25)) continue;
      picks.push(w);
    }
    // When only one or two regions are strong (one big product photo), take further, shifted crops
    // of those regions instead of falling back to empty panels.
    const strongEnough=w=>w[2]/(cw*ch)>=.06;
    const strong=picks.filter(strongEnough);
    if(strong.length && strong.length<3) {
      for(const w of windows) {
        if(strong.length===3 || !strongEnough(w)) continue;
        if(strong.some(p=>overlap(p,w)>cw*ch*.72)) continue;
        strong.push(w);
      }
      const merged=[...strong,...picks.filter(p=>!strong.includes(p))].slice(0,3);
      picks.length=0; picks.push(...merged);
    }
    picks.forEach(([x,y],k)=>{
      const out=new PNG({width:cw*C,height:ch*C});
      PNG.bitblt(im,out,x*C,y*C,cw*C,ch*C,0,0);
      rasterImages[id+'/v3/'+(900+k)]=PNG.sync.write(out).toString('base64');
    });
    // Dominant saturated colour of the page (24 hue bins weighted by saturation × brightness).
    {
      const bins=Array.from({length:24},()=>({w:0,r:0,g:0,b:0}));let total=0;
      for(let i=0;i<im.data.length;i+=4*7){
        const r=im.data[i]/255,g=im.data[i+1]/255,bl=im.data[i+2]/255,mx=Math.max(r,g,bl),mn=Math.min(r,g,bl),d=mx-mn;
        if(!mx||d/mx<.35||mx<.25)continue;
        let h=mx===r?((g-bl)/d)%6:mx===g?(bl-r)/d+2:(r-g)/d+4;h=((h*60)+360)%360;
        const wgt=d/mx*mx,bin=bins[Math.floor(h/15)];bin.w+=wgt;bin.r+=r*wgt;bin.g+=g*wgt;bin.b+=bl*wgt;total+=wgt;
      }
      const best=bins.reduce((a,c)=>c.w>a.w?c:a,bins[0]);
      const pixels=im.data.length/4/7;
      if(best.w>pixels*.004) layout.accent='#'+[best.r,best.g,best.b].map(v=>Math.round(v/best.w*255).toString(16).padStart(2,'0')).join('').toUpperCase();
      else delete layout.accent;
    }
    layout.crops=picks.length;
    layout.cropScores=picks.map(p=>Math.round(p[2]/(cw*ch)*1000)/1000);
  }
}
await writeFile(new URL('references/raster-layouts.json',root),JSON.stringify(rasterLayouts)+'\n');
const {source:originalSource,collections,originals,webSources}=await import('./references/originals.mjs');
for(const f of originals.families)for(let i=0;i<3;i++){
  const bytes=await readFile(new URL('vault/Originals/art/'+f.id+'-'+i+'.png',root));
  rasterImages[f.id+'/v3/'+i]=bytes.toString('base64');
}
const library = ['const OriginalWebSources = '+literal(webSources)+';','const OriginalCollections = '+literal(collections)+';',originalSource,'const RasterLayouts = '+literal(rasterLayouts)+';','const LegacyOutlines = '+await read('references/legacy-outlines.json')+';', 'const ReferenceBrands = '+literal(brands)+';','const ReferenceCopy = '+literal(brandCopy)+';','const ReferenceSites = '+literal(JSON.parse(sites))+';', 'const ReferenceMedia = '+literal(media)+';', matcher, names, minimal, websites].join('\n');
const engine = [spec, icons, layout, kit, crew, library].join('\n');
const esbuild = await import('esbuild');
const native = await esbuild.transform([engine,await read('references/sections.js'), main].join('\n'), {target:'es2017',charset:'utf8',minifyWhitespace:true});
await Promise.all([
  writeFile(new URL('plugin.js', root), native.code),
  writeFile(new URL('ui.html', root), page.replace('/* ENGINE */', () => engine).replace('/* APP */', () => 'const RasterImages = '+literal(rasterImages)+';\n'+studio + '\n' + voice))
]);
// The ElevenLabs browser client is bundled separately; server.mjs serves it at /voice.js and the studio loads it on demand.
await esbuild.build({entryPoints: [fileURLToPath(new URL('voice-entry.js', root))], bundle: true, format: 'iife', minify: true, target: 'es2020', outfile: fileURLToPath(new URL('voice.bundle.js', root)), logLevel: 'warning'});
console.log('Built plugin.js and ui.html' + (esbuild ? ' and voice.bundle.js' : ''));
