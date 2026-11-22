import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const [engine,swarm,controller,native,page,client,preview]=await Promise.all(['engine.js','swarm.js','figma.js','swarm-figma.js','template.html','app.js','swarm-ui.js'].map(read));
await Promise.all([
  writeFile(new URL('plugin.js',root),[engine,swarm,controller,native].join('\n')),
  writeFile(new URL('ui.html',root),page.replace('/* ENGINE */',()=>engine+'\n'+swarm).replace('/* APP */',()=>client+'\n'+preview))
]);
