import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const [engine,swarm,controller,native,page,client,preview,shared,sharedNative,sharedWeb]=await Promise.all(['engine.js','swarm.js','figma.js','swarm-figma.js','template.html','app.js','swarm-ui.js','shared.js','shared-figma.js','shared-web.js'].map(read));
await Promise.all([
  writeFile(new URL('plugin.js',root),[engine,swarm,shared,controller,native,sharedNative].join('\n')),
  writeFile(new URL('ui.html',root),page.replace('/* ENGINE */',()=>engine+'\n'+swarm+'\n'+shared).replace('/* APP */',()=>client+'\n'+preview+'\n'+sharedWeb))
]);
