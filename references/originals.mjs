import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Doc} from '../designer.mjs';
const folder=new URL('../vault/Originals/',import.meta.url);
export const collections=JSON.parse(await readFile(new URL('collections.json',folder),'utf8'));
export const source=await readFile(new URL('pages.js',folder),'utf8');
export const originals=vm.runInNewContext(source+'\nOriginalPages',{OriginalCollections:collections,Doc});
