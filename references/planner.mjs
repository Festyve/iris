import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import vm from 'node:vm';
import {catalog} from './catalog.mjs';
import Match from './match.js';
import {Doc,edit} from '../designer.mjs';

const sites=JSON.parse(await readFile(new URL('sites.json',import.meta.url),'utf8'));
const source=await readFile(new URL('websites.js',import.meta.url),'utf8');
const libraries=new Map();
async function library(root) {
  if (!libraries.has(root)) {
    const loading=catalog(root).then(media=>vm.runInNewContext(source+'\nWebsites',
      {Doc,ReferenceSites:sites,ReferenceMedia:media,ReferenceMatch:Match}));
    libraries.set(root,loading);
    loading.catch(()=>libraries.delete(root));
  }
  return libraries.get(root);
}

// Only read assets discovered in the configured vault. User text never becomes a file path.
async function visual(root,ref) {
  const data=await readFile(join(root,ref.path));
  const mime=ref.path.endsWith('.png')?'image/png':ref.path.endsWith('.webp')?'image/webp':'image/jpeg';
  if (data.length>5_000_000) return [];
  return [{type:'text',text:'Visual reference: '+ref.title},{type:'image',source:{type:'base64',media_type:mime,data:data.toString('base64')}}];
}

export async function websiteDesign(note,root,ask) {
  if (!root || typeof note!=='string' || !note.trim() || !Match.website(note)) return null;
  if (note.length>1500) throw Object.assign(Error('Enter a brief of up to 1500 characters.'),{status:400});
  const websites=await library(root);
  const m=websites.match(note);
  if (!m) return null;
  const seed=Doc.clean(websites.build(note,m));
  if (m.exact || !ask) return {doc:seed,summary:'Built from '+m.site.title};
  const images=(await Promise.all([m.site,m.inspiration].filter(Boolean).map(ref=>visual(root,ref)))).flat();
  const result=await edit(seed,note,(system,user)=>ask(system+'\nAdapt the supplied website reconstruction to the brief. Preserve the reference composition, use meaningful product-specific navigation, copy and features, and replace unrelated artwork. Nodes with art identifiers are editable vector outlines from the reference. Use the images as visual references only.',[...images,{type:'text',text:user}]));
  return {doc:Doc.apply(seed,result.ops).doc,summary:result.summary};
}
