import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [spec, icons, layout, kit, crew, studio, page, main, voice] = await Promise.all(['screen-spec.cjs', 'icons.js', 'layout.js', 'kit.js', 'crew.js', 'studio.js', 'template.html', 'figma.js', 'voice.js'].map(read));
const engine = [spec, icons, layout, kit, crew].join('\n');
await Promise.all([
  writeFile(new URL('plugin.js', root), [engine, main].join('\n')),
  writeFile(new URL('ui.html', root), page.replace('/* ENGINE */', () => engine).replace('/* APP */', () => studio + '\n' + voice))
]);
// The ElevenLabs browser client is bundled separately; server.mjs serves it at /voice.js and the studio loads it on demand.
const esbuild = await import('esbuild').catch(() => null);
if (esbuild) await esbuild.build({entryPoints: [fileURLToPath(new URL('voice-entry.js', root))], bundle: true, format: 'iife', minify: true, target: 'es2020', outfile: fileURLToPath(new URL('voice.bundle.js', root)), logLevel: 'warning'});
else console.warn('esbuild is not installed; run npm install to build the voice client.');
console.log('Built plugin.js and ui.html' + (esbuild ? ' and voice.bundle.js' : ''));
