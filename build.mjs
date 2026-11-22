import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const [engine,swarm,controller,native,page,client,preview,shared,sharedNative,sharedWeb,spec,create,makeNative,makeWeb,voiceUi]=await Promise.all(['engine.js','swarm.js','figma.js','swarm-figma.js','template.html','app.js','swarm-ui.js','shared.js','shared-figma.js','shared-web.js','screen-spec.cjs','create-screen.js','create-figma.js','create-web.js','voice-ui.js'].map(read));
await Promise.all([
  writeFile(new URL('plugin.js',root),[engine,swarm,shared,spec,create,controller,native,sharedNative,makeNative].join('\n')),
  writeFile(new URL('ui.html',root),page.replace('/* ENGINE */',()=>[engine,swarm,shared,spec,create].join('\n')).replace('/* APP */',()=>[client,preview,sharedWeb,makeWeb,voiceUi].join('\n')))
]);
// The ElevenLabs browser client is bundled separately; server.mjs serves it at /voice.js and ui.html loads it on demand.
const esbuild=await import('esbuild').catch(()=>null);
if(esbuild)await esbuild.build({entryPoints:[fileURLToPath(new URL('voice-entry.js',root))],bundle:true,format:'iife',minify:true,target:'es2020',outfile:fileURLToPath(new URL('voice.bundle.js',root)),logLevel:'warning'});
else console.warn('esbuild is not installed; run npm install to build the voice client.');
