import './poster-adapter/build.mjs';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [spec, icons, layout, kit, crew, studio, page, main, voice] = await Promise.all(['screen-spec.cjs', 'icons.js', 'layout.js', 'kit.js', 'crew.js', 'studio.js', 'template.html', 'figma.js', 'voice.js'].map(read));
const {catalog} = await import('./references/catalog.mjs');
const [sites, media, matcher, websites] = await Promise.all([read('references/sites.json'), catalog(fileURLToPath(new URL('vault',root))), read('references/match.js'), read('references/websites.js')]);
const literal = data => JSON.stringify(data).replace(/</g,'\\u003c');
const {brands,brandCopy} = await import('./references/captures.mjs');
const library = ['const LegacyOutlines = '+await read('references/legacy-outlines.json')+';', 'const ReferenceBrands = '+literal(brands)+';','const ReferenceCopy = '+literal(brandCopy)+';','const ReferenceSites = '+literal(JSON.parse(sites))+';', 'const ReferenceMedia = '+literal(media)+';', matcher, websites].join('\n');
const engine = [spec, icons, layout, kit, crew, library].join('\n');
const esbuild = await import('esbuild');
const native = await esbuild.transform([engine,await read('references/sections.js'), main].join('\n'), {target:'es2017',charset:'utf8',minifyWhitespace:true});
await Promise.all([
  writeFile(new URL('plugin.js', root), native.code),
  writeFile(new URL('ui.html', root), page.replace('/* ENGINE */', () => engine).replace('/* APP */', () => studio + '\n' + voice))
]);
// The ElevenLabs browser client is bundled separately; server.mjs serves it at /voice.js and the studio loads it on demand.
await esbuild.build({entryPoints: [fileURLToPath(new URL('voice-entry.js', root))], bundle: true, format: 'iife', minify: true, target: 'es2020', outfile: fileURLToPath(new URL('voice.bundle.js', root)), logLevel: 'warning'});
console.log('Built plugin.js and ui.html' + (esbuild ? ' and voice.bundle.js' : ''));
