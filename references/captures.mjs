import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {PNG} from 'pngjs';
export const brands=JSON.parse(await readFile(new URL('brands.json',import.meta.url),'utf8'));
const substitutions=JSON.parse(await readFile(new URL('brand-patches.json',import.meta.url),'utf8'));
export const brandCopy=Object.fromEntries(Object.entries(substitutions).map(([key,value])=>[key,value.copy]));

// Patches are lossless PNG rectangles in source coordinates. Never send the original
// photograph to the model or Figma as part of the gallery import.
export async function capture(root,id) {
  if (!Object.hasOwn(brands,id) || !root) throw Object.assign(Error('Unknown vault capture'),{status:404});
  const img=PNG.sync.read(await readFile(join(root,'assets','sites',id+'.png')));
  if(img.width!==1440 || img.height!==900) throw Error('The source viewport changed. Regenerate its brand patches.');
  for(const [x,y,base64] of substitutions[id].patches) {
    const patch=PNG.sync.read(Buffer.from(base64,'base64'));
    PNG.bitblt(patch,img,0,0,patch.width,patch.height,x,y);
  }
  return PNG.sync.write(img);
}
