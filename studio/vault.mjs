import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { createStore, del, setMany, values } from 'idb-keyval';

const imageTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml' };
const basename = path => path.split('/').pop();
const extension = path => basename(path).split('.').pop().toLowerCase();
const string = value => typeof value === 'string' ? value.trim() : '';
const strings = value => (Array.isArray(value) ? value : [value]).map(string).filter(Boolean);
const unique = values => [...new Set(values)];
let store;
const libraryStore = () => store ??= createStore('second-cursor-reference-library', 'references');

export const readLibrary = () => values(libraryStore());
export const saveReferences = refs => setMany(refs.map(ref => [ref.id, ref]), libraryStore());
export const removeReference = id => del(id, libraryStore());

function safeSource(raw) {
  if (!/^https?:\/\//i.test(raw)) return '';
  try { return new URL(raw).href; } catch { return ''; }
}

function resolvePath(base, target) {
  const path = decodeURIComponent(target);
  if (!path || /^(?:\/|[a-z][\w+.-]*:)/i.test(path) || /[\\\x00-\x1f]/.test(path)) {
    throw new Error('Expected a local image path');
  }
  const parts = [...base];
  for (const part of path.split('/')) {
    if (part === '..') {
      if (!parts.length) throw new Error('Image path leaves this collection');
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function parseNote(text, path) {
  let body = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let meta = {};
  if (/^---[ \t]*\n/.test(body)) {
    const header = body.match(/^---[ \t]*\n([\s\S]*?)^(?:---|\.\.\.)[ \t]*(?:\n|$)/m);
    if (!header) throw new Error('Unclosed YAML frontmatter');
    meta = load(header[1], { schema: FAILSAFE_SCHEMA }) ?? {};
    if (typeof meta !== 'object' || Array.isArray(meta)) throw new Error('Expected a YAML mapping');
    body = body.slice(header[0].length);
  }
  const title = string(meta.title) || body.match(/^#\s+(.+)$/m)?.[1].trim() || basename(path).replace(/\.[^.]+$/, '');
  const headings = [...body.matchAll(/^#{2,6}\s+(.+)$/gm)];
  const sections = headings.map((match, i) => ({
    heading: match[1].toLowerCase(),
    text: body.slice(match.index + match[0].length, headings[i + 1]?.index).trim(),
  }));
  const section = pattern => sections.find(item => pattern.test(item.heading))?.text || '';
  const intro = body.slice(0, headings[0]?.index).replace(/^#\s+.*$/gm, '').trim();
  const tags = unique([...strings(meta.tags), ...strings(meta.features)].flatMap(tag => tag.split(','))
    .concat([...body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(match => match[1]))
    .map(tag => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean));
  const links = strings(meta.asset_path ?? meta.image ?? meta.images).map(target => ({ target, root: true }));
  const definitions = new Map();
  for (const match of body.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)) {
    definitions.set(match[1].toLowerCase(), match[2] || match[3]);
  }
  const imageSyntax = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[([^\]]*)\](?:\(\s*(?:<([^>]+)>|((?:[^\s()]|\([^()]*\))+))(?:\s+["'][^"']*["'])?\s*\)|\[([^\]]*)\])?/g;
  for (const match of body.matchAll(imageSyntax)) {
    const target = match[1] || match[3] || match[4] || definitions.get((match[5] || match[2]).toLowerCase());
    if (target) links.push({ target: target.trim(), wiki: Boolean(match[1]) });
    else if (match[5] !== undefined) links.push({ missingDefinition: match[5] || match[2] });
  }
  return {
    title, tags, links, body, originalMarkdown: text, author: strings(meta.author ?? meta.authors).join(', '),
    sourceUrl: safeSource(string(meta.source_url || meta.sourceUrl || meta.source || meta.url) || body.match(/https?:\/\/[^\s<>)\]]+/i)?.[0] || ''),
    observation: string(meta.observation) || section(/observ|what works/) || intro || sections[0]?.text || '',
    adaptation: string(meta.adaptation) || section(/adapt|application/),
    capturedAt: string(meta.captured_at || meta.date),
  };
}

export function referenceOrigin(ref) {
  return ref.origin ?? (ref.id.startsWith('design-vault-demo:') ? 'demo' : 'snapshot');
}

async function digest(data) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Loose files have no directory identity. Include the note and its actual
// attachments so equally named files from unrelated picks can coexist.
async function looseIdentity(ref, imageDigests) {
  const parts = [ref.originalMarkdown ?? null];
  for (const asset of ref.images) {
    if (!imageDigests.has(asset)) {
      imageDigests.set(asset, asset.blob.arrayBuffer().then(digest));
    }
    parts.push([asset.path, await imageDigests.get(asset)]);
  }
  return 'loose-' + await digest(new TextEncoder().encode(JSON.stringify(parts)));
}

// Each top-level folder is its own collection. Loose files share only this import.
export async function importFiles(entries, batch, existingRefs = []) {
  // Preserve previously issued project selection IDs for unambiguous folder paths.
  const previousIds = new Map();
  for (const ref of existingRefs) {
    if (referenceOrigin(ref) === 'snapshot' && ref.path.includes('/')) {
      previousIds.set(ref.path, previousIds.has(ref.path) ? null : ref.id);
    }
  }
  const groups = new Map();
  const errors = [];
  const refs = [];
  for (const item of entries) {
    const file = item.file || item;
    const full = item.path || file.webkitRelativePath || file.name;
    if (item.error) { errors.push({ path: full, message: item.error }); continue; }
    if (/^(?:\/|[a-z]:)|\\/i.test(full) || full.split('/').some(part => !part || part === '..' || part === '.')) {
      errors.push({ path: full, message: 'Invalid import path' }); continue;
    }
    const parts = full.split('/');
    if (parts.some(part => part.startsWith('.'))) continue;
    const group = parts.length > 1 ? parts.shift() : '';
    if (!groups.has(group)) groups.set(group, new Map());
    const files = groups.get(group);
    const path = parts.join('/');
    if (files.has(path)) errors.push({ path: full, message: 'Duplicate file path' });
    else files.set(path, file);
  }
  for (const [group, files] of groups) {
    const images = new Map();
    const used = new Set();
    const collectionRefs = [];
    const makeBase = path => ({
      path: [group, path].filter(Boolean).join('/'),
      origin: batch === 'design-vault-demo' ? 'demo' : 'snapshot', warnings: [],
      images: [], tags: [], sourceUrl: '', observation: '', adaptation: '',
    });
    for (const [path, file] of files) {
      const type = imageTypes[extension(path)];
      if (typeof type === 'string') images.set(path, { path, blob: file.slice(0, file.size, type) });
    }
    for (const [path, file] of files) {
      if (images.has(path)) continue;
      const ref = makeBase(path);
      try {
        if (!/\.(?:md|markdown|mdown)$/i.test(path)) throw new Error('Unsupported file type');
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }).decode(await file.arrayBuffer());
        const { links, ...note } = parseNote(text, path);
        Object.assign(ref, note);
        for (const { target, root, wiki, missingDefinition } of links) {
          try {
            if (missingDefinition !== undefined) throw new Error('Image link definition missing');
            const base = path.split('/').slice(0, -1);
            const vaultRelative = root && !/^\.{1,2}\//.test(target);
            const resolved = resolvePath(vaultRelative ? [] : base, target);
            let asset = images.get(resolved);
            if (!asset && (vaultRelative || wiki)) {
              const alternate = resolvePath(vaultRelative ? base : [], target);
              asset = images.get(alternate);
            }
            if (!asset && wiki && !target.includes('/')) {
              const matches = [...images.values()].filter(image => basename(image.path) === decodeURIComponent(target));
              if (matches.length > 1) throw new Error('Ambiguous image name');
              asset = matches[0];
            }
            if (!asset) throw new Error('Image missing from collection');
            if (!ref.images.includes(asset)) ref.images.push(asset);
            used.add(asset.path);
          } catch (error) {
            const message = (target ?? missingDefinition) + ' — ' + error.message;
            ref.warnings.push(message);
            errors.push({ path: ref.path, message });
          }
        }
        collectionRefs.push(ref);
      } catch (error) { errors.push({ path: ref.path, message: error.message }); }
    }
    for (const [path, asset] of images) {
      if (!used.has(path)) collectionRefs.push({ ...makeBase(path), title: basename(path), images: [asset] });
    }
    const imageDigests = new Map();
    for (const ref of collectionRefs) {
      try {
        const namespace = batch ?? (group ? 'folder' : await looseIdentity(ref, imageDigests));
        const path = group ? ref.path.slice(group.length + 1) : ref.path;
        const id = [namespace, group, path].map(encodeURIComponent).join(':');
        ref.id = (!batch && group && previousIds.get(ref.path)) || id;
        refs.push(ref);
      } catch (error) { errors.push({ path: ref.path, message: error.message }); }
    }
  }
  return { refs, errors };
}

// Capture entry handles while the drop event still grants access.
export async function droppedFiles(transfer) {
  const handles = Array.from(transfer.items || []).filter(item => item.kind === 'file')
    .map(item => item.webkitGetAsEntry?.() || item.getAsFile()).filter(Boolean);
  if (!handles.length) return Array.from(transfer.files);
  const entries = [];
  async function walk(handle, parent = '') {
    const path = parent + handle.name;
    try {
      if (handle.isDirectory) {
        const reader = handle.createReader();
        for (;;) {
          const children = await new Promise((ok, fail) => reader.readEntries(ok, fail));
          if (!children.length) break;
          for (const child of children) await walk(child, path + '/');
        }
      } else {
        const file = handle.isFile ? await new Promise((ok, fail) => handle.file(ok, fail)) : handle;
        entries.push({ path, file });
      }
    } catch (error) { entries.push({ path, error: error.message || 'Could not read entry' }); }
  }
  for (const handle of handles) await walk(handle);
  return entries;
}

const stopWords = new Set('a an the to of on or in for with from this that and is are build create design page app ui should use'.split(' '));
function words(value) {
  return new Set((String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter(word => !stopWords.has(word)).map(word => word.length > 3 ? word.replace(/s$/, '') : word));
}
function queryText(value) {
  if (Array.isArray(value)) return value.map(queryText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(queryText).join(' ');
  return string(value);
}

export function rankReferences(refs, brief, features) {
  const requested = words(queryText(features));
  const query = new Set([...requested, ...words(queryText(brief))]);
  return refs.map(ref => {
    const tags = words((ref.tags || []).join(' '));
    const title = words(ref.title);
    const prose = words([ref.observation, ref.adaptation, ref.body].join(' '));
    const matches = [];
    let score = 0;
    for (const term of query) {
      const weight = (tags.has(term) ? 6 : 0) + (title.has(term) ? 3 : 0) + (prose.has(term) ? 1 : 0);
      if (weight) {
        score += weight * (requested.has(term) ? 2 : 1);
        matches.push(term);
      }
    }
    return { id: ref.id, reason: 'Matches ' + matches.join(', '), score };
  }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
