import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {indexSources,paths} from '../../../wasp-studio/src/repo-index.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const sha=git('rev-parse','origin/main^{commit}').trim();
const files=Object.fromEntries(paths.map(path=>[path,git('show',sha+':'+path)]));
await writeFile(new URL('../../../wasp-studio/src/repo-evidence.mjs',import.meta.url),'export const snapshot = '+JSON.stringify(indexSources(sha,files),null,2)+';\n');
