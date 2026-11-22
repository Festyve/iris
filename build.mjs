import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const [engine,swarm,controller,native,page,client,preview,shared,sharedNative,sharedWeb,spec,create,makeNative,makeWeb]=await Promise.all(['engine.js','swarm.js','figma.js','swarm-figma.js','template.html','app.js','swarm-ui.js','shared.js','shared-figma.js','shared-web.js','screen-spec.cjs','create-screen.js','create-figma.js','create-web.js'].map(read));
await Promise.all([
  writeFile(new URL('plugin.js',root),[engine,swarm,shared,spec,create,controller,native,sharedNative,makeNative].join('\n')),
  writeFile(new URL('ui.html',root),page.replace('/* ENGINE */',()=>[engine,swarm,shared,spec,create].join('\n')).replace('/* APP */',()=>[client,preview,sharedWeb,makeWeb].join('\n')))
]);
