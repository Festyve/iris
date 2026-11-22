import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Doc} from '../designer.mjs';
const folder=new URL('../vault/Originals/',import.meta.url);
export const webSources=JSON.parse(await readFile(new URL('web-sources.json',folder),'utf8'));
export const collections=JSON.parse(await readFile(new URL('collections.json',folder),'utf8'));
export const source=(await Promise.all(['field-guides.js','pages.js'].map(name=>readFile(new URL(name,folder),'utf8')))).join('\n');
export const originals=vm.runInNewContext(source+'\nOriginalPages',{OriginalCollections:collections,OriginalWebSources:webSources,Doc});
