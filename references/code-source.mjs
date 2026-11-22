import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const folder=new URL('../vault/Code/',import.meta.url);
export const sources=JSON.parse(await readFile(new URL('sites.json',folder)));
export const markup={}, images={};
for(const site of sources){
  const root=new URL(site.group+'/',folder);
  let html=await readFile(new URL(site.file+'.html',root),'utf8');
  const css=(await Promise.all(site.styles.map(name=>readFile(new URL(name,root),'utf8')))).join('\n');
  // The measuring document needs intrinsic image dimensions. Actual pixels go
  // separately to Figma as image fills and never make a network request.
  for(const [i,file] of [...new Set(Array.from(html.matchAll(/data-image="([\w.-]+)"/g),m=>m[1]))].entries()){
    const id=site.id+'/v3/'+i;
    const asset=file.endsWith('.svg')?file.replace('.svg','.png'):file;
    const bytes=await readFile(new URL(asset,root));
    const src='data:image/'+(asset.endsWith('.jpg')?'jpeg':'png')+';base64,'+bytes.toString('base64');
    images[id]=bytes.toString('base64');
    html=html.replaceAll('data-image="'+file+'"','data-art="'+id+'"').replaceAll('src="'+file+'"','src="'+src+'"');
  }
  const localCss=css.replace(/url\([^)]*\)/gi,'none');
  const safeCss=(await transform(localCss,{loader:'css',minify:true,legalComments:'none'})).code;
  const adapt='*{font-family:Arial,sans-serif!important} [data-copy]{overflow-wrap:anywhere} [data-copy="brand"]{white-space:normal;max-width:100%} nav [data-copy="brand"]{max-width:55%;line-height:1.15} button,a.button,a.btn{height:auto;min-height:fit-content;max-width:100%;white-space:normal} body{display:flow-root} html,body{scrollbar-width:none}';
  markup[site.id]=html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g,'').replace('</head>','<style>'+safeCss+adapt+'</style></head>');
}
