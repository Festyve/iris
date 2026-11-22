import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Index the image captions and aesthetic associations already maintained in Obsidian.
export async function catalog(root) {
  const assets = new Map();
  async function walk(dir) {
    for (const entry of await readdir(join(root, dir), {withFileTypes:true})) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (/\.(png|jpe?g|webp)$/i.test(path)) {
        const id = entry.name.replace(/\.[^.]+$/, '');
        assets.set(path, {path, title:/^\d+$/.test(id) ? '' : id.replace(/[-_]/g, ' '), tags:new Set()});
      }
    }
  }
  await walk('assets');
  for (const dir of ['Aesthetics','Sources','Profiles']) {
    for (const name of (await readdir(join(root, dir))).sort()) {
      if (!name.endsWith('.md')) continue;
      const lines = (await readFile(join(root,dir,name),'utf8')).split('\n');
      let heading = '', url = '';
      for (const line of lines) {
        if (/^##+ /.test(line)) {
          heading = line.replace(/^#+ /,'');
          url = (heading.match(/\]\((https?:\/\/[^)]+)\)/) || [])[1] || '';
        }
        for (const match of line.matchAll(/!\[([^\]]*)\]\(\.\.\/(assets\/[^)]+)\)/g)) {
          const asset = assets.get(match[2]);
          if (!asset) continue;
          if (dir === 'Aesthetics') {
            asset.tags.add(name.slice(0,-3));
            if (!asset.path.startsWith('assets/x/')) asset.title = match[1] || asset.title;
            if (asset.path.startsWith('assets/sites/') && url) asset.url = url;
          }
          if (dir === 'Sources' && heading.includes(' · ')) asset.title = heading.split(' · ').slice(1).join(' · ');
        }
      }
    }
  }
  return [...assets.values()].sort((a,b)=>a.path.localeCompare(b.path)).map(a=>({...a,tags:[...a.tags].join(' ')}));
}
