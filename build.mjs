import {readFile, writeFile} from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [spec, icons, layout, kit, crew, studio, page, main] = await Promise.all(['screen-spec.cjs', 'icons.js', 'layout.js', 'kit.js', 'crew.js', 'studio.js', 'template.html', 'figma.js'].map(read));
const engine = [spec, icons, layout, kit, crew].join('\n');
await Promise.all([
  writeFile(new URL('plugin.js', root), [engine, main].join('\n')),
  writeFile(new URL('ui.html', root), page.replace('/* ENGINE */', () => engine).replace('/* APP */', () => studio))
]);
console.log('Built plugin.js and ui.html');
