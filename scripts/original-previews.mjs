// Build the browsable vault previews from the same nodes Figma receives.
import {writeFile,mkdir} from 'node:fs/promises';
import {originals} from '../references/originals.mjs';
const root=new URL('../vault/Originals/',import.meta.url);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const index=['# Original website references','','![Artwork from the original collections](collection-index.jpg)','','Choose **Vault website** in Iris and enter a subject, or a collection name and page role such as **Fold House Lookbook**. Each collection includes three original graphic plates.','','| Collection | Page previews |','| --- | --- |'];
for(const f of originals.families){
  const links=[];
  await mkdir(new URL('pages/'+f.id+'/',root),{recursive:true});
  for(const role of originals.roles){
    const {nodes}=originals.page(f,role,f.name,'web');
    const svg=['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1440" height="900">','<rect width="1440" height="900" fill="'+f.paper+'"/>'];
    for(const n of nodes){
      if(n.type==='text')svg.push('<text x="'+n.x+'" y="'+(n.y+n.size*.90)+'" font-family="Inter,Arial,sans-serif" font-size="'+n.size+'" font-weight="'+n.weight+'" fill="'+n.color+'">'+esc(n.text)+'</text>');
      else if(n.art)svg.push('<image x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" preserveAspectRatio="xMidYMid slice" xlink:href="../../art/'+f.id+'-'+n.art.split('/').pop()+'.png"/>');
      else if(n.shape==='ellipse')svg.push('<ellipse cx="'+(n.x+n.w/2)+'" cy="'+(n.y+n.h/2)+'" rx="'+(n.w/2)+'" ry="'+(n.h/2)+'" fill="'+n.fill+'"/>');
      else svg.push('<rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" fill="'+n.fill+'"/>');
    }
    const file='pages/'+f.id+'/'+role.toLowerCase()+'.svg';
    await writeFile(new URL(file,root),svg.join('\n')+'\n</svg>\n');
    links.push('['+role+']('+file+')');
  }
  index.push('| '+f.name+' | '+links.join(' · ')+' |');
}
await writeFile(new URL('README.md',root),index.join('\n')+'\n');
