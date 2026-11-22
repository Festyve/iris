// Design profiles: selectable house styles stored as notes in vault/Profiles/*.md.
// Each note has frontmatter (id, name, tagline, order, refs: [3 image paths relative to the vault])
// and a written brief (palette, type, layout, components, motion, avoid).
import {readFile, readdir} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';

function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return {meta, body: m[2]};
}

// Obsidian markup is noise in a prompt: drop image embeds and turn [[links]] into plain words.
function plain(body) {
  return body.replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => b || a)
    .replace(/\n{3,}/g, '\n\n').trim();
}

export async function loadProfiles(vaultDir) {
  if (!vaultDir) return [];
  let files = [];
  try { files = (await readdir(join(vaultDir, 'Profiles'))).filter(f => f.endsWith('.md')); } catch { return []; }
  const out = [];
  for (const f of files) {
    const parsed = frontmatter(await readFile(join(vaultDir, 'Profiles', f), 'utf8'));
    if (!parsed || !/^[a-z0-9-]{1,40}$/.test(parsed.meta.id || '')) continue;
    const {meta, body} = parsed;
    const refs = (meta.refs || '').replace(/^\[|\]$/g, '').split(',').map(r => r.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    out.push({id: meta.id, name: meta.name || meta.id, tagline: meta.tagline || '', order: Number(meta.order) || 99, brief: plain(body), refs});
  }
  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

const MEDIA = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'};

// The prompt text and reference images for one profile, or null when there is no such profile.
// Images stay inside the vault folder, and each is capped at 4.5 MB (Claude's limit is 5 MB).
export async function profileStyle(vaultDir, id, maxImages = 3) {
  if (!id || typeof id !== 'string') return null;
  const p = (await loadProfiles(vaultDir)).find(x => x.id === id);
  if (!p) return null;
  const root = resolve(vaultDir) + sep, images = [];
  for (const ref of p.refs.slice(0, maxImages)) {
    const file = resolve(vaultDir, ref.replace(/^\.\.\//, '')), ext = (file.match(/\.[a-z]+$/i) || [''])[0].toLowerCase();
    if (!file.startsWith(root) || !MEDIA[ext]) continue;
    try {
      const bytes = await readFile(file);
      if (bytes.length <= 4_500_000) images.push({type: 'image', source: {type: 'base64', media_type: MEDIA[ext], data: bytes.toString('base64')}});
    } catch { /* missing reference image: design without it */ }
  }
  const text = 'Design profile: "' + p.name + '" (' + p.tagline + '). Follow it closely; where it conflicts with the default craft notes, the profile wins. '
    + (images.length ? 'The ' + images.length + ' attached images are its references: borrow their palette, type, surfaces, spacing and mood, never their content or brands.' : '')
    + '\n\n' + p.brief.slice(0, 3000);
  return {id: p.id, name: p.name, text, images};
}
