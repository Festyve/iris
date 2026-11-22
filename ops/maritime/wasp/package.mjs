// Package only the compiled Wasp HTTP server and its pinned runtime dependencies.
import {mkdtemp, copyFile, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const wasp = fileURLToPath(new URL('../../../wasp-studio/',import.meta.url));
const out = await mkdtemp(join(tmpdir(),'second-cursor-maritime-'));
const lock = JSON.parse(await readFile(join(wasp,'package-lock.json'),'utf8'));
const dependencies = {};
for (const name of ['@prisma/client','prisma','@node-rs/argon2']) dependencies[name] = lock.packages['node_modules/'+name].version;
await writeFile(join(out,'package.json'),JSON.stringify({private:true,type:'module',dependencies}));
const bundle = await readFile(join(wasp,'.wasp/out/server/bundle/server.js'),'utf8');
if (!bundle.includes('Repository read authorization required.')) throw Error('Compile and bundle the updated Wasp server first.');
const {build} = createRequire(join(wasp,'package.json'))('esbuild');
await build({entryPoints:[join(wasp,'.wasp/out/server/bundle/server.js')],outfile:join(out,'server.cjs'),
  platform:'node',format:'cjs',bundle:true,external:['@prisma/client','@node-rs/argon2'],target:'node24',logLevel:'warning'});
await copyFile(join(wasp,'.wasp/out/db/schema.prisma'),join(out,'schema.prisma'));
await copyFile(new URL('./Dockerfile',import.meta.url),join(out,'Dockerfile'));
console.log(out);
